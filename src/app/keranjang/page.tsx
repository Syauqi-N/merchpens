import type { Metadata } from "next";

import { CartView } from "./cart-view";

export const metadata: Metadata = {
  title: "Keranjang Belanja",
  description: "Periksa kembali item belanja sebelum melanjutkan ke pembayaran.",
};

/**
 * Halaman keranjang.
 *
 * Isi keranjang hidup di localStorage (Zustand + persist), jadi seluruh
 * daftarnya dirender komponen klien. Tidak ada lagi data yang perlu diambil dari
 * database di sini: barang diambil sendiri di kampus sehingga tidak ada ongkos
 * kirim yang harus dihitung.
 */
export default function KeranjangPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-cream sm:text-3xl">
          Keranjang Belanja
        </h1>
        <p className="mt-1 text-sm text-cream-muted">
          Ketersediaan dan harga diperiksa ulang ke server setiap kali halaman ini
          dibuka.
        </p>
      </header>

      <CartView />
    </div>
  );
}
