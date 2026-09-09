import { prisma } from "@/lib/prisma";

/**
 * Endpoint kesehatan aplikasi — dipakai HEALTHCHECK Docker, reverse proxy,
 * dan monitoring luar (uptime checker).
 *
 *   curl -fsS http://localhost:3000/api/health
 *
 * Balasan:
 *   200 { "status": "ok",    "database": true,  "waktu": "..." }  → sehat
 *   503 { "status": "error", "database": false, "waktu": "..." }  → tidak sehat
 *
 * Balasan sengaja dibuat MINIM: tidak ada versi aplikasi, nama host database,
 * detail koneksi, maupun pesan error mentah. Endpoint ini terbuka tanpa
 * autentikasi, jadi apa pun yang dikirim di sini dianggap publik. Detail
 * kegagalan hanya ditulis ke log server (docker compose logs).
 */

// Selalu dijalankan saat request; hasilnya tidak boleh pernah di-cache
// (health check yang di-cache akan melaporkan "sehat" padahal sudah mati).
export const dynamic = "force-dynamic";

/** Batas tunggu query cek database. */
const TIMEOUT_MS = 5_000;

export async function GET() {
  const databaseOk = await cekDatabase();
  const waktu = new Date().toISOString();

  return Response.json(
    {
      status: databaseOk ? "ok" : "error",
      database: databaseOk,
      waktu,
    },
    {
      status: databaseOk ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

/**
 * Query paling ringan yang membuktikan koneksi database benar-benar hidup
 * (bukan sekadar proses Node yang masih berjalan).
 *
 * Diberi batas waktu sendiri supaya health check tidak menggantung saat
 * database menerima koneksi tapi tidak pernah menjawab.
 */
async function cekDatabase(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const query = prisma.$queryRaw`SELECT 1`;
    // Kalau timeout menang duluan, kegagalan query tetap perlu penangan supaya
    // tidak muncul sebagai unhandled rejection dan mematikan proses.
    query.catch(() => {});

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Database tidak menjawab dalam ${TIMEOUT_MS} ms`)),
        TIMEOUT_MS,
      );
    });

    await Promise.race([query, timeout]);
    return true;
  } catch (error) {
    console.error("[health] database tidak sehat:", error);
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
