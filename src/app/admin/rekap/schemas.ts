import { z } from "zod";

import type {
  CustomerType,
  FulfillmentType,
  OrderStatus,
  PaymentStatus,
} from "@/generated/prisma/client";

/**
 * Skema filter, bentuk baris, dan definisi kolom untuk rekap pembeli.
 *
 * Berkas ini SENGAJA netral (tanpa `"use server"` maupun `"use client"`) karena
 * dipakai bertiga: halaman rekap (Server Component), panel filter (Client
 * Component), dan endpoint unduh Excel (Route Handler).
 *
 * Kolom didefinisikan SEKALI di sini lalu dipakai baik oleh tabel di layar
 * maupun oleh lembar Excel. Itu yang membuat berkas unduhan tidak mungkin
 * "ketinggalan kolom" dibanding tampilan — keduanya membaca daftar yang sama.
 */

// ------------------------------------------------------------------- konstanta

/** Batas panjang kata kunci pencarian, supaya URL iseng tidak jadi pola raksasa. */
export const MAX_SEARCH_LENGTH = 120;

/** Batas panjang nilai filter pilihan (angkatan, jurusan, ID periode/produk). */
export const MAX_FILTER_LENGTH = 80;

/**
 * Pesanan yang tidak relevan untuk hari pengambilan: barangnya tidak jadi
 * diambil dan uangnya tidak masuk. Dikecualikan secara BAWAAN, tetapi tetap
 * bisa ditampilkan lewat filter "sertakan dibatalkan & kadaluarsa".
 */
export const STATUS_TIDAK_RELEVAN = [
  "CANCELLED",
  "EXPIRED",
] as const satisfies readonly OrderStatus[];

// ------------------------------------------------------------------------ tab

export const REKAP_TABS = ["pesanan", "item"] as const;
export type RekapTab = (typeof REKAP_TABS)[number];

export const REKAP_TAB_LABEL: Record<RekapTab, string> = {
  pesanan: "Per Pesanan",
  item: "Per Item",
};

export const REKAP_TAB_HINT: Record<RekapTab, string> = {
  pesanan: "Satu baris = satu pesanan. Dipakai bendahara untuk mencocokkan uang masuk.",
  item: "Satu baris = satu produk dalam pesanan. Dipakai panitia saat menyiapkan barang.",
};

// --------------------------------------------------------------------- filter

const orderStatusSchema = z.enum([
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
]);

const paymentStatusSchema = z.enum(["PENDING", "PAID", "FAILED", "EXPIRED"]);

const customerTypeSchema = z.enum(["MAHASISWA", "ALUMNI"]);

const fulfillmentTypeSchema = z.enum(["PICKUP", "SHIPPED"]);

export const ORDER_STATUS_VALUES = orderStatusSchema.options;
export const PAYMENT_STATUS_VALUES = paymentStatusSchema.options;
export const CUSTOMER_TYPE_VALUES = customerTypeSchema.options;
export const FULFILLMENT_TYPE_VALUES = fulfillmentTypeSchema.options;

/** Label tipe pembeli siap tampil di filter, tabel, dan Excel. */
export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  MAHASISWA: "Mahasiswa",
  ALUMNI: "Alumni",
};

/** Label cara terima barang siap tampil di filter, tabel, dan Excel. */
export const FULFILLMENT_TYPE_LABEL: Record<FulfillmentType, string> = {
  PICKUP: "Ambil",
  SHIPPED: "Kirim",
};

/**
 * Filter rekap yang sudah tervalidasi.
 *
 * String kosong berarti "tidak difilter" — bukan `null` — supaya nilainya bisa
 * langsung dipasang ke `value` komponen Select tanpa konversi bolak-balik.
 */
export type RekapFilterState = {
  /** ID periode PO. Kosong = semua periode. */
  periode: string;
  /** ID produk. Kosong = semua produk. */
  produk: string;
  status: OrderStatus | "";
  bayar: PaymentStatus | "";
  /** Tipe pembeli (MAHASISWA/ALUMNI). Kosong = semua. */
  customerType: CustomerType | "";
  /** Cara terima barang (PICKUP/SHIPPED). Kosong = semua. */
  fulfillmentType: FulfillmentType | "";
  /** Angkatan dari master. Kosong = semua. */
  angkatan: string;
  /** Jurusan dari master. Kosong = semua. */
  jurusan: string;
  q: string;
  /** true = pesanan Dibatalkan & Kadaluarsa ikut ditampilkan. */
  sertakanBatal: boolean;
};

export const REKAP_FILTER_KOSONG: RekapFilterState = {
  periode: "",
  produk: "",
  status: "",
  bayar: "",
  customerType: "",
  fulfillmentType: "",
  angkatan: "",
  jurusan: "",
  q: "",
  sertakanBatal: false,
};

