import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CalendarClockIcon,
  ClockIcon,
  MailIcon,
  MapPinIcon,
  PackageIcon,
  PhoneIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StoreIcon,
} from "lucide-react";

import { BannerCarousel } from "@/components/storefront/banner-carousel";
import { HeroEmblem } from "@/components/branding/brand-logos";
import { BatchTimeline } from "@/components/storefront/batch-timeline";
import { Countdown } from "@/components/storefront/countdown";
import { MarqueeStrip } from "@/components/storefront/marquee-strip";
import { PoProgress } from "@/components/storefront/po-progress";
import { ProductGrid } from "@/components/storefront/product-grid";
import { SectionHeading } from "@/components/storefront/section-heading";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  countOrderableProductsByCategory,
  getOpenPeriod,
  openPeriodWhere,
  productWithAvailabilityInclude,
} from "@/lib/preorder";
import { getSettings } from "@/lib/settings";

// Sisa kuota PO dan hitung mundur berubah setiap saat → selalu render ulang.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: {
      absolute: `${settings.store_name} — ${settings.store_tagline}`,
    },
    description: settings.hero_subheading || settings.store_about,
  };
}

export default async function BerandaPage() {
  const now = new Date();

  const [
    settings,
    banners,
    openPeriod,
    categories,
    countByCategory,
    preOrderProducts,
    featured,
    quotaSum,
  ] = await Promise.all([
    getSettings(),
    prisma.banner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        subtitle: true,
        imageUrl: true,
        linkUrl: true,
      },
    }),
    getOpenPeriod(now),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
      },
    }),
    countOrderableProductsByCategory(now),
    prisma.product.findMany({
      where: {
        isActive: true,
        preOrderItems: { some: { period: openPeriodWhere(now) } },
      },
      include: productWithAvailabilityInclude(now),
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      include: productWithAvailabilityInclude(now),
      orderBy: [{ createdAt: "desc" }],
      take: 8,
    }),
    // Total kuota seluruh periode aktif — dipakai panel scarcity di hero.
    prisma.preOrderVariantQuota.aggregate({
      where: { preOrderItem: { period: openPeriodWhere(now) } },
      _sum: { quota: true, reserved: true },
    }),
  ]);

  return (
    <div className="flex flex-col">
      <HeroSection
        heading={settings.hero_heading}
        subheading={settings.hero_subheading}
        period={openPeriod}
        quotaTotal={quotaSum._sum.quota ?? 0}
        quotaReserved={quotaSum._sum.reserved ?? 0}
      />

      {/* Pita campaign berjalan — identitas PO, bukan toko generik. */}
      <MarqueeStrip
        items={[
          "Pre-order berkuota per periode",
          openPeriod
            ? `${openPeriod.name} ditutup ${formatDate(openPeriod.endAt)}`
            : "Periode baru segera dibuka",
          "Pembayaran aman via Duitku",
          "Ambil di kampus atau kirim ke alamat",
        ]}
      />

      {banners.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pt-8 sm:pt-10">
          <BannerCarousel banners={banners} />
        </section>
      )}

      <ValuePropsSection />

      {/* ---------------- Sedang Pre-Order ---------------- */}
      {openPeriod && preOrderProducts.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-12">
          <div className="rounded-3xl border border-gold/30 bg-gold/5 p-5 sm:p-7">
            <SectionHeading
              number="01"
              eyebrow="Sedang berlangsung"
              title="Sedang Pre-Order"
              description={`Periode ${openPeriod.name} — pesan sekarang selagi kuota masih tersedia. Pesanan diproses setelah periode ditutup.`}
              actionHref="/pre-order"
              actionLabel="Detail pre-order"
            />

            <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl bg-coal p-4 ring-1 ring-gold/20">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold"
                >
                  <CalendarClockIcon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-cream">
                    {openPeriod.name}
                  </p>
                  <p className="text-xs text-cream-muted">
                    Ditutup {formatDate(openPeriod.endAt)}
                  </p>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <span className="hidden text-xs font-medium text-cream-muted sm:inline">
                  Sisa waktu
                </span>
                <Countdown
                  endAt={openPeriod.endAt.toISOString()}
                  tone="light"
                  finishedLabel="Periode baru saja ditutup"
                />
              </div>
            </div>

            <ProductGrid products={preOrderProducts} now={now} className="mt-6" />
          </div>
        </section>
      )}

      {/* ---------------- Produk Unggulan ---------------- */}
      {featured.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-12">
          <SectionHeading
            number="02"
            eyebrow="Pilihan kami"
            title="Produk Unggulan"
            description="Merchandise kabinet yang paling banyak dipesan warga PENS."
            actionHref="/produk"
            actionLabel="Lihat semua produk"
          />
          <ProductGrid products={featured} now={now} className="mt-6" />
        </section>
      )}

      {/* ---------------- Kategori ---------------- */}
      {categories.length > 0 && (
        <section className="bg-obsidian py-10 sm:py-14">
          <div className="mx-auto w-full max-w-7xl px-4">
            <SectionHeading
              number="03"
              eyebrow="Jelajahi"
              title="Kategori Produk"
              description="Jelajahi merchandise resmi berdasarkan kategori."
              actionHref="/kategori"
              actionLabel="Semua kategori"
            />

            <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/kategori/${category.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-coal transition-shadow hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-raise">
                      {category.imageUrl ? (
                        <Image
                          src={category.imageUrl}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <span className="grid size-full place-items-center text-gold-light">
                          <PackageIcon className="size-8" aria-hidden />
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <p className="text-sm leading-snug font-medium text-cream group-hover:text-gold">
                        {category.name}
                      </p>
                      <p className="mt-auto text-xs text-cream-muted tabular-nums">
                        {countByCategory.get(category.id) ?? 0} Produk Aktif
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ---------------- Info toko ---------------- */}
      <StoreInfoSection
        storeName={settings.store_name}
        about={settings.store_about}
        address={settings.store_address}
        phone={settings.store_phone}
        email={settings.store_email}
        preorderInfo={settings.preorder_info}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

type HeroPeriod = {
  name: string;
  slug: string;
  startAt: Date;
  endAt: Date;
  estimatedPickupAt: Date;
};

function HeroSection({
  heading,
  subheading,
  period,
  quotaTotal,
  quotaReserved,
}: {
  heading: string;
  subheading: string;
  period: HeroPeriod | null;
  quotaTotal: number;
  quotaReserved: number;
}) {
  return (
    <section className="relative overflow-hidden bg-obsidian">
      {/* Motif batik + cahaya emas */}
      <div
        aria-hidden
        className="bg-batik pointer-events-none absolute inset-0 opacity-70"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/4 h-[480px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-[140px]"
      />
      <div
        aria-hidden
        className="gold-divider absolute inset-x-0 bottom-0 h-px"
      />

      {/* Layout asimetris: identitas di kiri, panel periode PO di kanan —
          pola campaign, bukan hero toko generik yang semuanya di tengah. */}
      <div className="relative mx-auto w-full max-w-7xl px-4 py-12 sm:py-14 lg:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          {/* Kolom kiri — identitas + CTA */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <HeroEmblem
              preload
              className="w-24 drop-shadow-[0_0_36px_rgb(212_163_89/0.35)] sm:w-28"
            />

            <p className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1 text-[11px] font-bold tracking-[0.22em] text-gold uppercase">
              <SparklesIcon className="size-3.5" aria-hidden />
              Pre-order berkuota per periode
            </p>

            <h1 className="font-display mt-4 max-w-2xl text-3xl leading-tight font-extrabold tracking-tight text-cream uppercase sm:text-4xl lg:text-5xl">
              {heading}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-cream-muted sm:text-base">
              {subheading}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link
                href="/produk"
                className="btn-gold-glow inline-flex h-11 items-center gap-2 rounded-xl bg-gold px-6 text-sm font-bold text-obsidian transition-colors hover:bg-gold-light"
              >
                <PackageIcon className="size-4.5" aria-hidden />
                Belanja Sekarang
              </Link>
              <Link
                href="/pre-order"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-gold/50 bg-transparent px-6 text-sm font-bold text-gold transition-colors hover:bg-gold/10"
              >
                <CalendarClockIcon className="size-4.5" aria-hidden />
                Lihat Pre-Order
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </div>
          </div>

          {/* Kolom kanan — panel periode aktif (emblem besar bila tidak ada PO) */}
          {period ? (
            <div className="w-full rounded-3xl border border-gold/30 bg-coal/80 p-5 backdrop-blur-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold tracking-[0.22em] text-gold uppercase">
                  Periode pre-order dibuka
                </p>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold tracking-widest text-emerald-300 uppercase">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Live
                </span>
              </div>

              <p className="font-display mt-2 text-2xl font-extrabold tracking-tight text-cream uppercase sm:text-3xl">
                {period.name}
              </p>
              <p className="mt-1 text-sm text-cream-muted">
                Pemesanan ditutup {formatDate(period.endAt)}
              </p>

              <Countdown
                endAt={period.endAt.toISOString()}
                variant="display"
                className="mt-5"
              />

              <div className="mt-5 border-t border-white/10 pt-5">
                <BatchTimeline
                  startAt={period.startAt}
                  endAt={period.endAt}
                  estimatedPickupAt={period.estimatedPickupAt}
                />
              </div>

              {quotaTotal > 0 && (
                <PoProgress
                  quota={quotaTotal}
                  reserved={quotaReserved}
                  unit="kuota"
                  className="mt-5"
                />
              )}

              <Link
                href={`/pre-order/${period.slug}`}
                className="btn-gold-glow mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 text-sm font-bold text-obsidian transition-colors hover:bg-gold-light"
              >
                Lihat produk pre-order
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </div>
          ) : (
            <div className="hidden lg:flex lg:justify-center">
              <HeroEmblem className="w-56 drop-shadow-[0_0_48px_rgb(212_163_89/0.4)]" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const VALUE_PROPS = [
  {
    icon: BadgeCheckIcon,
    title: "Produk Original",
    description: "Merchandise resmi PENS, diproduksi per batch pre-order.",
  },
  {
    icon: CalendarClockIcon,
    title: "Pre-Order Terjadwal",
    description: "Kuota per periode, tertutup otomatis saat periode berakhir.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Pembayaran Aman",
    description: "Transfer bank, virtual account, QRIS, dan e-wallet melalui Duitku.",
  },
  {
    icon: StoreIcon,
    title: "Ambil / Kirim Fleksibel",
    description: "Ambil di kampus atau kirim ke alamat (ongkir manual via WhatsApp admin).",
  },
] as const;

function ValuePropsSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-10 sm:pt-12">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {VALUE_PROPS.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.title}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-coal p-4"
            >
              <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold"
              >
                <Icon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-cream">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-cream-muted">
                  {item.description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StoreInfoSection({
  storeName,
  about,
  address,
  phone,
  email,
  preorderInfo,
}: {
  storeName: string;
  about: string;
  address: string;
  phone: string;
  email: string;
  preorderInfo: string;
}) {
  const contacts = [
    address && { icon: MapPinIcon, label: "Alamat", value: address, href: null },
    phone && {
      icon: PhoneIcon,
      label: "Telepon",
      value: phone,
      href: `tel:${phone.replace(/[^0-9+]/g, "")}`,
    },
    email && { icon: MailIcon, label: "Email", value: email, href: `mailto:${email}` },
    {
      icon: ClockIcon,
      label: "Jam operasional",
      value: "Senin – Sabtu, 08.00 – 17.00 WIB",
      href: null,
    },
  ].filter(Boolean) as {
    icon: typeof MapPinIcon;
    label: string;
    value: string;
    href: string | null;
  }[];

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:py-16">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-coal p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight text-cream sm:text-2xl">
            Tentang {storeName}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-cream-muted">{about}</p>

          <div className="mt-6 rounded-2xl border border-gold/30 bg-gold/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-gold-light">
              <CalendarClockIcon className="size-4" aria-hidden />
              Cara kerja pre-order
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-gold-light/80">
              {preorderInfo}
            </p>
            <Link
              href="/pre-order"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gold underline-offset-4 hover:underline"
            >
              Selengkapnya tentang pre-order
              <ArrowRightIcon className="size-4" aria-hidden />
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-obsidian p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight text-cream sm:text-2xl">
            Informasi Toko
          </h2>
          <ul className="mt-4 flex flex-col gap-4">
            {contacts.map((contact) => {
              const Icon = contact.icon;
              return (
                <li key={contact.label} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-coal text-gold ring-1 ring-white/10"
                  >
                    <Icon className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-cream-muted">
                      {contact.label}
                    </p>
                    {contact.href ? (
                      <a
                        href={contact.href}
                        className="text-sm text-cream-soft hover:text-gold hover:underline"
                      >
                        {contact.value}
                      </a>
                    ) : (
                      <p className="text-sm text-cream-soft">{contact.value}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
