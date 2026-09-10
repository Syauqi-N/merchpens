"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ImageOffIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { FormField } from "@/components/admin/form-field";
import { ImageUploadButton } from "@/components/admin/image-upload-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createVariant, updateVariant } from "./actions";
import {
  SIZE_OPTIONS,
  emptyVariantFormValues,
  variantFormSchema,
  type VariantFormValues,
} from "./schemas";

export type VariantFormDialogProps = {
  mode: "create" | "edit";
  productId: string;
  /** Harga normal produk — dipakai menghitung preview harga final. */
  productPrice: number;
  variantId?: string;
  variantName?: string;
  defaultValues?: VariantFormValues;
  /** Urutan yang disarankan untuk varian baru (terakhir + 1). */
  nextSortOrder?: number;
};

const inputClass = "h-10";

export function VariantFormDialog({
  mode,
  productId,
  productPrice,
  variantId,
  variantName,
  defaultValues,
  nextSortOrder = 0,
}: VariantFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const initialValues = defaultValues ?? emptyVariantFormValues(nextSortOrder);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VariantFormValues>({
    resolver: zodResolver(variantFormSchema),
    defaultValues: initialValues,
  });

  const priceDelta = useWatch({ control, name: "priceDelta" });
  const imageUrl = useWatch({ control, name: "imageUrl" });

  const deltaNumber = /^-?\d+$/.test((priceDelta ?? "").trim())
    ? Number((priceDelta ?? "").trim())
    : null;
  const finalPrice = deltaNumber === null ? null : productPrice + deltaNumber;

  /** Setiap dialog dibuka, form dikembalikan ke nilai terkini dari server. */
  function handleOpenChange(next: boolean) {
    if (next) reset(initialValues);
    setOpen(next);
  }

  async function onSubmit(values: VariantFormValues) {
    const result =
      mode === "edit" && variantId
        ? await updateVariant(variantId, values)
        : await createVariant(productId, values);

    if (result.ok) {
      toast.success(result.message);
      setOpen(false);
      router.refresh();
      return;
    }

    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        setError(field as keyof VariantFormValues, { type: "server", message });
      }
    }
    toast.error(result.message);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          mode === "create" ? (
            <Button className="h-10 gap-1.5 bg-gold text-obsidian hover:bg-gold-light" />
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Ubah varian ${variantName ?? ""}`}
              className="text-cream-muted hover:text-gold"
            />
          )
        }
      >
        {mode === "create" ? (
          <>
            <PlusIcon className="size-4" aria-hidden />
            Tambah Varian
          </>
        ) : (
          <PencilIcon className="size-4" aria-hidden />
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader className="mb-4">
          <DialogTitle>
            {mode === "create" ? "Tambah Varian" : "Ubah Varian"}
          </DialogTitle>
          <DialogDescription>
            Harga final varian = harga normal produk ({formatRupiah(productPrice)}) +
            selisih harga varian.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField
            label="Nama varian"
            htmlFor={mode === "create" ? "variant-name-new" : `variant-name-${variantId}`}
            required
            error={errors.name?.message}
          >
            <Input
              id={mode === "create" ? "variant-name-new" : `variant-name-${variantId}`}
              className={inputClass}
              placeholder='Contoh: Size L / Hitam'
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Ukuran"
              htmlFor={mode === "create" ? "variant-size-new" : `variant-size-${variantId}`}
              error={errors.size?.message}
              hint="Contoh: S, M, L, XL, XXL. Boleh dikosongkan."
            >
              <Input
                id={mode === "create" ? "variant-size-new" : `variant-size-${variantId}`}
                className={inputClass}
                placeholder="L"
                list={mode === "create" ? "variant-size-options" : undefined}
                aria-invalid={Boolean(errors.size)}
                {...register("size")}
              />
              {mode === "create" && (
                <datalist id="variant-size-options">
                  {SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size} />
                  ))}
                </datalist>
              )}
            </FormField>

            <FormField
              label="Selisih harga"
              htmlFor={
                mode === "create" ? "variant-delta-new" : `variant-delta-${variantId}`
              }
              required
              error={errors.priceDelta?.message}
              hint="Angka saja, boleh negatif (mis. -5000 untuk diskon varian)."
            >
              <Input
                id={mode === "create" ? "variant-delta-new" : `variant-delta-${variantId}`}
                inputMode="numeric"
                className={inputClass}
                placeholder="0"
                aria-invalid={Boolean(errors.priceDelta)}
                {...register("priceDelta")}
              />
            </FormField>
          </div>

          <div
            role="status"
            aria-live="polite"
            className={cn(
              "rounded-lg border px-3 py-2.5 text-sm",
              finalPrice === null || finalPrice <= 0
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-gold/30 bg-gold/10 text-gold-light",
            )}
          >
            {finalPrice === null ? (
              <span>Isi selisih harga yang valid untuk melihat preview harga final.</span>
            ) : (
              <span>
                Preview harga final:{" "}
                <strong className="tabular-nums">{formatRupiah(finalPrice)}</strong>{" "}
                <span className="text-xs">
                  ({formatRupiah(productPrice)} {deltaNumber !== null && deltaNumber < 0 ? "−" : "+"}{" "}
                  {formatRupiah(Math.abs(deltaNumber ?? 0)).replace("Rp", "Rp")})
                </span>
                {finalPrice <= 0 && (
                  <span className="mt-0.5 block text-xs font-medium">
                    Harga final harus lebih dari 0 — sesuaikan selisih harganya.
                  </span>
                )}
              </span>
            )}
          </div>

          <FormField
            label="Foto khusus varian"
            htmlFor={mode === "create" ? "variant-image-new" : `variant-image-${variantId}`}
            error={errors.imageUrl?.message}
            hint="Opsional. Bila kosong, dipakai gambar produk. Bisa dari hasil unggahan (/uploads/...) atau URL luar."
          >
            <div className="flex items-start gap-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-white/10 bg-obsidian">
                {imageUrl && /^(https?:\/\/|\/)/i.test(imageUrl) ? (
                  <Image
                    src={imageUrl}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="grid size-full place-items-center text-[#6E6E6E]">
                    <ImageOffIcon className="size-5" aria-hidden />
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 gap-2">
                <Input
                  id={mode === "create" ? "variant-image-new" : `variant-image-${variantId}`}
                  className={cn(inputClass, "text-sm")}
                  placeholder="Unggah berkas, atau tempel URL foto"
                  aria-invalid={Boolean(errors.imageUrl)}
                  {...register("imageUrl")}
                />
                <ImageUploadButton
                  className="shrink-0"
                  onUploaded={(url) =>
                    setValue("imageUrl", url, { shouldDirty: true, shouldValidate: true })
                  }
                />
              </div>
            </div>
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Urutan tampil"
              htmlFor={mode === "create" ? "variant-sort-new" : `variant-sort-${variantId}`}
              error={errors.sortOrder?.message}
              hint="Angka kecil tampil lebih dulu."
            >
              <Input
                id={mode === "create" ? "variant-sort-new" : `variant-sort-${variantId}`}
                inputMode="numeric"
                className={cn(inputClass, "max-w-28")}
                placeholder="0"
                aria-invalid={Boolean(errors.sortOrder)}
                {...register("sortOrder")}
              />
            </FormField>

            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-center justify-between gap-3 self-end rounded-lg border border-white/10 p-3">
                  <span className="text-sm font-medium text-cream-soft">Varian aktif</span>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="data-checked:bg-gold"
                    aria-label="Varian aktif"
                  />
                </div>
              )}
            />
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gold text-obsidian hover:bg-gold-light"
            >
              {isSubmitting && <LoaderCircleIcon className="animate-spin" aria-hidden />}
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
