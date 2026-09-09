# syntax=docker/dockerfile:1
#
# Image produksi Toko Alat Kedokteran Gigi (Next.js 16 + Prisma 7).
#
# Alur multi-stage:
#   base     -> Node 22 Alpine + pustaka sistem yang dibutuhkan
#   deps     -> install SEMUA dependency (termasuk dev, karena `next build`
#               tetap menjalankan TypeScript + ESLint)
#   builder  -> `prisma generate` LALU `next build` (hasil: .next/standalone)
#   migrator -> CLI Prisma tersendiri (ramping) khusus `prisma migrate deploy`
#   runner   -> image akhir: user non-root, hanya berisi yang perlu jalan
#
# Build:  docker build -t toko-online-app:latest .
# Jalan:  lihat docker-compose.prod.yml
#
# Yang WAJIB tersedia saat build (butuh koneksi internet):
#   - registry npm  (npm ci)
#   - fonts.googleapis.com  (next/font/google mengunduh Inter & Geist Mono
#     saat build; tanpa internet build akan gagal)

# ---------------------------------------------------------------------------
# Stage 1: base
# ---------------------------------------------------------------------------
# Next 16 mensyaratkan Node 20.9+. Kita pakai Node 22 LTS versi Alpine.
FROM node:22-alpine AS base

# libc6-compat : disarankan Next untuk modul native di Alpine (mis. sharp)
# openssl      : dibutuhkan schema-engine Prisma saat menjalankan migrasi
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Matikan telemetri Next di semua stage supaya build tidak menembak internet.
ENV NEXT_TELEMETRY_DISABLED=1

# ---------------------------------------------------------------------------
# Stage 2: deps — install dependency
# ---------------------------------------------------------------------------
FROM base AS deps

# Hanya manifest yang disalin dulu supaya layer npm ci bisa dipakai ulang
# (cache) selama package.json / package-lock.json tidak berubah.
COPY package.json package-lock.json ./

# `npm ci` (bukan `npm install`) supaya versinya persis seperti package-lock.
# Dev dependency IKUT dipasang: `next build` menjalankan tsc + eslint.
# Script postinstall SENGAJA tidak dimatikan — Prisma mengunduh engine-nya
# dan sharp memasang binary musl lewat script tersebut.
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 3: builder — generate Prisma Client lalu build Next
# ---------------------------------------------------------------------------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

# Nilai-nilai DUMMY khusus waktu build, sengaja ditempel pada perintahnya
# (bukan lewat ENV) supaya tidak ikut tersimpan di metadata image.
#
# Kenapa perlu? `next build` ikut merender halaman, dan halaman-halaman itu
# menyentuh Prisma serta Auth.js, jadi variabelnya harus ADA supaya build
# tidak gagal. Isinya tidak dipakai untuk apa pun: tidak ada koneksi database
# yang benar-benar dibuka saat build. Nilai asli baru disuntikkan saat
# container berjalan, lewat env_file di docker-compose.prod.yml.

# WAJIB sebelum `npm run build`: hasil generate (src/generated/prisma)
# di-gitignore sehingga tidak pernah ikut terkirim ke dalam build context.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    npx prisma generate

# Turbopack adalah builder bawaan Next 16. Kalau suatu saat build gagal
# karena Turbopack, alternatifnya: `npx next build --webpack`.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    AUTH_SECRET="dummy-khusus-build-tidak-dipakai-saat-runtime" \
    AUTH_TRUST_HOST="true" \
    AUTH_URL="http://localhost:3000" \
    APP_URL="http://localhost:3000" \
    npm run build

# ---------------------------------------------------------------------------
# Stage 4: migrator — kotak perkakas database (Prisma CLI + skrip seed)
# ---------------------------------------------------------------------------
# Kenapa dipisah? Image akhir hanya berisi node_modules hasil pelacakan Next
# (standalone). Isinya SANGAT ramping: tidak ada CLI Prisma, tidak ada tsx,
# dan tidak ada prisma/seed.ts. Akibatnya `npm run db:admin` TIDAK BISA
# dijalankan di /app — perintahnya ada di package.json bawaan standalone,
# tapi tsx-nya tidak ikut, jadi hasilnya "tsx: not found".
#
# Menyalin seluruh node_modules produksi ke image akhir akan menambah ratusan
# MB, jadi di sini kita rakit satu folder mandiri berisi PERSIS yang dibutuhkan
# perawatan database:
#
#   prisma             -> `migrate deploy` / `migrate status`
#   tsx                -> menjalankan prisma/seed.ts (TypeScript) langsung
#   @prisma/client     -> runtime yang dipakai klien hasil generate
#   @prisma/adapter-pg -> driver adapter yang dipakai seed.ts
#   pg                 -> driver PostgreSQL di balik adapter
#   bcryptjs           -> hashing password admin di seed.ts
#   dotenv             -> dibutuhkan prisma.config.ts ("dotenv/config")
#
# Semua versinya dikunci mengikuti package-lock.json supaya sama persis dengan
# yang dipakai saat development — kalau salah satu paket tidak ada di lockfile,
# build sengaja GAGAL di sini, bukan diam-diam memasang versi yang berbeda.
FROM base AS migrator

WORKDIR /migrator
COPY package.json package-lock.json ./

