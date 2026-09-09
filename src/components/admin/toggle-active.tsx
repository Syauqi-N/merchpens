"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { ActionResult } from "@/components/admin/action-result";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type ToggleActiveProps = {
  checked: boolean;
  /** Server Action yang menyimpan status baru. */
  onToggle: (next: boolean) => Promise<ActionResult>;
  /** Label aksesibilitas, mis. "Status aktif produk Scaler Ultrasonik". */
  label: string;
  activeText?: string;
  inactiveText?: string;
  className?: string;
};

/**
 * Sakelar aktif/nonaktif dengan pembaruan optimistik.
 *
 * `useOptimistic` menahan nilai sementara selama transisi berjalan, lalu
 * otomatis kembali mengikuti prop `checked` begitu `router.refresh()` selesai
 * — jadi bila Server Action menolak, sakelar kembali ke keadaan semula tanpa
 * perlu menyimpan salinan state sendiri.
 */
export function ToggleActive({
  checked,
  onToggle,
  label,
  activeText = "Aktif",
  inactiveText = "Nonaktif",
  className,
}: ToggleActiveProps) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(checked);
  const [pending, startTransition] = useTransition();

  function handleChange(next: boolean) {
    startTransition(async () => {
      setOptimistic(next);

      const result = await onToggle(next);

      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        return;
      }

      toast.error(result.message);
    });
  }

  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Switch
        checked={optimistic}
        onCheckedChange={handleChange}
        disabled={pending}
        aria-label={label}
        className="data-checked:bg-gold"
      />
      <span
        className={cn(
          "text-xs font-medium",
          optimistic ? "text-emerald-300" : "text-cream-muted",
        )}
      >
        {optimistic ? activeText : inactiveText}
      </span>
    </span>
  );
}
