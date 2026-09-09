import Link from "next/link";

import { cn } from "@/lib/utils";

export type CategoryNavItem = {
  /** `null` untuk pilihan "Semua". */
  slug: string | null;
  name: string;
  href: string;
  count?: number;
};

export type CategoryNavProps = {
  items: CategoryNavItem[];
  /** Slug yang sedang aktif (`null`/undefined = "Semua"). */
  activeSlug?: string | null;
  className?: string;
  /** Label untuk pembaca layar. */
  label?: string;
};

/**
 * Barisan pil kategori yang bisa digulir horizontal di layar kecil.
 * Murni Server Component — tiap pil adalah `<Link>` biasa.
 */
export function CategoryNav({
  items,
  activeSlug = null,
  className,
  label = "Filter kategori",
}: CategoryNavProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label={label} className={cn("-mx-1 overflow-x-auto px-1 pb-1", className)}>
      <ul className="flex w-max min-w-full items-center gap-2">
        {items.map((item) => {
          const active = (item.slug ?? null) === (activeSlug ?? null);
          return (
            <li key={item.slug ?? "__all__"}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "border-sky-600 bg-gold text-obsidian"
                    : "border-white/10 bg-coal text-[#D8D3C7] hover:border-gold/30 hover:bg-gold/10 hover:text-gold",
                )}
              >
                {item.name}
                {typeof item.count === "number" && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      active ? "bg-white/10 text-white" : "bg-raise text-cream-muted",
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
