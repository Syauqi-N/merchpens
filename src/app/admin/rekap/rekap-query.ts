// Modul ini menyentuh database langsung; `server-only` membuat build gagal keras
// kalau suatu saat ada Client Component yang mengimpornya.
import "server-only";

import type { OrderStatus, Prisma } from "@/generated/prisma/client";
// Peta kode metode Duitku → nama yang dikenal orang tinggal di modul pesanan.
// Diimpor, BUKAN disalin, supaya rekap tidak pelan-pelan menyimpang dari daftar
// yang dipakai halaman pesanan.
import { formatPaymentMethod } from "@/app/admin/pesanan/schemas";
import { prisma } from "@/lib/prisma";
import { getMasterLists } from "@/lib/settings";

import {
  CUSTOMER_TYPE_LABEL,
  FULFILLMENT_TYPE_LABEL,
  STATUS_TIDAK_RELEVAN,
  type RekapFilterState,
  type RekapItemRow,
  type RekapOrderRow,
} from "./schemas";

/**
 * SATU sumber data untuk halaman rekap DAN endpoint unduh Excel.
 *
 * Tujuannya sederhana: apa yang dilihat panitia di layar dan apa yang terbuka
 * di Excel harus berasal dari perhitungan yang sama persis. Kalau tiap sisi
 * menulis query-nya sendiri, cepat atau lambat keduanya akan berbeda — dan
 * yang ketahuan belakangan biasanya saat hari pengambilan.
 */

/**
 * Batas aman jumlah pesanan yang ditarik sekali jalan.
 *
 * Rekap sengaja tidak dipaginasi (panitia butuh melihat semuanya sekaligus),
 * jadi batas ini yang menjaga satu halaman tidak berubah menjadi tarikan tak
 * terbatas. Angkanya jauh di atas ukuran satu batch PO; bila sampai
 * tersentuh, UI memberi tahu dan menyarankan menyaring per periode.
 */
export const REKAP_MAX_ORDERS = 5000;

/**
 * Status pesanan yang berarti uangnya sudah masuk.
 *
 * Dipakai berdampingan dengan `Payment.status === "PAID"` karena keduanya bisa
 * saling mendahului: webhook Duitku menulis pembayaran lebih dulu, sedangkan
 * konfirmasi manual menaikkan status pesanan. Pesanan lama pun bisa saja tidak
 * punya baris Payment sama sekali.
 */
const STATUS_SUDAH_LUNAS = [
  "PAID",
  "PROCESSING",
  "COMPLETED",
] as const satisfies readonly OrderStatus[];

export type RekapSummary = {
  jumlahPesanan: number;
  /** Cacah pembeli unik — satu orang bisa punya beberapa pesanan. */
  jumlahPembeli: number;
  /** Total banyaknya barang (jumlah kuantitas seluruh item). */
  totalItem: number;
  /** Nilai pesanan yang sudah lunas. */
  nilaiLunas: number;
  /** Nilai seluruh pesanan yang tersaring, lunas maupun belum. */
  nilaiTotal: number;
};

export type RekapResult = {
  barisPesanan: RekapOrderRow[];
  barisItem: RekapItemRow[];
  ringkasan: RekapSummary;
  /** Periode yang sedang difilter — untuk judul halaman & nama berkas unduhan. */
  periode: { id: string; name: string; slug: string } | null;
  /** true bila hasil dipotong di `REKAP_MAX_ORDERS`. */
  terpotong: boolean;
};

/**
 * Menerjemahkan filter item menjadi `where` Prisma.
 *
 * Periode PO dibaca lewat relasi item → preOrderItem → period, sesuai skema
 * merch (OrderItem.preOrderItemId → PreOrderItem.period).
 */
function buildItemWhere(filters: RekapFilterState): Prisma.OrderItemWhereInput {
  const where: Prisma.OrderItemWhereInput = {};

  if (filters.periode) {
    where.preOrderItem = { periodId: filters.periode };
  }

  if (filters.produk) {
    where.productId = filters.produk;
  }

  return where;
}

