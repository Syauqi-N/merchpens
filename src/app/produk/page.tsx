import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearchIcon } from "lucide-react";

import { CatalogPagination } from "@/components/storefront/catalog-pagination";
import {
  buildCatalogHref,
  CatalogToolbar,
  firstParam,
  parsePage,
  parseSort,
  type CatalogQuery,
  type SearchParamValue,
} from "@/components/storefront/catalog-toolbar";
import { CategoryNav } from "@/components/storefront/category-nav";
import { ProductGrid } from "@/components/storefront/product-grid";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { productWithAvailabilityInclude } from "@/lib/preorder";

// Katalog menampilkan sisa kuota PO yang berubah setiap saat.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Katalog Produk",
  description:
    "Katalog merchandise, dipesan lewat periode pre-order berkuota.",
};

const PAGE_SIZE = 12;

const BASE_PATH = "/produk";

type ProdukSearchParams = Promise<Record<string, SearchParamValue>>;

const ORDER_BY: Record<
  CatalogQuery["sort"],
  Prisma.ProductOrderByWithRelationInput[]
> = {
  terbaru: [{ createdAt: "desc" }, { name: "asc" }],
  termurah: [{ price: "asc" }, { name: "asc" }],
  termahal: [{ price: "desc" }, { name: "asc" }],
  nama: [{ name: "asc" }],
};

export default async function KatalogPage({
  searchParams,
}: {
  searchParams: ProdukSearchParams;
}) {
  const params = await searchParams;
  const now = new Date();

  const query: CatalogQuery = {
    q: firstParam(params.q),
    kategori: firstParam(params.kategori),
    sort: parseSort(params.sort),
    page: parsePage(params.page),
  };

  // Filter tanpa kategori — dipakai untuk menghitung jumlah produk di tiap pil
  // kategori supaya angkanya konsisten dengan pencarian yang aktif.
  const baseWhere: Prisma.ProductWhereInput = {
    isActive: true,
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { brand: { contains: query.q, mode: "insensitive" as const } },
            { sku: { contains: query.q, mode: "insensitive" as const } },
            { description: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const where: Prisma.ProductWhereInput = query.kategori
    ? { ...baseWhere, categories: { some: { slug: query.kategori } } }
    : baseWhere;

  const [totalCount, categories] = await Promise.all([
    prisma.product.count({ where }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            products: { where: baseWhere },
          },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(query.page, totalPages);
  const activeQuery: CatalogQuery = { ...query, page };

  const products = await prisma.product.findMany({
    where,
    include: productWithAvailabilityInclude(now),
    orderBy: ORDER_BY[query.sort],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const categoryItems = [
    { slug: null, name: "Semua", href: buildCatalogHref(BASE_PATH, activeQuery, { kategori: undefined, page: 1 }) },
    ...categories.map((category) => ({
      slug: category.slug,
      name: category.name,
      count: category._count.products,
      href: buildCatalogHref(BASE_PATH, activeQuery, {
        kategori: category.slug,
        page: 1,
      }),
    })),
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <header className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold tracking-wider text-gold uppercase">
          Katalog
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-cream sm:text-3xl">
          Semua Produk
        </h1>
        <p className="max-w-2xl text-sm text-cream-muted">
          Merchandise resmi PENS, dipesan lewat periode pre-order berkuota.
          Sisa kuota yang tampil sudah dikurangi pesanan yang berjalan.
        </p>
      </header>

      <CategoryNav
        items={categoryItems}
        activeSlug={query.kategori ?? null}
        className="mt-6"
      />

      <CatalogToolbar
        basePath={BASE_PATH}
        query={activeQuery}
        totalCount={totalCount}
        className="mt-4"
      />

      <ProductGrid
        products={products}
        now={now}
        className="mt-6"
        emptyTitle="Produk tidak ditemukan"
        emptyDescription={
          query.q
            ? `Tidak ada produk yang cocok dengan kata kunci “${query.q}”. Coba kata kunci lain atau ubah filter.`
            : "Belum ada produk yang cocok dengan filter yang dipilih."
        }
        emptyAction={
          <Link
            href={BASE_PATH}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-obsidian transition-colors hover:bg-gold-light"
          >
            <PackageSearchIcon className="size-4" aria-hidden />
            Tampilkan semua produk
          </Link>
        }
      />

      {products.length > 0 && (
        <>
          <p className="mt-8 text-center text-xs text-cream-muted">
            Halaman <span className="tabular-nums">{page}</span> dari{" "}
            <span className="tabular-nums">{totalPages}</span>
          </p>
          <CatalogPagination
            page={page}
            totalPages={totalPages}
            buildHref={(target) =>
              buildCatalogHref(BASE_PATH, activeQuery, { page: target })
            }
            className="mt-3"
          />
        </>
      )}
    </div>
  );
}
