import { prisma } from "@/lib/prisma";

export {
  UNAVAILABLE_MESSAGE,
  unavailableLabel,
  type UnavailableReason,
} from "@/lib/preorder-labels";
import type { UnavailableReason } from "@/lib/preorder-labels";

/**
 * Sebuah periode PO dianggap TERBUKA hanya jika:
 *   status === ACTIVE  DAN  sekarang berada di dalam rentang startAt..endAt
 *
 * Konsekuensinya periode menutup DENGAN SENDIRINYA begitu melewati `endAt`.
 * Admin tetap bisa menutup lebih awal dengan mengubah status menjadi CLOSED.
 *
 * Dalam satu waktu hanya BOLEH ada satu periode yang terbuka untuk dipesan —
 * ditegakkan di Server Action aktivasi periode (`admin/pre-order/actions.ts`).
 */
export type PeriodLike = {
  status: string;
  startAt: Date;
  endAt: Date;
};

export function isPeriodOpen(period: PeriodLike, now: Date = new Date()): boolean {
  return period.status === "ACTIVE" && period.startAt <= now && period.endAt >= now;
}

/** Filter Prisma untuk periode PO yang sedang terbuka. */
export function openPeriodWhere(now: Date = new Date()) {
  return {
    status: "ACTIVE" as const,
    startAt: { lte: now },
    endAt: { gte: now },
  };
}

/** Periode PO yang sedang berjalan (null bila tidak ada). */
export async function getOpenPeriod(now: Date = new Date()) {
  return prisma.preOrderPeriod.findFirst({
    where: openPeriodWhere(now),
    orderBy: { endAt: "asc" },
  });
}

export type OpenPeriodInfo = {
  id: string;
  name: string;
  endAt: Date;
  estimatedPickupAt: Date;
  pickupLocation: string;
  pickupSchedule: string;
  pickupNote: string;
  shippingNote: string;
};

export type VariantAvailability = {
  canOrder: boolean;
  /** Jumlah maksimum yang masih bisa dipesan sekarang (kuota - reserved). */
  available: number;
  /** Kuota awal & terpakai varian (untuk bar progres; 0 bila tak ada baris kuota). */
  quota: number;
  reserved: number;
  /** Harga yang berlaku: override varian > override produk > harga produk + delta. */
  effectivePrice: number;
  /** Baris kuota VARIAN yang dipakai — dibutuhkan checkout untuk mereservasi. */
  variantQuotaId: string | null;
  preOrderItemId: string | null;
  variantId: string;
  variantName: string;
  period: OpenPeriodInfo | null;
  reason: UnavailableReason | null;
};

type ProductLike = {
  id: string;
  price: number;
  isActive: boolean;
};

type VariantLike = {
  id: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
};

type VariantQuotaLike = {
  id: string;
  quota: number;
  reserved: number;
  price: number | null;
  preOrderItem: {
    id: string;
    price: number | null;
    period: {
      id: string;
      name: string;
      status: string;
      startAt: Date;
      endAt: Date;
      estimatedPickupAt: Date;
      pickupLocation: string;
      pickupSchedule: string;
      pickupNote: string;
      shippingNote: string;
    };
  };
};

/**
 * Menghitung ketersediaan SATU VARIAN.
 *
 * Rumus tunggal: tersedia = quota - reserved, dan hanya bila periodenya
 * sedang terbuka. `reserved` sudah memuat pesanan yang BELUM lunas, sehingga
 * satu jatah tidak bisa dipesan dua orang selagi yang pertama menunggu
 * pembayaran (60 menit).
 */
