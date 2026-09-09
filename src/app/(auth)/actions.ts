"use server";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { clientIp, consumeRateLimit, rateLimitedMessage } from "@/lib/rate-limit";
import { registerSchema, type RegisterFieldName } from "./schemas";

export type RegisterResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      fieldErrors?: Partial<Record<RegisterFieldName, string>>;
    };

/**
 * Mendaftarkan pelanggan baru (role CUSTOMER).
 *
 * Server Action bisa dipanggil langsung lewat POST, jadi seluruh validasi
 * diulang di sini dan tidak bergantung pada validasi sisi klien. Pendaftaran
 * bersifat publik sehingga tidak ada pemeriksaan sesi — namun peran selalu
 * dipaksa CUSTOMER agar tidak bisa membuat admin dari form.
 */
export async function registerUser(input: unknown): Promise<RegisterResult> {
  // Endpoint publik — batasi 5 pendaftaran / 10 menit / IP.
  const ip = await clientIp();
  const limit = consumeRateLimit(`register:${ip}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return { ok: false, message: rateLimitedMessage(limit.retryAfterMs) };
  }

  const parsed = registerSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Partial<Record<RegisterFieldName, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) {
        fieldErrors[key as RegisterFieldName] = issue.message;
      }
    }
    return {
      ok: false,
      message: "Periksa kembali data yang kamu isi.",
      fieldErrors,
    };
  }

  const { name, email, phone, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  try {
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      return {
        ok: false,
        message: "Email tersebut sudah terdaftar. Silakan masuk.",
        fieldErrors: { email: "Email sudah terdaftar" },
      };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        phone,
        passwordHash,
        role: "CUSTOMER",
      },
    });

    return { ok: true };
  } catch (error) {
    // Kemungkinan besar tabrakan unique email karena dua pendaftaran bersamaan.
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        message: "Email tersebut sudah terdaftar. Silakan masuk.",
        fieldErrors: { email: "Email sudah terdaftar" },
      };
    }

    console.error("[registerUser] gagal membuat akun:", error);
    return {
      ok: false,
      message: "Terjadi kesalahan pada server. Coba lagi beberapa saat lagi.",
    };
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
