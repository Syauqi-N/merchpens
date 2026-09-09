"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCwIcon, LoaderCircleIcon, AlertCircleIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  contestFormSchema,
  type ContestFormValues,
} from "./schemas";
import { saveContest } from "./actions";

type ContestFormProps = {
  mode: "create" | "edit";
  contestId?: string;
  defaultValues?: Partial<ContestFormValues>;
};

export function ContestForm({ mode, contestId, defaultValues }: ContestFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContestFormValues>({
    resolver: zodResolver(contestFormSchema),
    defaultValues: {
      title: defaultValues?.title ?? "",
      slug: defaultValues?.slug ?? "",
      description: defaultValues?.description ?? "",
      rules: defaultValues?.rules ?? "",
      prizeInfo: defaultValues?.prizeInfo ?? "",
      status: defaultValues?.status ?? "PUBLISHED",
      submissionStart: defaultValues?.submissionStart ?? "",
      submissionEnd: defaultValues?.submissionEnd ?? "",
      votingStart: defaultValues?.votingStart ?? "",
      votingEnd: defaultValues?.votingEnd ?? "",
    },
  });

  function handleAutoGenerateSlug() {
    const currentTitle = getValues("title");
    if (!currentTitle) {
      toast.info("Ketik judul sayembara terlebih dahulu.");
      return;
    }
    const generated = slugify(currentTitle);
    setValue("slug", generated, { shouldValidate: true });
    toast.success("Slug otomatis dibuat.");
  }

  async function onSubmit(values: ContestFormValues) {
    setServerError(null);

    const res = await saveContest(contestId ?? null, values);

    if (res.ok) {
      toast.success(res.message);
      router.push("/admin/sayembara");
      router.refresh();
      return;
    }

    if (res.fieldErrors) {
      for (const [field, msg] of Object.entries(res.fieldErrors)) {
        setError(field as keyof ContestFormValues, {
          type: "server",
          message: msg,
        });
      }
    }

    setServerError(res.message);
    toast.error(res.message);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircleIcon className="size-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Gagal Menyimpan Sayembara</p>
            <p className="text-xs text-red-300 mt-0.5">{serverError}</p>
          </div>
        </div>
      )}

      {/* Judul & Slug */}
      <div className="space-y-2">
        <Label htmlFor="title" className="text-cream text-sm font-semibold">
          Judul Sayembara *
        </Label>
        <Input
          id="title"
          placeholder="Contoh: Sayembara Desain Hoodie ReformasiAsa 2026"
          className="bg-obsidian border-white/15 text-cream h-11"
          {...register("title")}
        />
        {errors.title && (
          <p className="text-xs text-red-400">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="slug" className="text-cream text-sm font-semibold">
            Slug URL (Tautan Web) *
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAutoGenerateSlug}
            className="h-7 text-xs text-gold hover:text-gold-light px-2"
          >
            <RefreshCwIcon className="size-3 mr-1.5" />
            Generate dari Judul
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-cream-muted select-none">
            /sayembara/
          </span>
          <Input
            id="slug"
            placeholder="sayembara-desain-hoodie-2026"
            className="bg-obsidian border-white/15 text-cream font-mono text-sm h-11"
            {...register("slug")}
          />
        </div>
        {errors.slug && (
          <p className="text-xs text-red-400">{errors.slug.message}</p>
        )}
      </div>

      {/* Deskripsi */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-cream text-sm font-semibold">
          Deskripsi Sayembara *
        </Label>
        <textarea
          id="description"
          rows={3}
          placeholder="Jelaskan tujuan, tema, dan detail pelaksanaan sayembara..."
          className="w-full rounded-xl border border-white/15 bg-obsidian p-3 text-sm text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none"
          {...register("description")}
        />
        {errors.description && (
          <p className="text-xs text-red-400">{errors.description.message}</p>
        )}
      </div>

      {/* Hadiah */}
      <div className="space-y-2">
        <Label htmlFor="prizeInfo" className="text-cream text-sm font-semibold">
          Informasi Hadiah / Apresiasi Juara
        </Label>
        <Input
          id="prizeInfo"
          placeholder="Contoh: Juara 1: Rp 1.500.000 + Jaket Gratis + Piagam BEM PENS"
          className="bg-obsidian border-white/15 text-cream h-11"
          {...register("prizeInfo")}
        />
        {errors.prizeInfo && (
          <p className="text-xs text-red-400">{errors.prizeInfo.message}</p>
        )}
      </div>

      {/* Syarat & Ketentuan */}
      <div className="space-y-2">
        <Label htmlFor="rules" className="text-cream text-sm font-semibold">
          Ketentuan & Syarat Lomba
        </Label>
        <textarea
          id="rules"
          rows={4}
          placeholder={"1. Wajib mahasiswa aktif PENS\n2. Desain orisinal bertema ReformasiAsa\n3. Format file PNG transparan resolusi tinggi"}
          className="w-full rounded-xl border border-white/15 bg-obsidian p-3 text-xs font-mono text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none"
          {...register("rules")}
        />
        {errors.rules && (
          <p className="text-xs text-red-400">{errors.rules.message}</p>
        )}
      </div>

      {/* Timeline Jadwal */}
      <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5 space-y-5">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-gold" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-gold">
            Pengaturan Jadwal Timeline Otomatis
          </h3>
        </div>
        <p className="text-xs text-cream-muted">
          Sistem akan mengubah fase tampilan publik secara otomatis berdasarkan tanggal di bawah.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="submissionStart" className="text-xs text-cream font-medium">
              Mulai Pengumpulan Karya *
            </Label>
            <Input
              id="submissionStart"
              type="datetime-local"
              className="bg-obsidian border-white/15 text-cream text-xs h-10"
              {...register("submissionStart")}
            />
            {errors.submissionStart && (
              <p className="text-xs text-red-400">{errors.submissionStart.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="submissionEnd" className="text-xs text-cream font-medium">
              Batas Pengumpulan Karya *
            </Label>
            <Input
              id="submissionEnd"
              type="datetime-local"
              className="bg-obsidian border-white/15 text-cream text-xs h-10"
              {...register("submissionEnd")}
            />
            {errors.submissionEnd && (
              <p className="text-xs text-red-400">{errors.submissionEnd.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="votingStart" className="text-xs text-cream font-medium">
              Mulai Voting Mahasiswa *
            </Label>
            <Input
              id="votingStart"
              type="datetime-local"
              className="bg-obsidian border-white/15 text-cream text-xs h-10"
              {...register("votingStart")}
            />
            {errors.votingStart && (
              <p className="text-xs text-red-400">{errors.votingStart.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="votingEnd" className="text-xs text-cream font-medium">
              Batas Akhir Voting *
            </Label>
            <Input
              id="votingEnd"
              type="datetime-local"
              className="bg-obsidian border-white/15 text-cream text-xs h-10"
              {...register("votingEnd")}
            />
            {errors.votingEnd && (
              <p className="text-xs text-red-400">{errors.votingEnd.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label htmlFor="status" className="text-cream text-sm font-semibold">
          Status Publikasi
        </Label>
        <select
          id="status"
          className="w-full rounded-xl border border-white/15 bg-obsidian px-3 py-2.5 text-sm text-cream focus:border-gold focus:outline-none"
          {...register("status")}
        >
          <option value="PUBLISHED">PUBLISHED (Aktif mengikuti jadwal timeline di atas)</option>
          <option value="DRAFT">DRAFT (Disimpan sementara, belum tampil di publik)</option>
          <option value="ANNOUNCED">ANNOUNCED (Selesai & tampilkan pemenang juara)</option>
          <option value="CLOSED">CLOSED (Ditutup panitia)</option>
        </select>
        {errors.status && (
          <p className="text-xs text-red-400">{errors.status.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 bg-gold text-obsidian font-bold text-sm hover:bg-gold-light transition-colors"
        >
          {isSubmitting ? (
            <>
              <LoaderCircleIcon className="size-4 mr-2 animate-spin" />
              Menyimpan Sayembara...
            </>
          ) : mode === "create" ? (
            "Simpan & Terbitkan Sayembara"
          ) : (
            "Simpan Perubahan Sayembara"
          )}
        </Button>
      </div>
    </form>
  );
}
