import type { PreOrderStatus } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

import { PREORDER_STATUS_BADGE, PREORDER_STATUS_LABEL } from "./schemas";

/**
 * Penanda keadaan periode PO — komponen presentasional murni.
 *
 * Keputusan "terbuka atau tidak" TIDAK dihitung di sini: nilainya diambil dari
 * `isPeriodOpen()` (lib/preorder.ts) oleh halaman pemanggil lalu dikirim lewat
 * prop `isOpen`. Dengan begitu hanya ada satu tempat yang mendefinisikan aturan
 * buka/tutup, dan komponen ini cukup memilih kata-katanya.
 */

const BASE =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset whitespace-nowrap";

export type PeriodStateInfo = {
  label: string;
  className: string;
  description: string;
};

export function describePeriod(
  period: { status: PreOrderStatus; startAt: Date; endAt: Date },
  isOpen: boolean,
  now: Date = new Date(),
): PeriodStateInfo {
  if (isOpen) {
    return {
      label: "Sedang Terbuka",
      className: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
      description: "Pelanggan bisa memesan sampai tanggal berakhir.",
    };
  }

  if (period.status === "CLOSED") {
    return {
      label: "Ditutup Manual",
      className: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
      description: "Ditutup admin lebih awal.",
    };
  }

  if (period.status === "DRAFT") {
    return {
      label: "Draf",
      className: "bg-raise text-cream-muted ring-white/10",
      description: "Belum tampil ke pelanggan.",
    };
  }

  // Status ACTIVE tetapi di luar rentang tanggal.
  if (period.startAt > now) {
    return {
      label: "Terjadwal",
      className: "bg-gold/10 text-gold ring-gold/30",
      description: "Akan terbuka sendiri saat tanggal mulai tiba.",
    };
  }

  return {
    label: "Tertutup Otomatis",
    className: "bg-amber-500/10 text-amber-200 ring-amber-500/30",
    description: "Tanggal berakhir sudah lewat — tidak perlu tindakan admin.",
  };
}

export function PeriodStateBadge({
  state,
  className,
}: {
  state: PeriodStateInfo;
  className?: string;
}) {
  return (
    <span className={cn(BASE, state.className, className)}>
      {state.label === "Sedang Terbuka" ? (
        <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
      ) : null}
      {state.label}
    </span>
  );
}

/** Lencana status mentah (DRAFT/ACTIVE/CLOSED) apa adanya dari database. */
export function PeriodStatusBadge({
  status,
  className,
}: {
  status: PreOrderStatus;
  className?: string;
}) {
  return (
    <span className={cn(BASE, PREORDER_STATUS_BADGE[status], className)}>
      {PREORDER_STATUS_LABEL[status]}
    </span>
  );
}
