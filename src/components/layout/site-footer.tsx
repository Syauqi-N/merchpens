import type { ComponentProps, ReactNode } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import {
  CalendarClockIcon,
  MailIcon,
  MapPinIcon,
  PackageIcon,
  PhoneIcon,
} from "lucide-react";

import {
  InstitutionLogos,
  MerchLockup,
} from "@/components/branding/brand-logos";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

/**
 * Footer toko — Server Component.
 * Informasi diambil dari tabel `Setting` dan daftar kategori aktif.
 */
export async function SiteFooter() {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  if (pathname.startsWith("/admin")) {
    return null;
  }

  const [settings, categories] = await Promise.all([
    getSettings(),
    loadCategories(),
  ]);

  const storeName = settings.store_name || "Merch PENS";
  const tagline = settings.store_tagline ?? "";
  const about = settings.store_about ?? "";
  const address = settings.store_address ?? "";
  const phone = settings.store_phone ?? "";
  const email = settings.store_email ?? "";

  const whatsappNumber = (settings.social_whatsapp ?? "").replace(/[^0-9]/g, "");
  const socials: { label: string; href: string; icon: ReactNode }[] = [];
  if (settings.social_instagram) {
    socials.push({
      label: "Instagram",
      href: settings.social_instagram,
      icon: <InstagramGlyph />,
    });
  }
  if (settings.social_facebook) {
    socials.push({
      label: "Facebook",
      href: settings.social_facebook,
      icon: <FacebookGlyph />,
    });
  }
  if (settings.social_tiktok) {
    socials.push({
      label: "TikTok",
      href: settings.social_tiktok,
      icon: <TiktokGlyph />,
    });
  }
  if (whatsappNumber) {
    socials.push({
      label: "WhatsApp",
      href: `https://wa.me/${whatsappNumber}`,
      icon: <WhatsappGlyph />,
    });
  }

  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-16 overflow-hidden border-t border-gold/20 bg-obsidian text-cream-muted">
      <div aria-hidden className="bg-batik pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {/* Identitas toko */}
        <div className="sm:col-span-2 lg:col-span-1">
          <div>
            <MerchLockup />
            <span className="sr-only">{storeName}</span>
          </div>
          {tagline && <p className="mt-3 text-sm font-medium text-gold">{tagline}</p>}
          {about && <p className="mt-2 text-sm leading-relaxed">{about}</p>}

          <div className="mt-5 rounded-xl border border-gold/25 bg-coal p-3">
            <p className="text-[10px] font-semibold tracking-wider text-cream-faint uppercase">
              Dikelola oleh
            </p>
            <p className="mt-0.5 text-xs leading-snug font-medium text-cream-soft">
              Panitia Merch PENS
            </p>
            <InstitutionLogos className="mt-3" />
          </div>

          {socials.length > 0 && (
            <div className="mt-5 flex items-center gap-2">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                    className="grid size-9 place-items-center rounded-lg border border-white/10 bg-coal text-cream-muted transition-colors hover:border-gold/50 hover:bg-gold/10 hover:text-gold"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Kategori */}
        <nav aria-labelledby="footer-kategori">
          <h2
            id="footer-kategori"
            className="text-sm font-semibold tracking-wide text-cream uppercase"
          >
            Kategori
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {categories.length === 0 ? (
              <li>
                <FooterLink href="/produk">Semua produk</FooterLink>
              </li>
            ) : (
              categories.map((category) => (
                <li key={category.id}>
                  <FooterLink href={`/produk?kategori=${category.slug}`}>
                    {category.name}
                  </FooterLink>
                </li>
              ))
            )}
          </ul>
        </nav>

        {/* Belanja */}
        <nav aria-labelledby="footer-belanja">
          <h2
            id="footer-belanja"
            className="text-sm font-semibold tracking-wide text-cream uppercase"
          >
            Belanja
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <FooterLink href="/produk">
                <PackageIcon className="size-4" aria-hidden />
                Semua Produk
              </FooterLink>
            </li>
            <li>
              <FooterLink href="/pre-order">
                <CalendarClockIcon className="size-4" aria-hidden />
                Periode Pre-Order
              </FooterLink>
            </li>
            <li>
              <FooterLink href="/pesanan">Lacak Pesanan Saya</FooterLink>
            </li>
            <li>
              <FooterLink href="/keranjang">Keranjang</FooterLink>
            </li>
          </ul>
        </nav>

        {/* Kontak */}
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-cream uppercase">
            Hubungi Kami
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            {address && (
              <li className="flex gap-2.5">
                <MapPinIcon className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                <span>{address}</span>
              </li>
            )}
            {phone && (
              <li className="flex gap-2.5">
                <PhoneIcon className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                <a
                  href={`tel:${phone.replace(/[^0-9+]/g, "")}`}
                  className="transition-colors hover:text-gold"
                >
                  {phone}
                </a>
              </li>
            )}
            {email && (
              <li className="flex gap-2.5">
                <MailIcon className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                <a
                  href={`mailto:${email}`}
                  className="break-all transition-colors hover:text-gold"
                >
                  {email}
                </a>
              </li>
            )}
            {!address && !phone && !email && (
              <li className="text-cream-muted">
                Informasi kontak belum diisi admin.
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="relative border-t border-gold/15">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-cream-muted sm:flex-row">
          <p>
            &copy; {year} {storeName}. Seluruh hak cipta dilindungi.
          </p>
          <p>Pembayaran diproses aman melalui Duitku.</p>
        </div>
      </div>
    </footer>
  );
}

async function loadCategories() {
  try {
    return await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
      take: 8,
    });
  } catch (error) {
    console.error("[site-footer] gagal memuat kategori:", error);
    return [];
  }
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 transition-colors hover:text-gold"
    >
      {children}
    </Link>
  );
}

