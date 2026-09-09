import type { Metadata } from "next";
import Image from "next/image";
import { ExternalLinkIcon, ImageIcon, StoreIcon } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ensurePageCapability } from "@/components/admin/guard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { BannerFormDialog } from "./banner-form";
import { BannerActiveToggle, BannerDeleteButton } from "./banner-row-actions";
import {
  STORE_SETTING_KEYS,
  masterListToText,
  type BannerFormValues,
  type StoreSettingsValues,
} from "./schemas";
import { StoreSettingsForm } from "./store-settings-form";

export const metadata: Metadata = { title: "Kelola Beranda" };

type BannerRow = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  formValues: BannerFormValues;
};

export default async function AdminHomepagePage() {
  await ensurePageCapability("MANAGE_CATALOG", "/admin/beranda");

  const [banners, settingRows] = await Promise.all([
    prisma.banner.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.setting.findMany({ select: { key: true, value: true } }),
  ]);

  // Nilai MENTAH dari database — berbeda dengan `getSettings()` yang sengaja
  // mengganti nilai kosong dengan teks bawaan untuk kebutuhan tampilan toko.
  // Di form admin, isian yang sengaja dikosongkan harus tetap terlihat kosong.
  const stored = new Map(settingRows.map((row) => [row.key, row.value]));
  const settingsValues = Object.fromEntries(
    STORE_SETTING_KEYS.map((key) => {
      const raw = stored.get(key) ?? DEFAULT_SETTINGS[key] ?? "";
      // Master dropdown disimpan JSON — tampilkan satu entri per baris.
      const text =
        key === "angkatan_list" || key === "jurusan_list" ? masterListToText(raw) : raw;
      return [key, text];
    }),
  ) as StoreSettingsValues;

  const rows: BannerRow[] = banners.map((banner) => ({
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle,
    imageUrl: banner.imageUrl,
    linkUrl: banner.linkUrl,
    sortOrder: banner.sortOrder,
    isActive: banner.isActive,
    formValues: {
      title: banner.title,
      subtitle: banner.subtitle ?? "",
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl ?? "",
      sortOrder: String(banner.sortOrder),
      isActive: banner.isActive,
    },
  }));

  const nextSortOrder =
    rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.sortOrder)) + 1;
  const activeBanners = rows.filter((row) => row.isActive).length;

  const columns: DataTableColumn<BannerRow>[] = [
    {
      key: "order",
      header: "Urutan",
      className: "w-16 text-center text-sm tabular-nums text-cream-muted",
      headerClassName: "w-16 text-center",
      cell: (row) => row.sortOrder,
    },
    {
      key: "banner",
      header: "Banner",
      className: "min-w-72 whitespace-normal",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-obsidian">
            <Image
              src={row.imageUrl}
              alt=""
              fill
              sizes="96px"
              className="object-cover"
              unoptimized
            />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium text-cream">{row.title}</p>
            {row.subtitle && (
              <p className="line-clamp-2 text-xs text-cream-muted">{row.subtitle}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "link",
      header: "Tautan",
      className: "max-w-56 whitespace-normal",
      cell: (row) =>
        row.linkUrl ? (
          <span className="inline-flex items-center gap-1 font-mono text-xs break-all text-cream-muted">
            <ExternalLinkIcon className="size-3.5 shrink-0 text-[#8A8A8A]" aria-hidden />
            {row.linkUrl}
          </span>
        ) : (
          <span className="text-[#8A8A8A]">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <BannerActiveToggle id={row.id} title={row.title} isActive={row.isActive} />
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Aksi</span>,
      className: "text-right",
      headerClassName: "text-right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <BannerFormDialog
            mode="edit"
            bannerId={row.id}
            bannerTitle={row.title}
            defaultValues={row.formValues}
          />
          <BannerDeleteButton id={row.id} title={row.title} />
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Kelola Beranda"
        description="Atur banner promosi serta informasi toko yang tampil di beranda, header, dan footer."
      />

      <Tabs defaultValue="banner" className="gap-4">
        <TabsList className="h-10">
          <TabsTrigger value="banner" className="gap-1.5 px-3">
            <ImageIcon className="size-4" aria-hidden />
            Banner ({rows.length})
          </TabsTrigger>
          <TabsTrigger value="informasi" className="gap-1.5 px-3">
            <StoreIcon className="size-4" aria-hidden />
            Informasi Toko
          </TabsTrigger>
        </TabsList>

        {/* `keepMounted` menjaga isian form tetap ada saat berpindah tab. */}
        <TabsContent value="banner" keepMounted className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-cream-muted">
              {rows.length === 0
                ? "Belum ada banner."
                : `${activeBanners} dari ${rows.length} banner sedang tampil di beranda.`}
            </p>
            <BannerFormDialog mode="create" nextSortOrder={nextSortOrder} />
          </div>

          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            empty={
              <div className="flex flex-col items-center gap-2">
                <ImageIcon className="size-8 text-[#6E6E6E]" aria-hidden />
                <p className="font-medium text-[#D8D3C7]">Belum ada banner</p>
                <p className="text-sm text-cream-muted">
                  Tambahkan banner untuk menyorot promo atau periode pre-order.
                </p>
              </div>
            }
          />
        </TabsContent>

        <TabsContent value="informasi" keepMounted>
          <StoreSettingsForm defaultValues={settingsValues} />
        </TabsContent>
      </Tabs>
    </>
  );
}
