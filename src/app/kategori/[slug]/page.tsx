import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { productWithAvailabilityInclude } from "@/lib/preorder";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

const ORDER_BY: Record<
  CatalogQuery["sort"],
  Prisma.ProductOrderByWithRelationInput[]
> = {
  terbaru: [{ createdAt: "desc" }, { name: "asc" }],
  termurah: [{ price: "asc" }, { name: "asc" }],
  termahal: [{ price: "desc" }, { name: "asc" }],
  nama: [{ name: "asc" }],
};

const getCategory = cache(async (slug: string) => {
  return prisma.category.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      isActive: true,
    },
  });
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);

  if (!category || !category.isActive) {
    return { title: "Kategori tidak ditemukan" };
  }

  return {
    title: category.name,
    description:
      category.description ??
      `Produk kategori ${category.name} — merchandise resmi PENS.`,
  };
}

export default async function KategoriDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const now = new Date();

  const category = await getCategory(slug);
  if (!category || !category.isActive) notFound();

  const basePath = `/kategori/${category.slug}`;
  const query: CatalogQuery = {
    q: firstParam(rawSearchParams.q),
    sort: parseSort(rawSearchParams.sort),
    page: parsePage(rawSearchParams.page),
  };

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    categories: { some: { id: category.id } },
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

  const [totalCount, siblings] = await Promise.all([
    prisma.product.count({ where }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
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
    { slug: null, name: "Semua kategori", href: "/produk" },
    ...siblings.map((item) => ({
      slug: item.slug,
      name: item.name,
      href: `/kategori/${item.slug}`,
    })),
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <Link href="/" className="transition-colors hover:text-gold">
              Beranda
            </Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <Link href="/kategori" className="transition-colors hover:text-gold">
              Kategori
            </Link>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-cream">
              {category.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="relative mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
        {category.imageUrl && (
          <Image
            src={category.imageUrl}
            alt=""
            fill
            sizes="(min-width: 1280px) 1200px, 100vw"
            className="object-cover opacity-40"
          />
        )}
        <div className="relative bg-linear-to-r from-cream/85 to-cream/40 px-5 py-8 sm:px-8 sm:py-10">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              {category.description}
            </p>
          )}
          <p className="mt-3 text-xs text-[#6E6E6E] tabular-nums">
            {totalCount} produk tersedia
          </p>
        </div>
      </header>

      <CategoryNav
        items={categoryItems}
        activeSlug={category.slug}
        className="mt-6"
        label="Pindah kategori"
      />

      <CatalogToolbar
        basePath={basePath}
        query={activeQuery}
        totalCount={totalCount}
        className="mt-4"
      />

      <ProductGrid
        products={products}
        now={now}
        className="mt-6"
        emptyTitle="Belum ada produk di kategori ini"
        emptyDescription={
          query.q
            ? `Tidak ada produk yang cocok dengan “${query.q}” di kategori ${category.name}.`
            : "Produk untuk kategori ini belum tersedia. Coba jelajahi kategori lain."
        }
        emptyAction={
          <Link
            href="/produk"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-obsidian transition-colors hover:bg-gold-light"
          >
            <PackageSearchIcon className="size-4" aria-hidden />
            Lihat semua produk
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
              buildCatalogHref(basePath, activeQuery, { page: target })
            }
            className="mt-3"
          />
        </>
      )}
    </div>
  );
}
