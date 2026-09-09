// Modul ini query database lewat Prisma; `server-only` membuat build gagal
// keras kalau suatu saat ada Client Component yang mengimpornya.
import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Pembantu untuk tabel `Setting` (key/value) yang menyimpan informasi toko:
 * nama, kontak, teks hero beranda, informasi pengambilan barang, dan tautan
 * sosial media.
 *
 * Barang PO bisa diambil di kampus atau dikirim ke alamat (ongkir manual
 * via WhatsApp admin) — lihat `fulfillmentType` pada Order.
 *
 * Daftar dropdown checkout (`angkatan_list`, `jurusan_list`) disimpan sebagai
 * JSON array string agar pengurus bisa mengubahnya tanpa deploy.
 *
 * Dipakai Server Component (footer, beranda, checkout). Hasilnya di-cache per
 * request lewat `React.cache`, jadi memanggil `getSettings()` di beberapa
 * komponen sekaligus tetap hanya menghasilkan satu query.
 */

export const SETTING_KEYS = [
  "store_name",
  "store_tagline",
  "store_email",
  "store_phone",
  "store_address",
  "store_about",
  "hero_heading",
  "hero_subheading",
  "pickup_lead_days",
  "pickup_location",
  "pickup_schedule",
  "pickup_note",
  "preorder_info",
  "social_instagram",
  "social_facebook",
  "social_tiktok",
  "social_whatsapp",
  "angkatan_list",
  "jurusan_list",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

/** Nilai bawaan bila tabel `Setting` belum diisi (atau database tidak terjangkau). */
export const DEFAULT_SETTINGS: Record<SettingKey, string> = {
  store_name: "Merch PENS",
  store_tagline: "Merchandise resmi PENS",
  store_email: "",
  store_phone: "",
  store_address: "Kampus PENS, Surabaya",
  store_about:
    "Pemesanan merchandise PENS lewat pre-order berkuota. Bisa diambil di kampus atau dikirim ke alamat (ongkir manual via WhatsApp admin).",
  hero_heading: "Merchandise PENS, pesan pre-order sekarang",
  hero_subheading:
    "Ikut periode pre-order yang sedang dibuka untuk dapat harga terbaik selama kuota masih ada.",
  pickup_lead_days: "30",
  pickup_location: "Sekretariat, Kampus PENS",
  pickup_schedule: "Senin-Jumat, 10.00-15.00 WIB",
  pickup_note: "Tunjukkan kode pesanan ke panitia saat pengambilan.",
  preorder_info:
    "Barang pre-order diproduksi setelah periode PO ditutup. Pesanan yang memilih kirim akan dihubungi admin via WhatsApp untuk ongkir.",
  social_instagram: "",
  social_facebook: "",
  social_tiktok: "",
  social_whatsapp: "",
  // PLACEHOLDER — ganti dengan daftar resmi saat sudah fix.
  angkatan_list: JSON.stringify(["2021", "2022", "2023", "2024", "2025"]),
  jurusan_list: JSON.stringify([
    "Teknik Elektronika",
    "Teknik Telekomunikasi",
    "Teknik Elektro Industri",
    "Informatika",
    "Teknik Mekatronika",
    "Multimedia Broadcasting",
  ]),
};

export type SettingsMap = Record<string, string>;

/**
 * Seluruh isi tabel `Setting` sebagai objek biasa, digabung dengan nilai bawaan.
 * Tidak pernah melempar error: bila query gagal, nilai bawaan yang dipakai agar
 * layout tetap bisa dirender.
 */
export const getSettings = cache(async (): Promise<SettingsMap> => {
  const settings: SettingsMap = { ...DEFAULT_SETTINGS };

  try {
    const rows = await prisma.setting.findMany({
      select: { key: true, value: true },
    });

    for (const row of rows) {
      const value = row.value ?? "";
      // Nilai kosong di database tidak menimpa nilai bawaan yang informatif.
      if (value.trim() === "" && row.key in DEFAULT_SETTINGS) continue;
      settings[row.key] = value;
    }
  } catch (error) {
    console.error("[settings] gagal memuat tabel Setting:", error);
  }

  return settings;
});

/** Ambil satu setting; mengembalikan `fallback` bila kosong atau tidak ada. */
export async function getSetting(key: string, fallback = ""): Promise<string> {
  const settings = await getSettings();
  const value = settings[key];
  return value === undefined || value.trim() === "" ? fallback : value;
}

/** Daftar dropdown untuk checkout (disimpan sebagai JSON array di Setting). */
export type MasterLists = {
  angkatan: string[];
  jurusan: string[];
};

function parseStringList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const cleaned = parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      if (cleaned.length > 0) return [...new Set(cleaned)];
    }
  } catch {
    // abaikan — pakai fallback di bawah
  }
  return fallback;
}

/** Daftar angkatan & jurusan untuk dropdown checkout dan filter admin. */
export async function getMasterLists(): Promise<MasterLists> {
  const [angkatanRaw, jurusanRaw] = await Promise.all([
    getSetting("angkatan_list", DEFAULT_SETTINGS.angkatan_list),
    getSetting("jurusan_list", DEFAULT_SETTINGS.jurusan_list),
  ]);
  return {
    angkatan: parseStringList(angkatanRaw, ["2021", "2022", "2023", "2024", "2025"]),
    jurusan: parseStringList(jurusanRaw, []),
  };
}

/** Informasi tempat & jadwal pengambilan barang yang ditampilkan ke pembeli. */
export type PickupInfo = {
  /** Tempat pengambilan, mis. "Sekretariat BEM, Gedung A Lantai 2". */
  location: string;
  /** Jadwal pengambilan, mis. "Senin-Jumat, 10.00-15.00 WIB". */
  schedule: string;
  /** Catatan tambahan untuk mahasiswa, mis. syarat membawa KTM. */
  note: string;
};

export type PickupDefaults = PickupInfo & {
  /** Jeda bawaan dari periode ditutup sampai estimasi barang bisa diambil. */
  leadDays: number;
};

function parsePickupLeadDays(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 365 ? parsed : 30;
}

/** Default yang disalin ke periode baru dan tetap boleh diedit per periode. */
export async function getPickupDefaults(): Promise<PickupDefaults> {
  const settings = await getSettings();
  const pick = (key: "pickup_location" | "pickup_schedule" | "pickup_note") => {
    const value = settings[key];
    return value === undefined || value.trim() === "" ? DEFAULT_SETTINGS[key] : value;
  };

  return {
    leadDays: parsePickupLeadDays(settings.pickup_lead_days),
    location: pick("pickup_location"),
    schedule: pick("pickup_schedule"),
    note: pick("pickup_note"),
  };
}

/**
 * Info pengambilan barang untuk checkout dan detail pesanan.
 *
 * Sama seperti `getSettings()`, fungsi ini tidak pernah melempar error: bila
 * database bermasalah, nilai bawaan dari `DEFAULT_SETTINGS` yang dikembalikan
 * supaya halaman checkout tetap bisa dirender.
 */
export async function getPickupInfo(): Promise<PickupInfo> {
  try {
    const defaults = await getPickupDefaults();
    return {
      location: defaults.location,
      schedule: defaults.schedule,
      note: defaults.note,
    };
  } catch (error) {
    console.error("[settings] gagal memuat info pengambilan:", error);
    return {
      location: DEFAULT_SETTINGS.pickup_location,
      schedule: DEFAULT_SETTINGS.pickup_schedule,
      note: DEFAULT_SETTINGS.pickup_note,
    };
  }
}
