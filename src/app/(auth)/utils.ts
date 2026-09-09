/**
 * Membersihkan nilai `?callbackUrl=` agar hanya menerima tujuan internal.
 * Mencegah open redirect ke domain lain (`//jahat.com`, `https://jahat.com`).
 *
 * Nilai ini berakhir di `redirect()` (header `Location`) pada halaman /masuk dan
 * /daftar, jadi kalau lolos ke host luar penyerang bisa mengirim korban ke
 * halaman login palsu. Tiga jebakan berikut WAJIB tetap ditolak — jangan
 * disederhanakan kembali menjadi sekadar cek `startsWith("/")`:
 *
 * 1. Backslash. Nilai "/\evil.com" lolos cek `startsWith("//")` karena karakter
 *    keduanya adalah backslash, tetapi browser menormalkan backslash menjadi
 *    garis miring saat mengurai URL, sehingga tujuan sesungguhnya menjadi
 *    "//evil.com" alias host luar. Backslash di posisi mana pun ditolak.
 * 2. Karakter kontrol. Tab/CR/LF/NUL dibuang diam-diam oleh parser URL browser,
 *    sehingga nilai seperti "/<tab>/evil.com" bisa berubah bentuk setelah
 *    dinormalkan; CR/LF juga bahan baku penyuntikan header.
 * 3. Hasil normalisasi. Sebagai jaring pengaman terakhir, nilai diurai ulang
 *    relatif terhadap origin dummy. Kalau origin hasil urai bergeser, nilai itu
 *    bukan path relatif dan dibuang. Yang dikembalikan adalah bentuk hasil urai
 *    (dijamin diawali satu garis miring), bukan string mentah dari pengguna.
 */
export function safeCallbackUrl(
  value: string | string[] | undefined,
  fallback = "/",
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return fallback;

  // Harus path absolut internal, bukan URL protokol-relatif ("//host").
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;

  // Jebakan 1: backslash setara garis miring bagi browser.
  if (raw.includes("\\")) return fallback;

  // Jebakan 2: rentang kontrol C0 (0x00-0x1F), DEL (0x7F), dan C1 (0x80-0x9F).
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return fallback;
  }

  // Jebakan 3. Host ".invalid" dijamin tidak pernah bisa di-resolve, jadi aman
  // dipakai sebagai basis pembanding.
  const base = "https://callback.invalid";
  let parsed: URL;
  try {
    parsed = new URL(raw, base);
  } catch {
    return fallback;
  }
  if (parsed.origin !== base) return fallback;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
