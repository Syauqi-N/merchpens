import { z } from "zod";

/**
 * Skema validasi form produk.
 *
 * Dipakai DUA sisi: react-hook-form di browser dan Server Action di server.
 * Server Action bisa dipanggil langsung lewat POST, jadi validasi di sini
 * adalah satu-satunya yang benar-benar mengikat.
 *
 * Seluruh field angka disimpan sebagai STRING di form (persis seperti nilai
 * `<input>`), lalu dikonversi di action. Ini menghindari `NaN` yang muncul
 * ketika input dikosongkan pada mode `valueAsNumber`.
 *
 * Produk TIDAK punya kolom stok maupun jenis: semuanya dijual lewat periode
 * pre-order berkuota, sehingga ketersediaannya sepenuhnya ditentukan oleh
 * `PreOrderItem` pada periode yang sedang terbuka.
 */

export const UNIT_OPTIONS = ["pcs", "box", "set", "lusin", "pack", "botol", "rol"] as const;

/** Ambang bawaan untuk penanda "kuota hampir habis" di dashboard & daftar produk. */
export const LOW_QUOTA_THRESHOLD = 5;

const digitsOnly = /^\d+$/;

const imageUrlSchema = z
  .string()
  .trim()
  .min(1, "URL gambar wajib diisi")
  .max(500, "URL gambar maksimal 500 karakter")
  .refine(
    (value) => /^https?:\/\/.+/i.test(value) || value.startsWith("/"),
    "URL gambar harus diawali http://, https://, atau /",
  );

export const productImageSchema = z.object({
  url: imageUrlSchema,
  alt: z.string().trim().max(150, "Teks alternatif maksimal 150 karakter"),
  isPrimary: z.boolean(),
});

export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama produk minimal 3 karakter")
    .max(150, "Nama produk maksimal 150 karakter"),

  slug: z
    .string()
    .trim()
    .min(3, "Slug minimal 3 karakter")
    .max(160, "Slug maksimal 160 karakter")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug hanya boleh huruf kecil, angka, dan tanda hubung",
    ),

  description: z.string().trim().max(5000, "Deskripsi maksimal 5000 karakter"),

  price: z
    .string()
    .trim()
    .min(1, "Harga wajib diisi")
    .regex(digitsOnly, "Harga hanya boleh berisi angka (tanpa titik/koma)")
    .refine((value) => Number(value) > 0, "Harga harus lebih dari 0")
    .refine((value) => Number(value) <= 2_000_000_000, "Harga terlalu besar"),

  sku: z
    .string()
    .trim()
    .max(60, "SKU maksimal 60 karakter")
    .refine(
      (value) => value === "" || /^[A-Za-z0-9._/-]+$/.test(value),
      "SKU hanya boleh huruf, angka, titik, garis, dan garis miring",
    ),

  brand: z.string().trim().max(80, "Merek maksimal 80 karakter"),

  unit: z
    .string()
    .trim()
    .min(1, "Satuan wajib diisi")
    .max(20, "Satuan maksimal 20 karakter"),

  categoryIds: z
    .array(z.string().trim().min(1))
    .min(1, "Pilih minimal satu kategori")
    .max(20, "Maksimal 20 kategori per produk")
    .refine(
      (categoryIds) => new Set(categoryIds).size === categoryIds.length,
      "Kategori tidak boleh dipilih lebih dari sekali",
    ),

  isActive: z.boolean(),
  isFeatured: z.boolean(),

  images: z.array(productImageSchema).max(8, "Maksimal 8 gambar per produk"),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
export type ProductImageValues = z.infer<typeof productImageSchema>;

/** Nilai awal form "tambah produk". */
export function emptyProductFormValues(categoryIds: string[] = []): ProductFormValues {
  return {
    name: "",
    slug: "",
    description: "",
    price: "",
    sku: "",
    brand: "",
    unit: "pcs",
    categoryIds,
    isActive: true,
    isFeatured: false,
    images: [],
  };
}

/** Filter daftar produk (dibaca dari `searchParams`). */
export const productFilterSchema = z.object({
  q: z.string().trim().max(100).optional(),
  kategori: z.string().trim().max(60).optional(),
  status: z.enum(["aktif", "nonaktif"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
});

export const PRODUCTS_PER_PAGE = 10;

// ============================================================ varian produk

/**
 * Ukuran yang umum dipakai (PDH S–XXL). Disimpan sebagai teks bebas supaya
 * produk non-pakaian (Tumbler, Lanyard, ...) bisa memakai nilai lain seperti
 * "All Size" — daftar ini hanya saran di form, bukan batasan validasi.
 */
export const SIZE_OPTIONS = ["S", "M", "L", "XL", "XXL", "All Size"] as const;

const variantSkuSchema = z
  .string()
  .trim()
  .max(60, "SKU varian maksimal 60 karakter")
  .refine(
    (value) => value === "" || /^[A-Za-z0-9._/-]+$/.test(value),
    "SKU hanya boleh huruf, angka, titik, garis, dan garis miring",
  );

const variantImageUrlSchema = z
  .string()
  .trim()
  .max(500, "URL foto maksimal 500 karakter")
  .refine(
    (value) => value === "" || /^https?:\/\/.+/i.test(value) || value.startsWith("/"),
    "URL foto harus diawali http://, https://, atau /",
  );

/**
 * Skema form varian — dipakai react-hook-form dan Server Action.
 * `priceDelta` & `sortOrder` disimpan sebagai STRING di form (persis nilai
 * `<input>`) lalu dikonversi di action, mengikuti konvensi `productFormSchema`.
 */
export const variantFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama varian minimal 2 karakter")
    .max(80, "Nama varian maksimal 80 karakter"),

  size: z.string().trim().max(20, "Ukuran maksimal 20 karakter"),

  design: z.string().trim().max(80, "Desain maksimal 80 karakter"),

  sku: variantSkuSchema,

  priceDelta: z
    .string()
    .trim()
    .transform((value) => (value === "" ? "0" : value))
    .refine((value) => /^-?\d+$/.test(value), "Selisih harga hanya boleh berisi angka (boleh diawali tanda -)")
    .refine((value) => Number(value) >= -2_000_000_000, "Selisih harga terlalu kecil")
    .refine((value) => Number(value) <= 2_000_000_000, "Selisih harga terlalu besar"),

  imageUrl: variantImageUrlSchema,

  sortOrder: z
    .string()
    .trim()
    .regex(/^\d*$/, "Urutan hanya boleh berisi angka")
    .refine((value) => value === "" || Number(value) <= 9999, "Urutan maksimal 9999"),

  isActive: z.boolean(),
});

export type VariantFormValues = z.infer<typeof variantFormSchema>;

/** Nilai awal form "tambah varian". */
export function emptyVariantFormValues(sortOrder = 0): VariantFormValues {
  return {
    name: "",
    size: "",
    design: "",
    sku: "",
    priceDelta: "0",
    imageUrl: "",
    sortOrder: String(sortOrder),
    isActive: true,
  };
}
