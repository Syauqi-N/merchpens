"use server";

import { revalidatePath } from "next/cache";

import { requireCapability } from "@/lib/auth";
import { processPaidOrdersForClosedPeriods } from "@/lib/order-processing";
import { CAPABILITY_DENIED_MESSAGE } from "@/lib/permissions";
import { openPeriodWhere } from "@/lib/preorder";
import { prisma } from "@/lib/prisma";

import {
  addProductToPeriodSchema,
  addVariantQuotaSchema,
  createPeriodSchema,
  periodIdSchema,
  preOrderItemIdSchema,
  toFieldErrors,
  updatePeriodSchema,
  updatePreOrderItemPriceSchema,
  updateVariantQuotaSchema,
  variantQuotaIdSchema,
  type ActionResult,
  type PeriodFieldName,
  type PeriodResult,
} from "./schemas";

/**
 * Server Action pengelolaan periode & kuota pre-order per varian.
 *
 * Model bisnis:
 * - Periode PO menutup DENGAN SENDIRINYA begitu melewati `endAt`
 *   (lihat `isPeriodOpen` di lib/preorder.ts). Tidak ada aksi reset kuota.
 * - `reserved` di PreOrderVariantQuota adalah catatan terpakai; jangan diutak-atik manual.
 * - Dalam satu waktu hanya boleh ada SATU periode terbuka (ACTIVE + now di
 *   startAt..endAt). Aktivasi ditolak bila ada periode lain yang terbuka.
 *
 * Semua aksi memeriksa `MANAGE_CATALOG` sendiri karena bisa dipanggil lewat
 * POST langsung tanpa melewati UI.
 */

async function ensureCatalogAccess(): Promise<string | null> {
  try {
    await requireCapability("MANAGE_CATALOG");
    return null;
  } catch {
    return CAPABILITY_DENIED_MESSAGE.MANAGE_CATALOG;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function revalidatePeriod(periodId?: string): void {
  revalidatePath("/admin/pre-order");
  if (periodId) revalidatePath(`/admin/pre-order/${periodId}`);
  revalidatePath("/pre-order");
  revalidatePath("/produk");
  revalidatePath("/");
}

function revalidateProcessedOrders(): void {
  revalidatePath("/admin");
  revalidatePath("/admin/pesanan");
  revalidatePath("/admin/rekap");
  revalidatePath("/pesanan");
}

function processedOrdersMessage(count: number): string {
  return count > 0
    ? ` ${count} pesanan lunas otomatis masuk ke status Diproses.`
    : "";
}

/**
 * Periode lain yang sedang terbuka selain `excludeId`.
 * Dipakai untuk menegakkan aturan single-open sebelum aktivasi.
 */
async function findOpenConflict(excludeId: string | null, now: Date) {
  return prisma.preOrderPeriod.findFirst({
    where: {
      ...openPeriodWhere(now),
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, name: true, endAt: true },
  });
}

function singleOpenDeniedMessage(conflict: { name: string }): string {
  return (
    `Tidak bisa mengaktifkan: periode "${conflict.name}" sedang terbuka untuk pemesanan. ` +
    "Tutup periode tersebut lebih dulu bila ingin membuka batch ini."
  );
}

// ============================================================ periode PO

/** Membuat periode PO baru. */
export async function createPeriod(input: unknown): Promise<PeriodResult> {
  const denied = await ensureCatalogAccess();
  if (denied) return { ok: false, message: denied };

  const parsed = createPeriodSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Periksa kembali isian form.",
      fieldErrors: toFieldErrors<PeriodFieldName>(parsed.error.issues),
    };
  }

  const {
    name,
    slug,
    description,
    startAt,
    endAt,
    estimatedPickupAt,
    pickupLocation,
    pickupSchedule,
    pickupNote,
    shippingNote,
    whatsappGroupUrl,
    status,
  } = parsed.data;

  try {
    const now = new Date();
    if (status === "ACTIVE" && startAt <= now && now <= endAt) {
      const conflict = await findOpenConflict(null, now);
      if (conflict) {
        return { ok: false, message: singleOpenDeniedMessage(conflict) };
      }
    }

    const period = await prisma.preOrderPeriod.create({
      data: {
        name,
        slug,
        description: description || null,
        startAt,
        endAt,
        estimatedPickupAt,
        pickupLocation,
        pickupSchedule,
        pickupNote: pickupNote || "",
        shippingNote: shippingNote || "",
        whatsappGroupUrl: whatsappGroupUrl || null,
        status,
        closedAt: status === "CLOSED" ? now : null,
      },
      select: { id: true },
    });

    revalidatePeriod(period.id);
    return {
      ok: true,
      message: `Periode "${name}" berhasil dibuat. Tambahkan produk & kuota varian di bawah.`,
      periodId: period.id,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        message: "Slug tersebut sudah dipakai periode lain.",
        fieldErrors: { slug: "Slug sudah dipakai" },
      };
    }
    console.error("[createPeriod] gagal:", error);
    return { ok: false, message: "Terjadi kesalahan pada server. Coba lagi." };
  }
}

