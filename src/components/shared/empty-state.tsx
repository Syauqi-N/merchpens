import type { ReactNode } from "react";
import { InboxIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  /** Ikon kustom; bawaannya ikon kotak kosong. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Tombol/tautan aksi, mis. <Link href="/produk">Lihat produk</Link>. */
  action?: ReactNode;
  className?: string;
};

/** Tampilan "belum ada data" yang dipakai ulang di katalog, keranjang, pesanan, admin. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-obsidian/60 px-6 py-14 text-center",
        className,
      )}
    >
      <span
        aria-hidden
        className="grid size-12 shrink-0 place-items-center rounded-2xl bg-coal text-gold ring-1 ring-white/10 [&_svg]:size-6"
      >
        {icon ?? <InboxIcon />}
      </span>

      <h3 className="mt-4 text-base font-semibold text-cream">{title}</h3>

      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-cream-muted">{description}</p>
      )}

      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
