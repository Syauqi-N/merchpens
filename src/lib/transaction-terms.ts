/**
 * Versi syarat transaksi yang ditampilkan saat checkout.
 *
 * Nilai versi ikut disimpan di Order agar perubahan redaksi pada masa depan
 * tidak menghilangkan jejak aturan yang disetujui pembeli.
 */
export const CURRENT_TERMS_VERSION = "2026-07-31-v1";

export const TRANSACTION_TERMS_TITLE =
  "Syarat dan Ketentuan Transaksi BEM FKG UNAIR";

export type TransactionTermSection = {
  title: string;
  items: readonly string[];
};

export const TRANSACTION_TERM_SECTIONS: readonly TransactionTermSection[] = [
  {
    title: "Pemesanan dan pembayaran",
    items: [
      "Pembeli wajib memastikan identitas, produk, variasi, dan jumlah barang sudah benar sebelum membuat pesanan.",
      "Pesanan yang belum dibayar atau belum dikonfirmasi oleh admin dalam waktu 48 jam sejak dibuat akan kedaluwarsa otomatis. Kuota barang kemudian dikembalikan agar dapat dipesan mahasiswa lain.",
      "Untuk pembayaran melalui Duitku, masa berlaku teknis halaman pembayaran dapat berbeda menurut kanal. Selama batas 48 jam pesanan belum terlewati, pembeli dapat membuat ulang tautan pembayaran melalui halaman detail pesanan.",
      "Pesanan yang sudah dibayar tidak dapat dibatalkan sepihak. Perubahan atau pembatalan hanya dapat dilakukan setelah berkomunikasi dengan pengurus dan mengikuti keputusan BEM FKG UNAIR.",
      "Pengurus berhak menghubungi pembeli untuk mengonfirmasi pesanan dengan jumlah yang tidak wajar atau data yang diragukan.",
    ],
  },
  {
    title: "Pre-order dan pengambilan barang",
    items: [
      "Seluruh barang dipesan melalui periode pre-order. Estimasi barang mulai dapat diambil, lokasi, jadwal, dan catatan pengambilan mengikuti informasi pada periode PO masing-masing.",
      "Estimasi pengambilan dapat berubah karena proses pengadaan atau distributor. Pengurus akan menyampaikan perubahan kepada pembeli melalui kontak yang didaftarkan.",
      "Barang wajib diambil paling lambat 14 hari setelah pengurus mengirimkan pemberitahuan bahwa barang sudah dapat diambil.",
      "Barang yang tidak diambil sampai semester berjalan berakhir dapat dinyatakan menjadi milik pihak penjual/pengurus sesuai peraturan transaksi BEM FKG UNAIR.",
      "Pembeli wajib menunjukkan identitas dan menandatangani bukti pengambilan saat barang diserahkan.",
      "Pengambilan dapat diwakilkan setelah pemberitahuan kepada pengurus. Penerima wajib menuliskan keterangan “diambilkan oleh” beserta identitasnya pada bukti pengambilan.",
    ],
  },
  {
    title: "Pemeriksaan dan komplain",
    items: [
      "Pembeli wajib memeriksa jumlah dan kondisi barang saat pengambilan. Setelah bukti pengambilan ditandatangani, pengurus tidak bertanggung jawab atas kehilangan atau kerusakan yang terjadi kemudian.",
      "Komplain atas barang kurang, rusak, atau tidak sesuai wajib disertai video unboxing utuh sejak paket pertama kali dibuka.",
      "Untuk kerusakan pada pemakaian pertama, pembeli wajib menyertakan video penggunaan pertama yang menunjukkan masalah pada barang.",
      "Komplain disampaikan paling lambat 14 hari setelah barang diambil. Komplain di luar batas tersebut dapat ditolak.",
    ],
  },
  {
    title: "Pembayaran melalui cicilan",
    items: [
      "Opsi cicilan hanya tersedia pada periode PO yang diaktifkan oleh admin dan harus diajukan melalui tautan WhatsApp resmi yang ditampilkan setelah checkout.",
      "Nominal uang muka, jumlah termin, tanggal jatuh tempo, dan ketentuan lain ditetapkan berdasarkan kesepakatan pembeli dengan admin.",
      "Pengajuan cicilan belum dianggap sebagai pembayaran. Pembayaran baru tercatat di website setelah diverifikasi secara manual oleh admin.",
      "Pembeli wajib melunasi seluruh cicilan sebelum barang dapat diambil.",
      "Keterlambatan dapat memperoleh masa tenggang paling lama satu minggu. Denda Rp50.000 per bulan hanya berlaku apabila dicantumkan dan disetujui dalam kesepakatan cicilan dengan admin.",
    ],
  },
] as const;
