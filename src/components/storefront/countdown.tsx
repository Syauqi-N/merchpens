"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  finished: boolean;
};

function computeRemaining(target: number, from: number): Remaining {
  const diff = target - from;
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, finished: true };
  }

  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    finished: false,
  };
}

const UNITS = [
  { key: "days", label: "Hari" },
  { key: "hours", label: "Jam" },
  { key: "minutes", label: "Menit" },
  { key: "seconds", label: "Detik" },
] as const;

export type CountdownProps = {
  /** Waktu berakhir periode dalam ISO string (hasil `date.toISOString()`). */
  endAt: string;
  /** `boxes` kotak per unit, `inline` teks ringkas, `display` angka besar. */
  variant?: "boxes" | "inline" | "display";
  /** `dark` untuk latar berwarna (hero), `light` untuk kartu putih. */
  tone?: "dark" | "light";
  className?: string;
  /** Teks saat waktu sudah lewat. */
  finishedLabel?: string;
};

/**
 * Hitung mundur berakhirnya periode pre-order.
 *
 * Nilainya baru dihitung setelah komponen ter-mount agar tidak terjadi
 * ketidakcocokan hidrasi antara jam server dan jam browser.
 */
export function Countdown({
  endAt,
  variant = "boxes",
  tone = "dark",
  className,
  finishedLabel = "Periode telah berakhir",
}: CountdownProps) {
  const target = new Date(endAt).getTime();
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target)) return;

    const tick = () => setRemaining(computeRemaining(target, Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target]);

  if (variant === "display") {
    // Gaya tipografi besar — dipakai di panel PO hero. Angka jadi fokus
    // utama, label kecil di bawahnya, pemisah titik dua berdenyut halus.
    if (remaining?.finished) {
      return (
        <p className={cn("text-sm font-medium text-cream-muted", className)}>
          {finishedLabel}
        </p>
      );
    }
    return (
      <div
        role="timer"
        aria-live="off"
        aria-label="Sisa waktu periode pre-order"
        suppressHydrationWarning
        className={cn("flex items-start justify-center gap-2 sm:gap-3", className)}
      >
        {UNITS.map((unit, index) => (
          <div key={unit.key} className="flex items-start gap-2 sm:gap-3">
            {index > 0 && (
              <span
                aria-hidden
                className="animate-pulse pt-0.5 font-display text-2xl font-extrabold text-gold/50 sm:text-3xl"
              >
                :
              </span>
            )}
            <div className="flex min-w-12 flex-col items-center">
              <span
                className={cn(
                  "font-display text-3xl leading-none font-extrabold tabular-nums sm:text-4xl",
                  tone === "light" ? "text-gold-light" : "text-gold",
                )}
              >
                {remaining ? String(remaining[unit.key]).padStart(2, "0") : "--"}
              </span>
              <span className="mt-1.5 text-[10px] font-semibold tracking-[0.2em] text-cream-muted uppercase">
                {unit.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <span
        className={cn("font-medium tabular-nums", className)}
        aria-live="off"
        suppressHydrationWarning
      >
        {!remaining
          ? "menghitung…"
          : remaining.finished
            ? finishedLabel
            : `${remaining.days} hari ${remaining.hours} jam ${remaining.minutes} menit`}
      </span>
    );
  }

  if (remaining?.finished) {
    return (
      <p className={cn("text-sm font-medium text-cream-muted", className)}>
        {finishedLabel}
      </p>
    );
  }

  return (
    <div
      className={cn("flex flex-wrap gap-2", className)}
      role="timer"
      aria-label="Sisa waktu periode pre-order"
      suppressHydrationWarning
    >
      {UNITS.map((unit) => (
        <div
          key={unit.key}
          className={cn(
            "min-w-14 rounded-xl px-3 py-2 text-center ring-1",
            tone === "dark"
              ? "bg-white/10 text-white ring-white/25 backdrop-blur-sm"
              : "bg-gold/10 text-gold-light ring-gold/20",
          )}
        >
          <span className="block text-xl leading-none font-semibold tabular-nums">
            {remaining ? String(remaining[unit.key]).padStart(2, "0") : "--"}
          </span>
          <span
            className={cn(
              "mt-1 block text-[10px] tracking-wide uppercase",
              tone === "dark" ? "opacity-80" : "text-gold/70",
            )}
          >
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}
