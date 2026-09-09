import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  alt?: string;
  preload?: boolean;
};

/**
 * Burung emas Kabinet ReformasiAsa (latar transparan).
 *
 * Logo utama di atas latar gelap: header storefront, halaman autentikasi,
 * dan panel admin.
 */
export function KabinetBirdLogo({
  className,
  alt = "Logo Kabinet ReformasiAsa BEM PENS",
  preload = false,
}: BrandLogoProps) {
  return (
    <Image
      src="/brand/logo-kabinet.webp"
      alt={alt}
      width={512}
      height={512}
      preload={preload}
      className={cn("block h-auto w-12 object-contain", className)}
    />
  );
}

/**
 * Lockup header: burung emas + wordmark "MERCH PENS".
 *
 * Wordmark digambar sebagai teks (font display, emas) supaya tajam di semua
 * ukuran layar — bukan gambar.
 */
export function MerchLockup({
  className,
  compact = false,
  preload = false,
}: {
  className?: string;
  compact?: boolean;
  preload?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <KabinetBirdLogo
        alt=""
        preload={preload}
        className={compact ? "w-8" : "w-10"}
      />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display font-extrabold tracking-[0.18em] text-gold",
            compact ? "text-base" : "text-lg",
          )}
        >
          MERCH PENS
        </span>
        {!compact && (
          <span className="mt-1 text-[9px] font-semibold tracking-[0.28em] text-cream-muted uppercase">
            BEM PENS • ReformasiAsa
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * Emblem hero: burung emas di atas latar gelap bermotif batik.
 *
 * Sumber gambar membawa latar gelapnya sendiri (bukan transparan), jadi
 * dirender sebagai tile emblem yang disengaja — sudut membulat + ring emas
 * tipis sesuai design.md — bukan kotak yang mengambang di atas latar hero.
 */
export function HeroEmblem({
  className,
  alt = "Lambang Kabinet ReformasiAsa BEM PENS",
  preload = false,
}: BrandLogoProps) {
  return (
    <Image
      src="/brand/logo-hero.webp"
      alt={alt}
      width={768}
      height={768}
      preload={preload}
      className={cn(
        "block h-auto w-64 rounded-3xl object-cover ring-1 ring-gold/40",
        className,
      )}
    />
  );
}

/**
 * Deretan logo institusi untuk footer: PENS, KM PENS, Kabinet.
 */
export function InstitutionLogos({ className }: { className?: string }) {
  const logos = [
    { src: "/brand/logo-pens.webp", alt: "Logo PENS" },
    { src: "/brand/logo-kmpens.webp", alt: "Logo KM PENS" },
    { src: "/brand/logo-kabinet-name.webp", alt: "Logo Kabinet ReformasiAsa BEM PENS 2026" },
  ];
  return (
    <span className={cn("inline-flex items-center gap-4", className)}>
      {logos.map((logo) => (
        <Image
          key={logo.src}
          src={logo.src}
          alt={logo.alt}
          title={logo.alt}
          width={256}
          height={256}
          className="block h-12 w-auto object-contain opacity-90 transition-opacity hover:opacity-100"
        />
      ))}
    </span>
  );
}

/**
 * @deprecated Pakai `KabinetBirdLogo` / `MerchLockup`.
 * Dipertahankan sementara supaya impor lama tidak rusak saat migrasi.
 */
export const PrimaryBrandLogo = KabinetBirdLogo;

/**
 * @deprecated Pakai `MerchLockup`.
 * Dipertahankan sementara supaya impor lama tidak rusak saat migrasi.
 */
export function SecondaryBrandLogo({
  className,
}: BrandLogoProps) {
  return <MerchLockup className={className} compact />;
}
