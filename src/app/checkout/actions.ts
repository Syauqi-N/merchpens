"use server";

import crypto from "node:crypto";

import { headers } from "next/headers";

import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import {
  checkTransactionStatus,
  createInvoice,
  isDuitkuConfigured,
} from "@/lib/duitku";
import {
  InsufficientStockError,
  expireOverdueOrders,
  releaseOrderReservations,
  reserveForOrder,
  type ReservationLine,
  type TxClient,
} from "@/lib/inventory";
import {
  openPeriodWhere,
  resolveVariantAvailability,
  unavailableLabel,
} from "@/lib/preorder";
import { settleOrderAsPaid } from "@/lib/order-settlement";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimitedMessage } from "@/lib/rate-limit";
import { getMasterLists, getSetting } from "@/lib/settings";
import { CURRENT_TERMS_VERSION } from "@/lib/transaction-terms";
import {
  checkoutSchema,
  type CheckoutFieldName,
  type CheckoutResult,
} from "./schemas";

/** Masa berlaku bisnis pesanan sebelum kuota dilepas kembali: 60 menit. */
const ORDER_PAYMENT_EXPIRY_MINUTES = 60;

/**
 * Masa berlaku teknis satu tautan Duitku.
 *
 * Disamakan dengan batas pesanan (60 menit) — tautan yang kedaluwarsa lebih
 * awal dari pesanan hanya membingungkan pembeli. Tautan dapat dibuat ulang
 * dari halaman detail selama pesanan masih PENDING_PAYMENT.
 */
const DUITKU_LINK_EXPIRY_MINUTES = 60;

/**
 * Membuat pesanan lalu tagihan Duitku.
 *
 * Urutan langkahnya penting dan sengaja seperti ini:
 *
 *  1. Otorisasi DI DALAM action (Server Action bisa dipanggil lewat POST
 *     langsung, jadi tidak boleh bergantung pada penjagaan di halaman).
 *  2. Validasi bentuk input dengan zod + keanggotaan angkatan/jurusan
 *     terhadap master di database.
 *  3. Ambil ULANG produk/varian/kuota dari database — harga dari klien tidak
 *     pernah dipercaya.
 *  4. Satu transaksi: Order + OrderItem + Payment + `reserveForOrder()`.
 *     Reservasi memakai UPDATE bersyarat sehingga database yang menjadi wasit
 *     saat dua pembeli berebut sisa kuota terakhir.
 *  5. `createInvoice()` dipanggil DI LUAR transaksi (panggilan HTTP eksternal
 *     tidak boleh menahan koneksi/lock database).
 *  6. Bila pembuatan tagihan gagal, reservasi dilepas kembali lalu pesanan
 *     ditandai CANCELLED — TAPI hanya bila pelepasannya berhasil. Kalau gagal,
 *     pesanan dibiarkan PENDING_PAYMENT agar cron kedaluwarsa yang menuntaskan;
 *     CANCELLED dengan kuota yang belum kembali tidak punya jalur pemulihan.
 */
