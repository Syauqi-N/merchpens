import type { ReactNode } from "react";
import { PackageSearchIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ProductCard } from "@/components/shared/product-card";
import {
  resolveVariantAvailability,
  summarizeProductAvailability,
  type VariantAvailability,
} from "@/lib/preorder";
import type { CartPickupPeriod } from "@/store/cart";
import { cn } from "@/lib/utils";

/**
 * Bentuk data produk yang dipakai seluruh halaman storefront.
 *
 * Sengaja dibuat struktural (bukan tipe Prisma langsung) agar hasil query
 * dengan `productWithAvailabilityInclude()` bisa dioper apa adanya, termasuk
 * ketika produk diambil lewat relasi `PreOrderItem.product`.
 */
export type StorefrontProductImage = {
  url: string;
  alt?: string | null;
};

export type StorefrontVariant = {
  id: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
  imageUrl?: string | null;
  sortOrder?: number;
};

export type StorefrontVariantQuota = {
  id: string;
  quota: number;
  reserved: number;
  price: number | null;
  variantId: string;
};

export type StorefrontPreOrderItem = {
  id: string;
  price: number | null;
  period: {
    id: string;
    name: string;
    status: string;
    startAt: Date;
    endAt: Date;
    estimatedPickupAt: Date;
    pickupLocation: string;
    pickupSchedule: string;
    pickupNote: string;
    shippingNote: string;
  };
  variantQuotas: StorefrontVariantQuota[];
};

export type StorefrontProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  isActive: boolean;
  unit: string;
  brand?: string | null;
  images?: StorefrontProductImage[];
  categories?: { name: string; slug: string }[];
  variants?: StorefrontVariant[];
  /** Hasil `productWithAvailabilityInclude()` — maksimal satu baris (periode terbuka). */
  preOrderItems?: StorefrontPreOrderItem[];
};

/** URL gambar utama sebuah produk (gambar pertama sesuai `sortOrder`). */
export function productImageUrl(product: StorefrontProduct): string | null {
  return product.images?.[0]?.url ?? null;
}

function serializePeriod(period: {
  id: string;
  name: string;
  endAt: Date;
  estimatedPickupAt: Date;
  pickupLocation: string;
  pickupSchedule: string;
  pickupNote: string;
  shippingNote: string;
}): CartPickupPeriod {
  return {
    id: period.id,
    name: period.name,
    endAt: period.endAt.toISOString(),
    estimatedPickupAt: period.estimatedPickupAt.toISOString(),
    pickupLocation: period.pickupLocation,
    pickupSchedule: period.pickupSchedule,
    pickupNote: period.pickupNote,
    shippingNote: period.shippingNote,
  };
}

/**
 * Ketersediaan tiap varian produk — SELALU lewat `resolveVariantAvailability()`,
 * tidak pernah dihitung manual, supaya aturan kuota PO tetap punya satu
 * sumber kebenaran.
 */
export function productVariantAvailabilities(
  product: StorefrontProduct,
  now?: Date,
): VariantAvailability[] {
  const item = product.preOrderItems?.[0] ?? null;
  const variants = product.variants ?? [];
  const reference = now ?? new Date();

  return variants.map((variant) => {
    const quotaRow = item?.variantQuotas.find((row) => row.variantId === variant.id) ?? null;
    return resolveVariantAvailability(
      product,
      variant,
      quotaRow && item ? { ...quotaRow, preOrderItem: item } : null,
      reference,
    );
  });
}

export type ProductGridProps = {
  products: StorefrontProduct[];
  /** Waktu acuan bersama supaya seluruh kartu di satu halaman konsisten. */
  now?: Date;
  className?: string;
  /** Kelas grid kustom (bawaan: 2 → 3 → 4 kolom). */
  columnsClassName?: string;
  /** Ditampilkan bila daftar kosong. Bila tidak diisi, tidak menampilkan apa pun. */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
};

/** Grid kartu produk dengan perhitungan ketersediaan terpusat. */
export function ProductGrid({
  products,
  now,
  className,
  columnsClassName = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  emptyTitle,
  emptyDescription,
  emptyAction,
}: ProductGridProps) {
  if (products.length === 0) {
    if (!emptyTitle) return null;
    return (
      <EmptyState
        icon={<PackageSearchIcon />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        className={className}
      />
    );
  }

  return (
    <div className={cn("grid gap-4 sm:gap-5", columnsClassName, className)}>
      {products.map((product) => (
        <ProductGridCard key={product.id} product={product} now={now} />
      ))}
    </div>
  );
}

function ProductGridCard({ product, now }: { product: StorefrontProduct; now?: Date }) {
  const availabilities = productVariantAvailabilities(product, now);
  const summary = summarizeProductAvailability(availabilities);
  const orderable = availabilities.filter((item) => item.canOrder);

  // Tambah-cepat langsung dari kartu hanya bila tepat satu varian bisa dipesan.
  // Bila lebih dari satu (atau tidak ada), arahkan ke halaman detail.
  const single = orderable.length === 1 ? orderable[0] : null;
  const singleVariant = single
    ? (product.variants ?? []).find((v) => v.id === single.variantId)
    : null;

  return (
    <ProductCard
      product={{
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        unit: product.unit,
        brand: product.brand,
        imageUrl: productImageUrl(product),
        categories: product.categories ?? [],
      }}
      summary={summary}
      addToCart={
        single && singleVariant
          ? {
              productId: product.id,
              slug: product.slug,
              name: product.name,
              imageUrl: singleVariant.imageUrl ?? productImageUrl(product),
              variantId: single.variantId,
              variantName: single.variantName,
              unitPrice: single.effectivePrice,
              variantQuotaId: single.variantQuotaId,
              preOrderItemId: single.preOrderItemId,
              pickupPeriod: single.period ? serializePeriod(single.period) : null,
              maxQty: single.available,
              unit: product.unit,
            }
          : null
      }
    />
  );
}
