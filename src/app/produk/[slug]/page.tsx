import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheckIcon,
  BoxIcon,
  CalendarClockIcon,
  InfoIcon,
  ShieldCheckIcon,
  StoreIcon,
} from "lucide-react";

import { Countdown } from "@/components/storefront/countdown";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductGrid } from "@/components/storefront/product-grid";
import { SectionHeading } from "@/components/storefront/section-heading";
import {
  VariantPicker,
  type VariantOption,
} from "@/components/storefront/variant-picker";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  productWithAvailabilityInclude,
  resolveVariantAvailability,
} from "@/lib/preorder";

// Sisa kuota PO berubah setiap saat.
export const dynamic = "force-dynamic";

/**
 * Dibungkus `cache()` supaya `generateMetadata` dan komponen halaman berbagi
 * satu query yang sama dalam satu request.
 */
const getProduct = cache(async (slug: string) => {
  return prisma.product.findUnique({
    where: { slug },
    include: productWithAvailabilityInclude(new Date()),
  });
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product || !product.isActive) {
    return { title: "Produk tidak ditemukan" };
  }

  const description =
    product.description?.slice(0, 160) ??
    `${product.name} tersedia di Merch PENS.`;
  const image = product.images[0]?.url;

  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

export default async function DetailProdukPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const now = new Date();

  const product = await getProduct(slug);
  if (!product || !product.isActive) notFound();

  const preOrderItem = product.preOrderItems[0] ?? null;
  const period = preOrderItem?.period ?? null;

  const variants: VariantOption[] = product.variants.map((variant) => {
    const quotaRow =
      preOrderItem?.variantQuotas.find((row) => row.variantId === variant.id) ?? null;
    const availability = resolveVariantAvailability(
      product,
      variant,
      quotaRow && preOrderItem ? { ...quotaRow, preOrderItem } : null,
      now,
    );
    return {
      variantId: variant.id,
      variantName: variant.name,
      imageUrl: variant.imageUrl,
      unitPrice: availability.effectivePrice,
      basePrice: product.price + variant.priceDelta,
      maxQty: availability.available,
      canOrder: availability.canOrder,
      reason: availability.reason,
      quota: availability.quota,
      reserved: availability.reserved,
      variantQuotaId: availability.variantQuotaId,
      preOrderItemId: availability.preOrderItemId,
      pickupPeriod: availability.period
        ? {
            id: availability.period.id,
            name: availability.period.name,
            endAt: availability.period.endAt.toISOString(),
            estimatedPickupAt: availability.period.estimatedPickupAt.toISOString(),
            pickupLocation: availability.period.pickupLocation,
            pickupSchedule: availability.period.pickupSchedule,
            pickupNote: availability.period.pickupNote,
            shippingNote: availability.period.shippingNote,
          }
        : null,
    };
  });

  const orderableCount = variants.filter((v) => v.canOrder).length;
  const minPrice = variants.length > 0 ? Math.min(...variants.map((v) => v.unitPrice)) : product.price;
  const hasSpecialPrice = minPrice < product.price;
  const primaryCategory = product.categories[0] ?? null;

  // Galeri: gambar produk + gambar khusus varian (opsional, tidak wajib).
  const galleryImages = [
    ...product.images.map((image) => ({
      id: image.id,
      url: image.url,
      alt: image.alt,
    })),
    ...product.variants
      .filter((variant) => variant.imageUrl)
      .map((variant) => ({
        id: `variant-${variant.id}`,
        url: variant.imageUrl as string,
        alt: `${product.name} — ${variant.name}`,
      })),
  ];

  const related = await prisma.product.findMany({
    where: {
      isActive: true,
      categories: {
        some: { id: { in: product.categories.map((category) => category.id) } },
      },
      id: { not: product.id },
    },
    include: productWithAvailabilityInclude(now),
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: 4,
  });

  const specs = [
    {
      label: "Kategori",
      value:
        product.categories.map((category) => category.name).join(", ") ||
        "Belum dikategorikan",
    },
    product.brand ? { label: "Merek", value: product.brand } : null,
    { label: "Satuan", value: product.unit },
    product.sku ? { label: "Kode (SKU)", value: product.sku } : null,
    { label: "Jumlah varian", value: `${product.variants.length} varian` },
    period ? { label: "Periode pre-order", value: period.name } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <Link href="/" className="transition-colors hover:text-gold">
              Beranda
            </Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <Link href="/produk" className="transition-colors hover:text-gold">
              Produk
            </Link>
          </BreadcrumbItem>
          {primaryCategory ? (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <Link
                  href={`/kategori/${primaryCategory.slug}`}
                  className="transition-colors hover:text-gold"
                >
                  {primaryCategory.name}
                </Link>
              </BreadcrumbItem>
            </>
          ) : null}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-52 truncate text-cream sm:max-w-none">
              {product.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
        <ProductGallery images={galleryImages} productName={product.name} />

        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2">
            {hasSpecialPrice && (
              <Badge className="bg-emerald-600 text-white">Harga khusus PO</Badge>
            )}
            {product.categories.map((category) => (
              <Link
                key={category.id}
                href={`/kategori/${category.slug}`}
                className="text-xs font-medium text-gold hover:underline"
              >
                {category.name}
              </Link>
            ))}
            {product.brand && (
              <span className="text-xs text-cream-muted">• {product.brand}</span>
            )}
          </div>

          <h1 className="mt-2.5 text-2xl leading-tight font-semibold tracking-tight text-cream sm:text-3xl">
            {product.name}
          </h1>

          {period && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-cream-muted">
              <CalendarClockIcon className="size-4 shrink-0 text-gold-deep" aria-hidden />
              {period.name} · ditutup {formatDateTime(period.endAt)}
            </p>
          )}

          {/* Info periode pre-order */}
          {period && (
            <section
              aria-label="Informasi periode pre-order"
              className="mt-5 rounded-2xl border border-gold/30 bg-gold/10 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-gold text-obsidian"
                  >
                    <CalendarClockIcon className="size-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gold-light">
                      {period.name}
                    </p>
                    <p className="text-xs text-gold-light/75">
                      Ditutup {formatDateTime(period.endAt)} · {orderableCount} varian
                      tersedia
                    </p>
                  </div>
                </div>
                <Countdown
                  endAt={period.endAt.toISOString()}
                  variant="inline"
                  className="rounded-lg bg-coal px-2.5 py-1.5 text-xs text-gold-light ring-1 ring-gold/30"
                  finishedLabel="Periode ditutup"
                />
              </div>

              <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-gold-light/80">
                <InfoIcon className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>
                  Estimasi mulai bisa diambil{" "}
                  <strong>{formatDateTime(period.estimatedPickupAt)}</strong> di{" "}
                  {period.pickupLocation}. Jadwal pengambilan:{" "}
                  {period.pickupSchedule}.
                </span>
              </p>
            </section>
          )}

          {/* Pilih varian + tambah ke keranjang */}
          <div className="mt-6">
            <VariantPicker
              productId={product.id}
              slug={product.slug}
              name={product.name}
              unit={product.unit}
              fallbackImageUrl={product.images[0]?.url ?? null}
              variants={variants}
            />
          </div>

          <Separator className="my-6" />

          {/* Jaminan singkat */}
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {[
              { icon: BadgeCheckIcon, text: "Merchandise resmi PENS" },
              { icon: ShieldCheckIcon, text: "Pembayaran aman via Duitku" },
              { icon: StoreIcon, text: "Ambil di kampus / kirim (ongkir via WA)" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.text}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-coal p-2.5 text-xs text-cream-muted"
                >
                  <Icon className="size-4 shrink-0 text-gold" aria-hidden />
                  {item.text}
                </li>
              );
            })}
          </ul>

          {/* Spesifikasi */}
          <section aria-label="Spesifikasi produk" className="mt-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-cream">
              <BoxIcon className="size-4 text-[#8A8A8A]" aria-hidden />
              Spesifikasi
            </h2>
            <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-0 sm:grid-cols-2">
              {specs.map((spec) => (
                <div
                  key={spec.label}
                  className="flex items-baseline justify-between gap-4 border-b border-white/5 py-2 text-sm"
                >
                  <dt className="text-cream-muted">{spec.label}</dt>
                  <dd className="text-right font-medium text-cream">
                    {spec.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Deskripsi */}
          {product.description && (
            <section aria-label="Deskripsi produk" className="mt-6">
              <h2 className="text-sm font-semibold text-cream">
                Deskripsi Produk
              </h2>
              <div className="mt-2 space-y-3 text-sm leading-relaxed whitespace-pre-line text-cream-muted">
                {product.description}
              </div>
            </section>
          )}

          <p className="mt-6 text-xs text-[#8A8A8A]">
            Terakhir diperbarui {formatDate(product.updatedAt)}
          </p>
        </div>
      </div>

      {/* Produk terkait */}
      {related.length > 0 && (
        <section className="mt-14">
          <SectionHeading
            title="Produk Terkait"
            description={
              primaryCategory
                ? `Produk lain yang berbagi kategori dengan ${product.name}.`
                : "Produk lain yang mungkin kamu suka."
            }
            actionHref={
              primaryCategory ? `/kategori/${primaryCategory.slug}` : "/produk"
            }
            actionLabel={primaryCategory ? "Lihat kategori" : "Lihat katalog"}
          />
          <ProductGrid products={related} now={now} className="mt-6" />
        </section>
      )}
    </div>
  );
}
