import { z } from "zod";

import type { OrderStatus, PaymentStatus } from "@/generated/prisma/client";

/**
 * Skema, konstanta, dan label untuk panel admin pesanan.
 *
 * File ini SENGAJA tidak memakai `"use server"` maupun `"use client"`: isinya
 * dipakai bersama oleh Server Action (`./actions.ts`), Server Component
 * (halaman daftar & detail), dan Client Component (panel aksi). Berkas
 * `"use server"` hanya boleh mengekspor fungsi async, jadi seluruh nilai
 * non-fungsi tinggal di sini.
 */

/** Bentuk balikan seragam untuk seluruh Server Action di modul ini. */
export type ActionResult = { ok: boolean; message: string };

export const PAGE_SIZE = 20;

/** Batas panjang kata kunci pencarian pesanan. */
export const MAX_SEARCH_LENGTH = 120;

// --------------------------------------------------------------- status order

export const orderStatusSchema = z.enum([
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
]);

export const ORDER_STATUS_VALUES = orderStatusSchema.options;

/** Cara terima barang (fulfillment) untuk filter daftar pesanan. */
export const fulfillmentTypeSchema = z.enum(["PICKUP", "SHIPPED"]);

export const FULFILLMENT_TYPE_VALUES = fulfillmentTypeSchema.options;

/**
 * Transisi status yang boleh dipicu admin lewat tombol "ubah status".
 * PROCESSING tidak ada di sini karena ditetapkan otomatis setelah seluruh
 * periode PO terkait ditutup.
 *
 * Kuncinya adalah status TUJUAN, nilainya daftar status ASAL yang sah. Dipakai
 * langsung sebagai `where.status.in` pada UPDATE bersyarat sehingga pengecekan
 * dan penulisan terjadi dalam satu pernyataan SQL — pesanan yang statusnya
 * berubah oleh webhook di detik yang sama tidak akan ikut termodifikasi.
 *
 * Perhatikan tidak ada jalan mundur: COMPLETED/CANCELLED/EXPIRED bersifat
 * final, dan tidak ada satu pun tujuan yang mengizinkan kembali ke
 * PENDING_PAYMENT.
 */
export const MANUAL_STATUS_SOURCES = {
  COMPLETED: ["PROCESSING"],
} as const satisfies Record<string, readonly OrderStatus[]>;

/** Status tujuan yang boleh dipilih lewat `updateOrderStatus`. */
export const manualStatusSchema = z.enum(["COMPLETED"]);
export type ManualStatus = z.infer<typeof manualStatusSchema>;

/**
 * Pesanan hanya bisa dibatalkan selama belum mencapai status final.
 *
 * Pembatalan pesanan yang sudah lunas pun cukup satu jalur: kuota PO yang
 * dipegangnya dilepas kembali (lihat `cancelOrder`). Tidak ada daftar status
 * "sudah di-commit" karena tidak ada langkah commit — kuota memang terpakai
 * sejak checkout.
 */
export const CANCELLABLE_FROM = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
] as const satisfies readonly OrderStatus[];

// ------------------------------------------------------------ skema tiap aksi

/**
 * Kata kunci pencarian daftar pesanan.
 *
 * Dipangkas spasinya dan dibatasi panjangnya supaya URL yang diketik sembarangan
 * tidak berubah jadi pola `contains` raksasa. Nilainya tetap dipakai lewat
 * argumen Prisma (parameterized), bukan dirakit ke dalam SQL.
 */
export const orderSearchSchema = z
  .string()
  .trim()
  .transform((value) => value.slice(0, MAX_SEARCH_LENGTH));

export const orderIdSchema = z.object({
  orderId: z.string().min(1, "ID pesanan tidak valid"),
});

export const markPaidManuallySchema = z.object({
  orderId: z.string().min(1, "ID pesanan tidak valid"),
  note: z
    .string()
    .trim()
    .max(500, "Catatan maksimal 500 karakter")
    .optional()
    .default(""),
});

export const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1, "ID pesanan tidak valid"),
  status: manualStatusSchema,
});

// ----------------------------------------------------------------- label & UI

/**
 * Label status pesanan/pembayaran dan warna lencananya tinggal di
 * `@/lib/format` — dipakai bersama etalase, jadi tidak diduplikasi di sini.
 */
export const PAYMENT_STATUS_BADGE: Record<PaymentStatus, string> = {
  PENDING: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  PAID: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  FAILED: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
  EXPIRED: "bg-raise text-cream-muted ring-white/10",
};

/**
 * Kode metode pembayaran Duitku → nama yang dikenal pelanggan.
 * Kode yang tidak ada di daftar ditampilkan apa adanya (lihat
 * `formatPaymentMethod`), jadi daftar ini tidak perlu lengkap.
 */
export const DUITKU_METHOD_LABEL: Record<string, string> = {
  MANUAL: "Konfirmasi Manual Admin",
  VC: "Kartu Kredit",
  BC: "Virtual Account BCA",
  M2: "Virtual Account Mandiri",
  I1: "Virtual Account BNI",
  B1: "Virtual Account CIMB Niaga",
  BT: "Virtual Account Permata",
  A1: "Virtual Account ATM Bersama",
  VA: "Virtual Account Maybank",
  BR: "Virtual Account BRI",
  BV: "Virtual Account BSI",
  NC: "Virtual Account Nobu",
  DM: "Virtual Account Danamon",
  BK: "BCA KlikPay",
  IR: "Indomaret",
  FT: "Gerai Ritel",
  OV: "OVO",
  DA: "DANA",
  SP: "ShopeePay",
  SA: "ShopeePay Apps",
  LA: "LinkAja",
  LF: "LinkAja",
  JP: "Jenius Pay",
  NQ: "QRIS Nobu",
  SL: "ShopeePay",
  OL: "OVO",
  DN: "Indodana Paylater",
  AT: "Atome",
};

/** Nama metode pembayaran siap tampil; kode asing dibiarkan apa adanya. */
export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "Belum dipilih";
  return DUITKU_METHOD_LABEL[method] ?? method;
}
