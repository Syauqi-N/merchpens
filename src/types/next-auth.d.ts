import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
  }
}

// `next-auth/jwt` only re-exports `@auth/core/jwt`, so the augmentation has to
// target the original module — augmenting the re-export would create a separate
// interface instead of merging with the real `JWT`.
declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}