RUN set -eux; \
    cp package-lock.json /tmp/lock.json; \
    resolve() { \
      node -p 'const l=require("/tmp/lock.json");const e=l.packages["node_modules/"+process.argv[1]];if(!e||!e.version){console.error("versi "+process.argv[1]+" tidak ditemukan di package-lock.json");process.exit(1)}e.version' "$1"; \
    }; \
    SPECS=""; \
    for pkg in prisma @prisma/client @prisma/adapter-pg pg bcryptjs dotenv tsx; do \
      SPECS="${SPECS} ${pkg}@$(resolve "${pkg}")"; \
    done; \
    rm -f package.json package-lock.json /tmp/lock.json; \
    npm init -y > /dev/null; \
    npm install --no-audit --no-fund --save-exact ${SPECS}; \
    npm pkg set "scripts.db:deploy=prisma migrate deploy" \
                "scripts.db:status=prisma migrate status" \
                "scripts.db:admin=tsx prisma/seed-admin.ts" \
                "scripts.db:seed=tsx prisma/seed.ts"; \
    npm cache clean --force; \
    node node_modules/prisma/build/index.js --version

# Skema + konfigurasi + skrip seed ditaruh dengan susunan folder yang SAMA
# seperti di proyek aslinya:
#
#   /migrator/prisma.config.ts        <- schema: "prisma/schema.prisma"
#   /migrator/prisma/schema.prisma    <- generator output: "../src/generated/prisma"
#   /migrator/prisma/seed.ts          <- import "../src/generated/prisma/client"
#   /migrator/src/generated/prisma/   <- hasil `prisma generate` di bawah ini
#
# Susunan ini yang membuat path relatif di dalam ketiga berkas itu tetap cocok
# tanpa perlu mengubah satu baris pun kode proyek.
COPY prisma.config.ts ./prisma.config.ts
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/admin.ts ./prisma/admin.ts
COPY prisma/seed-admin.ts ./prisma/seed-admin.ts
COPY prisma/seed-images.ts ./prisma/seed-images.ts
COPY prisma/seed.ts ./prisma/seed.ts

# DATABASE_URL dummy: `prisma generate` tidak menyentuh database sama sekali,
# tapi prisma.config.ts membaca variabel ini sehingga harus ADA nilainya.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    node node_modules/prisma/build/index.js generate

# ---------------------------------------------------------------------------
# Stage 5: runner — image akhir
# ---------------------------------------------------------------------------
FROM base AS runner

# tini: init PID 1 yang benar (meneruskan SIGTERM & memanen proses zombie),
# supaya `docker stop` mematikan aplikasi dengan rapi.
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    HOME=/home/nextjs \
    NEXT_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1

# User non-root. Semua isi /app dimiliki nextjs:nodejs.
RUN addgroup -S -g 1001 nodejs \
    && adduser -S -u 1001 -G nodejs -h /home/nextjs nextjs

WORKDIR /app

# --- aplikasi Next (hasil build standalone) --------------------------------
# .next/standalone berisi server.js + node_modules seperlunya.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Dua folder ini TIDAK ikut dalam standalone, harus disalin manual:
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# --- perkakas database -----------------------------------------------------
# Folder mandiri berisi CLI Prisma, tsx, skrip seed, dan klien hasil generate.
# Entrypoint menjalankan migrasi dengan cwd /app/migrator, sehingga path
# relatif di prisma.config.ts ("prisma/schema.prisma" dan "prisma/migrations")
# tetap cocok.
#
# Folder ini juga yang membuat perawatan database bisa dilakukan LANGSUNG di
# image produksi, tanpa image kedua dan tanpa build ulang:
#
#   docker compose -f docker-compose.prod.yml run --rm tools
#   docker compose -f docker-compose.prod.yml run --rm tools npm run db:status
#
COPY --from=migrator --chown=nextjs:nodejs /migrator ./migrator
# Migrasi disalin belakangan (bukan di stage migrator) supaya menambah berkas
# migrasi baru tidak membatalkan cache layer npm install yang mahal itu.
COPY --chown=nextjs:nodejs prisma/migrations ./migrator/prisma/migrations

# --- entrypoint ------------------------------------------------------------
# Namanya sengaja BUKAN docker-entrypoint.sh: image resmi node sudah punya
# berkas dengan nama itu di /usr/local/bin, dan menimpanya bikin bingung.
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/merch-entrypoint.sh

# --- folder unggahan -------------------------------------------------------
# src/app/api/upload/route.ts menyimpan gambar ke:
#
#     path.join(process.cwd(), "public", "uploads")
#
# Proses aplikasi dijalankan sebagai `node server.js` dengan WORKDIR /app,
# jadi process.cwd() = /app dan folder tujuannya PERSIS /app/public/uploads.
# Itulah titik pasang (mount point) volume "uploads" di docker-compose.prod.yml.
#
# Foldernya SENGAJA dibuat di sini, kosong, dengan pemilik nextjs:nodejs.
# Alasannya: saat sebuah named volume BARU dipasang ke folder yang sudah ada di
# image, Docker menyalin isi DAN kepemilikan folder itu ke volume. Kalau folder
# ini tidak ada, Docker membuat titik pasangnya sebagai milik root:root dan
# aplikasi yang berjalan non-root gagal menulis (unggahan gambar error 500).
#
# .next/cache dibuat dengan alasan serupa: di situlah Next menyimpan hasil
# render ISR/fetch saat runtime.
RUN chmod +x /usr/local/bin/merch-entrypoint.sh \
    && mkdir -p /app/.next/cache /app/public/uploads /app/private-uploads /home/nextjs \
    && chown -R nextjs:nodejs /app/.next /app/public /app/private-uploads /home/nextjs \
    && chmod 755 /app/public/uploads /app/private-uploads /app/private-uploads

USER nextjs

EXPOSE 3000

# Cek kesehatan memakai endpoint khusus /api/health: 200 kalau aplikasi DAN
# database sehat, 503 kalau database tidak terjangkau.
# start-period memberi waktu untuk migrasi database sebelum penilaian dimulai.
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Entrypoint menjalankan migrasi dulu, lalu meng-exec CMD di bawah.
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/merch-entrypoint.sh"]
CMD ["node", "server.js"]
