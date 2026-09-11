import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, InfoIcon } from "lucide-react";

import { ensurePageCapability } from "@/components/admin/guard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getPickupDefaults, getSettings } from "@/lib/settings";

import { PeriodForm, type PeriodFormValues } from "../period-form";
import { toDateTimeLocalValue } from "../schemas";

export const metadata: Metadata = {
  title: "Buat Periode Pre-Order",
};

const HARI = 24 * 60 * 60 * 1000;

export default async function NewPreOrderPeriodPage() {
  await ensurePageCapability("MANAGE_CATALOG", "/admin/pre-order/baru");

  const start = new Date();
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 14 * HARI);
  const [pickup, settings] = await Promise.all([getPickupDefaults(), getSettings()]);
  const estimatedPickupAt = new Date(end.getTime() + pickup.leadDays * HARI);

  const initial: PeriodFormValues = {
    name: "",
    slug: "",
    description: "",
    startAt: toDateTimeLocalValue(start),
    endAt: toDateTimeLocalValue(end),
    estimatedPickupAt: toDateTimeLocalValue(estimatedPickupAt),
    pickupLocation: pickup.location,
    pickupSchedule: pickup.schedule,
    pickupNote: pickup.note,
    shippingNote: "",
    whatsappGroupUrl: settings.whatsapp_group_url ?? "",
    status: "DRAFT",
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/pre-order"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-cream-muted transition-colors hover:text-gold"
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
          Kembali ke daftar periode
        </Link>

        <div>
          <h1 className="text-xl font-semibold text-cream">Buat Periode Pre-Order</h1>
          <p className="mt-1 text-sm text-cream-muted">
            Simpan periodenya lebih dulu, lalu tambahkan produk & kuota tiap varian.
          </p>
        </div>
      </div>

      <Alert className="border-gold/30 bg-gold/10 text-gold-light">
        <InfoIcon className="size-4 text-gold" aria-hidden />
        <AlertTitle>Mulai dari status Draf</AlertTitle>
        <AlertDescription className="text-gold-light/90">
          Periode berstatus <strong>Draf</strong> belum terlihat pelanggan, jadi kamu bisa
          menyusun daftar produk dan kuotanya dengan tenang. Ubah ke <strong>Aktif</strong> kalau
          semua sudah siap — pemesanan lalu berjalan otomatis sesuai rentang tanggal di bawah.
          Dalam satu waktu hanya boleh ada <strong>satu periode yang terbuka</strong>.
        </AlertDescription>
      </Alert>

      <div className="max-w-3xl">
        <PeriodForm mode="create" initial={initial} pickupLeadDays={pickup.leadDays} />
      </div>
    </div>
  );
}
