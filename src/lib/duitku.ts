import "server-only";
import crypto from "node:crypto";

/**
 * Klien Duitku — alur POP (halaman checkout hosted Duitku).
 *
 * PENTING: sejak April 2026 Duitku memakai HMAC-SHA256 untuk SEMUA tanda
 * tangan. Contoh kode lama di internet yang memakai
 * `md5(merchantCode + merchantOrderId + paymentAmount + apiKey)` sudah usang
 * dan akan ditolak dengan "Wrong signature". Paket npm resmi `duitku` juga
 * terakhir dirilis 2023 (mendahului perubahan ini), sehingga modul ini
 * memanggil HTTP API secara langsung.
 *
 * Rujukan lengkap: docs/duitku-integration.md
 */

const IS_PRODUCTION = process.env.DUITKU_ENV === "production";

const ENDPOINTS = {
  createInvoice: IS_PRODUCTION
    ? "https://api-prod.duitku.com/api/merchant/createInvoice"
    : "https://api-sandbox.duitku.com/api/merchant/createInvoice",
  transactionStatus: IS_PRODUCTION
    ? "https://passport.duitku.com/webapi/api/merchant/transactionStatus"
    : "https://sandbox.duitku.com/webapi/api/merchant/transactionStatus",
} as const;

function getCredentials() {
  const merchantCode = process.env.DUITKU_MERCHANT_CODE;
  const apiKey = process.env.DUITKU_API_KEY;

  if (!merchantCode || !apiKey) {
    throw new Error(
      "Kredensial Duitku belum diisi. Set DUITKU_MERCHANT_CODE dan DUITKU_API_KEY di .env",
    );
  }
  return { merchantCode, apiKey };
}

/** Apakah integrasi Duitku sudah dikonfigurasi (untuk pesan ramah di UI). */
export function isDuitkuConfigured(): boolean {
  return Boolean(process.env.DUITKU_MERCHANT_CODE && process.env.DUITKU_API_KEY);
}

/** HMAC-SHA256 → hex huruf kecil. */
function sign(stringToSign: string, apiKey: string): string {
  return crypto.createHmac("sha256", apiKey).update(stringToSign).digest("hex");
}

/** Perbandingan tanda tangan yang tahan timing attack. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------- createInvoice

export type CreateInvoiceInput = {
  /** Kode pesanan kita; dikirim sebagai merchantOrderId dan kembali di webhook. */
  merchantOrderId: string;
  /** Total tagihan dalam rupiah (bilangan bulat). */
  paymentAmount: number;
  productDetails: string;
  email: string;
  customerName: string;
  phoneNumber?: string;
  callbackUrl: string;
  returnUrl: string;
  /** Masa berlaku tagihan dalam menit (default 60). */
  expiryPeriod?: number;
  itemDetails?: Array<{ name: string; price: number; quantity: number }>;
};

export type CreateInvoiceResult = {
  merchantCode: string;
  reference: string;
  paymentUrl: string;
  statusCode: string;
  statusMessage: string;
  raw: unknown;
};

/**
 * Membuat invoice di Duitku dan mengembalikan URL checkout hosted.
 * Tanda tangan dikirim lewat header: HMAC_SHA256(merchantCode + timestamp).
 */
