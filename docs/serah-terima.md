# Checklist Serah Terima — untuk Developer

Berkas ini untuk **kamu, developer**, sebelum menyerahkan website ini ke pengurus BEM.
Isinya: apa yang wajib diamankan sebelum go-live, apa saja yang harus diminta dari BEM,
peringatan khusus soal rekening pembayaran, dan cara mewariskan akses tiap pergantian
kepengurusan.

Panduan pemakaian untuk pengurus (bukan developer) ada di
[panduan-admin.md](panduan-admin.md).

---

## Daftar isi

1. [Checklist keamanan wajib sebelum go-live](#1-checklist-keamanan-wajib-sebelum-go-live)
2. [Yang perlu diminta dari BEM](#2-yang-perlu-diminta-dari-bem)
3. [Peringatan khusus: akun Duitku harus atas nama organisasi](#3-peringatan-khusus-akun-duitku-harus-atas-nama-organisasi)
4. [Serah terima kepengurusan tiap tahun](#4-serah-terima-kepengurusan-tiap-tahun)
5. [Ringkasan biaya Duitku](#5-ringkasan-biaya-duitku)
6. [Yang harus kamu wariskan ke BEM](#6-yang-harus-kamu-wariskan-ke-bem)

---

## 1. Checklist keamanan wajib sebelum go-live

Centang satu per satu. Jangan menyerahkan website sebelum semuanya beres — sistem ini
memegang uang mahasiswa dan data NIM mereka.

### 1.1 Rahasia aplikasi

- [ ] **`AUTH_SECRET` sudah diganti** dengan nilai acak yang dibuat di server:

      openssl rand -base64 33

      Bukan nilai contoh dari `.env.example`, bukan nilai yang sama dengan yang kamu
      pakai di komputer sendiri. Kunci ini yang menandatangani cookie sesi — kalau
      bocor, siapa pun bisa memalsukan sesi login siapa saja, termasuk Pengurus Inti.

- [ ] **`CRON_SECRET` sudah diisi** dengan nilai acak:

      openssl rand -hex 32

      Kalau dikosongkan, endpoint `/api/cron/expire-orders` terbuka untuk siapa saja.
      Dampaknya memang tidak menghancurkan data, tapi tidak ada alasan membiarkannya
      terbuka.

- [ ] **`POSTGRES_PASSWORD` bukan kata sandi tebakan.** Pakai `openssl rand -hex 24`
      (hasilnya bebas karakter khusus sehingga aman ditempel ke `DATABASE_URL` tanpa
      perlu URL-encode).

- [ ] **Tidak ada satu pun nilai `GANTI_...` yang tersisa di `.env`.** Periksa cepat:

      grep -n "GANTI_" /opt/toko-online/.env

      Perintah itu harus tidak menghasilkan apa-apa.

### 1.2 Akun admin

- [ ] **Akun `admin@dentalstore.local` / `admin123` TIDAK ADA di database produksi.**
      Itu akun demo dari `npm run db:seed` dan kata sandinya tertulis terbuka di repo.
      Di produksi akun admin dibuat lewat `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD`
      dengan perintah `docker compose -f docker-compose.prod.yml run --rm tools`.

- [ ] **`npm run db:seed` tidak pernah dijalankan di server produksi.** Perintah itu
      memasukkan produk contoh ke database asli. Yang benar untuk produksi adalah
      `db:admin`.

- [ ] **Kata sandi admin kuat** — minimal 12 karakter acak (`openssl rand -base64 18`),
      bukan nama BEM, bukan tahun kepengurusan, bukan `admin123`.

- [ ] **Kata sandi diserahkan lewat jalur pribadi**, bukan di grup WhatsApp angkatan
      atau grup panitia. Satu per satu ke orangnya langsung.

- [ ] **`SEED_ADMIN_PASSWORD` sudah dihapus dari `.env`** setelah akun berhasil dibuat
      dan sudah dicoba login:

      sed -i '/^SEED_ADMIN_PASSWORD=/d' /opt/toko-online/.env

### 1.3 Pembayaran

- [ ] **`DUITKU_ENV="production"`** — bukan `sandbox`. Dengan `sandbox`, tidak ada satu
      rupiah pun yang benar-benar masuk ke rekening BEM.

- [ ] **`DUITKU_MERCHANT_CODE` dan `DUITKU_API_KEY` berasal dari project PRODUKSI**,
      bukan project sandbox. Keduanya berbeda dan tidak bisa saling menggantikan.

- [ ] **URL callback sudah didaftarkan di dashboard Duitku produksi**:
      `https://domain-kamu.com/api/duitku/callback`.
      Tanpa ini, uang masuk tapi status pesanan tidak pernah berubah menjadi "Dibayar".

- [ ] **Satu transaksi asli sudah diuji ujung ke ujung** — pesan barang murah, bayar
      sungguhan, dan pastikan status berubah otomatis tanpa kamu sentuh. Ini satu-satunya
      bukti bahwa webhook benar-benar bekerja.

- [ ] **`DUITKU_API_KEY` tidak pernah masuk ke Git, chat, tiket, atau screenshot.**
      Siapa pun yang memegangnya bisa membuat tanda tangan palsu dan menandai pesanan
      sebagai lunas.

### 1.4 Berkas rahasia

- [ ] **`.env` tidak ter-commit.** `.gitignore` proyek ini sudah memuat `.env*`, tapi
      pastikan sekali lagi:

      cd /opt/toko-online && git check-ignore -v .env

      Harus menampilkan aturan yang mencocokkannya. Kalau `.env` pernah ter-commit,
      **menghapusnya di commit berikutnya tidak cukup** — nilainya sudah ada selamanya
      di riwayat Git. Ganti semua rahasianya.

- [ ] **Izin `.env` terkunci:**

      chmod 600 /opt/toko-online/.env
      ls -l /opt/toko-online/.env      # harus -rw-------

### 1.5 Jaringan & server

- [ ] **HTTPS aktif dan HTTP dialihkan ke HTTPS.**

      curl -sI http://domain-kamu.com | head -n 1      # harus 301
      curl -sI https://domain-kamu.com | head -n 1     # harus 200

      Tanpa HTTPS, kata sandi mahasiswa dan NIM mereka lewat jaringan dalam keadaan
      terbuka — dan Duitku juga menolak mengirim webhook ke `http://` biasa.

- [ ] **Perpanjangan sertifikat otomatis sudah dijadwalkan.** Sertifikat Let's Encrypt
      berlaku 90 hari. Kalau tidak dijadwalkan, situs mati total tiga bulan setelah
      serah terima — biasanya persis saat kamu sudah tidak lagi mengurus proyek ini.

- [ ] **Port PostgreSQL (5432) tidak terbuka ke publik.** Uji dari komputer lain,
      bukan dari VPS:

      nc -zv IP_VPS 5432

      Harus **gagal** tersambung. `docker-compose.prod.yml` memang tidak
      mempublikasikan port itu; pastikan tidak ada yang menambahkan `ports:` ke
      layanan `db`.

- [ ] **Port aplikasi (3000) juga tidak terbuka ke publik.** Semua lalu lintas harus
      lewat Nginx.

- [ ] **Firewall hanya membuka 22, 80, dan 443.**

- [ ] **Cron pelepas kuota berjalan.** Container `toko-online-cron` hidup, atau ada
      entri crontab yang memanggil `/api/cron/expire-orders`. Tanpa ini, kuota pesanan
      yang tidak dibayar tersangkut selamanya dan produk terlihat habis padahal tidak.

      docker compose -f docker-compose.prod.yml ps cron

- [ ] **Backup otomatis harian sudah dijadwalkan** dan hasilnya **disalin ke luar
      VPS**. Backup yang hanya ada di VPS yang sama akan ikut hilang bersama VPS-nya.

- [ ] **Satu kali pemulihan backup sudah pernah dicoba.** Backup yang belum pernah
      diuji restore bukan backup, hanya harapan.

- [ ] **`/api/health` menjawab 200.**

      curl -fsS https://domain-kamu.com/api/health

- [ ] **Gambar unggahan langsung tampil tanpa restart.** Unggah satu gambar lewat
      panel admin, lalu muat ulang halaman depan tanpa menyentuh server. Gambarnya
      harus langsung muncul, dan alamatnya harus berbentuk
      `https://domain-kamu.com/uploads/<uuid>.webp` (bukan `/_next/image?...`).

      curl -I https://domain-kamu.com/uploads/<uuid>.webp

      Harus `200` dengan `content-type: image/webp`. Kalau `404`, berarti volume
      `uploads` belum terpasang di layanan `nginx` — lihat bab Troubleshooting di
      `DEPLOY.md`. Ini kesalahan yang gampang lolos: berkasnya benar-benar tersimpan,
      hanya tidak pernah sampai ke pengunjung.

### 1.6 Data uji coba

- [ ] **Produk contoh, kategori contoh, dan periode PO uji coba sudah dibersihkan**
      dari database produksi.
- [ ] **Pesanan uji coba sudah dibatalkan** supaya kuotanya kembali dan tidak
      mengotori rekap bendahara.
- [ ] **Informasi toko di menu Beranda sudah diisi data asli** — nama, kontak, tempat
      dan jadwal pengambilan. Kalau dibiarkan, yang tampil adalah nilai bawaan seperti
      "Dental Store" dan "Sekretariat BEM, Gedung A Lantai 2" yang mungkin tidak sesuai.

---

## 2. Yang perlu diminta dari BEM

Kumpulkan sejak awal. Kekurangan salah satunya akan menghambat go-live.

| Yang diminta | Rincian | Kenapa perlu |
|---|---|---|
| **Data produk** | Nama, deskripsi, harga normal, harga khusus PO (bila ada), satuan (pcs/box/set/lusin), merek, dan SKU bila BEM memakainya. Paling praktis: minta dalam bentuk spreadsheet. | Diisikan ke menu Produk. |
| **Kuota per produk** | Berapa banyak yang sanggup diadakan panitia untuk setiap produk di satu batch PO. | Tanpa kuota, produk tidak bisa dipesan sama sekali. |
| **Foto produk** | Satu atau lebih per produk. Maksimal 5 MB per berkas; format JPEG, PNG, WebP, atau AVIF. Bentuk persegi paling rapi tampilannya. | Diunggah lewat panel; disimpan di server. |
| **Kategori** | Daftar pengelompokan produk beserta urutan tampil. | Menu Kategori. |
| **Logo & banner** | Logo BEM/fakultas dan gambar banner untuk beranda. | Menu Beranda. |
| **Info toko** | Nama toko, tagline, email, nomor telepon/WhatsApp, alamat, teks "tentang", dan tautan Instagram/TikTok/Facebook/WhatsApp. | Menu Beranda. Muncul di header dan footer. |
| **Info pengambilan barang** | Tempat pengambilan (mis. "Sekretariat BEM, Gedung A Lantai 2"), jadwal (mis. "Senin–Jumat, 10.00–15.00 WIB"), dan catatan untuk mahasiswa (mis. "Bawa KTM dan tunjukkan kode pesanan"). | Ditampilkan di checkout dan di detail pesanan mahasiswa. |
| **Jadwal periode PO** | Tanggal & jam buka, tanggal & jam tutup batch pertama. | Menu Pre-Order. |
| **Akun Duitku produksi** | Merchant code + API key dari project produksi yang **sudah terverifikasi**. Baca [bagian 3](#3-peringatan-khusus-akun-duitku-harus-atas-nama-organisasi) sebelum BEM mendaftar. | Tanpa ini pembayaran tidak jalan. |
| **Domain** | Nama domain beserta akses ke panel DNS-nya, supaya A record bisa diarahkan ke IP VPS. | Wajib untuk HTTPS dan webhook Duitku. |
| **VPS** | Akses SSH, atau anggaran untuk menyewanya. Minimal 2 GB RAM. | Tempat aplikasi berjalan. |
| **Penanggung jawab teknis** | Nama dan kontak minimal **dua** pengurus yang dipercaya memegang akses Pengurus Inti. | Satu orang pemegang akses = titik kegagalan tunggal. |

> **Urus verifikasi merchant Duitku sejak awal.** Prosesnya butuh dokumen legalitas
> organisasi dan rekening penampung, dan memakan waktu berhari-hari sampai berminggu-minggu.
> Jangan menunggu sampai H-3 pembukaan PO.

---

## 3. Peringatan khusus: akun Duitku harus atas nama ORGANISASI

**Ini bagian paling penting di seluruh berkas ini. Sampaikan langsung ke pengurus inti
BEM, jangan hanya ditulis di dokumen.**

Akun merchant Duitku terikat pada satu **rekening penampung**. Ke rekening itulah
seluruh uang pembayaran mahasiswa dicairkan.

### Yang benar

Daftarkan akun merchant Duitku:

- atas nama **organisasi** (BEM Fakultas / lembaga kemahasiswaan), dan
- dengan **rekening bank organisasi** — rekening kas BEM yang dikelola bendahara dan
  diserahterimakan tiap tahun, dan
- dengan **email organisasi** (mis. `bem.fkg@kampus.ac.id`), bukan Gmail pribadi
  seorang pengurus, dan
- **nomor telepon yang bisa diwariskan**, karena nomor itu dipakai untuk pemulihan akun
  dan verifikasi.

### Yang berbahaya

Mendaftarkan akun Duitku dengan **rekening pribadi seorang pengurus**.

Kelihatannya paling cepat — pengurus itu tinggal memakai rekening dan KTP-nya sendiri,
verifikasi selesai dalam hitungan hari. Tapi risikonya besar dan pasti terjadi:

| Risiko | Yang terjadi |
|---|---|
| **Pengurusnya lulus** | Ini bukan kemungkinan, ini kepastian — semua mahasiswa lulus. Ketika dia pergi, seluruh dana PO mengalir ke rekening orang yang sudah tidak punya kewajiban apa pun ke BEM. |
| **Akses akun ikut hilang** | Email, nomor HP, dan OTP untuk masuk ke dashboard Duitku ada padanya. Kepengurusan berikutnya tidak bisa melihat transaksi, mengubah rekening, atau mengurus keluhan. |
| **Uang tersangkut** | Dana dari mahasiswa mendarat di rekening pribadi. Kalau orangnya sulit dihubungi, sakit, atau berselisih dengan BEM, uang mahasiswa yang jadi taruhan. |
| **Beban pajak & hukum pribadi** | Dana organisasi yang mengalir lewat rekening pribadi bisa terbaca sebagai penghasilan pribadi. Itu menempatkan satu mahasiswa pada risiko yang bukan tanggung jawabnya. |
| **Audit BEM berantakan** | Bendahara tidak bisa mempertanggungjawabkan aliran dana yang tidak pernah melewati kas organisasi. |
| **Mengganti rekening tidak sederhana** | Duitku mensyaratkan verifikasi ulang untuk mengubah rekening penampung. Prosesnya bisa memakan waktu berminggu-minggu — dan biasanya baru disadari ketika PO sudah berjalan dan uang sudah masuk. |

### Kalau BEM tetap terpaksa memakai rekening pribadi

Kadang lembaga kemahasiswaan memang belum punya rekening atas nama organisasi. Kalau
itu keadaannya, minimal lakukan ini dan tulis hitam di atas putih:

- [ ] Buat **surat perjanjian** yang ditandatangani pemilik rekening, ketua BEM, dan
      bendahara: rekening itu hanya menampung dana organisasi, dan pemiliknya wajib
      menyerahkan seluruh dana serta akses akun saat masa jabatannya berakhir.
- [ ] Pemilik rekening adalah **bendahara**, bukan sembarang pengurus.
- [ ] Email dan nomor HP akun Duitku **tetap milik organisasi**, walaupun rekeningnya
      pribadi. Dengan begitu akses dashboard masih bisa diwariskan.
- [ ] Pindahkan dana dari rekening pribadi ke kas BEM **setiap kali pencairan**, jangan
      ditumpuk sampai akhir periode.
- [ ] Jadwalkan **pembuatan rekening organisasi** sebagai agenda kepengurusan, dengan
      target waktu yang jelas.

Sampaikan ini sebelum BEM mendaftar, bukan sesudah. Setelah akun terverifikasi,
mengubahnya jauh lebih repot.

---

## 4. Serah terima kepengurusan tiap tahun

Kepengurusan BEM berganti setiap tahun, sedangkan website ini terus berjalan. Sistem
peran sudah dirancang untuk itu: **Pengurus Inti (`OWNER`) boleh lebih dari satu orang**,
supaya tidak pernah ada keadaan "satu-satunya yang bisa masuk sudah lulus".

### Aturan emasnya

> **Angkat pengurus baru DULU, pastikan mereka bisa masuk, BARU nonaktifkan yang lama.**

Kalau urutannya terbalik dan Pengurus Inti terakhir dinonaktifkan lebih dahulu, tidak
ada seorang pun yang bisa mengangkat penggantinya lewat panel. Pemulihannya harus lewat
akses server — yang mungkin sudah tidak dipegang siapa pun di BEM.

Sistem sudah memasang pagar untuk ini: panel **menolak** menurunkan peran atau
menonaktifkan Pengurus Inti aktif yang terakhir. Tapi jangan bergantung pada pagar itu;
lakukan urutannya dengan benar.

### Langkah serah terima

1. **Pengurus lama** masuk ke panel dengan akun Pengurus Inti-nya, lalu buka
   **`/admin/pengguna`**.
2. **Buat akun untuk pengurus baru**, atau ubah peran akun mereka yang sudah ada
   menjadi **Pengurus Inti**. Minimal **dua orang** — supaya kalau satu kehilangan
   akses, masih ada yang bisa menolong.
3. **Pengurus baru mencoba masuk sendiri** dari perangkat masing-masing. Jangan lanjut
   sebelum ini benar-benar berhasil.

   Kalau kata sandi awalnya sempat dikirim lewat chat, ganti sekarang lewat
   **`/admin/pengguna` → Reset Password**. Perlu diketahui: **tidak ada halaman ganti
   kata sandi mandiri** di website ini, jadi penggantian selalu dilakukan oleh Pengurus
   Inti — termasuk oleh Pengurus Inti untuk akunnya sendiri.
4. **Pengurus baru membuka `/admin/pengguna`** dan memastikan mereka memang melihat
   menu itu. Kalau menunya tidak muncul, perannya belum Pengurus Inti.
5. **Baru setelah itu**, nonaktifkan akun pengurus lama yang sudah tidak menjabat
   (tombol nonaktifkan, **bukan** hapus — akun tidak bisa dihapus, dan memang tidak
   seharusnya, karena riwayat pesanannya harus tetap utuh).
6. **Serahkan juga hal-hal di luar panel:**

   | Yang diserahkan | Ke siapa |
   |---|---|
   | Akses dashboard merchant Duitku (email + nomor HP akun) | Bendahara baru |
   | Akses panel domain/DNS | Penanggung jawab teknis baru |
   | Akses SSH ke VPS | Penanggung jawab teknis baru |
   | Lokasi backup dan cara memulihkannya | Penanggung jawab teknis baru |
   | Berkas [panduan-admin.md](panduan-admin.md), [DEPLOY.md](../DEPLOY.md), dan berkas ini | Semua pengurus baru |

7. **Ganti kata sandi akun-akun di luar panel** (VPS, DNS, Duitku) setelah pengurus
   lama benar-benar pamit.
8. **Catat di notulen serah terima** siapa saja yang berperan Pengurus Inti pada
   periode berjalan. Setahun lagi, catatan ini yang menyelamatkan penerusnya.

### Yang TIDAK perlu diganti saat pergantian pengurus

`AUTH_SECRET`, `CRON_SECRET`, dan kredensial Duitku **tidak perlu** diganti hanya karena
kepengurusan berganti — kecuali pengurus lama memang pernah memegang isi berkas `.env`.
Kalau iya, ganti `AUTH_SECRET` dan `CRON_SECRET`, lalu jalankan ulang container `app`.
Perlu diingat, mengganti `AUTH_SECRET` membuat semua orang yang sedang login ter-logout.

---

## 5. Ringkasan biaya Duitku

Rincian teknis dan angka lengkapnya ada di [duitku-integration.md](duitku-integration.md).
Ringkasannya:

| Metode pembayaran | Biaya per transaksi berhasil |
|---|---|
| QRIS | 0,7% |
| Virtual Account BCA | Rp 5.000 |
| Virtual Account Mandiri | Rp 4.000 |
| Virtual Account bank lain | Rp 3.000 |
| Kartu kredit | 2,9% + Rp 2.500 |
| OVO / DANA / LinkAja | 1,67% |
| ShopeePay | 2% |
| Indomaret | MDR + Rp 1.000 |

Catatan penting untuk BEM:

- **Biaya hanya dikenakan pada transaksi yang berhasil.** Pesanan yang kedaluwarsa
  tidak dikenai biaya apa pun.
- **Tidak ada biaya pendaftaran dan tidak ada biaya bulanan.**
- **Angka di atas sudah termasuk PPN**, tercatat per Juni 2026.

> ⚠️ **Tarif ini WAJIB dikonfirmasi ulang ke Duitku sebelum menentukan harga jual.**
> Angka di atas dicatat pada Juni 2026 dan bisa berubah sewaktu-waktu tanpa
> pemberitahuan ke kami. Minta bendahara mengeceknya di dashboard merchant atau
> menanyakannya langsung ke tim Duitku pada saat pendaftaran.

### Keputusan yang harus diambil BEM

Biaya transaksi harus ditanggung seseorang. Ada dua pilihan, dan BEM perlu memutuskannya
**sebelum** harga produk ditetapkan:

1. **Ditanggung BEM** — harga yang dilihat mahasiswa adalah harga bersih, dan margin
   BEM berkurang sebesar biaya transaksi. Untuk QRIS 0,7%, ini biasanya paling
   sederhana dan tidak terasa.
2. **Dibebankan ke harga produk** — harga jual dinaikkan sedikit untuk menutup biaya.
   Sistem ini **tidak** menambahkan biaya transaksi sebagai baris terpisah di checkout,
   jadi kalau BEM memilih cara ini, penyesuaiannya dilakukan pada harga produk atau
   harga khusus PO.

Contoh kasar: pesanan Rp 500.000 lewat QRIS dikenai sekitar Rp 3.500. Lewat VA BCA,
Rp 5.000 tetap berapa pun nilai pesanannya — jadi VA relatif mahal untuk pesanan kecil
dan justru murah untuk pesanan besar.

---

## 6. Yang harus kamu wariskan ke BEM

Serahkan semuanya dalam satu paket, jangan tercecer:

- [ ] **Kredensial** (lewat jalur pribadi ke masing-masing orang, bukan grup):
  - [ ] Akun Pengurus Inti pertama (email + kata sandi awal). Ingatkan bahwa
        penggantian kata sandi dilakukan lewat `/admin/pengguna` → **Reset Password**,
        karena belum ada halaman ganti kata sandi mandiri
  - [ ] Akses SSH VPS
  - [ ] Akses panel domain/DNS
  - [ ] Pengingat bahwa akun Duitku harus dipegang BEM, bukan kamu
- [ ] **Dokumentasi:**
  - [ ] [README.md](../README.md) — gambaran umum sistem
  - [ ] [DEPLOY.md](../DEPLOY.md) — deploy, backup, dan troubleshooting
  - [ ] [panduan-admin.md](panduan-admin.md) — panduan pemakaian harian untuk pengurus
  - [ ] Berkas ini — untuk developer berikutnya
- [ ] **Kode sumber:** akses ke repositori Git, atau salinan lengkapnya
- [ ] **Lokasi backup** dan cara memulihkannya
- [ ] **Pelatihan singkat** untuk pengurus: satu kali menemani mereka menjalankan satu
      batch PO dari awal sampai akhir jauh lebih berguna daripada dokumen setebal apa pun
- [ ] **Kesepakatan dukungan:** sampai kapan kamu masih bisa dihubungi, dan untuk hal
      apa saja. Tulis dan sepakati di awal — bukan saat ada masalah jam 2 pagi
- [ ] **Tanggal kedaluwarsa yang perlu diingat BEM:**
  - [ ] Perpanjangan sewa VPS
  - [ ] Perpanjangan domain
  - [ ] Sertifikat HTTPS (otomatis, tapi pastikan penjadwalannya diketahui)
