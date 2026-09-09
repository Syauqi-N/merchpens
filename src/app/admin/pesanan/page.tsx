import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, ClipboardListIcon } from "lucide-react";

import { ensurePageCapability } from "@/components/admin/guard";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Prisma } from "@/generated/prisma/client";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { processPaidOrdersForClosedPeriods } from "@/lib/order-processing";
import { prisma } from "@/lib/prisma";

import { OrderFilters, type OrderFilterState } from "./order-filters";
import { OrderPrintTable } from "./order-print-table";
import {
  PAGE_SIZE,
  fulfillmentTypeSchema,
  orderSearchSchema,
  orderStatusSchema,
} from "./schemas";

export const metadata: Metadata = {
  title: "Pesanan",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** Ambil satu nilai string dari searchParams (abaikan bentuk array). */
function readParam(
  params: Awaited<SearchParams>,
  key: string,
): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** "2026-07-01" → awal hari waktu server. Mengembalikan null bila tidak valid. */
function parseDayStart(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "2026-07-31" → akhir hari, supaya rentang tanggal bersifat inklusif. */
function parseDayEnd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Guard layout tidak cukup: layout dan page dirender bersamaan, sehingga
  // `redirect()` di layout tidak mencegah query di sini ikut berjalan.
  await ensurePageCapability("MANAGE_ORDERS", "/admin/pesanan");

  // Jaring pengaman lokal: di produksi cron menjalankan hal yang sama. Dengan
  // ini status tetap segar saat admin membuka daftar tepat setelah `endAt`.
  try {
    await processPaidOrdersForClosedPeriods();
  } catch (error) {
    console.error("[admin/pesanan] gagal memproses periode yang ditutup:", error);
  }

  const params = await searchParams;

  const q = orderSearchSchema.parse(readParam(params, "q"));
  const statusParam = readParam(params, "status");
  const terimaParam = readParam(params, "terima");
  const dari = readParam(params, "dari");
  const sampai = readParam(params, "sampai");

  // Status yang tidak dikenal diperlakukan sebagai "tidak difilter" — URL yang
  // diketik sembarangan tidak boleh membuat halaman gagal render.
  const parsedStatus = orderStatusSchema.safeParse(statusParam);
  const status = parsedStatus.success ? parsedStatus.data : null;

  // Filter cara terima (dipakai dashboard: /admin/pesanan?terima=SHIPPED).
  const parsedTerima = fulfillmentTypeSchema.safeParse(terimaParam);
  const terima = parsedTerima.success ? parsedTerima.data : null;

  const halamanRaw = Number.parseInt(readParam(params, "halaman"), 10);
  const requestedPage = Number.isFinite(halamanRaw) && halamanRaw > 0 ? halamanRaw : 1;

  const createdAt: Prisma.DateTimeFilter = {};
  const dariDate = parseDayStart(dari);
  const sampaiDate = parseDayEnd(sampai);
  if (dariDate) createdAt.gte = dariDate;
  if (sampaiDate) createdAt.lte = sampaiDate;

  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(terima ? { fulfillmentType: terima } : {}),
    ...(dariDate || sampaiDate ? { createdAt } : {}),
    // Nilai `q` selalu masuk sebagai argumen Prisma (parameterized), tidak
    // pernah dirakit ke dalam SQL.
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" } },
            { customerName: { contains: q, mode: "insensitive" } },
            { customerEmail: { contains: q, mode: "insensitive" } },
            { customerBatch: { contains: q, mode: "insensitive" } },
            { customerProgram: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const total = await prisma.order.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerEmail: true,
      customerType: true,
      customerBatch: true,
      customerProgram: true,
      fulfillmentType: true,
      createdAt: true,
      total: true,
      status: true,
      payment: { select: { status: true } },
      items: { select: { variantName: true } },
    },
  });

  const filters: OrderFilterState = {
    q,
    status: status ?? "",
    terima: terima ?? "",
    dari: dariDate ? dari : "",
    sampai: sampaiDate ? sampai : "",
  };

  /** Tautan paginasi yang mempertahankan seluruh filter aktif. */
  function pageHref(target: number): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) next.set(key, value);
    }
    if (target > 1) next.set("halaman", String(target));
    const query = next.toString();
    return query ? `/admin/pesanan?${query}` : "/admin/pesanan";
  }

  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = (page - 1) * PAGE_SIZE + orders.length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-cream">Pesanan</h1>
        <p className="mt-1 text-sm text-cream-muted">
          Kelola pembayaran, pengambilan barang, dan pembatalan pesanan pelanggan.
        </p>
      </div>

      <Card>
        <CardContent>
          <OrderFilters key={JSON.stringify(filters)} initial={filters} />
        </CardContent>
      </Card>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardListIcon className="size-6" aria-hidden />}
          title="Tidak ada pesanan"
          description={
            total === 0 && !q && !status && !terima && !dari && !sampai
              ? "Pesanan pelanggan akan muncul di sini setelah checkout pertama."
              : "Tidak ada pesanan yang cocok dengan filter yang kamu pilih."
          }
        />
      ) : (
        <Card className="py-0">
          <OrderPrintTable
            rows={orders.map((order) => {
              const variantNames = [
                ...new Set(
                  order.items
                    .map((item) => item.variantName?.trim())
                    .filter((name): name is string => Boolean(name)),
                ),
              ];
              return {
                id: order.id,
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                customerEmail: order.customerEmail,
                customerType: order.customerType,
                customerBatch: order.customerBatch,
                customerProgram: order.customerProgram,
                fulfillmentType: order.fulfillmentType,
                variantLabel: variantNames.join(", "),
                createdAt: formatDateTime(order.createdAt),
                total: formatRupiah(order.total),
                paymentStatus: order.payment?.status ?? null,
                status: order.status,
                printable: ["PAID", "PROCESSING", "COMPLETED"].includes(
                  order.status,
                ),
              };
            })}
          />

          <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-cream-muted">
              Menampilkan {firstRow}–{lastRow} dari {total} pesanan
            </p>

            {pageCount > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  render={page <= 1 ? <span /> : <Link href={pageHref(page - 1)} />}
                >
                  <ChevronLeftIcon className="size-3.5" aria-hidden />
                  Sebelumnya
                </Button>

                <span className="text-xs text-cream-muted">
                  Halaman {page} dari {pageCount}
                </span>

                <Button
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount}
                  render={page >= pageCount ? <span /> : <Link href={pageHref(page + 1)} />}
                >
                  Berikutnya
                  <ChevronRightIcon className="size-3.5" aria-hidden />
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      )}
    </div>
  );
}
