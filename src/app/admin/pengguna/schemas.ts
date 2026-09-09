import { z } from "zod";

import { ASSIGNABLE_ROLES } from "@/lib/permissions";

/**
 * Skema halaman Kelola Pengguna — dipakai dua sisi: react-hook-form di browser
 * dan Server Action di server. File ini terpisah dari `actions.ts` karena
 * berkas `'use server'` hanya boleh mengekspor fungsi async.
 */

/** Jumlah baris per halaman daftar pengguna. */
export const PAGE_SIZE = 20;

/**
 * Peran yang boleh diberikan lewat panel ini.
 *
 * Sumbernya `ASSIGNABLE_ROLES` di `lib/permissions.ts`, BUKAN daftar yang
 * ditulis ulang di sini. Kalau suatu saat ada peran baru, satu tabel itu yang
 * diubah — tidak ada risiko daftar di sini tertinggal dan menerima peran yang
 * tidak pernah dimaksudkan.
 */
export const assignableRoleSchema = z.enum(ASSIGNABLE_ROLES, "Peran tidak dikenal");

/**
 * Aturan kata sandi.
 *
 * Batas atas 72 karakter bukan gaya-gayaan: bcrypt hanya memperhitungkan 72
 * byte pertama, jadi kata sandi yang lebih panjang akan diam-diam terpotong dan
 * membuat pengurus mengira sandinya lebih kuat daripada kenyataannya.
 */
const passwordSchema = z
  .string()
  .min(8, "Kata sandi minimal 8 karakter")
  .max(72, "Kata sandi maksimal 72 karakter");

const userIdSchema = z.string().trim().min(1, "Pengguna tidak dikenal");

/** Form "Tambah Pengurus". */
export const createStaffSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(80, "Nama maksimal 80 karakter"),

  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi")
    .max(120, "Email maksimal 120 karakter")
    .pipe(z.email("Format email tidak valid")),

  phone: z
    .string()
    .trim()
    .max(20, "Nomor telepon maksimal 20 digit")
    .refine(
      (value) => value === "" || (value.length >= 8 && /^[0-9+\-\s()]+$/.test(value)),
      "Nomor telepon minimal 8 digit dan hanya boleh berisi angka",
    ),

  password: passwordSchema,

  role: assignableRoleSchema,
});

export type CreateStaffValues = z.infer<typeof createStaffSchema>;

export function emptyCreateStaffValues(): CreateStaffValues {
  return {
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "PENGURUS",
  };
}

/** Argumen `updateUserRole`. */
export const updateUserRoleSchema = z.object({
  userId: userIdSchema,
  role: assignableRoleSchema,
});

/** Argumen `setUserActive`. */
export const setUserActiveSchema = z.object({
  userId: userIdSchema,
  isActive: z.boolean(),
});

/** Argumen `resetUserPassword`. */
export const resetUserPasswordSchema = z.object({
  userId: userIdSchema,
  password: passwordSchema,
});

/** Form dialog "Reset Password" (userId-nya ikut dari props baris, bukan input). */
export const resetPasswordFormSchema = z.object({ password: passwordSchema });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

/** Form dialog "Ubah Peran". */
export const changeRoleFormSchema = z.object({ role: assignableRoleSchema });

export type ChangeRoleFormValues = z.infer<typeof changeRoleFormSchema>;

/** Nilai `?status=` yang dikenal pada daftar pengguna. */
export const userStatusFilterSchema = z.enum(["aktif", "nonaktif"]);
