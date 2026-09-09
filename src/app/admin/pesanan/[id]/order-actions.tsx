"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BanIcon,
  CheckCheckIcon,
  Loader2Icon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { OrderStatus } from "@/generated/prisma/client";
import { formatRupiah } from "@/lib/format";

import type { ActionResult } from "../schemas";
import { cancelOrder, markPaidManually, syncPaymentStatus, updateOrderStatus } from "../actions";

type Props = {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  hasPayment: boolean;
  duitkuConfigured: boolean;
};

/**
 * Panel aksi admin untuk satu pesanan.
 *
 * Komponen ini hanya mengatur tampilan: seluruh validasi transisi status,
 * pemeriksaan peran, dan pengembalian kuota terjadi di dalam Server Action.
 * Tombol yang tampil di sini sekadar mencerminkan transisi yang lazim, bukan
 * jaminan keamanan.
 */
export function OrderActionsPanel({
  orderId,
  orderNumber,
  status,
  total,
  hasPayment,
  duitkuConfigured,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<string | null>(null);
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [manualNote, setManualNote] = useState("");

  function run(key: string, action: () => Promise<ActionResult>, onDone?: () => void) {
    setRunning(key);
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
        setRunning(null);
        onDone?.();
      }
    });
  }

  const busy = pending;
  const isFinal = status === "COMPLETED" || status === "CANCELLED" || status === "EXPIRED";
  const canCancel =
    status === "PENDING_PAYMENT" ||
    status === "PAID" ||
    status === "PROCESSING";

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Aksi Admin</CardTitle>
        <CardDescription>
          Ubah status pesanan atau rekonsiliasi pembayaran dengan Duitku.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {isFinal ? (
          <p className="rounded-lg bg-obsidian px-3 py-2.5 text-sm text-cream-muted">
            Pesanan sudah berada pada status akhir sehingga tidak bisa diubah lagi.
          </p>
        ) : null}

        {status === "PAID" ? (
          <p className="rounded-lg bg-gold/10 px-3 py-2.5 text-sm text-gold-light">
            Status akan otomatis menjadi Diproses setelah seluruh periode PO terkait
            ditutup.
          </p>
        ) : null}

        {/* Selesai tetap manual karena menandakan barang benar-benar diserahkan. */}
        {status === "PROCESSING" ? (
          <Button
            size="lg"
            disabled={busy}
            className="justify-start"
            onClick={() =>
              run("completed", () => updateOrderStatus({ orderId, status: "COMPLETED" }))
            }
          >
            {running === "completed" ? (
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
            ) : (
              <CheckCheckIcon className="size-4" aria-hidden />
            )}
            Tandai Selesai
          </Button>
        ) : null}

        {/* --- Rekonsiliasi ke Duitku --- */}
        {hasPayment ? (
          <div className="flex flex-col gap-1.5">
            <Button
              size="lg"
              variant="outline"
              disabled={busy || !duitkuConfigured}
              className="justify-start"
              onClick={() => run("sync", () => syncPaymentStatus({ orderId }))}
            >
              {running === "sync" ? (
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCwIcon className="size-4" aria-hidden />
              )}
              Cek Status ke Duitku
            </Button>
            <p className="text-xs text-cream-muted">
              {duitkuConfigured
                ? "Menanyakan status transaksi langsung ke Duitku. Pakai ini bila webhook terlewat."
                : "Kredensial Duitku belum diisi di .env, jadi pengecekan status tidak tersedia."}
            </p>
          </div>
        ) : null}

        {/* --- Override darurat: tandai lunas manual --- */}
        {status === "PENDING_PAYMENT" ? (
          <AlertDialog open={confirmPaid} onOpenChange={setConfirmPaid}>
            <AlertDialogTrigger
              render={
                <Button
                  size="lg"
                  variant="outline"
                  disabled={busy}
                  className="justify-start border-amber-300 text-amber-200 hover:bg-amber-500/10"
                />
              }
            >
              {running === "paid" ? (
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
              ) : (
                <TriangleAlertIcon className="size-4" aria-hidden />
              )}
              Tandai Lunas Manual
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-amber-500/15 text-amber-300">
                  <TriangleAlertIcon aria-hidden />
                </AlertDialogMedia>
                <AlertDialogTitle>
                  Tandai lunas tanpa verifikasi Duitku?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Pesanan <strong>{orderNumber}</strong> senilai{" "}
                  <strong>{formatRupiah(total)}</strong> akan ditandai LUNAS{" "}
                  tanpa konfirmasi dari penyedia pembayaran.{" "}
                  Kuota pre-order yang dipegangnya tetap terpakai seperti sejak checkout.
                  <br />
                  <br />
                  Gunakan hanya bila kamu sudah memastikan sendiri dananya benar-benar masuk.
                  Tindakan ini tercatat di log server dan tidak bisa dibatalkan otomatis.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-1.5">
                <label
                  htmlFor="manual-payment-note"
                  className="text-sm font-medium text-cream"
                >
                  Catatan konfirmasi (opsional)
                </label>
                <Textarea
                  id="manual-payment-note"
                  value={manualNote}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => setManualNote(event.target.value)}
                  placeholder="Contoh: Lunas via transfer BCA, bukti dicek di WhatsApp."
                />
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy}
                  onClick={() =>
                    run(
                      "paid",
                      () => markPaidManually({ orderId, note: manualNote }),
                      () => {
                        setConfirmPaid(false);
                        setManualNote("");
                      },
                    )
                  }
                >
                  Ya, konfirmasi lunas
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}

        {/* --- Pembatalan --- */}
        {canCancel ? (
          <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
            <AlertDialogTrigger
              render={
                <Button
                  size="lg"
                  variant="destructive"
                  disabled={busy}
                  className="justify-start"
                />
              }
            >
              {running === "cancel" ? (
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
              ) : (
                <BanIcon className="size-4" aria-hidden />
              )}
              Batalkan Pesanan
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-rose-500/15 text-rose-300">
                  <BanIcon aria-hidden />
                </AlertDialogMedia>
                <AlertDialogTitle>Batalkan pesanan {orderNumber}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Kuota pre-order yang dipegang pesanan ini akan dikembalikan sehingga bisa
                  dipesan pelanggan lain. Status pesanan menjadi Dibatalkan dan tidak bisa
                  dikembalikan lagi.
                  {status !== "PENDING_PAYMENT" ? (
                    <>
                      <br />
                      <br />
                      Pesanan ini sudah lunas — pastikan pengembalian dana ke pelanggan diurus
                      terpisah, karena sistem tidak melakukan refund otomatis.
                    </>
                  ) : null}
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Jangan batalkan</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={busy}
                  onClick={() =>
                    run("cancel", () => cancelOrder({ orderId }), () => setConfirmCancel(false))
                  }
                >
                  Ya, batalkan
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </CardContent>
    </Card>
  );
}
