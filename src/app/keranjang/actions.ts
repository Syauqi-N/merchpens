"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { expireOverdueOrders } from "@/lib/inventory";
import { formatRupiah } from "@/lib/format";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";
import {
  openPeriodWhere,
  resolveVariantAvailability,
  unavailableLabel,
} from "@/lib/preorder";
import type {
  CartLineCheck,
  CartLineIssue,
  RevalidateCartResult,
} from "./types";

const lineSchema = z.object({
  productId: z.string().trim().min(1).max(64),
  variantId: z.string().trim().min(1).max(64),
  variantQuotaId: z.string().trim().min(1).max(64).nullable(),
  quantity: z.number().int().min(1).max(9999),
  unitPrice: z.number().int().min(0),
});

const linesSchema = z.array(lineSchema).max(50);

/** Jeda minimum antar sapuan pesanan kedaluwarsa. */
const EXPIRE_SWEEP_INTERVAL_MS = 30_000;

/**
 * Penanda kapan sapuan terakhir dijalankan, dititipkan di `globalThis` supaya
 * nilainya bertahan melewati hot-reload dev dan dipakai bersama oleh semua
 * pemanggil dalam satu proses server.
 */
const sweepState = globalThis as unknown as { cartExpireSweepAt?: number };

/**
 * Menjalankan `expireOverdueOrders()` paling sering sekali per 30 detik.
 *
 * `revalidateCart` sengaja terbuka tanpa autentikasi karena keranjang tamu juga
 * perlu divalidasi, jadi siapa pun bisa mem-POST berkali-kali. Tanpa rem, tiap
 * POST memicu sapuan yang memindai sampai 200 pesanan dan membuka transaksi per
 * pesanan — murah bagi penyerang, mahal bagi database kita.
 *
 * Melewati sapuan itu aman: membebaskan kuota pesanan mati tidak perlu presisi
 * detik, dan `revalidateCart` tetap menghitung ketersediaan dari database pada
 * setiap panggilan sehingga nilai kembaliannya tidak berubah. Penguncian kuota
 * yang sebenarnya tetap terjadi di `createOrderAndPay()`.
 *
 * Catatan: rem ini per-proses, bukan lintas instance. Tujuannya memangkas
 * amplifikasi, bukan menggantikan rate limit di edge.
 */
async function sweepOverdueOrdersThrottled(now: Date): Promise<void> {
  const nowMs = now.getTime();
  if (nowMs - (sweepState.cartExpireSweepAt ?? 0) < EXPIRE_SWEEP_INTERVAL_MS) {
    return;
  }

  // Tandai SEBELUM await supaya panggilan yang datang bersamaan tidak
  // sama-sama lolos dan menjalankan sapuan berbarengan.
  sweepState.cartExpireSweepAt = nowMs;

  try {
    await expireOverdueOrders(now);
  } catch (error) {
    console.error("[revalidateCart] gagal menyapu pesanan kedaluwarsa:", error);
  }
}

function dropLine(
  checks: CartLineCheck[],
  messages: string[],
  line: { productId: string; variantId: string; variantQuotaId: string | null },
  name: string,
  message: string,
): void {
  checks.push({
    productId: line.productId,
    variantId: line.variantId,
    variantQuotaId: line.variantQuotaId,
    name,
    issues: ["UNAVAILABLE"],
    messages: [message],
    fresh: null,
    allowedQuantity: 0,
  });
  messages.push(message);
}

/**
 * Memeriksa ulang isi keranjang terhadap database.
 *
 * Keranjang hidup di localStorage sehingga isinya bisa basi berhari-hari:
 * harga PO berubah, periode PO tutup, atau kuota varian habis dipesan orang
 * lain. Fungsi ini mengembalikan kebenaran versi server supaya klien bisa
 * menyelaraskan keranjang SEBELUM pengguna sampai di halaman pembayaran.
 *
 * Ini murni informatif — penguncian kuota yang sesungguhnya tetap terjadi di
 * `createOrderAndPay()` lewat `reserveForOrder()` di dalam satu transaksi.
 */
