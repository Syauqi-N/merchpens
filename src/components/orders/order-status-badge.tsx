import {
  BanIcon,
  CheckCircle2Icon,
  ClockIcon,
  CreditCardIcon,
  PackageCheckIcon,
  TimerOffIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_BADGE, ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Lencana status pesanan — SATU komponen untuk etalase maupun panel admin.
 * Label dan warnanya berasal dari `@/lib/format`; di sini hanya bentuknya yang
 * berbeda: etalase memakai lencana berikon, admin memakai pil ber-ring.
 *
 * Komponen presentasional murni (tanpa `"use client"`) supaya bisa dipakai di
 * Server Component maupun di dalam panel aksi klien.
 */

/** Kelas dasar pil status admin — dipakai juga lencana pembayaran & pre-order. */
export const STATUS_PILL_BASE =
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset whitespace-nowrap";

/** Ikon pendamping tiap status (hanya varian `storefront`). */
const STATUS_ICON: Record<string, typeof ClockIcon> = {
  PENDING_PAYMENT: ClockIcon,
  INSTALLMENT_PENDING: ClockIcon,
  PAID: CreditCardIcon,
  PROCESSING: PackageCheckIcon,
  COMPLETED: CheckCircle2Icon,
  CANCELLED: BanIcon,
  EXPIRED: TimerOffIcon,
};

export type OrderStatusBadgeVariant = "storefront" | "admin";

export function OrderStatusBadge({
  status,
  variant = "storefront",
  className,
}: {
  status: string;
  variant?: OrderStatusBadgeVariant;
  className?: string;
}) {
  const label = ORDER_STATUS_LABEL[status] ?? status;

  if (variant === "admin") {
    return (
      <span
        className={cn(
          STATUS_PILL_BASE,
          ORDER_STATUS_BADGE[status] ?? "bg-raise text-cream-muted ring-white/10",
          className,
        )}
      >
        {label}
      </span>
    );
  }

  const Icon = STATUS_ICON[status] ?? ClockIcon;

  return (
    <Badge className={cn(ORDER_STATUS_CLASS[status] ?? "bg-raise text-[#D8D3C7]", className)}>
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}
