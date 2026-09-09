import type { NextConfig } from "next";

// Akar proyek = folder tempat perintah build dijalankan (di dalam Docker: /app).
const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  // Kunci akar proyek secara eksplisit. Tanpa ini, Next menebaknya dengan
  // mencari package-lock.json ke folder-folder di atasnya; kalau kebetulan ada
  // lockfile nyasar di atas folder proyek, hasil build standalone bisa
  // mendarat di sub-folder yang salah dan server.js jadi tidak ketemu.
  turbopack: {
    root: projectRoot,
  },
  // Padanan pengaturan di atas untuk build cadangan memakai webpack
  // (`next build --webpack`).
  outputFileTracingRoot: projectRoot,
  // Build "standalone": Next menyalin server beserta node_modules yang
  // benar-benar dipakai ke .next/standalone, sehingga image Docker jauh lebih
  // ramping. CATATAN: folder public/ dan .next/static TIDAK ikut tersalin
  // otomatis — Dockerfile menyalinnya sendiri ke dalam image.
  output: "standalone",
  /**
   * Header keamanan dasar untuk seluruh respons.
   *
   * Sengaja minimal dan aman untuk aplikasi interaktif:
   * - framing dimatikan (clickjacking),
   * - MIME sniffing dimatikan,
   * - referrer tidak bocor ke domain lain (penting: nomor pesanan ada di URL),
   * - sensor browser yang tidak dipakai dimatikan.
   *
   * Tanpa CSP strict: Next menyisipkan skrip inline dan CSP yang salah
   * konfigurasi akan merusak checkout. HSTS sengaja TIDAK di sini (berbahaya
   * di localhost/dev) — aktifkan di nginx produksi bila domain sudah HTTPS.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
  images: {
    // ---------------------------------------------------------------------
    // WAJIB true. Jangan dimatikan tanpa membaca penjelasan ini sampai habis.
    // ---------------------------------------------------------------------
    // Server produksi Next (`node server.js`, hasil build standalone) MENDATA
    // isi folder public/ SATU KALI saja, yaitu saat server menyala. Berkas yang
    // muncul di public/ SESUDAH itu dianggap tidak ada.
    //
    // Panel admin menulis gambar ke public/uploads/ saat aplikasi sedang jalan
    // (src/app/api/upload/route.ts). Akibatnya, dengan pengoptimal gambar
    // bawaan menyala, setiap gambar yang baru diunggah akan:
    //
    //   GET /uploads/<berkas>.webp                 -> 404
    //   GET /_next/image?url=%2Fuploads%2F...      -> 400
    //     ("The requested resource isn't a valid image ... received null")
    //
    // dan baru muncul setelah container di-restart. Bagi pengurus BEM gejalanya
    // terlihat seperti "gambar produk rusak/kosong padahal unggahnya berhasil".
    //
    // Dengan unoptimized: true, <Image> memakai alamat aslinya apa adanya
    // (<img src="/uploads/<berkas>.webp">), sehingga permintaannya tidak pernah
    // masuk ke pengoptimal Next. Di produksi berkasnya dilayani LANGSUNG oleh
    // nginx dari volume "uploads" — lihat blok `location ^~ /uploads/` di
    // nginx/conf.d/app.conf. Jadi Next tidak lagi ikut campur soal gambar
    // unggahan, dan gambar langsung tampil begitu selesai diunggah.
    //
    // Yang hilang dengan pengaturan ini: srcset per lebar layar. Ruginya kecil,
    // karena berkas unggahan sudah dikecilkan sendiri saat diunggah — maksimal
    // 1600 px sisi terpanjang dan sudah dikonversi ke WebP kualitas 82 oleh
    // sharp. Mengaktifkan srcset pun tidak akan menolong gambar unggahan:
    // sumbernya tetap satu berkas yang sama.
    unoptimized: true,
    // Tetap didaftarkan supaya gambar contoh dari seed demo (picsum/placehold)
    // tidak ditolak kalau suatu saat pengoptimal dinyalakan lagi.
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "i.picsum.photos" },
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
};

export default nextConfig;
