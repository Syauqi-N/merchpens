# Merch PENS — Website Pre-Order Merchandise

Website pemesanan merchandise PENS (PDH, Tumbler, Lanyard, Keychain, Sticker
Pack). Semua produk dijual lewat **periode pre-order (PO) berkuota per
varian**, pembayaran otomatis lewat **Duitku** (QRIS / virtual account /
e-wallet). Barang bisa **diambil di kampus** atau **dikirim ke alamat**
(ongkir dibayar manual via WhatsApp admin — tidak masuk total gateway).

Panitia tidak perlu lagi merekap pesanan dari chat grup atau spreadsheet
manual: pembeli memesan sendiri lewat web, kuota varian terpotong otomatis,
pembayaran diverifikasi otomatis, dan pengurus tinggal mengunduh rekap Excel
plus memantau sebaran angkatan/jurusan dari dashboard.

---

## Cara kerja pre-order

1. **Pengurus membuat periode PO** — mis. "PO Batch 1", lengkap dengan tanggal
   & jam mulai dan berakhir. Dalam satu waktu hanya boleh ada **satu periode
   yang terbuka** untuk dipesan (ditegakkan saat aktivasi).
2. **Produk dimasukkan ke periode beserta kuota PER VARIAN** (mis. PDH Size L =
   30). Varian yang belum diberi kuota **tidak bisa dipesan**.
3. **Periode diaktifkan.** Terbuka hanya bila status `Aktif` **dan** waktu
   sekarang di antara mulai–berakhir. Menutup otomatis lewat tanggal berakhir.
4. **Pembeli memesan.** Checkout wajib login (email + password). Wajib isi:
   Mahasiswa/Alumni, nama, WA, email, **angkatan + jurusan (dropdown)**,
   catatan opsional, dan cara terima barang (ambil/kirim + alamat bila kirim).
5. **Kuota dipotong saat checkout (reservasi)** — bukan saat lunas.
6. **Batas bayar 60 menit.** Lewat dari itu pesanan menjadi `Kadaluarsa` dan
   kuotanya dilepas otomatis (cron `GET /api/cron/expire-orders`, wajib
   dijadwalkan di produksi).
7. **Pesanan kirim:** setelah lunas, pembeli menekan tombol **Chat Admin untuk
   Ongkir** (teks WA terisi otomatis: kode, item, total, alamat) lalu membayar
   ongkir manual. Nomor WA admin diatur di menu Beranda.
8. **Pengurus memproses**, mengunduh rekap Excel, membagikan/mengirim barang,
   lalu menandai `Selesai`.

Sisa kuota varian = `kuota - reserved`. `reserved` naik saat checkout, turun
saat kedaluwarsa/dibatalkan.

---

## Fitur

### Untuk pembeli

| Fitur | Keterangan |
|---|---|
| Beranda | Banner, produk unggulan, periode PO berjalan. |
| Katalog & kategori | Pencarian, filter kategori (5 kategori merchandise). |
| Halaman pre-order | Periode terbuka + sisa kuota + hitung mundur. |
| Detail produk | Pilih varian (size/desain), galeri termasuk foto varian. |
| Keranjang | Per varian, tersimpan di browser, tervalidasi ke server. |
| Daftar & masuk | Email + password + nama + no WA. Checkout wajib login. |
| Checkout | Tipe, angkatan, jurusan (dropdown master), ambil/kirim. |
| Pembayaran Duitku | Redirect ke halaman Duitku; QRIS/VA/e-wallet. |
| Riwayat pesanan | `/pesanan` + detail, tombol bayar ulang & chat ongkir. |

### Untuk pengurus (panel `/admin`)

| Menu | Keterangan |
|---|---|
| **Dashboard** | Omzet, kuota varian, varian hampir habis, pesanan kirim perlu follow-up ongkir, dan **analitik per angkatan & jurusan** (filter periode/tipe) untuk bahan promosi. |
| **Produk** | CRUD produk + **varian** (size/desain/SKU/delta harga/foto/aktif). |
| **Kategori** | Kelola 5 kategori merchandise. |
| **Pesanan** | Detail, ubah status, lunas manual (audit), cek ke Duitku, batal (kuota kembali), cetak resi. |
| **Pre-Order** | Buat periode + info ambil/kirim, kuota per varian + harga khusus, aktivasi (single-open), tutup/buka kembali. |
| **Rekap** | Filter tipe/angkatan/jurusan/cara-terima + unduh `.xlsx` (Per Pesanan & Per Item). |
| **Beranda** | Banner, info toko, default ambil, **nomor WA admin**, dan **master angkatan/jurusan** (satu baris per entri). |
| **Pengguna** | Hanya pengurus: buat akun, ubah peran Customer↔Pengurus, nonaktifkan, reset password. |

### Peran

| Peran | Hak |
|---|---|
| `CUSTOMER` | Memesan, melihat pesanannya sendiri. |
| `PENGURUS` | Semua hak admin termasuk kelola pengguna. Minimal 1 pengurus aktif harus tersisa (sistem menolak mencabut yang terakhir). |

Lupa password? Tidak ada reset via email — pengurus mengatur ulang password
customer lewat menu Pengguna (buatkan password baru, sampaikan via jalur
pribadi).

---

## Stack

Next.js 16.2.12 (App Router) + React 19 + Tailwind v4 + shadcn + TS5 +
PostgreSQL 16 + Prisma 7 + Auth.js v5 (bcrypt) + Duitku POP (HMAC-SHA256, tanpa
SDK) + exceljs + sharp (WebP) + react-hook-form/zod + zustand. Produksi: Docker
(app/cron/tools + Postgres + Nginx).

Keamanan yang sudah dipasang: harga selalu dihitung ulang di server dari DB,
reservasi kuota atomik (`UPDATE ... WHERE quota - reserved >= qty`), webhook
diverifikasi HMAC + nominal, otorisasi peran di setiap Server Action, rate
limit (register/login/checkout/invoice/keranjang), security headers, cron
ber-`CRON_SECRET`, dan IDOR check (pesanan hanya pemilik/admin).

---

## Menjalankan lokal

Butuh: Node 20.9+, npm, Docker.

```bash
docker compose up -d            # Postgres 16 di port 5435
cp .env.example .env            # lalu isi AUTH_SECRET (openssl rand -base64 33)
npm install
npm run db:generate
npm run db:migrate
npm run db:seed-images && npm run db:seed   # atau: npm run db:seed-all
npm run dev                     # http://localhost:3001
```

Uji pembayaran (butuh tunnel publik + kredensial sandbox
https://passport.duitku.com/merchant):

```bash
npm run duitku:smoke   # cek kredensial & tanda tangan
npm run test:e2e       # alur pembayaran ujung ke ujung (server dev harus hidup)
```

Akun demo (dari seed, JANGAN dipakai produksi): pengurus
`admin@merch.local` / `admin123`, customer `budi.mahasiswa@pens.ac.id` /
`customer123`.

Perintah lain: `lint`, `typecheck`, `db:studio`, `db:admin` (buat pengurus
dari env), `db:deploy` (migrasi produksi), `db:reset` (hapus semua + seed
ulang, lokal saja).

Dokumentasi: `DEPLOY.md` (deploy VPS), `docs/duitku-integration.md` (rujukan
Duitku), `docs/nextjs16-conventions.md` (konvensi Next 16).
