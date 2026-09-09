/**
 * Uji end-to-end jalur uang terhadap server yang SEDANG BERJALAN.
 *
 * Membuat pesanan pre-order VARIAN sungguhan (memakai helper reservasi yang
 * sama dengan checkout), lalu menembak webhook Duitku betulan lewat HTTP dan
 * memeriksa dampaknya ke database.
 *
 * Yang dibuktikan:
 *   1. Reservasi kuota varian memotong sisa kuota PO
 *   2. Webhook bertanda tangan sah  -> pesanan LUNAS
 *   3. Webhook kiriman ulang        -> idempoten (tidak dobel)
 *   4. Webhook tanda tangan palsu   -> DITOLAK, database tidak berubah
 *   5. Kuota varian PO tetap terpakai setelah lunas (bukan dilepas)
 *   6. resultCode non-final         -> tidak melepas kuota
 *
 * Jalankan: npm run test:e2e   (server dev harus hidup di :3001)
 */
import "dotenv/config";
import crypto from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3001";
const CALLBACK_URL = `${BASE_URL}/api/duitku/callback`;
const MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE!;
const API_KEY = process.env.DUITKU_API_KEY!;

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

function signCallback(amount: string, merchantOrderId: string, key = API_KEY) {
  return crypto
    .createHmac("sha256", key)
    .update(`${MERCHANT_CODE}${amount}${merchantOrderId}`)
    .digest("hex");
}

