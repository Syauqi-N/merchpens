"use client";

import Image from "next/image";
import { ImageOffIcon, LayersIcon } from "lucide-react";

import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { ToggleActive } from "@/components/admin/toggle-active";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteVariant, setVariantActive } from "./actions";
import { VariantFormDialog } from "./variant-form";
import type { VariantFormValues } from "./schemas";

export type VariantManagerItem = {
  id: string;
  name: string;
  size: string | null;
  design: string | null;
  sku: string | null;
  priceDelta: number;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  /** Berapa baris kuota PO yang memakai varian ini. */
  quotaCount: number;
  /** Berapa baris pesanan yang memakai varian ini. */
  orderItemCount: number;
};

export type VariantManagerProps = {
  productId: string;
  productPrice: number;
  variants: VariantManagerItem[];
};

function toFormValues(variant: VariantManagerItem): VariantFormValues {
  return {
    name: variant.name,
    size: variant.size ?? "",
    design: variant.design ?? "",
    sku: variant.sku ?? "",
    priceDelta: String(variant.priceDelta),
    imageUrl: variant.imageUrl ?? "",
    sortOrder: String(variant.sortOrder),
    isActive: variant.isActive,
  };
}

export function VariantManager({ productId, productPrice, variants }: VariantManagerProps) {
  const nextSortOrder =
    variants.length === 0 ? 0 : Math.max(...variants.map((v) => v.sortOrder)) + 1;

  const columns: DataTableColumn<VariantManagerItem>[] = [
    {
      key: "foto",
      header: "Foto",
      cell: (row) => (
        <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-obsidian">
          {row.imageUrl ? (
            <Image
              src={row.imageUrl}
              alt=""
              fill
              sizes="44px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="grid size-full place-items-center text-[#6E6E6E]">
              <ImageOffIcon className="size-4" aria-hidden />
            </span>
          )}
        </div>
      ),
    },
    {
      key: "varian",
      header: "Varian",
      className: "min-w-44 whitespace-normal",
      cell: (row) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-cream">{row.name}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {row.size ? (
              <Badge className="bg-raise text-[#D8D3C7]">Size {row.size}</Badge>
            ) : null}
            {row.design ? (
              <Badge className="bg-gold/10 text-gold">{row.design}</Badge>
            ) : null}
            {!row.size && !row.design && (
              <span className="text-xs text-[#8A8A8A]">Tanpa size/desain</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      className: "font-mono text-xs text-cream-muted",
      cell: (row) => row.sku ?? <span className="font-sans text-[#8A8A8A]">—</span>,
    },
    {
      key: "harga",
      header: "Selisih & Final",
      className: "text-right whitespace-nowrap",
      headerClassName: "text-right",
      cell: (row) => {
        const finalPrice = productPrice + row.priceDelta;
        return (
          <div className="text-right">
            <p
              className={cn(
                "text-sm font-medium tabular-nums",
                row.priceDelta > 0
                  ? "text-cream"
                  : row.priceDelta < 0
                    ? "text-emerald-300"
                    : "text-cream-muted",
              )}
            >
              {row.priceDelta === 0
                ? "± Rp0"
                : `${row.priceDelta > 0 ? "+" : "−"}${formatRupiah(Math.abs(row.priceDelta)).replace("Rp", "Rp")}`}
            </p>
            <p className="text-xs text-cream-muted tabular-nums">
              Final: {formatRupiah(finalPrice)}
            </p>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Aktif",
      cell: (row) => (
        <ToggleActive
          checked={row.isActive}
          label={`Status aktif varian ${row.name}`}
          onToggle={(next) => setVariantActive(row.id, next)}
        />
      ),
    },
    {
      key: "aksi",
      header: <span className="sr-only">Aksi</span>,
      className: "text-right",
      headerClassName: "text-right",
      cell: (row) => {
        const used = row.quotaCount > 0 || row.orderItemCount > 0;
        return (
          <div className="flex items-center justify-end gap-1">
            <VariantFormDialog
              mode="edit"
              productId={productId}
              productPrice={productPrice}
              variantId={row.id}
              variantName={row.name}
              defaultValues={toFormValues(row)}
            />
            <ConfirmDeleteDialog
              title={used ? `Nonaktifkan "${row.name}"?` : `Hapus "${row.name}"?`}
              description={
                used
                  ? "Varian ini sudah dipakai kuota pre-order atau pesanan, jadi tidak bisa dihapus agar riwayatnya tetap utuh. Varian akan dinonaktifkan sehingga tidak bisa dipesan lagi."
                  : "Varian akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
              }
              confirmLabel={used ? "Nonaktifkan" : "Hapus"}
              triggerLabel={used ? `Nonaktifkan ${row.name}` : `Hapus ${row.name}`}
              onConfirm={() => deleteVariant(row.id)}
            />
          </div>
        );
      },
    },
  ];

  return (
    <section className="rounded-xl border border-white/10 bg-coal p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-base font-semibold text-cream">
            <LayersIcon className="size-4 text-[#8A8A8A]" aria-hidden />
            Varian Produk
            <span className="rounded-full bg-raise px-2 py-0.5 text-xs font-medium text-cream-muted tabular-nums">
              {variants.filter((v) => v.isActive).length} aktif / {variants.length} total
            </span>
          </h2>
          <p className="max-w-xl text-sm text-cream-muted">
            Contoh: Size S–XXL atau tiap desain. Harga final tiap varian = harga normal
            produk ({formatRupiah(productPrice)}) + selisih harga varian. Varian yang
            sudah dipakai kuota PO atau pesanan tidak bisa dihapus — cukup nonaktifkan.
          </p>
        </div>
        <VariantFormDialog
          mode="create"
          productId={productId}
          productPrice={productPrice}
          nextSortOrder={nextSortOrder}
        />
      </div>

      <DataTable
        columns={columns}
        rows={variants}
        getRowKey={(row) => row.id}
        empty={
          <div className="flex flex-col items-center gap-2">
            <LayersIcon className="size-8 text-[#6E6E6E]" aria-hidden />
            <p className="font-medium text-[#D8D3C7]">Belum ada varian</p>
            <p className="max-w-sm text-sm text-cream-muted">
              Tambahkan minimal satu varian (mis. &quot;Size M&quot;) supaya produk bisa
              diberi kuota per varian di periode pre-order.
            </p>
          </div>
        }
      />
    </section>
  );
}
