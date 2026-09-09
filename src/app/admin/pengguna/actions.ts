"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

import {
  capabilityDeniedResult,
  isUniqueConstraintError,
  serverErrorResult,
  validationFailure,
  type ActionResult,
} from "@/components/admin/action-result";
import type { Prisma } from "@/generated/prisma/client";
import { requireCapability } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  createStaffSchema,
  resetUserPasswordSchema,
  setUserActiveSchema,
  updateUserRoleSchema,
} from "./schemas";

/**
 * Aksi kelola pengguna.
 *
 * SETIAP fungsi di sini memanggil `requireCapability("MANAGE_USERS")` di baris
 * pertamanya. Server Action bisa dipanggil langsung lewat POST tanpa pernah
 * melewati UI, jadi menyembunyikan tombol di layar bukan pengaman — pengecekan
 * di dalam fungsi inilah pengamannya.
 */

/** Sama dengan biaya hashing saat pendaftaran pelanggan (`(auth)/actions.ts`). */
const BCRYPT_ROUNDS = 10;

const LAST_PENGURUS_MESSAGE =
  "Ini satu-satunya pengurus aktif. Angkat pengurus lain dulu sebelum mencabut akses ini.";

const WRITE_CONFLICT_MESSAGE =
  "Ada pengurus lain yang mengubah data ini pada saat bersamaan. Muat ulang halaman lalu coba lagi.";

/** Nama yang enak dibaca di pesan hasil; jatuh ke email bila nama kosong. */
function displayName(user: { name: string | null; email: string }): string {
  const trimmed = user.name?.trim() ?? "";
  return trimmed === "" ? user.email : trimmed;
}

/** Konflik serialisasi Postgres yang diteruskan Prisma (P2034). */
function isWriteConflictError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2034"
  );
}

/**
 * Apakah tindakan ini akan menghabiskan pengurus aktif terakhir?
 *
 * Dipanggil DI DALAM transaksi yang juga melakukan update-nya. Kalau hitungan
 * dan update dipisah, dua pengurus yang saling menurunkan pada detik yang
 * sama sama-sama membaca "masih ada 2", lalu sama-sama menulis — dan tidak ada
 * yang tersisa untuk memulihkannya. Transaksinya dijalankan pada isolasi
 * `Serializable` supaya Postgres benar-benar menolak salah satu dari dua
 * penulisan itu, bukan sekadar membungkusnya jadi satu perintah.
 */
async function isLastActivePengurus(
  tx: Prisma.TransactionClient,
  target: { id: string; role: string; isActive: boolean },
): Promise<boolean> {
  if (target.role !== "PENGURUS" || !target.isActive) return false;

  const activePengurus = await tx.user.count({
    where: { role: "PENGURUS", isActive: true },
  });

  return activePengurus <= 1;
}

/** Kolom yang aman dibaca aksi — `passwordHash` tidak pernah ikut. */
const targetSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
} as const;

/**
 * Menambah akun pengurus baru.
 *
 * Perannya dibatasi `ASSIGNABLE_ROLES` lewat skema, jadi walaupun payload
 * dikarang sendiri, peran di luar daftar itu ditolak sebelum menyentuh database.
 */
export async function createStaff(input: unknown): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_USERS");
  } catch {
    return capabilityDeniedResult("MANAGE_USERS");
  }

  const parsed = createStaffSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const { name, email, phone, password, role } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  try {
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existing) {
      return {
        ok: false,
        message: "Email tersebut sudah dipakai akun lain.",
        fieldErrors: { email: "Email sudah dipakai akun lain" },
      };
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const created = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        phone: phone === "" ? null : phone,
        passwordHash,
        role,
        isActive: true,
      },
      select: { id: true, name: true, email: true },
    });

    revalidatePath("/admin/pengguna");

    return {
      ok: true,
      message: `Akun ${displayName(created)} dibuat sebagai ${ROLE_LABEL[role]}. Sampaikan kata sandinya lewat jalur pribadi, lalu minta dia menggantinya.`,
      id: created.id,
    };
  } catch (error) {
    // Dua pembuatan akun bersamaan dengan email sama akan mendarat di sini.
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        message: "Email tersebut sudah dipakai akun lain.",
        fieldErrors: { email: "Email sudah dipakai akun lain" },
      };
    }
    return serverErrorResult("createStaff", error);
  }
}