/** Memperbarui data periode PO. */
export async function updatePeriod(input: unknown): Promise<PeriodResult> {
  const denied = await ensureCatalogAccess();
  if (denied) return { ok: false, message: denied };

  const parsed = updatePeriodSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Periksa kembali isian form.",
      fieldErrors: toFieldErrors<PeriodFieldName>(parsed.error.issues),
    };
  }

  const { periodId, values } = parsed.data;
  const {
    name,
    slug,
    description,
    startAt,
    endAt,
    estimatedPickupAt,
    pickupLocation,
    pickupSchedule,
    pickupNote,
    shippingNote,
    whatsappGroupUrl,
    status,
  } = values;

  try {
    const existing = await prisma.preOrderPeriod.findUnique({
      where: { id: periodId },
      select: { closedAt: true },
    });

    if (!existing) return { ok: false, message: "Periode tidak ditemukan." };

    const now = new Date();
    if (status === "ACTIVE" && startAt <= now && now <= endAt) {
      const conflict = await findOpenConflict(periodId, now);
      if (conflict) {
        return { ok: false, message: singleOpenDeniedMessage(conflict) };
      }
    }

    const processed = await prisma.$transaction(async (tx) => {
      await tx.preOrderPeriod.update({
        where: { id: periodId },
        data: {
          name,
          slug,
          description: description || null,
          startAt,
          endAt,
          estimatedPickupAt,
          pickupLocation,
          pickupSchedule,
          pickupNote: pickupNote || "",
          shippingNote: shippingNote || "",
          whatsappGroupUrl: whatsappGroupUrl || null,
          status,
          closedAt: status === "CLOSED" ? (existing.closedAt ?? now) : null,
        },
      });

      if (status !== "CLOSED" && endAt > now) return 0;

      return processPaidOrdersForClosedPeriods({
        now,
        periodId,
        client: tx,
      });
    });

    revalidatePeriod(periodId);
    if (processed > 0) revalidateProcessedOrders();

    const staleActive = status === "ACTIVE" && endAt <= now;

    return {
      ok: true,
      message: staleActive
        ? "Periode disimpan, tetapi tanggal berakhirnya sudah lewat sehingga tetap tertutup otomatis." +
          processedOrdersMessage(processed)
        : `Periode "${name}" berhasil disimpan.` + processedOrdersMessage(processed),
      periodId,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        message: "Slug tersebut sudah dipakai periode lain.",
        fieldErrors: { slug: "Slug sudah dipakai" },
      };
    }
    console.error("[updatePeriod] gagal:", error);
    return { ok: false, message: "Terjadi kesalahan pada server. Coba lagi." };
  }
}

