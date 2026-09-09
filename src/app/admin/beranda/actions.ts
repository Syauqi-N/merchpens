"use server";

import { revalidatePath } from "next/cache";

import {
  capabilityDeniedResult,
  serverErrorResult,
  validationFailure,
  type ActionResult,
} from "@/components/admin/action-result";
import { requireCapability } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bannerFormSchema, masterTextToJson, storeSettingsSchema, STORE_SETTING_KEYS } from "./schemas";

function revalidateHomepage() {
  revalidatePath("/admin/beranda");
  revalidatePath("/");
  // Nama toko, kontak, dan info pengambilan dipakai header/footer serta
  // ringkasan checkout di seluruh halaman.
  revalidatePath("/produk");
  revalidatePath("/pre-order");
  revalidatePath("/checkout");
  revalidatePath("/admin/pre-order/baru");
}

// ---------- Banner ----------

/** Menambah banner beranda. */
export async function createBanner(input: unknown): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_CATALOG");
  } catch {
    return capabilityDeniedResult("MANAGE_CATALOG");
  }

  const parsed = bannerFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const data = parsed.data;

  try {
    const banner = await prisma.banner.create({
      data: {
        title: data.title,
        subtitle: data.subtitle === "" ? null : data.subtitle,
        imageUrl: data.imageUrl,
        linkUrl: data.linkUrl === "" ? null : data.linkUrl,
        sortOrder: data.sortOrder === "" ? 0 : Number(data.sortOrder),
        isActive: data.isActive,
      },
      select: { id: true, title: true },
    });

    revalidateHomepage();

    return {
      ok: true,
      message: `Banner "${banner.title}" berhasil ditambahkan.`,
      id: banner.id,
    };
  } catch (error) {
    return serverErrorResult("createBanner", error);
  }
}

/** Mengubah banner beranda. */
export async function updateBanner(id: string, input: unknown): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_CATALOG");
  } catch {
    return capabilityDeniedResult("MANAGE_CATALOG");
  }

  if (typeof id !== "string" || id.trim() === "") {
    return { ok: false, message: "Banner tidak dikenal." };
  }

  const parsed = bannerFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const data = parsed.data;

  try {
    const existing = await prisma.banner.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return { ok: false, message: "Banner tidak ditemukan (mungkin sudah dihapus)." };
    }

    const banner = await prisma.banner.update({
      where: { id },
      data: {
        title: data.title,
        subtitle: data.subtitle === "" ? null : data.subtitle,
        imageUrl: data.imageUrl,
        linkUrl: data.linkUrl === "" ? null : data.linkUrl,
        sortOrder: data.sortOrder === "" ? 0 : Number(data.sortOrder),
        isActive: data.isActive,
      },
      select: { title: true },
    });

    revalidateHomepage();

    return { ok: true, message: `Banner "${banner.title}" tersimpan.`, id };
  } catch (error) {
    return serverErrorResult("updateBanner", error);
  }
}

/** Menghapus banner beranda. */
export async function deleteBanner(id: string): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_CATALOG");
  } catch {
    return capabilityDeniedResult("MANAGE_CATALOG");
  }

  if (typeof id !== "string" || id.trim() === "") {
    return { ok: false, message: "Banner tidak dikenal." };
  }

  try {
    const banner = await prisma.banner.findUnique({
      where: { id },
      select: { title: true },
    });
    if (!banner) {
      return { ok: false, message: "Banner tidak ditemukan (mungkin sudah dihapus)." };
    }

    await prisma.banner.delete({ where: { id } });

    revalidateHomepage();

    return { ok: true, message: `Banner "${banner.title}" berhasil dihapus.` };
  } catch (error) {
    return serverErrorResult("deleteBanner", error);
  }
}

/** Mengaktifkan / menonaktifkan banner. */
export async function toggleBannerActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_CATALOG");
  } catch {
    return capabilityDeniedResult("MANAGE_CATALOG");
  }

  if (typeof id !== "string" || id.trim() === "" || typeof isActive !== "boolean") {
    return { ok: false, message: "Permintaan tidak valid." };
  }

  try {
    const banner = await prisma.banner.update({
      where: { id },
      data: { isActive },
      select: { title: true },
    });

    revalidateHomepage();

    return {
      ok: true,
      message: isActive
        ? `Banner "${banner.title}" ditampilkan.`
        : `Banner "${banner.title}" disembunyikan.`,
    };
  } catch (error) {
    return serverErrorResult("toggleBannerActive", error);
  }
}

// ---------- Pengaturan toko ----------

/**
 * Menyimpan seluruh pengaturan toko sekaligus.
 *
 * Setiap kunci di-`upsert` di dalam satu transaksi supaya tidak ada keadaan
 * setengah tersimpan bila salah satu baris gagal.
 */
export async function updateStoreSettings(input: unknown): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_CATALOG");
  } catch {
    return capabilityDeniedResult("MANAGE_CATALOG");
  }

  const parsed = storeSettingsSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const data = parsed.data;

  try {
    await prisma.$transaction(
      STORE_SETTING_KEYS.map((key) => {
        // Master dropdown disimpan sebagai JSON array, form mengisinya satu
        // entri per baris.
        const value =
          key === "angkatan_list" || key === "jurusan_list"
            ? masterTextToJson(data[key])
            : data[key];
        return prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      }),
    );

    revalidateHomepage();

    return { ok: true, message: "Informasi toko berhasil disimpan." };
  } catch (error) {
    return serverErrorResult("updateStoreSettings", error);
  }
}
