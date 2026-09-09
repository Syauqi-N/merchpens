import type { Metadata } from "next";
import Link from "next/link";
import {
  BanknoteIcon,
  ClipboardListIcon,
  DownloadIcon,
  PackageIcon,
  TableIcon,
  TriangleAlertIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { ensurePageCapability } from "@/components/admin/guard";
import { StatCard } from "@/components/admin/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

import { RekapFilters } from "./rekap-filters";
import { getRekap, getRekapFilterOptions, REKAP_MAX_ORDERS } from "./rekap-query";
import { RekapTable } from "./rekap-table";
import {
  adaFilterAktif,
  buildRekapQuery,
  parseRekapFilters,
  parseRekapTab,
  REKAP_ITEM_COLUMNS,
  REKAP_ORDER_COLUMNS,
  REKAP_TAB_HINT,
  REKAP_TAB_LABEL,
  REKAP_TABS,
  type RekapTab,
} from "./schemas";

export const metadata: Metadata = {
  title: "Rekap Pemesan",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** Ambil satu nilai string dari searchParams (abaikan bentuk array). */
function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AdminRekapPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Guard layout tidak cukup: di Next 16 layout dan page dirender bersamaan,
  // sehingga `redirect()` di layout tidak mencegah query di sini ikut berjalan.
  // Panitia distribusi butuh rekap ini, jadi kemampuannya MANAGE_ORDERS.
  await ensurePageCapability("MANAGE_ORDERS", "/admin/rekap");

  const params = await searchParams;

  const filters = parseRekapFilters((key) => firstValue(params[key]));
  const tab = parseRekapTab(firstValue(params.tab));

  const [rekap, options] = await Promise.all([getRekap(filters), getRekapFilterOptions()]);

  const { ringkasan } = rekap;
  const query = buildRekapQuery(filters);
  const exportHref = query ? `/api/admin/rekap/export?${query}` : "/api/admin/rekap/export";

  function tabHref(target: RekapTab): string {
    const search = buildRekapQuery(filters, { tab: target });
    return search ? `/admin/rekap?${search}` : "/admin/rekap";
  }

  const memfilter = adaFilterAktif(filters);
  const kosong = rekap.barisPesanan.length === 0;
  const belumTersaring = ringkasan.nilaiTotal - ringkasan.nilaiLunas;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-cream">Rekap Pemesan</h1>
          <p className="mt-1 max-w-2xl text-sm text-cream-muted">
            Daftar lengkap pembeli untuk hari pengambilan dan pencocokan uang masuk. Cocokkan{" "}
            <strong>kode pesanan</strong> di tabel dengan kode yang dibawa pembeli saat
            menyerahkan barang.
          </p>
        </div>

        <div className="flex flex-col items-start gap-1 lg:items-end">
          <Button
            size="lg"
            nativeButton={false}
            // Tautan biasa, bukan <Link>: yang dituju adalah unduhan berkas,
            // bukan navigasi router.
            render={<a href={exportHref} />}
          >
            <DownloadIcon className="size-4" aria-hidden />
            Unduh Excel
          </Button>
          <p className="text-xs text-cream-muted">
            Berisi persis yang sedang tersaring{memfilter ? "" : " (saat ini: semua pesanan)"}.
          </p>
        </div>
      </div>

      <Card>
        <CardContent>
          {/* `key` membuat state panel ikut tersegar setelah navigasi. */}
          <RekapFilters
            key={`${query}|${tab}`}
            initial={filters}
            options={options}
            tab={tab}
          />
        </CardContent>
      </Card>

      {rekap.terpotong ? (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-200">
          <TriangleAlertIcon className="size-4 text-amber-300" aria-hidden />
          <AlertTitle>Hasil dipotong di {formatNumber(REKAP_MAX_ORDERS)} pesanan</AlertTitle>
          <AlertDescription className="text-amber-200/90">
            Rekap ini terlalu besar untuk ditampilkan sekaligus, jadi hanya{" "}
            {formatNumber(REKAP_MAX_ORDERS)} pesanan terbaru yang dihitung — di layar maupun di
            berkas unduhan. Saring per <strong>periode PO</strong> supaya angkanya utuh.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Pesanan"
          value={formatNumber(ringkasan.jumlahPesanan)}
          hint="Baris pada tab Per Pesanan"
          icon={ClipboardListIcon}
        />
        <StatCard
          label="Total Pembeli"
          value={formatNumber(ringkasan.jumlahPembeli)}
          hint="Satu orang bisa memesan berkali-kali"
          icon={UsersIcon}
          tone="slate"
        />
        <StatCard
          label="Total item"
          value={formatNumber(ringkasan.totalItem)}
          hint="Banyaknya barang yang harus disiapkan"
          icon={PackageIcon}
          tone="amber"
        />
        <StatCard
          label="Nilai lunas"
          value={formatRupiah(ringkasan.nilaiLunas)}
          hint="Uang yang sudah masuk"
          icon={BanknoteIcon}
          tone="emerald"
        />
        <StatCard
          label="Nilai keseluruhan"
          value={formatRupiah(ringkasan.nilaiTotal)}
          hint={
            belumTersaring > 0
              ? `${formatRupiah(belumTersaring)} belum lunas`
              : "Seluruhnya sudah lunas"
          }
          icon={WalletIcon}
          tone={belumTersaring > 0 ? "rose" : "emerald"}
        />
      </div>

      {kosong ? (
        <EmptyState
          icon={<TableIcon className="size-6" aria-hidden />}
          title={memfilter ? "Tidak ada yang cocok" : "Belum ada pesanan untuk direkap"}
          description={
            memfilter
              ? "Tidak ada pesanan yang cocok dengan filter yang kamu pilih. Coba longgarkan filternya, atau centang opsi menampilkan pesanan yang dibatalkan."
              : "Begitu pembeli pertama menyelesaikan pemesanan, daftarnya muncul di sini dan langsung bisa kamu unduh sebagai Excel."
          }
          action={
            memfilter ? (
              <Button
  nativeButton={false} variant="outline" render={<Link href="/admin/rekap" />}>
                Bersihkan filter
              </Button>
            ) : (
              <Button
  nativeButton={false} variant="outline" render={<Link href="/admin/pre-order" />}>
                Kelola periode pre-order
              </Button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {/* Tab berupa TAUTAN, bukan tab ARIA: setiap tab adalah URL tersendiri
              dan hanya tab aktif yang dirender di server — tidak ada tabel
              tersembunyi yang ikut terkirim ke browser. */}
          <nav className="flex flex-wrap items-center gap-2" aria-label="Bentuk rekap">
            {REKAP_TABS.map((value) => {
              const active = value === tab;
              return (
                <Link
                  key={value}
                  href={tabHref(value)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-gold text-obsidian shadow-sm"
                      : "bg-raise text-cream-muted hover:bg-[#2A2A2A] hover:text-cream",
                  )}
                >
                  {REKAP_TAB_LABEL[value]}
                </Link>
              );
            })}

            <p className="text-xs text-cream-muted">{REKAP_TAB_HINT[tab]}</p>
          </nav>

          {tab === "pesanan" ? (
            <RekapTable
              columns={REKAP_ORDER_COLUMNS}
              rows={rekap.barisPesanan}
              rowKey={(row) => row.id}
              caption="Rekap per pesanan"
            />
          ) : (
            <RekapTable
              columns={REKAP_ITEM_COLUMNS}
              rows={rekap.barisItem}
              rowKey={(row) => row.id}
              caption="Rekap per item pesanan"
            />
          )}

          <p className="text-xs text-cream-muted">
            {tab === "pesanan"
              ? `${formatNumber(rekap.barisPesanan.length)} baris pesanan`
              : `${formatNumber(rekap.barisItem.length)} baris item dari ${formatNumber(
                  rekap.barisPesanan.length,
                )} pesanan`}
            {rekap.periode ? ` · periode ${rekap.periode.name}` : ""} · geser ke samping untuk
            melihat kolom lainnya.
          </p>
        </div>
      )}
    </div>
  );
}
