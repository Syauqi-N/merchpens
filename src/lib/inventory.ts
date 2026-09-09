import { prisma } from "@/lib/prisma";

/**
 * Pengelolaan kuota pre-order.
 *
 * Seluruh produk dijual lewat periode PO, jadi hanya ada SATU penghitung per
 * varian: `PreOrderVariantQuota.reserved`. Angka itu naik saat checkout dan
 * turun lagi hanya bila pesanan kedaluwarsa atau dibatalkan. Tidak ada langkah
 * "commit" saat pembayaran masuk — kuota yang sudah dipesan memang tetap
 * terpakai, persis seperti "kuota 100, checkout 80, sisa 20".
 */

/**
 * Klien transaksi Prisma (tanpa method tingkat-koneksi yang tidak tersedia
 * di dalam `$transaction`).
 */
export type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$transaction" | "$extends"
>;

export class InsufficientStockError extends Error {
  constructor(
    readonly productId: string,
    readonly productName: string,
    readonly variantName?: string,
  ) {
    super(
      `Kuota pre-order untuk "${productName}"${variantName ? ` (${variantName})` : ""} tidak mencukupi`,
    );
    this.name = "InsufficientStockError";
  }
}

export type ReservationLine = {
  productId: string;
  productName: string;
  /** Nama varian untuk pesan galat. */
  variantName?: string;
  /** Baris kuota VARIAN periode PO yang dipakai. */
  variantQuotaId: string;
  quantity: number;
};

/**
 * Memesan (reserve) kuota untuk sebuah order — SECARA ATOMIK.
 *
 * Kuncinya ada pada `WHERE quota - reserved >= ${quantity}`: pengecekan sisa
 * dan penambahannya terjadi dalam SATU pernyataan UPDATE, sehingga database
 * yang menjadi wasit. Bila dua pembeli checkout bersamaan saat sisa kuota
 * tinggal 1, hanya satu UPDATE yang mengenai baris (affected = 1); yang kalah
 * mendapat affected = 0 dan transaksinya dibatalkan. Tanpa ini, pola
 * "SELECT lalu UPDATE" akan menyebabkan kuota terjual melebihi jatah.
 *
 * Harus dipanggil di dalam `prisma.$transaction`.
 */
export async function reserveForOrder(tx: TxClient, lines: ReservationLine[]): Promise<void> {
  for (const line of lines) {
    if (line.quantity <= 0) continue;

    const affected = await tx.$executeRaw`
      UPDATE "PreOrderVariantQuota"
      SET reserved = reserved + ${line.quantity}, "updatedAt" = NOW()
      WHERE id = ${line.variantQuotaId}
        AND quota - reserved >= ${line.quantity}
    `;

    if (affected === 0) {
      throw new InsufficientStockError(line.productId, line.productName, line.variantName);
    }
  }
}

/**
 * Mengembalikan kuota yang direservasi sebuah pesanan.
 * Dipanggil saat pesanan kedaluwarsa, gagal bayar, atau dibatalkan pengurus.
 *
 * Idempoten: kolom `Order.stockReleasedAt` di-"klaim" lewat UPDATE bersyarat,
 * jadi webhook yang datang dua kali tidak akan melepas kuota dua kali.
 *
 * @returns true bila pelepasan benar-benar dilakukan pada pemanggilan ini.
 */
export async function releaseOrderReservations(orderId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.$executeRaw`
      UPDATE "Order"
      SET "stockReleasedAt" = NOW(), "updatedAt" = NOW()
      WHERE id = ${orderId} AND "stockReleasedAt" IS NULL
    `;
    if (claimed === 0) return false; // sudah pernah dilepas

    const items = await tx.orderItem.findMany({ where: { orderId } });

    for (const item of items) {
      if (!item.variantQuotaId) continue; // baris lama tanpa kuota varian terkait
      await tx.$executeRaw`
        UPDATE "PreOrderVariantQuota"
        SET reserved = GREATEST(0, reserved - ${item.quantity}), "updatedAt" = NOW()
        WHERE id = ${item.variantQuotaId}
      `;
    }

    return true;
  });
}

