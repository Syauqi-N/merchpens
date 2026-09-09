/**
 * Label ketersediaan pre-order — modul MURNI tanpa impor server.
 *
 * Dipisah dari `@/lib/preorder` (yang mengimpor Prisma) supaya aman dipakai
 * Client Component seperti `VariantPicker`. Jangan tambahkan impor
 * server-only ke berkas ini.
 */

export type UnavailableReason =
  | "INACTIVE" // produk/varian dinonaktifkan pengurus
  | "NO_OPEN_PERIOD" // tidak ada periode PO yang terbuka
  | "NOT_IN_PERIOD" // ada periode terbuka, tapi varian ini tidak diikutkan
  | "PRICE_UNAVAILABLE" // harga belum tersedia
  | "QUOTA_EXHAUSTED"; // kuota sudah habis dipesan

/** Pesan siap-tampil untuk setiap alasan varian tidak bisa dipesan. */
export const UNAVAILABLE_MESSAGE: Record<UnavailableReason, string> = {
  INACTIVE: "Varian tidak tersedia",
  NO_OPEN_PERIOD: "Tidak ada periode pre-order yang dibuka",
  NOT_IN_PERIOD: "Varian ini tidak masuk periode yang sedang dibuka",
  PRICE_UNAVAILABLE: "Harga belum tersedia",
  QUOTA_EXHAUSTED: "Kuota pre-order habis",
};

/** Versi ringkas untuk lencana/tombol yang ruangnya sempit. */
const SHORT_UNAVAILABLE_MESSAGE: Record<UnavailableReason, string> = {
  INACTIVE: "Tidak Tersedia",
  NO_OPEN_PERIOD: "PO Belum Dibuka",
  NOT_IN_PERIOD: "Tidak Masuk PO Ini",
  PRICE_UNAVAILABLE: "Harga Belum Ada",
  QUOTA_EXHAUSTED: "Kuota Habis",
};

/**
 * Label siap-tampil untuk varian yang tidak bisa dipesan.
 *
 * Satu-satunya tempat idiom "reason ? pesan : fallback" ditulis, supaya tidak
 * ada lagi varian teks yang berbeda-beda antar halaman.
 */
export function unavailableLabel(
  reason: UnavailableReason | null | undefined,
  options: { short?: boolean } = {},
): string {
  const messages = options.short ? SHORT_UNAVAILABLE_MESSAGE : UNAVAILABLE_MESSAGE;
  return messages[reason ?? "INACTIVE"];
}