export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const { merchantCode, apiKey } = getCredentials();
  const timestamp = Date.now().toString();
  const signature = sign(`${merchantCode}${timestamp}`, apiKey);

  const body = {
    paymentAmount: input.paymentAmount,
    merchantOrderId: input.merchantOrderId,
    productDetails: input.productDetails,
    email: input.email,
    customerVaName: input.customerName.slice(0, 20),
    phoneNumber: input.phoneNumber,
    callbackUrl: input.callbackUrl,
    returnUrl: input.returnUrl,
    expiryPeriod: input.expiryPeriod ?? 60,
    itemDetails: input.itemDetails,
    customerDetail: {
      firstName: input.customerName,
      email: input.email,
      phoneNumber: input.phoneNumber,
    },
  };

  const response = await fetch(ENDPOINTS.createInvoice, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-duitku-signature": signature,
      "x-duitku-timestamp": timestamp,
      "x-duitku-merchantcode": merchantCode,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Respons Duitku bukan JSON (HTTP ${response.status}): ${text.slice(0, 300)}`);
  }

  if (!response.ok || !data.paymentUrl) {
    const message = (data.statusMessage as string) ?? `HTTP ${response.status}`;
    throw new Error(`Gagal membuat invoice Duitku: ${message}`);
  }

  return {
    merchantCode: String(data.merchantCode ?? merchantCode),
    reference: String(data.reference ?? ""),
    paymentUrl: String(data.paymentUrl),
    statusCode: String(data.statusCode ?? ""),
    statusMessage: String(data.statusMessage ?? ""),
    raw: data,
  };
}

// -------------------------------------------------------------------- callback

export type DuitkuCallback = {
  merchantCode: string;
  amount: string;
  merchantOrderId: string;
  resultCode: string;
  reference: string | null;
  signature: string;
  paymentCode: string | null;
  publisherOrderId: string | null;
  settlementDate: string | null;
  raw: Record<string, string>;
};

/** Mengurai body webhook Duitku (application/x-www-form-urlencoded). */
export function parseCallback(form: FormData | URLSearchParams): DuitkuCallback | null {
  const get = (key: string) => {
    const value = form.get(key);
    return value === null ? null : String(value);
  };

  const merchantCode = get("merchantCode");
  const amount = get("amount");
  const merchantOrderId = get("merchantOrderId");
  const signature = get("signature");
  const resultCode = get("resultCode");

  if (!merchantCode || !amount || !merchantOrderId || !signature || !resultCode) {
    return null;
  }

  const raw: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    raw[key] = String(value);
  }

  return {
    merchantCode,
    amount,
    merchantOrderId,
    resultCode,
    reference: get("reference"),
    signature,
    paymentCode: get("paymentCode"),
    publisherOrderId: get("publisherOrderId"),
    settlementDate: get("settlementDate"),
    raw,
  };
}

/**
 * Memverifikasi tanda tangan webhook:
 *   HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey)
 *
 * Wajib dilakukan sebelum menyentuh database — tanpa ini siapa pun yang tahu
 * URL callback bisa memalsukan status "lunas".
 */
export function verifyCallbackSignature(callback: DuitkuCallback): boolean {
  const { merchantCode, apiKey } = getCredentials();

  if (callback.merchantCode !== merchantCode) return false;

  const expected = sign(
    `${callback.merchantCode}${callback.amount}${callback.merchantOrderId}`,
    apiKey,
  );
  return safeEqual(expected, callback.signature.toLowerCase());
}

/**
 * Duitku menyatakan sukses dengan resultCode "00".
 *
 * Kode kegagalan TIDAK konsisten antar bagian dokumentasi resmi (satu bagian
 * menyebut "01", bagian lain "02"), sehingga kita hanya mempercayai "00"
 * sebagai lunas dan memperlakukan nilai lain sebagai belum/gagal bayar.
 */
export function isCallbackSuccess(callback: DuitkuCallback): boolean {
  return callback.resultCode === "00";
}

/**
 * Kode yang benar-benar berarti "transaksi berakhir gagal/dibatalkan".
 *
 * Hanya "02" yang konsisten dipakai Duitku sebagai kode terminal (lihat tabel
 * returnUrl: `00` sukses, `01` pending/diproses, `02` batal/gagal). Perhatikan
 * `checkTransactionStatus()` juga memetakan "01" sebagai DIPROSES, bukan gagal.
 */
const TERMINAL_FAILURE_CODES = new Set(["02"]);

/**
 * Apakah callback ini kegagalan FINAL — satu-satunya kondisi yang boleh
 * memicu pelepasan kuota/stok.
 *
 * Kode non-"00" lain (mis. "01") berarti transaksi masih berjalan. Kalau kode
 * seperti itu diperlakukan sebagai gagal, kuota PO dilepas ke pembeli lain
 * padahal pembayaran masih mungkin masuk — dan begitu benar-benar masuk, stok
 * sudah habis (oversell yang tidak bisa dipulihkan).
 */
export function isCallbackTerminalFailure(callback: DuitkuCallback): boolean {
  return TERMINAL_FAILURE_CODES.has(callback.resultCode);
}

/** IP resmi Duitku — dipakai sebagai lapisan pengerasan opsional. */
export const DUITKU_CALLBACK_IPS = IS_PRODUCTION
  ? [
      "182.23.85.8", "182.23.85.9", "182.23.85.10", "182.23.85.13", "182.23.85.14",
      "103.177.101.184", "103.177.101.185", "103.177.101.186", "103.177.101.189", "103.177.101.190",
    ]
  : ["182.23.85.11", "182.23.85.12", "103.177.101.187", "103.177.101.188"];

/**
 * Apakah IP pengirim termasuk IP resmi Duitku.
 *
 * Sengaja hanya dipakai untuk PERINGATAN, bukan penolakan: proxy, load
 * balancer, atau tunnel (ngrok/Cloudflare) bisa mengubah IP asal sehingga
 * penolakan berbasis IP berisiko membuang callback yang sah. Verifikasi tanda
 * tangan HMAC tetap satu-satunya penentu keaslian.
 */
export function isKnownDuitkuIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  return DUITKU_CALLBACK_IPS.includes(ip.trim());
}

// ------------------------------------------------------------- status check

export type TransactionStatus = {
  statusCode: string;
  statusMessage: string;
  reference: string | null;
  amount: string | null;
  /** "00" sukses, "01" diproses, "02" gagal/batal. */
  isPaid: boolean;
};

/**
 * Menanyakan status transaksi langsung ke Duitku (sumber kebenaran kedua).
 * Dipakai untuk rekonsiliasi bila webhook terlewat atau kode kegagalannya ambigu.
 */
export async function checkTransactionStatus(merchantOrderId: string): Promise<TransactionStatus> {
  const { merchantCode, apiKey } = getCredentials();
  const signature = sign(`${merchantCode}${merchantOrderId}`, apiKey);

  const response = await fetch(ENDPOINTS.transactionStatus, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merchantCode, merchantOrderId, signature }),
    cache: "no-store",
  });

  const data = (await response.json()) as Record<string, unknown>;
  const statusCode = String(data.statusCode ?? "");

  return {
    statusCode,
    statusMessage: String(data.statusMessage ?? ""),
    reference: data.reference ? String(data.reference) : null,
    amount: data.amount ? String(data.amount) : null,
    isPaid: statusCode === "00",
  };
}
