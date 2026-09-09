"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilterXIcon, Loader2Icon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/format";

import {
  CUSTOMER_TYPE_LABEL,
  CUSTOMER_TYPE_VALUES,
  FULFILLMENT_TYPE_LABEL,
  FULFILLMENT_TYPE_VALUES,
  ORDER_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  type RekapFilterState,
  type RekapTab,
} from "./schemas";

/**
 * Panel filter rekap.
 *
 * Nilainya disimpan sebagai state lokal lalu ditulis ke URL — jadi hasil
 * saringan bisa di-bookmark, tombol back/forward tetap bekerja, dan tautan
 * "Unduh Excel" (yang membaca query string yang sama) selalu ikut menyesuaikan.
 *
 * Halaman memberi `key` berisi filter aktif agar state panel ikut tersegar
 * setelah navigasi; tidak perlu efek penyelaras.
 */

/**
 * Base UI Select tidak menerima string kosong sebagai nilai item, jadi opsi
 * "semua" diwakili sentinel ini dan diterjemahkan kembali ke "" saat ditulis
 * ke URL.
 */
const SEMUA = "__semua__";

export type RekapFilterOptionsProps = {
  periode: { id: string; name: string }[];
  produk: { value: string; label: string }[];
  angkatan: string[];
  jurusan: string[];
};

type Draft = {
  periode: string;
  produk: string;
  status: string;
  bayar: string;
  customerType: string;
  fulfillmentType: string;
  angkatan: string;
  jurusan: string;
  q: string;
  sertakanBatal: boolean;
};

function toDraft(filters: RekapFilterState): Draft {
  return {
    periode: filters.periode,
    produk: filters.produk,
    status: filters.status,
    bayar: filters.bayar,
    customerType: filters.customerType,
    fulfillmentType: filters.fulfillmentType,
    angkatan: filters.angkatan,
    jurusan: filters.jurusan,
    q: filters.q,
    sertakanBatal: filters.sertakanBatal,
  };
}

