"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import type { ActionResult } from "@/components/admin/action-result";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmDeleteDialogProps = {
  title: string;
  description: ReactNode;
  /** Server Action yang dijalankan setelah dikonfirmasi. */
  onConfirm: () => Promise<ActionResult>;
  confirmLabel?: string;
  /** `icon` untuk tombol ikon di tabel, `button` untuk tombol berteks. */
  triggerVariant?: "icon" | "button";
  triggerLabel?: string;
  triggerClassName?: string;
  disabled?: boolean;
};

/**
 * Dialog konfirmasi hapus untuk panel admin.
 *
 * `onConfirm` biasanya memanggil sebuah Server Action. Otorisasi TIDAK
 * dilakukan di sini — setiap Server Action memanggil `requireCapability()`
 * sendiri dengan kemampuan yang relevan, karena action bisa dipanggil langsung
 * lewat POST tanpa melewati UI ini.
 */
export function ConfirmDeleteDialog({
  title,
  description,
  onConfirm,
  confirmLabel = "Hapus",
  triggerVariant = "icon",
  triggerLabel = "Hapus",
  triggerClassName,
  disabled = false,
}: ConfirmDeleteDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await onConfirm();

      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
        return;
      }

      toast.error(result.message);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size={triggerVariant === "icon" ? "icon-sm" : "sm"}
            disabled={disabled}
            aria-label={triggerVariant === "icon" ? triggerLabel : undefined}
            className={cn(
              "text-red-400 hover:bg-red-500/10 hover:text-red-300",
              triggerClassName,
            )}
          />
        }
      >
        <Trash2Icon className="size-4" aria-hidden />
        {triggerVariant === "button" && <span>{triggerLabel}</span>}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-red-500/10 text-red-400">
            <TriangleAlertIcon aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={pending}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
            {pending ? "Memproses..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
