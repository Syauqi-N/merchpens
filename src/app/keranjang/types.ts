/**
 * Tipe bersama untuk validasi ulang keranjang.
 *
 * File terpisah dari `actions.ts` karena berkas `'use server'` sebaiknya hanya
 * mengekspor fungsi async — tipe di sini dipakai klien maupun server.
 */

/** Baris keranjang yang dikirim klien untuk diperiksa ulang. */
export type CartLineInput = {
  productId: string;
  variantId: string;
  /** Baris kuota VARIAN yang dipilih saat varian dimasukkan ke keranjang. */
  variantQuotaId: string | null;
  quantity: number;
  /** Harga satuan yang tersimpan di keranjang klien (untuk deteksi perubahan harga). */
  unitPrice: number;
};

/**
 * Data varian terbaru dari server. Bentuknya sengaja sama persis dengan
 * `CartItemInput` di `@/store/cart` supaya bisa langsung dipakai menimpa
 * baris keranjang.
 */
export type FreshCartItem = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  variantId: string;
  variantName: string;
  /** Selalu `effectivePrice` varian, bukan `product.price`. */
  unitPrice: number;
  /** Baris kuota VARIAN periode PO yang dipakai. */
  variantQuotaId: string | null;
  preOrderItemId: string | null;
  pickupPeriod: {
    id: string;
    name: string;
    endAt: string;
    estimatedPickupAt: string;
    pickupLocation: string;
    pickupSchedule: string;
    pickupNote: string;
    shippingNote: string;
  } | null;
  /** Sisa kuota varian saat diperiksa. */
  maxQty: number;
  unit: string;
};

export type CartLineIssue =
  /** Produk/varian sudah tidak ada di katalog → keluarkan dari keranjang. */
  | "REMOVED"
  /** Varian ada tapi tidak bisa dipesan (kuota habis / periode PO tutup). */
  | "UNAVAILABLE"
  /** Jumlah dipangkas mengikuti sisa kuota. */
  | "QUANTITY_REDUCED"
  /** Harga berubah sejak dimasukkan ke keranjang. */
  | "PRICE_CHANGED";

export type CartLineCheck = {
  productId: string;
  variantId: string;
  variantQuotaId: string | null;
  name: string;
  issues: CartLineIssue[];
  /** Pesan siap tampil (Bahasa Indonesia) untuk setiap masalah pada baris ini. */
  messages: string[];
  /** Data terbaru; `null` berarti baris harus dikeluarkan dari keranjang. */
  fresh: FreshCartItem | null;
  /** Jumlah maksimum yang boleh dipertahankan pada baris ini (0 = keluarkan). */
  allowedQuantity: number;
};

export type RevalidateCartResult = {
  /** true bila keranjang aman dilanjutkan ke checkout tanpa perubahan. */
  ok: boolean;
  /** ISO timestamp saat pemeriksaan dilakukan. */
  checkedAt: string;
  lines: CartLineCheck[];
  /** Ringkasan seluruh peringatan, siap ditampilkan sebagai daftar. */
  messages: string[];
  /** true bila setelah koreksi keranjang menjadi kosong. */
  emptied: boolean;
};
