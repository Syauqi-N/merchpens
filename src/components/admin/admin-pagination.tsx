import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type AdminPaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  /** Membangun URL untuk sebuah nomor halaman (mempertahankan filter aktif). */
  createHref: (page: number) => string;
  className?: string;
};

/** Daftar nomor halaman ringkas: 1 … 4 [5] 6 … 12 */
function pageNumbers(page: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: (number | "gap")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) items.push("gap");
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < totalPages - 1) items.push("gap");

  items.push(totalPages);
  return items;
}

const linkClass =
  "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg border px-2.5 text-sm font-medium transition-colors";

/** Navigasi halaman berbasis tautan (tetap berfungsi tanpa JavaScript). */
export function AdminPagination({
  page,
  totalPages,
  totalItems,
  createHref,
  className,
}: AdminPaginationProps) {
  if (totalPages <= 1) {
    return (
      <p className={cn("text-sm text-cream-muted", className)}>
        Total {totalItems} data.
      </p>
    );
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 sm:flex-row",
        className,
      )}
    >
      <p className="text-sm text-cream-muted">
        Halaman {page} dari {totalPages} · Total {totalItems} data
      </p>

      <nav aria-label="Navigasi halaman" className="flex items-center gap-1">
        {hasPrev ? (
          <Link
            href={createHref(page - 1)}
            aria-label="Halaman sebelumnya"
            className={cn(linkClass, "border-white/10 bg-coal text-[#D8D3C7] hover:bg-obsidian")}
          >
            <ChevronLeftIcon className="size-4" aria-hidden />
            <span className="hidden sm:inline">Sebelumnya</span>
          </Link>
        ) : (
          <span
            aria-hidden
            className={cn(linkClass, "cursor-not-allowed border-white/10 bg-obsidian text-[#6E6E6E]")}
          >
            <ChevronLeftIcon className="size-4" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </span>
        )}

        {pageNumbers(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <span key={`gap-${index}`} className="px-1 text-[#8A8A8A]" aria-hidden>
              …
            </span>
          ) : (
            <Link
              key={item}
              href={createHref(item)}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                linkClass,
                item === page
                  ? "border-sky-600 bg-gold text-obsidian"
                  : "border-white/10 bg-coal text-[#D8D3C7] hover:bg-obsidian",
              )}
            >
              {item}
            </Link>
          ),
        )}

        {hasNext ? (
          <Link
            href={createHref(page + 1)}
            aria-label="Halaman berikutnya"
            className={cn(linkClass, "border-white/10 bg-coal text-[#D8D3C7] hover:bg-obsidian")}
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <ChevronRightIcon className="size-4" aria-hidden />
          </Link>
        ) : (
          <span
            aria-hidden
            className={cn(linkClass, "cursor-not-allowed border-white/10 bg-obsidian text-[#6E6E6E]")}
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <ChevronRightIcon className="size-4" />
          </span>
        )}
      </nav>
    </div>
  );
}
