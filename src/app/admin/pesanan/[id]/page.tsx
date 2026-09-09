import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  BadgeCheckIcon,
  CalendarClockIcon,
  CreditCardIcon,
  HistoryIcon,
  MapPinIcon,
  UserRoundIcon,
} from "lucide-react";

import { ensurePageCapability } from "@/components/admin/guard";
import {
  PeriodPickupDetails,
  PickupDetails,
  ShippingAddressDetails,
  type PeriodPickupInfo,
} from "@/components/orders/order-pickup";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { isDuitkuConfigured } from "@/lib/duitku";
import { formatDate, formatDateTime, formatRupiah } from "@/lib/format";
import { processPaidOrdersForClosedPeriods } from "@/lib/order-processing";
import { prisma } from "@/lib/prisma";
import { getPickupInfo } from "@/lib/settings";

import { formatPaymentMethod } from "../schemas";
import { PaymentStatusBadge } from "../status-badge";
import { OrderActionsPanel } from "./order-actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { orderNumber: true },
  });

  return { title: order ? `Pesanan ${order.orderNumber}` : "Pesanan" };
}

/** Baris label/nilai pada kartu informasi. */
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs text-cream-muted sm:text-sm">{label}</dt>
      <dd className="text-sm break-words text-cream">{children}</dd>
    </div>
  );
}

const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  MAHASISWA: "Mahasiswa",
  ALUMNI: "Alumni",
};

