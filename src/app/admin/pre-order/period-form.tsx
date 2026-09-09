"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { DateTimePicker } from "@/components/admin/date-time-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PreOrderStatus } from "@/generated/prisma/client";
import { slugify } from "@/lib/format";
import { cn } from "@/lib/utils";

import { createPeriod, updatePeriod } from "./actions";
import {
  PREORDER_STATUS_HINT,
  PREORDER_STATUS_LABEL,
  toDateTimeLocalValue,
  type PeriodFieldName,
} from "./schemas";

export type PeriodFormValues = {
  name: string;
  slug: string;
  description: string;
  startAt: string;
  endAt: string;
  estimatedPickupAt: string;
  pickupLocation: string;
  pickupSchedule: string;
  pickupNote: string;
  shippingNote: string;
  status: PreOrderStatus;
};

const STATUS_VALUES = ["DRAFT", "ACTIVE", "CLOSED"] as const satisfies readonly PreOrderStatus[];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-rose-600">{message}</p>;
}

/**
 * Form periode PO, dipakai bersama oleh halaman "baru" dan halaman ubah.
 *
 * Validasi yang mengikat tetap ada di Server Action; pesan galat per field
 * yang tampil di sini datang dari sana (`fieldErrors`), bukan dari pemeriksaan
 * terpisah di klien — supaya keduanya tidak pernah berbeda pendapat.
 */
