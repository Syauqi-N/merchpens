import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  BoxesIcon,
  CalendarClockIcon,
  ClipboardListIcon,
  GaugeIcon,
  HourglassIcon,
  LockIcon,
  MegaphoneIcon,
  PackageCheckIcon,
  PackageIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
  WalletIcon,
} from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { ensureAdminPage } from "@/components/admin/guard";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  formatDate,
  formatDateTime,
  formatMonthYear,
  formatNumber,
  formatRupiah,
} from "@/lib/format";
import { can, CAPABILITY_DENIED_MESSAGE, type Capability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { openPeriodWhere, orderableProductWhere } from "@/lib/preorder";
import { cn } from "@/lib/utils";
import { LOW_QUOTA_THRESHOLD } from "./produk/schemas";

export const metadata: Metadata = { title: "Dashboard" };

/** Status pesanan yang dihitung sebagai pendapatan. */
const REVENUE_STATUSES = ["PAID", "PROCESSING", "COMPLETED"] as const;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

type RecentOrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: string;
  itemCount: number;
  createdAt: Date;
};

type LowQuotaRow = {
  key: string;
  productId: string;
  productName: string;
  variantName: string;
  unit: string;
  periodId: string;
  periodName: string;
  periodEndAt: Date;
  quota: number;
  reserved: number;
  available: number;
};

/**
 * Menerjemahkan `?ditolak=<KEMAMPUAN>` — yang dipasang oleh guard halaman saat
 * seseorang mencoba membuka halaman di luar wewenangnya — menjadi pesan.
 *
 * Hanya nama kemampuan yang dikenal yang diterima; teks bebas dari URL tidak
 * pernah ikut dirender, sehingga tautan iseng tidak bisa menaruh kalimat
 * karangannya sendiri di dashboard pengurus.
 */
function readDeniedNotice(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;

  return raw in CAPABILITY_DENIED_MESSAGE
    ? CAPABILITY_DENIED_MESSAGE[raw as Capability]
    : null;
}

/** Data bagian pesanan — hanya diambil bila pembaca punya MANAGE_ORDERS. */
async function loadOrderSummary() {
  const [totalOrders, pendingPaymentOrders, shippedUnpaidOngkir, recentOrders] =
    await Promise.all([
      prisma.order.count(),

      prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),

      prisma.order.count({
        where: {
          fulfillmentType: "SHIPPED",
          status: { in: [...REVENUE_STATUSES] },
        },
      }),

      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          total: true,
          status: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      }),
    ]);

  const rows: RecentOrderRow[] = recentOrders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    total: order.total,
    status: order.status,
    itemCount: order._count.items,
    createdAt: order.createdAt,
  }));

  return { totalOrders, pendingPaymentOrders, shippedUnpaidOngkir, rows };
}

/**
 * Data omzet, katalog, dan kuota PO — hanya diambil bila pembaca punya
 * MANAGE_CATALOG.
 *
 * Query-nya sengaja tidak dijalankan sama sekali untuk peran yang tidak berhak,
 * bukan sekadar disembunyikan di JSX: angka yang tidak boleh dia lihat tidak
 * pernah ikut terkirim ke browser.
 *
 * Seluruh produk dijual lewat pre-order, jadi ukuran kesehatan katalog di sini
 * adalah KUOTA VARIAN periode yang sedang terbuka — bukan stok.
 */