const FULFILLMENT_LABEL: Record<string, string> = {
  PICKUP: "Ambil di kampus",
  SHIPPED: "Kirim ke alamat",
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Otorisasi diulang di page: layout dan page dirender bersamaan, jadi
  // `redirect()` di layout saja tidak mencegah query di bawah ini berjalan.
  await ensurePageCapability("MANAGE_ORDERS", "/admin/pesanan");

  try {
    await processPaidOrdersForClosedPeriods();
  } catch (error) {
    console.error("[admin/pesanan/detail] gagal memproses periode yang ditutup:", error);
  }

  const { id } = await params;

  const [order, pickup] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
        payment: true,
        items: {
          orderBy: { productName: "asc" },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                unit: true,
                images: {
                  select: { url: true, isPrimary: true, sortOrder: true },
                  orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
                  take: 1,
                },
              },
            },
            preOrderItem: {
              select: {
                id: true,
                price: true,
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
                    status: true,
                  },
                },
              },
            },
            variantQuota: {
              select: {
                id: true,
                variant: {
                  select: { id: true, name: true, imageUrl: true },
                },
              },
            },
          },
        },
      },
    }),
    getPickupInfo(),
  ]);

  if (!order) notFound();

  const { payment } = order;

  // Timeline dirangkai dari cap waktu yang memang tersimpan — tidak ada tabel
  // riwayat terpisah, jadi urutannya disusun ulang di sini.
  const timeline = [
    { at: order.createdAt, label: "Pesanan dibuat", detail: `Nomor ${order.orderNumber}` },
    payment
      ? {
          at: payment.createdAt,
          label: "Tagihan pembayaran dibuat",
          detail: `${payment.provider}${payment.reference ? ` · ${payment.reference}` : ""}`,
        }
      : null,
    payment?.expiresAt
      ? {
          at: payment.expiresAt,
          label: "Batas waktu pembayaran",
          detail:
            payment.status !== "PENDING"
              ? "Tidak berlaku lagi"
              : payment.expiresAt < new Date()
                ? "Terlewati tanpa pembayaran"
                : "Menunggu pembayaran",
        }
      : null,
    payment?.paidAt
      ? {
          at: payment.paidAt,
          label: "Pembayaran diterima",
          detail: formatRupiah(payment.amount),
        }
      : null,
    order.stockReleasedAt
      ? {
          at: order.stockReleasedAt,
          label: "Kuota dikembalikan",
          detail: "Jatah pesanan ini bisa dipesan pelanggan lain lagi",
        }
      : null,
  ]
    .filter((event): event is { at: Date; label: string; detail: string } => event !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const pickupPeriods: PeriodPickupInfo[] = [
    ...new Map(
      order.items
        .filter((item) => item.preOrderItem?.period)
        .map((item) => [
          item.preOrderItem!.period.id,
          {
            id: item.preOrderItem!.period.id,
            name: item.preOrderItem!.period.name,
            estimatedPickupAt: item.preOrderItem!.period.estimatedPickupAt,
            pickupLocation: item.preOrderItem!.period.pickupLocation,
            pickupSchedule: item.preOrderItem!.period.pickupSchedule,
            pickupNote: item.preOrderItem!.period.pickupNote,
            shippingNote: item.preOrderItem!.period.shippingNote,
          } satisfies PeriodPickupInfo,
        ]),
    ).values(),
  ];

  const isShipped = order.fulfillmentType === "SHIPPED";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/pesanan"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-cream-muted transition-colors hover:text-gold"
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
          Kembali ke daftar pesanan
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-cream">{order.orderNumber}</h1>
          <OrderStatusBadge status={order.status} variant="admin" />
          <PaymentStatusBadge status={payment?.status ?? null} />
        </div>

        <p className="text-sm text-cream-muted">
          Dibuat {formatDateTime(order.createdAt)} · Terakhir diperbarui{" "}
          {formatDateTime(order.updatedAt)}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------ kolom kiri */}
        <div className="flex flex-col gap-5">
          {/* Item pesanan */}
          <Card className="py-0">
            <CardHeader className="border-b py-4">
              <CardTitle>Item Pesanan</CardTitle>
              <CardDescription>{order.items.length} baris produk</CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <ul className="divide-y divide-white/10">
                {order.items.map((item) => {
                  const variantImage = item.variantQuota?.variant.imageUrl?.trim() || null;
                  const productImage = item.product?.images[0]?.url?.trim() || null;
                  const imageUrl = variantImage || productImage;
                  const period = item.preOrderItem?.period ?? null;
                  return (
                    <li key={item.id} className="flex flex-col gap-2 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          {imageUrl ? (
                            <span className="relative block size-14 shrink-0 overflow-hidden rounded-lg bg-raise ring-1 ring-white/10">
                              <Image
                                src={imageUrl}
                                alt={item.variantName || item.productName}
                                fill
                                unoptimized
                                sizes="56px"
                                className="object-cover"
                              />
                            </span>
                          ) : null}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {item.product ? (
                                <Link
                                  href={`/produk/${item.product.slug}`}
                                  className="font-medium text-cream underline-offset-4 hover:text-gold hover:underline"
                                >
                                  {item.productName}
                                </Link>
                              ) : (
                                <span className="font-medium text-cream">{item.productName}</span>
                              )}
                            </div>

                            {item.variantName ? (
                              <p className="mt-1 inline-flex items-center rounded-full bg-raise px-2 py-0.5 text-xs font-medium text-[#D8D3C7] ring-1 ring-inset ring-white/10">
                                Varian: {item.variantName}
                              </p>
                            ) : null}

                            <p className="mt-0.5 text-sm text-cream-muted">
                              {formatRupiah(item.productPrice)} × {item.quantity}
                              {item.product?.unit ? ` ${item.product.unit}` : ""}
                            </p>

                            {/* Periode asal baris ini, agar pengurus tahu batch mana
                                yang harus disiapkan. */}
                            {period ? (
                              <div className="mt-1 text-xs text-violet-700">
                                <p>
                                  Periode:{" "}
                                  <Link
                                    href={`/admin/pre-order/${period.id}`}
                                    className="font-medium underline underline-offset-4"
                                  >
                                    {period.name}
                                  </Link>{" "}
                                  · ditutup {formatDate(period.endAt)}
                                </p>
                                {period.shippingNote?.trim() ? (
                                  <p className="mt-0.5 text-cream-muted">
                                    Info kirim batch ini: {period.shippingNote}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <p className="mt-1 text-xs text-cream-muted">
                                Baris kuota asalnya sudah tidak ada.
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="font-medium tabular-nums text-cream">
                          {formatRupiah(item.subtotal)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-col gap-2 border-t border-white/10 bg-obsidian p-4">
                <div className="flex justify-between text-sm text-cream-muted">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatRupiah(order.subtotal)}</span>
                </div>
                {/* Ongkir SHIPPED dibayar manual via WA admin dan tidak masuk
                    total gateway, jadi shippingCost selalu 0. */}
                {order.shippingCost > 0 ? (
                  <div className="flex justify-between text-sm text-cream-muted">
                    <span>Ongkos kirim</span>
                    <span className="tabular-nums">{formatRupiah(order.shippingCost)}</span>
                  </div>
                ) : null}
                <Separator />
                <div className="flex justify-between text-base font-semibold text-cream">
                  <span>Total</span>
                  <span className="tabular-nums">{formatRupiah(order.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pembayaran */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <CreditCardIcon className="size-4 text-cream-muted" aria-hidden />
                Informasi Pembayaran
              </CardTitle>
              <CardDescription>
                Data dari integrasi Duitku.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {payment ? (
                <div className="space-y-4">
                  <dl className="grid gap-3">
                    <Row label="Penyedia">{payment.provider}</Row>
                    <Row label="Metode">{formatPaymentMethod(payment.method)}</Row>
                    <Row label="Status">
                      <PaymentStatusBadge status={payment.status} />
                    </Row>
                    <Row label="Jumlah tagihan">
                      <span className="tabular-nums">{formatRupiah(payment.amount)}</span>
                    </Row>
                    <Row label="Merchant Order ID">
                      <code className="rounded bg-raise px-1.5 py-0.5 text-xs">
                        {payment.merchantOrderId}
                      </code>
                    </Row>
                    <Row label="Reference">
                      {payment.reference ? (
                        <code className="rounded bg-raise px-1.5 py-0.5 text-xs">
                          {payment.reference}
                        </code>
                      ) : (
                        <span className="text-cream-muted">Belum ada</span>
                      )}
                    </Row>
                    <Row label="Waktu bayar">
                      {payment.paidAt ? (
                        formatDateTime(payment.paidAt)
                      ) : (
                        <span className="text-cream-muted">Belum dibayar</span>
                      )}
                    </Row>
                    <Row label="Kedaluwarsa">
                      {payment.expiresAt ? (
                        formatDateTime(payment.expiresAt)
                      ) : (
                        <span className="text-cream-muted">Tidak dibatasi</span>
                      )}
                    </Row>
                    {payment.manualConfirmedAt ? (
                      <>
                        <Row label="Dikonfirmasi manual">
                          {formatDateTime(payment.manualConfirmedAt)}
                        </Row>
                        <Row label="Dikonfirmasi oleh">
                          {payment.manualConfirmedBy || "Admin"}
                        </Row>
                        {payment.manualNote ? (
                          <Row label="Catatan konfirmasi">
                            <span className="whitespace-pre-line">
                              {payment.manualNote}
                            </span>
                          </Row>
                        ) : null}
                      </>
                    ) : null}
                    {payment.paymentUrl ? (
                      <Row label="Halaman bayar">
                        <a
                          href={payment.paymentUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-gold underline underline-offset-4"
                        >
                          Buka halaman checkout Duitku
                        </a>
                      </Row>
                    ) : null}
                  </dl>
                </div>
              ) : (
                <p className="text-sm text-cream-muted">
                  Pesanan ini belum memiliki data pembayaran. Kemungkinan tagihan Duitku gagal
                  dibuat saat checkout.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <HistoryIcon className="size-4 text-cream-muted" aria-hidden />
                Riwayat Pesanan
              </CardTitle>
            </CardHeader>

            <CardContent>
              <ol className="flex flex-col gap-4">
                {timeline.map((event, index) => (
                  <li key={`${event.label}-${index}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        aria-hidden
                        className="mt-1 size-2.5 shrink-0 rounded-full bg-gold ring-4 ring-gold/20"
                      />
                      {index < timeline.length - 1 ? (
                        <span aria-hidden className="mt-1 w-px flex-1 bg-[#2A2A2A]" />
                      ) : null}
                    </div>
                    <div className="pb-1">
                      <p className="text-sm font-medium text-cream">{event.label}</p>
                      <p className="text-xs text-cream-muted">
                        {formatDateTime(event.at)}
                        {event.detail ? ` · ${event.detail}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* ----------------------------------------------- kolom kanan */}
        <div className="flex flex-col gap-5">
          <OrderActionsPanel
            orderId={order.id}
            orderNumber={order.orderNumber}
            status={order.status}
            total={order.total}
            hasPayment={Boolean(payment)}
            duitkuConfigured={isDuitkuConfigured()}
          />

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <UserRoundIcon className="size-4 text-cream-muted" aria-hidden />
                Pemesan
              </CardTitle>
              <CardDescription>
                Cocokkan identitas dengan data di bawah saat menyerahkan barang.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3">
                <Row label="Nama">{order.customerName}</Row>
                <Row label="Status">
                  {CUSTOMER_TYPE_LABEL[order.customerType] ?? order.customerType}
                </Row>
                <Row label="Angkatan">
                  {order.customerBatch?.trim() || (
                    <span className="text-cream-muted">Tidak diisi</span>
                  )}
                </Row>
                <Row label="Jurusan">
                  {order.customerProgram?.trim() || (
                    <span className="text-cream-muted">Tidak diisi</span>
                  )}
                </Row>
                <Row label="Email">{order.customerEmail}</Row>
                <Row label="Telepon">{order.customerPhone}</Row>
                <Row label="Akun">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <BadgeCheckIcon className="size-3.5 text-emerald-600" aria-hidden />
                    {order.user.email}
                  </span>
                </Row>
                <Row label="Terdaftar sejak">{formatDate(order.user.createdAt)}</Row>
                <Row label="Cara terima">
                  {FULFILLMENT_LABEL[order.fulfillmentType] ?? order.fulfillmentType}
                </Row>
                <Row label="Syarat transaksi">
                  {order.termsAcceptedAt && order.termsVersion ? (
                    <span>
                      Disetujui {formatDateTime(order.termsAcceptedAt)}
                      <span className="block text-xs text-cream-muted">
                        Versi {order.termsVersion}
                      </span>
                    </span>
                  ) : (
                    <span className="text-cream-muted">
                      Tidak tercatat (pesanan lama)
                    </span>
                  )}
                </Row>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <MapPinIcon className="size-4 text-cream-muted" aria-hidden />
                {isShipped ? "Pengiriman Barang" : "Pengambilan Barang"}
              </CardTitle>
              <CardDescription>
                {isShipped
                  ? "Barang dikirim ke alamat berikut. Ongkir manual via WhatsApp."
                  : "Info yang dilihat pelanggan di halaman pesanannya."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3">
                <Row label="Cara terima">
                  {FULFILLMENT_LABEL[order.fulfillmentType] ?? order.fulfillmentType}
                </Row>
              </dl>

              {isShipped ? (
                <ShippingAddressDetails address={order.shippingAddress} />
              ) : null}

              {pickupPeriods.length > 0 ? (
                <PeriodPickupDetails
                  periods={pickupPeriods}
                  orderNumber={order.orderNumber}
                />
              ) : !isShipped ? (
                <PickupDetails pickup={pickup} orderNumber={order.orderNumber} />
              ) : null}

              {order.note ? (
                <>
                  <Separator className="my-3" />
                  <p className="text-xs text-cream-muted">Catatan pelanggan</p>
                  <p className="mt-0.5 text-sm whitespace-pre-line text-cream">{order.note}</p>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <CalendarClockIcon className="size-4 text-violet-500" aria-hidden />
                Catatan Pre-Order
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-cream-muted">
                Jadwal di atas adalah estimasi per periode. Beri tahu pelanggan bila
                kedatangan barang berubah, dan biarkan status pada{" "}
                <strong>Diproses</strong> sampai barang benar-benar diambil atau dikirim.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