export async function revalidateCart(input: unknown): Promise<RevalidateCartResult> {
  const now = new Date();

  // Terbuka tanpa login → batasi 60x/menit/IP di atas rem sapuan yang sudah ada.
  const cartLimit = consumeRateLimit(`revalidate-cart:${await clientIp()}`, 60, 60_000);
  if (!cartLimit.ok) {
    return {
      ok: false,
      checkedAt: now.toISOString(),
      lines: [],
      messages: ["Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi."],
      emptied: false,
    };
  }

  const parsed = linesSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      checkedAt: now.toISOString(),
      lines: [],
      messages: ["Isi keranjang tidak dapat dibaca. Coba muat ulang halaman."],
      emptied: false,
    };
  }

  const lines = parsed.data;
  if (lines.length === 0) {
    return {
      ok: true,
      checkedAt: now.toISOString(),
      lines: [],
      messages: [],
      emptied: true,
    };
  }

  // Bebaskan kuota yang masih disandera pesanan mati sebelum menghitung sisa,
  // supaya pembeli tidak melihat "kuota habis" padahal pemesannya sudah lewat
  // batas waktu bayar. Sapuan dibatasi laju — lihat komentarnya di atas.
  await sweepOverdueOrdersThrottled(now);

  const productIds = [...new Set(lines.map((line) => line.productId))];
  const variantQuotaIds = [
    ...new Set(
      lines.map((line) => line.variantQuotaId).filter((id): id is string => id !== null),
    ),
  ];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      variants: true,
      preOrderItems: {
        where: { period: openPeriodWhere(now) },
        include: {
          period: true,
          variantQuotas: {
            where: { id: { in: variantQuotaIds } },
            include: { variant: true },
          },
        },
      },
    },
  });

  const byId = new Map(products.map((product) => [product.id, product]));

  const checks: CartLineCheck[] = [];
  const messages: string[] = [];
  let remaining = 0;

  for (const line of lines) {
    const product = byId.get(line.productId);
    const label = (variantName?: string) =>
      variantName ? `${product?.name ?? "Produk"} (${variantName})` : (product?.name ?? "Produk");

    if (!product) {
      dropLine(
        checks,
        messages,
        line,
        "Produk",
        "Produk sudah tidak tersedia dan dikeluarkan dari keranjang.",
      );
      continue;
    }

    const variant = product.variants.find((v) => v.id === line.variantId);
    if (!variant) {
      dropLine(
        checks,
        messages,
        line,
        product.name,
        `${product.name}: varian yang dipilih sudah tidak tersedia. Item dikeluarkan dari keranjang.`,
      );
      continue;
    }

    const quotaById = new Map(
      product.preOrderItems.flatMap((item) =>
        item.variantQuotas.map(
          (row) => [row.id, { row, item }] as const,
        ),
      ),
    );
    const found = line.variantQuotaId ? quotaById.get(line.variantQuotaId) : null;
    const quotaRow = found && found.row.variantId === variant.id ? found : null;

    if (!quotaRow) {
      dropLine(
        checks,
        messages,
        line,
        label(variant.name),
        `${label(variant.name)}: periode PO yang dipilih sudah tidak tersedia. Item dikeluarkan dari keranjang.`,
      );
      continue;
    }

    const quotaWithItem = {
      ...quotaRow.row,
      preOrderItem: quotaRow.item,
    };

    const availability = resolveVariantAvailability(product, variant, quotaWithItem, now);

    if (!availability.canOrder || !availability.variantQuotaId) {
      const reason = unavailableLabel(availability.reason);
      dropLine(
        checks,
        messages,
        line,
        label(variant.name),
        `${label(variant.name)}: ${reason}. Item dikeluarkan dari keranjang.`,
      );
      continue;
    }

    const issues: CartLineIssue[] = [];
    const lineMessages: string[] = [];
    const allowedQuantity = Math.min(line.quantity, availability.available);

    if (allowedQuantity < line.quantity) {
      issues.push("QUANTITY_REDUCED");
      const message = `${label(variant.name)}: kuota pre-order tinggal ${availability.available} ${product.unit}, jumlah disesuaikan.`;
      lineMessages.push(message);
      messages.push(message);
    }

    if (availability.effectivePrice !== line.unitPrice) {
      issues.push("PRICE_CHANGED");
      const message = `${label(variant.name)}: harga berubah menjadi ${formatRupiah(availability.effectivePrice)} per ${product.unit}.`;
      lineMessages.push(message);
      messages.push(message);
    }

    remaining += allowedQuantity;

    checks.push({
      productId: product.id,
      variantId: variant.id,
      variantQuotaId: availability.variantQuotaId,
      name: label(variant.name),
      issues,
      messages: lineMessages,
      fresh: {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        imageUrl: variant.imageUrl ?? product.images[0]?.url ?? null,
        variantId: variant.id,
        variantName: variant.name,
        unitPrice: availability.effectivePrice,
        variantQuotaId: availability.variantQuotaId,
        preOrderItemId: availability.preOrderItemId,
        pickupPeriod: availability.period
          ? {
              id: availability.period.id,
              name: availability.period.name,
              endAt: availability.period.endAt.toISOString(),
              estimatedPickupAt: availability.period.estimatedPickupAt.toISOString(),
              pickupLocation: availability.period.pickupLocation,
              pickupSchedule: availability.period.pickupSchedule,
              pickupNote: availability.period.pickupNote,
              shippingNote: availability.period.shippingNote,
            }
          : null,
        maxQty: availability.available,
        unit: product.unit,
      },
      allowedQuantity,
    });
  }

  return {
    ok: messages.length === 0,
    checkedAt: now.toISOString(),
    lines: checks,
    messages,
    emptied: remaining === 0,
  };
}
