"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircleIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { FormField, FormSection } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateStoreSettings } from "./actions";
import { storeSettingsSchema, type StoreSettingsValues } from "./schemas";

const inputClass = "h-10";

export function StoreSettingsForm({
  defaultValues,
}: {
  defaultValues: StoreSettingsValues;
}) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<StoreSettingsValues>({
    resolver: zodResolver(storeSettingsSchema),
    defaultValues,
  });

  async function onSubmit(values: StoreSettingsValues) {
    const result = await updateStoreSettings(values);

    if (result.ok) {
      toast.success(result.message);
      reset(values);
      router.refresh();
      return;
    }

    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        setError(field as keyof StoreSettingsValues, { type: "server", message });
      }
    }
    toast.error(result.message);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5 pb-4">
      <div className="grid gap-5 lg:grid-cols-2">
        <FormSection
          title="Identitas Toko"
          description="Tampil di header, footer, dan judul halaman."
        >
          <FormField
            label="Nama toko"
            htmlFor="store_name"
            required
            error={errors.store_name?.message}
          >
            <Input
              id="store_name"
              className={inputClass}
              placeholder="Merch PENS"
              aria-invalid={Boolean(errors.store_name)}
              {...register("store_name")}
            />
          </FormField>

          <FormField
            label="Tagline"
            htmlFor="store_tagline"
            error={errors.store_tagline?.message}
            hint="Kalimat pendek di bawah nama toko."
          >
            <Input
              id="store_tagline"
              className={inputClass}
              placeholder="Merchandise resmi PENS"
              aria-invalid={Boolean(errors.store_tagline)}
              {...register("store_tagline")}
            />
          </FormField>

          <FormField
            label="Tentang toko"
            htmlFor="store_about"
            error={errors.store_about?.message}
            hint="Paragraf perkenalan yang tampil di beranda dan footer."
          >
            <Textarea
              id="store_about"
              rows={4}
              placeholder="Pemesanan merchandise resmi PENS..."
              aria-invalid={Boolean(errors.store_about)}
              {...register("store_about")}
            />
          </FormField>
        </FormSection>

        <FormSection
          title="Kontak"
          description="Dipakai pelanggan untuk menghubungi toko."
        >
          <FormField label="Email" htmlFor="store_email" error={errors.store_email?.message}>
            <Input
              id="store_email"
              type="email"
              className={inputClass}
              placeholder="halo@merchpens.id"
              aria-invalid={Boolean(errors.store_email)}
              {...register("store_email")}
            />
          </FormField>

          <FormField label="Telepon" htmlFor="store_phone" error={errors.store_phone?.message}>
            <Input
              id="store_phone"
              className={inputClass}
              placeholder="021-1234567"
              aria-invalid={Boolean(errors.store_phone)}
              {...register("store_phone")}
            />
          </FormField>

          <FormField
            label="Alamat"
            htmlFor="store_address"
            error={errors.store_address?.message}
          >
            <Textarea
              id="store_address"
              rows={3}
              placeholder="Jl. Contoh No. 1, Jakarta Selatan"
              aria-invalid={Boolean(errors.store_address)}
              {...register("store_address")}
            />
          </FormField>
        </FormSection>

        <FormSection
          title="Teks Hero Beranda"
          description="Kalimat utama yang pertama dilihat pengunjung."
        >
          <FormField
            label="Judul hero"
            htmlFor="hero_heading"
            error={errors.hero_heading?.message}
          >
            <Input
              id="hero_heading"
              className={inputClass}
              placeholder="Merchandise resmi BEM PENS — pre-order berkuota per periode"
              aria-invalid={Boolean(errors.hero_heading)}
              {...register("hero_heading")}
            />
          </FormField>

          <FormField
            label="Subjudul hero"
            htmlFor="hero_subheading"
            error={errors.hero_subheading?.message}
          >
            <Textarea
              id="hero_subheading"
              rows={3}
              placeholder="Ikut periode pre-order merchandise dengan harga terbaik."
              aria-invalid={Boolean(errors.hero_subheading)}
              {...register("hero_subheading")}
            />
          </FormField>

          <FormField
            label="Informasi pre-order"
            htmlFor="preorder_info"
            error={errors.preorder_info?.message}
            hint="Penjelasan cara kerja PO yang tampil di beranda dan halaman pre-order."
          >
            <Textarea
              id="preorder_info"
              rows={4}
              placeholder="Barang bisa diambil setelah periode PO ditutup dan pesanan tiba dari distributor."
              aria-invalid={Boolean(errors.preorder_info)}
              {...register("preorder_info")}
            />
          </FormField>
        </FormSection>

        <div className="space-y-5">
          <FormSection
            title="Informasi Pengambilan Barang"
            description="Nilai di bawah menjadi default saat periode PO baru dibuat. Setiap periode tetap bisa disesuaikan tanpa mengubah default ini."
          >
            <FormField
              label="Jeda estimasi pengambilan"
              htmlFor="pickup_lead_days"
              required
              error={errors.pickup_lead_days?.message}
              hint="Jumlah hari dari periode ditutup sampai estimasi barang bisa diambil."
            >
              <div className="flex items-center gap-2">
                <Input
                  id="pickup_lead_days"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  className={`${inputClass} max-w-32`}
                  aria-invalid={Boolean(errors.pickup_lead_days)}
                  {...register("pickup_lead_days")}
                />
                <span className="text-sm text-cream-muted">hari</span>
              </div>
            </FormField>

            <FormField
              label="Lokasi pengambilan"
              htmlFor="pickup_location"
              required
              error={errors.pickup_location?.message}
              hint="Tulis selengkap mungkin, mis. nama gedung, lantai, dan ruangannya."
            >
              <Input
                id="pickup_location"
                className={inputClass}
                placeholder="Sekretariat, Kampus PENS"
                aria-invalid={Boolean(errors.pickup_location)}
                {...register("pickup_location")}
              />
            </FormField>

            <FormField
              label="Jadwal pengambilan"
              htmlFor="pickup_schedule"
              required
              error={errors.pickup_schedule?.message}
              hint="Hari dan jam panitia berjaga, mis. Senin-Jumat, 10.00-15.00 WIB."
            >
              <Input
                id="pickup_schedule"
                className={inputClass}
                placeholder="Senin-Jumat, 10.00-15.00 WIB"
                aria-invalid={Boolean(errors.pickup_schedule)}
                {...register("pickup_schedule")}
              />
            </FormField>

            <FormField
              label="Catatan pengambilan"
              htmlFor="pickup_note"
              error={errors.pickup_note?.message}
              hint="Opsional. Syarat tambahan saat pengambilan, mis. tunjukkan kode pesanan."
            >
              <Textarea
                id="pickup_note"
                rows={3}
                placeholder="Tunjukkan kode pesanan ke panitia."
                aria-invalid={Boolean(errors.pickup_note)}
                {...register("pickup_note")}
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Media Sosial"
            description="Kosongkan bila tidak dipakai — tautan yang kosong tidak ditampilkan."
          >
            <FormField
              label="WhatsApp admin (untuk ongkir)"
              htmlFor="social_whatsapp"
              error={errors.social_whatsapp?.message}
              hint="Cukup nomornya, mis. 6281234567890. Dipakai tombol Chat Admin untuk Ongkir."
            >
              <Input
                id="social_whatsapp"
                className={inputClass}
                placeholder="6281234567890"
                aria-invalid={Boolean(errors.social_whatsapp)}
                {...register("social_whatsapp")}
              />
            </FormField>

            <FormField
              label="Instagram"
              htmlFor="social_instagram"
              error={errors.social_instagram?.message}
            >
              <Input
                id="social_instagram"
                className={inputClass}
                placeholder="https://instagram.com/merchpens"
                aria-invalid={Boolean(errors.social_instagram)}
                {...register("social_instagram")}
              />
            </FormField>

            <FormField
              label="Facebook"
              htmlFor="social_facebook"
              error={errors.social_facebook?.message}
            >
              <Input
                id="social_facebook"
                className={inputClass}
                placeholder="https://facebook.com/merchpens"
                aria-invalid={Boolean(errors.social_facebook)}
                {...register("social_facebook")}
              />
            </FormField>

            <FormField
              label="TikTok"
              htmlFor="social_tiktok"
              error={errors.social_tiktok?.message}
            >
              <Input
                id="social_tiktok"
                className={inputClass}
                placeholder="https://tiktok.com/@merchpens"
                aria-invalid={Boolean(errors.social_tiktok)}
                {...register("social_tiktok")}
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Master Data Checkout"
            description="Daftar pilihan dropdown saat checkout. Satu entri per baris."
          >
            <FormField
              label="Daftar angkatan"
              htmlFor="angkatan_list"
              error={errors.angkatan_list?.message}
              hint="Satu angkatan per baris, mis. 2021 sampai 2025."
            >
              <Textarea
                id="angkatan_list"
                rows={5}
                aria-invalid={Boolean(errors.angkatan_list)}
                {...register("angkatan_list")}
              />
            </FormField>

            <FormField
              label="Daftar jurusan"
              htmlFor="jurusan_list"
              error={errors.jurusan_list?.message}
              hint="Satu jurusan per baris. Dipakai dropdown checkout dan filter rekap."
            >
              <Textarea
                id="jurusan_list"
                rows={6}
                aria-invalid={Boolean(errors.jurusan_list)}
                {...register("jurusan_list")}
              />
            </FormField>
          </FormSection>
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-xl border border-white/10 bg-coal/95 p-3 backdrop-blur">
        {isDirty && (
          <p className="mr-auto text-sm text-amber-300">Ada perubahan yang belum disimpan.</p>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-10 gap-1.5 bg-gold text-obsidian hover:bg-gold-light"
        >
          {isSubmitting ? (
            <LoaderCircleIcon className="animate-spin" aria-hidden />
          ) : (
            <SaveIcon className="size-4" aria-hidden />
          )}
          {isSubmitting ? "Menyimpan..." : "Simpan Informasi Toko"}
        </Button>
      </div>
    </form>
  );
}