/** Pembaca satu nilai query string; mengembalikan "" bila tidak ada. */
export type ParamReader = (key: string) => string | null | undefined;

function clean(value: string | null | undefined, maxLength: number): string {
  return (value ?? "").trim().slice(0, maxLength);
}

/** Baca dengan kunci utama, jatuh ke kunci alias bila kosong (kompatibilitas URL lama). */
function cleanAny(
  read: ParamReader,
  keys: string[],
  maxLength: number,
): string {
  for (const key of keys) {
    const value = clean(read(key), maxLength);
    if (value !== "") return value;
  }
  return "";
}

/**
 * Membaca filter dari query string.
 *
 * Dipakai halaman (lewat `searchParams` yang sudah di-await) MAUPUN endpoint
 * unduh (lewat `URL.searchParams`), sehingga tautan "Unduh Excel" yang membawa
 * query string yang sama dijamin menghasilkan saringan yang sama.
 *
 * Nilai yang tidak dikenal diperlakukan sebagai "tidak difilter": URL yang
 * diketik sembarangan tidak boleh membuat halaman gagal render.
 */
export function parseRekapFilters(read: ParamReader): RekapFilterState {
  const status = orderStatusSchema.safeParse(clean(read("status"), MAX_FILTER_LENGTH));
  const bayar = paymentStatusSchema.safeParse(clean(read("bayar"), MAX_FILTER_LENGTH));
  const customerType = customerTypeSchema.safeParse(
    cleanAny(read, ["tipe", "customerType"], MAX_FILTER_LENGTH),
  );
  const fulfillmentType = fulfillmentTypeSchema.safeParse(
    cleanAny(read, ["terima", "fulfillmentType"], MAX_FILTER_LENGTH),
  );
  const batal = clean(read("batal"), 8);

  return {
    periode: clean(read("periode"), MAX_FILTER_LENGTH),
    produk: clean(read("produk"), MAX_FILTER_LENGTH),
    status: status.success ? status.data : "",
    bayar: bayar.success ? bayar.data : "",
    customerType: customerType.success ? customerType.data : "",
    fulfillmentType: fulfillmentType.success ? fulfillmentType.data : "",
    angkatan: clean(read("angkatan"), MAX_FILTER_LENGTH),
    // `prodi` adalah nama kunci lama; tetap dibaca agar tautan lama tidak rusak.
    jurusan: cleanAny(read, ["jurusan", "prodi"], MAX_FILTER_LENGTH),
    q: clean(read("q"), MAX_SEARCH_LENGTH),
    sertakanBatal: batal === "1" || batal === "true",
  };
}

/** Tab aktif; nilai asing jatuh ke "pesanan". */
export function parseRekapTab(value: string | null | undefined): RekapTab {
  const tab = clean(value, 16);
  return (REKAP_TABS as readonly string[]).includes(tab) ? (tab as RekapTab) : "pesanan";
}

/** Apakah ada satu pun filter yang sedang aktif. */
export function adaFilterAktif(filters: RekapFilterState): boolean {
  return Boolean(
    filters.periode ||
      filters.produk ||
      filters.status ||
      filters.bayar ||
      filters.customerType ||
      filters.fulfillmentType ||
      filters.angkatan ||
      filters.jurusan ||
      filters.q ||
      filters.sertakanBatal,
  );
}

/**
 * Menyusun ulang filter menjadi query string.
 *
 * Tombol "Unduh Excel" memakai fungsi ini juga, jadi berkas yang terunduh
 * persis mengikuti apa yang sedang tersaring di layar.
 */
export function buildRekapQuery(
  filters: RekapFilterState,
  extra: { tab?: RekapTab } = {},
): string {
  const params = new URLSearchParams();

  if (filters.periode) params.set("periode", filters.periode);
  if (filters.produk) params.set("produk", filters.produk);
  if (filters.status) params.set("status", filters.status);
  if (filters.bayar) params.set("bayar", filters.bayar);
  if (filters.customerType) params.set("tipe", filters.customerType);
  if (filters.fulfillmentType) params.set("terima", filters.fulfillmentType);
  if (filters.angkatan) params.set("angkatan", filters.angkatan);
  if (filters.jurusan) params.set("jurusan", filters.jurusan);
  if (filters.q) params.set("q", filters.q);
  if (filters.sertakanBatal) params.set("batal", "1");
  // Tab hanya soal tampilan; endpoint unduh mengabaikannya karena selalu
  // menulis seluruh lembar sekaligus.
  if (extra.tab && extra.tab !== "pesanan") params.set("tab", extra.tab);

  return params.toString();
}

// --------------------------------------------------------------- bentuk baris

