"use server";

import { revalidatePath } from "next/cache";

import { requireCapability } from "@/lib/auth";
import { checkTransactionStatus, isDuitkuConfigured } from "@/lib/duitku";
import { ORDER_STATUS_LABEL } from "@/lib/format";
import { releaseOrderReservations } from "@/lib/inventory";
import { processPaidOrdersForClosedPeriods } from "@/lib/order-processing";
import { CAPABILITY_DENIED_MESSAGE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import {
  CANCELLABLE_FROM,
  MANUAL_STATUS_SOURCES,
  markPaidManuallySchema,
  orderIdSchema,
  updateOrderStatusSchema,
  type ActionResult,
} from "./schemas";

/**
 * Server Action panel admin pesanan.
 *
 * Semua aksi di sini bisa dipanggil lewat POST langsung tanpa melewati UI,
 * jadi setiap fungsi memverifikasi kemampuan `MANAGE_ORDERS` sendiri dan
 * memvalidasi ulang seluruh masukan — tidak ada yang bersandar pada
 * pemeriksaan di komponen.
 *
 * Pola perubahan status memakai `updateMany` bersyarat (`where` memuat status
 * asal) sehingga pemeriksaan dan penulisan menjadi SATU pernyataan UPDATE.
 * Bila webhook Duitku mengubah pesanan yang sama pada saat bersamaan, hanya
 * satu penulisan yang berhasil dan `count === 0` memberi tahu kita bahwa
 * transisi tidak lagi sah — inilah yang membuat aksi ini idempoten.
 */

/** Menolak pemanggil tanpa hak kelola pesanan tanpa melempar ke error boundary. */
async function ensureOrderAccess(): Promise<string | null> {
  try {
    await requireCapability("MANAGE_ORDERS");
    return null;
  } catch {
    return CAPABILITY_DENIED_MESSAGE.MANAGE_ORDERS;
  }
}

function revalidateOrder(orderId: string): void {
  revalidatePath("/admin/pesanan");
  revalidatePath(`/admin/pesanan/${orderId}`);
  // Riwayat pesanan milik pelanggan ikut berubah.
  revalidatePath("/pesanan");
}

/** Halaman yang menampilkan sisa kuota PO setelah reservasi bergerak. */
function revalidateInventoryViews(): void {
  revalidatePath("/admin/pre-order");
  revalidatePath("/admin/produk");
  revalidatePath("/produk");
  revalidatePath("/pre-order");
}

/**
 * Menjadikan pesanan LUNAS, dalam satu transaksi.
 *
 * Transisi `PENDING_PAYMENT → PAID` di-"klaim" lewat UPDATE bersyarat. Kalau
 * klaim gagal (count 0) berarti pesanan sudah ditangani webhook atau admin
 * lain, dan pembayarannya tidak ikut ditulis ulang — itulah yang membuat tombol
 * "tandai lunas" aman ditekan berulang.
 *
 * Tidak ada langkah "commit" inventaris di sini: seluruh produk dijual lewat
 * kuota PO, dan kuota yang sudah dipesan memang tetap terpakai sejak checkout.
 * Pelunasan tidak mengubah angka `reserved` sama sekali.
 *
 * @returns true bila pemanggilan inilah yang benar-benar melunasi pesanan.
 */
async function settleOrderAsPaid(
  orderId: string,
  patch: {
    reference?: string | null;
    method?: string | null;
    manualConfirmedAt?: Date;
    manualConfirmedBy?: string;
    manualNote?: string | null;
  } = {},
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: {
        id: orderId,
        status: { in: ["PENDING_PAYMENT"] },
      },
      data: { status: "PAID" },
    });
    if (claimed.count === 0) return false;

    await tx.payment.updateMany({
      where: { orderId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        ...(patch.reference ? { reference: patch.reference } : {}),
        ...(patch.method ? { method: patch.method } : {}),
        ...(patch.manualConfirmedAt
          ? {
              manualConfirmedAt: patch.manualConfirmedAt,
              manualConfirmedBy: patch.manualConfirmedBy ?? null,
              manualNote: patch.manualNote ?? null,
            }
          : {}),
      },
    });

    return true;
  });
}

// ------------------------------------------------------------ ubah status

/**
 * Menyelesaikan pesanan yang sudah berstatus Diproses.
 *
 * PAID → PROCESSING ditangani otomatis setelah seluruh periode PO terkait
 * ditutup (lihat `lib/order-processing.ts`). Pelunasan (`PAID`) juga tidak
 * ditangani di sini karena menyentuh data pembayaran — pakai
 * `markPaidManually()` atau `syncPaymentStatus()`.
 * Pembatalan juga terpisah di `cancelOrder()` karena harus mengembalikan kuota.
 */