export function resolveVariantAvailability(
  product: ProductLike,
  variant: VariantLike,
  quotaRow?: VariantQuotaLike | null,
  now: Date = new Date(),
): VariantAvailability {
  const base: VariantAvailability = {
    canOrder: false,
    available: 0,
    quota: 0,
    reserved: 0,
    effectivePrice: product.price + variant.priceDelta,
    variantQuotaId: null,
    preOrderItemId: null,
    variantId: variant.id,
    variantName: variant.name,
    period: null,
    reason: null,
  };

  if (!product.isActive || !variant.isActive) {
    return { ...base, reason: "INACTIVE" };
  }

  if (!quotaRow) {
    return { ...base, reason: "NO_OPEN_PERIOD" };
  }

  if (!isPeriodOpen(quotaRow.preOrderItem.period, now)) {
    return { ...base, reason: "NOT_IN_PERIOD" };
  }

  const period = {
    id: quotaRow.preOrderItem.period.id,
    name: quotaRow.preOrderItem.period.name,
    endAt: quotaRow.preOrderItem.period.endAt,
    estimatedPickupAt: quotaRow.preOrderItem.period.estimatedPickupAt,
    pickupLocation: quotaRow.preOrderItem.period.pickupLocation,
    pickupSchedule: quotaRow.preOrderItem.period.pickupSchedule,
    pickupNote: quotaRow.preOrderItem.period.pickupNote,
    shippingNote: quotaRow.preOrderItem.period.shippingNote,
  };

  const effectivePrice =
    quotaRow.price ?? quotaRow.preOrderItem.price ?? product.price + variant.priceDelta;

  if (effectivePrice <= 0) {
    return {
      ...base,
      effectivePrice,
      quota: quotaRow.quota,
      reserved: quotaRow.reserved,
      variantQuotaId: quotaRow.id,
      preOrderItemId: quotaRow.preOrderItem.id,
      period,
      reason: "PRICE_UNAVAILABLE",
    };
  }

  const available = Math.max(0, quotaRow.quota - quotaRow.reserved);
  return {
    ...base,
    canOrder: available > 0,
    available,
    quota: quotaRow.quota,
    reserved: quotaRow.reserved,
    effectivePrice,
    variantQuotaId: quotaRow.id,
    preOrderItemId: quotaRow.preOrderItem.id,
    period,
    reason: available > 0 ? null : "QUOTA_EXHAUSTED",
  };
}

export type ProductAvailabilitySummary = {
  /** True bila minimal satu varian bisa dipesan. */
  canOrder: boolean;
  /** Total sisa kuota semua varian yang bisa dipesan. */
  totalAvailable: number;
  /** Harga termurah & termahal di antara varian yang bisa dipesan. */
  minPrice: number | null;
  maxPrice: number | null;
};

/** Ringkasan level produk dari ketersediaan tiap variannya. */
export function summarizeProductAvailability(
  items: VariantAvailability[],
): ProductAvailabilitySummary {
  const orderable = items.filter((item) => item.canOrder);
  if (orderable.length === 0) {
    return { canOrder: false, totalAvailable: 0, minPrice: null, maxPrice: null };
  }
  const prices = orderable.map((item) => item.effectivePrice);
  return {
    canOrder: true,
    totalAvailable: orderable.reduce((sum, item) => sum + item.available, 0),
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
  };
}

/**
 * Mengambil produk beserta varian dan baris kuotanya pada periode terbuka.
 * Dipakai katalog/detail agar ketersediaan bisa dihitung dalam satu query.
 */
export function productWithAvailabilityInclude(now: Date = new Date()) {
  return {
    images: { orderBy: { sortOrder: "asc" as const } },
    categories: {
      orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }],
    },
    variants: {
      where: { isActive: true },
      orderBy: { sortOrder: "asc" as const },
    },
    preOrderItems: {
      where: { period: openPeriodWhere(now) },
      include: {
        period: true,
        variantQuotas: { include: { variant: true } },
      },
      take: 1,
    },
  };
}

/**
 * Filter Prisma untuk produk yang benar-benar bisa dipesan sekarang: produk
 * aktif yang punya kuota VARIAN di periode yang sedang terbuka.
 */
export function orderableProductWhere(now: Date = new Date()) {
  return {
    isActive: true,
    preOrderItems: {
      some: {
        period: openPeriodWhere(now),
        variantQuotas: { some: { variant: { isActive: true } } },
      },
    },
  };
}

/**
 * Jumlah produk yang bisa dipesan per kategori, untuk kartu kategori di beranda
 * dan halaman /kategori.
 */
export async function countOrderableProductsByCategory(
  now: Date = new Date(),
): Promise<Map<string, number>> {
  const rows = await prisma.category.findMany({
    select: {
      id: true,
      _count: {
        select: {
          products: { where: orderableProductWhere(now) },
        },
      },
    },
  });

  return new Map(rows.map((row) => [row.id, row._count.products]));
}
