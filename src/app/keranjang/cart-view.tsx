"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  ImageIcon,
  LoaderCircleIcon,
  MinusIcon,
  PackageIcon,
  PlusIcon,
  RefreshCwIcon,
  ShoppingCartIcon,
  StoreIcon,
  TrashIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";

import { SecondaryBrandLogo } from "@/components/branding/brand-logos";
import { EmptyState } from "@/components/shared/empty-state";
import { useCartSync } from "@/components/cart/use-cart-sync";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/format";
import {
  cartItemKey,
  selectSubtotal,
  useCartStore,
  type CartItem,
} from "@/store/cart";

export function CartView() {
  const router = useRouter();

  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore(selectSubtotal);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clear = useCartStore((state) => state.clear);

  const { hydrated, checking, warnings, failed, recheck } = useCartSync();

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [goingToCheckout, setGoingToCheckout] = useState(false);

  // Tidak ada ongkos kirim: barang diambil sendiri di kampus.
  const total = subtotal;

  /**
   * Menaikkan/menurunkan jumlah relatif terhadap isi store TERKINI.
   *
   * Membaca `item.quantity` hasil render tidak aman di sini: dua klik cepat
   * berturut-turut terjadi sebelum React sempat me-render ulang, sehingga klik
   * kedua masih memakai angka lama dan satu langkah hilang.
   */
  function stepQuantity(
    key: { variantQuotaId: string | null; productId: string; variantId: string },
    delta: number,
  ) {
    const current = useCartStore
      .getState()
      .items.find(
        (item) =>
          cartItemKey(item) ===
          (key.variantQuotaId ?? `${key.productId}:${key.variantId}`),
      );
    if (!current) return;
    updateQuantity(key, current.quantity + delta);
  }

  async function handleCheckout() {
    setGoingToCheckout(true);

    // Periksa sekali lagi tepat sebelum pindah halaman supaya pengguna tidak
    // sampai ke form pembayaran dengan keranjang yang sudah basi.
    const result = await recheck();

    if (result && !result.ok) {
      setGoingToCheckout(false);
      toast.warning("Keranjang diperbarui", {
        description: "Ada perubahan ketersediaan. Periksa kembali sebelum lanjut.",
      });
      return;
    }

    if (useCartStore.getState().items.length === 0) {
      setGoingToCheckout(false);
      toast.error("Keranjang kosong.");
      return;
    }

    router.push("/checkout");
  }

  if (!hydrated) {
    return <CartSkeleton />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCartIcon />}
        title="Keranjang kamu masih kosong"
        description="Telusuri katalog merchandise kami, atau ikut periode pre-order yang sedang dibuka."
        action={
          <>
            <Button
              className="bg-gold text-obsidian hover:bg-gold-light"
              nativeButton={false}
              render={<Link href="/produk" />}
            >
              Lihat Produk
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/pre-order" />}>
              Periode Pre-Order
            </Button>
          </>
        }
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="space-y-4">
        {warnings.length > 0 && (
          <Alert variant="destructive" className="border-gold/30 bg-gold/10">
            <TriangleAlertIcon aria-hidden />
            <AlertTitle className="text-gold-light">
              Keranjang disesuaikan dengan ketersediaan terbaru
            </AlertTitle>
            <AlertDescription>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-gold-light/90">
                {warnings.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {failed && (
          <Alert variant="destructive">
            <TriangleAlertIcon aria-hidden />
            <AlertDescription>
              Gagal memeriksa ketersediaan terbaru. Jumlah dan harga di bawah mungkin
              belum diperbarui.
            </AlertDescription>
          </Alert>
        )}

        <Card className="overflow-hidden py-0">
          <CardContent className="divide-y divide-white/5 p-0">
            {items.map((item) => (
              <CartRow
                key={cartItemKey(item)}
                item={item}
                onQuantityChange={(quantity) =>
                  updateQuantity(
                    {
                      variantQuotaId: item.variantQuotaId,
                      productId: item.productId,
                      variantId: item.variantId,
                    },
                    quantity,
                  )
                }
                onStep={(delta) =>
                  stepQuantity(
                    {
                      variantQuotaId: item.variantQuotaId,
                      productId: item.productId,
                      variantId: item.variantId,
                    },
                    delta,
                  )
                }
                onRemove={() => {
                  removeItem({
                    variantQuotaId: item.variantQuotaId,
                    productId: item.productId,
                    variantId: item.variantId,
                  });
                  toast.success(`${item.name} (${item.variantName}) dihapus dari keranjang`);
                }}
              />
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="lg"
            className="text-cream-muted hover:text-cream"
            nativeButton={false}
            render={<Link href="/produk" />}
          >
            Lanjut belanja
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={checking}
              onClick={() => {
                void recheck().then((result) => {
                  if (result?.ok) toast.success("Keranjang sudah paling baru.");
                });
              }}
            >
              {checking ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden />
              ) : (
                <RefreshCwIcon aria-hidden />
              )}
              Periksa ketersediaan
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
              onClick={() => setConfirmClearOpen(true)}
            >
              <TrashIcon aria-hidden />
              Kosongkan
            </Button>
          </div>
        </div>
      </div>

      <Card className="lg:sticky lg:top-24">
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-3">
            <SecondaryBrandLogo className="w-32" alt="" />
            <span className="shrink-0 rounded-full bg-gold/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-gold uppercase">
              Checkout aman
            </span>
          </div>

          <h2 className="text-base font-semibold text-cream">Ringkasan Belanja</h2>

          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-cream-muted">Subtotal</dt>
              <dd className="font-medium text-cream tabular-nums">
                {formatRupiah(subtotal)}
              </dd>
            </div>
          </dl>

          <Separator />

          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-[#D8D3C7]">Total</span>
            <span className="text-xl font-bold text-gold tabular-nums">
              {formatRupiah(total)}
            </span>
          </div>

          <div className="flex gap-2 rounded-lg bg-gold/10 p-3 text-xs text-gold-light">
            <StoreIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Ongkir <strong>tidak termasuk</strong> di pembayaran ini. Pilih{" "}
              <strong>ambil di kampus</strong> atau <strong>kirim ke alamat</strong>{" "}
              saat checkout; ongkir kirim dibayar manual via WhatsApp admin.
            </p>
          </div>

          <div className="flex gap-2 rounded-lg bg-gold/10 p-3 text-xs text-gold-light">
            <PackageIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Semua pesanan adalah <strong>pre-order</strong>. Barang diproduksi
              setelah periode PO ditutup.
            </p>
          </div>

          <Button
            type="button"
            size="lg"
            className="h-11 w-full bg-gold text-obsidian hover:bg-gold-light"
            disabled={goingToCheckout || checking}
            onClick={() => void handleCheckout()}
          >
            {goingToCheckout ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden />
            ) : null}
            {goingToCheckout ? "Memeriksa..." : "Lanjut ke Checkout"}
            {!goingToCheckout && <ArrowRightIcon aria-hidden />}
          </Button>

          <p className="text-center text-xs text-cream-muted">
            Kamu perlu masuk untuk menyelesaikan pesanan.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kosongkan keranjang?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh {items.length} item akan dihapus dari keranjang. Tindakan ini tidak
              bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                clear();
                setConfirmClearOpen(false);
                toast.success("Keranjang dikosongkan");
              }}
            >
              Ya, kosongkan
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CartRow({
  item,
  onQuantityChange,
  onStep,
  onRemove,
}: {
  item: CartItem;
  /** Set jumlah absolut (dipakai kolom input angka). */
  onQuantityChange: (quantity: number) => void;
  /** Ubah jumlah relatif (dipakai tombol -/+, aman terhadap klik beruntun). */
  onStep: (delta: number) => void;
  onRemove: () => void;
}) {
  const limit = Math.max(1, item.maxQty);
  const lineTotal = item.unitPrice * item.quantity;

  return (
    <div className="flex gap-4 p-4">
      <Link
        href={`/produk/${item.slug}`}
        className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-raise ring-1 ring-white/10"
      >
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            width={80}
            height={80}
            className="size-20 object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-[#8A8A8A]">
            <ImageIcon className="size-6" aria-hidden />
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/produk/${item.slug}`}
              className="line-clamp-2 text-sm font-semibold text-cream hover:text-gold"
            >
              {item.name}
            </Link>
            <p className="mt-0.5 text-xs font-medium text-gold">{item.variantName}</p>
            <p className="mt-1 text-xs text-cream-muted">
              {formatRupiah(item.unitPrice)} / {item.unit}
            </p>
          </div>

          <button
            type="button"
            onClick={onRemove}
            aria-label={`Hapus ${item.name} dari keranjang`}
            className="shrink-0 rounded-md p-1.5 text-[#8A8A8A] transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <TrashIcon className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => onStep(-1)}
              disabled={item.quantity <= 1}
              aria-label={`Kurangi jumlah ${item.name}`}
              className="grid h-full w-9 place-items-center text-cream-muted transition-colors hover:bg-raise disabled:pointer-events-none disabled:opacity-40"
            >
              <MinusIcon className="size-4" aria-hidden />
            </button>

            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={limit}
              value={item.quantity}
              aria-label={`Jumlah ${item.name} (${item.unit})`}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                onQuantityChange(Number.isNaN(parsed) ? 1 : parsed);
              }}
              className="h-full w-12 border-x border-white/10 text-center text-sm font-medium tabular-nums outline-none focus:bg-gold/10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />

            <button
              type="button"
              onClick={() => onStep(1)}
              disabled={item.quantity >= limit}
              aria-label={`Tambah jumlah ${item.name}`}
              className="grid h-full w-9 place-items-center text-cream-muted transition-colors hover:bg-raise disabled:pointer-events-none disabled:opacity-40"
            >
              <PlusIcon className="size-4" aria-hidden />
            </button>
          </div>

          <div className="text-right">
            <p className="text-sm font-semibold text-cream tabular-nums">
              {formatRupiah(lineTotal)}
            </p>
            {item.quantity >= limit && (
              <p className="text-xs text-gold-light">
                Maksimal {limit} {item.unit}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <Card className="py-0">
        <CardContent className="divide-y divide-white/5 p-0">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex gap-4 p-4">
              <Skeleton className="size-20 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-9 w-32" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-11 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
