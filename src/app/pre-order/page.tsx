import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  MapPinIcon,
  PackageCheckIcon,
  PackageIcon,
  ShoppingCartIcon,
  TimerResetIcon,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { BatchTimeline } from "@/components/storefront/batch-timeline";
import { Countdown } from "@/components/storefront/countdown";
import { SectionHeading } from "@/components/storefront/section-heading";
import { formatDate, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

// Waktu, status, dan sisa kuota periode berubah setiap saat.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pre-Order",
  description:
    "Periode pre-order merchandise yang sedang dibuka atau sudah dijadwalkan.",
};

const STEPS = [
  {
    icon: CalendarDaysIcon,
    title: "1. Pilih periode",
    description:
      "Buka card periode untuk melihat produk, kuota, jadwal penutupan, dan estimasi pengambilan batch tersebut.",
  },
  {
    icon: ShoppingCartIcon,
    title: "2. Pesan selagi kuota ada",
    description:
      "Tambahkan produk ke keranjang lalu checkout. Kuota langsung dipotong saat pesanan dibuat.",
  },
  {
    icon: CreditCardIcon,
    title: "3. Bayar sebelum 60 menit",
    description:
      "Selesaikan pembayaran melalui Duitku (QRIS / VA / e-wallet). Tagihan yang tidak dibayar dalam 60 menit kedaluwarsa otomatis.",
  },
  {
    icon: PackageCheckIcon,
    title: "4. Ambil / terima barang",
    description:
      "Setelah batch tiba, ambil barang di lokasi dan jadwal yang tercantum — atau tunggu paket dikirim (ongkir via WhatsApp admin).",
  },
] as const;

