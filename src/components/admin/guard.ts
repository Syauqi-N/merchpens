import { redirect } from "next/navigation";

import { getCurrentActor, requireCapability } from "@/lib/auth";
import { can, type Capability } from "@/lib/permissions";

/**
 * Penjaga otorisasi untuk SETIAP `page.tsx` di bawah `/admin`.
 *
 * Guard di `admin/layout.tsx` SAJA tidak cukup: di Next 16 layout dan page
 * dirender BERSAMAAN, sehingga `redirect()` di layout tidak mencegah page ikut
 * merender — dan ikut mengirim — datanya. Karena itu setiap page WAJIB
 * memanggil guard-nya sendiri, sesuai anjuran docs Next.js 16 §7: "do real
 * authz in a Data Access Layer near the data".
 *
 * Pemeriksaannya berbasis KEMAMPUAN, bukan peran. Halaman katalog meminta
 * `MANAGE_CATALOG`, halaman pesanan meminta `MANAGE_ORDERS`, dan hanya halaman
 * yang memang cuma butuh akses panel yang memakai `ACCESS_ADMIN`. Dengan begitu
 * penambahan atau penggeseran peran saat pergantian pengurus cukup diubah di
 * `lib/permissions.ts` — bukan di sini.
 */
export async function ensurePageCapability(
  capability: Capability,
  callbackUrl = "/admin",
) {
  try {
    return await requireCapability(capability);
  } catch {
    // `redirect()` melempar exception kontrol-alur, jadi penentuan tujuan
    // dilakukan DI LUAR `try` agar tidak ikut tertelan `catch` ini.
  }

  // Dua sebab penolakan yang berbeda, jadi tujuannya pun berbeda supaya
  // pengurus tidak dibuat bingung.
  const actor = await getCurrentActor();

  if (!actor) {
    // Belum masuk atau akunnya dinonaktifkan: kirim ke login
    redirect(`/masuk?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  if (!can(actor.role, "ACCESS_ADMIN")) {
    // Sudah masuk tapi bukan admin/pengurus (mis. customer):
    // Jangan redirect ke /masuk (akan mental balik ke /admin dan looping!),
    // kembalikan ke beranda etalase.
    redirect("/");
  }

  // Sudah masuk sebagai pengurus, tetapi perannya tidak mencakup kemampuan ini
  // (mis. Pengurus membuka halaman kelola pengguna). Kembalikan ke dashboard —
  // satu-satunya halaman yang pasti boleh dia buka — dengan alasannya.
  redirect(`/admin?ditolak=${encodeURIComponent(capability)}`);
}

/**
 * Penjaga untuk halaman yang cukup membutuhkan akses panel, tanpa kemampuan
 * khusus apa pun — saat ini hanya dashboard. Isi dashboard sendiri yang
 * menyaring bagian mana yang boleh dilihat pembacanya.
 */
export async function ensureAdminPage(callbackUrl = "/admin") {
  return ensurePageCapability("ACCESS_ADMIN", callbackUrl);
}
