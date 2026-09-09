"use client";

import { useState, useTransition } from "react";
import {
  Loader2Icon,
  PackagePlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  addProductToPeriod,
  addVariantQuota,
  removePreOrderItem,
  removeVariantQuota,
  updatePreOrderItemPrice,
  updateVariantQuota,
} from "../actions";

export type VariantQuotaRow = {
  quotaId: string;
  variantId: string;
  variantName: string;
  size: string | null;
  design: string | null;
  priceDelta: number;
  isActive: boolean;
  quota: number;
  reserved: number;
  price: number | null;
  orderItemCount: number;
  effectivePrice: number;
};

export type MissingVariant = {
  variantId: string;
  variantName: string;
  size: string | null;
  design: string | null;
  priceDelta: number;
};

export type PeriodProductGroup = {
  preOrderItemId: string;
  productId: string;
  productName: string;
  unit: string;
  basePrice: number;
  itemPrice: number | null;
  isActive: boolean;
  orderItemCount: number;
  quotas: VariantQuotaRow[];
  missing: MissingVariant[];
};

export type ProductCandidate = {
  id: string;
  name: string;
  price: number;
  unit: string;
  variantCount: number;
};

function priceToInput(price: number | null): string {
  return price === null ? "" : String(price);
}

function variantLabel(row: { variantName: string; size: string | null; design: string | null }): string {
  const parts = [row.variantName];
  if (row.size) parts.push(row.size);
  if (row.design) parts.push(row.design);
  // Hindari duplikasi bila nama sudah memuat size/desain.
  return [...new Set(parts)].join(" · ");
}

function barTone(percent: number): string {
  if (percent >= 100) return "[&_[data-slot=progress-indicator]]:bg-rose-500";
  if (percent >= 80) return "[&_[data-slot=progress-indicator]]:bg-amber-500";
  return "[&_[data-slot=progress-indicator]]:bg-emerald-500";
}

type RunAction = (action: () => Promise<{ ok: boolean; message: string }>, onSuccess?: () => void) => void;

function VariantQuotaEditor({
  row,
  busy,
  onSave,
  onRemove,
}: {
  row: VariantQuotaRow;
  busy: boolean;
  onSave: (quotaId: string, quota: string, price: string) => void;
  onRemove: (quotaId: string) => void;
}) {
  const [quota, setQuota] = useState(String(row.quota));
  const [price, setPrice] = useState(priceToInput(row.price));
  const [confirmRemove, setConfirmRemove] = useState(false);

  const dirty = quota !== String(row.quota) || price !== priceToInput(row.price);
  const remaining = Math.max(0, row.quota - row.reserved);
  const percent = row.quota > 0 ? Math.min(100, (row.reserved / row.quota) * 100) : 0;
  const locked = row.orderItemCount > 0 || row.reserved > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-coal p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-cream">{variantLabel(row)}</p>
          <p className="text-xs text-cream-muted">
            Harga berlaku {formatRupiah(row.effectivePrice)}
            {row.price !== null ? " · override varian" : ""}
            {row.priceDelta !== 0
              ? ` · delta ${row.priceDelta > 0 ? "+" : ""}${formatRupiah(row.priceDelta)}`
              : ""}
          </p>
        </div>

        <div className="text-right text-sm">
          <p className="tabular-nums text-cream">
            <strong>{row.reserved}</strong> terpakai dari {row.quota}
          </p>
          <p className={cn("text-xs tabular-nums", remaining === 0 ? "text-rose-600" : "text-cream-muted")}>
            Sisa {remaining}
          </p>
        </div>
      </div>

      <Progress value={percent} className={barTone(percent)} />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={`quota-${row.quotaId}`} className="text-xs text-cream-muted">
            Kuota
          </Label>
          <Input
            id={`quota-${row.quotaId}`}
            type="number"
            inputMode="numeric"
            min={row.reserved}
            value={quota}
            onChange={(event) => setQuota(event.target.value)}
            className="h-9"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`vprice-${row.quotaId}`} className="text-xs text-cream-muted">
            Harga khusus varian (opsional)
          </Label>
          <Input
            id={`vprice-${row.quotaId}`}
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Kosong = ikut harga produk"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="h-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button size="lg" disabled={busy || !dirty} onClick={() => onSave(row.quotaId, quota, price)}>
            <SaveIcon className="size-4" aria-hidden />
            Simpan
          </Button>

          <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
            <AlertDialogTrigger
              render={
                <Button
                  variant="destructive"
                  size="icon-lg"
                  disabled={busy}
                  aria-label={`Keluarkan varian ${row.variantName} dari periode`}
                />
              }
            >
              <Trash2Icon className="size-4" aria-hidden />
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-rose-500/15 text-rose-300">
                  <Trash2Icon aria-hidden />
                </AlertDialogMedia>
                <AlertDialogTitle>Keluarkan {variantLabel(row)}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {locked
                    ? "Varian ini sudah dipesan pelanggan pada periode ini, jadi kemungkinan besar penghapusan akan ditolak demi menjaga riwayat pesanan. Turunkan kuotanya ke jumlah yang sudah terpakai bila ingin menghentikan pemesanan."
                    : "Varian ini akan dikeluarkan dari periode dan tidak bisa dipesan lagi lewat batch ini."}
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    onRemove(row.quotaId);
                    setConfirmRemove(false);
                  }}
                >
                  Ya, keluarkan
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {Number(quota) < row.reserved ? (
        <p className="text-xs text-rose-600">
          Kuota tidak boleh di bawah {row.reserved} yang sudah dipesan pelanggan.
        </p>
      ) : null}
    </div>
  );
}