export default async function PreOrderPage() {
  const now = new Date();

  const [settings, periods] = await Promise.all([
    getSettings(),
    prisma.preOrderPeriod.findMany({
      // Status ACTIVE yang tanggal akhirnya belum lewat: mencakup periode
      // yang sedang terbuka dan periode mendatang yang sudah dijadwalkan.
      where: { status: "ACTIVE", endAt: { gte: now } },
      orderBy: [{ startAt: "asc" }, { endAt: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        startAt: true,
        endAt: true,
        estimatedPickupAt: true,
        pickupLocation: true,
        items: {
          where: { product: { isActive: true } },
          select: {
            productId: true,
            variantQuotas: { select: { quota: true, reserved: true } },
          },
        },
      },
    }),
  ]);

  const openPeriod = periods.find(
    (period) => period.startAt <= now && period.endAt >= now,
  );
  const openCount = periods.filter(
    (period) => period.startAt <= now && period.endAt >= now,
  ).length;

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden bg-obsidian">
        {/* Konsisten dengan hero beranda: batik redup + cahaya emas. */}
        <div
          aria-hidden
          className="bg-batik pointer-events-none absolute inset-0 opacity-70"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 h-[360px] w-[520px] translate-x-1/4 -translate-y-1/3 rounded-full bg-gold/10 blur-[120px]"
        />
        <div
          aria-hidden
          className="gold-divider absolute inset-x-0 bottom-0 h-px"
        />

        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-12 sm:py-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1 text-[11px] font-bold tracking-[0.22em] text-gold uppercase">
              <CalendarClockIcon className="size-3.5" aria-hidden />
              Sistem pre-order berkuota
            </span>
            <h1 className="font-display mt-4 max-w-3xl text-3xl leading-tight font-extrabold tracking-tight text-cream uppercase sm:text-4xl lg:text-5xl">
              Pilih Periode Pre-Order
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-cream-muted sm:text-base">
              {settings.preorder_info}
            </p>
            {openCount > 0 ? (
              <p className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                {openCount} periode sedang menerima pesanan
              </p>
            ) : null}
          </div>

          {openPeriod ? (
            <div className="w-full rounded-3xl border border-gold/30 bg-coal/80 p-5 backdrop-blur-sm sm:p-6">
              <p className="text-[11px] font-bold tracking-[0.22em] text-gold uppercase">
                Sedang dibuka
              </p>
              <p className="font-display mt-2 text-xl font-extrabold tracking-tight text-cream uppercase sm:text-2xl">
                {openPeriod.name}
              </p>
              <Countdown
                endAt={openPeriod.endAt.toISOString()}
                variant="display"
                className="mt-4"
                finishedLabel="Periode baru saja ditutup"
              />
              <div className="mt-4 border-t border-white/10 pt-4">
                <BatchTimeline
                  startAt={openPeriod.startAt}
                  endAt={openPeriod.endAt}
                  estimatedPickupAt={openPeriod.estimatedPickupAt}
                  now={now}
                />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-12">
        <SectionHeading
          number="01"
          eyebrow="Alur"
          title="Cara Kerja Pre-Order"
          description="Pilih batch terlebih dahulu, lalu lihat produk yang tersedia di dalamnya."
        />

        <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-coal p-4"
              >
                <span
                  aria-hidden
                  className="grid size-10 place-items-center rounded-xl bg-gold/10 text-gold"
                >
                  <Icon className="size-5" />
                </span>
                <p className="text-sm font-semibold text-cream">{step.title}</p>
                <p className="text-xs leading-relaxed text-cream-muted">
                  {step.description}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-gold/20 bg-gold/10 p-4">
          <TimerResetIcon className="mt-0.5 size-4.5 shrink-0 text-gold" aria-hidden />
          <p className="text-sm leading-relaxed text-gold-light">
            <span className="font-semibold">Penutupan otomatis.</span> Periode
            berhenti menerima pesanan begitu melewati tanggal berakhir. Pesanan
            lunas otomatis masuk ke status Diproses setelah seluruh periodenya
            ditutup.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-12 sm:pb-16">
        <SectionHeading
          number="02"
          eyebrow="Periode"
          title="Pre-Order Aktif dan Terjadwal"
          description="Klik salah satu card untuk membuka halaman periode dan melihat daftar produknya."
        />

        {periods.length === 0 ? (
          <EmptyState
            icon={<CalendarClockIcon />}
            title="Belum ada periode pre-order aktif"
            description="Saat ini belum ada batch yang sedang dibuka atau dijadwalkan. Cek lagi nanti ya."
            className="mt-6"
            action={
              <Link
                href="/produk"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-obsidian transition-colors hover:bg-gold-light"
              >
                <PackageIcon className="size-4" aria-hidden />
                Lihat katalog produk
              </Link>
            }
          />
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {periods.map((period) => {
              const isOpen = period.startAt <= now && period.endAt >= now;
              const quotas = period.items.flatMap((item) => item.variantQuotas);
              const totalQuota = quotas.reduce((sum, row) => sum + row.quota, 0);
              const totalReserved = quotas.reduce(
                (sum, row) => sum + Math.min(row.reserved, row.quota),
                0,
              );
              const remaining = Math.max(0, totalQuota - totalReserved);
              const usage =
                totalQuota > 0
                  ? Math.min(100, Math.round((totalReserved / totalQuota) * 100))
                  : 0;

              return (
                <Link
                  key={period.id}
                  href={`/pre-order/${period.slug}`}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-coal transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span
                          className={
                            isOpen
                              ? "inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300"
                              : "inline-flex rounded-full bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold"
                          }
                        >
                          {isOpen ? "Sedang dibuka" : "Segera dibuka"}
                        </span>
                        <h2 className="mt-2 text-lg font-semibold text-cream transition-colors group-hover:text-gold-light">
                          {period.name}
                        </h2>
                      </div>
                      <span
                        aria-hidden
                        className="grid size-10 shrink-0 place-items-center rounded-full bg-gold/10 text-gold transition-transform group-hover:translate-x-1"
                      >
                        <ArrowRightIcon className="size-5" />
                      </span>
                    </div>

                    {period.description ? (
                      <p className="line-clamp-3 text-sm leading-relaxed text-cream-muted">
                        {period.description}
                      </p>
                    ) : null}

                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-obsidian p-3">
                        <dt className="text-xs text-cream-muted">
                          {isOpen ? "Berakhir" : "Mulai"}
                        </dt>
                        <dd className="mt-0.5 font-medium text-cream">
                          {formatDateTime(isOpen ? period.endAt : period.startAt)}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-obsidian p-3">
                        <dt className="text-xs text-cream-muted">Produk</dt>
                        <dd className="mt-0.5 font-medium text-cream">
                          {period.items.length} produk
                        </dd>
                      </div>
                    </dl>

                    {isOpen ? (
                      <div className="rounded-xl border border-gold/20 bg-gold/10 p-3">
                        <p className="text-xs font-medium text-gold-light">
                          Sisa waktu pemesanan
                        </p>
                        <Countdown
                          endAt={period.endAt.toISOString()}
                          variant="inline"
                          className="mt-1 w-fit rounded-lg bg-coal px-2.5 py-1.5 text-xs text-gold ring-1 ring-gold/30"
                          finishedLabel="Periode ditutup"
                        />
                      </div>
                    ) : (
                      <p className="flex items-center gap-2 rounded-xl border border-gold/20 bg-gold/10 p-3 text-sm text-gold-light">
                        <CalendarDaysIcon className="size-4 shrink-0" aria-hidden />
                        Dibuka {formatDate(period.startAt)}
                      </p>
                    )}

                    <div>
                      <div className="flex items-center justify-between text-xs text-cream-muted">
                        <span>Sisa kuota total</span>
                        <span className="font-medium text-[#D8D3C7]">
                          {remaining} dari {totalQuota}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-raise">
                        <div
                          className="h-full rounded-full bg-gold"
                          style={{ width: `${usage}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-auto space-y-2 border-t border-white/5 pt-4 text-xs text-cream-muted">
                      <p className="flex items-start gap-2">
                        <CalendarClockIcon
                          className="mt-0.5 size-3.5 shrink-0 text-gold"
                          aria-hidden
                        />
                        Estimasi bisa diambil {formatDate(period.estimatedPickupAt)}
                      </p>
                      <p className="flex items-start gap-2">
                        <MapPinIcon
                          className="mt-0.5 size-3.5 shrink-0 text-gold"
                          aria-hidden
                        />
                        <span className="line-clamp-2">{period.pickupLocation}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 bg-obsidian px-5 py-3 text-sm font-semibold text-[#D8D3C7] group-hover:text-gold-light sm:px-6">
                    <span>Buka periode</span>
                    <ArrowRightIcon className="size-4" aria-hidden />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
