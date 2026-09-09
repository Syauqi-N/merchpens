"use client";

import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

import { CartOwnerSync } from "@/components/cart/cart-owner-sync";

/**
 * Pembungkus context sisi klien untuk seluruh aplikasi.
 *
 * - `SessionProvider` membuat `useSession()` tersedia di Client Component.
 *   Server Component tetap memakai `auth()` dari `@/lib/auth`.
 *   `session` diisi dari server (boleh `null`) supaya `useSession()` tidak
 *   berstatus "loading" saat render pertama — header langsung menampilkan
 *   menu akun yang benar tanpa kedipan skeleton.
 * - `ThemeProvider` dipakai komponen `Toaster` (sonner) untuk menentukan tema.
 *   Merch dikunci pada tema gelap sesuai design.md (obsidian + emas) agar
 *   komponen shadcn (`.dark` tokens) ikut gelap konsisten.
 */
export function Providers({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        forcedTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
      >
        <CartOwnerSync />
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