function MissingVariantRow({
  preOrderItemId,
  missing,
  busy,
  onAdd,
}: {
  preOrderItemId: string;
  missing: MissingVariant;
  busy: boolean;
  onAdd: (preOrderItemId: string, variantId: string, quota: string, price: string) => void;
}) {
  const [quota, setQuota] = useState("50");
  const [price, setPrice] = useState("");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-[#3A3A3A] bg-obsidian/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-cream">{variantLabel(missing)}</p>
          <p className="text-xs text-cream-muted">
            Belum masuk periode
            {missing.priceDelta !== 0
              ? ` · delta ${missing.priceDelta > 0 ? "+" : ""}${formatRupiah(missing.priceDelta)}`
              : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={`addquota-${missing.variantId}`} className="text-xs text-cream-muted">
            Kuota awal
          </Label>
          <Input
            id={`addquota-${missing.variantId}`}
            type="number"
            inputMode="numeric"
            min={0}
            value={quota}
            onChange={(event) => setQuota(event.target.value)}
            className="h-9 bg-coal"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`addprice-${missing.variantId}`} className="text-xs text-cream-muted">
            Harga khusus (opsional)
          </Label>
          <Input
            id={`addprice-${missing.variantId}`}
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Kosong = ikut harga produk"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="h-9 bg-coal"
          />
        </div>

        <Button
          size="lg"
          variant="outline"
          disabled={busy}
          onClick={() => onAdd(preOrderItemId, missing.variantId, quota, price)}
        >
          <PackagePlusIcon className="size-4" aria-hidden />
          Masukkan
        </Button>
      </div>
    </div>
  );
}

