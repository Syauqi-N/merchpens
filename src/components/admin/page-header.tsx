import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type AdminPageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Tombol aksi utama di sisi kanan (mis. "Tambah Produk"). */
  action?: ReactNode;
  className?: string;
};

/** Judul + deskripsi + aksi untuk setiap halaman panel admin. */
export function AdminPageHeader({
  title,
  description,
  action,
  className,
}: AdminPageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl font-semibold text-cream sm:text-2xl">{title}</h1>
        {description && (
          <div className="max-w-2xl text-sm text-cream-muted">{description}</div>
        )}
      </div>

      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
