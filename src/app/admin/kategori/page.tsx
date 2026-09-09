import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { TagsIcon } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ensurePageCapability } from "@/components/admin/guard";
import { prisma } from "@/lib/prisma";
import { CategoryFormDialog } from "./category-form";
import { CategoryActiveToggle, CategoryDeleteButton } from "./category-row-actions";
import type { CategoryFormValues } from "./schemas";

export const metadata: Metadata = { title: "Kategori" };

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  formValues: CategoryFormValues;
};

export default async function AdminCategoriesPage() {
  await ensurePageCapability("MANAGE_CATALOG", "/admin/kategori");

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  const rows: CategoryRow[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imageUrl: category.imageUrl,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    productCount: category._count.products,
    formValues: {
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      imageUrl: category.imageUrl ?? "",
      sortOrder: String(category.sortOrder),
      isActive: category.isActive,
    },
  }));

  const nextSortOrder =
    rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.sortOrder)) + 1;

  const columns: DataTableColumn<CategoryRow>[] = [
    {
      key: "order",
      header: "Urutan",
      className: "w-16 text-center text-sm tabular-nums text-cream-muted",
      headerClassName: "w-16 text-center",
      cell: (row) => row.sortOrder,
    },
    {
      key: "category",
      header: "Kategori",
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
                <TagsIcon className="size-4" aria-hidden />
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium text-cream">{row.name}</p>
            <p className="truncate font-mono text-xs text-cream-muted">/{row.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "description",
      header: "Deskripsi",
      className: "max-w-sm whitespace-normal text-sm text-cream-muted",
      cell: (row) =>
        row.description ? (
          <span className="line-clamp-2">{row.description}</span>
        ) : (
          <span className="text-[#8A8A8A]">—</span>
        ),
    },
    {
      key: "products",
      header: "Produk",
      className: "text-center",
      headerClassName: "text-center",
      cell: (row) =>
        row.productCount === 0 ? (
          <span className="text-sm text-[#8A8A8A]">0</span>
        ) : (
          <Link
            href={`/admin/produk?kategori=${encodeURIComponent(row.slug)}`}
            className="text-sm font-medium text-gold tabular-nums hover:underline"
          >
            {row.productCount}
          </Link>
        ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <CategoryActiveToggle id={row.id} name={row.name} isActive={row.isActive} />
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Aksi</span>,
      className: "text-right",
      headerClassName: "text-right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <CategoryFormDialog
            mode="edit"
            categoryId={row.id}
            categoryName={row.name}
            defaultValues={row.formValues}
          />
          <CategoryDeleteButton
            id={row.id}
            name={row.name}
            productCount={row.productCount}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Kategori"
        description="Pengelompokan produk yang dipakai untuk menyaring katalog. Kategori nonaktif tidak muncul di toko."
        action={<CategoryFormDialog mode="create" nextSortOrder={nextSortOrder} />}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty={
          <div className="flex flex-col items-center gap-2">
            <TagsIcon className="size-8 text-[#6E6E6E]" aria-hidden />
            <p className="font-medium text-[#D8D3C7]">Belum ada kategori</p>
            <p className="text-sm text-cream-muted">
              Tambahkan kategori terlebih dahulu sebelum membuat produk.
            </p>
          </div>
        }
      />
    </>
  );
}