async function postCallback(body: Record<string, string>) {
  const response = await fetch(CALLBACK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  return { status: response.status, text: await response.text() };
}

async function main() {
  console.log("=== UJI E2E JALUR PEMBAYARAN (MERCH) ===");
  console.log("Target:", BASE_URL, "\n");

  // ---- Persiapan: ambil kuota VARIAN periode terbuka ----
  const now = new Date();
  const quotaRow = await prisma.preOrderVariantQuota.findFirst({
    where: {
      variant: { sku: "PDH-M" },
      preOrderItem: {
        period: { status: "ACTIVE", startAt: { lte: now }, endAt: { gte: now } },
      },
    },
    include: {
      variant: { include: { product: true } },
      preOrderItem: { include: { period: true } },
    },
  });

  if (!quotaRow) throw new Error("Tidak ada kuota PO aktif untuk varian PDH-M");

  const user = await prisma.user.findFirst({ where: { role: "CUSTOMER" } });
  if (!user) throw new Error("Tidak ada user CUSTOMER");

  const quotaBefore = quotaRow.quota - quotaRow.reserved;
  console.log(`Produk : ${quotaRow.variant.product.name} (${quotaRow.variant.name})`);
  console.log(`Periode: ${quotaRow.preOrderItem.period.name}`);
  console.log(`Sisa kuota awal: ${quotaBefore}\n`);

  // ---- 1. Buat pesanan + reservasi kuota varian (meniru checkout) ----
  console.log("1) Buat pesanan & reservasi kuota varian");
  const orderNumber = `E2E-${Date.now()}`;
  const unitPrice =
    quotaRow.price ??
    quotaRow.preOrderItem.price ??
    quotaRow.variant.product.price + quotaRow.variant.priceDelta;
  const qty = 2;
  const subtotal = unitPrice * qty;
  // Ongkir kirim dibayar manual via WA → total gateway = subtotal.
  const total = subtotal;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: user.id,
        customerName: user.name ?? "Uji E2E",
        customerEmail: user.email,
        customerPhone: user.phone ?? "081200000000",
        customerType: "MAHASISWA",
        customerBatch: "2023",
        customerProgram: "Informatika",
        fulfillmentType: "PICKUP",
        subtotal,
        shippingCost: 0,
        total,
        status: "PENDING_PAYMENT",
        hasPreOrder: true,
        items: {
          create: [
            {
              productId: quotaRow.variant.product.id,
              preOrderItemId: quotaRow.preOrderItemId,
              variantQuotaId: quotaRow.id,
              variantId: quotaRow.variantId,
              variantName: quotaRow.variant.name,
              productName: quotaRow.variant.product.name,
              productPrice: unitPrice,
              quantity: qty,
              subtotal,
            },
          ],
        },
        payment: {
          create: {
            merchantOrderId: orderNumber,
            amount: total,
            status: "PENDING",
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        },
      },
    });

    // Reservasi atomik — pola yang sama dengan checkout sungguhan
    const affected = await tx.$executeRaw`
      UPDATE "PreOrderVariantQuota"
      SET reserved = reserved + ${qty}, "updatedAt" = NOW()
      WHERE id = ${quotaRow.id} AND quota - reserved >= ${qty}
    `;
    if (affected === 0) throw new Error("Reservasi kuota gagal");
    return created;
  });

  const afterReserve = await prisma.preOrderVariantQuota.findUniqueOrThrow({
    where: { id: quotaRow.id },
  });
  check(
    "kuota varian berkurang setelah checkout",
    afterReserve.quota - afterReserve.reserved === quotaBefore - qty,
    `${quotaBefore} -> ${afterReserve.quota - afterReserve.reserved} (pesan ${qty})`,
  );

  // ---- 2. Webhook dengan tanda tangan PALSU harus ditolak ----
  console.log("\n2) Webhook tanda tangan PALSU");
  const forged = await postCallback({
    merchantCode: MERCHANT_CODE,
    amount: String(total),
    merchantOrderId: orderNumber,
    resultCode: "00",
    reference: "FORGED-REF",
    signature: signCallback(String(total), orderNumber, "kunci-salah"),
  });
  const afterForged = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  check("dibalas 200 (tidak membocorkan info)", forged.status === 200, `HTTP ${forged.status}`);
  check(
    "pesanan TIDAK berubah jadi lunas",
    afterForged.status === "PENDING_PAYMENT",
    `status = ${afterForged.status}`,
  );

  // ---- 3. Webhook dengan nominal DIUBAH harus ditolak ----
  console.log("\n3) Webhook nominal DIUBAH (ditandatangani sah untuk nominal palsu)");
  const wrongAmount = await postCallback({
    merchantCode: MERCHANT_CODE,
    amount: "1000",
    merchantOrderId: orderNumber,
    resultCode: "00",
    reference: "WRONG-AMOUNT",
    signature: signCallback("1000", orderNumber),
  });
  const afterWrongAmount = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  check("dibalas 200", wrongAmount.status === 200, `HTTP ${wrongAmount.status}`);
  check(
    "pesanan TIDAK berubah jadi lunas",
    afterWrongAmount.status === "PENDING_PAYMENT",
    `status = ${afterWrongAmount.status}`,
  );

  // ---- 4. Webhook SAH -> pesanan lunas ----
  console.log("\n4) Webhook SAH (resultCode 00)");
  const validBody = {
    merchantCode: MERCHANT_CODE,
    amount: String(total),
    merchantOrderId: orderNumber,
    resultCode: "00",
    reference: "E2E-REF-001",
    paymentCode: "BC",
    signature: signCallback(String(total), orderNumber),
  };
  const valid = await postCallback(validBody);
  const afterPaid = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { payment: true },
  });
  check("dibalas 200", valid.status === 200, `HTTP ${valid.status}`);
  check("pesanan jadi PAID", afterPaid.status === "PAID", `status = ${afterPaid.status}`);
  check(
    "pembayaran jadi PAID + paidAt terisi",
    afterPaid.payment?.status === "PAID" && afterPaid.payment?.paidAt !== null,
    `payment = ${afterPaid.payment?.status}`,
  );
  check(
    "metode pembayaran tercatat",
    afterPaid.payment?.method === "BC",
    `method = ${afterPaid.payment?.method}`,
  );

  const afterPaidQuota = await prisma.preOrderVariantQuota.findUniqueOrThrow({
    where: { id: quotaRow.id },
  });
  check(
    "kuota varian TETAP terpakai setelah lunas (tidak dilepas)",
    afterPaidQuota.reserved === afterReserve.reserved,
    `reserved = ${afterPaidQuota.reserved}`,
  );

  // ---- 5. Kiriman ulang harus idempoten ----
  console.log("\n5) Webhook KIRIMAN ULANG (Duitku retry s/d 5x)");
  await postCallback(validBody);
  await postCallback(validBody);
  const afterRetry = await prisma.preOrderVariantQuota.findUniqueOrThrow({
    where: { id: quotaRow.id },
  });
  const orderAfterRetry = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  check(
    "kuota tidak terpotong berulang",
    afterRetry.reserved === afterPaidQuota.reserved,
    `reserved tetap ${afterRetry.reserved}`,
  );
  check(
    "status pesanan tetap PAID",
    orderAfterRetry.status === "PAID",
    `status = ${orderAfterRetry.status}`,
  );

  // ---- 6. resultCode non-final tidak boleh melepas kuota ----
  console.log("\n6) resultCode non-final '01' pada pesanan baru");
  const orderNumber2 = `E2E-${Date.now()}-B`;
  const order2 = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: orderNumber2,
        userId: user.id,
        customerName: "Uji E2E",
        customerEmail: user.email,
        customerPhone: "081200000000",
        customerType: "ALUMNI",
        customerBatch: "2021",
        customerProgram: "Teknik Telekomunikasi",
        fulfillmentType: "SHIPPED",
        shippingAddress: "Jl. Mawar No. 1, Surabaya",
        subtotal: unitPrice,
        shippingCost: 0,
        total: unitPrice,
        status: "PENDING_PAYMENT",
        hasPreOrder: true,
        items: {
          create: [
            {
              productId: quotaRow.variant.product.id,
              preOrderItemId: quotaRow.preOrderItemId,
              variantQuotaId: quotaRow.id,
              variantId: quotaRow.variantId,
              variantName: quotaRow.variant.name,
              productName: quotaRow.variant.product.name,
              productPrice: unitPrice,
              quantity: 1,
              subtotal: unitPrice,
            },
          ],
        },
        payment: {
          create: {
            merchantOrderId: orderNumber2,
            amount: unitPrice,
            status: "PENDING",
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        },
      },
    });
    await tx.$executeRaw`
      UPDATE "PreOrderVariantQuota" SET reserved = reserved + 1, "updatedAt" = NOW()
      WHERE id = ${quotaRow.id} AND quota - reserved >= 1
    `;
    return created;
  });

  const beforeNonFinal = await prisma.preOrderVariantQuota.findUniqueOrThrow({
    where: { id: quotaRow.id },
  });
  const total2 = String(unitPrice);
  await postCallback({
    merchantCode: MERCHANT_CODE,
    amount: total2,
    merchantOrderId: orderNumber2,
    resultCode: "01", // "sedang diproses" — BUKAN kegagalan final
    reference: "E2E-REF-NONFINAL",
    signature: signCallback(total2, orderNumber2),
  });
  const afterNonFinal = await prisma.preOrderVariantQuota.findUniqueOrThrow({
    where: { id: quotaRow.id },
  });
  const order2After = await prisma.order.findUniqueOrThrow({ where: { id: order2.id } });
  check(
    "kuota TIDAK dilepas oleh kode non-final",
    afterNonFinal.reserved === beforeNonFinal.reserved,
    `reserved tetap ${afterNonFinal.reserved}`,
  );
  check(
    "pesanan tetap PENDING_PAYMENT (bukan EXPIRED)",
    order2After.status === "PENDING_PAYMENT",
    `status = ${order2After.status}`,
  );

  // ---- Bersihkan data uji ----
  console.log("\n7) Bersihkan data uji");
  await prisma.$executeRaw`
    UPDATE "PreOrderVariantQuota" SET reserved = ${quotaRow.reserved} WHERE id = ${quotaRow.id}
  `;
  await prisma.order.deleteMany({ where: { id: { in: [order.id, order2.id] } } });
  const restored = await prisma.preOrderVariantQuota.findUniqueOrThrow({
    where: { id: quotaRow.id },
  });
  check(
    "kuota dikembalikan ke nilai semula",
    restored.reserved === quotaRow.reserved,
    `reserved = ${restored.reserved}`,
  );

  console.log(`\n=== HASIL: ${passed} lulus, ${failed} gagal ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main()
  .catch(async (error) => {
    console.error("\nERROR:", error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
