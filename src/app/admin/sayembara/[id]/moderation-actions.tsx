"use client";

import { useState, useTransition } from "react";
import { CheckIcon, XIcon, AlertTriangleIcon } from "lucide-react";
import { updateSubmissionStatus } from "../actions";
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

export function ModerationActions({
  entryId,
  entryTitle,
  currentStatus,
}: {
  entryId: string;
  entryTitle: string;
  currentStatus: "PENDING" | "APPROVED" | "REJECTED";
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      await updateSubmissionStatus(entryId, "APPROVED");
    });
  }

  function handleReject() {
    startTransition(async () => {
      await updateSubmissionStatus(entryId, "REJECTED", rejectReason.trim() || undefined);
      setRejectOpen(false);
      setRejectReason("");
    });
  }

  return (
    <div className="flex items-center gap-2">
      {currentStatus !== "APPROVED" && (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={handleApprove}
          className="h-8 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-500 font-semibold"
        >
          <CheckIcon className="size-3.5 mr-1" />
          Setujui
        </Button>
      )}

      {currentStatus !== "REJECTED" && (
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogTrigger
            render={
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={isPending}
                className="h-8 px-2.5 text-xs font-semibold"
              />
            }
          >
            <XIcon className="size-3.5 mr-1" />
            Tolak
          </DialogTrigger>

          <DialogContent className="border border-red-500/30 bg-coal text-cream sm:max-w-md">
            <DialogHeader>
              <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                <AlertTriangleIcon className="size-6" />
              </div>
              <DialogTitle className="text-center text-lg font-bold text-cream">
                Tolak Karya Desain?
              </DialogTitle>
              <DialogDescription className="text-center text-xs text-cream-muted leading-relaxed">
                Karya <strong className="text-cream">&ldquo;{entryTitle}&rdquo;</strong> akan ditolak. Peserta
                akan diizinkan memperbaiki dan mengirimkan karya revisi atau karya baru.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              <label
                htmlFor="reason"
                className="text-xs font-semibold text-cream"
              >
                Catatan / Alasan Penolakan (akan dibaca peserta):
              </label>
              <textarea
                id="reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Format mock-up beresolusi rendah, orisinalitas logo belum sesuai panduan, dll."
                rows={3}
                className="w-full rounded-xl border border-white/15 bg-obsidian p-3 text-xs text-cream placeholder:text-cream-faint focus:border-red-500 focus:outline-none"
              />
            </div>

            <DialogFooter className="border-t border-white/10 pt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setRejectOpen(false)}
                className="border-white/15 text-cream hover:bg-white/5"
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={isPending}
                onClick={handleReject}
                className="bg-red-600 font-bold text-white hover:bg-red-500"
              >
                {isPending ? "Menolak..." : "Ya, Tolak Karya"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
