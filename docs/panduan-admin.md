# Panduan Pengurus — Cara Memakai Website Merch PENS

Untuk pengurus yang mengelola pre-order merchandise. Tidak perlu tahu
pemrograman — ikuti langkahnya berurutan.

**Cara masuk:** buka `/masuk`, pakai email + password dari pengurus lain, lalu
buka menu **Admin**.

**Soal password:** tidak ada halaman ganti password sendiri. Kalau lupa, minta
pengurus lain mereset lewat menu **Pengguna** → **Reset Password**.

---

## 1. Cara kerja singkat

> Website ini tidak punya stok. Yang ada hanya **kuota PER VARIAN di dalam
> periode pre-order.**

- Produk + varian yang belum dimasukkan ke periode aktif **tidak bisa dipesan**.
- Hanya boleh ada **satu periode terbuka** dalam satu waktu. Batch lama yang
  masih diproses tidak menghalangi batch baru.
- Periode menutup **otomatis** lewat tanggal berakhir. Kuota pesanan tak
  dibayar kembali **otomatis** setelah 60 menit. Status bayar berubah
  **otomatis** dari Duitku.

## 2. Alur satu batch PO

1. **Pre-Order → Buat Periode Baru** (isi nama, jadwal, status **Draf** dulu,
   info ambil + catatan kirim). Simpan.
2. **Masukkan produk + kuota varian.** Buka periode → tambah produk → isi kuota
   tiap varian (mis. PDH S/M/L/XL = 20, XXL = 10) + harga khusus bila perlu.
   Produk tanpa kuota varian tidak bisa dipesan.
3. **Aktifkan.** Ubah Draf → Aktif. Cek dari sisi pembeli di halaman Pre-Order.
   Kalau gagal aktif, kemungkinan masih ada periode lain yang terbuka — tutup
   dulu periode itu.
4. **Pantau Dashboard.** Lihat kuota terpakai, varian hampir habis, dan
   **tabel Angkatan/Jurusan** (diurut paling sepi dulu) untuk bahan promosi.
5. **Periode tutup** otomatis. Tunggu 1 jam sebelum rekap final (pesanan
   menit terakhir masih bisa dibayar).
6. **Rekap → Unduh Excel.** Atur filter dulu (periode/tipe/angkatan/jurusan) —
   file mengikuti filter. Sheet Per Pesanan untuk bendahara, Per Item untuk
   sortir barang (urutkan kolom Produk lalu jumlahkan).
7. **Follow-up ongkir.** Pesanan **Kirim** yang sudah lunas tidak mengandung
   ongkir — hubungi pembeli via WA (nomor admin di menu Beranda), terima
   ongkir manual, lalu kirim paket.
8. **Bagikan/ambil barang**, cocokkan **kode pesanan**, lalu **Tandai Selesai**
   di detail pesanan.

## 3. Produk & varian

- **Produk → Tambah:** nama, harga normal, satuan, kategori, gambar, deskripsi.
  Produk baru BELUM bisa dipesan sampai masuk periode + variannya diberi kuota.
- **Varian:** di halaman detail produk. Isi nama (mis. "Size L"), size/desain,
  SKU (unik bila diisi), selisih harga (mis. XXL +15000), foto khusus (opsional
  — kosong = pakai foto produk), aktif/nonaktif.
- Varian yang sudah pernah dipesan **tidak bisa dihapus** — nonaktifkan saja.
- Menyembunyikan produk: matikan **Aktif**. Riwayat pesanan tetap utuh.

## 4. Status pesanan

| Status | Artinya |
|---|---|
| Menunggu Pembayaran | Tagihan terbit, batas 60 menit, kuota tertahan. |
| Dibayar | Uang masuk (otomatis). |
| Diproses | Otomatis setelah periode tutup. |
| Selesai | Manual — barang sudah diterima. |
| Dibatalkan | Manual — kuota kembali. |
| Kadaluarsa | Otomatis — tidak dibayar 60 menit, kuota kembali. |

Tombol di detail: **Tandai Selesai** (barang diterima) · **Cek Status ke
Duitku** (pembeli bilang sudah bayar tapi belum berubah — coba ini dulu) ·
**Tandai Lunas Manual** (hanya bila uang jelas masuk tapi cek gagal) ·
**Batalkan Pesanan** (kuota kembali).

Aturan kuota: menaikkan selalu boleh; menurunkan tidak boleh di bawah jumlah
yang sudah dipesan (reserved).

## 5. Pengguna & keamanan

- Peran cuma dua: **Customer** dan **Pengurus** (semua pengurus = admin penuh).
- Tambah pengurus: cari akunnya (kalau sudah daftar) lalu naikkan perannya,
  atau buatkan akun baru dan sampaikan password via chat pribadi.
- Cabut akses: **nonaktifkan**, jangan hapus (riwayat pesanan ikut rusak kalau
  dihapus). Tidak bisa menonaktifkan diri sendiri / pengurus aktif terakhir.
- Selalu sisakan **minimal 2 pengurus aktif**.

## 6. Kalau ada masalah

- **Produk tidak muncul:** belum masuk periode aktif + kuota varian? Produknya
  aktif? Jadwal periode sudah mulai?
- **Kuota habis padahal sepi:** sebagian ditahan pesanan belum bayar — kembali
  sendiri ≤ 60 menit. Kalau berjam-jam tidak kembali, hubungi developer (cron
  mungkin mati).
- **Sudah bayar tapi status belum berubah:** tekan **Cek Status ke Duitku**.
- **Harga salah di tengah jalan:** bisa diubah, tapi umumkan dulu — pesanan
  lama tidak ikut berubah (harga tersimpan per pesanan).
