import type { Metadata } from "next";
import Link from "next/link";
import { HouseIcon, PackageIcon, SearchXIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Halaman tidak ditemukan",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-20 text-center">
      <span
        aria-hidden
        className="grid size-14 place-items-center rounded-2xl bg-gold/10 text-gold"
      >
        <SearchXIcon className="size-7" />
      </span>

      <p className="mt-5 text-sm font-semibold tracking-widest text-gold">404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-cream">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-2 text-sm text-cream-muted">
        Halaman yang kamu cari mungkin sudah dipindahkan atau produknya tidak lagi
        tersedia.
      </p>

      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/"
          className={cn(
            buttonVariants(),
            "h-10 gap-2 bg-gold px-5 text-obsidian hover:bg-gold-light",
          )}
        >
          <HouseIcon className="size-4" aria-hidden />
          Kembali ke beranda
        </Link>
        <Link
          href="/produk"
          className={cn(buttonVariants({ variant: "outline" }), "h-10 gap-2 px-5")}
        >
          <PackageIcon className="size-4" aria-hidden />
          Lihat semua produk
        </Link>
      </div>
    </div>
  );
}
