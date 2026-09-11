import { z } from "zod";

/**
 * Skema pengelolaan beranda: banner (carousel/hero) dan pengaturan toko
 * (tabel `Setting` yang berisi nama toko, kontak, teks hero, informasi
 * pengambilan barang, dan sosmed).
 */

const optionalUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(500, `${label} maksimal 500 karakter`)
    .refine(
      (value) => value === "" || /^https?:\/\/.+/i.test(value) || value.startsWith("/"),
      `${label} harus diawali http://, https://, atau /`,
    );

export const bannerFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Judul banner minimal 3 karakter")
    .max(120, "Judul banner maksimal 120 karakter"),

  subtitle: z.string().trim().max(200, "Subjudul maksimal 200 karakter"),

  imageUrl: z
    .string()
    .trim()
    .min(1, "URL gambar wajib diisi")
    .max(500, "URL gambar maksimal 500 karakter")
    .refine(
      (value) => /^https?:\/\/.+/i.test(value) || value.startsWith("/"),
      "URL gambar harus diawali http://, https://, atau /",
    ),

  linkUrl: optionalUrl("Tautan"),

  sortOrder: z
    .string()
    .trim()
    .regex(/^\d*$/, "Urutan hanya boleh berisi angka")
    .refine((value) => value === "" || Number(value) <= 9999, "Urutan maksimal 9999"),

  isActive: z.boolean(),
});

export type BannerFormValues = z.infer<typeof bannerFormSchema>;

export function emptyBannerFormValues(sortOrder = 0): BannerFormValues {
  return {
    title: "",
    subtitle: "",
    imageUrl: "",
    linkUrl: "",
    sortOrder: String(sortOrder),
    isActive: true,
  };
}

// ---------- Pengaturan toko (tabel Setting) ----------

export const storeSettingsSchema = z.object({
  store_name: z
    .string()
    .trim()
    .min(2, "Nama toko minimal 2 karakter")
    .max(80, "Nama toko maksimal 80 karakter"),

  store_tagline: z.string().trim().max(150, "Tagline maksimal 150 karakter"),

  store_email: z
    .string()
    .trim()
    .max(120, "Email maksimal 120 karakter")
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Format email tidak valid",
    ),

  store_phone: z
    .string()
    .trim()
    .max(30, "Nomor telepon maksimal 30 karakter")
    .refine(
      (value) => value === "" || /^[0-9+\-\s()]+$/.test(value),
      "Nomor telepon hanya boleh berisi angka dan tanda + - ( )",
    ),

  store_address: z.string().trim().max(300, "Alamat maksimal 300 karakter"),

  store_about: z.string().trim().max(1000, "Tentang toko maksimal 1000 karakter"),

  hero_heading: z.string().trim().max(150, "Judul hero maksimal 150 karakter"),

  hero_subheading: z.string().trim().max(300, "Subjudul hero maksimal 300 karakter"),

  pickup_lead_days: z
    .string()
    .trim()
    .regex(/^\d+$/, "Jeda pengambilan harus berupa angka")
    .refine(
      (value) => Number(value) >= 1 && Number(value) <= 365,
      "Jeda pengambilan harus antara 1–365 hari",
    ),

  pickup_location: z
    .string()
    .trim()
    .min(3, "Lokasi pengambilan minimal 3 karakter")
    .max(200, "Lokasi pengambilan maksimal 200 karakter"),

  pickup_schedule: z
    .string()
    .trim()
    .min(3, "Jadwal pengambilan minimal 3 karakter")
    .max(200, "Jadwal pengambilan maksimal 200 karakter"),

  pickup_note: z.string().trim().max(500, "Catatan pengambilan maksimal 500 karakter"),

  preorder_info: z
    .string()
    .trim()
    .max(1000, "Informasi pre-order maksimal 1000 karakter"),

  social_instagram: optionalUrl("Tautan Instagram"),
  social_facebook: optionalUrl("Tautan Facebook"),
  social_tiktok: optionalUrl("Tautan TikTok"),

  social_whatsapp: z
    .string()
    .trim()
    .max(30, "Nomor WhatsApp maksimal 30 karakter")
    .refine(
      (value) => value === "" || /^[0-9+\-\s()]+$/.test(value),
      "Nomor WhatsApp hanya boleh berisi angka dan tanda + - ( )",
    ),

  whatsapp_group_url: optionalUrl("Tautan Grup WhatsApp"),

  angkatan_list: masterListText("Angkatan"),
  jurusan_list: masterListText("Jurusan"),
});

/**
 * Satu entri per baris untuk master dropdown checkout (angkatan/jurusan).
 * Disimpan sebagai JSON array di tabel Setting; lihat `masterTextToJson()`.
 */
function masterListText(label: string) {
  return z
    .string()
    .max(2000, `Daftar ${label} maksimal 2000 karakter`)
    .refine(
      (value) => textToMasterList(value).length <= 60,
      `Daftar ${label} maksimal 60 entri`,
    )
    .refine(
      (value) => textToMasterList(value).every((entry) => entry.length <= 100),
      `Tiap baris ${label} maksimal 100 karakter`,
    );
}

/** "2021\n2022" → ["2021","2022"] (unik, tanpa baris kosong). */
export function textToMasterList(text: string): string[] {
  const entries = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return [...new Set(entries)];
}

/** ["2021","2022"] → "2021\n2022" (untuk textarea form). */
export function masterListToText(value: string): string {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .join("\n");
    }
  } catch {
    // bukan JSON — tampilkan apa adanya supaya admin bisa memperbaiki
  }
  return value.trim();
}

/** "2021\n2022" → '["2021","2022"]' (untuk disimpan ke Setting). */
export function masterTextToJson(text: string): string {
  return JSON.stringify(textToMasterList(text));
}

export type StoreSettingsValues = z.infer<typeof storeSettingsSchema>;

export const STORE_SETTING_KEYS = [
  "store_name",
  "store_tagline",
  "store_email",
  "store_phone",
  "store_address",
  "store_about",
  "hero_heading",
  "hero_subheading",
  "pickup_lead_days",
  "pickup_location",
  "pickup_schedule",
  "pickup_note",
  "preorder_info",
  "social_instagram",
  "social_facebook",
  "social_tiktok",
  "social_whatsapp",
  "whatsapp_group_url",
  "angkatan_list",
  "jurusan_list",
] as const satisfies readonly (keyof StoreSettingsValues)[];
