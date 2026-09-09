import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  CheckIcon,
  CreditCardIcon,
  ImageIcon,
  MapPinIcon,
  MessageCircleIcon,
  PackageIcon,
  StickyNoteIcon,
  TriangleAlertIcon,
  TruckIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";

import {
  PeriodPickupDetails,
  PickupDetails,
  ShippingAddressDetails,
} from "@/components/orders/order-pickup";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { RegeneratePaymentButton } from "@/components/orders/regenerate-payment-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/auth";
import {
  PAYMENT_STATUS_LABEL,
  formatDate,
  formatDateTime,
  formatRupiah,
} from "@/lib/format";
import { expireOverdueOrders } from "@/lib/inventory";
import { processPaidOrdersForClosedPeriods } from "@/lib/order-processing";
import { prisma } from "@/lib/prisma";
import { getPickupInfo, getSettings } from "@/lib/settings";
import { buildShippingMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

type PageProps = { params: Promise<{ orderNumber: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return {
    title: `Pesanan ${orderNumber}`,
    description: `Detail dan status pesanan ${orderNumber}.`,
  };
}

const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  MAHASISWA: "Mahasiswa PENS",
  ALUMNI: "Alumni PENS",
};

export default async function DetailPesananPage({ params }: PageProps) {
  const { orderNumber } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/masuk?callbackUrl=${encodeURIComponent(`/pesanan/${orderNumber}`)}`);
  }

  try {
    await expireOverdueOrders();
    await processPaidOrdersForClosedPeriods();
  } catch (error) {
    console.error("[pesanan/detail] gagal menyelaraskan status otomatis:", error);
  }

  const [order, pickup, settings] = await Promise.all([
    prisma.order.findUnique({
      where: { orderNumber },
      include: {
        payment: true,
        items: {
          include: {
            product: {
              select: {
                slug: true,
                unit: true,
                images: { orderBy: { sortOrder: "asc" }, take: 1 },
              },
            },
            variantQuota: {
              select: {
                variant: { select: { imageUrl: true } },
              },
            },
            preOrderItem: {
              select: {
                period: {
                  select: {
                    id: true,
                    name: true,
                    endAt: true,
                    estimatedPickupAt: true,
                    pickupLocation: true,
                    pickupSchedule: true,
                    pickupNote: true,
                    shippingNote: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    getPickupInfo(),
    getSettings(),
  ]);

  // Kepemilikan diperiksa DI SINI, dekat data. Pesanan milik orang lain
  // diperlakukan seolah tidak ada agar nomor pesanan tidak bisa ditebak-tebak.
  if (!order || order.userId !== session.user.id) {
    notFound();
  }

  const isPending = order.status === "PENDING_PAYMENT";
  const canPay =
    order.status === "PENDING_PAYMENT" &&
    order.payment?.status === "PENDING" &&
    Boolean(order.payment.paymentUrl);
  const isShipped = order.fulfillmentType === "SHIPPED";
  const isPaidish =
    order.status === "PAID" ||
    order.status === "PROCESSING" ||
    order.status === "COMPLETED";

  const shippingWhatsAppUrl =
    isShipped && isPaidish
      ? buildWhatsAppUrl(
          settings.social_whatsapp ?? "",
          buildShippingMessage({
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerType: CUSTOMER_TYPE_LABEL[order.customerType] ?? order.customerType,
            items: order.items.map((item) => ({
              name: item.productName,
              variantName: item.variantName,
              quantity: item.quantity,
            })),
            totalLabel: formatRupiah(order.total),
            address: order.shippingAddress?.trim() || "-",
          }),
        )
      : null;

  const preOrderPeriods = [
    ...new Map(
      order.items
        .filter((item) => item.preOrderItem?.period)
        .map((item) => [
          item.preOrderItem!.period.id,
          item.preOrderItem!.period,
        ]),
    ).values(),
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 text-cream-muted hover:text-cream"
        nativeButton={false}
        render={<Link href="/pesanan" />}
      >
        <ArrowLeftIcon aria-hidden />
        Kembali ke daftar pesanan
      </Button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-xl font-bold text-cream sm:text-2xl">
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-cream-muted">
            Dibuat {formatDateTime(order.createdAt)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} className="h-7 px-3 text-sm" />
      </header>

      {canPay && order.payment?.paymentUrl && (
        <Alert className="mb-6 border-gold/30 bg-gold/10">
          <CreditCardIcon aria-hidden />
          <AlertTitle className="text-gold-light">Menunggu pembayaran</AlertTitle>
          <AlertDescription className="text-gold-light/90">
            <p>
              Selesaikan pembayaran sebesar{" "}
              <strong>{formatRupiah(order.total)}</strong>
              {order.payment.expiresAt && (
                <> sebelum {formatDateTime(order.payment.expiresAt)}</>
              )}
              . Setelah lewat batas waktu (60 menit), kuota pre-order akan
              dikembalikan secara otomatis.
            </p>
            <Button
              className="mt-3 bg-gold text-obsidian hover:bg-gold-light"
              nativeButton={false}
              render={<a href={order.payment.paymentUrl} rel="noreferrer" />}
            >
              <CreditCardIcon aria-hidden />
              Bayar Sekarang
            </Button>
            <RegeneratePaymentButton
              orderNumber={order.orderNumber}
              className="mt-3"
            />
          </AlertDescription>
        </Alert>
      )}

      {isShipped && isPaidish && (
        <Alert className="mb-6 border-emerald-500/30 bg-emerald-500/10">
          <TruckIcon aria-hidden />
          <AlertTitle className="text-emerald-200">
            Selesaikan ongkir via WhatsApp
          </AlertTitle>
          <AlertDescription className="text-emerald-200/90">
            <p>
              Pembayaran produk sudah lunas. Chat admin untuk membayar ongkir —
              teks pesanan, total, dan alamatmu sudah disiapkan otomatis.
            </p>
            {shippingWhatsAppUrl ? (
              <Button
                className="mt-3 bg-emerald-600 text-white hover:bg-emerald-700"
                nativeButton={false}
                render={
                  <a
                    href={shippingWhatsAppUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  />
                }
              >
                <MessageCircleIcon aria-hidden />
                Chat Admin untuk Ongkir
              </Button>
            ) : (
              <p className="mt-2 font-medium">
                Nomor WhatsApp admin belum diatur. Hubungi panitia langsung.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {order.status === "EXPIRED" && (
        <Alert variant="destructive" className="mb-6">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>Pesanan kedaluwarsa</AlertTitle>
          <AlertDescription>
            Pembayaran tidak diterima dalam 60 menit, sehingga kuota pre-order
            sudah dikembalikan. Silakan pesan ulang bila masih membutuhkan.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-base font-semibold text-cream">Status Pesanan</h2>
              <OrderTimeline status={order.status} createdAt={order.createdAt} paidAt={order.payment?.paidAt ?? null} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-base font-semibold text-cream">
                Item Pesanan ({order.items.length})
              </h2>

              <ul className="divide-y divide-white/5">
                {order.items.map((item) => {
                  const image =
                    item.variantQuota?.variant.imageUrl ??
                    item.product?.images[0]?.url ??
                    null;
                  const period = item.preOrderItem?.period ?? null;

                  return (
                    <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-raise ring-1 ring-white/10">
                        {image ? (
                          <Image
                            src={image}
                            alt={item.productName}
                            width={64}
                            height={64}
                            className="size-16 object-cover"
                          />
                        ) : (
                          <span className="grid size-full place-items-center text-[#8A8A8A]">
                            <ImageIcon className="size-5" aria-hidden />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        {item.product ? (
                          <Link
                            href={`/produk/${item.product.slug}`}
                            className="line-clamp-2 text-sm font-medium text-cream hover:text-gold"
                          >
                            {item.productName}
                          </Link>
                        ) : (
                          <p className="line-clamp-2 text-sm font-medium text-cream">
                            {item.productName}
                          </p>
                        )}

                        {item.variantName && (
                          <p className="mt-0.5 text-xs font-medium text-gold">
                            {item.variantName}
                          </p>
                        )}

                        <p className="mt-0.5 text-xs text-cream-muted">
                          {item.quantity} {item.product?.unit ?? "pcs"} &times;{" "}
                          {formatRupiah(item.productPrice)}
                        </p>

                        {period && (
                          <p className="mt-1.5 flex items-start gap-1 text-xs text-gold-light">
                            <CalendarClockIcon
                              className="mt-0.5 size-3 shrink-0"
                              aria-hidden
                            />
                            <span>
                              {`${period.name} — estimasi bisa diambil ${formatDate(period.estimatedPickupAt)}`}
                            </span>
                          </p>
                        )}
                      </div>

                      <span className="shrink-0 text-sm font-semibold text-cream tabular-nums">
                        {formatRupiah(item.subtotal)}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <Separator />

              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-cream-muted">Subtotal</dt>
                  <dd className="tabular-nums">{formatRupiah(order.subtotal)}</dd>
                </div>
                {/* Ongkir kirim dibayar manual via WA → tidak masuk total. */}
                <div className="flex items-baseline justify-between border-t border-white/5 pt-2">
                  <dt className="font-medium text-[#D8D3C7]">Total</dt>
                  <dd className="text-lg font-bold text-gold tabular-nums">
                    {formatRupiah(order.total)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {preOrderPeriods.length > 0 && (
            <Alert className="border-gold/30 bg-gold/10">
              <PackageIcon aria-hidden />
              <AlertTitle className="text-gold-light">Pesanan pre-order</AlertTitle>
              <AlertDescription className="text-gold-light/90">
                Estimasi pengambilan untuk barang dalam pesanan ini:
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {preOrderPeriods.map((period) => (
                    <li key={period.id}>
                      {period.name} &mdash; mulai {formatDate(period.estimatedPickupAt)}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-cream">
                <UserRoundIcon className="size-4 text-gold" aria-hidden />
                Data Pemesan
              </h2>

              <div className="space-y-1 text-sm text-[#D8D3C7]">
                <p className="font-medium text-cream">{order.customerName}</p>
                <p>{order.customerPhone}</p>
                <p className="text-cream-muted">{order.customerEmail}</p>
              </div>

              <Separator />
              <dl className="space-y-2 text-sm">
                <Row label="Status">
                  {CUSTOMER_TYPE_LABEL[order.customerType] ?? order.customerType}
                </Row>
                <Row label="Angkatan">{order.customerBatch}</Row>
                <Row label="Jurusan">{order.customerProgram}</Row>
                <Row label="Terima barang">
                  {isShipped ? "Kirim ke alamat" : "Ambil di kampus"}
                </Row>
              </dl>

              {order.note && (
                <>
                  <Separator />
                  <div className="flex gap-2 text-sm">
                    <StickyNoteIcon
                      className="mt-0.5 size-4 shrink-0 text-[#8A8A8A]"
                      aria-hidden
                    />
                    <p className="whitespace-pre-line text-cream-muted">{order.note}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-cream">
                <MapPinIcon className="size-4 text-gold" aria-hidden />
                {isShipped ? "Alamat Pengiriman" : "Pengambilan Barang"}
              </h2>

              {isShipped ? (
                <ShippingAddressDetails address={order.shippingAddress} />
              ) : preOrderPeriods.length > 0 ? (
                <PeriodPickupDetails
                  periods={preOrderPeriods}
                  orderNumber={order.orderNumber}
                />
              ) : (
                <PickupDetails pickup={pickup} orderNumber={order.orderNumber} />
              )}
            </CardContent>
          </Card>

          {order.payment && (
            <Card>
              <CardContent className="space-y-3">
                <h2 className="flex items-center gap-2 text-base font-semibold text-cream">
                  <CreditCardIcon className="size-4 text-gold" aria-hidden />
                  Pembayaran
                </h2>

                <dl className="space-y-2 text-sm">
                  <Row label="Status">
                    {PAYMENT_STATUS_LABEL[order.payment.status] ?? order.payment.status}
                  </Row>
                  <Row label="Jumlah">{formatRupiah(order.payment.amount)}</Row>
                  <Row label="Penyedia">{order.payment.provider}</Row>
                  {order.payment.method && (
                    <Row label="Metode">{order.payment.method}</Row>
                  )}
                  {order.payment.reference && (
                    <Row label="Referensi">
                      <span className="font-mono text-xs">
                        {order.payment.reference}
                      </span>
                    </Row>
                  )}
                  {order.payment.paidAt && (
                    <Row label="Dibayar">{formatDateTime(order.payment.paidAt)}</Row>
                  )}
                  {order.payment.expiresAt && isPending && (
                    <Row label="Batas bayar">
                      {formatDateTime(order.payment.expiresAt)}
                    </Row>
                  )}
                </dl>

                {canPay && order.payment.paymentUrl && (
                  <div className="space-y-2">
                    <Button
                      className="w-full bg-gold text-obsidian hover:bg-gold-light"
                      nativeButton={false}
                      render={<a href={order.payment.paymentUrl} rel="noreferrer" />}
                    >
                      <CreditCardIcon aria-hidden />
                      Bayar Sekarang
                    </Button>
                    <RegeneratePaymentButton
                      orderNumber={order.orderNumber}
                      className="w-full"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-cream-muted">{label}</dt>
      <dd className="text-right font-medium text-cream">{children}</dd>
    </div>
  );
}

/** Langkah-langkah perjalanan pesanan yang normal (jalur bahagia). */
const TIMELINE_STEPS = [
  { key: "PENDING_PAYMENT", title: "Pesanan dibuat", description: "Menunggu pembayaran (60 menit)" },
  { key: "PAID", title: "Pembayaran diterima", description: "Dana terkonfirmasi Duitku" },
  { key: "PROCESSING", title: "Pesanan diproses", description: "Disiapkan panitia" },
  { key: "COMPLETED", title: "Selesai", description: "Barang sudah kamu terima" },
] as const;

const STEP_ORDER: Record<string, number> = {
  PENDING_PAYMENT: 0,
  PAID: 1,
  PROCESSING: 2,
  COMPLETED: 3,
};

function OrderTimeline({
  status,
  createdAt,
  paidAt,
}: {
  status: string;
  createdAt: Date;
  paidAt: Date | null;
}) {
  const terminated = status === "CANCELLED" || status === "EXPIRED";
  const currentIndex = terminated ? 0 : (STEP_ORDER[status] ?? 0);

  return (
    <ol className="space-y-0">
      {TIMELINE_STEPS.map((step, index) => {
        const done = !terminated && index <= currentIndex;
        const isLast = index === TIMELINE_STEPS.length - 1;
        const timestamp =
          index === 0 ? createdAt : index === 1 && paidAt ? paidAt : null;

        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                aria-hidden
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full ring-1",
                  done
                    ? "bg-gold text-obsidian ring-gold/60"
                    : "bg-coal text-[#6E6E6E] ring-white/10",
                )}
              >
                <CheckIcon className="size-4" />
              </span>
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    "w-px flex-1",
                    done && index < currentIndex ? "bg-gold" : "bg-[#2A2A2A]",
                  )}
                />
              )}
            </div>

            <div className={cn("pb-5", isLast && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-medium",
                  done ? "text-cream" : "text-[#8A8A8A]",
                )}
              >
                {step.title}
              </p>
              <p className="text-xs text-cream-muted">{step.description}</p>
              {timestamp && (
                <p className="mt-0.5 text-xs text-[#8A8A8A]">
                  {formatDateTime(timestamp)}
                </p>
              )}
            </div>
          </li>
        );
      })}

      {terminated && (
        <li className="flex gap-3">
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
          >
            <XIcon className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-red-300">
              {status === "EXPIRED" ? "Kedaluwarsa" : "Dibatalkan"}
            </p>
            <p className="text-xs text-cream-muted">
              Kuota pre-order sudah dikembalikan.
            </p>
          </div>
        </li>
      )}
    </ol>
  );
}
