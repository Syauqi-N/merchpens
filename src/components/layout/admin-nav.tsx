"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  CalendarClockIcon,
  ClipboardListIcon,
  ImageIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  PackageIcon,
  StoreIcon,
  TableIcon,
  TagsIcon,
  UsersIcon,
} from "lucide-react";

import { PrimaryBrandLogo } from "@/components/branding/brand-logos";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Role } from "@/generated/prisma/client";
import { can, ROLE_LABEL, type Capability } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * Menu panel admin beserta kemampuan yang dibutuhkan untuk membukanya.
 *
 * `capability: null` berarti menu itu terbuka untuk semua peran yang boleh
 * masuk panel. Menyembunyikan menu di sini adalah kenyamanan, BUKAN pengaman:
 * halaman dan Server Action tujuannya tetap memeriksa kemampuan sendiri, jadi
 * mengetik URL-nya langsung tetap ditolak.
 */
export const ADMIN_NAV_LINKS = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboardIcon,
    exact: true,
    capability: null,
  },
  {
    href: "/admin/produk",
    label: "Produk",
    icon: PackageIcon,
    exact: false,
    capability: "MANAGE_CATALOG",
  },
  {
    href: "/admin/kategori",
    label: "Kategori",
    icon: TagsIcon,
    exact: false,
    capability: "MANAGE_CATALOG",
  },
  {
    href: "/admin/pesanan",
    label: "Pesanan",
    icon: ClipboardListIcon,
    exact: false,
    capability: "MANAGE_ORDERS",
  },
  {
    href: "/admin/rekap",
    label: "Rekap",
    icon: TableIcon,
    exact: false,
    capability: "MANAGE_ORDERS",
  },
  {
    href: "/admin/pre-order",
    label: "Pre-Order",
    icon: CalendarClockIcon,
    exact: false,
    capability: "MANAGE_CATALOG",
  },
  {
    href: "/admin/sayembara",
    label: "Sayembara",
    icon: UsersIcon,
    exact: false,
    capability: "MANAGE_CATALOG",
  },
  {
    href: "/admin/beranda",
    label: "Beranda",
    icon: ImageIcon,
    exact: false,
    capability: "MANAGE_CATALOG",
  },
  {
    href: "/admin/pengguna",
    label: "Pengguna",
    icon: UsersIcon,
    exact: false,
    capability: "MANAGE_USERS",
  },
] as const satisfies readonly {
  href: string;
  label: string;
  icon: typeof LayoutDashboardIcon;
  exact: boolean;
  capability: Capability | null;
}[];

function isActive(pathname: string, href: string, exact: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Menu yang benar-benar boleh dibuka peran ini. */
function visibleLinks(role: Role) {
  return ADMIN_NAV_LINKS.filter(
    (link) => link.capability === null || can(role, link.capability),
  );
}

function AdminNavLinks({
  role,
  onNavigate,
}: {
  role: Role;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3" aria-label="Navigasi admin">
      {visibleLinks(role).map((link) => {
        const Icon = link.icon;
        const active = isActive(pathname, link.href, link.exact);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-gold text-obsidian shadow-sm"
                : "text-cream-muted hover:bg-raise hover:text-cream",
            )}
          >
            <Icon className="size-4.5 shrink-0" aria-hidden />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <PrimaryBrandLogo className="w-11 shrink-0" alt="" />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-cream">Merch PENS</span>
        <span className="text-xs text-cream-muted">Panel Admin</span>
      </span>
    </div>
  );
}

/**
 * Kartu akun: siapa yang sedang masuk dan sebagai peran apa.
 *
 * Perannya sengaja ditulis terang-terangan. Di kepengurusan yang berganti tiap
 * tahun, satu orang bisa berpindah peran, dan menu yang "hilang" jadi masuk akal
 * begitu dia melihat sedang masuk sebagai apa.
 */
function AdminAccountCard({ userName, role }: { userName: string; role: Role }) {
  return (
    <div className="rounded-lg bg-obsidian px-3 py-2.5">
      <p className="truncate text-sm font-medium text-cream">{userName}</p>
      <p className="mt-0.5 text-xs text-cream-muted">
        Masuk sebagai <span className="font-medium text-[#D8D3C7]">{ROLE_LABEL[role]}</span>
      </p>
    </div>
  );
}

/** Sidebar tetap untuk layar besar. */
export function AdminSidebar({ userName, role }: { userName: string; role: Role }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-white/10 bg-coal lg:flex lg:flex-col">
      <div className="border-b border-white/10 px-4 py-4">
        <Link href="/admin" className="block">
          <AdminBrand />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto">
        <AdminNavLinks role={role} />
      </div>

      <div className="space-y-2 border-t border-white/10 p-3">
        <AdminAccountCard userName={userName} role={role} />

        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-cream-muted transition-colors hover:bg-raise hover:text-cream"
        >
          <StoreIcon className="size-4.5" aria-hidden />
          Lihat Toko
        </Link>
      </div>
    </aside>
  );
}

/** Tombol + panel navigasi untuk layar kecil. */
export function AdminMobileNav({ userName, role }: { userName: string; role: Role }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Buka menu admin"
          />
        }
      >
        <MenuIcon className="size-5" aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 p-0">
        <SheetHeader className="border-b border-white/10 p-4">
          <SheetTitle>
            <AdminBrand />
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <AdminNavLinks role={role} onNavigate={() => setOpen(false)} />
        </div>
        <div className="space-y-2 border-t border-white/10 p-3">
          <AdminAccountCard userName={userName} role={role} />

          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-cream-muted transition-colors hover:bg-raise"
          >
            <StoreIcon className="size-4.5" aria-hidden />
            Lihat Toko
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Tombol keluar (client karena memanggil `signOut`). */
export function AdminSignOutButton({ className }: { className?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("h-9 gap-2", className)}
      onClick={() => void signOut({ redirectTo: "/masuk" })}
    >
      <LogOutIcon className="size-4" aria-hidden />
      <span className="hidden sm:inline">Keluar</span>
    </Button>
  );
}
