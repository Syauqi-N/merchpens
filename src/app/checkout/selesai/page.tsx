import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ClockIcon,
  CreditCardIcon,
  MessageCircleIcon,
  ReceiptTextIcon,
  StoreIcon,
  TimerOffIcon,
  TruckIcon,
} from "lucide-react";

import {
  PeriodPickupDetails,
  PickupDetails,
  ShippingAddressDetails,
} from "@/components/orders/order-pickup";
import { SecondaryBrandLogo } from "@/components/branding/brand-logos";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { RegeneratePaymentButton } from "@/components/orders/regenerate-payment-button";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/auth";
import { checkTransactionStatus, isDuitkuConfigured } from "@/lib/duitku";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { failOrder, settleOrderAsPaid } from "@/lib/order-settlement";
import { prisma } from "@/lib/prisma";
import { getPickupInfo, getSettings } from "@/lib/settings";
import { buildShippingMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Status Pembayaran",
  description: "Hasil pembayaran pesananmu.",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Halaman balik dari Duitku (`returnUrl`).
 *
 * PENTING: `resultCode` di query string datang lewat browser pengguna dan bisa
 * diubah sesuka hati (`?resultCode=00`). Karena itu halaman ini TIDAK PERNAH
 * memperbarui status berdasarkan nilai tersebut. Yang ditampilkan selalu status
 * TERKINI dari database; bila masih menunggu pembayaran, kita bertanya langsung
 * ke Duitku lewat `checkTransactionStatus()` — jaring pengaman bila webhook
 * belum sampai (mis. tunnel ngrok sempat mati).
 */
export default async function CheckoutSelesaiPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const merchantOrderId = first(params.merchantOrderId);
  const resultCode = first(params.resultCode);

  const session = await auth();
  if (!session?.user?.id) {
    const target = merchantOrderId
      ? `/checkout/selesai?merchantOrderId=${encodeURIComponent(merchantOrderId)}`
      : "/checkout/selesai";
    redirect(`/masuk?callbackUrl=${encodeURIComponent(target)}`);
  }

  if (!merchantOrderId) {
    return (
      <Shell>
        <EmptyState
          icon={<ReceiptTextIcon />}
          title="Nomor pesanan tidak ditemukan"
          description="Tautan yang kamu buka tidak menyertakan nomor pesanan. Cek daftar pesananmu untuk melihat status terbaru."
          action={
            <Button
              className="bg-gold text-obsidian hover:bg-gold-light"
              nativeButton={false}
              render={<Link href="/pesanan" />}
            >
              Lihat Pesanan Saya
            </Button>
          }
        />
      </Shell>
    );
  }

  const existing = await prisma.order.findFirst({
    where: {
      OR: [
        { orderNumber: merchantOrderId },
        { payment: { is: { merchantOrderId } } },
      ],
    },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      status: true,
      payment: {
        select: {
          id: true,
          status: true,
          amount: true,
          merchantOrderId: true,
        },
      },
    },
  });

  // Pesanan orang lain diperlakukan seolah tidak ada.
  if (!existing || existing.userId !== session.user.id) {
    notFound();
  }

  // ---- Rekonsiliasi: tanya langsung ke Duitku, bukan percaya resultCode ----
  let reconciled = false;
  if (
    existing.status === "PENDING_PAYMENT" &&
    existing.payment &&
    isDuitkuConfigured()
  ) {
    try {
      const status = await checkTransactionStatus(
        existing.payment.merchantOrderId,
      );

      if (status.isPaid) {
        // Jumlahnya WAJIB dicocokkan, persis seperti yang dilakukan webhook:
        // status "lunas" untuk nominal yang berbeda dari tagihan kita tidak
        // boleh melunasi pesanan (mis. nomor pesanan tertukar atau nominal
        // dibayar sebagian). Bila tidak cocok, status ditampilkan apa adanya
        // dan selisihnya ditinjau manual.
        const confirmedAmount =
          status.amount === null ? Number.NaN : Math.round(Number(status.amount));

        if (!Number.isFinite(confirmedAmount) || confirmedAmount !== existing.payment.amount) {
          console.warn(
            `[checkout/selesai] jumlah tidak cocok untuk ${existing.payment.merchantOrderId}: Duitku=${status.amount ?? "-"}, tagihan=${existing.payment.amount} — pesanan TIDAK dilunasi`,
          );
        } else {
          const outcome = await settleOrderAsPaid({
            orderId: existing.id,
            paymentId: existing.payment.id,
            reference: status.reference,
          });
          reconciled = outcome === "APPLIED";
        }
      } else if (status.statusCode === "02") {
        // "02" = dibatalkan/gagal menurut Duitku.
        const outcome = await failOrder({
          orderId: existing.id,
          paymentId: existing.payment.id,
          orderStatus: "CANCELLED",
          paymentStatus: "FAILED",
          reference: status.reference,
        });
        reconciled = outcome === "APPLIED";
      }
    } catch (error) {
      console.error(
        `[checkout/selesai] rekonsiliasi ${merchantOrderId} gagal:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const order = await prisma.order.findUnique({
    where: { id: existing.id },
    include: {
      items: {
        include: {
          preOrderItem: {
            select: {
              period: {
                select: {
                  id: true,
                  name: true,
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
      payment: true,
    },
  });

  if (!order || order.userId !== session.user.id) {
    notFound();
  }

  const isPaid = ["PAID", "PROCESSING", "COMPLETED"].includes(order.status);
  const isPending = order.status === "PENDING_PAYMENT";
  const canRetryPayment =
    order.status === "PENDING_PAYMENT" &&
    Boolean(order.payment?.paymentUrl) &&
    order.payment?.status === "PENDING";

  const isShipped = order.fulfillmentType === "SHIPPED";
  const [pickup, settings] = await Promise.all([getPickupInfo(), getSettings()]);
  const shippingWhatsAppUrl =
    isShipped && isPaid
      ? buildWhatsAppUrl(
          settings.social_whatsapp ?? "",
          buildShippingMessage({
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerType: order.customerType,
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
  const pickupPeriods = [
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
    <Shell>
      <Card className="overflow-hidden">
        <div
          className={
            isPaid
              ? "bg-emerald-500/10 px-6 py-8 text-center"
              : isPending
                ? "bg-gold/10 px-6 py-8 text-center"
                : "bg-raise px-6 py-8 text-center"
          }
        >
          <span
            aria-hidden
            className="mx-auto grid size-14 place-items-center rounded-full bg-coal shadow-sm [&_svg]:size-7"
          >
            {isPaid ? (
              <CheckCircle2Icon className="text-emerald-600" />
            ) : isPending ? (
              <ClockIcon className="text-gold-deep" />
            ) : (
              <TimerOffIcon className="text-cream-muted" />
            )}
          </span>

          <h1 className="mt-4 text-xl font-bold text-cream sm:text-2xl">
            {isPaid
              ? "Pembayaran berhasil"
              : isPending
                ? "Menunggu pembayaran"
                : "Pesanan tidak dilanjutkan"}
          </h1>

          <p className="mt-1 text-sm text-cream-muted">
            {isPaid
              ? isShipped
                ? "Terima kasih! Pesananmu sudah tercatat. Chat admin via WhatsApp di bawah untuk ongkir pengiriman."
                : "Terima kasih! Pesananmu sudah tercatat. Barangnya kamu ambil di kampus sesuai jadwal."
              : isPending
                ? "Kami belum menerima konfirmasi pembayaran. Selesaikan pembayaran sebelum 60 menit berlalu."
                : "Pesanan ini sudah dibatalkan atau kedaluwarsa. Kuota yang sempat dikunci sudah dikembalikan."}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <OrderStatusBadge status={order.status} />
            <span className="font-mono text-sm text-cream-muted">{order.orderNumber}</span>
          </div>
        </div>

        <CardContent className="space-y-5 pt-6">
          {reconciled && (
            <Alert className="border-gold/30 bg-gold/10">
              <CreditCardIcon aria-hidden />
              <AlertTitle className="text-gold-light">Status baru saja diperbarui</AlertTitle>
              <AlertDescription className="text-gold-light/90">
                Kami mengecek langsung ke Duitku dan menyelaraskan status pesanan ini.
              </AlertDescription>
            </Alert>
          )}

          {isPending && resultCode === "00" && (
            <Alert className="border-gold/30 bg-gold/10">
              <ClockIcon aria-hidden />
              <AlertTitle className="text-gold-light">Konfirmasi masih diproses</AlertTitle>
              <AlertDescription className="text-gold-light/90">
                Halaman pembayaran melaporkan sukses, namun konfirmasi resmi dari Duitku
                belum kami terima. Status akan otomatis berubah begitu konfirmasi masuk —
                muat ulang halaman ini beberapa saat lagi.
              </AlertDescription>
            </Alert>
          )}

          {isShipped && isPaid && (
            <Alert className="border-emerald-500/30 bg-emerald-500/10">
              <TruckIcon aria-hidden />
              <AlertTitle className="text-emerald-200">
                Selesaikan ongkir via WhatsApp
              </AlertTitle>
              <AlertDescription className="space-y-3 text-emerald-200/90">
                <p>
                  Ongkir tidak termasuk pembayaran gateway. Chat admin — teks
                  pesanan, total, dan alamatmu sudah disiapkan otomatis.
                </p>
                {shippingWhatsAppUrl ? (
                  <Button
                    nativeButton={false}
                    render={
                      <a
                        href={shippingWhatsAppUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      />
                    }
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <MessageCircleIcon aria-hidden />
                    Chat Admin untuk Ongkir
                  </Button>
                ) : (
                  <p className="font-medium">
                    Nomor WhatsApp admin belum diatur. Hubungi panitia melalui
                    kontak resmi yang tersedia.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div>
            <h2 className="text-sm font-semibold text-cream">Rincian Pesanan</h2>
            <ul className="mt-2 space-y-2">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-cream">{item.productName}</p>
                    {item.variantName && (
                      <p className="text-xs font-medium text-gold">
                        {item.variantName}
                      </p>
                    )}
                    <p className="text-xs text-cream-muted">
                      {item.quantity} &times; {formatRupiah(item.productPrice)}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium text-cream tabular-nums">
                    {formatRupiah(item.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-cream-muted">Subtotal</dt>
              <dd className="tabular-nums">{formatRupiah(order.subtotal)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-white/5 pt-2">
              <dt className="font-medium text-[#D8D3C7]">Total</dt>
              <dd className="text-lg font-bold text-gold tabular-nums">
                {formatRupiah(order.total)}
              </dd>
            </div>
          </dl>

          <Separator />

          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-cream">
              <StoreIcon className="size-4 text-gold" aria-hidden />
              {isShipped ? "Alamat Pengiriman" : "Pengambilan Barang"}
            </h2>

            <div className="mt-2">
              {isShipped ? (
                <ShippingAddressDetails address={order.shippingAddress} />
              ) : pickupPeriods.length > 0 ? (
                <PeriodPickupDetails
                  periods={pickupPeriods}
                  orderNumber={order.orderNumber}
                />
              ) : (
                pickup && (
                  <PickupDetails pickup={pickup} orderNumber={order.orderNumber} />
                )
              )}
            </div>
          </div>

          {order.payment && (
            <>
              <Separator />
              <dl className="space-y-1.5 text-xs text-cream-muted">
                <div className="flex items-center justify-between">
                  <dt>Dibuat</dt>
                  <dd>{formatDateTime(order.createdAt)}</dd>
                </div>
                {order.payment.paidAt && (
                  <div className="flex items-center justify-between">
                    <dt>Dibayar</dt>
                    <dd>{formatDateTime(order.payment.paidAt)}</dd>
                  </div>
                )}
                {order.payment.expiresAt && isPending && (
                  <div className="flex items-center justify-between">
                    <dt>Batas bayar</dt>
                    <dd>{formatDateTime(order.payment.expiresAt)}</dd>
                  </div>
                )}
                {order.payment.reference && (
                  <div className="flex items-center justify-between">
                    <dt>Referensi Duitku</dt>
                    <dd className="font-mono">{order.payment.reference}</dd>
                  </div>
                )}
              </dl>
            </>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {canRetryPayment && order.payment?.paymentUrl && (
              <Button
                className="bg-gold text-obsidian hover:bg-gold-light"
                nativeButton={false}
                render={<a href={order.payment.paymentUrl} rel="noreferrer" />}
              >
                <CreditCardIcon aria-hidden />
                Lanjutkan Pembayaran
              </Button>
            )}
            {canRetryPayment && (
              <RegeneratePaymentButton orderNumber={order.orderNumber} />
            )}

            <Button
              variant={canRetryPayment ? "outline" : "default"}
              className={canRetryPayment ? undefined : "bg-gold text-obsidian hover:bg-gold-light"}
              nativeButton={false}
              render={<Link href={`/pesanan/${order.orderNumber}`} />}
            >
              Lihat Detail Pesanan
              <ArrowRightIcon aria-hidden />
            </Button>

            <Button variant="ghost" nativeButton={false} render={<Link href="/produk" />}>
              Belanja Lagi
            </Button>
          </div>
        </CardContent>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex justify-center">
        <SecondaryBrandLogo className="w-44 sm:w-52" />
      </div>
      {children}
    </div>
  );
}
