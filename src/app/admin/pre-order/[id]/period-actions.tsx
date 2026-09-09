"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DoorOpenIcon, Loader2Icon, LockIcon, PlayIcon } from "lucide-react";
import { toast } from "sonner";

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
import type { PreOrderStatus } from "@/generated/prisma/client";

import { activatePeriod, closePeriod, reopenPeriod } from "../actions";

/**
 * Tombol aktifkan / tutup / buka-kembali periode.
 *
 * - Draf → Aktif (ditolak server bila ada periode lain yang sedang terbuka).
 * - Aktif/Draf → Ditutup manual (sebelum endAt).
 * - Ditutup/Draf → Aktif lagi (tetap hormati single-open).
 */
export function PeriodQuickActions({
  periodId,
  status,
  isOpen,
}: {
  periodId: string;
  status: PreOrderStatus;
  isOpen: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmClose, setConfirmClose] = useState(false);

  function run(action: () => Promise<{ ok: boolean; message: string }>, onDone?: () => void) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
        router.refresh();
      } catch {
        toast.error("Terjadi kesalahan pada server. Coba lagi.");
      } finally {
        onDone?.();
      }
    });
  }

  const closeDialog = (
    <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
      <AlertDialogTrigger
        render={<Button variant="outline" size="lg" disabled={pending} />}
      >
        {pending ? (
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
        ) : (
          <LockIcon className="size-4" aria-hidden />
        )}
        Tutup Sekarang
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-amber-500/15 text-amber-300">
            <LockIcon aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>Tutup periode lebih awal?</AlertDialogTitle>
          <AlertDialogDescription>
            {isOpen
              ? "Periode ini sedang terbuka. Menutupnya sekarang menghentikan pemesanan baru seketika, sebelum tanggal berakhir tiba."
              : "Menutup periode membuat statusnya permanen Ditutup sampai kamu membukanya lagi."}
            <br />
            <br />
            Pesanan lunas akan otomatis menjadi Diproses bila seluruh periode PO
            dalam pesanan tersebut sudah ditutup. Membuka periode kembali tidak
            menurunkan status pesanan yang telanjur Diproses. Jumlah kuota terpakai
            tetap tercatat.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={() => run(() => closePeriod({ periodId }), () => setConfirmClose(false))}
          >
            Ya, tutup sekarang
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (status === "CLOSED") {
    return (
      <Button
        variant="outline"
        size="lg"
        disabled={pending}
        onClick={() => run(() => reopenPeriod({ periodId }))}
      >
        {pending ? (
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
        ) : (
          <DoorOpenIcon className="size-4" aria-hidden />
        )}
        Buka Kembali
      </Button>
    );
  }

  if (status === "DRAFT") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="lg"
          disabled={pending}
          onClick={() => run(() => activatePeriod({ periodId }))}
        >
          {pending ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          ) : (
            <PlayIcon className="size-4" aria-hidden />
          )}
          Aktifkan
        </Button>
        {closeDialog}
      </div>
    );
  }

  return closeDialog;
}
