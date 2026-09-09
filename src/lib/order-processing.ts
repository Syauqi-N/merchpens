import "server-only";

import { prisma } from "@/lib/prisma";

type OrderProcessingClient = Pick<typeof prisma, "order">;

type ProcessClosedPeriodOrdersOptions = {
  now?: Date;
  /** Batasi ke satu pesanan, misalnya sesaat setelah pembayaran dikonfirmasi. */
  orderId?: string;
  /**
   * Bila diisi, hanya pertimbangkan pesanan yang mempunyai item dari periode
   * ini. Semua periode lain dalam pesanan tetap wajib sudah tertutup.
   */
  periodId?: string;
  /** Klien transaksi agar penutupan manual dan perubahan pesanan bisa atomik. */
  client?: OrderProcessingClient;
};

/**
 * Memajukan pesanan lunas menjadi Diproses setelah SEMUA periode PO yang
 * menaungi itemnya tertutup.
 *
 * Periode dianggap tertutup bila statusnya CLOSED atau `endAt` telah lewat.
 * Pesanan lama yang mempunyai item tanpa relasi `PreOrderItem` sengaja tidak
 * disentuh karena periode asalnya tidak bisa dibuktikan.
 *
 * UPDATE bersyarat `status = PAID` membuat fungsi ini aman dipanggil berulang
 * oleh aksi admin, cron, dan halaman pesanan secara bersamaan.
 */
export async function processPaidOrdersForClosedPeriods(
  options: ProcessClosedPeriodOrdersOptions = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const client = options.client ?? prisma;

  const result = await client.order.updateMany({
    where: {
      ...(options.orderId ? { id: options.orderId } : {}),
      status: "PAID",
      AND: [
        // Hindari kebenaran kosong `every` pada pesanan tanpa item, sekaligus
        // batasi sapuan saat fungsi dipanggil setelah satu periode ditutup.
        {
          items: {
            some: options.periodId
              ? { preOrderItem: { is: { periodId: options.periodId } } }
              : {},
          },
        },
        {
          items: {
            every: {
              preOrderItem: {
                is: {
                  period: {
                    is: {
                      OR: [{ status: "CLOSED" }, { endAt: { lte: now } }],
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
    data: { status: "PROCESSING" },
  });

  return result.count;
}
