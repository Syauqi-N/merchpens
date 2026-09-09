import type { Role } from "@/generated/prisma/client";

/**
 * Model hak akses berbasis KEMAMPUAN (capability), bukan pengecekan peran
 * yang berserakan.
 *
 * Kode di seluruh aplikasi menanyakan "boleh melakukan X?", bukan "apakah dia
 * PENGURUS?". Manfaatnya terbukti saat peran ORDER_STAFF dan MANAGER digabung
 * menjadi PENGURUS: cukup mengubah tabel di bawah, tanpa menyentuh satu pun
 * dari puluhan pemanggilnya.
 */

export const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: "Customer",
  PENGURUS: "Pengurus",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  CUSTOMER: "Memesan dan melihat pesanannya sendiri.",
  PENGURUS:
    "Akses admin penuh: produk & varian, periode pre-order & kuota, beranda, pesanan, rekap, dan kelola pengguna.",
};

export type Capability =
  /** Boleh membuka panel admin sama sekali. */
  | "ACCESS_ADMIN"
  /** Memproses pesanan: ubah status, konfirmasi manual, sinkron pembayaran. */
  | "MANAGE_ORDERS"
  /** Katalog: produk, kategori, periode PO & kuota, banner, pengaturan beranda. */
  | "MANAGE_CATALOG"
  /** Akun & peran pengurus. */
  | "MANAGE_USERS";

const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  CUSTOMER: [],
  PENGURUS: ["ACCESS_ADMIN", "MANAGE_ORDERS", "MANAGE_CATALOG", "MANAGE_USERS"],
};

/** Apakah peran ini punya kemampuan tersebut. */
export function can(role: Role | undefined | null, capability: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

/** Seluruh peran yang boleh membuka panel admin. */
export const ADMIN_ROLES = (Object.keys(ROLE_CAPABILITIES) as Role[]).filter((role) =>
  can(role, "ACCESS_ADMIN"),
);

/** Peran yang bisa diberikan lewat panel kelola pengguna. */
export const ASSIGNABLE_ROLES: readonly Role[] = ["CUSTOMER", "PENGURUS"];

/** Pesan penolakan yang seragam untuk tiap kemampuan. */
export const CAPABILITY_DENIED_MESSAGE: Record<Capability, string> = {
  ACCESS_ADMIN: "Kamu tidak punya akses ke panel admin.",
  MANAGE_ORDERS: "Kamu tidak punya akses untuk mengelola pesanan.",
  MANAGE_CATALOG: "Kamu tidak punya akses untuk mengelola katalog.",
  MANAGE_USERS: "Hanya pengurus yang bisa mengelola akun dan peran.",
};
