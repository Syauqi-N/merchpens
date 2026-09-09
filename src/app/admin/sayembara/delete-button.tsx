"use client";

import { useState, useTransition } from "react";
import { Trash2Icon, AlertTriangleIcon } from "lucide-react";
import { deleteContest } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeleteContestButton({
  contestId,
  contestTitle,
  redirectAfter = false,
}: {
  contestId: string;
  contestTitle: string;
  redirectAfter?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleDelete() {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await deleteContest(contestId);
      if (res.success) {
        setOpen(false);
        if (redirectAfter) {
          window.location.href = "/admin/sayembara";
        }
      } else {
        setErrorMsg(res.error ?? "Gagal menghapus sayembara.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
          />
        }
      >
        <Trash2Icon className="size-3.5 mr-1" />
        Hapus
      </DialogTrigger>

      <DialogContent className="border border-red-500/30 bg-coal text-cream sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-full bg-red-500/10 text-red-400">
            <AlertTriangleIcon className="size-6" />
          </div>
          <DialogTitle className="text-center text-lg font-bold text-cream">
            Hapus Sayembara?
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-cream-muted leading-relaxed">
            Apakah Anda yakin ingin menghapus sayembara{" "}
            <strong className="text-cream">{contestTitle}</strong>? Seluruh data karya peserta,
            file gambar, dan perolehan suara akan ikut terhapus secara permanen.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {errorMsg}
          </div>
        )}

        <DialogFooter className="border-t border-white/10 pt-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setOpen(false)}
            className="border-white/15 text-cream hover:bg-white/5"
          >
            Batal
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={handleDelete}
            className="bg-red-600 font-bold text-white hover:bg-red-500"
          >
            {isPending ? "Menghapus..." : "Ya, Hapus Sayembara"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
