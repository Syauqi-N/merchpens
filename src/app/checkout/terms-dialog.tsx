"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2Icon, FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CURRENT_TERMS_VERSION,
  TRANSACTION_TERM_SECTIONS,
  TRANSACTION_TERMS_TITLE,
} from "@/lib/transaction-terms";

export function TransactionTermsDialog() {
  const [open, setOpen] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const frame = requestAnimationFrame(() => {
      const element = scrollRef.current;
      if (element && element.scrollHeight <= element.clientHeight + 2) {
        setCanClose(true);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

  function handleOpenChange(nextOpen: boolean) {
    // Bila modal sudah dibuka, penutupan lewat Escape/backdrop juga mengikuti
    // aturan yang sama: isi harus digulir sampai bagian paling bawah.
    if (nextOpen || canClose) setOpen(nextOpen);
  }

  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;
    const reachedBottom =
      element.scrollTop + element.clientHeight >= element.scrollHeight - 8;
    if (reachedBottom) setCanClose(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setCanClose(false);
          setOpen(true);
        }}
        className="font-medium text-gold underline underline-offset-4 hover:text-gold-light"
      >
        syarat dan ketentuan transaksi berikut
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[78dvh] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        >
          <DialogHeader className="border-b border-white/10 px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
                <FileTextIcon className="size-4" aria-hidden />
              </span>
              <div className="space-y-1">
                <DialogTitle>{TRANSACTION_TERMS_TITLE}</DialogTitle>
                <DialogDescription>
                  Versi {CURRENT_TERMS_VERSION}. Gulir sampai bawah untuk menutup.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm leading-6 text-[#D8D3C7]"
            tabIndex={0}
          >
            <p>
              Dengan mencentang persetujuan pada checkout, pembeli menyatakan
              memahami dan menyetujui ketentuan berikut.
            </p>

            {TRANSACTION_TERM_SECTIONS.map((section, sectionIndex) => (
              <section key={section.title} className="space-y-2">
                <h3 className="font-semibold text-cream">
                  {sectionIndex + 1}. {section.title}
                </h3>
                <ol className="list-decimal space-y-2 pl-5">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </section>
            ))}

            <div className="rounded-lg bg-gold/10 p-3 text-xs text-gold-light">
              Bila ada hal yang belum jelas, hubungi admin sebelum membuat
              pesanan atau melakukan pembayaran.
            </div>
          </div>

          <DialogFooter className="m-0 shrink-0 rounded-none">
            <p className="mr-auto text-xs text-cream-muted">
              {canClose ? "Dokumen sudah mencapai bagian akhir." : "Gulir untuk melanjutkan."}
            </p>
            <Button
              type="button"
              disabled={!canClose}
              onClick={() => setOpen(false)}
              className="bg-gold text-obsidian hover:bg-gold-light"
            >
              <CheckCircle2Icon className="size-4" aria-hidden />
              Saya Mengerti &amp; Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
