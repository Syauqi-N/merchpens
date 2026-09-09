import { CheckIcon } from "lucide-react";

import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BatchTimelineProps = {
  startAt: Date;
  endAt: Date;
  estimatedPickupAt: Date;
  /** Waktu acuan status langkah; default waktu render. */
  now?: Date;
  className?: string;
};

/**
 * Linimasa siklus satu batch PO: Pemesanan → Ditutup → Produksi → Distribusi.
 * Server Component murni — status dihitung saat render (halaman sudah
 * force-dynamic, jadi selalu segar).
 */
export function BatchTimeline({
  startAt,
  endAt,
  estimatedPickupAt,
  now = new Date(),
  className,
}: BatchTimelineProps) {
  const isOpen = now >= startAt && now <= endAt;
  const isClosed = now > endAt;

  type StepState = "done" | "current" | "upcoming";
  const steps: { label: string; date: Date; state: StepState }[] = [
    {
      label: "Pemesanan",
      date: startAt,
      state: isClosed ? "done" : isOpen ? "current" : now < startAt ? "upcoming" : "done",
    },
    {
      label: "Ditutup",
      date: endAt,
      state: isClosed ? "done" : "upcoming",
    },
    {
      label: "Produksi",
      date: endAt,
      state: isClosed ? "current" : "upcoming",
    },
    {
      label: "Distribusi",
      date: estimatedPickupAt,
      state: "upcoming",
    },
  ];

  return (
    <ol
      className={cn("flex items-start", className)}
      aria-label="Tahapan periode pre-order"
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li
            key={step.label}
            className={cn("flex items-start", !isLast && "flex-1")}
          >
            <div className="flex w-16 flex-col items-center gap-1.5 text-center">
              <span
                aria-hidden
                className={cn(
                  "grid size-6 place-items-center rounded-full border text-[10px] font-bold",
                  step.state === "done" &&
                    "border-gold bg-gold text-obsidian",
                  step.state === "current" &&
                    "border-gold bg-gold/15 text-gold shadow-[0_0_0_4px_rgb(212_163_89/0.15)]",
                  step.state === "upcoming" &&
                    "border-white/15 bg-raise text-cream-muted",
                )}
              >
                {step.state === "done" ? (
                  <CheckIcon className="size-3.5" strokeWidth={3} />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  "text-[10px] leading-tight font-semibold tracking-wider uppercase",
                  step.state === "current" ? "text-gold" : "text-cream-muted",
                )}
              >
                {step.label}
              </span>
              <span className="text-[10px] text-cream-muted/80 tabular-nums">
                {formatDate(step.date)}
              </span>
            </div>
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  "mx-1 mt-3 h-px flex-1",
                  step.state === "done" ? "bg-gold/70" : "bg-white/10",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
