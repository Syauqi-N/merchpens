import "server-only";

import { headers } from "next/headers";

export {
  consumeRateLimit,
  isRateLimited,
  resetRateLimit,
  type RateLimitResult,
} from "./rate-limit-store";

/**
 * Rate limit dalam memori (fixed window).
 *
 * Melindungi endpoint publik yang mahal/disalahgunakan: pendaftaran, login,
 * checkout, dan validasi keranjang. Tanpa ini, penyerang bisa membanjiri
 * `createOrderAndPay` (tiap panggilan = transaksi DB + sapuan expiry) atau
 * brute-force kredensial tanpa hambatan.
 *
 * BATASAN: ember ini per-proses Node. Pada deployment multi-replika, tiap
 * replika menghitung sendiri — tetap memangkas serangan satu sumber secara
 * drastis, tapi bukan pengganti rate limit di edge (nginx limit_req / WAF)
 * untuk produksi yang serius.
 */

/**
 * IP klien versi terbaik yang kita punya.
 *
 * Di produksi nginx mengisi `X-Forwarded-For`; `X-Real-IP` sebagai cadangan.
 * Nilai ini BISA dipalsukan bila klien langsung mencapai Node tanpa proxy —
 * karena itu dipakai untuk pembatasan laju saja, bukan keputusan keamanan.
 */
export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded.slice(0, 64);
    const realIp = h.get("x-real-ip")?.trim();
    if (realIp) return realIp.slice(0, 64);
  } catch {
    // di luar konteks request (mis. skrip) — kunci global
  }
  return "unknown";
}

/** Pesan generik untuk pengguna yang kena batas laju. */
export function rateLimitedMessage(retryAfterMs: number): string {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return `Terlalu banyak percobaan. Coba lagi dalam ${seconds} detik.`;
}
