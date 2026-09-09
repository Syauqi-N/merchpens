import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type SectionHeadingProps = {
  /** Nomor urut bagian ala kabinet, mis. "01" — pembeda dari toko generik. */
  number?: string;
  /** Label kecil di atas judul, mis. "Pre-Order". */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Tautan "Lihat semua" di kanan judul. */
  actionHref?: string;
  actionLabel?: string;
  /** Elemen aksi kustom (menggantikan tautan di atas). */
  action?: ReactNode;
  className?: string;
};

/** Judul bagian yang dipakai berulang di beranda, katalog, dan halaman PO. */
export function SectionHeading({
  number,
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel = "Lihat semua",
  action,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3",
        className,
      )}
    >
      <div className="min-w-0">
        {(number || eyebrow) && (
          <p className="flex items-center gap-3 text-xs font-bold tracking-[0.22em] text-gold uppercase">
            {number && (
              <span className="font-display text-sm font-extrabold">
                {number}
              </span>
            )}
            <span aria-hidden className="h-px w-8 bg-gold/50" />
            {eyebrow && <span>{eyebrow}</span>}
          </p>
        )}
        <h2 className="font-display mt-2 text-xl font-extrabold tracking-tight text-cream uppercase sm:text-2xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-cream-muted">{description}</p>
        )}
      </div>

      {action ??
        (actionHref && (
          <Link
            href={actionHref}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-gold transition-colors hover:bg-gold/10 hover:text-gold-light"
          >
            {actionLabel}
            <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        ))}
    </div>
  );
}
