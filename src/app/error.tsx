"use client";

import { useEffect } from "react";
import Link from "next/link";
import { HouseIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Batas error untuk seluruh segmen root.
 * Next.js 16: prop pemulihan bernama `unstable_retry` (bukan `reset`).
 */
export default function GlobalRouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-20 text-center">
      <span
        aria-hidden
        className="grid size-14 place-items-center rounded-2xl bg-red-500/10 text-red-400"
      >
        <TriangleAlertIcon className="size-7" />
      </span>

      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-cream">
        Terjadi kesalahan
      </h1>
      <p className="mt-2 text-sm text-cream-muted">
        Maaf, halaman ini gagal dimuat. Silakan coba lagi — bila masih bermasalah,
        hubungi kami.
      </p>

      {error.digest && (
        <p className="mt-3 rounded-lg bg-raise px-3 py-1.5 font-mono text-xs text-cream-muted">
          Kode: {error.digest}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={unstable_retry}
          className="h-10 bg-gold px-5 text-obsidian hover:bg-gold-light"
        >
          <RotateCwIcon className="size-4" aria-hidden />
          Coba lagi
        </Button>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline" }), "h-10 gap-2 px-5")}
        >
          <HouseIcon className="size-4" aria-hidden />
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
