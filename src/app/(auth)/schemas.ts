import { z } from "zod";

/**
 * Skema validasi form autentikasi.
 *
 * Dipakai dua sisi: react-hook-form (klien) dan Server Action (server).
 * File ini sengaja terpisah dari `actions.ts` karena berkas `'use server'`
 * hanya boleh mengekspor fungsi async.
 */

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi")
    .pipe(z.email("Format email tidak valid")),
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Nama minimal 2 karakter")
      .max(80, "Nama maksimal 80 karakter"),
    email: z
      .string()
      .trim()
      .min(1, "Email wajib diisi")
      .pipe(z.email("Format email tidak valid")),
    phone: z
      .string()
      .trim()
      .min(8, "Nomor telepon minimal 8 digit")
      .max(20, "Nomor telepon maksimal 20 digit")
      .regex(/^[0-9+\-\s()]+$/, "Nomor telepon hanya boleh berisi angka"),
    password: z
      .string()
      .min(8, "Kata sandi minimal 8 karakter")
      .max(72, "Kata sandi maksimal 72 karakter"),
    confirmPassword: z.string().min(1, "Konfirmasi kata sandi wajib diisi"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Konfirmasi kata sandi tidak cocok",
    path: ["confirmPassword"],
  });

export type RegisterValues = z.infer<typeof registerSchema>;

export type RegisterFieldName = keyof RegisterValues;
