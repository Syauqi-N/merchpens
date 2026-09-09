"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOffIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type GalleryImage = {
  id: string;
  url: string;
  alt?: string | null;
};

export type ProductGalleryProps = {
  images: GalleryImage[];
  /** Nama produk — dipakai sebagai teks alternatif cadangan. */
  productName: string;
  className?: string;
};

/** Galeri gambar produk: satu gambar utama + deretan thumbnail. */
export function ProductGallery({
  images,
  productName,
  className,
}: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-obsidian">
        {active ? (
          <Image
            key={active.id}
            src={active.url}
            alt={active.alt || productName}
            fill
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover"
          />
        ) : (
          <span className="grid size-full place-items-center text-[#6E6E6E]">
            <ImageOffIcon className="size-16" aria-hidden />
            <span className="sr-only">Gambar produk belum tersedia</span>
          </span>
        )}
      </div>

      {images.length > 1 && (
        <ul className="flex flex-wrap gap-2.5" aria-label="Pilihan gambar produk">
          {images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Tampilkan gambar ${index + 1} dari ${images.length}`}
                aria-current={index === activeIndex}
                className={cn(
                  "relative size-18 overflow-hidden rounded-xl border-2 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-gold/50/40",
                  index === activeIndex
                    ? "border-sky-600"
                    : "border-white/10 hover:border-sky-300",
                )}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
