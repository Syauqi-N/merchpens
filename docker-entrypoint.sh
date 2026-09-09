#!/bin/sh
#
# Entrypoint container produksi.
#
# Urutannya: migrasi database dulu, aplikasi belakangan. Kalau migrasi gagal,
# container SENGAJA berhenti dengan status bukan-nol — lebih baik container
# mati dan terlihat di `docker compose ps` daripada aplikasi menyala di atas
# skema database yang tidak sesuai.
#
# Semua langkah dicatat ke stdout, jadi bisa kamu pantau dengan:
#   docker compose -f docker-compose.prod.yml logs -f app

set -eu

MIGRATOR_DIR="/app/migrator"
PRISMA_CLI="${MIGRATOR_DIR}/node_modules/prisma/build/index.js"

# Folder gambar unggahan panel admin. Nilainya HARUS sama dengan titik pasang
# volume "uploads" di docker-compose.prod.yml dan dengan tujuan tulis di
# src/app/api/upload/route.ts (process.cwd() + "/public/uploads", cwd = /app).
UPLOAD_DIR="/app/public/uploads"
# Bukti transfer cicilan harus persisten tetapi tidak boleh berada di folder
# publik/nginx. Nilainya sama dengan mount `installment-proofs` di compose.
INSTALLMENT_PROOF_DIR="/app/private-uploads/installment-proofs"

# Berapa kali migrasi dicoba ulang sebelum menyerah, dan jeda antar percobaan
# (detik). Percobaan ulang ini untuk kasus database belum selesai menyala.
MIGRATE_MAX_ATTEMPTS="${MIGRATE_MAX_ATTEMPTS:-10}"
MIGRATE_RETRY_DELAY="${MIGRATE_RETRY_DELAY:-3}"

log() {
  echo "[entrypoint] $*"
}

log "Menyiapkan aplikasi Merch PENS..."

# --- 1. Periksa variabel wajib ---------------------------------------------
if [ -z "${DATABASE_URL:-}" ]; then
  log "GAGAL: variabel DATABASE_URL belum diisi."
  log "       Isi dulu di berkas .env (lihat .env.example), lalu jalankan ulang."
  exit 1
fi

if [ ! -f "${PRISMA_CLI}" ]; then
  log "GAGAL: CLI Prisma tidak ditemukan di ${PRISMA_CLI}."
  log "       Image ini kemungkinan tidak dibangun dari Dockerfile yang benar."
  exit 1
fi

# --- 2. Jalankan migrasi ----------------------------------------------------
# `prisma migrate deploy` hanya MENERAPKAN migrasi yang belum jalan. Perintah
# ini tidak pernah menghapus atau me-reset data, jadi aman dipanggil setiap
# kali container dinyalakan.
attempt=1
while true; do
  log "Menjalankan migrasi database (percobaan ${attempt} dari ${MIGRATE_MAX_ATTEMPTS})..."

  if (cd "${MIGRATOR_DIR}" && node "${PRISMA_CLI}" migrate deploy); then
    log "Migrasi database selesai."
    break
  fi

  if [ "${attempt}" -ge "${MIGRATE_MAX_ATTEMPTS}" ]; then
    log "GAGAL: migrasi database tidak berhasil setelah ${MIGRATE_MAX_ATTEMPTS} percobaan."
    log "       Periksa DATABASE_URL, status container database, dan pesan galat di atas."
    log "       Aplikasi TIDAK dijalankan supaya data tidak dipakai dengan skema yang salah."
    exit 1
  fi

  log "Migrasi belum berhasil — mungkin database belum siap menerima koneksi."
  log "Mencoba lagi dalam ${MIGRATE_RETRY_DELAY} detik..."
  attempt=$((attempt + 1))
  sleep "${MIGRATE_RETRY_DELAY}"
done

# --- 3. Periksa folder gambar unggahan --------------------------------------
# Gambar produk/kategori/banner ditulis ke folder ini saat runtime, jadi folder
# tersebut WAJIB bisa ditulis oleh user non-root yang menjalankan aplikasi.
#
# Kegagalan di sini SENGAJA tidak menghentikan container: toko tetap boleh
# melayani pembeli walau admin sementara tidak bisa mengunggah gambar baru.
# Yang penting masalahnya terlihat jelas di log, bukan baru ketahuan saat admin
# menemui galat "Gambar gagal disimpan".
mkdir -p "${UPLOAD_DIR}" 2>/dev/null || true

if [ ! -d "${UPLOAD_DIR}" ]; then
  log "PERINGATAN: folder unggahan ${UPLOAD_DIR} tidak ada dan tidak bisa dibuat."
  log "            Unggah gambar di panel admin akan gagal."
elif touch "${UPLOAD_DIR}/.tulis-uji" 2>/dev/null; then
  rm -f "${UPLOAD_DIR}/.tulis-uji"
  log "Folder gambar unggahan siap: ${UPLOAD_DIR}"
else
  log "PERINGATAN: ${UPLOAD_DIR} TIDAK bisa ditulis oleh user $(id -un 2>/dev/null || echo '?')."
  log "            Unggah gambar di panel admin akan gagal dengan galat 500."
  log "            Penyebab paling umum: volume 'uploads' terlanjur dibuat"
  log "            sebagai milik root oleh image versi lama. Perbaiki sekali:"
  log "              docker run --rm -v merch-uploads:/data alpine chown -R 1001:1001 /data"
  log "            lalu jalankan ulang: docker compose -f docker-compose.prod.yml up -d app"
fi

# --- 4. Jalankan perintah utama ---------------------------------------------
# `exec` supaya proses Node menggantikan skrip ini dan menerima sinyal
# (SIGTERM saat `docker stop`) secara langsung.
#
# Biasanya CMD-nya `node server.js` (aplikasi). Untuk layanan sekali-jalan
# "tools" di docker-compose.prod.yml, CMD-nya perintah perawatan database —
# migrasi di atas tetap dijalankan lebih dulu, jadi skemanya dipastikan sudah
# mutakhir sebelum akun admin dibuat.
log "Menjalankan: $*"
exec "$@"
