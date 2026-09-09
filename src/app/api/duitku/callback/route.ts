import type { Prisma } from "@/generated/prisma/client";
import {
  checkTransactionStatus,
  isCallbackSuccess,
  isCallbackTerminalFailure,
  isKnownDuitkuIp,
  parseCallback,
  verifyCallbackSignature,
} from "@/lib/duitku";
import { failOrder, settleOrderAsPaid } from "@/lib/order-settlement";
import { prisma } from "@/lib/prisma";

/** Berapa banyak kiriman callback terakhir yang disimpan sebagai jejak audit. */
const MAX_CALLBACK_HISTORY = 20;

/**
 * Webhook Duitku — SATU-SATUNYA sumber kebenaran status pembayaran.
 *
 * Aturan main yang wajib dipegang:
 *
 *  1. Body-nya `application/x-www-form-urlencoded` → dibaca `request.formData()`
 *     (Next.js 16 mengurai kedua bentuk form tanpa konfigurasi tambahan).
 *  2. Tanda tangan diverifikasi SEBELUM menyentuh database. Tanpa ini siapa pun
 *     yang tahu URL callback bisa memalsukan status "lunas".
 *  3. Jumlah tagihan dibandingkan dengan `Payment.amount` — tanda tangan yang
 *     sah untuk nominal lain tetap ditolak.
 *  4. Transisi status memakai UPDATE bersyarat (`WHERE status='PENDING_PAYMENT'`)
 *     di `lib/order-settlement.ts`, sehingga kiriman ulang Duitku (sampai 5x)
 *     tidak menandai pesanan lunas dua kali.
 *  5. HANYA `resultCode` terminal ("02") yang boleh menggagalkan pesanan, dan
 *     itu pun setelah dikonfirmasi ulang lewat `checkTransactionStatus()`.
 *     Kode lain (mis. "01" = diproses) tidak mengubah status apa pun — melepas
 *     kuota terlalu dini berarti oversell yang tidak bisa dipulihkan.
 *  6. Payload mentah di-APPEND ke `Payment.rawCallback` sebagai riwayat audit
 *     (`{ history: [...] }`), bukan ditimpa, agar kiriman ulang tidak menghapus
 *     jejak kiriman sebelumnya.
 *  7. Balasan 200 untuk semua hasil yang SUDAH ditangani, supaya Duitku berhenti
 *     mengirim ulang. Lihat catatan pada blok catch paling bawah untuk kasus
 *     kegagalan tak terduga.
 *
 * Jangan pernah mencetak `DUITKU_API_KEY` (atau isi header apa pun) ke log.
 */