export async function createOrderAndPay(input: unknown): Promise<CheckoutResult> {
  // ---- 1. Otorisasi ------------------------------------------------------
  let userId: string;
  try {
    const session = await requireUser();
    const id = session.user?.id;
    if (!id) throw new Error("UNAUTHENTICATED");
    userId = id;
  } catch {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Sesi kamu sudah berakhir. Silakan masuk kembali untuk melanjutkan.",
    };
  }

  // ---- 2. Validasi input -------------------------------------------------
  // Checkout = transaksi DB berat → batasi 20x/menit/akun (fallback IP).
  const checkoutLimit = consumeRateLimit(`checkout:${userId}`, 20, 60_000);
  if (!checkoutLimit.ok) {
    return {
      ok: false,
      code: "VALIDATION",
      message: rateLimitedMessage(checkoutLimit.retryAfterMs),
    };
  }

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<CheckoutFieldName, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && key !== "items" && !(key in fieldErrors)) {
        fieldErrors[key as CheckoutFieldName] = issue.message;
      }
    }
    const itemsIssue = parsed.error.issues.find((issue) => issue.path[0] === "items");

    return {
      ok: false,
      code: itemsIssue ? "EMPTY_CART" : "VALIDATION",
      message: itemsIssue
        ? itemsIssue.message
        : "Periksa kembali data diri yang kamu isi.",
      fieldErrors,
    };
  }

  const data = parsed.data;

  if (!isDuitkuConfigured()) {
    return {
      ok: false,
      code: "PAYMENT",
      message:
        "Pembayaran online belum dikonfigurasi. Hubungi admin untuk menyelesaikan pesanan.",
    };
  }

  // Angkatan & jurusan wajib cocok dengan master — dropdown klien tidak dipercaya.
  const master = await getMasterLists();
  if (!master.angkatan.includes(data.customerBatch)) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Angkatan yang dipilih tidak valid. Muat ulang halaman lalu coba lagi.",
      fieldErrors: { customerBatch: "Pilih angkatan dari daftar yang tersedia" },
    };
  }
  if (!master.jurusan.includes(data.customerProgram)) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Jurusan yang dipilih tidak valid. Muat ulang halaman lalu coba lagi.",
      fieldErrors: { customerProgram: "Pilih jurusan dari daftar yang tersedia" },
    };
  }

  // Gabungkan baris ganda dari kuota varian yang sama.
  const requested = new Map<
    string,
    { productId: string; variantId: string; variantQuotaId: string; quantity: number }
  >();
  for (const item of data.items) {
    const existing = requested.get(item.variantQuotaId);
    requested.set(item.variantQuotaId, {
      productId: item.productId,
      variantId: item.variantId,
      variantQuotaId: item.variantQuotaId,
      quantity: (existing?.quantity ?? 0) + item.quantity,
    });
  }

  const now = new Date();

  // Lepaskan kuota yang masih dipegang pesanan mati sebelum menghitung sisa.
  try {
    await expireOverdueOrders(now);
  } catch (error) {
    console.error("[checkout] gagal menyapu pesanan kedaluwarsa:", error);
  }

  try {
    // ---- 3. Ambil produk terkini (SUMBER HARGA SATU-SATUNYA) -------------
    const requestedLines = [...requested.values()];
    const products = await prisma.product.findMany({
      where: {
        id: { in: [...new Set(requestedLines.map((line) => line.productId))] },
      },
      include: {
        variants: true,
        preOrderItems: {
          where: { period: openPeriodWhere(now) },
          include: {
            period: true,
            variantQuotas: {
              where: {
                id: {
                  in: [...new Set(requestedLines.map((line) => line.variantQuotaId))],
                },
              },
              include: { variant: true },
            },
          },
        },
      },
    });

    const byId = new Map(products.map((product) => [product.id, product]));

    const itemMessages: string[] = [];
    const orderItems: Prisma.OrderItemCreateManyOrderInput[] = [];
    const reservations: ReservationLine[] = [];
    let subtotal = 0;

    for (const { productId, variantId, variantQuotaId, quantity } of requestedLines) {
      const product = byId.get(productId);

      if (!product || !product.isActive) {
        itemMessages.push("Salah satu produk sudah tidak tersedia di katalog.");
        continue;
      }

      const variant = product.variants.find((v) => v.id === variantId);
      if (!variant || !variant.isActive) {
        itemMessages.push(`${product.name}: varian yang dipilih sudah tidak tersedia.`);
        continue;
      }

      const quotaRow = product.preOrderItems
        .flatMap((item) => item.variantQuotas.map((row) => ({ row, item })))
        .find(({ row }) => row.id === variantQuotaId && row.variantId === variant.id);

      if (!quotaRow) {
        itemMessages.push(
          `${product.name} (${variant.name}): periode PO yang dipilih sudah tidak tersedia.`,
        );
        continue;
      }

      const availability = resolveVariantAvailability(
        product,
        variant,
        { ...quotaRow.row, preOrderItem: quotaRow.item },
        now,
      );

      // `variantQuotaId` selalu terisi ketika `canOrder` true — baris kuota
      // itulah yang membuat varian bisa dipesan. Bila ternyata kosong, ada
      // yang tidak beres; jangan pernah membuat pesanan tanpa baris kuota
      // yang bisa direservasi (dan dikembalikan bila pesanan batal).
      if (!availability.canOrder || !availability.variantQuotaId) {
        const reason = unavailableLabel(availability.reason);
        itemMessages.push(`${product.name} (${variant.name}): ${reason}.`);
        continue;
      }

      if (quantity > availability.available) {
        itemMessages.push(
          `Kuota pre-order untuk ${product.name} (${variant.name}) tinggal ${availability.available} ${product.unit}.`,
        );
        continue;
      }

      const unitPrice = availability.effectivePrice;
      const lineSubtotal = unitPrice * quantity;
      subtotal += lineSubtotal;

      orderItems.push({
        productId: product.id,
        preOrderItemId: availability.preOrderItemId,
        variantQuotaId: availability.variantQuotaId,
        variantId: variant.id,
        variantName: variant.name,
        productName: product.name,
        productPrice: unitPrice,
        quantity,
        subtotal: lineSubtotal,
      });

      reservations.push({
        productId: product.id,
        productName: product.name,
        variantName: variant.name,
        variantQuotaId: availability.variantQuotaId,
        quantity,
      });
    }

    // Ada item yang bermasalah → jangan buat pesanan setengah jadi.
    if (itemMessages.length > 0) {
      return {
        ok: false,
        code: "AVAILABILITY",
        message:
          "Ketersediaan beberapa item berubah. Periksa keranjang lalu coba lagi.",
        itemMessages,
      };
    }

    if (orderItems.length === 0) {
      return {
        ok: false,
        code: "EMPTY_CART",
        message: "Keranjang kosong. Tambahkan produk terlebih dahulu.",
      };
    }

    // Ongkir kirim dibayar MANUAL via WhatsApp admin → tidak masuk total gateway.
    const total = subtotal;
    const expiresAt = new Date(
      now.getTime() + ORDER_PAYMENT_EXPIRY_MINUTES * 60_000,
    );

    // ---- 4. Transaksi: pesanan + reservasi kuota -------------------------
    const created = await createOrderWithReservation({
      userId,
      data: {
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        customerType: data.customerType,
        customerBatch: data.customerBatch,
        customerProgram: data.customerProgram,
        fulfillmentType: data.fulfillmentType,
        shippingAddress:
          data.fulfillmentType === "SHIPPED" ? (data.shippingAddress?.trim() ?? "") : "",
        note: data.note,
        termsAccepted: data.termsAccepted,
      },
      orderItems,
      reservations,
      subtotal,
      total,
      expiresAt,
    });

    // ---- 5. Tagihan Duitku (DI LUAR transaksi) ---------------------------
    const storeName = await getSetting("store_name", "Merch PENS");
    const paymentUrls = await resolvePaymentUrls();

    // PENTING (diverifikasi terhadap sandbox Duitku, Jul 2026): Duitku
    // memvalidasi `sum(itemDetails[].price) === paymentAmount` dan MENGABAIKAN
    // `quantity` dalam perhitungan itu. Jadi `price` harus diisi TOTAL PER BARIS
    // (harga satuan x jumlah), bukan harga satuan — mengirim harga satuan untuk
    // baris berjumlah >1 membuat createInvoice ditolak dengan HTTP 400.
    const itemDetails = orderItems.map((item) => ({
      name: `${item.productName}${item.variantName ? ` (${item.variantName})` : ""}`.slice(0, 50),
      price: item.subtotal,
      quantity: item.quantity,
    }));

    try {
      const invoice = await createInvoice({
        merchantOrderId: created.orderNumber,
        paymentAmount: total,
        productDetails: `Pesanan ${created.orderNumber} - ${storeName}`.slice(0, 100),
        email: data.customerEmail,
        customerName: data.customerName,
        phoneNumber: data.customerPhone,
        callbackUrl: paymentUrls.callbackUrl,
        returnUrl: paymentUrls.returnUrl,
        expiryPeriod: DUITKU_LINK_EXPIRY_MINUTES,
        itemDetails,
      });

      await prisma.payment.update({
        where: { id: created.paymentId },
        data: {
          paymentUrl: invoice.paymentUrl,
          reference: invoice.reference || null,
          rawResponse: invoice.raw as Prisma.InputJsonValue,
          invoiceExpiresAt: new Date(
            Date.now() + DUITKU_LINK_EXPIRY_MINUTES * 60_000,
          ),
        },
      });

      return {
        ok: true,
        orderNumber: created.orderNumber,
        flow: "DUITKU",
        paymentUrl: invoice.paymentUrl,
      };
    } catch (error) {
      // ---- 6. Gagal bikin tagihan → kembalikan kuota & batalkan pesanan --
      console.error(
        `[checkout] gagal membuat tagihan Duitku untuk ${created.orderNumber}:`,
        error instanceof Error ? error.message : error,
      );

      // Urutannya WAJIB: lepas reservasi DULU, baru ubah status.
      //
      // Bila urutannya dibalik (atau statusnya diubah walau pelepasan gagal),
      // pesanan berakhir CANCELLED dengan `stockReleasedAt` masih NULL — dan
      // tidak ada yang bisa menyelamatkannya: cron kedaluwarsa hanya menyapu
      // status PENDING_PAYMENT, sedangkan pembatalan admin menolak pesanan yang
      // sudah CANCELLED. Kuota PO-nya hilang selamanya.
      //
      // Jadi kalau pelepasan gagal, status sengaja DIBIARKAN PENDING_PAYMENT
      // (beserta Payment-nya) agar `expireOverdueOrders()` menyapunya setelah
      // batas waktu bayar lewat.
      let released = false;
      try {
        await releaseOrderReservations(created.orderId);
        released = true;
      } catch (releaseError) {
        console.error("[checkout] gagal melepas reservasi:", releaseError);
      }

      if (released) {
        await prisma.order
          .update({ where: { id: created.orderId }, data: { status: "CANCELLED" } })
          .catch(() => undefined);
        await prisma.payment
          .update({ where: { id: created.paymentId }, data: { status: "FAILED" } })
          .catch(() => undefined);
      }

      return {
        ok: false,
        code: "PAYMENT",
        message: released
          ? "Gagal membuat tagihan pembayaran. Pesanan dibatalkan dan kuotanya dikembalikan. Silakan coba lagi."
          : "Gagal membuat tagihan pembayaran. Pesanan ini akan dibatalkan otomatis dan kuotanya dikembalikan. Silakan coba lagi beberapa saat lagi.",
      };
    }
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return {
        ok: false,
        code: "AVAILABILITY",
        message: `Kuota pre-order untuk "${error.productName}"${error.variantName ? ` (${error.variantName})` : ""} keburu habis dipesan pembeli lain. Kurangi jumlahnya lalu coba lagi.`,
        itemMessages: [error.message],
      };
    }

    console.error("[checkout] kesalahan tak terduga:", error);
    return {
      ok: false,
      code: "SERVER",
      message: "Terjadi kesalahan pada server. Coba lagi beberapa saat lagi.",
    };
  }
}

