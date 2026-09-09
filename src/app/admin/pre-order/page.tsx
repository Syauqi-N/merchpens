import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClockIcon,
  PackageIcon,
  PlusIcon,
  SettingsIcon,
  TimerOffIcon,
} from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { ensurePageCapability } from "@/components/admin/guard";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatNumber } from "@/lib/format";
import { isPeriodOpen } from "@/lib/preorder";
import { prisma } from "@/lib/prisma";

import { PeriodStateBadge, PeriodStatusBadge, describePeriod } from "./period-state";
import type { PeriodStateInfo } from "./period-state";
import type { PreOrderStatus } from "@/generated/prisma/client";

export const metadata: Metadata = {
  title: "Periode Pre-Order",
};

type PeriodListRow = {
  id: string;
  name: string;
  slug: string;
  startAt: Date;
  endAt: Date;
  closedAt: Date | null;
  status: PreOrderStatus;
  productCount: number;
  variantCount: number;
  totalQuota: number;
  totalReserved: number;
  open: boolean;
  state: PeriodStateInfo;
  countdown: string;
};

/** Label hitung mundur / hitung naik berbahasa Indonesia untuk daftar periode. */
function describeCountdown(
  period: { startAt: Date; endAt: Date; closedAt: Date | null; status: PreOrderStatus },
  open: boolean,
  now: Date,
): string {
  if (open) {
    return `Berakhir dalam ${formatDuration(period.endAt.getTime() - now.getTime())}`;
  }
  if (period.status === "CLOSED") {
    return period.closedAt
      ? `Ditutup manual ${formatDateTime(period.closedAt)}`
      : "Ditutup manual";
  }
  if (period.status === "DRAFT") {
    return "Belum dibuka — masih draf";
  }
  if (period.startAt > now) {
    return `Mulai dalam ${formatDuration(period.startAt.getTime() - now.getTime())}`;
  }
  return `Berakhir ${formatDuration(now.getTime() - period.endAt.getTime())} lalu`;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days} hari${hours > 0 ? ` ${hours} jam` : ""}`;
  }
  if (hours > 0) {
    return `${hours} jam${minutes > 0 ? ` ${minutes} mnt` : ""}`;
  }
  return `${minutes} mnt`;
}

export default async function AdminPreOrderPage() {
  // Otorisasi diulang di page — layout dan page dirender bersamaan sehingga
  // `redirect()` di layout tidak menghentikan query di bawah ini.
  await ensurePageCapability("MANAGE_CATALOG", "/admin/pre-order");

  const now = new Date();

  const periods = await prisma.preOrderPeriod.findMany({
    orderBy: [{ startAt: "desc" }],
    include: {
      items: {
        include: {
          variantQuotas: { select: { quota: true, reserved: true } },
        },
      },
    },
  });

  const rows: PeriodListRow[] = periods.map((period) => {
    const variantRows = period.items.flatMap((item) => item.variantQuotas);
    const totalQuota = variantRows.reduce((sum, row) => sum + row.quota, 0);
    const totalReserved = variantRows.reduce((sum, row) => sum + row.reserved, 0);
    const open = isPeriodOpen(period, now);

    return {
      id: period.id,
      name: period.name,
      slug: period.slug,
      startAt: period.startAt,
      endAt: period.endAt,
      closedAt: period.closedAt,
      status: period.status,
      productCount: period.items.length,
      variantCount: variantRows.length,
      totalQuota,
      totalReserved,
      open,
      state: describePeriod(period, open, now),
      countdown: describeCountdown(period, open, now),
    };
  });

  const openCount = rows.filter((row) => row.open).length;
  const grandQuota = rows.reduce((sum, row) => sum + row.totalQuota, 0);
  const grandReserved = rows.reduce((sum, row) => sum + row.totalReserved, 0);

  const columns: DataTableColumn<PeriodListRow>[] = [
    {
      key: "periode",
      header: "Periode",
      className: "min-w-48 whitespace-normal",
      cell: (row) => (
        <div className="min-w-0">
          <Link
            href={`/admin/pre-order/${row.id}`}
            className="font-medium text-gold underline-offset-4 hover:underline"
          >
            {row.name}
          </Link>
          <p className="truncate font-mono text-xs text-cream-muted">/{row.slug}</p>
          <p className="mt-1 text-xs text-cream-muted">{row.countdown}</p>
        </div>
      ),
    },
    {
      key: "jadwal",
      header: "Jadwal",
      className: "text-sm whitespace-normal text-cream-muted",
      cell: (row) => (
        <div className="space-y-0.5">
          <p>{formatDateTime(row.startAt)}</p>
          <p>s.d. {formatDateTime(row.endAt)}</p>
        </div>
      ),
    },
    {
      key: "keadaan",
      header: "Keadaan",
      className: "whitespace-normal",
      cell: (row) => (
        <div className="space-y-1">
          <PeriodStateBadge state={row.state} />
          <p className="text-xs text-cream-muted">{row.state.description}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <PeriodStatusBadge status={row.status} />,
    },
    {
      key: "produk",
      header: "Produk",
      className: "text-right tabular-nums",
      headerClassName: "text-right",
      cell: (row) => (
        <div className="text-right">
          <p className="text-sm font-medium text-cream">{formatNumber(row.productCount)}</p>
          <p className="text-xs text-cream-muted">{formatNumber(row.variantCount)} varian</p>
        </div>
      ),
    },
    {
      key: "kuota",
      header: "Kuota varian",
      className: "text-right tabular-nums",
      headerClassName: "text-right",
      cell: (row) => (
        <div className="text-right">
          <p className="text-sm font-medium text-cream">{formatNumber(row.totalQuota)}</p>
          <p className="text-xs text-cream-muted">
            terpakai {formatNumber(row.totalReserved)}
            {row.totalQuota > 0
              ? ` (${Math.round((row.totalReserved / row.totalQuota) * 100)}%)`
              : ""}
          </p>
          <p className="text-xs text-cream-muted">
            sisa {formatNumber(Math.max(0, row.totalQuota - row.totalReserved))}
          </p>
        </div>
      ),
    },
    {
      key: "aksi",
      header: <span className="sr-only">Aksi</span>,
      className: "text-right",
      headerClassName: "text-right",
      cell: (row) => (
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          render={<Link href={`/admin/pre-order/${row.id}`} />}
        >
          <SettingsIcon className="size-3.5" aria-hidden />
          Kelola
        </Button>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Periode Pre-Order"
        description="Atur batch pre-order beserta kuota tiap variannya. Kuota dihitung per varian, bukan per produk."
        action={
          <Button
            nativeButton={false}
            className="h-10 gap-1.5 bg-gold text-obsidian hover:bg-gold-light"
            render={<Link href="/admin/pre-order/baru" />}
          >
            <PlusIcon className="size-4" aria-hidden />
            Buat Periode Baru
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total periode"
          value={formatNumber(rows.length)}
          hint={
            openCount === 0
              ? "tidak ada yang sedang terbuka"
              : `${openCount} sedang terbuka`
          }
          icon={CalendarClockIcon}
          tone="slate"
        />
        <StatCard
          label="Sedang terbuka"
          value={formatNumber(openCount)}
          hint="maksimal 1 dalam satu waktu"
          icon={TimerOffIcon}
          tone={openCount > 1 ? "rose" : openCount === 1 ? "emerald" : "sky"}
        />
        <StatCard
          label="Total kuota varian"
          value={formatNumber(grandQuota)}
          hint="akumulasi semua periode"
          icon={PackageIcon}
          tone="sky"
        />
        <StatCard
          label="Total terpakai"
          value={formatNumber(grandReserved)}
          hint={
            grandQuota > 0
              ? `sisa ${formatNumber(Math.max(0, grandQuota - grandReserved))}`
              : "belum ada kuota"
          }
          icon={PackageIcon}
          tone="amber"
        />
      </div>

      <Alert className="mb-5 border-gold/30 bg-gold/10 text-gold-light">
        <TimerOffIcon className="size-4 text-gold" aria-hidden />
        <AlertTitle>Periode pre-order menutup otomatis</AlertTitle>
        <AlertDescription className="text-gold-light/90">
          <p>
            Sebuah periode hanya dianggap <strong>terbuka</strong> bila statusnya{" "}
            <strong>Aktif</strong> <em>dan</em> waktu sekarang berada di antara tanggal mulai dan
            tanggal berakhir. Begitu tanggal berakhir terlewati, pemesanan berhenti dengan
            sendirinya.
          </p>
          <p>
            Jadi <strong>tidak perlu lagi mengubah sisa kuota menjadi 0 secara manual</strong>{" "}
            seperti di sistem lama. Angka <em>terpakai</em> sengaja dipertahankan sebagai catatan
            berapa banyak yang sudah dipesan pada batch tersebut. Tombol{" "}
            <strong>Tutup Sekarang</strong> hanya diperlukan bila kamu ingin menghentikan
            pemesanan lebih awal dari jadwal.
          </p>
        </AlertDescription>
      </Alert>

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarClockIcon className="size-6" aria-hidden />}
          title="Belum ada periode pre-order"
          description="Buat periode pertama untuk mulai membuka pemesanan produk pre-order."
          action={
            <Button nativeButton={false} render={<Link href="/admin/pre-order/baru" />}>
              <PlusIcon className="size-4" aria-hidden />
              Buat Periode Baru
            </Button>
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
          />
          <p className="mt-3 text-xs text-cream-muted">
            {rows.length} periode ·{" "}
            {openCount === 0
              ? "tidak ada yang sedang terbuka"
              : `${openCount} sedang terbuka untuk pemesanan`}
          </p>
        </>
      )}
    </>
  );
}
