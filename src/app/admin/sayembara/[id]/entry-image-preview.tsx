"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeftIcon, ChevronRightIcon, ImagesIcon, Maximize2Icon, XIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function AdminEntryImagePreview({
  title,
  imageUrl,
  imageUrl2,
}: {
  title: string;
  imageUrl: string;
  imageUrl2?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const images = [imageUrl, imageUrl2].filter(
    (url): url is string => Boolean(url && url.trim().length > 0)
  );

  function prevImage() {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }

  function nextImage() {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (val) setCurrentIndex(0);
    }}>
      <DialogTrigger
        render={
          <div
            className="group relative aspect-4/3 w-full cursor-pointer overflow-hidden bg-obsidian"
            title="Klik untuk perbesar & lihat semua foto desain"
          />
        }
      >
        <Image
          src={images[0]}
          alt={title}
          fill
          className="object-contain p-3 transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 33vw"
        />

        {/* Hover overlay hint */}
        <div className="absolute inset-0 flex items-center justify-center bg-obsidian/40 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex items-center gap-1.5 rounded-full bg-obsidian/90 px-3 py-1.5 text-xs font-semibold text-cream shadow-lg border border-white/15">
            <Maximize2Icon className="size-3.5 text-gold" />
            <span>Lihat Detail Desain</span>
          </div>
        </div>

        {/* Badge jika memiliki 2 foto */}
        {images.length > 1 && (
          <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1 rounded-full bg-obsidian/90 px-2.5 py-1 text-[11px] font-bold text-gold border border-gold/40 shadow-md">
            <ImagesIcon className="size-3" />
            <span>2 Foto</span>
          </div>
        )}
      </DialogTrigger>

      <DialogContent
        className="max-h-[92vh] w-full sm:max-w-4xl lg:max-w-5xl overflow-y-auto border border-white/15 bg-coal p-6 text-cream shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <DialogTitle className="text-lg font-bold text-cream truncate pr-4">
            {title}
          </DialogTitle>
          <span className="text-xs font-semibold text-cream-muted">
            Foto {currentIndex + 1} dari {images.length}
          </span>
        </div>

        {/* Carousel Preview - Dibuat jauh lebih besar dan lega */}
        <div className="relative mt-4 h-[55vh] sm:h-[65vh] w-full overflow-hidden rounded-xl border border-white/10 bg-obsidian flex items-center justify-center">
          <Image
            src={images[currentIndex]}
            alt={`${title} - Foto ${currentIndex + 1}`}
            fill
            className="object-contain p-4"
            sizes="(max-width: 1024px) 100vw, 1200px"
          />

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={prevImage}
                className="absolute left-3 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-full bg-obsidian/85 text-cream border border-white/15 hover:bg-gold hover:text-obsidian transition-colors shadow-lg"
                aria-label="Foto sebelumnya"
              >
                <ChevronLeftIcon className="size-5" />
              </button>
              <button
                type="button"
                onClick={nextImage}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-full bg-obsidian/85 text-cream border border-white/15 hover:bg-gold hover:text-obsidian transition-colors shadow-lg"
                aria-label="Foto berikutnya"
              >
                <ChevronRightIcon className="size-5" />
              </button>

              {/* Indicator dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-obsidian/80 px-3 py-1 border border-white/10 text-[11px] font-bold text-cream">
                {images.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentIndex ? "w-5 bg-gold" : "w-1.5 bg-white/40"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail Selector */}
        {images.length > 1 && (
          <div className="mt-3 flex items-center gap-2">
            {images.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`relative h-14 w-20 overflow-hidden rounded-lg border-2 transition-all bg-obsidian ${
                  idx === currentIndex
                    ? "border-gold ring-1 ring-gold shadow-md"
                    : "border-white/15 opacity-60 hover:opacity-100"
                }`}
              >
                <Image
                  src={imgUrl}
                  alt={`Thumbnail ${idx + 1}`}
                  fill
                  className="object-contain p-1"
                />
              </button>
            ))}
            <span className="text-xs text-cream-muted ml-2">
              {currentIndex === 0 ? "Foto 1 (Mock-up Utama)" : "Foto 2 (Mock-up Pendukung)"}
            </span>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-white/15 text-cream hover:bg-white/5 text-xs"
          >
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