type RegeneratePaymentResult =
  | { ok: true; paymentUrl: string }
  | { ok: false; message: string; refresh?: boolean };

/**
 * Membuat ulang tautan Duitku tanpa membuat pesanan atau mereservasi kuota
 * kedua kali. Batas pesanan tetap `Payment.expiresAt` (60 menit).
 */
export async function regenerateDuitkuPayment(
  orderNumberInput: string,
): Promise<RegeneratePaymentResult> {
  let userId: string;
  try {
    const session = await requireUser();
    if (!session.user?.id) throw new Error("UNAUTHENTICATED");
    userId = session.user.id;
  } catch {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }

  const orderNumber = orderNumberInput.trim();
  if (!/^INV-[A-Z0-9-]{8,40}$/.test(orderNumber)) {
    return { ok: false, message: "Nomor pesanan tidak valid." };
  }
  // Membuat invoice = panggilan HTTP berbayar-ke-Duitku → batasi 5x/menit/akun.
  const regenLimit = consumeRateLimit(`regen-invoice:${userId}`, 5, 60_000);
  if (!regenLimit.ok) {
    return { ok: false, message: rateLimitedMessage(regenLimit.retryAfterMs) };
  }
  if (!isDuitkuConfigured()) {
    return { ok: false, message: "Pembayaran Duitku belum dikonfigurasi." };
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      status: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      total: true,
      items: {
        select: {
          productName: true,
          variantName: true,
          quantity: true,
          subtotal: true,
        },
      },
      payment: {
        select: {
          id: true,
          status: true,
          amount: true,
          merchantOrderId: true,
          expiresAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!order || order.userId !== userId) {
    return { ok: false, message: "Pesanan tidak ditemukan." };
  }
  if (
    order.status !== "PENDING_PAYMENT" ||
    !order.payment ||
    order.payment.status !== "PENDING"
  ) {
    return {
      ok: false,
      message: "Pesanan ini tidak sedang menunggu pembayaran Duitku.",
      refresh: true,
    };
  }

  const now = new Date();
  if (order.payment.expiresAt && order.payment.expiresAt <= now) {
    await expireOverdueOrders(now).catch(() => undefined);
    return {
      ok: false,
      message: "Batas pembayaran 60 menit sudah terlewati.",
      refresh: true,
    };
  }

  // Hindari klik ganda yang membuat banyak invoice aktif dalam beberapa detik.
  if (now.getTime() - order.payment.updatedAt.getTime() < 30_000) {
    return {
      ok: false,
      message:
        "Tautan pembayaran baru saja dibuat. Tunggu sebentar lalu coba lagi bila masih bermasalah.",
    };
  }

  // Pastikan invoice lama belum benar-benar lunas sebelum menggantinya.
  try {
    const currentStatus = await checkTransactionStatus(
      order.payment.merchantOrderId,
    );
    const confirmedAmount =
      currentStatus.amount === null
        ? Number.NaN
        : Math.round(Number(currentStatus.amount));

    if (
      currentStatus.isPaid &&
      Number.isFinite(confirmedAmount) &&
      confirmedAmount === order.payment.amount
    ) {
      await settleOrderAsPaid({
        orderId: order.id,
        paymentId: order.payment.id,
        reference: currentStatus.reference,
      });
      return {
        ok: false,
        message: "Pembayaran lama ternyata sudah diterima. Status pesanan diperbarui.",
        refresh: true,
      };
    }
  } catch (error) {
    console.warn(
      `[regenerateDuitkuPayment] status invoice lama ${order.payment.merchantOrderId} tidak dapat diperiksa:`,
      error instanceof Error ? error.message : error,
    );
  }

  const storeName = await getSetting("store_name", "Merch PENS");
  const paymentUrls = await resolvePaymentUrls();
  const merchantOrderId = `${order.orderNumber}-${randomCode(3)}`;

  try {
    const invoice = await createInvoice({
      merchantOrderId,
      paymentAmount: order.total,
      productDetails: `Pesanan ${order.orderNumber} - ${storeName}`.slice(0, 100),
      email: order.customerEmail,
      customerName: order.customerName,
      phoneNumber: order.customerPhone,
      callbackUrl: paymentUrls.callbackUrl,
      returnUrl: paymentUrls.returnUrl,
      expiryPeriod: DUITKU_LINK_EXPIRY_MINUTES,
      itemDetails: order.items.map((item) => ({
        name: `${item.productName}${item.variantName ? ` (${item.variantName})` : ""}`.slice(0, 50),
        price: item.subtotal,
        quantity: item.quantity,
      })),
    });

    const updated = await prisma.payment.updateMany({
      where: {
        id: order.payment.id,
        status: "PENDING",
        merchantOrderId: order.payment.merchantOrderId,
      },
      data: {
        merchantOrderId,
        paymentUrl: invoice.paymentUrl,
        reference: invoice.reference || null,
        method: null,
        invoiceExpiresAt: new Date(
          Date.now() + DUITKU_LINK_EXPIRY_MINUTES * 60_000,
        ),
        rawResponse: {
          regeneratedAt: new Date().toISOString(),
          previousMerchantOrderId: order.payment.merchantOrderId,
          response: invoice.raw,
        } as Prisma.InputJsonValue,
      },
    });

    if (updated.count !== 1) {
      return {
        ok: false,
        message: "Status pembayaran baru saja berubah. Muat ulang halaman.",
        refresh: true,
      };
    }

    return { ok: true, paymentUrl: invoice.paymentUrl };
  } catch (error) {
    console.error(
      `[regenerateDuitkuPayment] gagal untuk ${order.orderNumber}:`,
      error instanceof Error ? error.message : error,
    );
    return {
      ok: false,
      message: "Gagal membuat ulang tautan pembayaran. Coba lagi beberapa saat lagi.",
    };
  }
}

// ---------------------------------------------------------------------------
// Pembantu internal
// ---------------------------------------------------------------------------

type CreateOrderArgs = {
  userId: string;
  data: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerType: "MAHASISWA" | "ALUMNI";
    customerBatch: string;
    customerProgram: string;
    fulfillmentType: "PICKUP" | "SHIPPED";
    shippingAddress: string;
    note?: string;
    termsAccepted: boolean;
  };
  orderItems: Prisma.OrderItemCreateManyOrderInput[];
  reservations: ReservationLine[];
  subtotal: number;
  total: number;
  expiresAt: Date;
};

/**
 * Membuat Order + OrderItem + Payment dan mengunci kuota dalam SATU transaksi.
 *
 * `orderNumber` diacak, jadi tabrakan unik sangat kecil tapi mungkin terjadi —
 * pada kasus itu transaksi diulang dengan kode baru (maksimal 5 kali).
 */
async function createOrderWithReservation(args: CreateOrderArgs): Promise<{
  orderId: string;
  orderNumber: string;
  paymentId: string;
}> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const orderNumber = buildOrderNumber();

    try {
      return await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            orderNumber,
            userId: args.userId,
            customerName: args.data.customerName,
            customerEmail: args.data.customerEmail,
            customerPhone: args.data.customerPhone,
            customerType: args.data.customerType,
            customerBatch: args.data.customerBatch,
            customerProgram: args.data.customerProgram,
            fulfillmentType: args.data.fulfillmentType,
            // Alamat hanya untuk SHIPPED. Ongkirnya manual via WA sehingga
            // shippingCost selalu 0 di gateway.
            shippingAddress:
              args.data.fulfillmentType === "SHIPPED" && args.data.shippingAddress
                ? args.data.shippingAddress
                : null,
            note: args.data.note?.trim() ? args.data.note.trim() : null,
            subtotal: args.subtotal,
            shippingCost: 0,
            total: args.total,
            status: "PENDING_PAYMENT",
            termsVersion: CURRENT_TERMS_VERSION,
            termsAcceptedAt: new Date(),
            hasPreOrder: true,
            items: { createMany: { data: args.orderItems } },
          },
          select: { id: true, orderNumber: true },
        });

        // Kunci kuota VARIAN. Melempar InsufficientStockError bila kalah
        // balapan, yang otomatis membatalkan seluruh transaksi ini.
        //
        // Cast: `TxClient` di lib/inventory.ts belum mengecualikan `$on`/`$use`
        // yang memang tidak ada pada klien transaksi Prisma 7, sehingga tipenya
        // tidak cocok secara struktural. Seluruh method yang dipakai
        // (`$executeRaw`) tersedia di kedua tipe.
        await reserveForOrder(tx as unknown as TxClient, args.reservations);

        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            provider: "DUITKU",
            merchantOrderId: order.orderNumber,
            amount: args.total,
            status: "PENDING",
            expiresAt: args.expiresAt,
          },
          select: { id: true },
        });

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          paymentId: payment.id,
        };
      });
    } catch (error) {
      if (error instanceof InsufficientStockError) throw error;
      if (!isUniqueConstraintError(error)) throw error;
      lastError = error; // tabrakan orderNumber — coba kode lain
    }
  }

  throw lastError ?? new Error("Gagal membuat nomor pesanan yang unik");
}