/** Mengaktifkan periode Draf menjadi Aktif (menolak bila ada periode lain terbuka). */
export async function activatePeriod(input: unknown): Promise<ActionResult> {
  const denied = await ensureCatalogAccess();
  if (denied) return { ok: false, message: denied };

  const parsed = periodIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Permintaan tidak valid." };

  const { periodId } = parsed.data;

  try {
    const period = await prisma.preOrderPeriod.findUnique({
      where: { id: periodId },
      select: { id: true, name: true, status: true, startAt: true, endAt: true },
    });

    if (!period) return { ok: false, message: "Periode tidak ditemukan." };
    if (period.status === "ACTIVE") {
      return { ok: false, message: "Periode ini sudah berstatus Aktif." };
    }
    if (period.status === "CLOSED") {
      return {
        ok: false,
        message: "Periode ini sudah Ditutup. Gunakan tombol Buka Kembali.",
      };
    }

    const now = new Date();
    if (period.startAt <= now && now <= period.endAt) {
      const conflict = await findOpenConflict(periodId, now);
      if (conflict) {
        return { ok: false, message: singleOpenDeniedMessage(conflict) };
      }
    }

    await prisma.preOrderPeriod.update({
      where: { id: periodId },
      data: { status: "ACTIVE", closedAt: null },
    });

    revalidatePeriod(periodId);

    if (period.endAt < now) {
      return {
        ok: true,
        message:
          "Status diubah menjadi Aktif, tetapi tanggal berakhirnya sudah lewat sehingga " +
          "periode tetap tertutup. Perbarui tanggal berakhir agar benar-benar terbuka.",
      };
    }
    if (period.startAt > now) {
      return {
        ok: true,
        message:
          "Periode diaktifkan dan akan terbuka otomatis saat tanggal mulai tiba.",
      };
    }

    return { ok: true, message: `Periode "${period.name}" kini terbuka untuk pemesanan.` };
  } catch (error) {
    console.error("[activatePeriod] gagal:", error);
    return { ok: false, message: "Terjadi kesalahan pada server. Coba lagi." };
  }
}

/** Menutup periode lebih awal, sebelum `endAt` terlewati. */
export async function closePeriod(input: unknown): Promise<ActionResult> {
  const denied = await ensureCatalogAccess();
  if (denied) return { ok: false, message: denied };

  const parsed = periodIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Permintaan tidak valid." };

  const { periodId } = parsed.data;

  try {
    const now = new Date();
    const outcome = await prisma.$transaction(async (tx) => {
      const result = await tx.preOrderPeriod.updateMany({
        where: { id: periodId, status: { not: "CLOSED" } },
        data: { status: "CLOSED", closedAt: now },
      });

      if (result.count === 0) {
        const exists = await tx.preOrderPeriod.findUnique({
          where: { id: periodId },
          select: { id: true },
        });
        return { changed: false, exists: Boolean(exists), processed: 0 };
      }

      const processed = await processPaidOrdersForClosedPeriods({
        now,
        periodId,
        client: tx,
      });
      return { changed: true, exists: true, processed };
    });

    if (!outcome.changed) {
      return outcome.exists
        ? { ok: false, message: "Periode ini memang sudah ditutup." }
        : { ok: false, message: "Periode tidak ditemukan." };
    }

    revalidatePeriod(periodId);
    if (outcome.processed > 0) revalidateProcessedOrders();
    return {
      ok: true,
      message:
        "Periode ditutup. Pesanan pre-order baru tidak lagi diterima." +
        processedOrdersMessage(outcome.processed),
    };
  } catch (error) {
    console.error("[closePeriod] gagal:", error);
    return { ok: false, message: "Terjadi kesalahan pada server. Coba lagi." };
  }
}