async function loadCatalogSummary(now: Date) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [revenueThisMonth, totalProducts, activeProducts, orderableProducts, openPeriods] =
    await Promise.all([
      prisma.order.aggregate({
        _sum: { total: true },
        _count: true,
        where: {
          status: { in: [...REVENUE_STATUSES] },
          createdAt: { gte: monthStart },
        },
      }),

      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
      // Produk aktif yang punya baris kuota VARIAN di periode yang sedang
      // terbuka — hanya inilah yang benar-benar bisa dipesan sekarang.
      prisma.product.count({ where: orderableProductWhere(now) }),

      prisma.preOrderPeriod.findMany({
        where: openPeriodWhere(now),
        orderBy: { endAt: "asc" },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  unit: true,
                  price: true,
                  isActive: true,
                },
              },
              variantQuotas: {
                include: { variant: { select: { id: true, name: true } } },
              },
            },
          },
        },
      }),
    ]);

  // Ringkasan kuota tiap periode PO yang sedang terbuka (level varian).
  const periodSummaries = openPeriods.map((period) => {
    const rows = period.items.flatMap((item) => item.variantQuotas);
    const totalQuota = rows.reduce((sum, row) => sum + row.quota, 0);
    const totalReserved = rows.reduce((sum, row) => sum + row.reserved, 0);
    const remaining = Math.max(0, totalQuota - totalReserved);

    return {
      id: period.id,
      name: period.name,
      endAt: period.endAt,
      productCount: period.items.length,
      variantCount: rows.length,
      totalQuota,
      totalReserved,
      remaining,
      usedPercent: totalQuota === 0 ? 0 : Math.round((totalReserved / totalQuota) * 100),
    };
  });

  const totalQuota = periodSummaries.reduce((sum, period) => sum + period.totalQuota, 0);
  const totalReserved = periodSummaries.reduce(
    (sum, period) => sum + period.totalReserved,
    0,
  );
  const totalRemainingQuota = periodSummaries.reduce(
    (sum, period) => sum + period.remaining,
    0,
  );

  // Varian PO yang kuotanya hampir habis (sisa <= 20% atau <= ambang, mana yang lebih besar).
  const lowQuotaAll: LowQuotaRow[] = openPeriods
    .flatMap((period) =>
      period.items.flatMap((item) =>
        item.variantQuotas.map((row) => ({
          key: row.id,
          productId: item.product.id,
          productName: item.product.name,
          variantName: row.variant.name,
          unit: item.product.unit,
          periodId: period.id,
          periodName: period.name,
          periodEndAt: period.endAt,
          quota: row.quota,
          reserved: row.reserved,
          available: Math.max(0, row.quota - row.reserved),
        })),
      ),
    )
    .filter((row) => {
      const threshold = Math.max(LOW_QUOTA_THRESHOLD, Math.ceil(row.quota * 0.2));
      return row.available <= threshold;
    })
    .sort((a, b) => a.available - b.available || a.productName.localeCompare(b.productName));

  return {
    revenueTotal: revenueThisMonth._sum.total ?? 0,
    revenueOrderCount: revenueThisMonth._count,
    totalProducts,
    activeProducts,
    orderableProducts,
    /** Produk aktif yang belum diikutkan periode PO mana pun yang terbuka. */
    idleProducts: Math.max(0, activeProducts - orderableProducts),
    periodSummaries,
    totalQuota,
    totalReserved,
    totalRemainingQuota,
    lowQuotaTotal: lowQuotaAll.length,
    lowQuotaItems: lowQuotaAll.slice(0, 8),
  };
}

export type AudienceFilter = {
  periodId: string;
  customerType: "" | "MAHASISWA" | "ALUMNI";
};

type AudienceRow = {
  key: string;
  label: string;
  orders: number;
  items: number;
  revenue: number;
};

/**
 * Pesanan lunas per angkatan & per jurusan — bahan promosi terarah.
 *
 * Hanya menghitung pesanan berstatus pendapatan (PAID/PROCESSING/COMPLETED).
 * Filter periode & tipe datang dari query string dashboard (`?po=...&tipe=...`)
 * sehingga pengurus bisa melihat sebaran per batch.
 */
