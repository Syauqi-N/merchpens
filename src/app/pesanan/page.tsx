import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CreditCardIcon,
  ReceiptTextIcon,
} from "lucide-react";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { expireOverdueOrders } from "@/lib/inventory";
import { processPaidOrdersForClosedPeriods } from "@/lib/order-processing";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Pesanan Saya",
  description: "Riwayat pesanan dan status pembayaranmu.",
};

const PAGE_SIZE = 10;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function PesananPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/masuk?callbackUrl=${encodeURIComponent("/pesanan")}`);
  }

  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const parsedPage = Number.parseInt(rawPage ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  // Sapu pesanan yang lewat batas bayar secara oportunistik supaya daftar di
  // bawah menampilkan status yang benar dan kuota PO tidak tersandera.
  try {
    await expireOverdueOrders();
    await processPaidOrdersForClosedPeriods();
  } catch (error) {
    console.error("[pesanan] gagal menyelaraskan status otomatis:", error);
  }

  const userId = session.user.id;

  const [total, orders] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        items: { select: { id: true, productName: true, quantity: true } },
        payment: { select: { status: true, paymentUrl: true, expiresAt: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-cream sm:text-3xl">Pesanan Saya</h1>
        <p className="mt-1 text-sm text-cream-muted">
          {total > 0
            ? `${total} pesanan tercatat atas namamu.`
            : "Riwayat pesanan dan status pembayaran akan muncul di sini."}
        </p>
      </header>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ReceiptTextIcon />}
          title={page > 1 ? "Tidak ada pesanan di halaman ini" : "Belum ada pesanan"}
          description={
            page > 1
              ? "Kembali ke halaman pertama untuk melihat pesanan terbaru."
              : "Setelah kamu menyelesaikan checkout, pesanannya akan tampil di halaman ini lengkap dengan status pembayaran."
          }
          action={
            page > 1 ? (
              <Button variant="outline" nativeButton={false} render={<Link href="/pesanan" />}>
                Ke halaman pertama
              </Button>
            ) : (
              <Button
                className="bg-gold text-obsidian hover:bg-gold-light"
                nativeButton={false}
                render={<Link href="/produk" />}
              >
                Mulai Belanja
              </Button>
            )
          }
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
            const preview = order.items
              .slice(0, 2)
              .map((item) => item.productName)
              .join(", ");
            const more = order.items.length - 2;
            const needsPayment =
              order.status === "PENDING_PAYMENT" &&
              order.payment?.status === "PENDING" &&
              Boolean(order.payment.paymentUrl);

            return (
              <li key={order.id}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/pesanan/${order.orderNumber}`}
                          className="font-mono text-sm font-semibold text-cream hover:text-gold"
                        >
                          {order.orderNumber}
                        </Link>
                        <OrderStatusBadge status={order.status} />
                      </div>

                      <p className="line-clamp-1 text-sm text-cream-muted">
                        {preview}
                        {more > 0 && ` +${more} produk lain`}
                      </p>

                      <p className="text-xs text-cream-muted">
                        {formatDateTime(order.createdAt)} &middot; {itemCount} barang
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <p className="text-base font-bold text-cream tabular-nums">
                        {formatRupiah(order.total)}
                      </p>

                      <div className="flex items-center gap-2">
                        {needsPayment && order.payment?.paymentUrl && (
                          <Button
                            size="sm"
                            className="bg-gold text-obsidian hover:bg-gold-light"
                            nativeButton={false}
                            render={<a href={order.payment.paymentUrl} rel="noreferrer" />}
                          >
                            <CreditCardIcon aria-hidden />
                            Bayar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          nativeButton={false}
                          render={<Link href={`/pesanan/${order.orderNumber}`} />}
                        >
                          Detail
                          <ArrowRightIcon aria-hidden />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Navigasi halaman pesanan"
          className="mt-6 flex items-center justify-between"
        >
          <Button
            variant="outline"
            disabled={page <= 1}
            nativeButton={false}
            render={page <= 1 ? <span /> : <Link href={`/pesanan?page=${page - 1}`} />}
          >
            <ChevronLeftIcon aria-hidden />
            Sebelumnya
          </Button>

          <span className="text-sm text-cream-muted">
            Halaman {page} dari {totalPages}
          </span>

          <Button
            nativeButton={false}
            variant="outline"
            disabled={page >= totalPages}
            render={
              page >= totalPages ? <span /> : <Link href={`/pesanan?page=${page + 1}`} />
            }
          >
            Berikutnya
            <ChevronRightIcon aria-hidden />
          </Button>
        </nav>
      )}
    </div>
  );
}
