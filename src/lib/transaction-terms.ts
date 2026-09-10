/**
 * Versi syarat transaksi yang ditampilkan saat checkout.
 *
 * Nilai versi ikut disimpan di Order agar perubahan redaksi pada masa depan
 * tidak menghilangkan jejak aturan yang disetujui pembeli.
 */
export const CURRENT_TERMS_VERSION = "2026-09-10-v2";

export const TRANSACTION_TERMS_TITLE =
  "Syarat dan Ketentuan Transaksi Merchandise BEM PENS";

export type TransactionTermSection = {
  title: string;
  items: readonly string[];
};

export const TRANSACTION_TERM_SECTIONS: readonly TransactionTermSection[] = [
  {
    title: "Pemesanan dan Pembayaran",
    items: [
      "Pembeli wajib memastikan identitas, pilihan produk, ukuran/varian, dan jumlah barang sudah benar sebelum menyelesaikan pesanan.",
      "Pesanan yang belum dibayar dalam batas waktu yang ditentukan akan kedaluwarsa secara otomatis dan kuota produk akan dilepaskan kembali ke sistem.",
      "Pembayaran dilakukan melalui saluran resmi payment gateway (Duitku) yang terintegrasi di website Merch PENS.",
      "Pesanan yang sudah dibayar tidak dapat dibatalkan secara sepihak. Perubahan atau pembatalan hanya dapat dilakukan melalui konfirmasi ke pengurus/admin BEM PENS.",
      "Pengurus berhak menghubungi pembeli untuk verifikasi data pemesan apabila ditemukan ketidaksesuaian informasi.",
    ],
  },
  {
    title: "Sistem Pre-Order dan Pengambilan Barang",
    items: [
      "Seluruh produk diproduksi melalui sistem Pre-Order (PO). Estimasi jadwal produksi dan pengambilan mengikuti informasi pada masing-masing batch PO yang dibuka.",
      "Estimasi tanggal selesai dan pengambilan dapat mengalami penyesuaian tergantung pada proses produksi vendor. Perubahan jadwal akan diinformasikan oleh pengurus melalui kontak terdaftar (WhatsApp/Email).",
      "Untuk opsi Ambil di Kampus (Pick-up), pengambilan dilakukan di lokasi sekretariat/stand BEM PENS sesuai jadwal operasional yang ditentukan panitia.",
      "Untuk opsi Pengiriman (Shipped), biaya ongkos kirim disepakati dan dibayarkan secara terpisah melalui konfirmasi WhatsApp admin setelah barang siap dikirim.",
      "Pembeli wajib menunjukkan bukti pemesanan/invoice resmi dari website saat mengambil barang.",
      "Pengambilan yang diwakilkan wajib menyertakan bukti invoice asli dan identitas pemesan kepada panitia.",
    ],
  },
  {
    title: "Pemeriksaan Barang dan Komplain",
    items: [
      "Pembeli wajib memeriksa jumlah dan kondisi fisik merchandise saat serah terima barang.",
      "Komplain atas barang cacat produksi, ukuran salah kirim oleh panitia, atau jumlah kurang wajib disertai bukti video unboxing utuh tanpa jeda (cut/pause).",
      "Batas pengajuan komplain atau penukaran barang adalah maksimal 3 (tiga) hari setelah barang diterima/diambil.",
      "Kerusakan akibat kelalaian pemakaian atau pencucian pribadi di luar instruksi perawatan tidak menjadi tanggung jawab panitia.",
    ],
  },
] as const;
