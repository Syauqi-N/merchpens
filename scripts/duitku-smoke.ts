/**
 * Uji cepat integrasi Duitku tanpa menjalankan aplikasi.
 *
 * Membuat satu invoice percobaan di lingkungan yang diset pada DUITKU_ENV,
 * lalu memverifikasi ulang logika tanda tangan webhook. Berguna untuk
 * memastikan kredensial benar dan tanda tangan HMAC-SHA256 cocok sebelum
 * menelusuri masalah di level aplikasi.
 *
 * Jalankan: npm run duitku:smoke
 */
import "dotenv/config";
import crypto from "node:crypto";
import { createInvoice, parseCallback, verifyCallbackSignature } from "../src/lib/duitku";

function mask(value: string | undefined) {
  if (!value) return "(kosong)";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function main() {
  const merchantCode = process.env.DUITKU_MERCHANT_CODE;
  const apiKey = process.env.DUITKU_API_KEY;

  console.log("=== Konfigurasi ===");
  console.log("  DUITKU_ENV          :", process.env.DUITKU_ENV ?? "(kosong)");
  console.log("  DUITKU_MERCHANT_CODE:", merchantCode || "(kosong)");
  console.log("  DUITKU_API_KEY      :", mask(apiKey));
  console.log("  CALLBACK_URL        :", process.env.DUITKU_CALLBACK_URL ?? "(kosong)");
  console.log("  RETURN_URL          :", process.env.DUITKU_RETURN_URL ?? "(kosong)");

  if (!merchantCode || !apiKey) {
    console.error("\nGagal: DUITKU_MERCHANT_CODE / DUITKU_API_KEY belum diisi di .env");
    process.exit(1);
  }

  // ---- 1. Buat invoice percobaan ----
  const merchantOrderId = `SMOKE-${Date.now()}`;
  console.log("\n=== 1. createInvoice ===");
  console.log("  merchantOrderId:", merchantOrderId);

  const invoice = await createInvoice({
    merchantOrderId,
    paymentAmount: 185000,
    productDetails: "Uji coba - Gunting Mahkota",
    email: "uji@dentalstore.local",
    customerName: "Uji Coba",
    phoneNumber: "081200000000",
    callbackUrl:
      process.env.DUITKU_CALLBACK_URL ?? "https://example.com/api/duitku/callback",
    returnUrl: process.env.DUITKU_RETURN_URL ?? "https://example.com/checkout/selesai",
    expiryPeriod: 60,
    itemDetails: [{ name: "Gunting Mahkota", price: 185000, quantity: 1 }],
  });

  console.log("  statusCode :", invoice.statusCode, invoice.statusMessage);
  console.log("  reference  :", invoice.reference);
  console.log("  paymentUrl :", invoice.paymentUrl);

  // ---- 2. Verifikasi logika tanda tangan webhook ----
  // Membuat payload callback tiruan yang ditandatangani seperti Duitku,
  // lalu memastikan verifier kita menerimanya (dan menolak yang dipalsukan).
  console.log("\n=== 2. Verifikasi tanda tangan webhook ===");
  const amount = "185000";
  const validSignature = crypto
    .createHmac("sha256", apiKey)
    .update(`${merchantCode}${amount}${merchantOrderId}`)
    .digest("hex");

  const form = new URLSearchParams({
    merchantCode,
    amount,
    merchantOrderId,
    resultCode: "00",
    reference: invoice.reference,
    signature: validSignature,
  });

  const callback = parseCallback(form);
  if (!callback) {
    console.error("  GAGAL: parseCallback mengembalikan null");
    process.exit(1);
  }
  const accepted = verifyCallbackSignature(callback);
  console.log("  tanda tangan sah diterima  :", accepted ? "YA (benar)" : "TIDAK (BUG!)");

  const tampered = parseCallback(
    new URLSearchParams({ ...Object.fromEntries(form), amount: "1000" }),
  );
  const rejected = tampered ? !verifyCallbackSignature(tampered) : false;
  console.log("  callback palsu ditolak     :", rejected ? "YA (benar)" : "TIDAK (BUG!)");

  const ok = Boolean(invoice.paymentUrl) && accepted && rejected;
  console.log(`\n=== HASIL: ${ok ? "SEMUA LULUS" : "ADA MASALAH"} ===`);
  if (ok) {
    console.log("Buka paymentUrl di browser untuk mencoba membayar di sandbox.");
  }
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error("\nGagal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
