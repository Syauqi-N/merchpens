"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDownIcon, LoaderCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type SortSelectOption = {
  value: string;
  label: string;
  /** URL tujuan bila opsi ini dipilih (dibentuk di server). */
  href: string;
};

export type SortSelectProps = {
  value: string;
  options: SortSelectOption[];
  label?: string;
  className?: string;
};

/**
 * Pemilih urutan produk.
 *
 * Menerima daftar URL yang sudah dibentuk di server sehingga tidak perlu
 * membaca `useSearchParams` — filter lain (pencarian, kategori, jenis) otomatis
 * ikut terbawa.
 */
export function SortSelect({
  value,
  options,
  label = "Urutkan",
  className,
}: SortSelectProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-coal pr-1 pl-2.5 text-sm text-cream-muted focus-within:border-sky-500 focus-within:ring-3 focus-within:ring-gold/50/25",
        className,
      )}
    >
      {pending ? (
        <LoaderCircleIcon className="size-4 shrink-0 animate-spin text-gold" aria-hidden />
      ) : (
        <ArrowUpDownIcon className="size-4 shrink-0 text-[#8A8A8A]" aria-hidden />
      )}
      <span className="hidden shrink-0 text-cream-muted sm:inline">{label}</span>
      <select
        value={value}
        aria-label={label}
        onChange={(event) => {
          const next = options.find((option) => option.value === event.target.value);
          if (!next) return;
          startTransition(() => router.push(next.href, { scroll: false }));
        }}
        className="h-full cursor-pointer appearance-none rounded-md bg-transparent py-0 pr-6 pl-1 text-sm font-medium text-cream outline-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.25rem center",
          backgroundSize: "1rem 1rem",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
