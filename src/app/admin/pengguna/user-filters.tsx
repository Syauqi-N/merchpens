"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilterXIcon, Loader2Icon, SearchIcon } from "lucide-react";

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
import { ASSIGNABLE_ROLES, ROLE_LABEL } from "@/lib/permissions";

export type UserFilterState = {
  q: string;
  peran: string;
  status: string;
};

const PERAN_ITEMS = [
  { value: "", label: "Semua peran" },
  ...ASSIGNABLE_ROLES.map((role) => ({
    value: role as string,
    label: ROLE_LABEL[role],
  })),
];

const STATUS_ITEMS = [
  { value: "", label: "Semua status" },
  { value: "aktif", label: "Aktif" },
  { value: "nonaktif", label: "Nonaktif" },
];

/**
 * Panel pencarian & filter daftar pengguna.
 *
 * Nilainya ditulis ke URL saat diterapkan supaya hasilnya bisa di-bookmark dan
 * tombol back/forward tetap bekerja. Halaman memberi `key` berisi filter aktif
 * agar state panel ikut tersegar setelah navigasi.
 *
 * Nomor halaman sengaja TIDAK ikut dibawa: setiap kali filter berubah, daftar
 * kembali ke halaman 1 supaya pengurus tidak terdampar di halaman kosong ketika
 * jumlah hasilnya menyusut.
 */
export function UserFilters({ initial }: { initial: UserFilterState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(initial.q);
  const [peran, setPeran] = useState(initial.peran);
  const [status, setStatus] = useState(initial.status);

  const hasFilter = Boolean(q || peran || status);

  function apply(next: Partial<UserFilterState>) {
    const merged: UserFilterState = { q, peran, status, ...next };
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/admin/pengguna?${query}` : "/admin/pengguna");
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        apply({});
      }}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto]"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="filter-pengguna-q" className="text-xs text-cream-muted">
          Cari
        </Label>
        <div className="relative">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[#8A8A8A]"
          />
          <Input
            id="filter-pengguna-q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Nama atau email"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs text-cream-muted">Peran</Label>
        <Select
          items={PERAN_ITEMS}
          value={peran}
          onValueChange={(value: string | null) => {
            setPeran(value ?? "");
            apply({ peran: value ?? "" });
          }}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERAN_ITEMS.map((item) => (
              <SelectItem key={item.value || "all"} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs text-cream-muted">Status akun</Label>
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
              setPeran("");
              setStatus("");
              startTransition(() => router.push("/admin/pengguna"));
            }}
          >
            <FilterXIcon className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
    </form>
  );
}
