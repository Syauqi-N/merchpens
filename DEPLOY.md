# Panduan Deploy ke VPS

Panduan ini mengantar kamu dari VPS kosong sampai website pre-order berjalan di
domain sendiri dengan HTTPS, pembayaran Duitku produksi, dan pelepas kuota otomatis.

Semua perintah di bawah bisa disalin-tempel. Yang perlu kamu ganti hanya bagian yang
ditandai jelas: image/tag GHCR, `domain-kamu.com`, alamat email, dan nilai-nilai
rahasia.

> **Baca dulu:** [README.md](README.md) untuk memahami cara kerja pre-order, dan
> [docs/serah-terima.md](docs/serah-terima.md) untuk checklist keamanan sebelum
> go-live.

---

## Daftar isi

1. [Prasyarat](#1-prasyarat)
2. [Siapkan bundle deployment](#2-siapkan-bundle-deployment)
3. [Buat berkas .env](#3-buat-berkas-env)
4. [Ganti domain di konfigurasi Nginx](#4-ganti-domain-di-konfigurasi-nginx)
5. [Pull image dan jalankan](#5-pull-image-dan-jalankan)
6. [Buat akun admin produksi](#6-buat-akun-admin-produksi)
7. [Aktifkan HTTPS (Let's Encrypt)](#7-aktifkan-https-lets-encrypt)
8. [Daftarkan URL callback di dashboard Duitku produksi](#8-daftarkan-url-callback-di-dashboard-duitku-produksi)
9. [Jadwalkan cron pelepas kuota](#9-jadwalkan-cron-pelepas-kuota)
10. [Verifikasi pasca-deploy](#10-verifikasi-pasca-deploy)
11. [Pemeliharaan](#11-pemeliharaan)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prasyarat

| Kebutuhan | Keterangan |
|---|---|
| VPS | Linux amd64. Rekomendasi awal: **2 vCPU, RAM 4 GB, NVMe 50 GB**. Image dibangun GitHub Actions, bukan di VPS. |
| Akses | SSH sebagai pengguna yang bisa `sudo`. |
| Port | 80 dan 443 terbuka di firewall/security group VPS. |
| Domain | Sudah dibeli, dan **A record**-nya diarahkan ke IP VPS. |
| Docker | Docker Engine + plugin Docker Compose v2. |
| GHCR | Image dari workflow GitHub Actions sudah terbit. Untuk package private, siapkan PAT classic dengan izin `read:packages`. |

### Pasang Docker (kalau belum ada)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
```

Keluar dari SSH lalu masuk lagi supaya keanggotaan grup `docker` berlaku, kemudian
pastikan keduanya terpasang:

```bash
docker --version
docker compose version
```

### Pastikan DNS sudah mengarah

```bash
dig +short domain-kamu.com
```

Hasilnya harus berupa IP VPS kamu. Kalau belum, tunggu propagasi DNS dulu — sertifikat
HTTPS di langkah 7 tidak akan bisa terbit sebelum ini benar.

### Buka firewall (bila memakai UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Jangan membuka port 5432 (PostgreSQL) maupun 3000 (aplikasi). Keduanya memang tidak
dipublikasikan oleh `docker-compose.prod.yml` dan tidak boleh dijangkau dari internet.

---

## 2. Siapkan bundle deployment

Siapkan foldernya:

```bash
sudo mkdir -p /opt/toko-online
sudo chown "$USER":"$USER" /opt/toko-online
```

VPS tidak membutuhkan source code, Node.js, npm, atau Git. Salin hanya konfigurasi
deployment dari komputer lokal:

```bash
rsync -avzR \
  docker-compose.prod.yml \
  .env.production.example \
  nginx \
  scripts/deploy-prod.sh \
  pengguna@IP_VPS:/opt/toko-online/
```

Seluruh perintah selanjutnya dijalankan di VPS:

```bash
cd /opt/toko-online
chmod +x scripts/deploy-prod.sh
```

Jika image GHCR bersifat private, login sekali di VPS. Jangan menyimpan token di
`.env` aplikasi; Docker menyimpan kredensial registry secara terpisah.

```bash
read -rsp "GHCR token: " GHCR_TOKEN
echo
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u GANTI_USERNAME --password-stdin
unset GHCR_TOKEN
```

Token VPS cukup mempunyai izin `read:packages`. Image public dapat ditarik tanpa
login. Setelah workflow pertama berhasil, salin salah satu tag `sha-...` dari summary
GitHub Actions untuk diisikan sebagai `APP_TAG`.


---

## 3. Buat berkas .env

```bash
cp .env.production.example .env
chmod 600 .env
```

> **Nama berkasnya harus persis `.env`.** `docker-compose.prod.yml` membacanya lewat
> `env_file: .env`, dan Docker Compose juga mengambil nilai `${POSTGRES_USER}` dan
> kawan-kawan dari berkas bernama `.env` di folder yang sama. Berkas bernama
> `.env.production` tidak akan terbaca sama sekali.

### Buat semua nilai rahasianya lebih dulu

Jalankan empat perintah ini dan simpan hasilnya; nanti ditempelkan ke `.env`.

```bash
openssl rand -base64 33   # -> AUTH_SECRET
openssl rand -hex 32      # -> CRON_SECRET
openssl rand -hex 24      # -> POSTGRES_PASSWORD (aman: tanpa karakter khusus)
openssl rand -base64 18   # -> SEED_ADMIN_PASSWORD
```

`POSTGRES_PASSWORD` sengaja dibuat dengan `-hex`: hasilnya hanya angka dan huruf,
sehingga tidak perlu di-URL-encode saat ditempelkan ke dalam `DATABASE_URL`.

### Sunting berkasnya

```bash
nano .env
```

### Arti setiap variabel dan dari mana nilainya

| Variabel | Dari mana nilainya | Contoh / catatan |
|---|---|---|
| `APP_IMAGE` | Nama package yang dipublish workflow GitHub Actions. | `ghcr.io/organisasi/toko-online` |
| `APP_TAG` | Tag immutable hasil workflow. Disarankan tag SHA, bukan hanya `stable`. | `sha-a82cf91` |
| `DATABASE_URL` | Kamu susun sendiri. Host **wajib** `db` (nama layanan Postgres di Compose), port **wajib** `5432`. User, sandi, dan nama database harus sama persis dengan tiga baris `POSTGRES_*` di bawah. | `postgresql://toko:HASIL_openssl_rand_hex_24@db:5432/toko_online?schema=public` |
| `AUTH_SECRET` | Hasil `openssl rand -base64 33`. | Kunci penanda tangan cookie sesi. Kalau diganti, semua yang sedang login akan ter-logout. |
| `AUTH_TRUST_HOST` | Ketik `true`. | Wajib karena aplikasi berada di belakang Nginx. Tanpa ini, login gagal mengarahkan balik. |
| `APP_URL` | Domain publikmu, `https://`, **tanpa** garis miring di akhir. | `https://domain-kamu.com` |
| `AUTH_URL` | Boleh dibiarkan berkomentar. Isi hanya bila Auth.js perlu dipaksa ke URL tertentu. | `https://domain-kamu.com` |
| `DUITKU_ENV` | Ketik `production` untuk transaksi asli, `sandbox` untuk uji coba. | Lihat [langkah 8](#8-daftarkan-url-callback-di-dashboard-duitku-produksi). |
| `DUITKU_MERCHANT_CODE` | Dashboard merchant Duitku, **project produksi**. | Format seperti `D1234`. |
| `DUITKU_API_KEY` | Dashboard merchant Duitku, project yang sama. | Rahasia paling sensitif di berkas ini — siapa pun yang memegangnya bisa memalsukan status "lunas". |
| `DUITKU_CALLBACK_URL` | Domainmu + `/api/duitku/callback`. Harus HTTPS dan bisa dijangkau publik. | `https://domain-kamu.com/api/duitku/callback` |
| `DUITKU_RETURN_URL` | Domainmu + `/checkout/selesai`. | `https://domain-kamu.com/checkout/selesai` |
| `CRON_SECRET` | Hasil `openssl rand -hex 32`. | Kunci endpoint pelepas kuota. Lihat [langkah 9](#9-jadwalkan-cron-pelepas-kuota). |
| `SEED_ADMIN_EMAIL` | Kamu tentukan. Ini email login admin pertama. | `admin@domain-kamu.com` |
| `SEED_ADMIN_PASSWORD` | Hasil `openssl rand -base64 18`. | Minimal 8 karakter; `admin123` ditolak. Hapus lagi barisnya setelah akun jadi. |
| `NODE_ENV` | Ketik `production`. | Selain mengaktifkan mode produksi Next.js, nilai ini juga menyalakan pagar pengaman di skrip seed. |
| `PORT` | Biarkan `3000`. | Port di dalam container. Mengubahnya berarti harus mengubah Nginx dan Compose juga. |
| `TZ` | `Asia/Jakarta`. | Memengaruhi tampilan tanggal pesanan dan batas waktu periode PO. |
| `POSTGRES_USER` | Kamu tentukan. | `toko` |
| `POSTGRES_PASSWORD` | Hasil `openssl rand -hex 24`. **Harus sama** dengan yang ada di `DATABASE_URL`. | — |
| `POSTGRES_DB` | Kamu tentukan. **Harus sama** dengan nama database di `DATABASE_URL`. | `toko_online` |

Variabel opsional yang tidak ada di berkas contoh tapi dibaca `docker-compose.prod.yml`:

| Variabel | Bawaan | Fungsi |
|---|---|---|
| `CRON_INTERVAL_MS` | `300000` (5 menit) | Jeda antar panggilan pelepas kuota oleh layanan `cron` bawaan. |
| `MIGRATE_MAX_ATTEMPTS` | `10` | Berapa kali migrasi dicoba ulang saat container `app` menyala sebelum menyerah. |
| `MIGRATE_RETRY_DELAY` | `3` | Jeda (detik) antar percobaan migrasi. Naikkan bila database VPS-mu lambat menyala. |

Setelah selesai, pastikan izinnya tetap terkunci:

```bash
chmod 600 .env
ls -l .env      # harus -rw-------
```

---

## 4. Ganti domain di konfigurasi Nginx

Berkas `nginx/conf.d/app.conf` masih memakai `domain-kamu.com` sebagai contoh. Ganti
semuanya sekaligus (ubah `dentalstore.co.id` menjadi domainmu):

```bash
DOMAIN=dentalstore.co.id
sed -i "s/domain-kamu.com/${DOMAIN}/g" nginx/conf.d/app.conf
grep server_name nginx/conf.d/app.conf
```

Baris terakhir harus menampilkan domain barumu. Kalau kamu tidak memakai subdomain
`www`, hapus saja bagian `www.` dari baris `server_name` itu.

---

## 5. Pull image dan jalankan

```bash
scripts/deploy-prod.sh
```

Script memvalidasi Compose, menarik image `APP_IMAGE:APP_TAG`, lalu menyalakan semua
layanan tanpa build source. Pada pembaruan berikutnya script juga membuat backup
database sebelum container baru menjalankan migrasi. Pantau aplikasi:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

Migrasi database **berjalan otomatis** setiap kali container `app` menyala — itu tugas
`docker-entrypoint.sh`, yang menjalankan `prisma migrate deploy` sebelum aplikasi
dinyalakan. Kalau migrasi gagal, container sengaja berhenti dan aplikasi tidak
dinyalakan di atas skema yang salah. Di log kamu akan melihat baris seperti:

```
[entrypoint] Menjalankan migrasi database (percobaan 1 dari 10)...
[entrypoint] Migrasi database selesai.
[entrypoint] Menjalankan aplikasi di port 3000: node server.js
```

Periksa semua layanan sudah hidup:

```bash
docker compose -f docker-compose.prod.yml ps
```

Kamu harus melihat empat container: `toko-online-db`, `toko-online-app`,
`toko-online-cron`, dan `toko-online-nginx`. Container `app` dan `db` akan berstatus
`healthy` setelah beberapa puluh detik.

Cek status migrasi kapan saja:

```bash
docker compose -f docker-compose.prod.yml run --rm tools npm run db:status
```

---

## 6. Buat akun admin produksi

Tanpa langkah ini, tidak ada yang bisa masuk ke panel `/admin`.

Pastikan dua baris ini sudah terisi di `.env`:

```
SEED_ADMIN_EMAIL=admin@domain-kamu.com
SEED_ADMIN_PASSWORD=<hasil openssl rand -base64 18>
```

Lalu jalankan layanan sekali-jalan `tools`:

```bash
docker compose -f docker-compose.prod.yml run --rm tools
```

Layanan itu menjalankan `npm run db:admin`, yang hanya membuat/memperbarui akun admin
tanpa menyentuh data lain. Kalau akun dengan email tersebut sudah ada, kata sandinya
diperbarui — jadi perintah ini sekaligus menjadi jalur reset kata sandi admin.

Karena `NODE_ENV=production`, skrip ini menolak berjalan bila `SEED_ADMIN_PASSWORD`
kosong, bernilai `admin123`, atau kurang dari 8 karakter. Pesan galatnya jelas dan
langsung memberi tahu apa yang salah.

**Setelah akun jadi**, masuk ke `https://domain-kamu.com/masuk`, pastikan bisa login,
lalu hapus kembali baris `SEED_ADMIN_PASSWORD` dari `.env`:

```bash
sed -i '/^SEED_ADMIN_PASSWORD=/d' .env
```

> **Jangan jalankan `npm run db:seed` di server produksi.** Perintah itu memasukkan
> data demo dan sekarang sengaja menolak berjalan saat `NODE_ENV=production`.

### 6.1 Import produk dan harga awal

Image membawa `Daftar Harga.csv` yang sama dengan release aplikasi. Preview lebih
dulu; command pertama tidak menulis apa pun:

```bash
docker compose -f docker-compose.prod.yml run --rm tools npm run db:catalog:check
```

Pastikan ringkasannya menunjukkan 94 produk dan 13 harga Rp0. Setelah sesuai:

```bash
docker compose -f docker-compose.prod.yml run --rm tools npm run db:catalog
```

Importer hanya meng-upsert kategori Semester 3/5/7 serta produk, harga, satuan, dan
relasinya. Pengguna, pesanan, pembayaran, upload, dan periode PO tidak disentuh.
Importer tidak berjalan otomatis ketika deploy supaya perubahan admin tidak tiba-tiba
ditimpa CSV lama. Jalankan ulang hanya ketika memang ingin menyinkronkan CSV release.

---

## 7. Aktifkan HTTPS (Let's Encrypt)

Pastikan situs sudah bisa dibuka lewat `http://domain-kamu.com` sebelum melanjutkan.
Nginx harus dalam keadaan hidup karena certbot memverifikasi kepemilikan domain lewat
folder yang dilayaninya.

### 7.1 Terbitkan sertifikat

Jalankan dari `/opt/toko-online` (ganti domain dan email):

```bash
docker run --rm \
  -v "$PWD/nginx/certbot/conf:/etc/letsencrypt" \
  -v "$PWD/nginx/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d domain-kamu.com -d www.domain-kamu.com \
  --email email-kamu@contoh.com --agree-tos --no-eff-email
```

Kalau berhasil, sertifikat tersimpan di `nginx/certbot/conf/live/domain-kamu.com/`.

### 7.2 Aktifkan blok HTTPS

```bash
mv nginx/conf.d/app-ssl.conf.example nginx/conf.d/app-ssl.conf
DOMAIN=dentalstore.co.id
sed -i "s/domain-kamu.com/${DOMAIN}/g" nginx/conf.d/app-ssl.conf
```

Nginx hanya membaca berkas berakhiran `.conf`, jadi selama namanya masih
`.conf.example` isinya diabaikan.

### 7.3 Alihkan HTTP ke HTTPS

Buka `nginx/conf.d/app.conf`, cari baris berikut, lalu hapus tanda `#` di depannya:

```nginx
# return 301 https://$host$request_uri;
```

Blok `/.well-known/acme-challenge/` di atasnya **jangan** diutak-atik — blok itu harus
tetap dilayani lewat HTTP polos supaya perpanjangan sertifikat otomatis tidak gagal.

### 7.4 Uji dan muat ulang Nginx

```bash
docker compose -f docker-compose.prod.yml exec nginx nginx -t
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### 7.5 Perbarui URL di .env

Pastikan `APP_URL`, `DUITKU_CALLBACK_URL`, dan `DUITKU_RETURN_URL` (serta `AUTH_URL`
bila kamu mengisinya) sudah memakai `https://`, lalu jalankan ulang aplikasinya:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate app
```

### 7.6 Jadwalkan perpanjangan otomatis

Sertifikat Let's Encrypt berlaku 90 hari. Tambahkan ke crontab:

```bash
crontab -e
```

Tempelkan (satu baris, ganti path bila proyekmu tidak di `/opt/toko-online`):

```cron
0 3 * * * cd /opt/toko-online && docker run --rm -v "$PWD/nginx/certbot/conf:/etc/letsencrypt" -v "$PWD/nginx/certbot/www:/var/www/certbot" certbot/certbot renew --webroot -w /var/www/certbot --quiet && docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload
```

---

## 8. Daftarkan URL callback di dashboard Duitku produksi

Status pembayaran di website **hanya** dipercaya dari webhook server-ke-server Duitku.
Kalau URL-nya tidak terdaftar, pembayaran mahasiswa akan masuk ke rekening tetapi
pesanannya selamanya berstatus "Menunggu Pembayaran".

### 8.1 Beda sandbox dan produksi

| | Sandbox | Produksi |
|---|---|---|
| Untuk apa | Uji coba. Tidak ada uang sungguhan yang berpindah. | Transaksi asli. |
| Kredensial | Bisa dibuat sendiri, langsung aktif. | **Butuh verifikasi merchant** oleh Duitku. |
| `DUITKU_ENV` | `sandbox` | `production` |
| URL createInvoice | `https://api-sandbox.duitku.com/api/merchant/createInvoice` | `https://api-prod.duitku.com/api/merchant/createInvoice` |
| Halaman bayar | `https://app-sandbox.duitku.com/redirect_checkout` | `https://app-prod.duitku.com/redirect_checkout` |
| Cek status transaksi | `https://sandbox.duitku.com/webapi/api/merchant/transactionStatus` | `https://passport.duitku.com/webapi/api/merchant/transactionStatus` |

Kode merchant dan API key **berbeda** antara sandbox dan produksi. Memakai kredensial
sandbox di server produksi berarti tidak ada satu pun transaksi asli yang masuk.

> **Verifikasi merchant butuh waktu.** Duitku meminta dokumen legalitas dan rekening
> penampung sebelum mengaktifkan project produksi. Urus ini **jauh-jauh hari** sebelum
> periode PO dibuka, jangan di hari-H. Baca juga peringatan soal rekening organisasi
> di [docs/serah-terima.md](docs/serah-terima.md).

### 8.2 Langkah pendaftaran

1. Masuk ke <https://passport.duitku.com/merchant> dengan akun merchant BEM.
2. Pastikan kamu berada di **project produksi**, bukan sandbox.
3. Salin **Merchant Code** dan **API Key** ke `.env`
   (`DUITKU_MERCHANT_CODE`, `DUITKU_API_KEY`).
4. Di pengaturan project, isi alamat callback dan return:

   | Kolom di dashboard | Isi |
   |---|---|
   | Callback URL (URL notifikasi / webhook) | `https://domain-kamu.com/api/duitku/callback` |
   | Return URL | `https://domain-kamu.com/checkout/selesai` |

   Keduanya harus HTTPS dan bisa dijangkau publik. Alamat lokal, IP privat, atau
   `http://` biasa akan ditolak.
5. Set `DUITKU_ENV="production"` di `.env`.
6. Jalankan ulang aplikasi supaya nilai baru terbaca:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --force-recreate app
   ```

Rincian teknis (rumus tanda tangan HMAC-SHA256, daftar IP resmi Duitku, kode metode
pembayaran) ada di [docs/duitku-integration.md](docs/duitku-integration.md).

---

## 9. Jadwalkan cron pelepas kuota

### Kenapa ini WAJIB

Kuota pre-order dipotong **saat checkout**, bukan saat pembayaran lunas. Kalau
mahasiswa membuat pesanan lalu tidak membayar, kuota itu tetap tertahan atas namanya.

Endpoint `GET /api/cron/expire-orders` adalah yang menandai pesanan seperti itu sebagai
`Kadaluarsa` (setelah lewat 60 menit) dan **mengembalikan kuotanya** supaya bisa
dipesan mahasiswa lain.

Tanpa penjadwalan, produk akan terlihat "habis" padahal sebenarnya tidak — dan
periode PO bisa tutup dengan kuota tersangkut di pesanan-pesanan yang tidak pernah
dibayar. Ini kesalahan deploy paling merugikan di sistem ini.

### Cara A — layanan `cron` bawaan (sudah aktif)

`docker-compose.prod.yml` sudah memuat container `cron` yang memanggil endpoint itu
setiap 5 menit memakai `CRON_SECRET` dari `.env`. Kamu **tidak perlu melakukan apa
pun** selain memastikan container-nya hidup:

```bash
docker compose -f docker-compose.prod.yml ps cron
docker compose -f docker-compose.prod.yml logs --tail 50 cron
```

Log yang sehat justru **sepi** — pesan hanya muncul ketika ada kegagalan. Kalau kamu
melihat peringatan `CRON_SECRET kosong`, isi dulu variabel itu di `.env`.

Ubah jedanya lewat `.env` (nilainya dalam milidetik):

```
CRON_INTERVAL_MS=180000     # 3 menit
```

lalu:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate cron
```

### Cara B — crontab di VPS (cadangan / pengganti)

Berguna sebagai lapis kedua, atau kalau kamu mematikan layanan `cron` bawaan.
Rahasianya dibaca dari `.env` supaya tidak tertulis di dalam crontab.

Buat skripnya (ganti domain):

```bash
sudo tee /usr/local/bin/toko-expire-orders.sh >/dev/null <<'EOF'
#!/bin/sh
set -eu
. /opt/toko-online/.env
curl -fsS -m 30 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  https://domain-kamu.com/api/cron/expire-orders
EOF

sudo sed -i "s/domain-kamu.com/dentalstore.co.id/" /usr/local/bin/toko-expire-orders.sh
sudo chown "$USER":"$USER" /usr/local/bin/toko-expire-orders.sh
chmod 700 /usr/local/bin/toko-expire-orders.sh
```

Uji sekali secara manual:

```bash
/usr/local/bin/toko-expire-orders.sh
```

Balasan yang benar seperti ini:

```json
{"ok":true,"expired":0,"durationMs":42,"checkedAt":"2026-07-26T12:00:00.000Z"}
```

Daftarkan ke crontab **milik pengguna yang sama** dengan pemilik `.env` (bukan root,
karena `.env` ber-izin 600):

```bash
crontab -e
```

Tempelkan:

```cron
*/5 * * * * /usr/local/bin/toko-expire-orders.sh >> "$HOME/toko-expire-orders.log" 2>&1
```

> Rahasianya **selalu** dikirim lewat header, tidak pernah lewat query string. URL
> lengkap ikut tercatat di log akses Nginx, jadi rahasia di query string sama saja
> dengan menuliskannya ke berkas log.

---

## 10. Verifikasi pasca-deploy

Kerjakan berurutan. Jangan menyerahkan website ke BEM sebelum semuanya hijau.

### 10.1 Cek kesehatan aplikasi

```bash
curl -i https://domain-kamu.com/api/health
```

Yang benar: `HTTP/2 200` dengan isi

```json
{"status":"ok","database":true,"waktu":"2026-07-26T12:00:00.000Z"}
```

Kalau balasannya `503` dengan `"database":false`, aplikasi hidup tapi tidak bisa
menghubungi database — lihat [Troubleshooting](#12-troubleshooting).

### 10.2 Cek status container

```bash
docker compose -f docker-compose.prod.yml ps
```

`toko-online-app` dan `toko-online-db` harus `Up (healthy)`.

### 10.3 Cek HTTPS dan pengalihan

```bash
curl -sI http://domain-kamu.com | head -n 1     # harus 301
curl -sI https://domain-kamu.com | head -n 1    # harus 200
```

### 10.4 Coba alur lengkap sebagai mahasiswa

1. Masuk ke panel admin, buat satu periode PO uji coba dengan tanggal berakhir
   beberapa jam ke depan dan status **Aktif**.
2. Tambahkan satu produk murah ke periode itu dengan kuota `1` dan harga khusus PO
   yang kecil (misalnya Rp 10.000).
3. Buka website dari peramban lain (mode penyamaran), daftar sebagai mahasiswa,
   pesan produk itu, lalu bayar sungguhan lewat QRIS.
4. Pastikan status pesanan berubah menjadi **Dibayar** sendiri dalam beberapa detik,
   tanpa kamu menyentuh apa pun di panel admin. Ini bukti webhook Duitku bekerja.
5. Buka `/admin/rekap`, pastikan pesanan itu muncul, lalu unduh berkas Excel-nya dan
   pastikan kedua lembar (`Per Pesanan` dan `Per Item`) terisi.
6. Batalkan pesanan uji itu dari panel admin dan pastikan kuota kembali ke `1`.
7. Hapus periode uji coba tersebut sebelum periode asli dibuka.

### 10.5 Cek log

```bash
docker compose -f docker-compose.prod.yml logs --tail 100 app
docker compose -f docker-compose.prod.yml logs --tail 50 cron
docker compose -f docker-compose.prod.yml logs --tail 50 nginx
```

Cari jejak webhook Duitku:

```bash
docker compose -f docker-compose.prod.yml logs app | grep -i duitku
```

### 10.6 Pastikan database tidak terbuka ke internet

Dari komputer lain (bukan dari VPS):

```bash
nc -zv IP_VPS 5432
```

Harus **gagal** tersambung. Kalau berhasil, ada yang salah pada firewall atau ada
`ports:` yang tidak seharusnya ditambahkan ke layanan `db`.

### 10.7 Pastikan gambar unggahan langsung tampil

Ini pemeriksaan yang paling sering terlewat, dan gagalnya tidak kelihatan sampai
pengurus mengeluh "gambar produknya kosong".

1. Masuk ke panel admin, buka **Kategori**, unggah satu gambar uji pada salah satu
   kategori, lalu simpan.
2. **Tanpa me-restart apa pun**, muat ulang halaman depan. Gambar itu harus langsung
   tampil.
3. Klik kanan gambarnya → salin alamatnya. Alamatnya harus berbentuk
   `https://domain-kamu.com/uploads/<uuid>.webp` — **bukan** `/_next/image?...`.
   Buka alamat itu langsung di tab baru, harus tampil (200), bukan 404.

Kalau langkah 2 atau 3 gagal, jangan diteruskan ke pemakaian sungguhan — baca
[Gambar tidak muncul padahal unggahnya berhasil](#gambar-tidak-muncul-padahal-unggahnya-berhasil)
di bab Troubleshooting.

Kalau kamu lebih suka memeriksanya dari terminal VPS:

```bash
# Ganti <uuid>.webp dengan nama berkas yang barusan diunggah.
docker compose -f docker-compose.prod.yml exec app ls -la /app/public/uploads
curl -I https://domain-kamu.com/uploads/<uuid>.webp
```

Perintah pertama harus menampilkan berkasnya milik `nextjs`, dan perintah kedua
harus menjawab `HTTP/2 200` dengan `content-type: image/webp`.

---

## 11. Pemeliharaan

### 11.1 Memperbarui aplikasi

```bash
cd /opt/toko-online
sed -i 's/^APP_TAG=.*/APP_TAG="sha-GANTI_COMMIT_BARU"/' .env
scripts/deploy-prod.sh
docker compose -f docker-compose.prod.yml logs -f app
```

`deploy-prod.sh` menyimpan backup pra-deploy ke `./backups/`. Tag lama tetap ada di
GHCR dan dapat dipakai rollback kode dengan mengganti `APP_TAG`, tetapi rollback
database tetap harus mempertimbangkan kompatibilitas migrasi.

Setelah selesai, verifikasi ulang:

```bash
curl -fsS https://domain-kamu.com/api/health
docker compose -f docker-compose.prod.yml run --rm tools npm run db:status
```

### 11.2 Backup database

Isi seluruh toko — produk, pesanan, akun, kuota — ada di volume
`toko-online-db-data`.

**Backup manual:**

```bash
cd /opt/toko-online
docker compose -f docker-compose.prod.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > "backup-$(date +%F-%H%M).sql.gz"
ls -lh backup-*.sql.gz
```

**Backup otomatis harian.** Buat skripnya:

```bash
sudo tee /usr/local/bin/toko-backup.sh >/dev/null <<'EOF'
#!/bin/sh
set -eu
PROYEK=/opt/toko-online
TUJUAN=/var/backups/toko-online
STEMPEL=$(date +%F-%H%M)

mkdir -p "$TUJUAN"
cd "$PROYEK"

# Database
docker compose -f docker-compose.prod.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > "$TUJUAN/db-$STEMPEL.sql.gz"

# Gambar unggahan
docker run --rm \
  -v toko-online-uploads:/data:ro \
  -v "$TUJUAN:/backup" \
  alpine tar czf "/backup/uploads-$STEMPEL.tar.gz" -C /data .

# Simpan 14 hari terakhir saja
find "$TUJUAN" -name '*.gz' -mtime +14 -delete
EOF

sudo chmod 700 /usr/local/bin/toko-backup.sh
sudo mkdir -p /var/backups/toko-online
```

Jadwalkan setiap hari pukul 02.00:

```bash
sudo crontab -e
```

```cron
0 2 * * * /usr/local/bin/toko-backup.sh >> /var/log/toko-backup.log 2>&1
```

> Backup yang tersimpan di VPS yang sama **bukan** backup. Salin berkasnya secara
> berkala ke tempat lain, misalnya ke komputermu:
>
> ```bash
> rsync -avz pengguna@IP_VPS:/var/backups/toko-online/ ./backup-toko/
> ```

**Memulihkan database dari backup:**

```bash
cd /opt/toko-online

# 1. Matikan aplikasi & cron supaya tidak ada yang menulis saat restore
docker compose -f docker-compose.prod.yml stop app cron

# 2. Kosongkan skema lama
docker compose -f docker-compose.prod.yml exec -T db \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
         -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'

# 3. Masukkan isi backup
gunzip -c backup-2026-07-26-0200.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T db \
      sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'

# 4. Nyalakan lagi
docker compose -f docker-compose.prod.yml start app cron
docker compose -f docker-compose.prod.yml logs -f app
```

Ganti `backup-2026-07-26-0200.sql.gz` dengan nama berkas cadanganmu. Setelah selesai,
cek `curl -fsS https://domain-kamu.com/api/health` dan pastikan data lama sudah kembali
di panel admin.

> `DROP SCHEMA public CASCADE` **menghapus seluruh isi database saat ini**. Jalankan
> hanya kalau kamu memang bermaksud mengganti isinya dengan backup.

### 11.3 Backup folder uploads

Gambar produk, kategori, dan banner tersimpan di volume Docker
`toko-online-uploads`, bukan di dalam image. Volume ini sama pentingnya dengan
database — tanpa backup, seluruh gambar hilang kalau volumenya terhapus.

**Backup:**

```bash
cd /opt/toko-online
docker run --rm \
  -v toko-online-uploads:/data:ro \
  -v "$PWD:/backup" \
  alpine tar czf "/backup/uploads-$(date +%F).tar.gz" -C /data .
```

**Restore:**

```bash
cd /opt/toko-online
docker run --rm \
  -v toko-online-uploads:/data \
  -v "$PWD:/backup" \
  alpine sh -c 'cd /data && tar xzf /backup/uploads-2026-07-26.tar.gz'

docker compose -f docker-compose.prod.yml restart app
```

**Melihat isi volume tanpa mengubah apa pun:**

```bash
docker run --rm -v toko-online-uploads:/data:ro alpine ls -lh /data | head
```

### 11.4 Melihat log

```bash
# Ikuti log aplikasi secara langsung
docker compose -f docker-compose.prod.yml logs -f app

# 200 baris terakhir dari semua layanan
docker compose -f docker-compose.prod.yml logs --tail 200

# Hanya sejak 1 jam terakhir
docker compose -f docker-compose.prod.yml logs --since 1h app

# Saring kata kunci
docker compose -f docker-compose.prod.yml logs app | grep -i "error\|duitku\|cron"
```

Ukuran log sudah dibatasi (10 MB per berkas, maksimal 3 berkas per layanan), jadi disk
VPS tidak akan penuh pelan-pelan karenanya.

### 11.5 Membersihkan sisa build

Build berulang meninggalkan image lama yang memakan disk:

```bash
df -h /
docker image prune -f
docker builder prune -f
```

> Jangan pernah menjalankan `docker system prune --volumes` di server ini.
> Perintah itu bisa ikut menghapus `toko-online-db-data` dan `toko-online-uploads`.

### 11.6 Menghentikan & menyalakan kembali

```bash
docker compose -f docker-compose.prod.yml stop     # berhenti, data aman
docker compose -f docker-compose.prod.yml start    # nyalakan lagi
docker compose -f docker-compose.prod.yml restart app
docker compose -f docker-compose.prod.yml down     # matikan & hapus container (VOLUME TETAP AMAN)
```

`down` tanpa `-v` tidak menghapus volume. **Jangan pernah** menambahkan `-v` di server
produksi — itu menghapus seluruh database dan gambar.

---

## 12. Troubleshooting

### Webhook Duitku tidak masuk (pesanan tetap "Menunggu Pembayaran" padahal sudah dibayar)

Periksa berurutan:

1. **URL callback terdaftar?** Cek di dashboard Duitku, harus persis
   `https://domain-kamu.com/api/duitku/callback`.
2. **Bisa dijangkau dari luar?** Dari komputer lain:

   ```bash
   curl -i -X POST https://domain-kamu.com/api/duitku/callback
   ```

   Yang penting permintaannya **sampai** (apa pun kode statusnya, asal bukan
   `connection refused`, `timeout`, atau galat sertifikat). Kalau balasannya 404,
   berarti Nginx tidak meneruskan ke aplikasi.
3. **Project-nya benar?** Kredensial sandbox tidak akan pernah menerima callback
   produksi. Pastikan `DUITKU_ENV=production` dan `DUITKU_MERCHANT_CODE` /
   `DUITKU_API_KEY` berasal dari project produksi yang sama.
4. **Tanda tangan cocok?** Kalau `DUITKU_API_KEY` salah, verifikasi HMAC gagal dan
   callback ditolak. Cek log:

   ```bash
   docker compose -f docker-compose.prod.yml logs app | grep -i duitku
   ```
5. **HTTPS valid?** Duitku menolak sertifikat kedaluwarsa atau self-signed.
6. **Ada firewall/CDN di depan?** Kalau kamu memasang Cloudflare, IP pengirim yang
   terlihat aplikasi berubah. Sesuaikan baris `proxy_set_header X-Forwarded-For` di
   `nginx/conf.d/` menjadi `$proxy_add_x_forwarded_for` (penjelasannya ada sebagai
   komentar di dalam berkasnya).

Sementara itu, pesanan bisa diselamatkan manual dari panel admin: buka detail
pesanan, tekan **Sinkronkan status pembayaran** untuk bertanya langsung ke Duitku.

### Migrasi gagal / container `app` berhenti terus

```bash
docker compose -f docker-compose.prod.yml logs app | tail -n 60
```

| Pesan | Penyebab & solusi |
|---|---|
| `variabel DATABASE_URL belum diisi` | `.env` tidak terbaca. Pastikan namanya persis `.env` dan berada di folder yang sama dengan `docker-compose.prod.yml`. |
| `Can't reach database server at db:5432` | Host di `DATABASE_URL` salah (harus `db`, bukan `localhost`) atau container `db` belum sehat. Cek `docker compose -f docker-compose.prod.yml ps db`. |
| `password authentication failed` | `POSTGRES_PASSWORD` tidak sama dengan sandi di `DATABASE_URL`. Perhatikan juga: mengubah `POSTGRES_PASSWORD` **setelah** database terbentuk tidak mengubah sandi di dalamnya. Ubah lewat `docker compose -f docker-compose.prod.yml exec db psql -U toko -c "\password toko"`. |
| `migrasi database tidak berhasil setelah 10 percobaan` | Database benar-benar tidak terjangkau. Periksa layanan `db` dan volume-nya. |
| Sandi mengandung `@ : / ? # & % +` | Sandi di dalam `DATABASE_URL` **wajib** di-URL-encode. Paling aman: ganti sandi dengan hasil `openssl rand -hex 24`. |

Cek status migrasi secara terpisah:

```bash
docker compose -f docker-compose.prod.yml run --rm tools npm run db:status
```

### Workflow image gagal atau image tidak bisa ditarik

| Gejala | Penyebab & solusi |
|---|---|
| Job `Typecheck and lint` gagal | Buka log GitHub Actions dan perbaiki TypeScript/ESLint. Image sengaja tidak dipublish bila verifikasi source gagal. |
| Job `Build and push GHCR image` gagal | Periksa log build dan pastikan workflow mempunyai permission `packages: write`. Build dilakukan di GitHub Actions, bukan di VPS. |
| `manifest unknown` saat `docker compose pull` | `APP_TAG` tidak ada di package GHCR atau salah ketik. Salin tag `sha-...` persis dari summary workflow. |
| `denied` / `unauthorized` saat pull | Package private dan VPS belum login. Jalankan kembali `docker login ghcr.io` memakai PAT classic yang hanya memiliki `read:packages`. |
| Image lama masih berjalan | Periksa `docker compose ... images`, lalu pastikan `.env` memakai tag SHA baru dan jalankan `scripts/deploy-prod.sh` lagi. |

### Status pembayaran tidak berubah

1. Buka `/admin/pesanan`, klik pesanannya.
2. Tekan **Sinkronkan status pembayaran** — aplikasi bertanya langsung ke Duitku dan
   memperbarui status bila memang sudah lunas.
3. Kalau Duitku juga menyatakan belum lunas, berarti uangnya memang belum masuk.
4. Kalau uang jelas sudah masuk (ada di dashboard Duitku) tetapi sinkronisasi gagal,
   pakai **Tandai lunas manual**. Tombol ini aman ditekan berulang: pesanan yang sudah
   lunas tidak akan diproses dua kali.
5. Lalu perbaiki akar masalahnya — lihat bagian webhook di atas.

### Gambar tidak muncul padahal unggahnya berhasil

Gejalanya: di panel admin unggah gambar terlihat sukses, tapi di halaman produk
gambarnya kosong/rusak. Buka alamat gambarnya langsung
(`https://domain-kamu.com/uploads/<nama-berkas>.webp`) — kalau jawabannya **404**,
hampir pasti nginx belum memasang volume `uploads`.

Gambar unggahan **dilayani oleh nginx**, bukan oleh aplikasi. Ini disengaja: server
produksi Next hanya mendata isi folder `public/` **satu kali saat menyala**, jadi
berkas yang baru diunggah tidak akan pernah dilayaninya sampai container di-restart.
Karena itu volume `uploads` dipasang di **dua** tempat:

| Layanan | Titik pasang | Mode | Gunanya |
|---|---|---|---|
| `app` | `/app/public/uploads` | tulis-baca | tempat panel admin menyimpan berkas |
| `nginx` | `/var/www/uploads` | baca saja | tempat berkas itu dilayani ke pengunjung |

Periksa keduanya benar-benar ada:

```bash
docker compose -f docker-compose.prod.yml config | grep -B2 -A3 uploads
docker volume ls | grep toko-online
```

Harus muncul target `/app/public/uploads` **dan** `/var/www/uploads`, serta volume
bernama `toko-online-uploads`. Kalau salah satu tidak ada, pasang ulang layanannya:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate nginx app
```

Pastikan juga blok `location ^~ /uploads/` masih ada di `nginx/conf.d/app.conf`
(dan di `app-ssl.conf.example` bila HTTPS sudah aktif) — kalau blok itu terhapus,
permintaan gambar jatuh ke aplikasi dan kembali 404:

```bash
grep -n "location ^~ /uploads/" nginx/conf.d/*.conf
docker compose -f docker-compose.prod.yml exec nginx nginx -t
```

Kalau volumenya ada tetapi isinya kosong, pulihkan dari backup
(lihat [11.3](#113-backup-folder-uploads)).

> Jangan menyalakan kembali pengoptimal gambar Next (`unoptimized: true` di
> `next.config.ts`). Kalau dimatikan, `<Image>` akan meminta lewat
> `/_next/image?url=/uploads/...` — dan permintaan itu ditangani aplikasi, sehingga
> semua gambar yang baru diunggah dijawab **400** sampai container di-restart.
> Alasan lengkapnya ditulis sebagai komentar di dalam `next.config.ts`.

Kalau unggahan gambar **baru** gagal dengan galat `permission denied` di log `app`
(biasanya karena volumenya terlanjur dibuat sebagai milik root oleh image versi lama),
perbaiki kepemilikannya sekali saja:

```bash
docker compose -f docker-compose.prod.yml stop app
docker run --rm -v toko-online-uploads:/data alpine chown -R 1001:1001 /data
docker compose -f docker-compose.prod.yml start app
```

`1001:1001` adalah uid/gid pengguna `nextjs` di dalam image — aplikasi sengaja tidak
berjalan sebagai root.

Batas unggahan: 5 MB per berkas; format yang diterima JPEG, PNG, WebP, dan AVIF.
Semua gambar di-encode ulang menjadi WebP dan diperkecil hingga sisi terpanjang
1600 piksel.

### Situs balas 502 Bad Gateway

Nginx hidup tetapi tidak bisa menghubungi aplikasi.

```bash
docker compose -f docker-compose.prod.yml ps app
docker compose -f docker-compose.prod.yml logs --tail 50 app
docker compose -f docker-compose.prod.yml restart nginx
```

Biasanya karena container `app` sedang mati (migrasi gagal) atau baru saja dibangun
ulang. Nginx sudah dikonfigurasi menerjemahkan nama `app` lewat DNS Docker setiap
permintaan, jadi 502 permanen setelah rebuild seharusnya tidak terjadi.

### Sertifikat HTTPS gagal terbit

| Gejala | Solusi |
|---|---|
| `Challenge failed` / `404` saat validasi | DNS belum mengarah ke IP VPS (`dig +short domain-kamu.com`), atau `server_name` di `nginx/conf.d/app.conf` belum diganti. |
| `Connection refused` | Port 80 tertutup di firewall, atau container `nginx` mati. |
| `too many failed authorizations` | Batas percobaan Let's Encrypt tercapai. Tunggu satu jam, dan perbaiki dulu masalahnya sebelum mencoba lagi. |
| HTTPS aktif tapi login gagal | `AUTH_TRUST_HOST` belum `true`, atau `APP_URL` masih `http://`. Perbaiki `.env` lalu `docker compose -f docker-compose.prod.yml up -d --force-recreate app`. |

### Kuota terlihat habis padahal tidak ada yang memesan

Cron pelepas kuota tidak berjalan. Cek:

```bash
docker compose -f docker-compose.prod.yml logs --tail 50 cron
```

Lalu panggil endpointnya sekali secara manual dari VPS:

```bash
CRON_SECRET=$(grep '^CRON_SECRET=' /opt/toko-online/.env | cut -d= -f2- | tr -d '"')
curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" \
  https://domain-kamu.com/api/cron/expire-orders
```

Nilai `expired` pada balasannya menunjukkan berapa pesanan yang baru saja
dikedaluwarsakan dan kuotanya dikembalikan. Kalau balasannya `401`, `CRON_SECRET` yang
kamu kirim tidak sama dengan yang ada di `.env` container — jalankan ulang container
`app` setelah mengubah `.env`.
