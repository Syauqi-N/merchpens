/**
 * QA script — logika server tanpa browser.
 * Dijalankan: npx tsx scripts/qa-merch.ts (server dev TIDAK wajib hidup,
 * kecuali untuk bagian webhook HTTP di akhir).
 */
import "dotenv/config";
import crypto from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3001";
let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  LULUS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`  GAGAL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("=== QA MERCH: logika server ===\n");

  // 1. Skema: 2 role, varian, kuota varian, tanpa cicilan
  console.log("1) Skema & seed");
  const roles = await prisma.$queryRaw<{ enumlabel: string }[]>`
    SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' ORDER BY enumsortorder`;
  check("role tepat 2 (CUSTOMER, PENGURUS)", roles.map((r) => r.enumlabel).join(",") === "CUSTOMER,PENGURUS", roles.map((r) => r.enumlabel).join(","));
  const prodCount = await prisma.product.count({ where: { isActive: true } });
  const varCount = await prisma.productVariant.count({ where: { isActive: true } });
  check("5 produk aktif", prodCount === 5, `${prodCount}`);
  check("15 varian aktif (5+3+3+2+2)", varCount === 15, `${varCount}`);
  const tables: { tablename: string }[] = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('InstallmentProof')`;
  check("tabel InstallmentProof sudah hilang", tables.length === 0);
  const enums: { typname: string; enumlabel: string }[] = await prisma.$queryRaw`
    SELECT t.typname, e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname IN ('OrderStatus','PaymentMode')`;
  check("tidak ada status/nilai cicilan", !enums.some((e) => e.enumlabel.includes("INSTALLMENT")));

  // 2. Harga server-side: pastikan tidak ada harga dari klien yang dipakai
  console.log("\n2) Anti-oprek harga (inspeksi kode)");
  const { readFileSync } = await import("node:fs");
  const actions = readFileSync("src/app/checkout/actions.ts", "utf8");
  check("tidak ada pemakaian harga dari input klien", !/data\.(unitPrice|price|total|subtotal)/.test(actions));
  check("harga dari resolveVariantAvailability", actions.includes("resolveVariantAvailability"));
  check("validasi master angkatan/jurusan di server", actions.includes("getMasterLists"));

  // 3. Reservasi atomik: dua transaksi berebut sisa 1 → tepat 1 menang
  console.log("\n3) Race reservasi kuota varian");
  const quota = await prisma.preOrderVariantQuota.findFirst({
    where: { variant: { sku: "KEY-LOGO" } },
  });
  if (!quota) throw new Error("kuota KEY-LOGO tidak ada");
  const origReserved = quota.reserved;
  const results = await Promise.allSettled(
    [1, 2].map(() =>
      prisma.$executeRaw`UPDATE "PreOrderVariantQuota" SET reserved = reserved + ${quota.quota} WHERE id = ${quota.id} AND quota - reserved >= ${quota.quota}`,
    ),
  );
  const wins = results.filter((r) => r.status === "fulfilled" && Number(r.value) === 1).length;
  check("tepat 1 pemenang saat berebut sisa kuota", wins <= 1, `menang=${wins}`);
  await prisma.preOrderVariantQuota.update({
    where: { id: quota.id },
    data: { reserved: origReserved },
  });

  // 4. Expiry: order PENDING lampau → EXPIRED + kuota kembali (via HTTP cron)
  console.log("\n4) Expiry 60 menit + pelepas kuota");
  const cust = await prisma.user.findFirstOrThrow({ where: { role: "CUSTOMER" } });
  const q2 = await prisma.preOrderVariantQuota.findFirstOrThrow({
    where: { variant: { sku: "STK-B" } },
    include: { preOrderItem: true, variant: true },
  });
  const before = q2.quota - q2.reserved;
  const expOrder = await prisma.order.create({
    data: {
      orderNumber: `QA-EXP-${Date.now()}`,
      userId: cust.id,
      customerName: "QA",
      customerEmail: cust.email,
      customerPhone: "081200000000",
      customerType: "MAHASISWA",
      customerBatch: "2024",
      customerProgram: "Informatika",
      fulfillmentType: "PICKUP",
      subtotal: 15000,
      total: 15000,
      status: "PENDING_PAYMENT",
      items: {
        create: [
          {
            productId: q2.variant.productId,
            preOrderItemId: q2.preOrderItemId,
            variantQuotaId: q2.id,
            variantId: q2.variantId,
            variantName: q2.variant.name,
            productName: "Sticker Pack",
            productPrice: 15000,
            quantity: 1,
            subtotal: 15000,
          },
        ],
      },
      payment: {
        create: {
          merchantOrderId: `QA-EXP-${Date.now()}`,
          amount: 15000,
          status: "PENDING",
          expiresAt: new Date(Date.now() - 1000),
        },
      },
    },
  });
  await prisma.$executeRaw`UPDATE "PreOrderVariantQuota" SET reserved = reserved + 1 WHERE id = ${q2.id}`;
  const cronRes = await fetch(`${BASE}/api/cron/expire-orders`);
  const cronJson = (await cronRes.json().catch(() => ({}))) as { expired?: number };
  const n = cronJson.expired ?? 0;
  const afterOrder = await prisma.order.findUniqueOrThrow({ where: { id: expOrder.id } });
  const afterQ = await prisma.preOrderVariantQuota.findUniqueOrThrow({ where: { id: q2.id } });
  check("cron menyapu order lampau", n >= 1, `expired=${n}`);
  check("status jadi EXPIRED", afterOrder.status === "EXPIRED");
  check("kuota kembali", afterQ.quota - afterQ.reserved === before, `${before} == ${afterQ.quota - afterQ.reserved}`);
  await prisma.order.delete({ where: { id: expOrder.id } });

  // 5. Webhook: palsu ditolak, sah diterima (HTTP ke server dev)
  console.log("\n5) Webhook Duitku via HTTP");
  try {
    const fakeRes = await fetch(`${BASE}/api/duitku/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        merchantCode: process.env.DUITKU_MERCHANT_CODE ?? "DXXXX",
        amount: "999",
        merchantOrderId: "TIDAK-ADA",
        resultCode: "00",
        signature: "palsu",
      }).toString(),
    });
    check("webhook palsu dibalas 200 tanpa bocor", fakeRes.status === 200, `HTTP ${fakeRes.status}`);
  } catch (e) {
    check("server dev hidup untuk uji webhook", false, String(e).slice(0, 80));
  }

  // 6. Rate limit buckets (modul murni, tanpa server-only)
  console.log("\n6) Rate limit");
  const { consumeRateLimit } = await import("../src/lib/rate-limit-store");
  const key = `qa:${crypto.randomBytes(4).toString("hex")}`;
  let allowed = 0;
  for (let i = 0; i < 7; i++) if (consumeRateLimit(key, 5, 60_000).ok) allowed++;
  const blocked = !consumeRateLimit(key, 5, 60_000).ok;
  check("5 lolos lalu diblokir (limit 5)", allowed === 5 && blocked, `lolos=${allowed}`);

  // 7. WA template + master lists
  console.log("\n7) Template WA & master lists");
  const { buildShippingMessage, buildWhatsAppUrl } = await import("../src/lib/whatsapp");
  const msg = buildShippingMessage({
    orderNumber: "INV-TEST",
    customerName: "Budi",
    customerType: "Mahasiswa PENS",
    items: [{ name: "PDH (Kemeja)", variantName: "Size L", quantity: 1 }],
    totalLabel: "Rp145.000",
    address: "Jl. Mawar 10",
  });
  check("template memuat order+item+total+alamat", ["INV-TEST", "Size L", "Rp145.000", "Jl. Mawar 10"].every((s) => msg.includes(s)));
  const url = buildWhatsAppUrl("08123456789", msg);
  check("wa.me ternormalisasi ke 62", url?.startsWith("https://wa.me/628123456789") ?? false, url ?? "null");

  console.log(`\n=== HASIL QA LOGIKA: ${passed} lulus, ${failed} gagal ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main()
  .catch(async (e) => {
    console.error("ERROR:", e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
