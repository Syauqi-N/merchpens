import bcrypt from "bcryptjs";

import type { PrismaClient } from "../src/generated/prisma/client";

export const DEMO_ADMIN_EMAIL = "admin@merch.local";
export const DEMO_ADMIN_PASSWORD = "admin123";
const MIN_PASSWORD_LENGTH = 8;

export type AdminCredentials = {
  email: string;
  password: string;
  usingDemoPassword: boolean;
};

/** Kesalahan konfigurasi yang boleh dicetak tanpa stack trace panjang. */
export class SeedConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedConfigError";
  }
}

/**
 * Menentukan kredensial admin dari environment dan mencegah password demo
 * terpasang ketika NODE_ENV=production.
 */
export function resolveAdminCredentials(): AdminCredentials {
  const isProduction = process.env.NODE_ENV === "production";
  const email = process.env.SEED_ADMIN_EMAIL?.trim() || DEMO_ADMIN_EMAIL;
  const configuredPassword = process.env.SEED_ADMIN_PASSWORD?.trim() ?? "";

  if (isProduction) {
    if (!configuredPassword) {
      throw new SeedConfigError(
        [
          "",
          "PEMBUATAN ADMIN DIBATALKAN: SEED_ADMIN_PASSWORD belum diisi.",
          "",
          "Isi variabel berikut di .env production:",
          "  SEED_ADMIN_EMAIL=admin@domain-kamu.com",
          "  SEED_ADMIN_PASSWORD=<password kuat, minimal 8 karakter>",
          "",
          "Buat password acak dengan: openssl rand -base64 18",
          "",
        ].join("\n"),
      );
    }
    if (configuredPassword === DEMO_ADMIN_PASSWORD) {
      throw new SeedConfigError(
        `PEMBUATAN ADMIN DIBATALKAN: password demo "${DEMO_ADMIN_PASSWORD}" tidak boleh dipakai di production.`,
      );
    }
    if (configuredPassword.length < MIN_PASSWORD_LENGTH) {
      throw new SeedConfigError(
        `PEMBUATAN ADMIN DIBATALKAN: password minimal ${MIN_PASSWORD_LENGTH} karakter.`,
      );
    }
  }

  const usingDemoPassword = configuredPassword.length === 0;
  return {
    email,
    password: usingDemoPassword ? DEMO_ADMIN_PASSWORD : configuredPassword,
    usingDemoPassword,
  };
}

export async function upsertPengurus(
  prisma: Pick<PrismaClient, "user">,
  credentials: AdminCredentials,
) {
  const passwordHash = await bcrypt.hash(credentials.password, 10);

  return prisma.user.upsert({
    where: { email: credentials.email },
    update: {
      role: "PENGURUS",
      isActive: true,
      passwordHash,
    },
    create: {
      email: credentials.email,
      name: "Pengurus",
      role: "PENGURUS",
      isActive: true,
      passwordHash,
      phone: "081200000000",
    },
    select: { id: true, email: true },
  });
}

export function warnAboutDemoCredentials(credentials: AdminCredentials) {
  if (!credentials.usingDemoPassword) return;

  console.warn("");
  console.warn("  ========================================================================");
  console.warn("  PERINGATAN: memakai KREDENSIAL ADMIN DEMO bawaan.");
  console.warn(`    Email    : ${credentials.email}`);
  console.warn(`    Password : ${DEMO_ADMIN_PASSWORD}`);
  console.warn("  JANGAN PERNAH dipakai di server production.");
  console.warn("  ========================================================================");
  console.warn("");
}
