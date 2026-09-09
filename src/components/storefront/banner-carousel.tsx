"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type StorefrontBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
};

export type BannerCarouselProps = {
  banners: StorefrontBanner[];
  /** Jeda pergantian otomatis (ms). Set 0 untuk mematikan. */
  intervalMs?: number;
  className?: string;
};

/**
 * Carousel banner promosi beranda.
 *
 * Berganti otomatis, berhenti saat kursor/fokus berada di dalamnya, dan tetap
 * bisa dinavigasi lewat tombol panah maupun titik indikator.
 */
export function BannerCarousel({
  banners,
  intervalMs = 6000,
  className,
}: BannerCarouselProps) {
  const total = banners.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback(
    (next: number) => {
      if (total === 0) return;
      setIndex(((next % total) + total) % total);
    },
    [total],
  );

  useEffect(() => {
    if (total <= 1 || paused || intervalMs <= 0) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % total), intervalMs);
    return () => clearInterval(timer);
  }, [total, paused, intervalMs]);

  if (total === 0) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-raise ring-1 ring-white/10",
        className,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Banner promosi"
    >
      <div className="relative aspect-[16/9] sm:aspect-[16/6] lg:aspect-[16/5]">
        {banners.map((banner, i) => {
          const active = i === index;
          const content = (
            <>
              <Image
                src={banner.imageUrl}
                alt={banner.title}
                fill
                priority={i === 0}
                sizes="(min-width: 1280px) 1200px, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-r from-cream/80 via-cream/45 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-center gap-2 p-6 sm:p-10 lg:p-14">
                <h3 className="max-w-xl text-lg leading-tight font-semibold text-white drop-shadow-sm sm:text-2xl lg:text-3xl">
                  {banner.title}
                </h3>
                {banner.subtitle && (
                  <p className="max-w-md text-xs text-white/90 sm:text-sm lg:text-base">
                    {banner.subtitle}
                  </p>
                )}
                {banner.linkUrl && (
                  <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg bg-coal px-3.5 py-2 text-xs font-medium text-gold shadow-sm transition-colors group-hover:bg-gold/10 sm:text-sm">
                    Lihat selengkapnya
                    <ChevronRightIcon className="size-4" aria-hidden />
                  </span>
                )}
              </div>
            </>
          );

          return (
            <div
              key={banner.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} dari ${total}`}
              aria-hidden={!active}
              inert={!active}
              className={cn(
                "absolute inset-0 transition-opacity duration-500",
                active ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              {banner.linkUrl ? (
                <Link
                  href={banner.linkUrl}
                  className="group relative block size-full outline-none focus-visible:ring-3 focus-visible:ring-gold/50/50 focus-visible:ring-inset"
                >
                  {content}
                </Link>
              ) : (
                <div className="group relative size-full">{content}</div>
              )}
            </div>
          );
        })}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Banner sebelumnya"
            className="absolute top-1/2 left-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-obsidian/85 text-[#D8D3C7] shadow-sm transition-colors hover:bg-coal sm:left-4"
          >
            <ChevronLeftIcon className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Banner berikutnya"
            className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-obsidian/85 text-[#D8D3C7] shadow-sm transition-colors hover:bg-coal sm:right-4"
          >
            <ChevronRightIcon className="size-5" aria-hidden />
          </button>

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Tampilkan banner ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-6 bg-coal" : "w-1.5 bg-white/60 hover:bg-obsidian/85",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
