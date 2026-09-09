import Link from "next/link";
import Image from "next/image";
import { ImageOffIcon } from "lucide-react";

import { PoProgress } from "@/components/storefront/po-progress";
import {
  productImageUrl,
  productVariantAvailabilities,
  type StorefrontProduct,
} from "@/components/storefront/product-grid";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/format";
import { summarizeProductAvailability } from "@/lib/preorder";
import { cn } from "@/lib/utils";

export type PreOrderProductCardProps = {
  product: StorefrontProduct;
  now?: Date;
  className?: string;
};

/**
 * Kartu produk pre-order dengan rincian kuota.
 *
 * Berbeda dengan `ProductCard` biasa: menonjolkan berapa kuota yang sudah
 * terpakai lewat bar progres total semua varian, karena itulah informasi
 * paling menentukan saat pelanggan memutuskan ikut sebuah batch PO.
 * Pemilihan varian selalu lewat halaman detail.
 */
export function PreOrderProductCard({
  product,
  now,
  className,
}: PreOrderProductCardProps) {
  const availabilities = productVariantAvailabilities(product, now);
  const summary = summarizeProductAvailability(availabilities);

  const imageUrl = productImageUrl(product);
  const hasSpecialPrice =
    summary.minPrice !== null && summary.minPrice < product.price;
  const priceLabel =
    summary.minPrice === null
      ? formatRupiah(product.price)
      : summary.minPrice === summary.maxPrice
        ? formatRupiah(summary.minPrice)
        : `${formatRupiah(summary.minPrice)} – ${formatRupiah(summary.maxPrice ?? summary.minPrice)}`;

  const orderableCount = availabilities.filter((item) => item.canOrder).length;
  const totalQuota = availabilities.reduce((sum, item) => sum + item.quota, 0);
  const totalReserved = availabilities.reduce((sum, item) => sum + item.reserved, 0);

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-white/10 bg-coal p-4 transition-shadow hover:shadow-sm sm:flex-row sm:items-center",
        className,
      )}
    >
      <Link
        href={`/produk/${product.slug}`}
        tabIndex={-1}
        aria-hidden
        className="relative aspect-square w-full shrink-0 overflow-hidden rounded-xl bg-raise sm:size-28"
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            sizes="(min-width: 640px) 112px, 100vw"
            className="object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-[#6E6E6E]">
            <ImageOffIcon className="size-8" />
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {hasSpecialPrice && (
            <Badge className="bg-emerald-600 text-white">Harga PO</Badge>
          )}
          {(product.categories?.length || product.brand) && (
            <span className="truncate text-xs text-cream-muted">
              {product.categories?.map((category) => category.name).join(", ")}
              {product.categories?.length && product.brand ? " • " : ""}
              {product.brand ?? ""}
            </span>
          )}
        </div>

        <h3 className="text-sm leading-snug font-semibold text-cream sm:text-base">
          <Link
            href={`/produk/${product.slug}`}
            className="outline-none hover:text-gold focus-visible:underline"
          >
            {product.name}
          </Link>
        </h3>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-lg font-semibold text-cream">{priceLabel}</span>
          {hasSpecialPrice && (
            <span className="text-sm text-[#8A8A8A] line-through">
              {formatRupiah(product.price)}
            </span>
          )}
          <span className="text-xs text-cream-muted">per {product.unit}</span>
        </div>

        <p className="text-xs text-cream-muted">
          {summary.canOrder
            ? `${orderableCount} varian tersedia · sisa ${summary.totalAvailable} ${product.unit}`
            : "Belum bisa dipesan pada periode ini"}
        </p>

        {totalQuota > 0 && (
          <PoProgress
            quota={totalQuota}
            reserved={totalReserved}
            unit={product.unit}
            className="max-w-md"
          />
        )}
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-44">
        <Link
          href={`/produk/${product.slug}`}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-gold px-3 text-sm font-medium text-obsidian transition-colors hover:bg-gold-light"
        >
          {summary.canOrder ? "Pilih Varian" : "Detail produk"}
        </Link>
      </div>
    </article>
  );
}
