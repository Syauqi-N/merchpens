import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  CalendarClockIcon,
  ImageOffIcon,
  PackagePlusIcon,
  PencilIcon,
  PackageSearchIcon,
} from "lucide-react";

import { AdminPagination } from "@/components/admin/admin-pagination";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ensurePageCapability } from "@/components/admin/guard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { openPeriodWhere } from "@/lib/preorder";
import { unavailableLabel } from "@/lib/preorder-labels";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";
import { ProductFilters } from "./product-filters";
import { ProductActiveToggle, ProductDeleteButton } from "./product-row-actions";
import { LOW_QUOTA_THRESHOLD, PRODUCTS_PER_PAGE } from "./schemas";

export const metadata: Metadata = { title: "Produk" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** Ambil nilai tunggal dari searchParams (bisa berupa array bila kunci diulang). */
function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  brand: string | null;
  unit: string;
  price: number;
  isActive: boolean;
  isFeatured: boolean;
  imageUrl: string | null;
  categoryNames: string;
  effectivePrice: number;
  /**
   * Kuota & sisanya pada periode yang sedang terbuka, dijumlahkan dari seluruh
   * baris kuota VARIAN (`PreOrderVariantQuota`); null bila produk tidak
   * diikutkan periode mana pun. Angka sisa sengaja dihitung langsung dari baris
   * kuota — produk yang dinonaktifkan memang tidak bisa dipesan, tetapi
   * jatahnya masih ada dan pengurus perlu melihatnya apa adanya.
   */
  quota: number | null;
  remaining: number | null;
  canOrder: boolean;
  /** Alasan siap-tampil ketika produk belum bisa dipesan. */
  blockedLabel: string | null;
  periodName: string | null;
  orderItemCount: number;
  /** Jumlah varian aktif / total varian produk ini. */
  activeVariantCount: number;
  totalVariantCount: number;
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Guard di layout tidak cukup — page tetap dirender bersamaan dengan layout.
  await ensurePageCapability("MANAGE_CATALOG", "/admin/produk");

  const params = await searchParams;
  const q = first(params.q).trim();
  const kategori = first(params.kategori).trim();
  const statusRaw = first(params.status).trim();

  const status = statusRaw === "aktif" || statusRaw === "nonaktif" ? statusRaw : "";
  const pageRaw = Number.parseInt(first(params.page), 10);
  const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const where: Prisma.ProductWhereInput = {};
  if (q !== "") {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
    ];
  }
  if (kategori !== "") where.categories = { some: { slug: kategori } };
  if (status !== "") where.isActive = status === "aktif";

  const now = new Date();

  const [totalItems, categories] = await Promise.all([
    prisma.product.count({ where }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { slug: true, name: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / PRODUCTS_PER_PAGE));
  const page = Math.min(requestedPage, totalPages);

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    skip: (page - 1) * PRODUCTS_PER_PAGE,
    take: PRODUCTS_PER_PAGE,
    include: {
      categories: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { name: true },
      },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      preOrderItems: {
        where: { period: openPeriodWhere(now) },
        include: {
          period: true,
          variantQuotas: { select: { quota: true, reserved: true } },
        },
        take: 1,
      },
      variants: { where: { isActive: true }, select: { id: true } },
      _count: { select: { orderItems: true, variants: true } },
    },
  });

  const rows: ProductRow[] = products.map((product) => {
    // Ketersediaan dihitung dari jumlah kuota PER VARIAN pada periode terbuka.
    const quotaRow = product.preOrderItems[0] ?? null;
    const quotaRows = quotaRow?.variantQuotas ?? [];
    const quota =
      quotaRow === null ? null : quotaRows.reduce((sum, row) => sum + row.quota, 0);
    const remaining =
      quotaRow === null
        ? null
        : quotaRows.reduce(
            (sum, row) => sum + Math.max(0, row.quota - row.reserved),
            0,
          );
    const canOrder =
      product.isActive && remaining !== null && remaining > 0;
    const blockedLabel = canOrder
      ? null
      : !product.isActive
        ? unavailableLabel("INACTIVE", { short: true })
        : remaining === null
          ? unavailableLabel("NOT_IN_PERIOD", { short: true })
          : unavailableLabel("QUOTA_EXHAUSTED", { short: true });

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      brand: product.brand,
      unit: product.unit,
      price: product.price,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      imageUrl: product.images[0]?.url ?? null,
      categoryNames: product.categories.map((category) => category.name).join(", "),
      effectivePrice: product.price,
      quota,
      remaining,
      canOrder,
      blockedLabel,
      periodName: quotaRow?.period.name ?? null,
      orderItemCount: product._count.orderItems,
      activeVariantCount: product.variants.length,
      totalVariantCount: product._count.variants,
    };
  });

  /** Berapa produk pada halaman ini yang belum diikutkan periode PO mana pun. */
  const notInPeriodCount = rows.filter((row) => row.remaining === null).length;

  function createHref(targetPage: number): string {
    const search = new URLSearchParams();
    if (q !== "") search.set("q", q);
    if (kategori !== "") search.set("kategori", kategori);
    if (status !== "") search.set("status", status);
    if (targetPage > 1) search.set("page", String(targetPage));
    const value = search.toString();
    return value === "" ? "/admin/produk" : `/admin/produk?${value}`;
  }

  const columns: DataTableColumn<ProductRow>[] = [
    {
      key: "product",
      header: "Produk",
      className: "min-w-64 whitespace-normal",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-obsidian">
            {row.imageUrl ? (
              <Image
                src={row.imageUrl}
                alt=""
                fill
                sizes="44px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="grid size-full place-items-center text-[#6E6E6E]">
                <ImageOffIcon className="size-4" aria-hidden />
              </span>
            )}
          </div>

          <div className="min-w-0">
            <Link
              href={`/admin/produk/${row.id}`}
              className="line-clamp-2 text-sm font-medium text-cream hover:text-gold"
            >
              {row.name}
            </Link>
            <p className="truncate text-xs text-cream-muted">
              {row.brand ?? "Merchandise PENS"}
            </p>
            {row.isFeatured && (
              <Badge className="mt-1 bg-gold/10 text-gold">Unggulan</Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Kategori",
      className: "text-sm text-cream-muted",
      cell: (row) => row.categoryNames || "—",
    },
    {
      key: "varian",
      header: "Varian",
      className: "text-center whitespace-nowrap",
      headerClassName: "text-center",
      cell: (row) => (
        <div className="text-center">
          <p className="text-sm font-medium text-cream tabular-nums">
            {row.activeVariantCount}
            <span className="font-normal text-[#8A8A8A]"> / {row.totalVariantCount}</span>
          </p>
          <p className="text-xs text-cream-muted">aktif</p>
        </div>
      ),
    },
    {
      key: "price",
      header: "Harga",
      className: "text-right",
      headerClassName: "text-right",
      cell: (row) => (
        <div className="text-right">
          <p className="text-sm font-medium text-cream">
            {formatRupiah(row.effectivePrice)}
          </p>
          {row.effectivePrice !== row.price && (
            <p className="text-xs text-[#8A8A8A] line-through">{formatRupiah(row.price)}</p>
          )}
          <p className="text-xs text-cream-muted">per {row.unit}</p>
        </div>
      ),
    },
    {
      key: "quota",
      header: "Kuota periode aktif",
      className: "whitespace-normal",
      cell: (row) =>
        row.remaining === null ? (
          <div className="space-y-0.5">
            <p className="text-sm text-[#8A8A8A]">—</p>
            <p className="text-xs text-cream-muted">Belum masuk periode PO</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            <p className="text-sm text-[#D8D3C7]">
              Sisa kuota:{" "}
              <span
                className={cn(
                  "font-medium tabular-nums",
                  row.remaining === 0
                    ? "text-red-400"
                    : row.remaining <= LOW_QUOTA_THRESHOLD
                      ? "text-amber-600"
                      : "text-cream",
                )}
              >
                {row.remaining}
              </span>
              <span className="text-[#8A8A8A]"> / {row.quota}</span>
            </p>
            <p className="text-xs text-cream-muted">
              {row.canOrder ? row.periodName : row.blockedLabel}
            </p>
          </div>
        ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <ProductActiveToggle id={row.id} name={row.name} isActive={row.isActive} />
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Aksi</span>,
      className: "text-right",
      headerClassName: "text-right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Ubah ${row.name}`}
            className="text-cream-muted hover:text-gold"
            nativeButton={false}
            render={<Link href={`/admin/produk/${row.id}`} />}
          >
            <PencilIcon className="size-4" aria-hidden />
          </Button>

          <ProductDeleteButton
            id={row.id}
            name={row.name}
            usedInOrders={row.orderItemCount > 0}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Produk"
        description="Kelola katalog merchandise. Semua produk dijual lewat periode pre-order berkuota per varian."
        action={
          <Button
            className="h-10 gap-1.5 bg-gold text-obsidian hover:bg-gold-light"
            nativeButton={false}
            render={<Link href="/admin/produk/baru" />}
          >
            <PackagePlusIcon className="size-4" aria-hidden />
            Tambah Produk
          </Button>
        }
      />

      {notInPeriodCount > 0 && (
        <Alert className="mb-4 border-amber-500/30 bg-amber-500/10 text-amber-200">
          <CalendarClockIcon className="text-amber-600" aria-hidden />
          <AlertTitle>
            {notInPeriodCount} produk di halaman ini belum bisa dipesan
          </AlertTitle>
          <AlertDescription className="text-amber-200">
            Produk baru belum bisa dipesan sampai kamu memasukkannya ke sebuah periode
            pre-order beserta kuotanya. Atur di menu{" "}
            <Link href="/admin/pre-order" className="font-medium underline">
              Pre-Order
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      <ProductFilters categories={categories} current={{ q, kategori, status }} />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty={
          <div className="flex flex-col items-center gap-2">
            <PackageSearchIcon className="size-8 text-[#6E6E6E]" aria-hidden />
            <p className="font-medium text-[#D8D3C7]">Produk tidak ditemukan</p>
            <p className="text-sm text-cream-muted">
              Coba ubah kata kunci atau filter, atau tambahkan produk baru.
            </p>
          </div>
        }
      />

      <AdminPagination
        className="mt-4"
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        createHref={createHref}
      />
    </>
  );
}
