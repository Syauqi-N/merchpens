"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon, ShoppingCartIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCartStore, type CartItemInput } from "@/store/cart";

export type AddToCartButtonProps = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  /** Varian yang ditambahkan. */
  variantId: string;
  variantName: string;
  /** WAJIB `effectivePrice` varian, bukan `product.price`. */
  unitPrice: number;
  /** `variantQuotaId` — baris kuota VARIAN periode PO yang dipakai. */
  variantQuotaId: string | null;
  /** Baris produk PO (info periode/batch). */
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
  /** Sisa kuota varian. */
  maxQty: number;
  unit: string;
  /** Paksa nonaktif (mis. produk tidak bisa dipesan). */
  disabled?: boolean;
  /** Teks tombol saat nonaktif, mis. "Kuota Habis". */
  disabledLabel?: string;
  /** Tampilkan pengatur jumlah (-/+). Cocok untuk halaman detail produk. */
  withQuantity?: boolean;
  label?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
  fullWidth?: boolean;
};

export function AddToCartButton({
  productId,
  slug,
  name,
  imageUrl,
  variantId,
  variantName,
  unitPrice,
  variantQuotaId,
  preOrderItemId,
  pickupPeriod,
  maxQty,
  unit,
  disabled = false,
  disabledLabel = "Tidak tersedia",
  withQuantity = false,
  label = "Pesan Pre-Order",
  className,
  size = "default",
  fullWidth = true,
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);

  const limit = Math.max(0, Math.floor(maxQty));
  const isDisabled = disabled || limit <= 0;

  function handleAdd() {
    if (isDisabled) return;

    const key = variantQuotaId ?? `${productId}:${variantId}`;
    const alreadyInCart =
      useCartStore
        .getState()
        .items.find(
          (item) =>
            (item.variantQuotaId ?? `${item.productId}:${item.variantId}`) === key,
        )
        ?.quantity ?? 0;

    if (alreadyInCart >= limit) {
      toast.warning(`Kuota pre-order untuk ${name} (${variantName}) maksimal ${limit} ${unit}.`);
      return;
    }

    const requested = Math.max(1, Math.min(quantity, limit - alreadyInCart));

    const payload: CartItemInput = {
      productId,
      slug,
      name,
      imageUrl,
      variantId,
      variantName,
      unitPrice,
      variantQuotaId,
      preOrderItemId,
      pickupPeriod,
      maxQty: limit,
      unit,
    };

    addItem(payload, requested);

    toast.success(`${name} (${variantName}) ditambahkan ke keranjang`, {
      description: `${requested} ${unit} — pesanan pre-order`,
    });

    if (withQuantity) setQuantity(1);
  }

  const buttonClasses = cn(
    size === "lg" ? "h-11 text-sm" : size === "sm" ? "h-8 text-xs" : "h-10 text-sm",
    "gap-2 bg-gold text-obsidian hover:bg-gold-light",
    fullWidth && !withQuantity && "w-full",
    className,
  );

  if (!withQuantity) {
    return (
      <Button
        type="button"
        onClick={handleAdd}
        disabled={isDisabled}
        aria-label={isDisabled ? disabledLabel : `${label}: ${name}`}
        className={buttonClasses}
      >
        {!isDisabled && <ShoppingCartIcon className="size-4" aria-hidden />}
        {isDisabled ? disabledLabel : label}
      </Button>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", fullWidth && "w-full")}>
      <div className="inline-flex h-11 items-center overflow-hidden rounded-lg border border-white/10">
        <button
          type="button"
          onClick={() => setQuantity((value) => Math.max(1, value - 1))}
          disabled={isDisabled || quantity <= 1}
          aria-label="Kurangi jumlah"
          className="grid h-full w-10 place-items-center text-cream-muted transition-colors hover:bg-raise disabled:pointer-events-none disabled:opacity-40"
        >
          <MinusIcon className="size-4" aria-hidden />
        </button>

        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={Math.max(1, limit)}
          value={quantity}
          disabled={isDisabled}
          aria-label={`Jumlah (${unit})`}
          onChange={(event) => {
            const parsed = Number.parseInt(event.target.value, 10);
            if (Number.isNaN(parsed)) {
              setQuantity(1);
              return;
            }
            setQuantity(Math.max(1, Math.min(parsed, Math.max(1, limit))));
          }}
          className="h-full w-14 border-x border-white/10 text-center text-sm font-medium tabular-nums outline-none focus:bg-gold/10 disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        <button
          type="button"
          onClick={() => setQuantity((value) => Math.min(Math.max(1, limit), value + 1))}
          disabled={isDisabled || quantity >= limit}
          aria-label="Tambah jumlah"
          className="grid h-full w-10 place-items-center text-cream-muted transition-colors hover:bg-raise disabled:pointer-events-none disabled:opacity-40"
        >
          <PlusIcon className="size-4" aria-hidden />
        </button>
      </div>

      <Button
        type="button"
        onClick={handleAdd}
        disabled={isDisabled}
        className={cn(buttonClasses, "min-w-48 flex-1")}
      >
        {!isDisabled && <ShoppingCartIcon className="size-4" aria-hidden />}
        {isDisabled ? disabledLabel : label}
      </Button>
    </div>
  );
}