/**
 * Menyapu pesanan yang melewati batas waktu pembayaran: statusnya dijadikan
 * EXPIRED dan kuotanya dikembalikan agar bisa dipesan mahasiswa lain.
 *
 * Sekaligus memulihkan PESANAN YATIM — lihat `releaseOrphanedReservations()`.
 *
 * Dipanggil dari cron/route terjadwal, dan juga secara oportunistik sebelum
 * menampilkan ketersediaan agar kuota tidak "tersandera" pesanan mati.
 *
 * @returns jumlah pesanan yang dikedaluwarsakan pada pemanggilan ini
 *          (pemulihan pesanan yatim dicatat ke log, tidak ikut dihitung).
 */
export async function expireOverdueOrders(now: Date = new Date()): Promise<number> {
  // Didahulukan supaya pesanan yang baru saja di-EXPIRED di bawah tidak ikut
  // terjaring dua kali dalam satu pemanggilan.
  await releaseOrphanedReservations();

  const overdue = await prisma.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      payment: { expiresAt: { lt: now } },
    },
    select: { id: true },
    take: 200,
  });

  let expired = 0;
  for (const order of overdue) {
    const changed = await prisma.$executeRaw`
      UPDATE "Order"
      SET status = 'EXPIRED', "updatedAt" = NOW()
      WHERE id = ${order.id}
        AND status = 'PENDING_PAYMENT'
    `;
    if (changed === 0) continue; // sudah berubah status oleh proses lain

    await prisma.payment.updateMany({
      where: { orderId: order.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });

    // Gagal melepas satu pesanan tidak boleh menghentikan penyapuan sisanya;
    // pesanan itu kini berstatus EXPIRED dengan stockReleasedAt masih NULL,
    // jadi `releaseOrphanedReservations()` akan mengurusnya pada putaran
    // berikutnya.
    try {
      await releaseOrderReservations(order.id);
    } catch (error) {
      console.error(
        `[inventory] gagal melepas reservasi pesanan ${order.id} yang kedaluwarsa:`,
        error,
      );
    }
    expired++;
  }

  return expired;
}

/**
 * Memulihkan PESANAN YATIM: sudah CANCELLED/EXPIRED tetapi `stockReleasedAt`
 * masih NULL, artinya kuotanya tidak pernah benar-benar dikembalikan.
 *
 * Kenapa ini perlu: pelepasan reservasi dan perubahan status adalah dua operasi
 * terpisah, jadi proses bisa mati di antaranya (atau pelepasannya gagal karena
 * database sedang bermasalah). Tanpa penyapu ini pesanan tersebut BUNTU —
 * `expireOverdueOrders()` hanya menyaring status PENDING_PAYMENT dan pembatalan
 * pengurus menolak pesanan yang sudah CANCELLED — sehingga kuotanya hilang
 * selamanya padahal tidak ada yang benar-benar memakainya.
 *
 * Pesanan yang pernah lunas TIDAK perlu dikecualikan: dengan model PO-saja,
 * `reserved` adalah satu-satunya penghitung dan pelepasan selalu merupakan
 * kebalikan dari reservasi. Pembatalan pesanan yang sudah dibayar memang
 * seharusnya mengembalikan jatahnya agar bisa diambil mahasiswa lain, dan
 * `stockReleasedAt` menjaga agar tidak terlepas dua kali.
 *
 * @returns jumlah pesanan yatim yang berhasil dilepas reservasinya.
 */
export async function releaseOrphanedReservations(): Promise<number> {
  const orphaned = await prisma.order.findMany({
    where: {
      status: { in: ["CANCELLED", "EXPIRED"] },
      stockReleasedAt: null,
    },
    select: { id: true },
    take: 200,
  });

  let released = 0;
  for (const order of orphaned) {
    try {
      if (await releaseOrderReservations(order.id)) released++;
    } catch (error) {
      console.error(
        `[inventory] gagal melepas reservasi pesanan yatim ${order.id}:`,
        error,
      );
    }
  }

  if (released > 0) {
    console.info(`[inventory] ${released} pesanan yatim dilepas reservasinya`);
  }

  return released;
}
