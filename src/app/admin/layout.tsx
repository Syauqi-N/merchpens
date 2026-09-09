import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  AdminMobileNav,
  AdminSidebar,
  AdminSignOutButton,
} from "@/components/layout/admin-nav";
import { getCurrentActor } from "@/lib/auth";
import { can, ROLE_LABEL } from "@/lib/permissions";

export const metadata: Metadata = {
  title: {
    default: "Panel Admin",
    template: "%s | Panel Admin",
  },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Kerangka panel hanya untuk peran yang punya ACCESS_ADMIN. Proxy cuma
  // memeriksa keberadaan cookie sesi, jadi pemeriksaan yang sesungguhnya —
  // termasuk pembacaan ulang peran & status aktif dari database — terjadi di
  // sini. Guard ini TIDAK menggantikan guard di tiap page: layout dan page
  // dirender bersamaan di Next 16.
  const actor = await getCurrentActor();

  // Jika belum login atau akun tidak aktif, arahkan ke login.
  if (!actor) {
    redirect(`/masuk?callbackUrl=${encodeURIComponent("/admin")}`);
  }

  // Jika sudah login tapi bukan admin/pengurus (misalnya customer),
  // lempar langsung ke halaman utama etalase ("/") agar tidak terjadi looping
  // redirect antara /admin dan /masuk.
  if (!can(actor.role, "ACCESS_ADMIN")) {
    redirect("/");
  }

  const adminName = actor.name ?? actor.email ?? "Pengurus";

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] bg-obsidian">
      <AdminSidebar userName={adminName} role={actor.role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-coal px-4">
          <AdminMobileNav userName={adminName} role={actor.role} />

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-cream">
              Panel Admin
            </p>
            <p className="truncate text-xs text-cream-muted">{adminName}</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold sm:inline-block">
              {ROLE_LABEL[actor.role]}
            </span>
            <AdminSignOutButton />
          </div>
        </header>

        <div className="min-w-0 flex-1 p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