/** Membuka kembali periode Draf/Ditutup menjadi Aktif (tetap hormati single-open). */
export async function reopenPeriod(input: unknown): Promise<ActionResult> {
  const denied = await ensureCatalogAccess();
  if (denied) return { ok: false, message: denied };

  const parsed = periodIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Permintaan tidak valid." };

  const { periodId } = parsed.data;

  try {
    const period = await prisma.preOrderPeriod.findUnique({
      where: { id: periodId },
      select: { id: true, name: true, status: true, startAt: true, endAt: true },
    });

    if (!period) return { ok: false, message: "Periode tidak ditemukan." };
    if (period.status === "ACTIVE") {
      return { ok: false, message: "Periode ini sudah berstatus Aktif." };
    }

    const now = new Date();
    if (period.startAt <= now && now <= period.endAt) {
      const conflict = await findOpenConflict(periodId, now);
      if (conflict) {
        return { ok: false, message: singleOpenDeniedMessage(conflict) };
      }
    }

    await prisma.preOrderPeriod.update({
      where: { id: periodId },
      data: { status: "ACTIVE", closedAt: null },
    });

    revalidatePeriod(periodId);

    if (period.endAt < now) {
      return {
        ok: true,
        message:
          "Status diubah menjadi Aktif, tetapi tanggal berakhirnya sudah lewat sehingga " +
          "periode tetap tertutup. Perbarui tanggal berakhir agar benar-benar terbuka.",
      };
    }
    if (period.startAt > now) {
      return {
        ok: true,
        message:
          "Periode dibuka kembali dan akan terbuka otomatis saat tanggal mulai tiba.",
      };
    }

    return { ok: true, message: `Periode "${period.name}" dibuka kembali.` };
  } catch (error) {
    console.error("[reopenPeriod] gagal:", error);
    return { ok: false, message: "Terjadi kesalahan pada server. Coba lagi." };
  }
}

// ==================================================== produk dalam periode

/** Menambahkan satu produk ke periode (membuat PreOrderItem). Kuota diatur per varian. */
export async function addProductToPeriod(input: unknown): Promise<ActionResult> {
  const denied = await ensureCatalogAccess();
  if (denied) return { ok: false, message: denied };

  const parsed = addProductToPeriodSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Permintaan tidak valid.",
    };
  }

  const { periodId, productId, price } = parsed.data;

  try {
    const [period, product] = await Promise.all([
      prisma.preOrderPeriod.findUnique({ where: { id: periodId }, select: { id: true } }),
      prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          sku: true,
          isActive: true,
          variants: { select: { id: true } },
        },
      }),
    ]);

    if (!period) return { ok: false, message: "Periode tidak ditemukan." };
    if (!product) return { ok: false, message: "Produk tidak ditemukan." };
    if (!product.isActive) {
      return {
        ok: false,
        message: `"${product.name}" sedang nonaktif. Aktifkan produknya dulu di menu Produk.`,
      };
    }

    // Bila produk belum punya varian sama sekali (misal produk non-varian),
    // otomatis buatkan 1 varian standar agar kuotanya bisa langsung diisi.
    let createdVariantId: string | null = null;
    if (product.variants.length === 0) {
      const defaultVariant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          name: "Reguler",
          size: "All Size",
          design: null,
          sku: product.sku ? `${product.sku}-REG` : null,
          priceDelta: 0,
          sortOrder: 0,
          isActive: true,
        },
        select: { id: true },
      });
      createdVariantId = defaultVariant.id;
    }

    const preOrderItem = await prisma.preOrderItem.create({
      data: { periodId, productId, price },
      select: { id: true },
    });

    // Otomatis masukkan varian ke kuota default jika baru dibuat
    if (createdVariantId) {
      await prisma.preOrderVariantQuota.create({
        data: {
          preOrderItemId: preOrderItem.id,
          variantId: createdVariantId,
          quota: 100, // default quota
        },
      });
    }

    revalidatePeriod(periodId);
    return {
      ok: true,
      message: `"${product.name}" ditambahkan. Atur kuota tiap variannya di bawah.`,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        message: "Produk ini sudah ada di periode tersebut. Atur kuota variannya saja.",
      };
    }
    console.error("[addProductToPeriod] gagal:", error);
    return { ok: false, message: "Terjadi kesalahan pada server. Coba lagi." };
  }
}

/** Mengubah harga khusus PO level produk (null = pakai harga normal). */
export async function updatePreOrderItemPrice(input: unknown): Promise<ActionResult> {
  const denied = await ensureCatalogAccess();
  if (denied) return { ok: false, message: denied };

  const parsed = updatePreOrderItemPriceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Permintaan tidak valid.",
    };
  }

  const { itemId, price } = parsed.data;

  try {
    const item = await prisma.preOrderItem.findUnique({
      where: { id: itemId },
      select: {
        periodId: true,
        product: { select: { name: true } },
      },
    });

    if (!item) return { ok: false, message: "Produk periode tidak ditemukan." };

    await prisma.preOrderItem.update({
      where: { id: itemId },
      data: { price },
    });

    revalidatePeriod(item.periodId);
    return {
      ok: true,
      message:
        price === null
          ? `Harga khusus "${item.product.name}" dihapus (kembali ke harga normal).`
          : `Harga khusus "${item.product.name}" diperbarui.`,
    };
  } catch (error) {
    console.error("[updatePreOrderItemPrice] gagal:", error);
    return { ok: false, message: "Terjadi kesalahan pada server. Coba lagi." };
  }
}