// --- Ikon sosial media (lucide v1 tidak lagi menyediakan ikon merek) ---

type GlyphProps = ComponentProps<"svg">;

function InstagramGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden {...props}>
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 6.03a3.81 3.81 0 1 0 0 7.62 3.81 3.81 0 0 0 0-7.62Zm0 6.29a2.48 2.48 0 1 1 0-4.96 2.48 2.48 0 0 1 0 4.96Zm4.85-6.44a.89.89 0 1 1-1.78 0 .89.89 0 0 1 1.78 0Z" />
    </svg>
  );
}

function FacebookGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden {...props}>
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
    </svg>
  );
}

function TiktokGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden {...props}>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.84-2.48V9.77a5.7 5.7 0 1 0 4.93 5.64V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.24-1.48Z" />
    </svg>
  );
}

function WhatsappGlyph(props: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden {...props}>
      <path d="M12.04 2C6.6 2 2.18 6.42 2.18 11.86c0 1.74.46 3.44 1.32 4.94L2.1 22l5.34-1.38a9.8 9.8 0 0 0 4.6 1.16h.01c5.43 0 9.85-4.42 9.85-9.86A9.8 9.8 0 0 0 18.99 4.9 9.79 9.79 0 0 0 12.04 2Zm0 17.96h-.01a8.2 8.2 0 0 1-4.16-1.14l-.3-.18-3.09.8.82-3.01-.2-.31a8.15 8.15 0 0 1-1.25-4.36c0-4.52 3.68-8.19 8.2-8.19 2.19 0 4.25.85 5.8 2.4a8.14 8.14 0 0 1 2.4 5.8c0 4.52-3.68 8.19-8.21 8.19Zm4.5-6.14c-.25-.13-1.46-.72-1.69-.8-.22-.09-.39-.13-.55.12-.16.25-.63.8-.78.96-.14.17-.28.19-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.71-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.55-1.34-.76-1.83-.2-.48-.4-.42-.55-.42h-.47c-.16 0-.42.06-.64.31-.22.25-.84.82-.84 2s.86 2.32.98 2.48c.12.17 1.69 2.58 4.1 3.62.57.25 1.02.39 1.37.5.58.19 1.1.16 1.51.1.46-.07 1.46-.6 1.66-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  );
}
