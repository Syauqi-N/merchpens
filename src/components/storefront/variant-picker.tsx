"use client";

import { useMemo, useState } from "react";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";

import { AddToCartButton } from "@/components/shared/add-to-cart-button";
import { PoProgress } from "@/components/storefront/po-progress";
import { formatRupiah } from "@/lib/format";
import { unavailableLabel, type UnavailableReason } from "@/lib/preorder-labels";
import { cn } from "@/lib/utils";

export type VariantOption = {
  variantId: string;
  variantName: string;
  imageUrl: string | null;
  /** Harga yang berlaku untuk varian ini. */
  unitPrice: number;
  /** Harga pembanding (harga normal produk + delta) untuk coretan diskon. */
  basePrice: number;
  maxQty: number;
  canOrder: boolean;
  reason: UnavailableReason | null;
  /** Kuota awal & terpakai varian (untuk bar progres). */
  quota: number;
  reserved: number;
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
};

export function VariantPicker({
  productId,
  slug,
  name,
  unit,
  fallbackImageUrl,
  variants,
}: {
  productId: string;
  slug: string;
  name: string;
  unit: string;
  fallbackImageUrl: string | null;
  variants: VariantOption[];
}) {
  const orderable = useMemo(() => variants.filter((v) => v.canOrder), [variants]);
  const [selectedId, setSelectedId] = useState<string | null>(
    orderable[0]?.variantId ?? variants[0]?.variantId ?? null,
  );

  const selected = variants.find((v) => v.variantId === selectedId) ?? null;

  if (variants.length === 0) {
    return (
      <p className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 ring-1 ring-red-100">
        <XCircleIcon className="size-4" aria-hidden />
        Produk ini belum masuk periode pre-order yang dibuka.
      </p>
    );
  }

  const hasDiscount = selected !== null && selected.unitPrice < selected.basePrice;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-cream">
          Pilih varian{" "}
          <span className="font-normal text-cream-muted">
            ({orderable.length} dari {variants.length} tersedia)
          </span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Varian produk">
          {variants.map((variant) => {
            const active = variant.variantId === selectedId;
            return (
              <button
                key={variant.variantId}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!variant.canOrder}
                onClick={() => setSelectedId(variant.variantId)}
                className={cn(
                  "rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-gold bg-gold/10 text-gold-light ring-2 ring-gold/20"
                    : "border-white/10 bg-coal text-[#D8D3C7] hover:border-[#3A3A3A]",
                  !variant.canOrder && "cursor-not-allowed opacity-50",
                )}
              >
                {variant.variantName}
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-bold text-cream">
              {formatRupiah(selected.unitPrice)}
            </span>
            {hasDiscount && (
              <span className="text-lg text-[#8A8A8A] line-through">
                {formatRupiah(selected.basePrice)}
              </span>
            )}
            <span className="text-sm text-cream-muted">per {unit}</span>
          </div>

          <div>
            {selected.canOrder ? (
              <p className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200 ring-1 ring-emerald-100">
                <CheckCircle2Icon className="size-4" aria-hidden />
                {`Sisa kuota ${selected.variantName}: ${selected.maxQty} ${unit}`}
              </p>
            ) : (
              <p className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 ring-1 ring-red-100">
                <XCircleIcon className="size-4" aria-hidden />
                {unavailableLabel(selected.reason)}
              </p>
            )}
          </div>

          {selected.maxQty > 0 && (
            <PoProgress
              quota={selected.quota}
              reserved={selected.reserved}
              unit={unit}
            />
          )}

          <div>
            <AddToCartButton
              withQuantity
              size="lg"
              productId={productId}
              slug={slug}
              name={name}
              imageUrl={selected.imageUrl ?? fallbackImageUrl}
              unitPrice={selected.unitPrice}
              variantId={selected.variantId}
              variantName={selected.variantName}
              variantQuotaId={selected.variantQuotaId}
              preOrderItemId={selected.preOrderItemId}
              pickupPeriod={selected.pickupPeriod}
              maxQty={selected.maxQty}
              unit={unit}
              disabled={!selected.canOrder}
              disabledLabel={unavailableLabel(selected.reason)}
              label="Pesan Pre-Order"
            />
            <p className="mt-2 text-xs text-cream-muted">
              Checkout memerlukan akun. Kuota dipotong saat pesanan dibuat dan
              dilepas kembali bila pembayaran 60 menit kedaluwarsa.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
