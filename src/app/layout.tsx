import type { Metadata } from "next";
import { Geist_Mono, Montserrat, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";

import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Toaster } from "@/components/ui/sonner";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
  variable: "--font-display",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Merch PENS — Merchandise Resmi PENS",
    template: "%s | Merch PENS",
  },
  description:
    "Merchandise resmi PENS lewat pre-order berkuota per periode, pembayaran aman melalui Duitku.",
  applicationName: "Merch PENS",
  keywords: [
    "merchandise pens",
    "kaos pens",
    "merch pens",
    "pre-order merchandise",
  ],
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Merch PENS",
    title: "Merch PENS — Merchandise Resmi PENS",
    description:
      "Pre-order berkuota merchandise resmi PENS.",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [settings, session] = await Promise.all([getSettings(), auth()]);

  return (
    // Tema gelap BEM PENS diaktifkan lewat kelas `dark` — seluruh token gelap
    // + emas tinggal di `.dark` pada globals.css. Melepas kelas ini
    // mengembalikan tema terang (untuk perbandingan visual).
    <html
      lang="id"
      suppressHydrationWarning
      className={`dark ${jakarta.variable} ${montserrat.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`${jakarta.className} flex min-h-full flex-col bg-obsidian text-cream`}>
        <Providers session={session}>
          <a
            href="#konten-utama"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-obsidian"
          >
            Lompat ke konten utama
          </a>

          <SiteHeader
            storeName={settings.store_name}
            storePhone={settings.store_phone}
            storeEmail={settings.store_email}
          />

          <main id="konten-utama" className="flex-1">
            {children}
          </main>

          <SiteFooter />

          <Toaster position="top-center" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
