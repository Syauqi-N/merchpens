"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ImageOffIcon,
  InfoIcon,
  LoaderCircleIcon,
  PlusIcon,
  RefreshCwIcon,
  StarIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";

import { FormField, FormSection } from "@/components/admin/form-field";
import { ImageUploadButton } from "@/components/admin/image-upload-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatRupiah, slugify } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createProduct, updateProduct } from "./actions";
import { UNIT_OPTIONS, productFormSchema, type ProductFormValues } from "./schemas";

export type ProductFormProps = {
  mode: "create" | "edit";
  productId?: string;
  categories: { id: string; name: string }[];
  defaultValues: ProductFormValues;
};

const inputClass = "h-10";

export function ProductForm({
  mode,
  productId,
  categories,
  defaultValues,
}: ProductFormProps) {
  const router = useRouter();
  const [slugTouched, setSlugTouched] = useState(mode === "edit");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "images" });

  const price = useWatch({ control, name: "price" });
  const images = useWatch({ control, name: "images" });

  const unitItems = Object.fromEntries(UNIT_OPTIONS.map((unit) => [unit, unit]));

  function handleNameChange(value: string) {
    if (slugTouched) return;
    setValue("slug", slugify(value), { shouldValidate: false });
  }

  function regenerateSlug() {
    const nextSlug = slugify(getValues("name"));
    setValue("slug", nextSlug, { shouldValidate: true, shouldDirty: true });
    setSlugTouched(false);
  }

  function setPrimaryImage(index: number) {
    fields.forEach((_, position) => {
      setValue(`images.${position}.isPrimary`, position === index, {
        shouldDirty: true,
      });
    });
  }

  async function onSubmit(values: ProductFormValues) {
    const result =
      mode === "edit" && productId
        ? await updateProduct(productId, values)
        : await createProduct(values);

    if (result.ok) {
      toast.success(result.message);
      router.push("/admin/produk");
      router.refresh();
      return;
    }

    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        setError(field as keyof ProductFormValues, { type: "server", message });
      }
    }
    toast.error(result.message);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5 pb-4">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <FormSection
            title="Informasi Dasar"
            description="Nama, tautan, dan penjelasan produk yang dilihat pelanggan."
          >
            <FormField label="Nama produk" htmlFor="name" required error={errors.name?.message}>
              <Input
                id="name"
                className={inputClass}
                placeholder="Contoh: Kemeja PDH Mahasiswa PENS"
                aria-invalid={Boolean(errors.name)}
                {...register("name", {
                  onChange: (event) => handleNameChange(event.target.value),
                })}
              />
            </FormField>

            <FormField
              label="Slug (tautan)"
              htmlFor="slug"
              required
              error={errors.slug?.message}
              hint="Dibuat otomatis dari nama produk, tetapi boleh diubah. Alamat halaman: /produk/slug"
            >
              <div className="flex gap-2">
                <Input
                  id="slug"
                  className={cn(inputClass, "font-mono text-sm")}
                  placeholder="pdh-mahasiswa-pens"
                  aria-invalid={Boolean(errors.slug)}
                  {...register("slug", { onChange: () => setSlugTouched(true) })}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0 gap-1.5"
                  onClick={regenerateSlug}
                >
                  <RefreshCwIcon className="size-4" aria-hidden />
                  <span className="hidden sm:inline">Buat ulang</span>
                </Button>
              </div>
            </FormField>

            <FormField
              label="Deskripsi"
              htmlFor="description"
              error={errors.description?.message}
              hint="Spesifikasi, isi paket, dan catatan penting lainnya."
            >
              <Textarea
                id="description"
                rows={6}
                placeholder="Tuliskan spesifikasi dan keunggulan produk..."
                aria-invalid={Boolean(errors.description)}
                {...register("description")}
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Harga & Identitas"
            description="Harga normal berlaku bila periode PO tidak menetapkan harga khusus."
          >
            <FormField
              label="Harga normal"
              htmlFor="price"
              required
              error={errors.price?.message}
              hint={
                price && /^\d+$/.test(price)
                  ? `Tampil sebagai ${formatRupiah(Number(price))}`
                  : "Isi angka saja, tanpa titik atau koma."
              }
            >
              <Input
                id="price"
                inputMode="numeric"
                className={cn(inputClass, "max-w-60")}
                placeholder="1500000"
                aria-invalid={Boolean(errors.price)}
                {...register("price")}
              />
            </FormField>

            <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-200">
              <InfoIcon className="text-amber-600" aria-hidden />
              <AlertTitle>Produk belum bisa dipesan sampai masuk periode PO</AlertTitle>
              <AlertDescription className="text-amber-200">
                Seluruh produk dijual lewat pre-order, jadi ketersediaannya dihitung dari{" "}
                <strong>kuota periode PO</strong> (kuota dikurangi yang sudah dipesan) dan
                hanya terbuka selama periodenya berjalan. Setelah menyimpan produk ini,
                masukkan ke sebuah periode beserta kuotanya di menu{" "}
                <Link href="/admin/pre-order" className="font-medium underline">
                  Pre-Order
                </Link>
                .
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="SKU" htmlFor="sku" error={errors.sku?.message} hint="Kode internal, harus unik. Boleh dikosongkan.">
                <Input
                  id="sku"
                  className={cn(inputClass, "font-mono text-sm")}
                  placeholder="MCH-PDH-001"
                  aria-invalid={Boolean(errors.sku)}
                  {...register("sku")}
                />
              </FormField>

              <FormField label="Merek" htmlFor="brand" error={errors.brand?.message}>
                <Input
                  id="brand"
                  className={inputClass}
                  placeholder="BEM PENS"
                  aria-invalid={Boolean(errors.brand)}
                  {...register("brand")}
                />
              </FormField>

              <FormField label="Satuan" htmlFor="unit" required error={errors.unit?.message}>
                <Controller
                  control={control}
                  name="unit"
                  render={({ field }) => (
                    <Select
                      items={unitItems}
                      value={field.value}
                      onValueChange={(value) => field.onChange(value ?? "pcs")}
                    >
                      <SelectTrigger id="unit" className={cn(inputClass, "w-full")}>
                        <SelectValue placeholder="Pilih satuan" />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_OPTIONS.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Gambar Produk"
            description="Unggah berkas dari komputer, atau tempel URL gambar. Gambar bertanda bintang menjadi gambar utama di katalog."
          >
            {errors.images?.message && (
              <p className="text-xs font-medium text-red-400">{errors.images.message}</p>
            )}

            {fields.length === 0 && (
              <p className="rounded-lg border border-dashed border-[#3A3A3A] bg-obsidian px-3 py-6 text-center text-sm text-cream-muted">
                Belum ada gambar. Produk tanpa gambar tetap tampil, namun kurang menarik.
              </p>
            )}

            <ul className="space-y-3">
              {fields.map((field, index) => {
                const current = images?.[index];
                const isPrimary = Boolean(current?.isPrimary) || (index === 0 && !images?.some((image) => image.isPrimary));
                const urlError = errors.images?.[index]?.url?.message;
                const altError = errors.images?.[index]?.alt?.message;

                return (
                  <li
                    key={field.id}
                    className="rounded-lg border border-white/10 bg-obsidian/60 p-3"
                  >
                    <div className="flex gap-3">
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-md border border-white/10 bg-coal">
                        {current?.url && /^(https?:\/\/|\/)/i.test(current.url) ? (
                          <Image
                            src={current.url}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <span className="grid size-full place-items-center text-[#6E6E6E]">
                            <ImageOffIcon className="size-6" aria-hidden />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div>
                          <Label htmlFor={`images-${index}-url`} className="sr-only">
                            URL gambar {index + 1}
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id={`images-${index}-url`}
                              className={cn(inputClass, "text-sm")}
                              placeholder="Unggah berkas, atau tempel URL gambar"
                              aria-invalid={Boolean(urlError)}
                              {...register(`images.${index}.url` as const)}
                            />
                            <ImageUploadButton
                              className="shrink-0"
                              onUploaded={(url) =>
                                setValue(`images.${index}.url`, url, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                              }
                            />
                          </div>
                          {urlError && (
                            <p className="mt-1 text-xs font-medium text-red-400">{urlError}</p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor={`images-${index}-alt`} className="sr-only">
                            Teks alternatif gambar {index + 1}
                          </Label>
                          <Input
                            id={`images-${index}-alt`}
                            className={cn(inputClass, "text-sm")}
                            placeholder="Teks alternatif (opsional)"
                            aria-invalid={Boolean(altError)}
                            {...register(`images.${index}.alt` as const)}
                          />
                          {altError && (
                            <p className="mt-1 text-xs font-medium text-red-400">{altError}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant={isPrimary ? "default" : "outline"}
                            size="sm"
                            className={cn("gap-1.5", isPrimary && "bg-gold text-obsidian hover:bg-gold-light")}
                            onClick={() => setPrimaryImage(index)}
                            aria-pressed={isPrimary}
                          >
                            <StarIcon
                              className={cn("size-3.5", isPrimary && "fill-current")}
                              aria-hidden
                            />
                            {isPrimary ? "Gambar utama" : "Jadikan utama"}
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            onClick={() => remove(index)}
                          >
                            <Trash2Icon className="size-3.5" aria-hidden />
                            Hapus gambar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Button
              type="button"
              variant="outline"
              className="h-10 w-full gap-1.5 border-dashed"
              disabled={fields.length >= 8}
              onClick={() =>
                append({ url: "", alt: "", isPrimary: fields.length === 0 })
              }
            >
              <PlusIcon className="size-4" aria-hidden />
              Tambah gambar
            </Button>
            <p className="text-xs text-cream-muted">
              Hanya gambar dari <code className="font-mono">picsum.photos</code> dan{" "}
              <code className="font-mono">placehold.co</code> yang dioptimalkan Next.js.
              Domain lain tetap tersimpan namun bisa gagal ditampilkan.
            </p>
          </FormSection>
        </div>

        <div className="space-y-5">
          <FormSection title="Kategori & Status">
            <FormField
              label="Kategori produk"
              htmlFor="categoryIds"
              required
              error={errors.categoryIds?.message}
              hint="Satu produk bisa tampil di beberapa kategori."
            >
              {categories.length === 0 ? (
                <Alert className="border-red-500/30 bg-red-500/10 text-red-900">
                  <TriangleAlertIcon className="text-red-400" aria-hidden />
                  <AlertDescription className="text-red-200">
                    Belum ada kategori.{" "}
                    <Link href="/admin/kategori" className="font-medium underline">
                      Buat kategori
                    </Link>{" "}
                    terlebih dahulu.
                  </AlertDescription>
                </Alert>
              ) : (
                <Controller
                  control={control}
                  name="categoryIds"
                  render={({ field }) => (
                    <div
                      id="categoryIds"
                      role="group"
                      aria-label="Kategori produk"
                      className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-obsidian/60 p-2"
                    >
                      {categories.map((category) => {
                        const checkboxId = `category-${category.id}`;
                        const checked = field.value.includes(category.id);

                        return (
                          <div
                            key={category.id}
                            className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-coal"
                          >
                            <Checkbox
                              id={checkboxId}
                              checked={checked}
                              aria-invalid={Boolean(errors.categoryIds)}
                              onCheckedChange={(nextChecked) => {
                                field.onChange(
                                  nextChecked
                                    ? [...field.value, category.id]
                                    : field.value.filter((id) => id !== category.id),
                                );
                              }}
                            />
                            <Label
                              htmlFor={checkboxId}
                              className="min-w-0 flex-1 cursor-pointer text-sm font-normal text-[#D8D3C7]"
                            >
                              {category.name}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                />
              )}
            </FormField>

            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-white/10 p-3">
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium text-cream-soft">
                      Produk aktif
                    </span>
                    <span className="block text-xs text-cream-muted">
                      Produk nonaktif tidak muncul di katalog dan tidak bisa dipesan.
                    </span>
                  </span>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5 data-checked:bg-gold"
                    aria-label="Produk aktif"
                  />
                </div>
              )}
            />

            <Controller
              control={control}
              name="isFeatured"
              render={({ field }) => (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-white/10 p-3">
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium text-cream-soft">
                      Produk unggulan
                    </span>
                    <span className="block text-xs text-cream-muted">
                      Ditampilkan di bagian unggulan halaman beranda.
                    </span>
                  </span>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5 data-checked:bg-gold"
                    aria-label="Produk unggulan"
                  />
                </div>
              )}
            />
          </FormSection>

          <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-coal p-4">
            <Button
              type="submit"
              disabled={isSubmitting || categories.length === 0}
              className="h-10 w-full bg-gold text-obsidian hover:bg-gold-light"
            >
              {isSubmitting && <LoaderCircleIcon className="animate-spin" aria-hidden />}
              {isSubmitting
                ? "Menyimpan..."
                : mode === "edit"
                  ? "Simpan Perubahan"
                  : "Simpan Produk"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-10 w-full"
              disabled={isSubmitting}
              onClick={() => router.push("/admin/produk")}
            >
              Batal
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