export async function updateOrderStatus(input: unknown): Promise<ActionResult> {
  const denied = await ensureOrderAccess();
  if (denied) return { ok: false, message: denied };

  const parsed = updateOrderStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Permintaan tidak valid." };
  }

  const { orderId, status } = parsed.data;
  const allowedFrom = MANUAL_STATUS_SOURCES[status];

  try {
    const result = await prisma.order.updateMany({
      where: { id: orderId, status: { in: [...allowedFrom] } },
      data: { status },
    });

    if (result.count === 0) {
      const current = await prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });

      if (!current) return { ok: false, message: "Pesanan tidak ditemukan." };

      return {
        ok: false,
        message:
          `Pesanan berstatus "${ORDER_STATUS_LABEL[current.status]}" tidak bisa diubah ` +
          `menjadi "${ORDER_STATUS_LABEL[status]}".`,
      };
    }

    revalidateOrder(orderId);
    return {
      ok: true,
      message: `Status pesanan diubah menjadi "${ORDER_STATUS_LABEL[status]}".`,
    };
  } catch (error) {
    console.error("[updateOrderStatus] gagal:", error);
    return { ok: false, message: "Terjadi kesalahan pada server. Coba lagi." };
  }
}

// -------------------------------------------------------------- batalkan

/**
 * Membatalkan pesanan dan MENGEMBALIKAN kuota PO yang dipegangnya, sehingga
 * mahasiswa lain langsung bisa memakainya kembali.
 *
 * Hanya ada SATU bentuk pengembalian, termasuk untuk pesanan yang sudah lunas:
 * `reserved` pada baris kuota dikurangi kembali. Tidak ada percabangan
 * "sudah di-commit atau belum" karena tidak ada langkah commit — kuota memang
 * terpakai sejak checkout sampai pesanannya batal. Idempotensinya dijaga kolom
 * `Order.stockReleasedAt` di dalam `releaseOrderReservations()`, jadi memanggil
 * ini dua kali tidak melepas kuota dua kali.
 */
export async function cancelOrder(input: unknown): Promise<ActionResult> {
  const denied = await ensureOrderAccess();
  if (denied) return { ok: false, message: denied };

  const parsed = orderIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Permintaan tidak valid." };
  }

  const { orderId } = parsed.data;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, orderNumber: true },
    });

    if (!order) return { ok: false, message: "Pesanan tidak ditemukan." };

    const cancellable = (CANCELLABLE_FROM as readonly string[]).includes(order.status);
    if (!cancellable) {
      return {
        ok: false,
        message: `Pesanan berstatus "${ORDER_STATUS_LABEL[order.status]}" tidak bisa dibatalkan.`,
      };
    }

    // Klaim transisi dari status yang barusan dibaca. Bila di sela-selanya
    // status berubah (mis. webhook melunasi), count = 0 dan kita batal daripada
    // membatalkan pesanan yang keadaannya sudah bukan yang kita periksa tadi.
    const claimed = await prisma.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: "CANCELLED" },
    });

    if (claimed.count === 0) {
      return {
        ok: false,
        message: "Status pesanan baru saja berubah. Muat ulang halaman lalu coba lagi.",
      };
    }

    await prisma.payment.updateMany({
      where: { orderId, status: "PENDING" },
      data: { status: "FAILED" },
    });

    // Satu jalur pelepasan untuk semua status yang bisa dibatalkan.
    await releaseOrderReservations(orderId);

    revalidateOrder(orderId);
    revalidateInventoryViews();

    return {
      ok: true,
      message: `Pesanan ${order.orderNumber} dibatalkan. Kuota pre-order sudah dikembalikan.`,
    };
  } catch (error) {
    console.error("[cancelOrder] gagal:", error);
    return { ok: false, message: "Terjadi kesalahan pada server. Coba lagi." };
  }
}

// ------------------------------------------------------- tandai lunas manual

/**
 * Override darurat: menandai pesanan lunas tanpa konfirmasi Duitku.
 *
 * Dipakai bila pembayaran terbukti masuk tetapi webhook maupun pengecekan
 * status tidak kunjung memperbarui pesanan. Karena melewati verifikasi
 * penyedia pembayaran, tindakan ini dicatat ke log server.
 */
