/** Format an integer amount of IDR (rupiah) into "Rp1.234.567". */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format a date into Indonesian long date, e.g. "26 Juli 2026". */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Format a date + time, e.g. "26 Jul 2026, 16.30". */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Format a month + year for headings, e.g. "Juli 2026". */
export function formatMonthYear(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Format a plain number with Indonesian thousand separators, e.g. "1.234". */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

/** Slugify a string for URLs. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Label & warna status pesanan — SATU sumber kebenaran untuk seluruh aplikasi
 * (etalase maupun panel admin) supaya keluarga warna tiap status tidak lagi
 * berbeda antar halaman.
 */

/** Human label for each order status (Indonesian). */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Menunggu Pembayaran",
  PAID: "Dibayar",
  PROCESSING: "Diproses",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  EXPIRED: "Kadaluarsa",
};

/** Warna pekat untuk lencana status di etalase (varian `storefront`). */
export const ORDER_STATUS_CLASS: Record<string, string> = {
  PENDING_PAYMENT: "bg-gold/15 text-gold-light",
  PAID: "bg-gold/15 text-gold-light",
  PROCESSING: "bg-indigo-500/15 text-indigo-200",
  COMPLETED: "bg-emerald-500/15 text-emerald-200",
  CANCELLED: "bg-[#2A2A2A] text-[#D8D3C7]",
  EXPIRED: "bg-rose-500/15 text-rose-200",
};

/** Warna lembut + ring untuk lencana status di panel admin (varian `admin`). */
export const ORDER_STATUS_BADGE: Record<string, string> = {
  PENDING_PAYMENT: "bg-gold/10 text-gold-light ring-gold/30",
  PAID: "bg-gold/10 text-gold ring-gold/30",
  PROCESSING: "bg-indigo-500/10 text-indigo-300 ring-indigo-200",
  COMPLETED: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  CANCELLED: "bg-raise text-cream-muted ring-white/10",
  EXPIRED: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
};

/** Label pembayaran (PaymentStatus) dalam Bahasa Indonesia. */
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu Pembayaran",
  PAID: "Lunas",
  FAILED: "Gagal",
  EXPIRED: "Kadaluarsa",
};
