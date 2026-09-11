import Link from "next/link";
import Image from "next/image";
import { ImageOffIcon } from "lucide-react";

import { AddToCartButton } from "@/components/shared/add-to-cart-button";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/format";
import type { ProductAvailabilitySummary } from "@/lib/preorder";
import { cn } from "@/lib/utils";

/** Bentuk minimum data produk yang dibutuhkan kartu. */
export type ProductCardProduct = {
  id: string;
  name: string;
  slug: string;
  /** Harga normal — dipakai untuk mencoret harga bila harga PO lebih murah. */
  price: number;
  unit: string;
  brand?: string | null;
  /** URL gambar utama (ProductImage yang isPrimary, atau yang pertama). */
  imageUrl?: string | null;
  categories?: { name: string; slug: string }[];
};

export type ProductCardAddToCart = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  variantId: string;
  variantName: string;
  unitPrice: number;
  variantQuotaId: string | null;
  preOrderItemId: string | null;
  pickupPeriod: {
    id: string;
    name: string;
    endAt: string;
    estimatedPickupAt: string;
    pickupLocation: string;
    pickupSchedule: string;
    pickupNote: string;
    shippingNote: string;
  } | null;
  maxQty: number;
  unit: string;
};

export type ProductCardProps = {
  product: ProductCardProduct;
  /** Ringkasan ketersediaan seluruh varian. */
  summary: ProductAvailabilitySummary;
  /**
   * Tambah-cepat satu varian langsung dari kartu. `null` bila produk punya
   * lebih dari satu varian bisa dipesan (atau tidak ada) — tombolnya menjadi
   * tautan "Pilih Varian" ke halaman detail.
   */
  addToCart: ProductCardAddToCart | null;
  className?: string;
  /** Ambang "sisa kuota sedikit" untuk penanda oranye. */
  lowQuotaThreshold?: number;
};

export function ProductCard({
  product,
  summary,
  addToCart,
  className,
  lowQuotaThreshold = 5,
}: ProductCardProps) {
  const { canOrder, totalAvailable, minPrice, maxPrice } = summary;

  const hasDiscount = minPrice !== null && minPrice < product.price;
  const isLow = canOrder && totalAvailable <= lowQuotaThreshold;
  const priceLabel =
    minPrice === null
      ? formatRupiah(product.price)
      : minPrice === maxPrice
        ? formatRupiah(minPrice)
        : `${formatRupiah(minPrice)} – ${formatRupiah(maxPrice ?? minPrice)}`;

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-coal transition-shadow hover:shadow-md",
        className,
      )}
    >
      {/* Gambar */}
      <Link
        href={`/produk/${product.slug}`}
        className="relative block aspect-square overflow-hidden bg-raise"
        tabIndex={-1}
        aria-hidden
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="grid size-full place-items-center text-[#6E6E6E]">
            <ImageOffIcon className="size-10" />
          </span>
        )}

        {/* Badge kiri atas */}
        {hasDiscount && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-emerald-600 text-white shadow-sm">Harga PO</Badge>
          </div>
        )}

        {/* Overlay saat tidak bisa dipesan */}
        {!canOrder && (
          <div className="absolute inset-0 grid place-items-center bg-obsidian/75 backdrop-blur-[2px]">
            <Badge variant="destructive" className="bg-red-600 text-white shadow-sm">
              Tidak tersedia
            </Badge>
          </div>
        )}
      </Link>

      {/* Isi */}
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        {(product.brand || product.categories?.length) && (
          <p className="truncate text-xs text-cream-muted">
            {product.brand ||
              product.categories?.map((category) => category.name).join(", ")}
          </p>
        )}

        <h3 className="text-sm leading-snug font-medium text-cream">
          <Link
            href={`/produk/${product.slug}`}
            className="line-clamp-2 outline-none hover:text-gold focus-visible:underline"
          >
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto pt-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-base font-semibold text-cream">{priceLabel}</span>
            {hasDiscount && (
              <span className="text-xs text-[#8A8A8A] line-through">
                {formatRupiah(product.price)}
              </span>
            )}
          </div>
          <p className="text-xs text-cream-muted">per {product.unit}</p>
        </div>

        {/* Sisa kuota periode PO */}
        <div className="flex flex-wrap items-center gap-1.5">
          {canOrder ? (
            <Badge
              variant="outline"
              className={cn(
                "font-normal",
                isLow
                  ? "border-gold/30 bg-gold/10 text-gold-light"
                  : "border-white/10 bg-obsidian text-cream-muted",
              )}
            >
              Sisa kuota: {totalAvailable} {product.unit}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-red-500/30 bg-red-500/10 font-normal text-red-300"
            >
              Tidak tersedia
            </Badge>
          )}
        </div>

        {addToCart ? (
          <AddToCartButton
            className="mt-1.5"
            size="default"
            productId={addToCart.productId}
            slug={addToCart.slug}
            name={addToCart.name}
            imageUrl={addToCart.imageUrl}
            variantId={addToCart.variantId}
            variantName={addToCart.variantName}
            unitPrice={addToCart.unitPrice}
            variantQuotaId={addToCart.variantQuotaId}
            preOrderItemId={addToCart.preOrderItemId}
            pickupPeriod={addToCart.pickupPeriod}
            maxQty={addToCart.maxQty}
            unit={addToCart.unit}
            disabled={!canOrder}
            disabledLabel="Tidak tersedia"
            label="Pesan Pre-Order"
          />
        ) : (
          <Link
            href={`/produk/${product.slug}`}
            className="mt-1.5 inline-flex h-10 items-center justify-center rounded-lg bg-gold px-3 text-sm font-medium text-obsidian transition-colors hover:bg-gold-light"
          >
            Pilih Varian
          </Link>
        )}
      </div>
    </article>
  );
}
