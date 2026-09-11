"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBagIcon } from "lucide-react";

import { selectTotalItems, useCartHydrated, useCartStore } from "@/store/cart";
import { cn } from "@/lib/utils";

/**
 * Tombol keranjang mengambang (floating quick-cart) khusus di layar mobile.
 * Muncul di pojok kanan bawah jika ada item di keranjang dan pengguna
 * tidak sedang berada di halaman keranjang atau checkout.
 */
export function MobileFloatingCart() {
  const pathname = usePathname();
  const hydrated = useCartHydrated();
  const totalItems = useCartStore(selectTotalItems);

  // Jangan tampilkan di halaman keranjang, checkout, atau panel admin
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/keranjang") ||
    pathname.startsWith("/checkout")
  ) {
    return null;
  }

  // Tampilkan hanya jika sudah hydrated dan keranjang tidak kosong
  if (!hydrated || totalItems <= 0) {
    return null;
  }

  return (
    <aside
      aria-label="Keranjang belanja cepat"
      className="fixed right-4 bottom-5 z-40 sm:hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      <Link
        href="/keranjang"
        className={cn(
          "flex items-center gap-2.5 rounded-full bg-gold px-4 py-3 text-obsidian shadow-xl shadow-gold/20",
          "border border-gold-light/40 font-bold active:scale-95 transition-transform",
        )}
      >
        <span className="relative flex items-center justify-center">
          <ShoppingBagIcon className="size-5" />
          <span className="absolute -top-2 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-obsidian px-1 text-[10px] font-extrabold text-gold">
            {totalItems > 99 ? "99+" : totalItems}
          </span>
        </span>
        <span className="text-sm font-extrabold tracking-wide">Keranjang</span>
      </Link>
    </aside>
  );
}
