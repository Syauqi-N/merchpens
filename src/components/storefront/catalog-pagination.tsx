import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

export type CatalogPaginationProps = {
  page: number;
  totalPages: number;
  /** Membentuk URL untuk sebuah nomor halaman (mempertahankan filter aktif). */
  buildHref: (page: number) => string;
  className?: string;
};

/** Daftar nomor halaman ringkas: 1 … 4 [5] 6 … 12 */
function pageWindow(page: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= totalPages - 2)
    [totalPages - 1, totalPages - 2, totalPages - 3].forEach((p) => pages.add(p));

  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const result: (number | "gap")[] = [];
  let previous = 0;
  for (const current of sorted) {
    if (previous && current - previous > 1) result.push("gap");
    result.push(current);
    previous = current;
  }
  return result;
}

const linkClass =
  "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg border px-3 text-sm font-medium transition-colors";

/** Navigasi halaman katalog — seluruhnya `<Link>` agar tetap client-side navigation. */
export function CatalogPagination({
  page,
  totalPages,
  buildHref,
  className,
}: CatalogPaginationProps) {
  if (totalPages <= 1) return null;

  const current = Math.min(Math.max(1, page), totalPages);
  const items = pageWindow(current, totalPages);

  return (
    <Pagination className={cn("justify-center", className)}>
      <PaginationContent className="gap-1.5">
        <PaginationItem>
          {current > 1 ? (
            <Link
              href={buildHref(current - 1)}
              rel="prev"
              aria-label="Halaman sebelumnya"
              className={cn(
                linkClass,
                "border-white/10 bg-coal text-[#D8D3C7] hover:border-gold/30 hover:bg-gold/10 hover:text-gold",
              )}
            >
              <ChevronLeftIcon className="size-4" aria-hidden />
              <span className="hidden sm:inline">Sebelumnya</span>
            </Link>
          ) : (
            <span
              aria-disabled
              className={cn(
                linkClass,
                "border-white/5 bg-obsidian text-[#6E6E6E]",
              )}
            >
              <ChevronLeftIcon className="size-4" aria-hidden />
              <span className="hidden sm:inline">Sebelumnya</span>
            </span>
          )}
        </PaginationItem>

        {items.map((item, index) =>
          item === "gap" ? (
            <PaginationItem key={`gap-${index}`}>
              <PaginationEllipsis className="size-9 text-[#8A8A8A]" />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <Link
                href={buildHref(item)}
                aria-current={item === current ? "page" : undefined}
                aria-label={`Halaman ${item}`}
                className={cn(
                  linkClass,
                  "tabular-nums",
                  item === current
                    ? "border-sky-600 bg-gold text-obsidian"
                    : "border-white/10 bg-coal text-[#D8D3C7] hover:border-gold/30 hover:bg-gold/10 hover:text-gold",
                )}
              >
                {item}
              </Link>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          {current < totalPages ? (
            <Link
              href={buildHref(current + 1)}
              rel="next"
              aria-label="Halaman berikutnya"
              className={cn(
                linkClass,
                "border-white/10 bg-coal text-[#D8D3C7] hover:border-gold/30 hover:bg-gold/10 hover:text-gold",
              )}
            >
              <span className="hidden sm:inline">Berikutnya</span>
              <ChevronRightIcon className="size-4" aria-hidden />
            </Link>
          ) : (
            <span
              aria-disabled
              className={cn(linkClass, "border-white/5 bg-obsidian text-[#6E6E6E]")}
            >
              <span className="hidden sm:inline">Berikutnya</span>
              <ChevronRightIcon className="size-4" aria-hidden />
            </span>
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