export function PeriodForm({
  mode,
  periodId,
  initial,
  pickupLeadDays = 30,
}: {
  mode: "create" | "edit";
  periodId?: string;
  initial: PeriodFormValues;
  /** Default global; hanya dipakai untuk mengikuti perubahan tanggal tutup pada form baru. */
  pickupLeadDays?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<PeriodFormValues>(initial);
  const [errors, setErrors] = useState<Partial<Record<PeriodFieldName, string>>>({});
  // Setelah admin menyunting slug sendiri, berhenti menurunkannya dari nama.
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  // Pada periode baru estimasi mengikuti endAt sampai admin mengubahnya sendiri.
  const [pickupEstimateTouched, setPickupEstimateTouched] = useState(mode === "edit");

  function setField<K extends keyof PeriodFormValues>(key: K, value: PeriodFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  function handleEndAtChange(value: string) {
    setValues((previous) => {
      if (pickupEstimateTouched || value === "") {
        return { ...previous, endAt: value };
      }

      const endAt = new Date(value);
      if (Number.isNaN(endAt.getTime())) {
        return { ...previous, endAt: value };
      }

      const estimated = new Date(
        endAt.getTime() + pickupLeadDays * 24 * 60 * 60 * 1000,
      );
      return {
        ...previous,
        endAt: value,
        estimatedPickupAt: toDateTimeLocalValue(estimated),
      };
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createPeriod(values)
          : await updatePeriod({ periodId, values });

      if (result.ok) {
        setErrors({});
        toast.success(result.message);
        if (mode === "create") {
          router.push(`/admin/pre-order/${result.periodId}`);
        } else {
          router.refresh();
        }
        return;
      }

      setErrors(result.fieldErrors ?? {});
      toast.error(result.message);
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{mode === "create" ? "Data Periode" : "Ubah Data Periode"}</CardTitle>
        <CardDescription>
          Periode terbuka otomatis di antara tanggal mulai dan berakhir selama statusnya Aktif.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="period-name">Nama periode</Label>
            <Input
              id="period-name"
              value={values.name}
              onChange={(event) => {
                const name = event.target.value;
                setField("name", name);
                if (!slugTouched) setField("slug", slugify(name));
              }}
              placeholder="PO Batch Agustus 2026"
              aria-invalid={Boolean(errors.name)}
              className="h-9"
            />
            <FieldError message={errors.name} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="period-slug">Slug</Label>
            <Input
              id="period-slug"
              value={values.slug}
              onChange={(event) => {
                setSlugTouched(true);
                setField("slug", event.target.value);
              }}
              placeholder="po-batch-agustus-2026"
              aria-invalid={Boolean(errors.slug)}
              className="h-9 font-mono text-sm"
            />
            <p className="text-xs text-cream-muted">
              Dipakai pada URL halaman pre-order. Huruf kecil, angka, dan tanda hubung saja.
            </p>
            <FieldError message={errors.slug} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="period-description">Deskripsi (opsional)</Label>
            <Textarea
              id="period-description"
              value={values.description}
              onChange={(event) => setField("description", event.target.value)}
              placeholder="Perkiraan barang tiba, syarat pembayaran, dan catatan lain untuk pelanggan."
              rows={4}
              aria-invalid={Boolean(errors.description)}
            />
            <FieldError message={errors.description} />
          </div>

          <div className="grid items-start gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="period-start">Tanggal & jam mulai</Label>
              <DateTimePicker
                id="period-start"
                value={values.startAt}
                onChange={(value) => setField("startAt", value)}
                invalid={Boolean(errors.startAt)}
              />
              <FieldError message={errors.startAt} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="period-end">Tanggal & jam berakhir</Label>
              <DateTimePicker
                id="period-end"
                value={values.endAt}
                min={values.startAt || undefined}
                onChange={handleEndAtChange}
                invalid={Boolean(errors.endAt)}
              />
              <p className="text-xs text-cream-muted">
                Lewat jam ini, pemesanan berhenti sendiri tanpa tindakan admin.
              </p>
              <FieldError message={errors.endAt} />
            </div>
          </div>

          <section className="grid gap-4 border-t border-white/10 pt-5">
            <div>
              <h3 className="text-sm font-semibold text-cream">
                Informasi Pengambilan Barang
              </h3>
              <p className="mt-1 text-xs text-cream-muted">
                Nilai awal berasal dari pengaturan Admin → Beranda. Perubahan di
                sini hanya berlaku untuk periode ini.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="period-estimated-pickup">
                Estimasi mulai bisa diambil
              </Label>
              <DateTimePicker
                id="period-estimated-pickup"
                value={values.estimatedPickupAt}
                min={values.endAt || undefined}
                onChange={(value) => {
                  setPickupEstimateTouched(true);
                  setField("estimatedPickupAt", value);
                }}
                invalid={Boolean(errors.estimatedPickupAt)}
              />
              <p className="text-xs text-cream-muted">
                {mode === "create"
                  ? `Estimasi awal ${pickupLeadDays} hari setelah periode ditutup. `
                  : ""}
                Admin tetap perlu mengabari pembeli bila barang datang lebih cepat
                atau terlambat.
              </p>
              <FieldError message={errors.estimatedPickupAt} />
            </div>

            <div className="grid items-start gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="period-pickup-location">Lokasi pengambilan</Label>
                <Input
                  id="period-pickup-location"
                  value={values.pickupLocation}
                  onChange={(event) =>
                    setField("pickupLocation", event.target.value)
                  }
                  placeholder="Sekretariat, Kampus PENS"
                  aria-invalid={Boolean(errors.pickupLocation)}
                  className="h-9"
                />
                <FieldError message={errors.pickupLocation} />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="period-pickup-schedule">Jadwal pengambilan</Label>
                <Input
                  id="period-pickup-schedule"
                  value={values.pickupSchedule}
                  onChange={(event) =>
                    setField("pickupSchedule", event.target.value)
                  }
                  placeholder="Senin-Jumat, 10.00-15.00 WIB"
                  aria-invalid={Boolean(errors.pickupSchedule)}
                  className="h-9"
                />
                <FieldError message={errors.pickupSchedule} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="period-pickup-note">
                Catatan pengambilan (opsional)
              </Label>
              <Textarea
                id="period-pickup-note"
                value={values.pickupNote}
                onChange={(event) => setField("pickupNote", event.target.value)}
                placeholder="Tunjukkan kode pesanan ke panitia."
                rows={3}
                aria-invalid={Boolean(errors.pickupNote)}
              />
              <FieldError message={errors.pickupNote} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="period-shipping-note">
                Catatan pengiriman (opsional)
              </Label>
              <Textarea
                id="period-shipping-note"
                value={values.shippingNote}
                onChange={(event) => setField("shippingNote", event.target.value)}
                placeholder="Estimasi mulai kirim, info ongkir manual via WhatsApp admin, dsb."
                rows={3}
                aria-invalid={Boolean(errors.shippingNote)}
              />
              <p className="text-xs text-cream-muted">
                Ongkir tetap dibayar manual via WhatsApp admin — tulis petunjuknya di sini.
              </p>
              <FieldError message={errors.shippingNote} />
            </div>
          </section>

          <div className="grid gap-1.5">
            <Label htmlFor="period-status">Status</Label>
            <Select
              value={values.status}
              onValueChange={(value) =>
                setField("status", (value ?? "DRAFT") as PreOrderStatus)
              }
            >
              <SelectTrigger id="period-status" className={cn("h-9 w-full sm:w-64")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_VALUES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {PREORDER_STATUS_LABEL[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-cream-muted">{PREORDER_STATUS_HINT[values.status]}</p>
            <FieldError message={errors.status} />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? (
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
              ) : (
                <SaveIcon className="size-4" aria-hidden />
              )}
              {mode === "create" ? "Buat Periode" : "Simpan Perubahan"}
            </Button>

            <Button
              nativeButton={false}
              type="button"
              variant="outline"
              size="lg"
              disabled={pending}
              render={<Link href="/admin/pre-order" />}
            >
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