export async function POST(request: Request) {
  // ---- Lapisan pengerasan opsional: asal IP ------------------------------
  // Hanya diperingatkan, TIDAK ditolak — proxy/tunnel bisa mengubah IP asal,
  // dan verifikasi tanda tangan di bawah yang benar-benar menentukan keaslian.
  const callerIp = readClientIp(request);
  if (!isKnownDuitkuIp(callerIp)) {
    console.warn(
      `[duitku:callback] IP pengirim (${callerIp ?? "tidak diketahui"}) di luar daftar IP resmi Duitku — tetap diproses, keaslian ditentukan tanda tangan`,
    );
  }

  let callback: ReturnType<typeof parseCallback> = null;

  try {
    const form = await request.formData();
    callback = parseCallback(form);
  } catch (error) {
    console.error("[duitku:callback] body tidak dapat dibaca:", error);
    return ok();
  }

  if (!callback) {
    console.warn("[duitku:callback] payload tidak lengkap — diabaikan");
    return ok();
  }

  const { merchantOrderId, resultCode, reference } = callback;

  // ---- Verifikasi tanda tangan (SEBELUM menyentuh database) ---------------
  let signatureValid = false;
  try {
    signatureValid = verifyCallbackSignature(callback);
  } catch (error) {
    // Kredensial belum diisi — jangan bocorkan detailnya ke log.
    console.error(
      "[duitku:callback] tidak bisa memverifikasi tanda tangan:",
      error instanceof Error ? error.message : "kesalahan tidak diketahui",
    );
    return ok();
  }

  if (!signatureValid) {
    console.warn(
      `[duitku:callback] TANDA TANGAN TIDAK VALID untuk ${merchantOrderId} — ditolak, database tidak disentuh`,
    );
    return ok();
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { merchantOrderId },
      select: { id: true, orderId: true, amount: true, rawCallback: true },
    });

    if (!payment) {
      console.warn(`[duitku:callback] pesanan ${merchantOrderId} tidak ditemukan`);
      return ok();
    }

    // Jejak audit disimpan apa pun hasil pemeriksaan berikutnya, dan DITAMBAHKAN
    // ke riwayat alih-alih menimpanya — Duitku mengirim ulang sampai 5x dan
    // riwayat itulah yang dipakai saat menelusuri sengketa pembayaran.
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        rawCallback: {
          history: appendHistory(payment.rawCallback, callback.raw),
        } as Prisma.InputJsonValue,
      },
    });

    // ---- Verifikasi jumlah -----------------------------------------------
    const amount = Math.round(Number(callback.amount));
    if (!Number.isFinite(amount) || amount !== payment.amount) {
      console.error(
        `[duitku:callback] jumlah tidak cocok untuk ${merchantOrderId}: callback=${callback.amount}, tagihan=${payment.amount} — ditolak`,
      );
      return ok();
    }

    // ---- Transisi status (idempoten) -------------------------------------
    if (isCallbackSuccess(callback)) {
      const outcome = await settleOrderAsPaid({
        orderId: payment.orderId,
        paymentId: payment.id,
        reference,
        method: callback.paymentCode,
      });

      if (outcome === "ALREADY_SETTLED") {
        // Bisa berarti dua hal: (a) kiriman ulang biasa untuk pesanan yang
        // sudah lunas — aman diabaikan; atau (b) uang masuk SETELAH pesanan
        // terlanjur kedaluwarsa/dibatalkan dan kuotanya dilepas. Kasus (b)
        // butuh tinjauan manual, jadi dicatat sebagai error.
        const current = await prisma.order.findUnique({
          where: { id: payment.orderId },
          select: { status: true },
        });

        if (current && current.status !== "PAID" && current.status !== "PROCESSING" && current.status !== "COMPLETED") {
          console.error(
            `[duitku:callback] PERLU TINJAUAN MANUAL — pembayaran sukses masuk untuk ${merchantOrderId} yang berstatus ${current.status} (reference=${reference ?? "-"})`,
          );
          return ok();
        }
      }

      console.info(
        `[duitku:callback] ${merchantOrderId} LUNAS (resultCode=${resultCode}, reference=${reference ?? "-"}) → ${outcome}`,
      );
      return ok();
    }

    // ---- Bukan sukses: BELUM TENTU gagal ---------------------------------
    // Dokumentasi Duitku tidak konsisten soal kode kegagalan (01 vs 02), dan
    // "01" justru berarti "sedang diproses" pada Check Transaction Status.
    // Menggagalkan pesanan di sini berarti melepas kuota PO ke pembeli lain;
    // bila pembayaran kemudian benar-benar masuk, settleOrderAsPaid hanya bisa
    // mengembalikan ALREADY_SETTLED — uang diterima tapi kuota sudah habis.
    // Karena itu kode non-terminal dibiarkan apa adanya.
    if (!isCallbackTerminalFailure(callback)) {
      console.info(
        `[duitku:callback] ${merchantOrderId} resultCode=${resultCode} bukan kode final — status dibiarkan, menunggu callback berikutnya`,
      );
      return ok();
    }

    // Konfirmasi ulang ke Duitku sebelum melepas kuota. Ini pembacaan kedua
    // atas sumber kebenaran yang sama, jadi kode terminal palsu/keliru tidak
    // langsung menghanguskan reservasi.
    let confirmedStatusCode: string;
    try {
      const confirmed = await checkTransactionStatus(merchantOrderId);
      confirmedStatusCode = confirmed.statusCode;
    } catch (error) {
      // Tidak bisa memastikan → JANGAN gagalkan. Biarkan cron kedaluwarsa
      // (expireOverdueOrders) yang menuntaskan setelah batas waktu lewat.
      console.error(
        `[duitku:callback] konfirmasi status ${merchantOrderId} gagal — pesanan TIDAK digagalkan:`,
        error instanceof Error ? error.message : error,
      );
      return ok();
    }

    if (!TERMINAL_STATUS_CODE.has(confirmedStatusCode)) {
      console.warn(
        `[duitku:callback] ${merchantOrderId} mengirim resultCode=${resultCode}, tetapi Duitku melaporkan statusCode=${confirmedStatusCode} — status dibiarkan`,
      );
      return ok();
    }

    const outcome = await failOrder({
      orderId: payment.orderId,
      paymentId: payment.id,
      // CANCELLED, bukan EXPIRED: pembayaran ini benar-benar gagal/dibatalkan
      // di sisi Duitku. Status EXPIRED disisakan khusus untuk pesanan yang
      // lewat batas waktu tanpa kabar, yaitu sapuan `expireOverdueOrders()`.
      // Sebelumnya dua peristiwa berbeda ini memakai label yang tertukar
      // sehingga riwayat pesanan membingungkan.
      orderStatus: "CANCELLED",
      paymentStatus: "FAILED",
      reference,
    });

    console.info(
      `[duitku:callback] ${merchantOrderId} GAGAL/BATAL (resultCode=${resultCode}, dikonfirmasi statusCode=${confirmedStatusCode}) → ${outcome}`,
    );
    return ok();
  } catch (error) {
    // Kegagalan tak terduga (mis. database sedang tidak bisa dihubungi).
    //
    // Di sini kita SENGAJA tidak membalas 200: percobaan ulang Duitku (sampai
    // 5x) justru menjadi jaring pengaman agar pembayaran yang sudah lunas tidak
    // hilang. Semua hasil yang sudah ditangani di atas tetap membalas 200
    // supaya tidak memicu percobaan ulang yang sia-sia.
    console.error(`[duitku:callback] gagal memproses ${merchantOrderId}:`, error);
    return new Response("ERROR", { status: 500 });
  }
}

