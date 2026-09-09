"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";

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

export type ProductFiltersProps = {
  categories: { slug: string; name: string }[];
  /** Nilai filter yang sedang aktif (dibaca server dari `searchParams`). */
  current: {
    q: string;
    kategori: string;
    status: string;
  };
};

const ALL = "semua";

export function ProductFilters({ categories, current }: ProductFiltersProps) {
  const router = useRouter();
  const [query, setQuery] = useState(current.q);

  function pushWith(patch: Partial<ProductFiltersProps["current"]>) {
    const next = { ...current, q: query, ...patch };
    const params = new URLSearchParams();

    if (next.q.trim() !== "") params.set("q", next.q.trim());
    if (next.kategori !== "") params.set("kategori", next.kategori);
    if (next.status !== "") params.set("status", next.status);

    const search = params.toString();
    router.push(search === "" ? "/admin/produk" : `/admin/produk?${search}`);
  }

  const hasFilter = current.q !== "" || current.kategori !== "" || current.status !== "";

  const categoryItems: Record<string, string> = {
    [ALL]: "Semua kategori",
    ...Object.fromEntries(categories.map((category) => [category.slug, category.name])),
  };
  const statusItems: Record<string, string> = {
    [ALL]: "Semua status",
    aktif: "Aktif",
    nonaktif: "Nonaktif",
  };

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-coal p-3 sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(2,minmax(0,10rem))_auto]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            pushWith({});
          }}
          className="min-w-0"
        >
          <Label htmlFor="filter-q" className="sr-only">
            Cari produk
          </Label>
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8A8A8A]"
              aria-hidden
            />
            <Input
              id="filter-q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama, SKU, atau merek..."
              className="h-10 pl-9"
            />
          </div>
        </form>

        <div className="min-w-0">
          <Label htmlFor="filter-kategori" className="sr-only">
            Kategori
          </Label>
          <Select
            items={categoryItems}
            value={current.kategori === "" ? ALL : current.kategori}
            onValueChange={(value) =>
              pushWith({ kategori: !value || value === ALL ? "" : String(value) })
            }
          >
            <SelectTrigger id="filter-kategori" className="h-10 w-full">
              <SelectValue placeholder="Semua kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Semua kategori</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.slug} value={category.slug}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0">
          <Label htmlFor="filter-status" className="sr-only">
            Status
          </Label>
          <Select
            items={statusItems}
            value={current.status === "" ? ALL : current.status}
            onValueChange={(value) =>
              pushWith({ status: !value || value === ALL ? "" : String(value) })
            }
          >
            <SelectTrigger id="filter-status" className="h-10 w-full">
              <SelectValue placeholder="Semua status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Semua status</SelectItem>
              <SelectItem value="aktif">Aktif</SelectItem>
              <SelectItem value="nonaktif">Nonaktif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            className="h-10 flex-1 bg-gold text-obsidian hover:bg-gold-light lg:flex-none"
            onClick={() => pushWith({})}
          >
            <SearchIcon className="size-4" aria-hidden />
            Cari
          </Button>

          {hasFilter && (
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={() => {
                setQuery("");
                router.push("/admin/produk");
              }}
            >
              <XIcon className="size-4" aria-hidden />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
