import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy Next.js 16 (dulu bernama `middleware`).
 *
 * Pemeriksaan di sini hanya OPTIMISTIK: cukup melihat ada/tidaknya cookie sesi
 * Auth.js supaya pengunjung anonim langsung diarahkan ke halaman masuk tanpa
 * menunggu render. Pemeriksaan peran yang sesungguhnya tetap dilakukan dekat
 * data — `getCurrentActor()` di `src/app/admin/layout.tsx`,
 * `ensurePageCapability()` di tiap `page.tsx` admin, serta `requireCapability()`
 * / `requireUser()` di Server Action dan Route Handler.
 *
 * Catatan: proxy juga berjalan pada prefetch, jadi jangan lakukan query database
 * atau verifikasi token di sini.
 */

/** Nama cookie sesi Auth.js v5 (JWT strategy), versi HTTP dan HTTPS. */
const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
] as const;

/** Rute yang wajib login (prefix — termasuk seluruh sub-rutenya). */
const PROTECTED_PREFIXES = ["/admin", "/pesanan", "/checkout"] as const;

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some(
    (name) => (request.cookies.get(name)?.value ?? "") !== "",
  );
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  if (!isProtected(pathname) || hasSessionCookie(request)) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/masuk";
  loginUrl.search = "";
  loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Jalankan pada semua rute halaman, kecuali API, aset build, dan berkas statis.
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|bmp|woff|woff2|ttf|otf)$).*)",
  ],
};
