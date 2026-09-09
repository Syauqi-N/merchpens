import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SecondaryBrandLogo } from "@/components/branding/brand-logos";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMasterLists, getPickupInfo } from "@/lib/settings";
import { CheckoutForm } from "./checkout-form";
import type { CheckoutFormValues } from "./schemas";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Lengkapi data diri dan selesaikan pembayaran pesananmu.",
};

/**
 * Halaman checkout — WAJIB LOGIN.
 *
 * Proxy sudah menghadang pengunjung tanpa cookie sesi, tapi pemeriksaan
 * sesungguhnya tetap dilakukan di sini (dekat data) sesuai anjuran
 * docs/nextjs16-conventions.md §7. `createOrderAndPay()` juga memeriksa
 * ulang otorisasinya sendiri karena Server Action bisa dipanggil lewat POST.
 */
export default async function CheckoutPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/masuk?callbackUrl=${encodeURIComponent("/checkout")}`);
  }

  const [user, lastOrder, pickup, master] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, phone: true },
    }),
    // Prefill identitas dari pesanan terakhir supaya pembeli yang memesan
    // berkali-kali tidak perlu mengisi ulang semuanya.
    prisma.order.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        customerName: true,
        customerPhone: true,
        customerType: true,
        customerBatch: true,
        customerProgram: true,
        fulfillmentType: true,
        shippingAddress: true,
      },
    }),
    getPickupInfo(),
    getMasterLists(),
  ]);

  const defaults: CheckoutFormValues = {
    customerName: lastOrder?.customerName ?? user?.name ?? session.user.name ?? "",
    customerEmail: user?.email ?? session.user.email ?? "",
    customerPhone: lastOrder?.customerPhone ?? user?.phone ?? "",
    customerType: lastOrder?.customerType ?? "MAHASISWA",
    customerBatch:
      lastOrder && master.angkatan.includes(lastOrder.customerBatch)
        ? lastOrder.customerBatch
        : (master.angkatan[0] ?? ""),
    customerProgram:
      lastOrder && master.jurusan.includes(lastOrder.customerProgram)
        ? lastOrder.customerProgram
        : (master.jurusan[0] ?? ""),
    fulfillmentType: lastOrder?.fulfillmentType ?? "PICKUP",
    shippingAddress: lastOrder?.shippingAddress ?? "",
    note: "",
    termsAccepted: false,
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <div className="mb-3 flex items-center gap-3">
          <SecondaryBrandLogo className="w-36 sm:w-40" alt="" />
          <span className="rounded-full bg-gold/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-gold uppercase">
            Checkout aman
          </span>
        </div>
        <h1 className="text-2xl font-bold text-cream sm:text-3xl">Checkout</h1>
        <p className="mt-1 text-sm text-cream-muted">
          Lengkapi data dirimu lalu tekan &ldquo;Bayar Sekarang&rdquo;. Kamu punya{" "}
          <strong>60 menit</strong> untuk menyelesaikan pembayaran via Duitku
          (QRIS / VA / e-wallet).
        </p>
      </header>

      <CheckoutForm defaults={defaults} pickup={pickup} master={master} />
    </div>
  );
}