/**
 * Mengeluarkan produk dari periode.
 * Ditolak bila ada kuota varian yang sudah terpakai (reserved > 0) atau ada
 * baris pesanan terkait — turunkan kuota ke angka reserved sebagai gantinya.
 */
export async function removePreOrderItem(input: unknown): Promise<ActionResult> {
  const denied = await ensureCatalogAccess();
  if (denied) return { ok: false, message: denied };

  const parsed = preOrderItemIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Permintaan tidak valid." };

  const { itemId } = parsed.data;

  try {
    const item = await prisma.preOrderItem.findUnique({
      where: { id: itemId },
      select: {
        periodId: true,
        product: { select: { name: true } },
        _count: { select: { orderItems: true } },
        variantQuotas: {
          select: {
            reserved: true,
            _count: { select: { orderItems: true } },
          },
        },
      },
    });

    if (!item) return { ok: false, message: "Produk periode tidak ditemukan." };

    const totalReserved = item.variantQuotas.reduce((sum, row) => sum + row.reserved, 0);
    const quotaOrderItems = item.variantQuotas.reduce(
      (sum, row) => sum + row._count.orderItems,
      0,
    );

    if (item._count.orderItems > 0 || quotaOrderItems > 0 || totalReserved > 0) {
      return {
        ok: false,
        message:
          `"${item.product.name}" sudah dipakai pesanan (terpakai ${totalReserved}), ` +
          "jadi tidak bisa dihapus. Turunkan kuota tiap varian ke angka terpakai bila ingin menghentikan pemesanan.",
      };
    }

    const deleted = await prisma.preOrderItem.deleteMany({
      where: {
        id: itemId,
        orderItems: { none: {} },
        variantQuotas: {
          none: {
            OR: [{ reserved: { gt: 0 } }, { orderItems: { some: {} } }],
          },
        },
      },
    });

    if (deleted.count === 0) {
      return {
        ok: false,
        message: "Produk ini baru saja dipesan pelanggan. Muat ulang halaman lalu periksa lagi.",
      };
    }

    revalidatePeriod(item.periodId);
    return { ok: true, message: `"${item.product.name}" dikeluarkan dari periode ini.` };
  } catch (error) {
    console.error("[removePreOrderItem] gagal:", error);
    return { ok: false, message: "Terjadi kesalahan pada server. Coba lagi." };
  }
}

// ==================================================== kuota per varian

/** Menambahkan satu varian aktif produk ke periode dengan kuota awal. */
export async function addVariantQuota(input: unknown): Promise<ActionResult> {
  const denied = await ensureCatalogAccess();
  if (denied) return { ok: false, message: denied };

  const parsed = addVariantQuotaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Permintaan tidak valid.",
    };
  }

  const { preOrderItemId, variantId, quota, price } = parsed.data;

  try {
    const item = await prisma.preOrderItem.findUnique({
      where: { id: preOrderItemId },
      select: { id: true, periodId: true, productId: true },
    });
    if (!item) return { ok: false, message: "Produk periode tidak ditemukan." };

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, name: true, productId: true, isActive: true },
    });
    if (!variant) return { ok: false, message: "Varian tidak ditemukan." };
    if (variant.productId !== item.productId) {
      return { ok: false, message: "Varian tersebut bukan milik produk ini." };
    }
    if (!variant.isActive) {
      return {
        ok: false,
        message: `Varian "${variant.name}" sedang nonaktif. Aktifkan dulu di menu Produk.`,
      };
    }

    await prisma.preOrderVariantQuota.create({
      data: { preOrderItemId, variantId, quota, price },
    });

    revalidatePeriod(item.periodId);
    return {
      ok: true,
      message: `Varian "${variant.name}" ditambahkan dengan kuota ${quota}.`,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        message: "Varian ini sudah ada di periode tersebut. Ubah kuotanya saja.",
      };
    }
    console.error("[addVariantQuota] gagal:", error);
    return { ok: false, message: "Terjadi kesalahan pada server. Coba lagi." };
  }
}