export function RekapFilters({
  initial,
  options,
  tab,
}: {
  initial: RekapFilterState;
  options: RekapFilterOptionsProps;
  /** Tab aktif ikut dibawa supaya panitia tidak terlempar kembali ke tab pertama. */
  tab: RekapTab;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));

  const hasFilter =
    Boolean(
      draft.periode ||
        draft.produk ||
        draft.status ||
        draft.bayar ||
        draft.customerType ||
        draft.fulfillmentType ||
        draft.angkatan ||
        draft.jurusan ||
        draft.q,
    ) || draft.sertakanBatal;

  function push(next: Draft) {
    const params = new URLSearchParams();
    if (next.periode) params.set("periode", next.periode);
    if (next.produk) params.set("produk", next.produk);
    if (next.status) params.set("status", next.status);
    if (next.bayar) params.set("bayar", next.bayar);
    if (next.customerType) params.set("tipe", next.customerType);
    if (next.fulfillmentType) params.set("terima", next.fulfillmentType);
    if (next.angkatan) params.set("angkatan", next.angkatan);
    if (next.jurusan) params.set("jurusan", next.jurusan);
    if (next.q) params.set("q", next.q);
    if (next.sertakanBatal) params.set("batal", "1");
    if (tab !== "pesanan") params.set("tab", tab);

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/admin/rekap?${query}` : "/admin/rekap");
    });
  }

  /** Ubah satu nilai lalu langsung terapkan — dipakai dropdown & centang. */
  function apply(patch: Partial<Draft>) {
    const next = { ...draft, ...patch, q: draft.q.trim() };
    setDraft(next);
    push(next);
  }

  function reset() {
    const kosong: Draft = {
      periode: "",
      produk: "",
      status: "",
      bayar: "",
      customerType: "",
      fulfillmentType: "",
      angkatan: "",
      jurusan: "",
      q: "",
      sertakanBatal: false,
    };
    setDraft(kosong);
    push(kosong);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        apply({});
      }}
      className="grid gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        <div className="grid gap-1.5 sm:col-span-2 xl:col-span-2">
          <Label htmlFor="rekap-q" className="text-xs text-cream-muted">
            Cari
          </Label>
          <div className="relative">
            <SearchIcon
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[#8A8A8A]"
            />
            <Input
              id="rekap-q"
              value={draft.q}
              onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
              placeholder="Kode pesanan, nama, email, atau no HP"
              className="h-9 pl-8"
            />
          </div>
        </div>

        <FilterSelect
          id="rekap-periode"
          label="Periode PO"
          placeholder="Semua periode"
          value={draft.periode}
          items={options.periode.map((period) => ({ value: period.id, label: period.name }))}
          onChange={(value) => apply({ periode: value })}
        />

        <FilterSelect
          id="rekap-produk"
          label="Produk"
          placeholder="Semua produk"
          value={draft.produk}
          items={options.produk}
          onChange={(value) => apply({ produk: value })}
        />

        <FilterSelect
          id="rekap-tipe"
          label="Tipe pembeli"
          placeholder="Semua tipe"
          value={draft.customerType}
          items={CUSTOMER_TYPE_VALUES.map((value) => ({
            value,
            label: CUSTOMER_TYPE_LABEL[value] ?? value,
          }))}
          onChange={(value) => apply({ customerType: value })}
        />

        <FilterSelect
          id="rekap-terima"
          label="Cara terima"
          placeholder="Semua cara"
          value={draft.fulfillmentType}
          items={FULFILLMENT_TYPE_VALUES.map((value) => ({
            value,
            label: FULFILLMENT_TYPE_LABEL[value] ?? value,
          }))}
          onChange={(value) => apply({ fulfillmentType: value })}
        />

        <FilterSelect
          id="rekap-status"
          label="Status pesanan"
          placeholder="Semua status"
          value={draft.status}
          items={ORDER_STATUS_VALUES.map((value) => ({
            value,
            label: ORDER_STATUS_LABEL[value] ?? value,
          }))}
          onChange={(value) => apply({ status: value })}
        />

        <FilterSelect
          id="rekap-bayar"
          label="Status bayar"
          placeholder="Semua pembayaran"
          value={draft.bayar}
          items={PAYMENT_STATUS_VALUES.map((value) => ({
            value,
            label: PAYMENT_STATUS_LABEL[value] ?? value,
          }))}
          onChange={(value) => apply({ bayar: value })}
        />

        <FilterSelect
          id="rekap-angkatan"
          label="Angkatan"
          placeholder="Semua angkatan"
          value={draft.angkatan}
          items={options.angkatan.map((value) => ({ value, label: value }))}
          onChange={(value) => apply({ angkatan: value })}
        />

        <FilterSelect
          id="rekap-jurusan"
          label="Jurusan"
          placeholder="Semua jurusan"
          value={draft.jurusan}
          items={options.jurusan.map((value) => ({ value, label: value }))}
          onChange={(value) => apply({ jurusan: value })}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label
          htmlFor="rekap-batal"
          className="cursor-pointer items-start gap-2 text-xs font-normal text-cream-muted"
        >
          <Checkbox
            id="rekap-batal"
            checked={draft.sertakanBatal}
            onCheckedChange={(checked) => apply({ sertakanBatal: checked === true })}
          />
          <span>
            Tampilkan juga pesanan <strong>Dibatalkan</strong> &amp; <strong>Kadaluarsa</strong>
            <span className="block text-cream-muted">
              Biasanya tidak perlu — barangnya tidak jadi diambil dan uangnya tidak masuk.
            </span>
          </span>
        </Label>

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={pending} className="h-9 gap-1.5">
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
              size="sm"
              className="h-9 gap-1.5"
              disabled={pending}
              onClick={reset}
            >
              <FilterXIcon className="size-4" aria-hidden />
              Bersihkan
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

/** Dropdown filter dengan opsi "semua" di paling atas. */
function FilterSelect({
  id,
  label,
  placeholder,
  value,
  items,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  items: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  // Nilai yang datang dari URL bisa saja tidak ada di daftar (mis. angkatan
  // yang sudah dihapus dari master, atau query string yang diketik tangan).
  // Ditambahkan sebagai opsi agar filternya tetap terlihat — dan karena itu
  // tetap bisa dibersihkan — alih-alih menyisakan dropdown kosong yang
  // membingungkan.
  const asing = value !== "" && !items.some((item) => item.value === value);
  const selectItems = [
    { value: SEMUA, label: placeholder },
    ...(asing ? [{ value, label: `${value} (tidak ada di daftar)` }] : []),
    ...items,
  ];

  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id} className="text-xs text-cream-muted">
        {label}
      </Label>
      <Select
        items={selectItems}
        value={value === "" ? SEMUA : value}
        onValueChange={(next: unknown) => {
          const picked = typeof next === "string" ? next : SEMUA;
          onChange(picked === SEMUA ? "" : picked);
        }}
      >
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {selectItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
