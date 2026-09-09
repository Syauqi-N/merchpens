import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon, LayoutGridIcon, PackageIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/prisma";
import { countOrderableProductsByCategory } from "@/lib/preorder";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kategori Produk",
  description:
    "Telusuri merchandise berdasarkan kategori.",
};

export default async function KategoriPage() {
  const [categories, countByCategory] = await Promise.all([
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
    countOrderableProductsByCategory(),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <header className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold tracking-wider text-gold uppercase">
          Jelajahi
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-cream sm:text-3xl">
          Kategori Produk
        </h1>
        <p className="max-w-2xl text-sm text-cream-muted">
          Pilih kategori untuk melihat merchandise yang tersedia di periode pre-order.
        </p>
      </header>

      {categories.length === 0 ? (
        <EmptyState
          icon={<LayoutGridIcon />}
          title="Belum ada kategori"
          description="Kategori produk belum disiapkan. Silakan lihat seluruh katalog terlebih dahulu."
          className="mt-8"
          action={
            <Link
              href="/produk"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-obsidian transition-colors hover:bg-gold-light"
            >
              <PackageIcon className="size-4" aria-hidden />
              Lihat semua produk
            </Link>
          }
        />
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/kategori/${category.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-coal transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-raise">
                  {category.imageUrl ? (
                    <Image
                      src={category.imageUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-gold-light">
                      <PackageIcon className="size-10" aria-hidden />
                    </span>
                  )}
                  <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-[#D8D3C7] tabular-nums shadow-sm">
                    {countByCategory.get(category.id) ?? 0} Produk Aktif
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <h2 className="text-base font-semibold text-cream group-hover:text-gold">
                    {category.name}
                  </h2>
                  {category.description && (
                    <p className="line-clamp-2 text-sm text-cream-muted">
                      {category.description}
                    </p>
                  )}
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-gold">
                    Lihat produk
                    <ArrowRightIcon
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