/** Mengubah peran seorang pengguna. */
export async function updateUserRole(input: unknown): Promise<ActionResult> {
  let actorId: string;
  try {
    const actor = await requireCapability("MANAGE_USERS");
    actorId = actor.id;
  } catch {
    return capabilityDeniedResult("MANAGE_USERS");
  }

  const parsed = updateUserRoleSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const { userId, role } = parsed.data;

  // Mengubah peran sendiri = bisa menaikkan diri sendiri, atau tanpa sadar
  // mengunci diri di luar panel. Keduanya harus lewat pengurus lain.
  if (userId === actorId) {
    return { ok: false, message: "Kamu tidak bisa mengubah peran akunmu sendiri." };
  }

  try {
    const result = await prisma.$transaction<ActionResult>(
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { id: userId },
          select: targetSelect,
        });
        if (!target) {
          return { ok: false, message: "Pengguna tidak ditemukan." };
        }

        if (target.role === role) {
          return {
            ok: true,
            message: `${displayName(target)} memang sudah berperan ${ROLE_LABEL[role]}.`,
            id: target.id,
          };
        }

        // Menurunkan pengurus aktif terakhir sama saja mencabut kemampuan
        // mengelola akun dari seluruh organisasi.
        if (role !== "PENGURUS" && (await isLastActivePengurus(tx, target))) {
          return { ok: false, message: LAST_PENGURUS_MESSAGE };
        }

        const updated = await tx.user.update({
          where: { id: userId },
          data: { role },
          select: { id: true, name: true, email: true },
        });

        return {
          ok: true,
          message: `Peran ${displayName(updated)} diubah menjadi ${ROLE_LABEL[role]}.`,
          id: updated.id,
        };
      },
      { isolationLevel: "Serializable" },
    );

    if (result.ok) revalidatePath("/admin/pengguna");
    return result;
  } catch (error) {
    if (isWriteConflictError(error)) {
      return { ok: false, message: WRITE_CONFLICT_MESSAGE };
    }
    return serverErrorResult("updateUserRole", error);
  }
}

/**
 * Mengaktifkan / menonaktifkan akun.
 *
 * Tidak ada aksi hapus pengguna di panel ini dan itu disengaja: `Order.userId`
 * adalah relasi WAJIB, jadi menghapus akun akan merusak riwayat pesanannya.
 * Menonaktifkan adalah cara yang benar untuk mencabut akses — akun nonaktif
 * ditolak saat login (lihat `lib/auth.ts`) dan `getCurrentActor()` langsung
 * memutus aksesnya walau tokennya masih berlaku.
 */
export async function setUserActive(input: unknown): Promise<ActionResult> {
  let actorId: string;
  try {
    const actor = await requireCapability("MANAGE_USERS");
    actorId = actor.id;
  } catch {
    return capabilityDeniedResult("MANAGE_USERS");
  }

  const parsed = setUserActiveSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const { userId, isActive } = parsed.data;

  if (userId === actorId) {
    return {
      ok: false,
      message: isActive
        ? "Akunmu sendiri sudah aktif — tidak ada yang perlu diubah."
        : "Kamu tidak bisa menonaktifkan akunmu sendiri. Minta pengurus lain yang melakukannya.",
    };
  }

  try {
    const result = await prisma.$transaction<ActionResult>(
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { id: userId },
          select: targetSelect,
        });
        if (!target) {
          return { ok: false, message: "Pengguna tidak ditemukan." };
        }

        if (target.isActive === isActive) {
          return {
            ok: true,
            message: isActive
              ? `Akun ${displayName(target)} memang sudah aktif.`
              : `Akun ${displayName(target)} memang sudah nonaktif.`,
            id: target.id,
          };
        }

        if (!isActive && (await isLastActivePengurus(tx, target))) {
          return { ok: false, message: LAST_PENGURUS_MESSAGE };
        }

        const updated = await tx.user.update({
          where: { id: userId },
          data: { isActive },
          select: { id: true, name: true, email: true },
        });

        return {
          ok: true,
          message: isActive
            ? `Akun ${displayName(updated)} diaktifkan kembali.`
            : `Akun ${displayName(updated)} dinonaktifkan. Dia tidak bisa masuk lagi, tetapi riwayat pesanannya tetap utuh.`,
          id: updated.id,
        };
      },
      { isolationLevel: "Serializable" },
    );

    if (result.ok) revalidatePath("/admin/pengguna");
    return result;
  } catch (error) {
    if (isWriteConflictError(error)) {
      return { ok: false, message: WRITE_CONFLICT_MESSAGE };
    }
    return serverErrorResult("setUserActive", error);
  }
}

/**
 * Mengatur ulang kata sandi seorang pengguna.
 *
 * Sandi lama tidak pernah dibaca — kolom yang disimpan adalah hash bcrypt dan
 * memang tidak bisa dikembalikan ke teks aslinya. Ini jalur pemulihan untuk
 * pengurus yang lupa sandinya, bukan cara melihat sandi orang lain.
 */
export async function resetUserPassword(input: unknown): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_USERS");
  } catch {
    return capabilityDeniedResult("MANAGE_USERS");
  }

  const parsed = resetUserPasswordSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const { userId, password } = parsed.data;

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (!target) {
      return { ok: false, message: "Pengguna tidak ditemukan." };
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { id: true },
    });

    revalidatePath("/admin/pengguna");

    return {
      ok: true,
      message: `Kata sandi ${displayName(target)} berhasil diatur ulang.`,
      id: target.id,
    };
  } catch (error) {
    return serverErrorResult("resetUserPassword", error);
  }
}
