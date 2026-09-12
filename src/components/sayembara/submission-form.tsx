"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  UploadCloudIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  LoaderCircleIcon,
  Trash2Icon,
  ClockIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  LayersIcon,
} from "lucide-react";
import { submitContestEntry } from "@/app/sayembara/actions";
import {
  submitEntrySchema,
  PENS_DEPARTMENTS,
  type SubmitEntryValues,
} from "@/app/sayembara/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type UserContestEntry = {
  id: string;
  title: string;
  designerName: string;
  department: string | null;
  batch: string | null;
  description: string;
  imageUrl: string;
  imageUrl2?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote: string | null;
  createdAt: string;
};

export function SubmissionForm({
  contestId,
  isLoggedIn,
  userEntry = null,
  contestSlug,
}: {
  contestId: string;
  isLoggedIn: boolean;
  userEntry?: UserContestEntry | null;
  contestSlug?: string;
}) {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [uploading1, setUploading1] = useState(false);
  const [uploading2, setUploading2] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubmitEntryValues>({
    resolver: zodResolver(submitEntrySchema),
    defaultValues: {
      contestId,
      title: userEntry?.status === "REJECTED" ? userEntry.title : "",
      designerName: userEntry?.status === "REJECTED" ? userEntry.designerName : "",
      department: (userEntry?.status === "REJECTED" ? userEntry.department : "") || "",
      batch: userEntry?.status === "REJECTED" ? (userEntry.batch ?? "") : "",
      description: userEntry?.status === "REJECTED" ? userEntry.description : "",
      imageUrl: "",
      imageUrl2: "",
    },
  });

  const currentImageUrl1 = watch("imageUrl");
  const currentImageUrl2 = watch("imageUrl2");
  const currentDescription = watch("description") || "";
  const descLength = currentDescription.trim().length;

  if (!isLoggedIn) {
    return (
      <div className="rounded-2xl border border-gold/30 bg-coal/90 p-8 text-center backdrop-blur">
        <h3 className="text-lg font-bold text-cream">Login untuk Mengirim Karya</h3>
        <p className="mt-2 text-sm text-cream-muted max-w-md mx-auto">
          Sayembara ini eksklusif untuk mahasiswa & sivitas akademika PENS. Silakan masuk terlebih dahulu menggunakan akun Google atau email kamu.
        </p>
        <div className="mt-6">
          <Link
            href={`/masuk?callbackUrl=${encodeURIComponent(contestSlug ? `/sayembara/${contestSlug}` : "/sayembara")}`}
            className="inline-flex items-center justify-center rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-obsidian hover:bg-gold-light transition-colors"
          >
            Masuk ke Akun
          </Link>
        </div>
      </div>
    );
  }

  // JIKA USER SUDAH PUNYA SUBMISSION AKTIF (PENDING / APPROVED) -> TAMPILKAN STATUS CARD
  if (userEntry && (userEntry.status === "PENDING" || userEntry.status === "APPROVED")) {
    const isApproved = userEntry.status === "APPROVED";

    return (
      <div className="rounded-2xl border border-white/10 bg-coal p-4 sm:p-8 space-y-5 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4 sm:pb-5">
          <div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                isApproved
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400"
              }`}
            >
              {isApproved ? (
                <>
                  <CheckCircle2Icon className="size-3.5" />
                  Karya Disetujui ✓
                </>
              ) : (
                <>
                  <ClockIcon className="size-3.5" />
                  Menunggu Kurasi Panitia
                </>
              )}
            </span>
            <h3 className="text-xl font-bold text-cream mt-2">
              {isApproved ? "Karya Desain Kamu Lolos Kurasi!" : "Karya Desain Kamu Sedang Dikurasi"}
            </h3>
          </div>
        </div>

        {/* Informasi Batasan 1 Akun = 1 Karya Aktif */}
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 text-xs leading-relaxed ${
            isApproved
              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
              : "border-amber-500/20 bg-amber-500/5 text-amber-300"
          }`}
        >
          <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              {isApproved
                ? "Karya ini akan tampil otomatis pada galeri pemungutan suara (voting)."
                : "1 akun hanya dapat mengirim 1 karya aktif."}
            </p>
            <p className="mt-0.5 opacity-90">
              {isApproved
                ? "Terima kasih atas partisipasi kamu. Ajak sivitas akademika PENS untuk memberikan dukungan saat voting dibuka!"
                : "Kamu baru dapat mengajukan karya baru apabila karya saat ini ditolak oleh tim panitia BEM PENS."}
            </p>
          </div>
        </div>

        {/* Preview Karya yang Diajukan (Foto 1 & Foto 2 jika ada) */}
        <div className="rounded-xl border border-white/10 bg-obsidian/60 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-gold uppercase tracking-wider">
                Foto Utama (Mock-up 1)
              </span>
              <div className="relative aspect-4/3 w-full rounded-lg overflow-hidden border border-white/10 bg-obsidian">
                <Image
                  src={userEntry.imageUrl}
                  alt={userEntry.title}
                  fill
                  className="object-contain p-2"
                  unoptimized
                />
              </div>
            </div>

            {userEntry.imageUrl2 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-gold uppercase tracking-wider">
                  Foto Pendukung (Mock-up 2)
                </span>
                <div className="relative aspect-4/3 w-full rounded-lg overflow-hidden border border-white/10 bg-obsidian">
                  <Image
                    src={userEntry.imageUrl2}
                    alt={`${userEntry.title} - Foto 2`}
                    fill
                    className="object-contain p-2"
                    unoptimized
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 text-center sm:text-left pt-2">
            <h4 className="text-lg font-bold text-cream">{userEntry.title}</h4>
            <p className="text-xs text-gold">
              Desainer: <strong className="text-cream">{userEntry.designerName}</strong>{" "}
              {userEntry.department ? `• ${userEntry.department}` : ""}{" "}
              {userEntry.batch ? `(Angkatan ${userEntry.batch})` : ""}
            </p>
            <div className="pt-2">
              <p className="text-xs font-semibold text-cream-muted uppercase tracking-wider">
                Konsep & Filosofi Desain:
              </p>
              <p className="mt-1 text-xs text-cream leading-relaxed whitespace-pre-line bg-coal/50 p-3 rounded-lg border border-white/5">
                {userEntry.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  async function handleFileUpload(file: File, targetSlot: 1 | 2) {
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Ukuran file maksimal 5MB.");
      return;
    }

    if (targetSlot === 1) setUploading1(true);
    else setUploading2(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Gagal mengupload file gambar.");
      }

      if (targetSlot === 1) {
        setValue("imageUrl", data.url, { shouldValidate: true });
      } else {
        setValue("imageUrl2", data.url, { shouldValidate: true });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal mengupload file desain.";
      setUploadError(message);
    } finally {
      if (targetSlot === 1) setUploading1(false);
      else setUploading2(false);
    }
  }

  async function onSubmit(values: SubmitEntryValues) {
    setServerError(null);
    setSuccessMsg(null);

    const res = await submitContestEntry(values);

    if (res.success) {
      setSuccessMsg(res.message ?? "Karya berhasil dikirim!");
      reset({
        contestId,
        title: "",
        designerName: "",
        department: "",
        batch: "",
        description: "",
        imageUrl: "",
        imageUrl2: "",
      });
      return;
    }

    if (res.fieldErrors) {
      for (const [field, msg] of Object.entries(res.fieldErrors)) {
        setError(field as keyof SubmitEntryValues, {
          type: "server",
          message: msg,
        });
      }
    }

    setServerError(res.error ?? "Gagal mengirim karya. Silakan periksa kembali data kamu.");
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-coal p-6 sm:p-8">
      {/* Banner Penolakan Khusus jika sebelumnya REJECTED */}
      {userEntry && userEntry.status === "REJECTED" && (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
            <AlertTriangleIcon className="size-4 shrink-0" />
            <span>Karya Desain Sebelumnya Belum Lolos / Ditolak Panitia</span>
          </div>

          {userEntry.adminNote ? (
            <p className="text-xs text-cream leading-relaxed bg-obsidian/60 p-3 rounded-lg border border-red-500/20">
              <strong className="text-red-400">Catatan Panitia:</strong> &ldquo;{userEntry.adminNote}&rdquo;
            </p>
          ) : (
            <p className="text-xs text-cream-muted leading-relaxed">
              Karya sebelumnya belum memenuhi kriteria orisinalitas atau ketentuan mockup sayembara.
            </p>
          )}

          <div className="flex items-center gap-1.5 text-xs font-semibold text-gold pt-1">
            <RefreshCwIcon className="size-3.5" />
            <span>Silakan perbaiki desain kamu dan kirimkan kembali karya melalui formulir di bawah.</span>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-bold text-cream">
          {userEntry && userEntry.status === "REJECTED"
            ? "Formulir Pengajuan Ulang Desain"
            : "Formulir Pengumpulan Desain"}
        </h3>
        <p className="mt-1 text-sm text-cream-muted">
          Pastikan karya orisinal. Kamu bisa mengunggah maksimal 2 foto mock-up (Foto 1 wajib, Foto 2 opsional).
        </p>
      </div>

      {successMsg && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          <CheckCircle2Icon className="size-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Pengiriman Berhasil!</p>
            <p className="text-xs text-emerald-300 mt-0.5">{successMsg}</p>
          </div>
        </div>
      )}

      {serverError && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircleIcon className="size-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Ada Kesalahan Input</p>
            <p className="text-xs text-red-300 mt-0.5">{serverError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <input type="hidden" {...register("contestId")} />

        {/* Judul & Nama Peserta */}
        <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2">
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="title" className="text-cream font-medium text-xs sm:text-sm">
              Judul Karya Desain *
            </Label>
            <Input
              id="title"
              placeholder="Contoh: Varsity Nusantara PENS 2026"
              className={`bg-obsidian border-white/15 text-cream text-base sm:text-sm h-11 sm:h-10 ${
                errors.title ? "border-red-500/80 focus:border-red-500" : ""
              }`}
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-red-400">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="designerName" className="text-cream font-medium text-xs sm:text-sm">
              Nama Lengkap Peserta *
            </Label>
            <Input
              id="designerName"
              placeholder="Nama kamu / tim"
              className={`bg-obsidian border-white/15 text-cream text-base sm:text-sm h-11 sm:h-10 ${
                errors.designerName ? "border-red-500/80 focus:border-red-500" : ""
              }`}
              {...register("designerName")}
            />
            {errors.designerName && (
              <p className="text-xs text-red-400">{errors.designerName.message}</p>
            )}
          </div>
        </div>

        {/* Jurusan (Dropdown) & Angkatan (4 Digit) */}
        <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2">
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="department" className="text-cream font-medium text-xs sm:text-sm">
              Jurusan / Program Studi *
            </Label>
            <select
              id="department"
              className={`w-full rounded-xl border border-white/15 bg-obsidian px-3 py-2 text-base sm:text-sm text-cream focus:border-gold focus:outline-none h-11 sm:h-10 ${
                errors.department ? "border-red-500/80 focus:border-red-500" : ""
              }`}
              {...register("department")}
            >
              <option value="">-- Pilih Jurusan / Program Studi --</option>
              {PENS_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            {errors.department && (
              <p className="text-xs text-red-400">{errors.department.message}</p>
            )}
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="batch" className="text-cream font-medium text-xs sm:text-sm">
                Angkatan *
              </Label>
              <span className="text-[11px] text-cream-muted">Wajib 4 digit</span>
            </div>
            <Input
              id="batch"
              maxLength={4}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Contoh: 2024"
              className={`bg-obsidian border-white/15 text-cream font-mono text-base sm:text-sm h-11 sm:h-10 ${
                errors.batch ? "border-red-500/80 focus:border-red-500" : ""
              }`}
              {...register("batch")}
            />
            {errors.batch ? (
              <p className="text-xs text-red-400">{errors.batch.message}</p>
            ) : (
              <p className="text-[11px] text-cream-muted">Format 4 digit angka tahun masuk (cth: 2023, 2024)</p>
            )}
          </div>
        </div>

        {/* Filosofi Desain dengan Minimal 20 Karakter & Live Counter */}
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="description" className="text-cream font-medium text-xs sm:text-sm">
              Konsep & Filosofi Desain *
            </Label>
            <span
              className={`text-xs font-mono font-medium ${
                descLength >= 20 ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {descLength} / 20 karakter minimum
            </span>
          </div>

          <textarea
            id="description"
            rows={4}
            placeholder="Jelaskan makna di balik motif, komposisi warna, serta filosofi elemen yang kamu gunakan (minimal 20 karakter)..."
            className={`w-full rounded-xl border border-white/15 bg-obsidian p-3 text-base sm:text-sm text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none ${
              errors.description ? "border-red-500/80 focus:border-red-500" : ""
            }`}
            {...register("description")}
          />

          {errors.description ? (
            <p className="text-xs text-red-400">{errors.description.message}</p>
          ) : (
            <p className="text-[11px] text-cream-muted">
              Jelaskan ide di balik karya minimal 20 karakter agar audiens voting memahami konsep desainmu.
            </p>
          )}
        </div>

        {/* Upload Maksimal 2 Foto Desain */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <Label className="text-cream font-medium text-xs sm:text-sm">
              Foto Mock-up Desain (Maksimal 2 Foto) *
            </Label>
            <span className="text-[11px] text-gold font-medium flex items-center gap-1">
              <LayersIcon className="size-3 shrink-0" />
              Foto 1 Wajib • Foto 2 Tambahan/Opsional
            </span>
          </div>

          <input type="hidden" {...register("imageUrl")} />
          <input type="hidden" {...register("imageUrl2")} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* SLOT 1: FOTO UTAMA (WAJIB) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-cream">1. Foto Utama (Wajib) *</span>
                <span className="text-[11px] text-cream-muted">Ditampilkan di Galeri</span>
              </div>

              <div
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-obsidian/50 p-3 sm:p-4 text-center transition-colors min-h-[160px] sm:min-h-[200px] ${
                  errors.imageUrl
                    ? "border-red-500/80"
                    : "border-white/15 hover:border-gold/50"
                }`}
              >
                {currentImageUrl1 ? (
                  <div className="space-y-2.5 w-full">
                    <div className="relative mx-auto h-36 w-full rounded-lg overflow-hidden border border-gold/30 bg-obsidian">
                      <Image
                        src={currentImageUrl1}
                        alt="Preview Mock-up 1"
                        fill
                        className="object-contain p-1.5"
                        unoptimized
                      />
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <span className="inline-flex items-center text-[11px] font-semibold text-emerald-400">
                        <CheckCircle2Icon className="size-3 mr-1" />
                        Foto 1 Terpasang
                      </span>
                      <button
                        type="button"
                        onClick={() => setValue("imageUrl", "", { shouldValidate: true })}
                        className="inline-flex items-center text-[11px] text-red-400 hover:text-red-300"
                      >
                        <Trash2Icon className="size-3 mr-1" />
                        Ganti
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center py-4">
                    <UploadCloudIcon className="size-7 text-gold mb-2" />
                    <span className="text-xs font-semibold text-cream">
                      {uploading1 ? "Mengunggah..." : "Pilih Foto Utama"}
                    </span>
                    <span className="mt-1 text-[10px] text-cream-muted">
                      PNG/JPG/WEBP, Maks 5MB
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={uploading1}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 1);
                      }}
                    />
                  </label>
                )}
              </div>
              {errors.imageUrl && (
                <p className="text-xs text-red-400">{errors.imageUrl.message}</p>
              )}
            </div>

            {/* SLOT 2: FOTO KEDUA (OPSIONAL) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-cream">2. Foto Pendukung (Opsional)</span>
                <span className="text-[11px] text-gold">Muncul di Carousel Modal</span>
              </div>

              <div
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-obsidian/50 p-3 sm:p-4 text-center transition-colors min-h-[160px] sm:min-h-[200px] ${
                  errors.imageUrl2
                    ? "border-red-500/80"
                    : "border-white/15 hover:border-gold/50"
                }`}
              >
                {currentImageUrl2 ? (
                  <div className="space-y-2.5 w-full">
                    <div className="relative mx-auto h-36 w-full rounded-lg overflow-hidden border border-gold/30 bg-obsidian">
                      <Image
                        src={currentImageUrl2}
                        alt="Preview Mock-up 2"
                        fill
                        className="object-contain p-1.5"
                        unoptimized
                      />
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <span className="inline-flex items-center text-[11px] font-semibold text-emerald-400">
                        <CheckCircle2Icon className="size-3 mr-1" />
                        Foto 2 Terpasang
                      </span>
                      <button
                        type="button"
                        onClick={() => setValue("imageUrl2", "", { shouldValidate: true })}
                        className="inline-flex items-center text-[11px] text-red-400 hover:text-red-300"
                      >
                        <Trash2Icon className="size-3 mr-1" />
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center py-4">
                    <UploadCloudIcon className="size-7 text-cream-muted mb-2" />
                    <span className="text-xs font-semibold text-cream">
                      {uploading2 ? "Mengunggah..." : "Pilih Foto Pendukung"}
                    </span>
                    <span className="mt-1 text-[10px] text-cream-muted">
                      Detail bagian belakang/samping
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={uploading2}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 2);
                      }}
                    />
                  </label>
                )}
              </div>
              {errors.imageUrl2 && (
                <p className="text-xs text-red-400">{errors.imageUrl2.message}</p>
              )}
            </div>
          </div>

          {uploadError && (
            <p className="text-xs text-red-400">{uploadError}</p>
          )}
        </div>

        {/* Tombol Kirim */}
        <div className="pt-2">
          <Button
            type="submit"
            disabled={isSubmitting || uploading1 || uploading2}
            className="w-full h-12 sm:h-11 bg-gold text-obsidian font-bold hover:bg-gold-light transition-colors text-sm sm:text-base"
          >
            {isSubmitting ? (
              <>
                <LoaderCircleIcon className="size-4 mr-2 animate-spin" />
                Mengirim Karya ke Panitia...
              </>
            ) : userEntry && userEntry.status === "REJECTED" ? (
              "Kirim Ulang Karya Revisi"
            ) : (
              "Kirim Karya ke Panitia"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
