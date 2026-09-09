import type { PaymentStatus } from "@/generated/prisma/client";
import { STATUS_PILL_BASE } from "@/components/orders/order-status-badge";
import { PAYMENT_STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

import { PAYMENT_STATUS_BADGE } from "./schemas";

/**
 * Lencana status pembayaran untuk panel admin — komponen presentasional murni
 * (tanpa `"use client"`) supaya bisa dipakai baik di Server Component maupun di
 * dalam panel aksi klien.
 *
 * Lencana status pesanan sendiri ada di `@/components/orders/order-status-badge`
 * (pakai `variant="admin"`), dipakai bersama etalase agar warnanya tidak
 * berbeda antar halaman.
 *
 * Tidak ada lencana "PRE-ORDER": seluruh pesanan adalah pesanan pre-order, jadi
 * penandanya tidak membedakan apa pun.
 */

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus | null;
  className?: string;
}) {
  if (!status) {
    return (
      <span
        className={cn(STATUS_PILL_BASE, "bg-raise text-cream-muted ring-white/10", className)}
      >
        Belum ada
      </span>
    );
  }

  return (
    <span className={cn(STATUS_PILL_BASE, PAYMENT_STATUS_BADGE[status], className)}>
      {PAYMENT_STATUS_LABEL[status] ?? status}
    </span>
  );
}
