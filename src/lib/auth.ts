// Modul ini memegang rahasia sesi dan query user; `server-only` membuat build
// gagal keras kalau suatu saat ada Client Component yang mengimpornya.
import "server-only";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { can, type Capability } from "@/lib/permissions";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Credentials sign-in requires JWT sessions (database sessions are not
  // supported for the credentials provider).
  session: { strategy: "jwt" },
  pages: {
    signIn: "/masuk",
  },
  // Trust reverse proxy headers from nginx
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Kata sandi", type: "password" },
      },
      async authorize(credentials) {
        console.log("[AUTH_DEBUG] Authorize called with:", { email: credentials?.email });

        // Anti brute-force lapis 1: 30x / 10 menit / IP
        try {
          const ip = await clientIp();
          const ipCheck = consumeRateLimit(`login-ip:${ip}`, 30, 10 * 60_000);
          console.log("[AUTH_DEBUG] IP:", ip, "RateLimit:", ipCheck.ok);
          if (!ipCheck.ok) {
            console.log("[AUTH_DEBUG] Blocked by IP rate limit");
            return null;
          }
        } catch (e) {
          console.log("[AUTH_DEBUG] Error getting IP:", e);
        }

        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          console.log("[AUTH_DEBUG] Schema parse failed:", parsed.error);
          return null;
        }

        const normalizedEmail = parsed.data.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        console.log("[AUTH_DEBUG] User found:", Boolean(user), "Has passwordHash:", Boolean(user?.passwordHash));
        if (!user?.passwordHash) {
          console.log("[AUTH_DEBUG] No user or passwordHash");
          return null;
        }

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        console.log("[AUTH_DEBUG] Password valid:", valid);
        if (!valid) return null;

        if (!user.isActive) {
          console.log("[AUTH_DEBUG] User inactive");
          return null;
        }

        console.log("[AUTH_DEBUG] Login SUCCESS for:", user.email);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Jika login via OAuth, pastikan akun tidak sedang dinonaktifkan di database
      if (account?.provider === "google" && user.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { isActive: true },
        });
        if (dbUser && !dbUser.isActive) {
          return false;
        }
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "CUSTOMER";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = token.role ?? "CUSTOMER";
      }
      return session;
    },
    /**
     * Force semua redirect Auth.js tetap di base URL yang benar
     * (AUTH_URL / baseUrl) untuk mencegah redirect ke domain lama.
     * 
     * Namun, tetap hormati internal redirects yang berasal dari NextAuth sendiri
     * (yang biasanya relative atau sama origin-nya).
     */
    async redirect({ url, baseUrl }) {
      // Untuk relative URL (dimulai dengan /), kembalikan apa adanya
      // supaya NextAuth bisa handle internal flows-nya
      if (url.startsWith('/')) {
        return url;
      }

      try {
        const urlObj = new URL(url);
        
        // Jika URL sudah protokol lengkap (http:// atau https://),
        // cek apakah sama origin dengan baseUrl
        if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
          const baseObj = new URL(baseUrl);
          
          // Jika sama origin, gunakan url asli
          if (urlObj.origin === baseObj.origin) {
            return url;
          }
          
          // Jika berbeda origin, selalu gunakan baseUrl untuk keamanan
          return baseUrl;
        }
      } catch (err) {
        // url bukan valid URL, fallback ke baseUrl
        console.error('[auth] redirect error:', err);
      }
      
      // Fallback untuk case lainnya
      return baseUrl;
    },
  },
});

/** Throws unless there is a signed-in user. Returns the session. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}

/**
 * Peran & status aktif pengguna TERKINI dari database.
 *
 * Sengaja tidak mempercayai token: sesi berupa JWT yang isinya dibekukan saat
 * login dan berlaku berminggu-minggu. Tanpa pembacaan ulang ini, pengurus yang
 * baru saja diturunkan perannya atau dinonaktifkan masih bisa memakai panel
 * admin sampai tokennya kedaluwarsa sendiri. Satu query ringan per aksi adalah
 * harga yang pantas untuk pencabutan akses yang berlaku seketika — hal yang
 * penting di organisasi dengan anggota keluar-masuk seperti BEM.
 */
export async function getCurrentActor() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, isActive: true, name: true, email: true },
  });

  if (!current?.isActive) return null;
  return current;
}

/**
 * Memastikan pengguna yang sedang masuk punya kemampuan tertentu.
 * Melempar "FORBIDDEN" bila tidak.
 *
 * Pakai ini — BUKAN pengecekan peran langsung — supaya penambahan peran baru
 * cukup mengubah tabel di `lib/permissions.ts`.
 */
export async function requireCapability(capability: Capability) {
  const actor = await getCurrentActor();
  if (!actor || !can(actor.role, capability)) {
    throw new Error("FORBIDDEN");
  }
  return actor;
}

/** Memastikan pengguna boleh membuka panel admin (peran staf apa pun). */
export async function requireAdminPanel() {
  return requireCapability("ACCESS_ADMIN");
}
