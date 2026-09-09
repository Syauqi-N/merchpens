"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  CalendarClockIcon,
  ClipboardListIcon,
  HouseIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MailIcon,
  MenuIcon,
  PackageIcon,
  PhoneIcon,
  SearchIcon,
  ShoppingCartIcon,
  TrophyIcon,
  UserIcon,
  UserPlusIcon,
} from "lucide-react";

import { MerchLockup } from "@/components/branding/brand-logos";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { selectTotalItems, useCartHydrated, useCartStore } from "@/store/cart";

const NAV_LINKS = [
  { href: "/", label: "Beranda", icon: HouseIcon },
  { href: "/produk", label: "Produk", icon: PackageIcon },
  { href: "/pre-order", label: "Pre-Order", icon: CalendarClockIcon },
  { href: "/sayembara", label: "Sayembara", icon: TrophyIcon },
] as const;

export type SiteHeaderProps = {
  /** Nama toko dari tabel Setting (`store_name`). */
  storeName?: string;
  /** Telepon toko dari Setting (`store_phone`) — tampil di baris atas. */
  storePhone?: string;
  /** Email toko dari Setting (`store_email`) — tampil di baris atas. */
  storeEmail?: string;
};

export function SiteHeader({
  storeName = "Merch PENS",
  storePhone = "",
  storeEmail = "",
}: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Sembunyikan SiteHeader publik jika user sedang berada di dalam route admin
  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gold/20 bg-obsidian/95 backdrop-blur supports-backdrop-filter:bg-obsidian/85">
      {/* Baris kontak */}
      {(storePhone || storeEmail) && (
        <div className="hidden bg-gold text-obsidian md:block">
          <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4 text-xs">
            <p className="font-semibold tracking-wide">
              Merchandise resmi PENS — pre-order berkuota per periode
            </p>
            <div className="flex items-center gap-5">
              {storePhone && (
                <a
                  href={`tel:${storePhone.replace(/[^0-9+]/g, "")}`}
                  className="inline-flex items-center gap-1.5 hover:underline"
                >
                  <PhoneIcon className="size-3.5" aria-hidden />
                  {storePhone}
                </a>
              )}
              {storeEmail && (
                <a
                  href={`mailto:${storeEmail}`}
                  className="inline-flex items-center gap-1.5 hover:underline"
                >
                  <MailIcon className="size-3.5" aria-hidden />
                  {storeEmail}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Baris utama */}
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        {/* Menu mobile */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Buka menu"
              />
            }
          >
            <MenuIcon className="size-5" aria-hidden />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 gap-0">
            <SheetHeader className="border-b border-gold/20 p-4">
              <SheetTitle className="flex items-center">
                <MerchLockup compact />
                <span className="sr-only">{storeName}</span>
              </SheetTitle>
            </SheetHeader>
            <MobileMenu
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link
          href="/"
          aria-label={`${storeName} — Beranda`}
          className="flex shrink-0 items-center rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-gold/40"
        >
          <MerchLockup preload />
        </Link>

        {/* Navigasi desktop */}
        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium tracking-wide transition-colors",
                isActive(pathname, link.href)
                  ? "bg-gold/15 text-gold"
                  : "text-cream-muted hover:bg-white/5 hover:text-cream",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <SearchBox className="hidden w-56 lg:flex xl:w-72" />
          <CartButton />
          <AccountMenu />
        </div>
      </div>

      {/* Pencarian mobile */}
      <div className="border-t border-white/10 px-4 py-2 lg:hidden">
        <SearchBox className="w-full" />
      </div>
    </header>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/produk?q=${encodeURIComponent(trimmed)}` : "/produk");
  }

  return (
    <form onSubmit={handleSubmit} role="search" className={cn("relative", className)}>
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-cream-faint"
      />
      <Input
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Cari merchandise..."
        aria-label="Cari produk"
        className="h-9 rounded-full border-white/10 bg-white/5 pl-8 text-cream placeholder:text-cream-faint focus-visible:border-gold/60 focus-visible:ring-gold/30"
      />
    </form>
  );
}

function CartButton() {
  const totalItems = useCartStore(selectTotalItems);
  const hydrated = useCartHydrated();
  const count = hydrated ? totalItems : 0;

  return (
    <Link
      href="/keranjang"
      aria-label={
        count > 0 ? `Keranjang, ${count} barang` : "Keranjang belanja, kosong"
      }
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "relative size-9 text-cream-muted hover:bg-white/5 hover:text-gold",
      )}
    >
      <ShoppingCartIcon className="size-5" aria-hidden />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold px-1 text-[10px] leading-none font-bold text-obsidian tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

function AccountMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <Skeleton className="size-9 rounded-lg" />;
  }

  if (!session?.user) {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href="/masuk"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "hidden h-9 px-3 text-cream-muted hover:bg-white/5 hover:text-gold sm:inline-flex",
          )}
        >
          Masuk
        </Link>
        <Link
          href="/daftar"
          className={cn(
            buttonVariants({ size: "sm" }),
            "hidden h-9 bg-gold px-3 font-bold text-obsidian hover:bg-gold-light sm:inline-flex",
          )}
        >
          Daftar
        </Link>
        <Link
          href="/masuk"
          aria-label="Masuk"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "size-9 text-cream-muted hover:bg-white/5 hover:text-gold sm:hidden",
          )}
        >
          <UserIcon className="size-5" aria-hidden />
        </Link>
      </div>
    );
  }

  const displayName = session.user.name ?? session.user.email ?? "Akun saya";
  const isAdmin = can(session.user.role, "ACCESS_ADMIN");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-cream-muted hover:bg-white/5 hover:text-gold"
            aria-label="Menu akun"
          />
        }
      >
        <UserIcon className="size-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Base UI: DropdownMenuLabel adalah `Menu.GroupLabel`, jadi ia WAJIB
            berada di dalam sebuah Group — di luar itu ia melempar
            "MenuGroupContext is missing" saat dirender. Label ini menamai
            kelompok tautan akun di bawahnya. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate px-2 py-1.5 text-sm font-medium text-cream">
            {displayName}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/pesanan" />}>
            <ClipboardListIcon aria-hidden />
            Pesanan Saya
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem render={<Link href="/admin" />}>
              <LayoutDashboardIcon aria-hidden />
              Dashboard Admin
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => void signOut({ redirectTo: "/" })}
        >
          <LogOutIcon aria-hidden />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileMenu({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: () => void;
}) {
  const { data: session, status } = useSession();
  const isAdmin = can(session?.user?.role, "ACCESS_ADMIN");

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-3">
      <nav className="flex flex-col gap-1" aria-label="Navigasi utama">
        {NAV_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(pathname, link.href)
                  ? "bg-gold/10 text-gold"
                  : "text-[#D8D3C7] hover:bg-raise",
              )}
            >
              <Icon className="size-4.5" aria-hidden />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <Separator className="my-3" />

      {status === "loading" ? (
        <div className="flex flex-col gap-2 px-1">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ) : session?.user ? (
        <div className="flex flex-col gap-1">
          <p className="truncate px-3 py-1 text-xs text-cream-muted">
            Masuk sebagai {session.user.name ?? session.user.email}
          </p>
          <Link
            href="/pesanan"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#D8D3C7] transition-colors hover:bg-raise"
          >
            <ClipboardListIcon className="size-4.5" aria-hidden />
            Pesanan Saya
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#D8D3C7] transition-colors hover:bg-raise"
            >
              <LayoutDashboardIcon className="size-4.5" aria-hidden />
              Dashboard Admin
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              onNavigate();
              void signOut({ redirectTo: "/" });
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            <LogOutIcon className="size-4.5" aria-hidden />
            Keluar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Link
            href="/masuk"
            onClick={onNavigate}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 w-full justify-start gap-3 px-3",
            )}
          >
            <UserIcon className="size-4.5" aria-hidden />
            Masuk
          </Link>
          <Link
            href="/daftar"
            onClick={onNavigate}
            className={cn(
              buttonVariants(),
              "h-10 w-full justify-start gap-3 bg-gold px-3 text-obsidian hover:bg-gold-light",
            )}
          >
            <UserPlusIcon className="size-4.5" aria-hidden />
            Daftar
          </Link>
        </div>
      )}
    </div>
  );
}
