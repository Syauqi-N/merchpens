import {
  CalendarClockIcon,
  InfoIcon,
  MapPinIcon,
  TruckIcon,
} from "lucide-react";

import type { PickupInfo } from "@/lib/settings";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Potongan tampilan "terima barang" yang dipakai bersama oleh detail
 * pesanan customer dan detail pesanan admin.
 *
 * Dua mode: PICKUP (ambil di kampus) dan SHIPPED (kirim ke alamat, ongkir
 * manual via WhatsApp admin).
 *
 * Semuanya presentasional murni (tanpa `"use client"`) supaya bisa dirender
 * langsung di Server Component.
 */

function PickupRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPinIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-cream-muted">{label}</p>
        <p className="text-sm whitespace-pre-line text-cream">{children}</p>
      </div>
    </div>
  );
}

/**
 * Tempat, jadwal, dan catatan pengambilan barang, lengkap dengan pengingat
 * menunjukkan kode pesanan ke panitia.
 */
export function PickupDetails({
  pickup,
  orderNumber,
  className,
}: {
  pickup: PickupInfo;
  orderNumber: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <PickupRow icon={MapPinIcon} label="Tempat pengambilan">
        {pickup.location}
      </PickupRow>
      <PickupRow icon={CalendarClockIcon} label="Jadwal pengambilan">
        {pickup.schedule}
      </PickupRow>
      {pickup.note.trim() ? (
        <PickupRow icon={InfoIcon} label="Catatan panitia">
          {pickup.note}
        </PickupRow>
      ) : null}

      <p className="rounded-lg bg-gold/10 p-3 text-xs leading-relaxed text-gold-light ring-1 ring-inset ring-gold/20">
        Tunjukkan kode pesanan{" "}
        <span className="font-mono font-semibold">{orderNumber}</span> ke panitia
        saat mengambil barang.
      </p>
    </div>
  );
}

export type PeriodPickupInfo = {
  id: string;
  name: string;
  estimatedPickupAt: Date;
  pickupLocation: string;
  pickupSchedule: string;
  pickupNote: string;
  shippingNote?: string | null;
};

/** Informasi pengambilan yang sudah dibekukan dan dapat diedit per periode PO. */
export function PeriodPickupDetails({
  periods,
  orderNumber,
  className,
}: {
  periods: PeriodPickupInfo[];
  orderNumber: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {periods.map((period) => (
        <section
          key={period.id}
          className="space-y-3 rounded-xl border border-gold/20 bg-gold/10/50 p-3"
        >
          <p className="text-sm font-semibold text-gold-light">{period.name}</p>
          <PickupRow icon={CalendarClockIcon} label="Estimasi mulai bisa diambil">
            {formatDateTime(period.estimatedPickupAt)}
          </PickupRow>
          <PickupRow icon={MapPinIcon} label="Tempat pengambilan">
            {period.pickupLocation}
          </PickupRow>
          <PickupRow icon={CalendarClockIcon} label="Jadwal pengambilan">
            {period.pickupSchedule}
          </PickupRow>
          {period.pickupNote.trim() ? (
            <PickupRow icon={InfoIcon} label="Catatan panitia">
              {period.pickupNote}
            </PickupRow>
          ) : null}
          {period.shippingNote?.trim() ? (
            <PickupRow icon={TruckIcon} label="Info pengiriman batch ini">
              {period.shippingNote}
            </PickupRow>
          ) : null}
        </section>
      ))}

      <p className="rounded-lg bg-gold/10 p-3 text-xs leading-relaxed text-gold-light ring-1 ring-inset ring-gold/20">
        Estimasi dapat berubah mengikuti kedatangan barang. Tunjukkan kode
        pesanan <span className="font-mono font-semibold">{orderNumber}</span> ke
        panitia saat mengambil barang.
      </p>
    </div>
  );
}

/** Alamat pengiriman untuk pesanan dengan opsi kirim. */
export function ShippingAddressDetails({
  address,
  className,
}: {
  address: string | null;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {address?.trim() ? (
        <address className="text-sm whitespace-pre-line text-cream not-italic">
          {address}
        </address>
      ) : (
        <p className="text-sm text-cream-muted">Alamat belum diisi.</p>
      )}

      <p className="rounded-lg bg-gold/10 p-3 text-xs leading-relaxed text-gold-light ring-1 ring-inset ring-gold/20">
        Ongkir <strong>tidak termasuk</strong> pembayaran gateway. Selesaikan
        ongkir manual via WhatsApp admin memakai tombol di halaman ini.
      </p>
    </div>
  );
}
