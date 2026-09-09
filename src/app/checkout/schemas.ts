import { z } from "zod";

/**
 * Skema & tipe checkout.
 *
 * Dipakai dua sisi: react-hook-form di `checkout-form.tsx` dan Server Action
 * `createOrderAndPay()`. File terpisah dari `actions.ts` karena berkas
 * `'use server'` hanya boleh mengekspor fungsi async.
 */

export const CUSTOMER_TYPES = ["MAHASISWA", "ALUMNI"] as const;
export type CustomerTypeValue = (typeof CUSTOMER_TYPES)[number];

export const FULFILLMENT_TYPES = ["PICKUP", "SHIPPED"] as const;
export type FulfillmentTypeValue = (typeof FULFILLMENT_TYPES)[number];

/**
 * Data pemesan.
 *
 * - `customerBatch` (angkatan) & `customerProgram` (jurusan) dipilih dari
 *   dropdown master. Keanggotaan terhadap master dicek ulang di server karena
 *   isi dropdown di klien tidak bisa dipercaya.
 * - `fulfillmentType` SHIPPED mewajibkan `shippingAddress`. Ongkirnya dibayar
 *   MANUAL via WhatsApp admin sehingga tidak ada field kurir/ongkir di sini.
 */
export const checkoutFormSchema = z.object({
  customerName: z
    .string({ error: "Nama wajib diisi" })
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(80, "Nama maksimal 80 karakter"),
  customerEmail: z
    .string({ error: "Email wajib diisi" })
    .trim()
    .min(1, "Email wajib diisi")
    .pipe(z.email("Format email tidak valid")),
  customerPhone: z
    .string({ error: "Nomor WhatsApp wajib diisi" })
    .trim()
    .min(8, "Nomor WhatsApp minimal 8 digit")
    .max(20, "Nomor WhatsApp maksimal 20 digit")
    .regex(/^[0-9+\-\s()]+$/, "Nomor WhatsApp hanya boleh berisi angka"),
  customerType: z.enum(CUSTOMER_TYPES, { error: "Pilih Mahasiswa atau Alumni" }),
  customerBatch: z
    .string({ error: "Angkatan wajib dipilih" })
    .trim()
    .min(1, "Angkatan wajib dipilih")
    .max(30, "Angkatan maksimal 30 karakter"),
  customerProgram: z
    .string({ error: "Jurusan wajib dipilih" })
    .trim()
    .min(1, "Jurusan wajib dipilih")
    .max(100, "Jurusan maksimal 100 karakter"),
  fulfillmentType: z.enum(FULFILLMENT_TYPES, {
    error: "Pilih cara terima barang",
  }),
  shippingAddress: z
    .string()
    .trim()
    .max(500, "Alamat maksimal 500 karakter")
    .optional(),
  note: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional(),
  termsAccepted: z
    .boolean()
    .refine((value) => value, "Kamu wajib menyetujui syarat dan ketentuan transaksi"),
});

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;
export type CheckoutFieldName = keyof CheckoutFormValues;

/**
 * Baris pesanan yang dikirim klien.
 *
 * `variantQuotaId` hanya menunjuk baris kuota yang dipilih; server tetap
 * memeriksa bahwa baris itu milik varian & produk yang benar dan periodenya
 * masih terbuka. Harga TIDAK PERNAH diambil dari klien — server menghitung
 * `effectivePrice` sendiri dari database.
 */
export const checkoutItemSchema = z.object({
  productId: z.string().trim().min(1).max(64),
  variantId: z.string().trim().min(1).max(64),
  variantQuotaId: z.string().trim().min(1).max(64),
  quantity: z.number().int().min(1, "Jumlah minimal 1").max(9999, "Jumlah maksimal 9999"),
});

export const checkoutSchema = checkoutFormSchema
  .extend({
    items: z
      .array(checkoutItemSchema)
      .min(1, "Keranjang kosong")
      .max(50, "Maksimal 50 jenis item per pesanan"),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillmentType === "SHIPPED" && !data.shippingAddress?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["shippingAddress"],
        message: "Alamat pengiriman wajib diisi untuk opsi kirim",
      });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export type CheckoutErrorCode =
  /** Belum masuk / sesi kedaluwarsa. */
  | "UNAUTHENTICATED"
  /** Data form tidak lolos validasi. */
  | "VALIDATION"
  /** Keranjang kosong atau seluruh itemnya tidak bisa dipesan. */
  | "EMPTY_CART"
  /** Sisa kuota berubah — pengguna harus memeriksa keranjang lagi. */
  | "AVAILABILITY"
  /** Gagal membuat tagihan di Duitku (pesanan sudah dibatalkan kembali). */
  | "PAYMENT"
  /** Kesalahan tak terduga. */
  | "SERVER";

export type CheckoutResult =
  | {
      ok: true;
      orderNumber: string;
      flow: "DUITKU";
      paymentUrl: string;
    }
  | {
      ok: false;
      code: CheckoutErrorCode;
      message: string;
      fieldErrors?: Partial<Record<CheckoutFieldName, string>>;
      /** Peringatan per item, ditampilkan di ringkasan pesanan. */
      itemMessages?: string[];
    };