async function loadAudienceSummary(filter: AudienceFilter): Promise<{
  periods: { id: string; name: string }[];
  byBatch: AudienceRow[];
  byProgram: AudienceRow[];
  totalOrders: number;
}> {
  const periods = await prisma.preOrderPeriod.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { id: true, name: true },
  });

  const orderWhere: Prisma.OrderWhereInput = {
    status: { in: [...REVENUE_STATUSES] },
    ...(filter.customerType ? { customerType: filter.customerType } : {}),
    ...(filter.periodId
      ? { items: { some: { preOrderItem: { periodId: filter.periodId } } } }
      : {}),
  };

  const [batchGroups, programGroups] = await Promise.all([
    prisma.order.groupBy({
      by: ["customerBatch"],
      where: orderWhere,
      _count: { _all: true },
      _sum: { total: true },
      orderBy: { customerBatch: "asc" },
    }),
    prisma.order.groupBy({
      by: ["customerProgram"],
      where: orderWhere,
      _count: { _all: true },
      _sum: { total: true },
      orderBy: { customerProgram: "asc" },
    }),
  ]);

  type AudienceGroup = {
    customerBatch?: string | null;
    customerProgram?: string | null;
    _count: { _all: number };
    _sum: { total: number | null };
  };

  async function withItems(
    groups: AudienceGroup[],
    keyOf: (group: AudienceGroup) => { key: string; label: string },
  ): Promise<AudienceRow[]> {
    return Promise.all(
      groups.map(async (group) => {
        const { key, label } = keyOf(group);
        const scopedOrder: Prisma.OrderWhereInput = {
          ...orderWhere,
          ...(group.customerBatch !== undefined && group.customerBatch !== null
            ? { customerBatch: group.customerBatch }
            : { customerProgram: group.customerProgram ?? "" }),
        };
        const items = await prisma.orderItem.aggregate({
          _sum: { quantity: true },
          where: { order: scopedOrder },
        });
        return {
          key,
          label,
          orders: group._count._all,
          items: items._sum?.quantity ?? 0,
          revenue: group._sum.total ?? 0,
        };
      }),
    );
  }

  const byBatch = await withItems(batchGroups, (group) => ({
    key: group.customerBatch ?? "-",
    label: group.customerBatch?.trim() ? `Angkatan ${group.customerBatch}` : "Tanpa angkatan",
  }));
  const byProgram = await withItems(programGroups, (group) => ({
    key: group.customerProgram ?? "-",
    label:
      group.customerProgram?.trim() && group.customerProgram !== "-"
        ? group.customerProgram
        : "Tanpa jurusan",
  }));

  byBatch.sort((a, b) => a.orders - b.orders || a.label.localeCompare(b.label));
  byProgram.sort((a, b) => a.orders - b.orders || a.label.localeCompare(b.label));

  return {
    periods,
    byBatch,
    byProgram,
    totalOrders: byBatch.reduce((sum, row) => sum + row.orders, 0),
  };
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Guard di layout tidak menghentikan render page ini, jadi otorisasi diulang.
  // Dashboard cukup butuh akses panel — isinyalah yang disesuaikan per peran.
  const actor = await ensureAdminPage("/admin");

  const canManageCatalog = can(actor.role, "MANAGE_CATALOG");
  const canManageOrders = can(actor.role, "MANAGE_ORDERS");

  const params = await searchParams;
  const deniedNotice = readDeniedNotice(params.ditolak);

  const tipeParam = firstParam(params.tipe).trim();
  const audienceFilter: AudienceFilter = {
    periodId: firstParam(params.po).trim(),
    customerType:
      tipeParam === "MAHASISWA" || tipeParam === "ALUMNI" ? tipeParam : "",
  };

  const now = new Date();

  // Setiap bagian hanya di-query bila pembacanya memang berhak melihatnya.
  const [orders, catalog, audience] = await Promise.all([
    canManageOrders ? loadOrderSummary() : null,
    canManageCatalog ? loadCatalogSummary(now) : null,
    canManageOrders ? loadAudienceSummary(audienceFilter) : null,
  ]);

  const orderColumns: DataTableColumn<RecentOrderRow>[] = [
    {
      key: "order",
      header: "Pesanan",
      className: "whitespace-normal min-w-[130px]",
      cell: (row) => (
        <div className="min-w-0">
          <Link
            href={`/admin/pesanan/${row.id}`}
            className="font-mono text-sm font-medium text-cream hover:text-gold"
          >
            {row.orderNumber}
          </Link>
          <p className="text-xs text-cream-muted">{row.itemCount} item</p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Pelanggan",
      className: "hidden sm:table-cell max-w-48 truncate text-sm text-[#D8D3C7]",
      headerClassName: "hidden sm:table-cell",
      cell: (row) => row.customerName,
    },
    {
      key: "date",
      header: "Tanggal",
      className: "hidden md:table-cell text-sm text-cream-muted",
      headerClassName: "hidden md:table-cell",
      cell: (row) => formatDateTime(row.createdAt),
    },
    {
      key: "status",
      header: "Status",
      className: "whitespace-nowrap",
      cell: (row) => <OrderStatusBadge status={row.status} />,
    },
    {
      key: "total",
      header: "Total",
      className: "text-right text-sm font-medium text-cream whitespace-nowrap",
      headerClassName: "text-right",
      cell: (row) => formatRupiah(row.total),
    },
  ];

  const monthLabel = formatMonthYear(now);

  const description = canManageCatalog
    ? "Ringkasan penjualan, katalog, dan kuota periode pre-order yang sedang berjalan."
    : canManageOrders
      ? "Ringkasan pesanan yang masuk dan perlu kamu proses."
      : "Panel pengurus.";

  return (
    <>
      <AdminPageHeader title="Dashboard" description={description} />

      {deniedNotice && (
        <Alert variant="destructive" className="mb-5">
          <ShieldAlertIcon />
          <AlertTitle>Halaman itu bukan wewenangmu</AlertTitle>
          <AlertDescription>
            {deniedNotice} Kamu masuk sebagai pengurus, jadi kami kembalikan ke dashboard.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {orders && (
          <>
            <StatCard
              label="Total pesanan"
              value={formatNumber(orders.totalOrders)}
              hint="Seluruh pesanan yang pernah masuk"
              icon={ClipboardListIcon}
              tone="sky"
              href="/admin/pesanan"
            />

            <StatCard
              label="Menunggu pembayaran"
              value={formatNumber(orders.pendingPaymentOrders)}
              hint="Kuota masih tertahan sampai lunas atau kedaluwarsa (60 mnt)"
              icon={HourglassIcon}
              tone={orders.pendingPaymentOrders > 0 ? "amber" : "slate"}
              href="/admin/pesanan?status=PENDING_PAYMENT"
            />

            <StatCard
              label="Kirim — lunas, ongkir manual"
              value={formatNumber(orders.shippedUnpaidOngkir)}
              hint="Pesanan kirim yang sudah lunas, perlu difollow-up ongkir via WA"
              icon={MegaphoneIcon}
              tone={orders.shippedUnpaidOngkir > 0 ? "amber" : "slate"}
              href="/admin/pesanan?terima=SHIPPED"
            />
          </>
        )}

        {catalog && (
          <>
            <StatCard
              label={`Pendapatan ${monthLabel}`}
              value={formatRupiah(catalog.revenueTotal)}
              hint={`Dari ${catalog.revenueOrderCount} pesanan berstatus Dibayar, Diproses, atau Selesai`}
              icon={WalletIcon}
              tone="emerald"
            />

            <StatCard
              label="Jumlah produk"
              value={formatNumber(catalog.totalProducts)}
              hint={`${catalog.activeProducts} aktif · ${catalog.totalProducts - catalog.activeProducts} nonaktif`}
              icon={PackageIcon}
              tone="sky"
              href="/admin/produk"
            />

            <StatCard
              label="Produk siap dipesan"
              value={formatNumber(catalog.orderableProducts)}
              hint={
                catalog.idleProducts === 0
                  ? "Semua produk aktif sudah masuk periode PO yang terbuka"
                  : `${formatNumber(catalog.idleProducts)} produk aktif belum masuk periode PO mana pun`
              }
              icon={PackageCheckIcon}
              tone={catalog.idleProducts > 0 ? "amber" : "emerald"}
              href="/admin/pre-order"
            />

            <StatCard
              label="Kuota periode berjalan"
              value={`${formatNumber(catalog.totalReserved)} / ${formatNumber(catalog.totalQuota)}`}
              hint={
                catalog.totalQuota === 0
                  ? "Belum ada kuota yang dibuka"
                  : `Terpakai dari total kuota varian · sisa ${formatNumber(catalog.totalRemainingQuota)}`
              }
              icon={GaugeIcon}
              tone="sky"
              href="/admin/pre-order"
            />

            <StatCard
              label="Varian hampir habis"
              value={formatNumber(catalog.lowQuotaTotal)}
              hint={`Varian dengan sisa kuota ≤ ${LOW_QUOTA_THRESHOLD} atau ≤ 20% dari jatahnya`}
              icon={TriangleAlertIcon}
              tone={catalog.lowQuotaTotal > 0 ? "rose" : "slate"}
              href="/admin/pre-order"
            />

            <StatCard
              label="Periode PO terbuka"
              value={formatNumber(catalog.periodSummaries.length)}
              hint={
                catalog.periodSummaries.length === 0
                  ? "Tidak ada periode pre-order yang terbuka"
                  : `Total sisa kuota ${formatNumber(catalog.totalRemainingQuota)}`
              }
              icon={CalendarClockIcon}
              tone={catalog.periodSummaries.length > 0 ? "amber" : "slate"}
              href="/admin/pre-order"
            />
          </>
        )}
      </div>

      {/* Ringkasan kuota periode PO yang sedang terbuka */}
      {catalog && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-cream">Periode Pre-Order Berjalan</h2>
            <Link
              href="/admin/pre-order"
              className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:underline"
            >
              Kelola periode
              <ArrowRightIcon className="size-4" aria-hidden />
            </Link>
          </div>

          {catalog.periodSummaries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#3A3A3A] bg-coal p-6 text-center">
              <CalendarClockIcon className="mx-auto size-8 text-[#6E6E6E]" aria-hidden />
              <p className="mt-2 font-medium text-[#D8D3C7]">
                Tidak ada periode pre-order yang terbuka
              </p>
              <p className="mt-1 text-sm text-cream-muted">
                Periode PO tertutup otomatis setelah melewati tanggal berakhir, sehingga tidak
                ada produk yang bisa dipesan sampai periode baru dibuka.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {catalog.periodSummaries.map((period) => (
                <article
                  key={period.id}
                  className="rounded-xl border border-white/10 bg-coal p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium text-cream">{period.name}</h3>
                      <p className="text-xs text-cream-muted">
                        Ditutup {formatDate(period.endAt)} · {period.productCount} produk ·{" "}
                        {period.variantCount} varian
                      </p>
                    </div>
                    <Badge className="bg-amber-500/15 text-amber-200">Terbuka</Badge>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div
                      role="progressbar"
                      aria-valuenow={period.usedPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Kuota terpakai ${period.usedPercent}%`}
                      className="h-2 w-full overflow-hidden rounded-full bg-raise"
                    >
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          period.usedPercent >= 90 ? "bg-rose-500" : "bg-gold",
                        )}
                        style={{ width: `${Math.min(100, period.usedPercent)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-cream-muted">
                      <span>
                        Terpakai {formatNumber(period.totalReserved)} dari{" "}
                        {formatNumber(period.totalQuota)}
                      </span>
                      <span className="font-medium text-cream">
                        Sisa {formatNumber(period.remaining)}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Pemesanan per angkatan & jurusan */}
      {audience && (
        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-cream">
                Pemesanan per Angkatan & Jurusan
              </h2>
              <p className="text-sm text-cream-muted">
                Pesanan lunas (Dibayar / Diproses / Selesai). Diurut dari yang
                paling sepi — pakai sebagai bahan promosi terarah.
              </p>
            </div>
            <form method="get" action="/admin" className="flex flex-wrap items-center gap-2">
              <label htmlFor="filter-po" className="sr-only">
                Periode
              </label>
              <select
                id="filter-po"
                name="po"
                defaultValue={audienceFilter.periodId}
                className="h-9 rounded-lg border border-white/10 bg-coal px-2.5 text-sm text-[#D8D3C7]"
              >
                <option value="">Semua periode</option>
                {audience.periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </select>
              <label htmlFor="filter-tipe" className="sr-only">
                Tipe pembeli
              </label>
              <select
                id="filter-tipe"
                name="tipe"
                defaultValue={audienceFilter.customerType}
                className="h-9 rounded-lg border border-white/10 bg-coal px-2.5 text-sm text-[#D8D3C7]"
              >
                <option value="">Mahasiswa + Alumni</option>
                <option value="MAHASISWA">Mahasiswa</option>
                <option value="ALUMNI">Alumni</option>
              </select>
              <button
                type="submit"
                className="h-9 rounded-lg bg-gold px-3.5 text-sm font-medium text-obsidian hover:bg-gold-light"
              >
                Tampilkan
              </button>
            </form>
          </div>

          {audience.totalOrders === 0 ? (
            <div className="rounded-xl border border-dashed border-[#3A3A3A] bg-coal p-6 text-center">
              <MegaphoneIcon className="mx-auto size-8 text-[#6E6E6E]" aria-hidden />
              <p className="mt-2 font-medium text-[#D8D3C7]">
                Belum ada pesanan lunas pada filter ini
              </p>
              <p className="mt-1 text-sm text-cream-muted">
                Coba ubah periode atau tipe pembeli di atas.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <AudienceTable
                title="Per Angkatan"
                rows={audience.byBatch}
                emptyLabel="angkatan"
              />
              <AudienceTable
                title="Per Jurusan"
                rows={audience.byProgram}
                emptyLabel="jurusan"
              />
            </div>
          )}
        </section>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {/* Pesanan terbaru */}
        {orders && (
          <section className={catalog ? "xl:col-span-2" : "xl:col-span-3"}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-cream">10 Pesanan Terbaru</h2>
              <Link
                href="/admin/pesanan"
                className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:underline"
              >
                Semua pesanan
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </div>

            <DataTable
              columns={orderColumns}
              rows={orders.rows}
              getRowKey={(row) => row.id}
              empty={
                <div className="flex flex-col items-center gap-2">
                  <ClipboardListIcon className="size-8 text-[#6E6E6E]" aria-hidden />
                  <p className="font-medium text-[#D8D3C7]">Belum ada pesanan</p>
                  <p className="text-sm text-cream-muted">
                    Pesanan pelanggan akan muncul di sini begitu checkout pertama masuk.
                  </p>
                </div>
              }
            />
          </section>
        )}

        {catalog && (
          <div className="space-y-6">
            {/* Kuota varian hampir habis */}
            <section>
              <h2 className="mb-3 text-base font-semibold text-cream">
                Kuota Varian Hampir Habis
              </h2>

              <div className="rounded-xl border border-white/10 bg-coal p-4">
                {catalog.lowQuotaItems.length === 0 ? (
                  <p className="py-2 text-sm text-cream-muted">
                    {catalog.periodSummaries.length === 0
                      ? "Tidak ada periode PO yang terbuka."
                      : "Semua kuota masih aman."}
                  </p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {catalog.lowQuotaItems.map((item) => (
                      <li key={item.key} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/admin/pre-order/${item.periodId}`}
                            className="line-clamp-1 text-sm font-medium text-cream hover:text-gold"
                          >
                            {item.productName} — {item.variantName}
                          </Link>
                          <p className="truncate text-xs text-cream-muted">
                            {item.periodName} · tutup {formatDate(item.periodEndAt)}
                          </p>
                        </div>

                        <Badge
                          className={cn(
                            "shrink-0",
                            item.available === 0
                              ? "bg-red-500/15 text-red-200"
                              : "bg-amber-500/15 text-amber-200",
                          )}
                        >
                          {item.available === 0
                            ? "Habis"
                            : `Sisa ${item.available} ${item.unit}`}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}

                {catalog.lowQuotaTotal > catalog.lowQuotaItems.length && (
                  <p className="mt-3 border-t border-white/5 pt-3 text-xs text-cream-muted">
                    Menampilkan {catalog.lowQuotaItems.length} dari {catalog.lowQuotaTotal}{" "}
                    varian.{" "}
                    <Link
                      href="/admin/pre-order"
                      className="font-medium text-gold hover:underline"
                    >
                      Kelola kuota periode
                    </Link>
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-coal p-4">
              <h2 className="mb-3 text-base font-semibold text-cream">Aksi Cepat</h2>
              <ul className="space-y-2 text-sm">
                {[
                  { href: "/admin/produk/baru", label: "Tambah produk baru", icon: PackageIcon },
                  { href: "/admin/kategori", label: "Kelola kategori", icon: BoxesIcon },
                  {
                    href: "/admin/beranda",
                    label: "Kelola banner & info toko",
                    icon: ArrowRightIcon,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[#D8D3C7] transition-colors hover:bg-obsidian hover:text-gold"
                      >
                        <Icon className="size-4 shrink-0 text-[#8A8A8A]" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        )}
      </div>

      {/*
        Jaring pengaman: peran yang boleh masuk panel tetapi belum diberi
        kemampuan apa pun tidak akan melihat halaman kosong tanpa penjelasan.
      */}
      {!orders && !catalog && (
        <div className="rounded-xl border border-dashed border-[#3A3A3A] bg-coal p-8 text-center">
          <LockIcon className="mx-auto size-8 text-[#6E6E6E]" aria-hidden />
          <p className="mt-2 font-medium text-[#D8D3C7]">Belum ada yang bisa ditampilkan</p>
          <p className="mt-1 text-sm text-cream-muted">
            Akunmu bisa membuka panel, tetapi belum diberi wewenang mengelola pesanan maupun
            katalog. Minta pengurus lain menyesuaikan peranmu.
          </p>
        </div>
      )}
    </>
  );
}

function AudienceTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: AudienceRow[];
  emptyLabel: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.orders));

  return (
    <div className="rounded-xl border border-white/10 bg-coal p-4">
      <h3 className="text-sm font-semibold text-cream">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-3 text-sm text-cream-muted">
          Tidak ada data {emptyLabel} pada filter ini.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((row, index) => (
            <li key={row.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium text-cream-soft">
                  {row.label}
                </span>
                <span className="shrink-0 text-xs text-cream-muted tabular-nums">
                  {formatNumber(row.orders)} order · {formatNumber(row.items)} item ·{" "}
                  {formatRupiah(row.revenue)}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={row.orders}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-label={`${row.label}: ${row.orders} pesanan`}
                className="mt-1 h-2 w-full overflow-hidden rounded-full bg-raise"
              >
                <div
                  className={cn(
                    "h-full rounded-full",
                    index === 0 && row.orders > 0 ? "bg-amber-500" : "bg-gold",
                  )}
                  style={{ width: `${Math.max(4, Math.round((row.orders / max) * 100))}%` }}
                />
              </div>
              {index === 0 && rows.length > 1 && (
                <p className="mt-1 text-xs text-amber-300">
                  Paling sepi — prioritaskan promosi ke sini.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