/** `INV-YYYYMMDD-XXXX` dengan tanggal zona Asia/Jakarta. */
function buildOrderNumber(now: Date = new Date()): string {
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replaceAll("-", "");

  return `INV-${stamp}-${randomCode(4)}`;
}

/** Kode acak tanpa huruf/angka yang mudah tertukar (I, O, 0, 1). */
function randomCode(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function resolveAppUrl(): string {
  const raw = process.env.APP_URL || "http://localhost:3001";
  return raw.replace(/\/+$/, "");
}

/**
 * URL Duitku untuk transaksi yang sedang dibuat.
 *
 * Pada sandbox, Quick Tunnel Cloudflare mempunyai hostname acak setiap kali
 * prosesnya dijalankan. Karena itu URL harus mengikuti origin request checkout,
 * bukan nilai `.env` lama. Produksi tetap memakai URL eksplisit dari environment
 * agar Host header tidak dapat mengubah tujuan callback pembayaran.
 */
async function resolvePaymentUrls(): Promise<{
  callbackUrl: string;
  returnUrl: string;
}> {
  const configuredAppUrl = resolveAppUrl();
  const configuredCallbackUrl =
    process.env.DUITKU_CALLBACK_URL || `${configuredAppUrl}/api/duitku/callback`;
  const configuredReturnUrl =
    process.env.DUITKU_RETURN_URL || `${configuredAppUrl}/checkout/selesai`;

  if (process.env.DUITKU_ENV === "production") {
    return {
      callbackUrl: configuredCallbackUrl,
      returnUrl: configuredReturnUrl,
    };
  }

  const requestOrigin = await resolveRequestOrigin();
  if (!requestOrigin) {
    return {
      callbackUrl: configuredCallbackUrl,
      returnUrl: configuredReturnUrl,
    };
  }

  return {
    // Webhook harus bisa dijangkau server Duitku. Bila checkout dilakukan dari
    // localhost, pertahankan callback publik yang dikonfigurasi di environment.
    callbackUrl: isPublicHttpsOrigin(requestOrigin)
      ? `${requestOrigin}/api/duitku/callback`
      : configuredCallbackUrl,
    // Browser pembeli boleh kembali ke localhost maupun tunnel publik yang
    // benar-benar ia gunakan saat membuat invoice.
    returnUrl: `${requestOrigin}/checkout/selesai`,
  };
}

async function resolveRequestOrigin(): Promise<string | null> {
  const requestHeaders = await headers();
  const forwardedHost = firstForwardedValue(requestHeaders.get("x-forwarded-host"));
  const host = forwardedHost || firstForwardedValue(requestHeaders.get("host"));
  if (!host) return null;

  const forwardedProto = firstForwardedValue(requestHeaders.get("x-forwarded-proto"));
  const protocol =
    forwardedProto || (isLocalHostname(host.split(":")[0] ?? "") ? "http" : "https");

  if (protocol !== "http" && protocol !== "https") return null;

  try {
    const origin = new URL(`${protocol}://${host}`);
    return origin.origin;
  } catch {
    return null;
  }
}

function firstForwardedValue(value: string | null): string {
  return value?.split(",")[0]?.trim() ?? "";
}

function isPublicHttpsOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && !isLocalHostname(url.hostname);
  } catch {
    return false;
  }
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost")
  );
}