export async function markPaidManually(input: unknown): Promise<ActionResult> {
  const denied = await ensureOrderAccess();
  if (denied) return { ok: false, message: denied };

  const parsed = markPaidManuallySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Permintaan tidak valid." };
  }

  const { orderId, note } = parsed.data;

  try {
    const actor = await requireCapability("MANAGE_ORDERS");
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        status: true,
        total: true,
      },
    });

    if (!order) return { ok: false, message: "Pesanan tidak ditemukan." };

    const confirmedAt = new Date();
    const settled = await settleOrderAsPaid(orderId, {
      method: "MANUAL",
      manualConfirmedAt: confirmedAt,
      manualConfirmedBy: actor.email ?? actor.id,
      manualNote: note || null,
    });

    if (!settled) {
      return {
        ok: false,
        message:
          `Pesanan sudah berstatus "${ORDER_STATUS_LABEL[order.status]}", ` +
          "jadi tidak bisa ditandai lunas lagi.",
      };
    }

    const processed = await processPaidOrdersForClosedPeriods({ orderId });

    // Jejak audit: override manual melewati verifikasi Duitku, jadi harus
    // terlihat siapa yang melakukannya dan kapan.
    console.warn(
      "[markPaidManually] override manual",
      JSON.stringify({
        orderNumber: order.orderNumber,
        total: order.total,
        pengurus: actor.email ?? actor.id,
        peran: actor.role,
        note: note || null,
        at: confirmedAt.toISOString(),
      }),
    );

    revalidateOrder(orderId);
    revalidateInventoryViews();

    return {
      ok: true,
      message:
        `Pesanan ${order.orderNumber} ditandai LUNAS secara manual.` +
        (processed > 0
          ? " Karena seluruh periode PO terkait sudah tutup, statusnya langsung menjadi Diproses."
          : ""),
    };
  } catch (error) {
    console.error("[markPaidManually] gagal:", error);
    return { ok: false, message: "Terjadi kesalahan pada server. Coba lagi." };
  }
}

// --------------------------------------------------------- sinkron ke Duitku

/**
 * Rekonsiliasi manual: menanyakan status transaksi langsung ke Duitku.
 *
 * Berguna ketika webhook terlewat (server sempat mati, callback gagal
 * terkirim). Hanya konfirmasi LUNAS yang otomatis memajukan status pesanan;
 * hasil "gagal" cukup menandai pembayaran sebagai gagal dan menyerahkan
 * keputusan pembatalan kepada admin.
 */
export async function syncPaymentStatus(input: unknown): Promise<ActionResult> {
  const denied = await ensureOrderAccess();
  if (denied) return { ok: false, message: denied };

  const parsed = orderIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Permintaan tidak valid." };
  }

  if (!isDuitkuConfigured()) {
    return {
      ok: false,
      message:
        "Integrasi Duitku belum dikonfigurasi (DUITKU_MERCHANT_CODE / DUITKU_API_KEY belum diisi).",
    };
  }

  const { orderId } = parsed.data;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        orderNumber: true,
        payment: { select: { id: true, merchantOrderId: true, reference: true } },
      },
    });

    if (!order) return { ok: false, message: "Pesanan tidak ditemukan." };
    if (!order.payment) {
      return {
        ok: false,
        message: "Pesanan ini belum memiliki data pembayaran Duitku untuk dicek.",
      };
    }

    let status;
    try {
      status = await checkTransactionStatus(order.payment.merchantOrderId);
    } catch (error) {
      console.error("[syncPaymentStatus] gagal menghubungi Duitku:", error);
      return {
        ok: false,
        message: "Gagal menghubungi Duitku. Periksa koneksi/kredensial lalu coba lagi.",
      };
    }

    // Simpan reference bila Duitku baru mengembalikannya sekarang.
    if (status.reference && status.reference !== order.payment.reference) {
      await prisma.payment.update({
        where: { id: order.payment.id },
        data: { reference: status.reference },
      });
    }

    if (status.isPaid) {
      const settled = await settleOrderAsPaid(orderId, { reference: status.reference });
      let processed = 0;
      if (settled) {
        processed = await processPaidOrdersForClosedPeriods({ orderId });
      }
      revalidateOrder(orderId);
      revalidateInventoryViews();

      return settled
        ? {
            ok: true,
            message:
              `Duitku mengonfirmasi pembayaran LUNAS. Pesanan ${order.orderNumber} ` +
              (processed > 0
                ? "langsung masuk ke status Diproses karena seluruh periode PO terkait sudah tutup."
                : "diperbarui menjadi Dibayar."),
          }
        : {
            ok: true,
            message:
              `Duitku menyatakan LUNAS, tetapi pesanan sudah berstatus ` +
              `"${ORDER_STATUS_LABEL[order.status]}" sehingga tidak diubah lagi.`,
          };
    }

    // "02" = gagal/batal menurut Duitku. Kode lain berarti masih diproses.
    if (status.statusCode === "02") {
      await prisma.payment.updateMany({
        where: { orderId, status: "PENDING" },
        data: { status: "FAILED" },
      });
      revalidateOrder(orderId);

      return {
        ok: true,
        message:
          `Duitku menyatakan transaksi GAGAL/BATAL${status.statusMessage ? ` (${status.statusMessage})` : ""}. ` +
          "Pembayaran ditandai Gagal — batalkan pesanan bila memang tidak jadi.",
      };
    }

    revalidateOrder(orderId);
    return {
      ok: true,
      message:
        `Duitku menyatakan transaksi masih diproses (kode ${status.statusCode}` +
        `${status.statusMessage ? `: ${status.statusMessage}` : ""}). Status pesanan tidak diubah.`,
    };
  } catch (error) {
    console.error("[syncPaymentStatus] gagal:", error);
    return { ok: false, message: "Terjadi kesalahan pada server. Coba lagi." };
  }
}
