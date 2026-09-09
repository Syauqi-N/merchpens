import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheckIcon } from "lucide-react";

import { PrimaryBrandLogo } from "@/components/branding/brand-logos";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { auth } from "@/lib/auth";
import { safeCallbackUrl } from "../utils";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke akun Merch PENS untuk memesan dan melacak pesanan.",
};

export default async function MasukPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);

  const session = await auth();
  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-12 sm:py-16">
      <div className="flex flex-col items-center text-center">
        <PrimaryBrandLogo className="w-28 drop-shadow-sm sm:w-32" preload />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-cream">
          Masuk ke akun kamu
        </h1>
        <p className="mt-1.5 text-sm text-cream-muted">
          Checkout wajib login agar kuota pre-order dan riwayat pesanan tercatat
          atas nama kamu.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-coal p-6 shadow-sm">
        <GoogleSignInButton callbackUrl={callbackUrl} label="Masuk dengan Google" />

        <div className="my-5 flex items-center gap-3">
          <span aria-hidden className="h-px flex-1 bg-white/10" />
          <span className="text-[11px] font-medium tracking-wider text-cream-muted uppercase">
            atau dengan email
          </span>
          <span aria-hidden className="h-px flex-1 bg-white/10" />
        </div>

        <LoginForm callbackUrl={callbackUrl} />
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-xs text-cream-muted">
        <ShieldCheckIcon className="size-4 text-gold" aria-hidden />
        Data kamu hanya dipakai untuk memproses pesanan.
      </p>

      <p className="mt-4 text-center text-sm">
        <Link href="/" className="text-cream-muted hover:text-gold hover:underline">
          Kembali ke beranda
        </Link>
      </p>
    </div>
  );
}
