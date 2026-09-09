import "server-only";

import { processPaidOrdersForClosedPeriods } from "@/lib/order-processing";
import { prisma } from "@/lib/prisma";
import { releaseOrderReservations } from "@/lib/inventory";

/**
 * Transisi status pesanan yang AMAN DIULANG (idempoten).
 *
 * Dipakai oleh dua sumber kebenaran yang bisa datang bersamaan:
 *   1. webhook Duitku  (src/app/api/duitku/callback/route.ts)
 *   2. rekonsiliasi    (src/app/checkout/selesai/page.tsx — checkTransactionStatus)
 *
 * Kuncinya adalah UPDATE BERSYARAT `WHERE status = 'PENDING_PAYMENT'`. Database
 * yang menjadi wasit: hanya pemanggil pertama yang mendapat 1 baris terpengaruh
 * dan boleh menjalankan efek samping (mis. melepas kuota). Pemanggil berikutnya
 * mendapat 0 baris dan tidak melakukan apa-apa. Tanpa ini, kiriman ulang webhook
 * Duitku (sampai 5x) akan menjalankan efek sampingnya berkali-kali.
 */

export type SettlementOutcome =
  /** Transisi benar-benar terjadi pada pemanggilan ini. */
  | "APPLIED"
  /** Pesanan sudah tidak berstatus PENDING_PAYMENT — tidak ada yang dikerjakan. */
  | "ALREADY_SETTLED";

/**
 * PENDING_PAYMENT → PAID.
 *
 * Kuota pre-order SENGAJA TIDAK DISENTUH di sini. Dengan model PO-saja,
 * `PreOrderVariantQuota.reserved` sudah bertambah sejak pesanan dibuat dan memang
 * tetap terpakai setelah lunas — persis "kuota 100, dipesan 80, sisa 20".
 * Tidak ada langkah "commit" yang perlu dijalankan saat pembayaran masuk;
 * kuota hanya dikembalikan lewat `failOrder()`/`releaseOrderReservations()`
 * bila pesanan batal atau kedaluwarsa.
 *
 * Yang berubah hanyalah status: Order → PAID dan Payment → PAID + paidAt,
 * keduanya di dalam satu transaksi yang dijaga UPDATE bersyarat di bawah.
 */
export async function settleOrderAsPaid(params: {
  orderId: string;
  paymentId: string;
  reference?: string | null;
  method?: string | null;
  paidAt?: Date;
}): Promise<SettlementOutcome> {
  const paidAt = params.paidAt ?? new Date();

  const outcome = await prisma.$transaction(async (tx) => {
    const affected = await tx.$executeRaw`
      UPDATE "Order"
      SET status = 'PAID', "updatedAt" = NOW()
      WHERE id = ${params.orderId}
        AND status = 'PENDING_PAYMENT'
    `;

    if (affected !== 1) return "ALREADY_SETTLED";

    await tx.payment.update({
      where: { id: params.paymentId },
      data: {
        status: "PAID",
        paidAt,
        ...(params.reference ? { reference: params.reference } : {}),
        ...(params.method ? { method: params.method } : {}),
      },
    });

    return "APPLIED";
  });

  // Bila pembayaran baru masuk setelah periode keburu ditutup, tidak perlu
  // menunggu putaran cron berikutnya untuk masuk ke status Diproses. Tetap
  // dicoba pada webhook ulang agar kegagalan sinkronisasi sebelumnya pulih.
  try {
    await processPaidOrdersForClosedPeriods({
      orderId: params.orderId,
      now: paidAt,
    });
  } catch (error) {
    // Pembayaran sudah tersimpan. Jangan membuat webhook/redirect pembayaran
    // dianggap gagal hanya karena sinkronisasi status lanjutan bermasalah;
    // cron dan kunjungan halaman pesanan akan mencoba lagi.
    console.error(
      `[order-settlement] Gagal memproses otomatis pesanan ${params.orderId}.`,
      error,
    );
  }

  return outcome;
}

/**
 * PENDING_PAYMENT → EXPIRED / CANCELLED, lalu mengembalikan kuota pre-order
 * yang sempat direservasi agar bisa dipesan mahasiswa lain.
 */
export async function failOrder(params: {
  orderId: string;
  paymentId?: string | null;
  orderStatus: "EXPIRED" | "CANCELLED";
  paymentStatus: "FAILED" | "EXPIRED";
  reference?: string | null;
}): Promise<SettlementOutcome> {
  // Enum Postgres tidak bisa di-parameterkan langsung, jadi dua cabang literal.
  const affected =
    params.orderStatus === "CANCELLED"
      ? await prisma.$executeRaw`
          UPDATE "Order"
          SET status = 'CANCELLED', "updatedAt" = NOW()
          WHERE id = ${params.orderId} AND status = 'PENDING_PAYMENT'
        `
      : await prisma.$executeRaw`
          UPDATE "Order"
          SET status = 'EXPIRED', "updatedAt" = NOW()
          WHERE id = ${params.orderId} AND status = 'PENDING_PAYMENT'
        `;

  if (affected !== 1) return "ALREADY_SETTLED";

  if (params.paymentId) {
    await prisma.payment.updateMany({
      where: { id: params.paymentId, status: "PENDING" },
      data: {
        status: params.paymentStatus,
        ...(params.reference ? { reference: params.reference } : {}),
      },
    });
  }

  // Sendiri sudah idempoten lewat kolom Order.stockReleasedAt.
  await releaseOrderReservations(params.orderId);

  return "APPLIED";
}
