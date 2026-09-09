import { z } from "zod";

/**
 * Skema kategori produk — dipakai react-hook-form dan Server Action.
 * `sortOrder` disimpan sebagai string agar cocok dengan nilai `<input>`.
 */
export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama kategori minimal 2 karakter")
    .max(80, "Nama kategori maksimal 80 karakter"),

  slug: z
    .string()
    .trim()
    .min(2, "Slug minimal 2 karakter")
    .max(90, "Slug maksimal 90 karakter")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug hanya boleh huruf kecil, angka, dan tanda hubung",
    ),

  description: z.string().trim().max(500, "Deskripsi maksimal 500 karakter"),

  imageUrl: z
    .string()
    .trim()
    .max(500, "URL gambar maksimal 500 karakter")
    .refine(
      (value) => value === "" || /^https?:\/\/.+/i.test(value) || value.startsWith("/"),
      "URL gambar harus diawali http://, https://, atau /",
    ),

  sortOrder: z
    .string()
    .trim()
    .regex(/^\d*$/, "Urutan hanya boleh berisi angka")
    .refine((value) => value === "" || Number(value) <= 9999, "Urutan maksimal 9999"),

  isActive: z.boolean(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export function emptyCategoryFormValues(sortOrder = 0): CategoryFormValues {
  return {
    name: "",
    slug: "",
    description: "",
    imageUrl: "",
    sortOrder: String(sortOrder),
    isActive: true,
  };
}