function ProductGroupCard({
  group,
  busy,
  run,
}: {
  group: PeriodProductGroup;
  busy: boolean;
  run: RunAction;
}) {
  const [itemPrice, setItemPrice] = useState(priceToInput(group.itemPrice));
  const [confirmRemoveProduct, setConfirmRemoveProduct] = useState(false);

  const itemDirty = itemPrice !== priceToInput(group.itemPrice);
  const totalQuota = group.quotas.reduce((sum, row) => sum + row.quota, 0);
  const totalReserved = group.quotas.reduce((sum, row) => sum + row.reserved, 0);
  const productLocked = group.orderItemCount > 0 || totalReserved > 0;

  return (
    <div className="flex flex-col gap-4 border-b border-white/10 p-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-cream">{group.productName}</p>
          <p className="text-xs text-cream-muted">
            Harga normal {formatRupiah(group.basePrice)} / {group.unit}
            {group.itemPrice !== null ? ` · harga PO produk ${formatRupiah(group.itemPrice)}` : ""}
            {!group.isActive ? " · produk nonaktif" : ""}
          </p>
          <p className="mt-1 text-xs tabular-nums text-cream-muted">
            {group.quotas.length} varian berkuota · terpakai {totalReserved} dari {totalQuota} · sisa{" "}
            {Math.max(0, totalQuota - totalReserved)}
          </p>
        </div>

        <AlertDialog open={confirmRemoveProduct} onOpenChange={setConfirmRemoveProduct}>
          <AlertDialogTrigger
            render={
              <Button
                variant="destructive"
                size="sm"
                disabled={busy}
                aria-label={`Keluarkan ${group.productName} dari periode`}
              />
            }
          >
            <Trash2Icon className="size-3.5" aria-hidden />
            Keluarkan produk
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-rose-500/15 text-rose-300">
                <Trash2Icon aria-hidden />
              </AlertDialogMedia>
              <AlertDialogTitle>Keluarkan {group.productName}?</AlertDialogTitle>
              <AlertDialogDescription>
                {productLocked
                  ? "Produk ini sudah dipesan pada periode ini, jadi penghapusan kemungkinan ditolak. Turunkan kuota tiap varian ke angka terpakai bila ingin menghentikan pemesanan."
                  : "Produk beserta seluruh kuota variannya akan dikeluarkan dari periode ini."}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  run(() => removePreOrderItem({ itemId: group.preOrderItemId }));
                  setConfirmRemoveProduct(false);
                }}
              >
                Ya, keluarkan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid gap-3 rounded-xl border border-white/10 bg-obsidian/60 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={`itemprice-${group.preOrderItemId}`} className="text-xs text-cream-muted">
            Harga khusus level produk (opsional)
          </Label>
          <Input
            id={`itemprice-${group.preOrderItemId}`}
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={`Kosong = ${formatRupiah(group.basePrice)}`}
            value={itemPrice}
            onChange={(event) => setItemPrice(event.target.value)}
            className="h-9 bg-coal"
          />
          <p className="text-xs text-cream-muted">
            Dipakai bila kuota varian tidak punya harga sendiri. Urutan harga: varian → produk →
            normal + delta.
          </p>
        </div>
        <Button
          size="lg"
          variant="outline"
          disabled={busy || !itemDirty}
          onClick={() =>
            run(() =>
              updatePreOrderItemPrice({ itemId: group.preOrderItemId, price: itemPrice }),
            )
          }
        >
          <SaveIcon className="size-4" aria-hidden />
          Simpan harga produk
        </Button>
      </div>

      <div className="grid gap-3">
        {group.quotas.map((row) => (
          <VariantQuotaEditor
            key={`${row.quotaId}-${row.quota}-${row.price ?? "null"}`}
            row={row}
            busy={busy}
            onSave={(quotaId, quota, price) =>
              run(() => updateVariantQuota({ quotaId, quota, price }))
            }
            onRemove={(quotaId) => run(() => removeVariantQuota({ quotaId }))}
          />
        ))}

        {group.missing.map((missing) => (
          <MissingVariantRow
            key={missing.variantId}
            preOrderItemId={group.preOrderItemId}
            missing={missing}
            busy={busy}
            onAdd={(preOrderItemId, variantId, quota, price) =>
              run(() => addVariantQuota({ preOrderItemId, variantId, quota, price }))
            }
          />
        ))}

        {group.quotas.length === 0 && group.missing.length === 0 ? (
          <p className="text-sm text-cream-muted">
            Produk ini belum punya varian aktif. Tambahkan varian di menu Produk lebih dulu.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Pengelolaan isi periode: produk + kuota per varian.
 *
 * Penjagaan sesungguhnya ada di Server Action; komponen ini hanya membantu
 * admin melihat masalah lebih awal (kuota di bawah terpakai, hapus yang
 * sudah dipesan).
 */
export function QuotaManager({
  periodId,
  groups,
  candidates,
}: {
  periodId: string;
  groups: PeriodProductGroup[];
  candidates: ProductCandidate[];
}) {
  const [pending, startTransition] = useTransition();
  const [productId, setProductId] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const run: RunAction = (action, onSuccess) => {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message);
          onSuccess?.();
        } else {
          toast.error(result.message);
        }
      } catch {
        toast.error("Terjadi kesalahan pada server. Coba lagi.");
      }
    });
  };

  const totalQuota = groups.reduce(
    (sum, group) => sum + group.quotas.reduce((inner, row) => inner + row.quota, 0),
    0,
  );
  const totalReserved = groups.reduce(
    (sum, group) => sum + group.quotas.reduce((inner, row) => inner + row.reserved, 0),
    0,
  );

  return (
    <Card className="py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>Produk & Kuota Varian</CardTitle>
        <CardDescription>
          {groups.length === 0
            ? "Belum ada produk di periode ini."
            : `${groups.length} produk · ${groups.reduce((sum, group) => sum + group.quotas.length, 0)} varian berkuota · total kuota ${totalQuota} · terpakai ${totalReserved} · sisa ${Math.max(0, totalQuota - totalReserved)}`}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <div className="border-b border-white/10 bg-obsidian p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] lg:items-end">
            <div className="grid gap-1.5">
              <Label className="text-xs text-cream-muted">Produk</Label>
              <Select
                value={productId}
                onValueChange={(value: string | null) => setProductId(value ?? "")}
                disabled={candidates.length === 0}
              >
                <SelectTrigger className="h-9 w-full bg-coal">
                  <SelectValue placeholder="Pilih produk…" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.name} — {formatRupiah(candidate.price)} · {candidate.variantCount}{" "}
                      varian
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="new-item-price" className="text-xs text-cream-muted">
                Harga PO produk (opsional)
              </Label>
              <Input
                id="new-item-price"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Kosong = harga normal"
                value={newPrice}
                onChange={(event) => setNewPrice(event.target.value)}
                className="h-9 bg-coal"
              />
            </div>

            <Button
              size="lg"
              disabled={pending || !productId}
              onClick={() =>
                run(
                  () =>
                    addProductToPeriod({
                      periodId,
                      productId,
                      price: newPrice,
                    }),
                  () => {
                    setProductId("");
                    setNewPrice("");
                  },
                )
              }
            >
              {pending ? (
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
              ) : (
                <PackagePlusIcon className="size-4" aria-hidden />
              )}
              Tambah
            </Button>
          </div>

          {candidates.length === 0 ? (
            <p className="mt-2 text-xs text-cream-muted">
              {groups.length > 0
                ? "Semua produk aktif sudah ada di periode ini."
                : "Belum ada produk aktif. Buat produknya lebih dulu di menu Produk."}
            </p>
          ) : (
            <p className="mt-2 text-xs text-cream-muted">
              Setelah produk ditambahkan, atur kuota tiap variannya di bawah. Harga final varian =
              override varian → override produk → harga normal + selisih varian.
            </p>
          )}
        </div>

        {groups.length === 0 ? (
          <p className="p-6 text-center text-sm text-cream-muted">
            Tambahkan produk, lalu masukkan tiap variannya beserta kuotanya — misalnya varian Size
            S, M, L masing-masing 50.
          </p>
        ) : (
          <div className="divide-y divide-white/10">
            {groups.map((group) => (
              <ProductGroupCard
                key={`${group.preOrderItemId}-${group.itemPrice ?? "null"}`}
                group={group}
                busy={pending}
                run={run}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
