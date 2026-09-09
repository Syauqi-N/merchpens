"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircleIcon, PencilIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
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
import { slugify } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createCategory, updateCategory } from "./actions";
import {
  categoryFormSchema,
  emptyCategoryFormValues,
  type CategoryFormValues,
} from "./schemas";

export type CategoryFormDialogProps = {
  mode: "create" | "edit";
  categoryId?: string;
  categoryName?: string;
  defaultValues?: CategoryFormValues;
  /** Urutan yang disarankan untuk kategori baru (terakhir + 1). */
  nextSortOrder?: number;
};

const inputClass = "h-10";

export function CategoryFormDialog({
  mode,
  categoryId,
  categoryName,
  defaultValues,
  nextSortOrder = 0,
}: CategoryFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");

  const initialValues = defaultValues ?? emptyCategoryFormValues(nextSortOrder);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: initialValues,
  });

  /** Setiap dialog dibuka, form dikembalikan ke nilai terkini dari server. */
  function handleOpenChange(next: boolean) {
    if (next) {
      reset(initialValues);
      setSlugTouched(mode === "edit");
    }
    setOpen(next);
  }

  async function onSubmit(values: CategoryFormValues) {
    const result =
      mode === "edit" && categoryId
        ? await updateCategory(categoryId, values)
        : await createCategory(values);

    if (result.ok) {
      toast.success(result.message);
      setOpen(false);
      router.refresh();
      return;
    }

    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        setError(field as keyof CategoryFormValues, { type: "server", message });
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
              aria-label={`Ubah kategori ${categoryName ?? ""}`}
              className="text-cream-muted hover:text-gold"
            />
          )
        }
      >
        {mode === "create" ? (
          <>
            <PlusIcon className="size-4" aria-hidden />
            Tambah Kategori
          </>
        ) : (
          <PencilIcon className="size-4" aria-hidden />
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader className="mb-4">
          <DialogTitle>
            {mode === "create" ? "Tambah Kategori" : "Ubah Kategori"}
          </DialogTitle>
          <DialogDescription>
            Kategori memudahkan pelanggan menyaring produk di halaman katalog.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField
            label="Nama kategori"
            htmlFor="category-name"
            required
            error={errors.name?.message}
          >
            <Input
              id="category-name"
              className={inputClass}
              placeholder="Contoh: Alat Diagnostik"
              aria-invalid={Boolean(errors.name)}
              {...register("name", {
                onChange: (event) => {
                  if (!slugTouched) {
                    setValue("slug", slugify(event.target.value));
                  }
                },
              })}
            />
          </FormField>

          <FormField
            label="Slug"
            htmlFor="category-slug"
            required
            error={errors.slug?.message}
            hint="Dipakai pada tautan katalog: /produk?kategori=slug"
          >
            <div className="flex gap-2">
              <Input
                id="category-slug"
                className={cn(inputClass, "font-mono text-sm")}
                placeholder="alat-diagnostik"
                aria-invalid={Boolean(errors.slug)}
                {...register("slug", { onChange: () => setSlugTouched(true) })}
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0"
                aria-label="Buat ulang slug dari nama"
                onClick={() => {
                  setValue("slug", slugify(getValues("name")), { shouldValidate: true });
                  setSlugTouched(false);
                }}
              >
                <RefreshCwIcon className="size-4" aria-hidden />
              </Button>
            </div>
          </FormField>

          <FormField
            label="Deskripsi"
            htmlFor="category-description"
            error={errors.description?.message}
          >
            <Textarea
              id="category-description"
              rows={3}
              placeholder="Penjelasan singkat isi kategori (opsional)"
              aria-invalid={Boolean(errors.description)}
              {...register("description")}
            />
          </FormField>

          <FormField
            label="Gambar kategori"
            htmlFor="category-image"
            error={errors.imageUrl?.message}
            hint="Opsional. Unggah berkas dari komputer, atau tempel URL gambar."
          >
            <div className="flex gap-2">
              <Input
                id="category-image"
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

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Urutan tampil"
              htmlFor="category-sort"
              error={errors.sortOrder?.message}
              hint="Angka kecil tampil lebih dulu."
            >
              <Input
                id="category-sort"
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
                    Kategori aktif
                  </span>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="data-checked:bg-gold"
                    aria-label="Kategori aktif"
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
