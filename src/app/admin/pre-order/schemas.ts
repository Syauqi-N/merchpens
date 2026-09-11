import { z } from "zod";

import type { PreOrderStatus } from "@/generated/prisma/client";

/**
 * Skema & label untuk pengelolaan periode pre-order.
 *
 * Sengaja tanpa `"use server"`/`"use client"` supaya bisa dipakai bersama oleh
 * Server Action, halaman server, dan form klien — berkas `"use server"` hanya
 * boleh mengekspor fungsi async.
 *
 * Model kuota: PreOrderItem hanya menyimpan override harga level produk.
 * Kuota & harga per varian tinggal di PreOrderVariantQuota.
 */

export type ActionResult = { ok: boolean; message: string };

export const PREORDER_STATUS_LABEL: Record<PreOrderStatus, string> = {
  DRAFT: "Draf",
  ACTIVE: "Aktif",
  CLOSED: "Ditutup",
};

export const PREORDER_STATUS_HINT: Record<PreOrderStatus, string> = {
  DRAFT: "Belum tampil ke pelanggan. Pakai selagi menyiapkan daftar produk & kuota.",
  ACTIVE: "Terbuka untuk pemesanan selama waktu sekarang berada di rentang mulai–berakhir.",
  CLOSED: "Ditutup permanen. Tidak menerima pesanan meski tanggalnya belum lewat.",
};

export const PREORDER_STATUS_BADGE: Record<PreOrderStatus, string> = {
  DRAFT: "bg-raise text-cream-muted ring-white/10",
  ACTIVE: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  CLOSED: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
};

// -------------------------------------------------------------- field dasar

/**
 * Nilai picker lokal ("2026-08-01T09:00") diurai sebagai waktu LOKAL.
 * Format date-time tanpa offset mengikuti zona waktu server, jadi server
 * sebaiknya dijalankan pada zona waktu toko (Asia/Jakarta).
 */
const localDateTime = z
  .string()
  .min(1, "Tanggal wajib diisi")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    error: "Format tanggal tidak valid",
  })
  .transform((value) => new Date(value));

const slugField = z
  .string()
  .trim()
  .min(3, "Slug minimal 3 karakter")
  .max(120, "Slug maksimal 120 karakter")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug hanya boleh huruf kecil, angka, dan tanda hubung",
  );

const quotaField = z.coerce
  .number()
  .int("Kuota harus bilangan bulat")
  .min(0, "Kuota tidak boleh negatif")
  .max(1_000_000, "Kuota terlalu besar");

/** Harga khusus PO; kosong berarti memakai harga berjenjang (varian → produk → normal). */
const optionalPriceField = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.coerce
    .number()
    .int("Harga harus bilangan bulat")
    .min(0, "Harga tidak boleh negatif")
    .max(1_000_000_000, "Harga terlalu besar")
    .nullable(),
);

// ------------------------------------------------------------ periode PO

export const periodFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Nama periode minimal 3 karakter")
      .max(120, "Nama periode maksimal 120 karakter"),
    slug: slugField,
    description: z
      .string()
      .trim()
      .max(2000, "Deskripsi maksimal 2000 karakter")
      .optional()
      .default(""),
    startAt: localDateTime,
    endAt: localDateTime,
    estimatedPickupAt: localDateTime,
    pickupLocation: z
      .string()
      .trim()
      .min(3, "Lokasi pengambilan minimal 3 karakter")
      .max(200, "Lokasi pengambilan maksimal 200 karakter"),
    pickupSchedule: z
      .string()
      .trim()
      .min(3, "Jadwal pengambilan minimal 3 karakter")
      .max(200, "Jadwal pengambilan maksimal 200 karakter"),
    pickupNote: z
      .string()
      .trim()
      .max(500, "Catatan pengambilan maksimal 500 karakter")
      .optional()
      .default(""),
    shippingNote: z
      .string()
      .trim()
      .max(500, "Catatan pengiriman maksimal 500 karakter")
      .optional()
      .default(""),
    whatsappGroupUrl: z
      .string()
      .trim()
      .max(200, "Tautan grup WhatsApp maksimal 200 karakter")
      .optional()
      .default("")
      .refine(
        (value) =>
          !value ||
          value.startsWith("https://chat.whatsapp.com/") ||
          value.startsWith("https://wa.me/"),
        "Tautan grup WhatsApp harus diawali https://chat.whatsapp.com/ atau https://wa.me/",
      ),
    status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]),
  })
  .refine((data) => data.endAt > data.startAt, {
    error: "Tanggal berakhir harus setelah tanggal mulai",
    path: ["endAt"],
  })
  .refine((data) => data.estimatedPickupAt > data.endAt, {
    error: "Estimasi pengambilan harus setelah periode berakhir",
    path: ["estimatedPickupAt"],
  });

export type PeriodFormInput = z.input<typeof periodFormSchema>;
export type PeriodFieldName = keyof PeriodFormInput;

export const createPeriodSchema = periodFormSchema;

export const updatePeriodSchema = z.object({
  periodId: z.string().min(1, "ID periode tidak valid"),
  values: periodFormSchema,
});

export const periodIdSchema = z.object({
  periodId: z.string().min(1, "ID periode tidak valid"),
});

export type PeriodResult =
  | { ok: true; message: string; periodId: string }
  | { ok: false; message: string; fieldErrors?: Partial<Record<PeriodFieldName, string>> };

// ------------------------------------------------- produk dalam periode

export const addProductToPeriodSchema = z.object({
  periodId: z.string().min(1, "ID periode tidak valid"),
  productId: z.string().min(1, "Pilih produk terlebih dahulu"),
  price: optionalPriceField,
});

export const updatePreOrderItemPriceSchema = z.object({
  itemId: z.string().min(1, "ID produk periode tidak valid"),
  price: optionalPriceField,
});

export const preOrderItemIdSchema = z.object({
  itemId: z.string().min(1, "ID produk periode tidak valid"),
});

// ------------------------------------------------- kuota per varian

export const addVariantQuotaSchema = z.object({
  preOrderItemId: z.string().min(1, "ID produk periode tidak valid"),
  variantId: z.string().min(1, "Pilih varian terlebih dahulu"),
  quota: quotaField,
  price: optionalPriceField,
});

export const updateVariantQuotaSchema = z.object({
  quotaId: z.string().min(1, "ID kuota tidak valid"),
  quota: quotaField,
  price: optionalPriceField,
});

export const variantQuotaIdSchema = z.object({
  quotaId: z.string().min(1, "ID kuota tidak valid"),
});

// ------------------------------------------------------------------ utilitas

/**
 * `Date` → nilai picker tanggal-waktu dalam waktu lokal. `toISOString()` tidak
 * dipakai karena selalu menghasilkan UTC, sehingga jam di form akan bergeser.
 */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Mengubah error zod menjadi peta field → pesan pertama. */
export function toFieldErrors<T extends string>(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Partial<Record<T, string>> {
  const fieldErrors: Partial<Record<T, string>> = {};

  for (const issue of issues) {
    // `updatePeriodSchema` membungkus form di dalam `values`, jadi segmen
    // pertama yang berupa string dan bukan pembungkus itulah nama fieldnya.
    const key = issue.path.find(
      (segment) => typeof segment === "string" && segment !== "values",
    );
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key as T] = issue.message;
    }
  }

  return fieldErrors;
}