/** Satu baris = satu Order. */
export type RekapOrderRow = {
  /** Kunci React & tautan detail; bukan kolom yang ditampilkan. */
  id: string;
  kodePesanan: string;
  tanggal: Date;
  /** Label siap tampil ("Mahasiswa"/"Alumni"). */
  tipe: string | null;
  nama: string;
  angkatan: string | null;
  jurusan: string | null;
  telepon: string;
  email: string;
  /** Label siap tampil ("Ambil"/"Kirim"). */
  terima: string | null;
  jumlahItem: number;
  total: number;
  statusBayar: PaymentStatus | null;
  metode: string | null;
  statusPesanan: OrderStatus;
  catatan: string | null;
};

/** Satu baris = satu OrderItem. */
export type RekapItemRow = {
  id: string;
  kodePesanan: string;
  nama: string;
  angkatan: string | null;
  jurusan: string | null;
  produk: string;
  varian: string | null;
  periode: string | null;
  jumlah: number;
  satuan: string;
  hargaSatuan: number;
  subtotal: number;
  statusBayar: PaymentStatus | null;
  statusPesanan: OrderStatus;
};

// ---------------------------------------------------------------- kolom tabel

/**
 * Jenis isi kolom. Menentukan SEKALIGUS cara tampil di layar (perataan, font)
 * dan cara tulis di Excel (format angka/tanggal/teks).
 */
export type RekapColumnKind =
  /** Teks bebas. */
  | "text"
  /** Kode pesanan / no HP — monospasi di layar, TEKS di Excel. */
  | "code"
  /** Tanggal betulan (bukan string) di Excel. */
  | "date"
  /** Nilai rupiah — rata kanan, di Excel angka ber-format ribuan. */
  | "money"
  /** Cacah biasa — rata kanan. */
  | "number"
  | "orderStatus"
  | "paymentStatus";

export type RekapColumn<Row> = {
  readonly key: Extract<keyof Row, string>;
  readonly label: string;
  readonly kind: RekapColumnKind;
  /** Lebar kolom Excel dalam satuan karakter. */
  readonly width: number;
};

export const REKAP_ORDER_COLUMNS: readonly RekapColumn<RekapOrderRow>[] = [
  { key: "kodePesanan", label: "Kode", kind: "code", width: 22 },
  { key: "tanggal", label: "Tanggal", kind: "date", width: 18 },
  { key: "tipe", label: "Tipe", kind: "text", width: 12 },
  { key: "nama", label: "Nama", kind: "text", width: 26 },
  { key: "angkatan", label: "Angkatan", kind: "text", width: 10 },
  { key: "jurusan", label: "Jurusan", kind: "text", width: 24 },
  { key: "telepon", label: "No HP", kind: "code", width: 16 },
  { key: "email", label: "Email", kind: "text", width: 28 },
  { key: "terima", label: "Terima", kind: "text", width: 10 },
  { key: "jumlahItem", label: "Jumlah Item", kind: "number", width: 12 },
  { key: "total", label: "Total", kind: "money", width: 14 },
  { key: "statusBayar", label: "Status Bayar", kind: "paymentStatus", width: 18 },
  { key: "metode", label: "Metode", kind: "text", width: 20 },
  { key: "statusPesanan", label: "Status Pesanan", kind: "orderStatus", width: 18 },
  { key: "catatan", label: "Catatan", kind: "text", width: 32 },
];

export const REKAP_ITEM_COLUMNS: readonly RekapColumn<RekapItemRow>[] = [
  { key: "kodePesanan", label: "Kode", kind: "code", width: 22 },
  { key: "nama", label: "Nama", kind: "text", width: 26 },
  { key: "angkatan", label: "Angkatan", kind: "text", width: 10 },
  { key: "jurusan", label: "Jurusan", kind: "text", width: 24 },
  { key: "produk", label: "Produk", kind: "text", width: 32 },
  { key: "varian", label: "Varian", kind: "text", width: 22 },
  { key: "periode", label: "Periode PO", kind: "text", width: 24 },
  { key: "jumlah", label: "Jumlah", kind: "number", width: 9 },
  { key: "satuan", label: "Satuan", kind: "text", width: 9 },
  { key: "hargaSatuan", label: "Harga Satuan", kind: "money", width: 14 },
  { key: "subtotal", label: "Subtotal", kind: "money", width: 14 },
  { key: "statusBayar", label: "Status Bayar", kind: "paymentStatus", width: 18 },
  { key: "statusPesanan", label: "Status Pesanan", kind: "orderStatus", width: 18 },
];

/** Nama lembar Excel — sengaja sama persis dengan label tab di layar. */
export const REKAP_SHEET_NAME: Record<RekapTab, string> = REKAP_TAB_LABEL;

/** Kolom angka dirata-kanankan, sisanya rata kiri. */
export function isNumericKind(kind: RekapColumnKind): boolean {
  return kind === "money" || kind === "number";
}
