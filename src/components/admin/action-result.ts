import type { z } from "zod";

import { CAPABILITY_DENIED_MESSAGE, type Capability } from "@/lib/permissions";

/**
 * Bentuk balikan seragam untuk seluruh Server Action panel admin.
 *
 * Kesalahan yang "diharapkan" (validasi, slug bentrok, produk masih dipakai)
 * DIKEMBALIKAN sebagai nilai — bukan dilempar — supaya bisa ditampilkan lewat
 * toast/pesan field tanpa memicu error boundary.
 */
export type ActionResult = ActionSuccess | ActionFailure;

export type ActionSuccess = {
  ok: true;
  message: string;
  /** Id entitas yang baru dibuat/diubah — dipakai untuk navigasi setelah simpan. */
  id?: string;
};

export type ActionFailure = {
  ok: false;
  message: string;
  /** Pesan per-field agar form bisa menyorot input yang bermasalah. */
  fieldErrors?: Record<string, string>;
};

/**
 * Penolakan baku saat pengguna tidak punya kemampuan yang dibutuhkan aksi ini.
 *
 * Pesannya diambil dari `CAPABILITY_DENIED_MESSAGE` supaya penolakannya
 * informatif ("Kamu tidak punya akses untuk mengelola katalog. Hubungi Pengurus
 * Inti.") alih-alih satu kalimat umum yang tidak menjelaskan apa-apa — dan
 * supaya kalimatnya hanya ditulis di satu tempat, `lib/permissions.ts`.
 */
export function capabilityDeniedResult(capability: Capability): ActionFailure {
  return { ok: false, message: CAPABILITY_DENIED_MESSAGE[capability] };
}

/** Pesan baku saat terjadi kesalahan tak terduga di server. */
export function serverErrorResult(context: string, error: unknown): ActionFailure {
  console.error(`[admin] ${context}:`, error);
  return {
    ok: false,
    message: "Terjadi kesalahan pada server. Coba lagi beberapa saat lagi.",
  };
}

/** Ubah issue zod menjadi peta `namaField -> pesan` (pesan pertama yang menang). */
export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    // `images.0.url` -> dipakai apa adanya agar cocok dengan nama field RHF.
    const path = issue.path
      .map((segment) => (typeof segment === "number" ? String(segment) : String(segment)))
      .join(".");
    const key = path === "" ? "_form" : path;
    if (!(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}

/** Balikan gagal-validasi yang seragam. */
export function validationFailure(error: z.ZodError): ActionFailure {
  return {
    ok: false,
    message: "Periksa kembali data yang kamu isi.",
    fieldErrors: fieldErrorsFromZod(error),
  };
}

/** Deteksi pelanggaran unique constraint Prisma (P2002). */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
