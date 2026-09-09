"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilterXIcon, Loader2Icon, SearchIcon } from "lucide-react";

import { DatePicker } from "@/components/admin/date-time-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORDER_STATUS_LABEL } from "@/lib/format";

import { FULFILLMENT_TYPE_VALUES, ORDER_STATUS_VALUES } from "./schemas";

export type OrderFilterState = {
  q: string;
  status: string;
  terima: string;
  dari: string;
  sampai: string;
};

const STATUS_ITEMS = [
  { value: "", label: "Semua status" },
  ...ORDER_STATUS_VALUES.map((value) => ({
    value: value as string,
    label: ORDER_STATUS_LABEL[value],
  })),
];

const FULFILLMENT_LABEL: Record<string, string> = {
  PICKUP: "Ambil di kampus",
  SHIPPED: "Kirim ke alamat",
};

const TERIMA_ITEMS = [
  { value: "", label: "Semua cara terima" },
  ...FULFILLMENT_TYPE_VALUES.map((value) => ({
    value: value as string,
    label: FULFILLMENT_LABEL[value] ?? value,
  })),
];

/**
 * Panel filter daftar pesanan.
 *
 * Seluruh nilai disimpan sebagai state lokal lalu ditulis ke URL saat dikirim,
 * sehingga hasil filter bisa di-bookmark dan tombol back/forward tetap bekerja.
 * Halaman memberi `key` berisi query saat ini agar state panel ikut tersegar
 * setelah navigasi — tidak perlu efek penyelaras.
 *
 * Halaman selalu direset ke 1 setiap filter berubah supaya admin tidak
 * terdampar di halaman kosong ketika jumlah hasil menyusut.
 */
export function OrderFilters({ initial }: { initial: OrderFilterState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(initial.q);
  const [status, setStatus] = useState(initial.status);
  const [terima, setTerima] = useState(initial.terima);
  const [dari, setDari] = useState(initial.dari);
  const [sampai, setSampai] = useState(initial.sampai);

  const hasFilter = Boolean(q || status || terima || dari || sampai);

  function apply(next: Partial<OrderFilterState>) {
    const merged: OrderFilterState = { q, status, terima, dari, sampai, ...next };
    const params = new URLSearchParams();

    // Hanya isi yang terpakai yang masuk URL agar tautannya tetap ringkas.
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/admin/pesanan?${query}` : "/admin/pesanan");
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        apply({});
      }}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="filter-q" className="text-xs text-cream-muted">
          Cari
        </Label>
        <div className="relative">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[#8A8A8A]"
          />
          <Input
            id="filter-q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Nomor pesanan, nama, atau email"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs text-cream-muted">Status pesanan</Label>
        <Select
          items={STATUS_ITEMS}
          value={status}
          onValueChange={(value: string | null) => {
            setStatus(value ?? "");
            apply({ status: value ?? "" });
          }}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ITEMS.map((item) => (
              <SelectItem key={item.value || "all"} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs text-cream-muted">Cara terima</Label>
        <Select
          items={TERIMA_ITEMS}
          value={terima}
          onValueChange={(value: string | null) => {
            setTerima(value ?? "");
            apply({ terima: value ?? "" });
          }}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TERIMA_ITEMS.map((item) => (
              <SelectItem key={item.value || "all"} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="filter-dari" className="text-xs text-cream-muted">
          Dari tanggal
        </Label>
        <DatePicker
          id="filter-dari"
          value={dari}
          max={sampai || undefined}
          onChange={setDari}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="filter-sampai" className="text-xs text-cream-muted">
          Sampai tanggal
        </Label>
        <DatePicker
          id="filter-sampai"
          value={sampai}
          min={dari || undefined}
          onChange={setSampai}
        />
      </div>

      <div className="flex items-end gap-2">
        <Button type="submit" size="lg" disabled={pending} className="gap-1.5">
          {pending ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          ) : (
            <SearchIcon className="size-4" aria-hidden />
          )}
          Terapkan
        </Button>

        {hasFilter ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            aria-label="Bersihkan filter"
            onClick={() => {
              setQ("");
              setStatus("");
              setTerima("");
              setDari("");
              setSampai("");
              startTransition(() => router.push("/admin/pesanan"));
            }}
          >
            <FilterXIcon className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
    </form>
  );
}
