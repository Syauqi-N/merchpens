/**
 * Ember rate-limit MURNI (tanpa impor server).
 *
 * Dipisah dari `rate-limit.ts` supaya logikanya bisa diuji dari skrip
 * Node biasa (modul `server-only` melempar error bila diimpor di luar
 * Server Component). Jangan tambahkan impor server ke berkas ini.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

// Jangan biarkan Map tumbuh tanpa batas bila diserang dengan kunci acak:
// sapu entri kedaluwarsa secara oportunistik.
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Pengaman absolut: kalau masih membeludak, kosongkan semuanya — batasan
  // mengetat sesaat, bukan bocor.
  if (buckets.size > 20_000) buckets.clear();
}

export type RateLimitResult = {
  ok: boolean;
  /** Sisa kuota pada jendela berjalan (0 bila dibatasi). */
  remaining: number;
  /** Milidetik sampai jendela direset (0 bila lolos). */
  retryAfterMs: number;
};

/**
 * Konsumsi satu token untuk `key`. Mengembalikan `ok:false` bila jatah habis.
 *
 * @param key Identitas yang dibatasi, mis. `register:1.2.3.4`.
 * @param limit Maksimum panggilan per jendela.
 * @param windowMs Panjang jendela dalam milidetik.
 */
export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, retryAfterMs: 0 };
}

/**
 * Cek apakah sebuah kunci sudah melebihi batas tanpa menambah hitungan.
 * Mengembalikan true jika sudah terblokir.
 */
export function isRateLimited(key: string, limit: number): boolean {
  const now = Date.now();
  sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) return false;
  return existing.count >= limit;
}

/**
 * Reset token untuk sebuah kunci (mis. saat login berhasil).
 */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}


