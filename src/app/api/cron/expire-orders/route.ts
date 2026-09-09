import crypto from "node:crypto";

import { expireOverdueOrders } from "@/lib/inventory";
import { processPaidOrdersForClosedPeriods } from "@/lib/order-processing";

/**
 * Penyapu status pesanan otomatis — dipanggil penjadwal (cron eksternal,
 * Vercel Cron, atau systemd timer).
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://toko/api/cron/expire-orders
 *
 * - Tagihan lewat `Payment.expiresAt` menjadi EXPIRED dan kuotanya dikembalikan.
 * - Pesanan PAID menjadi PROCESSING setelah semua periode itemnya ditutup.
 *
 * Aplikasi juga menjalankan keduanya secara oportunistik, jadi endpoint ini
 * adalah jaring pengaman untuk toko yang sedang sepi pengunjung.
 *
 * Rahasianya HANYA dibaca dari header — jangan pernah menaruhnya di query
 * string karena URL ikut tercatat di log server dan riwayat browser.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  // Fail-closed: di production, cron WAJIB dikonfigurasi dengan secret.
  // Tanpa secret, endpoint menolak sepenuhnya demi mencegah eksekusi sepihak.
  if (!secret) {
    if (isProd) {
      console.error("[cron:expire-orders] DITOLAK: CRON_SECRET belum dikonfigurasi di environment produksi.");
      return Response.json(
        { ok: false, message: "Endpoint cron belum dikonfigurasi." },
        { status: 503 },
      );
    }
    console.warn("[cron:expire-orders] PERINGATAN: Berjalan tanpa CRON_SECRET (hanya diizinkan di non-produksi).");
  } else {
    const provided = readSecret(request);
    if (!provided || !timingSafeEqual(provided, secret)) {
      return Response.json(
        { ok: false, message: "Tidak diizinkan." },
        { status: 401 },
      );
    }
  }

  try {
    const startedAt = Date.now();
    const expired = await expireOverdueOrders();
    const processing = await processPaidOrdersForClosedPeriods();

    if (expired > 0) {
      console.info(`[cron:expire-orders] ${expired} pesanan dikedaluwarsakan`);
    }
    if (processing > 0) {
      console.info(`[cron:expire-orders] ${processing} pesanan mulai diproses`);
    }

    return Response.json({
      ok: true,
      expired,
      processing,
      durationMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron:expire-orders] gagal:", error);
    return Response.json(
      { ok: false, message: "Gagal menyapu pesanan kedaluwarsa." },
      { status: 500 },
    );
  }
}

/** Menerima `Authorization: Bearer <secret>` maupun `x-cron-secret: <secret>`. */
function readSecret(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim() || null;
  }
  return request.headers.get("x-cron-secret")?.trim() || null;
}

/** Perbandingan yang tahan timing attack. */
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