function buildRekapWhere(filters: RekapFilterState): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};

  if (filters.status) {
    // Status yang dipilih secara eksplisit selalu menang — termasuk ketika yang
    // dipilih justru Dibatalkan atau Kadaluarsa.
    where.status = filters.status;
  } else if (!filters.sertakanBatal) {
    where.status = { notIn: [...STATUS_TIDAK_RELEVAN] };
  }

  if (filters.bayar) {
    where.payment = { is: { status: filters.bayar } };
  }

  if (filters.customerType) {
    where.customerType = filters.customerType;
  }

  if (filters.fulfillmentType) {
    where.fulfillmentType = filters.fulfillmentType;
  }

  if (filters.periode || filters.produk) {
    // Syarat periode dan produk harus dipenuhi oleh baris item yang SAMA.
    // Dua `some` terpisah dapat meloloskan pesanan yang produknya berada di
    // periode lain, sehingga hasil agregasi terlihat benar padahal tercampur.
    where.items = { some: buildItemWhere(filters) };
  }

  if (filters.angkatan) where.customerBatch = filters.angkatan;
  if (filters.jurusan) where.customerProgram = filters.jurusan;

  if (filters.q) {
    where.OR = [
      { orderNumber: { contains: filters.q, mode: "insensitive" } },
      { customerName: { contains: filters.q, mode: "insensitive" } },
      { customerEmail: { contains: filters.q, mode: "insensitive" } },
      { customerPhone: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  return where;
}

/** Membuang string kosong/spasi menjadi null supaya sel tampil sebagai "—". */
function orNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Menarik data rekap sesuai filter.
 *
 * SATU panggilan `findMany` menarik pesanan beserta item, periode PO, dan
 * pembayarannya. Bukan satu query per pesanan (N+1) — relasi diambil
 * bersamaan oleh Prisma, lalu kedua bentuk baris disusun di memori dari hasil
 * yang sama sehingga angkanya mustahil berbeda antar tab.
 */
export async function getRekap(filters: RekapFilterState): Promise<RekapResult> {
  const where = buildRekapWhere(filters);
  const menyaringItem = Boolean(filters.periode || filters.produk);
  const itemWhere = buildItemWhere(filters);

  const orders = await prisma.order.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    // +1 baris hanya untuk mendeteksi bahwa hasilnya terpotong.
    take: REKAP_MAX_ORDERS + 1,
    select: {
      id: true,
      userId: true,
      orderNumber: true,
      createdAt: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      customerType: true,
      customerBatch: true,
      customerProgram: true,
      fulfillmentType: true,
      note: true,
      total: true,
      status: true,
      payment: { select: { status: true, method: true } },
      items: {
        ...(menyaringItem ? { where: itemWhere } : {}),
        orderBy: [{ productName: "asc" }],
        select: {
          id: true,
          productName: true,
          variantName: true,
          productPrice: true,
          quantity: true,
          subtotal: true,
          product: { select: { unit: true } },
          preOrderItem: {
            select: { period: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  const terpotong = orders.length > REKAP_MAX_ORDERS;
  const dipakai = terpotong ? orders.slice(0, REKAP_MAX_ORDERS) : orders;

  const barisPesanan: RekapOrderRow[] = [];
  const barisItem: RekapItemRow[] = [];
  const pembeliUnik = new Set<string>();

  let totalItem = 0;
  let nilaiLunas = 0;
  let nilaiTotal = 0;

  for (const order of dipakai) {
    const angkatan = orNull(order.customerBatch);
    const jurusan = orNull(order.customerProgram);
    const statusBayar = order.payment?.status ?? null;
    const tipe = order.customerType ? (CUSTOMER_TYPE_LABEL[order.customerType] ?? order.customerType) : null;
    const terima = order.fulfillmentType
      ? (FULFILLMENT_TYPE_LABEL[order.fulfillmentType] ?? order.fulfillmentType)
      : null;

    const jumlahItem = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const nilaiItem = order.items.reduce((sum, item) => sum + item.subtotal, 0);
    // Saat periode/produk difilter, angka pada rekap harus mewakili item yang
    // lolos filter — bukan total seluruh isi pesanan yang kebetulan cocok.
    const nilaiPesanan = menyaringItem ? nilaiItem : order.total;

    // Satu pembeli bisa memesan berkali-kali; akun (`userId`) adalah identitas
    // yang stabil karena checkout wajib login.
    const pembeliKey = `user:${order.userId}`;
    pembeliUnik.add(pembeliKey);

    const lunas =
      statusBayar === "PAID" ||
      (STATUS_SUDAH_LUNAS as readonly OrderStatus[]).includes(order.status);

    totalItem += jumlahItem;
    nilaiTotal += nilaiPesanan;
    if (lunas) nilaiLunas += nilaiPesanan;

    barisPesanan.push({
      id: order.id,
      kodePesanan: order.orderNumber,
      tanggal: order.createdAt,
      tipe,
      nama: order.customerName,
      angkatan,
      jurusan,
      telepon: order.customerPhone,
      email: order.customerEmail,
      terima,
      jumlahItem,
      total: nilaiPesanan,
      statusBayar,
      metode: order.payment?.method ? formatPaymentMethod(order.payment.method) : null,
      statusPesanan: order.status,
      catatan: orNull(order.note),
    });

    for (const item of order.items) {
      barisItem.push({
        id: item.id,
        kodePesanan: order.orderNumber,
        nama: order.customerName,
        angkatan,
        jurusan,
        produk: item.productName,
        varian: orNull(item.variantName),
        periode: orNull(item.preOrderItem?.period.name),
        jumlah: item.quantity,
        // Produk yang sudah dihapus tidak lagi punya satuan; pesanan tetap
        // harus bisa direkap, jadi jatuh ke satuan bawaan.
        satuan: item.product?.unit ?? "pcs",
        hargaSatuan: item.productPrice,
        subtotal: item.subtotal,
        statusBayar,
        statusPesanan: order.status,
      });
    }
  }

  // Nama & slug periode hanya dibutuhkan untuk judul dan nama berkas unduhan —
  // satu query tetap, bukan per baris.
  const periode = filters.periode
    ? await prisma.preOrderPeriod.findUnique({
        where: { id: filters.periode },
        select: { id: true, name: true, slug: true },
      })
    : null;

  return {
    barisPesanan,
    barisItem,
    ringkasan: {
      jumlahPesanan: barisPesanan.length,
      jumlahPembeli: pembeliUnik.size,
      totalItem,
      nilaiLunas,
      nilaiTotal,
    },
    periode,
    terpotong,
  };
}

export type RekapFilterOptions = {
  periode: { id: string; name: string }[];
  produk: { value: string; label: string }[];
  angkatan: string[];
  jurusan: string[];
};

/**
 * Pilihan yang mengisi dropdown filter.
 *
 * Angkatan dan jurusan dibaca dari master (`getMasterLists`, sumber yang sama
 * dengan dropdown checkout) supaya ejaannya selalu sama dengan yang dipilih
 * pembeli. Periode dan produk dibaca dari data yang benar-benar ada.
 * Hanya halaman yang memakai ini — endpoint unduh tidak butuh.
 */
export async function getRekapFilterOptions(): Promise<RekapFilterOptions> {
  const [periods, products, master] = await Promise.all([
    prisma.preOrderPeriod.findMany({
      orderBy: [{ startAt: "desc" }],
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      // Dropdown hanya memuat produk yang benar-benar pernah muncul di pesanan.
      where: { orderItems: { some: {} } },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, sku: true },
    }),
    getMasterLists(),
  ]);

  return {
    periode: periods,
    produk: products.map((product) => ({
      value: product.id,
      label: product.sku ? `${product.name} · ${product.sku}` : product.name,
    })),
    angkatan: [...master.angkatan],
    jurusan: [...master.jurusan],
  };
}
