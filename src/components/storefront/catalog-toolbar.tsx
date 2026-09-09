import Link from "next/link";
import Form from "next/form";
import { SearchIcon, XIcon } from "lucide-react";

import { SortSelect } from "@/components/storefront/sort-select";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Query katalog: parsing & pembentukan URL
// ---------------------------------------------------------------------------

export const SORT_OPTIONS = [
  { value: "terbaru", label: "Terbaru" },
  { value: "termurah", label: "Harga terendah" },
  { value: "termahal", label: "Harga tertinggi" },
  { value: "nama", label: "Nama A-Z" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export const DEFAULT_SORT: SortKey = "terbaru";

export type SearchParamValue = string | string[] | undefined;

/** Ambil satu nilai dari `searchParams` (array diambil elemen pertama). */
export function firstParam(value: SearchParamValue): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseSort(value: SearchParamValue): SortKey {
  const raw = firstParam(value);
  return SORT_OPTIONS.some((option) => option.value === raw)
    ? (raw as SortKey)
    : DEFAULT_SORT;
}

export function parsePage(value: SearchParamValue): number {
  const parsed = Number.parseInt(firstParam(value) ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export type CatalogQuery = {
  q?: string;
  kategori?: string;
  sort: SortKey;
  page: number;
};

/**
 * Bentuk URL katalog dari kondisi filter saat ini + perubahan yang diminta.
 * Nilai bawaan (sort "terbaru", halaman 1) sengaja tidak ditulis ke URL.
 */
export function buildCatalogHref(
  basePath: string,
  query: CatalogQuery,
  overrides: Partial<CatalogQuery> = {},
): string {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.kategori) params.set("kategori", next.kategori);
  if (next.sort && next.sort !== DEFAULT_SORT) params.set("sort", next.sort);
  if (next.page && next.page > 1) params.set("page", String(next.page));

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

// ---------------------------------------------------------------------------
// Komponen
// ---------------------------------------------------------------------------

export type CatalogToolbarProps = {
  /** Path dasar, mis. "/produk" atau "/kategori/endodontik". */
  basePath: string;
  query: CatalogQuery;
  /** Jumlah produk yang cocok — ditampilkan sebagai ringkasan. */
  totalCount?: number;
  className?: string;
};

/**
 * Baris kontrol katalog: pencarian dan urutan.
 *
 * Tidak ada filter jenis produk: seluruh produk dijual lewat periode pre-order
 * berkuota, jadi tidak ada yang bisa dibedakan.
 *
 * Server Component. Pencarian memakai `next/form` sehingga tetap berfungsi
 * tanpa JavaScript dan otomatis melakukan navigasi sisi klien bila tersedia.
 */
export function CatalogToolbar({
  basePath,
  query,
  totalCount,
  className,
}: CatalogToolbarProps) {
  const sortOptions = SORT_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    href: buildCatalogHref(basePath, query, { sort: option.value, page: 1 }),
  }));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2.5">
        <Form action={basePath} className="relative min-w-0 flex-1 sm:max-w-md">
          {/* Filter aktif ikut terbawa; halaman selalu kembali ke 1. */}
          {query.kategori && (
            <input type="hidden" name="kategori" value={query.kategori} />
          )}
          {query.sort !== DEFAULT_SORT && (
            <input type="hidden" name="sort" value={query.sort} />
          )}

          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8A8A8A]"
          />
          <input
            type="search"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Cari nama alat, merek, atau kode…"
            aria-label="Cari produk"
            className="h-9 w-full rounded-lg border border-white/10 bg-coal pr-3 pl-9 text-sm text-cream outline-none placeholder:text-[#8A8A8A] focus:border-sky-500 focus:ring-3 focus:ring-gold/50/25"
          />
          <button type="submit" className="sr-only">
            Cari
          </button>
        </Form>

        <SortSelect value={query.sort} options={sortOptions} />
      </div>

      {(query.q || typeof totalCount === "number") && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-cream-muted">
          {typeof totalCount === "number" && (
            <span>
              <span className="font-medium text-cream tabular-nums">
                {totalCount}
              </span>{" "}
              produk ditemukan
            </span>
          )}
          {query.q && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-raise py-1 pr-1 pl-3 text-xs text-[#D8D3C7]">
              Pencarian: “{query.q}”
              <Link
                href={buildCatalogHref(basePath, query, { q: undefined, page: 1 })}
                aria-label="Hapus kata kunci pencarian"
                className="grid size-5 place-items-center rounded-full text-cream-muted transition-colors hover:bg-[#2A2A2A] hover:text-cream"
              >
                <XIcon className="size-3.5" aria-hidden />
              </Link>
            </span>
          )}
        </p>
      )}
    </div>
  );
}
