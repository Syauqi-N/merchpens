import type { ComponentType, ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  /** Warna aksen ikon: biru (netral), kuning (perlu perhatian), hijau (positif), merah (kritis). */
  tone?: "sky" | "amber" | "emerald" | "rose" | "slate";
  href?: string;
  className?: string;
};

const TONE_CLASS: Record<NonNullable<StatCardProps["tone"]>, string> = {
  sky: "bg-gold/10 text-gold",
  amber: "bg-amber-500/10 text-amber-300",
  emerald: "bg-emerald-500/10 text-emerald-300",
  rose: "bg-rose-500/10 text-rose-300",
  slate: "bg-raise text-[#D8D3C7]",
};

/** Kartu ringkasan angka untuk dashboard admin. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "sky",
  href,
  className,
}: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-cream-muted">{label}</p>
        {Icon && (
          <span
            aria-hidden
            className={cn("grid size-9 shrink-0 place-items-center rounded-lg", TONE_CLASS[tone])}
          >
            <Icon className="size-4.5" />
          </span>
        )}
      </div>

      <p className="mt-2 text-2xl font-semibold text-cream tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-cream-muted">{hint}</p>}
    </>
  );

  const base = cn(
    "rounded-xl border border-white/10 bg-coal p-4",
    href && "transition-colors hover:border-sky-300 hover:bg-gold/10/40",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cn(base, "block outline-none focus-visible:ring-3 focus-visible:ring-gold/50/40")}>
        {body}
      </Link>
    );
  }

  return <div className={base}>{body}</div>;
}