/**
 * Mengubah kuota / harga khusus satu varian.
 * Kuota tidak boleh turun di bawah `reserved` — penjagaan atomik via `where`.
 */
export async function updateVariantQuota(input: unknown): Promise<ActionResult> {
  const denied = await ensureCatalogAccess();
  if (denied) return { ok: false, message: denied };

  const parsed = updateVariantQuotaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Permintaan tidak valid.",
    };
  }

  const { quotaId, quota, price } = parsed.data;

  try {
    const result = await prisma.preOrderVariantQuota.updateMany({
      where: { id: quotaId, reserved: { lte: quota } },
      data: { quota, price },
    });

    if (result.count === 0) {
      const row = await prisma.preOrderVariantQuota.findUnique({
        where: { id: quotaId },
        select: {
          reserved: true,
          variant: { select: { name: true } },
          preOrderItem: { select: { periodId: true } },
        },
      });

      if (!row) return { ok: false, message: "Kuota varian tidak ditemukan." };

      return {
        ok: false,
        message:
          `Kuota "${row.variant.name}" tidak bisa diturunkan ke ${quota} karena ${row.reserved} ` +
          "sudah dipesan pelanggan. Isi minimal sebesar jumlah yang sudah terpakai.",
      };
    }

    const row = await prisma.preOrderVariantQuota.findUnique({
      where: { id: quotaId },
      select: {
        variant: { select: { name: true } },
        preOrderItem: { select: { periodId: true } },
      },
    });

    revalidatePeriod(row?.preOrderItem.periodId);
    return {
      ok: true,
      message: `Kuota "${row?.variant.name ?? "varian"}" diperbarui menjadi ${quota}.`,
    };
  } catch (error) {
    console.error("[updateVariantQuota] gagal:", error);
    return { ok: false, message: "Terjadi kesalahan pada server. Coba lagi." };
  }
}

/**
 * Menghapus baris kuota satu varian.
 * Ditolak bila reserved > 0 atau sudah ada baris pesanan terkait.
 */
export async function removeVariantQuota(input: unknown): Promise<ActionResult> {
  const denied = await ensureCatalogAccess();
  if (denied) return { ok: false, message: denied };

  const parsed = variantQuotaIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Permintaan tidak valid." };

  const { quotaId } = parsed.data;

  try {
    const row = await prisma.preOrderVariantQuota.findUnique({
      where: { id: quotaId },
      select: {
        reserved: true,
        variant: { select: { name: true } },
        preOrderItem: { select: { periodId: true } },
        _count: { select: { orderItems: true } },
      },
    });

    if (!row) return { ok: false, message: "Kuota varian tidak ditemukan." };

    if (row._count.orderItems > 0 || row.reserved > 0) {
      return {
        ok: false,
        message:
          `"${row.variant.name}" sudah dipakai ${row._count.orderItems} baris pesanan ` +
          `(terpakai ${row.reserved}), jadi tidak bisa dihapus. Turunkan kuotanya ke jumlah yang sudah terpakai bila ingin menghentikan pemesanan.`,
      };
    }

    const deleted = await prisma.preOrderVariantQuota.deleteMany({
      where: { id: quotaId, reserved: 0, orderItems: { none: {} } },
    });

    if (deleted.count === 0) {
      return {
        ok: false,
        message: "Kuota ini baru saja dipesan pelanggan. Muat ulang halaman lalu periksa lagi.",
      };
    }

    revalidatePeriod(row.preOrderItem.periodId);
    return { ok: true, message: `Varian "${row.variant.name}" dikeluarkan dari periode ini.` };
  } catch (error) {
    console.error("[removeVariantQuota] gagal:", error);
    return { ok: false, message: "Terjadi kesalahan pada server. Coba lagi." };
  }
}
