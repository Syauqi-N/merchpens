import { CheckCircle2Icon, CircleDotIcon, ClockIcon } from "lucide-react";
import type { ContestPhase } from "@/lib/contest";
import { cn } from "@/lib/utils";

const STEPS: { key: ContestPhase; title: string; subtitle: string }[] = [
  { key: "SUBMISSION", title: "1. Pengumpulan Karya", subtitle: "Submit desain & konsep" },
  { key: "REVIEW", title: "2. Kurasi Panitia", subtitle: "Verifikasi kelayakan karya" },
  { key: "VOTING", title: "3. Voting Mahasiswa", subtitle: "Pemberian suara publik" },
  { key: "FINISHED", title: "4. Pengumuman Juara", subtitle: "Produksi Batch Pre-Order" },
];

export function ContestTimelineTracker({
  currentPhase,
  className,
}: {
  currentPhase: ContestPhase;
  className?: string;
}) {
  const phaseOrder: Record<ContestPhase, number> = {
    DRAFT: 0,
    SUBMISSION: 1,
    REVIEW: 2,
    VOTING: 3,
    FINISHED: 4,
  };

  const currentIndex = phaseOrder[currentPhase];

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-coal/80 p-5 backdrop-blur", className)}>
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <ClockIcon className="size-4 text-gold" aria-hidden />
          <span className="text-xs font-semibold tracking-wider text-cream uppercase">
            Tahapan Sayembara
          </span>
        </div>
        <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-bold text-gold">
          {currentPhase === "SUBMISSION"
            ? "Karya Dibuka"
            : currentPhase === "VOTING"
              ? "Voting Dibuka"
              : currentPhase === "REVIEW"
                ? "Dalam Kurasi"
                : "Selesai"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, idx) => {
          const stepNumber = idx + 1;
          const isDone = currentIndex > stepNumber;
          const isCurrent = currentIndex === stepNumber;

          return (
            <div
              key={step.key}
              className={cn(
                "relative flex items-start gap-3 rounded-xl border p-3 transition-all",
                isCurrent
                  ? "border-gold/60 bg-gold/10 shadow-sm shadow-gold/5"
                  : isDone
                    ? "border-emerald-500/30 bg-emerald-500/5 text-cream-muted"
                    : "border-white/5 bg-white/5 text-cream-faint"
              )}
            >
              {isDone ? (
                <CheckCircle2Icon className="mt-0.5 size-4.5 shrink-0 text-emerald-400" />
              ) : isCurrent ? (
                <CircleDotIcon className="mt-0.5 size-4.5 shrink-0 animate-pulse text-gold" />
              ) : (
                <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border border-white/20 text-[10px] text-cream-muted">
                  {stepNumber}
                </span>
              )}
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-xs font-semibold tracking-tight truncate",
                    isCurrent ? "text-gold" : isDone ? "text-cream" : "text-cream-muted"
                  )}
                >
                  {step.title}
                </p>
                <p className="text-[11px] text-cream-muted truncate">{step.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
