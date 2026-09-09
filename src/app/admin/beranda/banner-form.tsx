"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircleIcon, PencilIcon, PlusIcon } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createBanner, updateBanner } from "./actions";
import { bannerFormSchema, emptyBannerFormValues, type BannerFormValues } from "./schemas";

export type BannerFormDialogProps = {
  mode: "create" | "edit";
  bannerId?: string;
  bannerTitle?: string;
  defaultValues?: BannerFormValues;
  nextSortOrder?: number;
};

const inputClass = "h-10";

export function BannerFormDialog({
  mode,
  bannerId,
  bannerTitle,
  defaultValues,
  nextSortOrder = 0,
}: BannerFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const initialValues = defaultValues ?? emptyBannerFormValues(nextSortOrder);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BannerFormValues>({
    resolver: zodResolver(bannerFormSchema),
    defaultValues: initialValues,
  });

  /** Setiap dialog dibuka, form dikembalikan ke nilai terkini dari server. */
  function handleOpenChange(next: boolean) {
    if (next) reset(initialValues);
    setOpen(next);
  }

  async function onSubmit(values: BannerFormValues) {
    const result =
      mode === "edit" && bannerId
        ? await updateBanner(bannerId, values)
        : await createBanner(values);

    if (result.ok) {
      toast.success(result.message);
      setOpen(false);
      router.refresh();
      return;
    }

    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        setError(field as keyof BannerFormValues, { type: "server", message });
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
              aria-label={`Ubah banner ${bannerTitle ?? ""}`}
              className="text-cream-muted hover:text-gold"
            />
          )
        }
      >
        {mode === "create" ? (
          <>
            <PlusIcon className="size-4" aria-hidden />
            Tambah Banner
          </>
        ) : (
          <PencilIcon className="size-4" aria-hidden />
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader className="mb-4">
          <DialogTitle>
            {mode === "create" ? "Tambah Banner" : "Ubah Banner"}
          </DialogTitle>
          <DialogDescription>
            Banner aktif ditampilkan bergantian di bagian atas halaman beranda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField
            label="Judul"
            htmlFor="banner-title"
            required
            error={errors.title?.message}
          >
            <Input
              id="banner-title"
              className={inputClass}
              placeholder="Contoh: Diskon Alat Diagnostik"
              aria-invalid={Boolean(errors.title)}
              {...register("title")}
            />
          </FormField>

          <FormField
            label="Subjudul"
            htmlFor="banner-subtitle"
            error={errors.subtitle?.message}
          >
            <Textarea
              id="banner-subtitle"
              rows={2}
              placeholder="Kalimat pendukung (opsional)"
              aria-invalid={Boolean(errors.subtitle)}
              {...register("subtitle")}
            />
          </FormField>

          <FormField
            label="Gambar banner"
            htmlFor="banner-image"
            required
            error={errors.imageUrl?.message}
            hint="Unggah berkas dari komputer, atau tempel URL gambar. Ukuran melebar (mis. 1600×600) memberi hasil terbaik."
          >
            <div className="flex gap-2">
              <Input
                id="banner-image"
                className={inputClass}
                placeholder="Unggah berkas, atau tempel URL gambar"
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
          </FormField>

          <FormField
            label="Tautan tujuan"
            htmlFor="banner-link"
            error={errors.linkUrl?.message}
            hint="Ke mana pelanggan diarahkan saat banner diklik, mis. /produk?kategori=alat-diagnostik"
          >
            <Input
              id="banner-link"
              className={inputClass}
              placeholder="/produk"
              aria-invalid={Boolean(errors.linkUrl)}
              {...register("linkUrl")}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Urutan tampil"
              htmlFor="banner-sort"
              error={errors.sortOrder?.message}
              hint="Angka kecil tampil lebih dulu."
            >
              <Input
                id="banner-sort"
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
                  <span className="text-sm font-medium text-cream-soft">
                    Tampilkan banner
                  </span>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="data-checked:bg-gold"
                    aria-label="Tampilkan banner"
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
