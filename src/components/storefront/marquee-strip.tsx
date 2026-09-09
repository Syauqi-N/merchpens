import { Fragment } from "react";

import { cn } from "@/lib/utils";

export type MarqueeStripProps = {
  /** Potongan teks yang diulang, dipisah ikon belah ketupat. */
  items: string[];
  className?: string;
};

/**
 * Pita teks berjalan khas campaign pre-order — pembeda visual utama dari
 * tampilan toko online generik. Murni CSS (tanpa JS klien); konten digandakan
 * agar animasi loop mulus, salinan kedua disembunyikan dari screen reader.
 */
export function MarqueeStrip({ items, className }: MarqueeStripProps) {
  if (items.length === 0) return null;

  const row = (hidden: boolean) => (
    <div
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-center"
    >
      {items.map((item, index) => (
        <Fragment key={`${item}-${index}`}>
          <span className="mx-5 text-xs font-extrabold tracking-[0.22em] whitespace-nowrap uppercase sm:text-sm">
            {item}
          </span>
          <span aria-hidden className="size-1.5 rotate-45 bg-obsidian/60" />
        </Fragment>
      ))}
    </div>
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden border-y border-gold-deep/60 bg-gold py-2.5 text-obsidian",
        className,
      )}
    >
      <div className="animate-marquee flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