/** Duitku hanya menganggap sukses bila menerima HTTP 200 berisi teks biasa. */
function ok(): Response {
  return new Response("OK", { status: 200 });
}

/**
 * Kode Check Transaction Status yang berarti transaksi berakhir gagal/batal.
 * "00" = sukses dan "01" = masih diproses, keduanya BUKAN alasan melepas kuota.
 */
const TERMINAL_STATUS_CODE = new Set(["02"]);

/** IP pengirim menurut proxy terdepan (entri pertama `x-forwarded-for`). */
function readClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) return null;
  return forwardedFor.split(",")[0]?.trim() || null;
}

/**
 * Menyusun riwayat callback: entri lama dipertahankan, entri baru ditambahkan
 * di belakang, dan hanya `MAX_CALLBACK_HISTORY` terakhir yang disimpan supaya
 * kolom JSON tidak membengkak tanpa batas.
 */
function appendHistory(
  existing: Prisma.JsonValue | null,
  entry: Record<string, string>,
): Prisma.InputJsonValue[] {
  const history = readHistory(existing);
  history.push({ receivedAt: new Date().toISOString(), payload: entry });
  return history.slice(-MAX_CALLBACK_HISTORY);
}

/** Membaca riwayat yang sudah tersimpan, termasuk baris format lama. */
function readHistory(existing: Prisma.JsonValue | null): Prisma.InputJsonValue[] {
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) return [];

  const stored = (existing as Record<string, Prisma.JsonValue>).history;
  if (Array.isArray(stored)) {
    return stored.filter((item) => item !== null) as Prisma.InputJsonValue[];
  }

  // Format lama: satu payload polos hasil timpa-menimpa. Dipertahankan sebagai
  // entri pertama supaya migrasi format tidak menghapus jejak yang sudah ada.
  return [existing as Prisma.InputJsonValue];
}
