import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  InfoIcon,
  MapPinIcon,
  PackageIcon,
  StoreIcon,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Countdown } from "@/components/storefront/countdown";
import { PreOrderProductCard } from "@/components/storefront/preorder-product-card";
import { SectionHeading } from "@/components/storefront/section-heading";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDate, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const period = await prisma.preOrderPeriod.findUnique({
    where: { slug },
    select: { name: true, description: true },
  });

  return {
    title: period?.name ?? "Periode Pre-Order",
    description:
      period?.description ??
      "Daftar produk, kuota, jadwal, dan informasi pengambilan periode pre-order.",
  };
}

export default async function PreOrderPeriodDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const now = new Date();

  const period = await prisma.preOrderPeriod.findUnique({
    where: { slug },
    include: {
      items: {
        where: { product: { isActive: true } },
        orderBy: { createdAt: "asc" },
        include: {
          product: {
            include: {
              images: { orderBy: { sortOrder: "asc" } },
              categories: {
                orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
              },
              variants: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          variantQuotas: {
            include: { variant: true },
          },
        },
      },
    },
  });

  // Draf, periode yang ditutup manual, dan periode kedaluwarsa tidak menjadi
  // halaman publik. Card di /pre-order memakai aturan yang sama.
  if (!period || period.status !== "ACTIVE" || period.endAt < now) {
    notFound();
  }

  const isOpen = period.startAt <= now;
  const quotas = period.items.flatMap((item) => item.variantQuotas);
  const totalQuota = quotas.reduce((sum, row) => sum + row.quota, 0);
  const totalReserved = quotas.reduce(
    (sum, row) => sum + Math.min(row.reserved, row.quota),
    0,
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <Link
        href="/pre-order"
        className="inline-flex items-center gap-1.5 text-sm text-cream-muted transition-colors hover:text-gold-light"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        Kembali ke semua periode
      </Link>

      <article className="mt-5 overflow-hidden rounded-3xl border border-gold/30 bg-gold/5">
        <header className="space-y-5 border-b border-gold/30 bg-coal p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <span
                className={
                  isOpen
                    ? "inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300"
                    : "inline-flex rounded-full bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold"
                }
              >
                {isOpen ? "Sedang menerima pesanan" : "Segera dibuka"}
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-cream sm:text-3xl">
                {period.name}
              </h1>
              {period.description ? (
                <p className="mt-2 text-sm leading-relaxed text-cream-muted sm:text-base">
                  {period.description}
                </p>
              ) : null}
            </div>

            {isOpen ? (
              <div className="rounded-xl border border-gold/30 bg-gold/10 p-3">
                <p className="mb-1 text-xs font-medium text-gold-light">
                  Sisa waktu pemesanan
                </p>
                <Countdown
                  endAt={period.endAt.toISOString()}
                  tone="light"
                  finishedLabel="Periode ditutup"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-gold/20 bg-gold/10 p-3 text-gold-light">
                <p className="text-xs">Pemesanan dibuka</p>
                <p className="mt-0.5 text-sm font-semibold">
                  {formatDateTime(period.startAt)}
                </p>
              </div>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-obsidian p-3">
              <dt className="text-xs text-cream-muted">Mulai</dt>
              <dd className="mt-0.5 text-sm font-medium text-cream">
                {formatDateTime(period.startAt)}
              </dd>
            </div>
            <div className="rounded-xl bg-obsidian p-3">
              <dt className="text-xs text-cream-muted">Berakhir</dt>
              <dd className="mt-0.5 text-sm font-medium text-cream">
                {formatDateTime(period.endAt)}
              </dd>
            </div>
            <div className="rounded-xl bg-obsidian p-3">
              <dt className="text-xs text-cream-muted">Produk</dt>
              <dd className="mt-0.5 text-sm font-medium text-cream">
                {period.items.length}
              </dd>
            </div>
            <div className="rounded-xl bg-obsidian p-3">
              <dt className="text-xs text-cream-muted">Sisa kuota total</dt>
              <dd className="mt-0.5 text-sm font-medium text-cream">
                {Math.max(0, totalQuota - totalReserved)} dari {totalQuota}
              </dd>
            </div>
          </dl>

          <div className="grid gap-3 rounded-2xl border border-gold/20 bg-gold/10 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <PickupSummary
              icon={CalendarClockIcon}
              label="Estimasi mulai bisa diambil"
              value={formatDateTime(period.estimatedPickupAt)}
            />
            <PickupSummary
              icon={MapPinIcon}
              label="Lokasi pengambilan"
              value={period.pickupLocation}
            />
            <PickupSummary
              icon={StoreIcon}
              label="Jadwal pengambilan"
              value={period.pickupSchedule}
            />
          </div>

          {period.pickupNote.trim() ? (
            <p className="flex items-start gap-2 rounded-xl bg-obsidian p-3 text-xs leading-relaxed text-[#D8D3C7]">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
              {period.pickupNote}
            </p>
          ) : null}
        </header>

        <div className="p-4 sm:p-7">
          {!isOpen ? (
            <Alert className="mb-6 border-gold/30 bg-gold/10">
              <CalendarDaysIcon aria-hidden />
              <AlertTitle className="text-gold-light">
                Periode belum menerima pesanan
              </AlertTitle>
              <AlertDescription className="text-gold-light/90">
                Daftar produk sudah bisa dilihat, tetapi tombol pesan baru aktif pada{" "}
                <strong>{formatDateTime(period.startAt)}</strong>.
              </AlertDescription>
            </Alert>
          ) : null}

          <SectionHeading
            eyebrow="Katalog periode"
            title="Produk dalam Batch Ini"
            description={
              isOpen
                ? "Pesan sekarang selama kuota tiap produk masih tersedia."
                : `Pemesanan akan dibuka ${formatDate(period.startAt)}.`
            }
          />

          {period.items.length === 0 ? (
            <EmptyState
              icon={<PackageIcon />}
              title="Belum ada produk dalam periode ini"
              description="Pengurus masih menyiapkan daftar produk dan kuotanya."
              className="mt-6 bg-coal"
            />
          ) : (
            <ul className="mt-6 flex flex-col gap-3">
              {period.items.map((item) => (
                <li key={item.id}>
                  <PreOrderProductCard
                    product={{
                      ...item.product,
                      preOrderItems: [
                        {
                          id: item.id,
                          price: item.price,
                          period,
                          variantQuotas: item.variantQuotas.map((row) => ({
                            id: row.id,
                            quota: row.quota,
                            reserved: row.reserved,
                            price: row.price,
                            variantId: row.variantId,
                          })),
                        },
                      ],
                    }}
                    now={now}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
    </div>
  );
}

function PickupSummary({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClockIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
      <div>
        <p className="text-xs text-cream-muted">{label}</p>
        <p className="text-sm font-medium text-cream">{value}</p>
      </div>
    </div>
  );
}
