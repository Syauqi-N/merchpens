"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  CheckIcon,
  HeartIcon,
  TrophyIcon,
  UserIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LayersIcon,
} from "lucide-react";
import { castVote } from "@/app/sayembara/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EntryItem = {
  id: string;
  title: string;
  designerName: string;
  department: string | null;
  batch: string | null;
  description: string;
  imageUrl: string;
  imageUrl2?: string | null;
  voteCount: number;
};

export function VotingGallery({
  contestId,
  entries,
  userVotedEntryId,
  isLoggedIn,
  isFinished = false,
}: {
  contestId: string;
  entries: EntryItem[];
  userVotedEntryId: string | null;
  isLoggedIn: boolean;
  isFinished?: boolean;
}) {
  const router = useRouter();
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(userVotedEntryId);
  const [activeEntry, setActiveEntry] = useState<EntryItem | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openEntryModal(entry: EntryItem) {
    setActiveEntry(entry);
    setActiveImageIndex(0);
  }

  function handleVote(entryId: string) {
    if (!isLoggedIn) {
      router.push("/masuk?callbackUrl=/sayembara");
      return;
    }
    if (selectedEntryId) return;

    setErrorMsg(null);
    startTransition(async () => {
      const res = await castVote(contestId, entryId);
      if (res.success) {
        setSelectedEntryId(entryId);
      } else {
        setErrorMsg(res.error ?? "Gagal memberikan suara.");
      }
    });
  }

  const totalVotes = entries.reduce((acc, e) => acc + e.voteCount, 0);

  // Kumpulkan list foto untuk modal aktif
  const activeImages: string[] = activeEntry
    ? [activeEntry.imageUrl, activeEntry.imageUrl2].filter(
        (url): url is string => Boolean(url && url.trim().length > 0)
      )
    : [];

  return (
    <div>
      {errorMsg && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {errorMsg}
        </div>
      )}

      {selectedEntryId && (
        <div className="mb-8 flex items-center justify-between rounded-xl border border-gold/40 bg-gold/10 px-5 py-3.5 text-sm text-cream">
          <div className="flex items-center gap-2.5">
            <CheckIcon className="size-5 text-gold" />
            <span>
              Suara kamu telah tersimpan untuk karya:{" "}
              <strong>
                {entries.find((e) => e.id === selectedEntryId)?.title ?? "Pilihan Kamu"}
              </strong>
            </span>
          </div>
          <span className="text-xs text-gold">1 Suara Terverifikasi</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry, index) => {
          const isVotedByMe = selectedEntryId === entry.id;
          const votePercentage =
            totalVotes > 0 ? Math.round((entry.voteCount / totalVotes) * 100) : 0;
          const hasMultiplePhotos = Boolean(entry.imageUrl2 && entry.imageUrl2.trim().length > 0);

          return (
            <div
              key={entry.id}
              className={cn(
                "group flex flex-col overflow-hidden rounded-2xl border bg-coal transition-all duration-300 hover:border-gold/50",
                isVotedByMe ? "border-gold ring-1 ring-gold shadow-lg shadow-gold/10" : "border-white/10"
              )}
            >
              {/* Gambar Mockup Utama (Hanya Tampilkan Foto Pertama) */}
              <div
                className="relative aspect-4/3 w-full cursor-pointer overflow-hidden bg-obsidian"
                onClick={() => openEntryModal(entry)}
              >
                <Image
                  src={entry.imageUrl}
                  alt={entry.title}
                  fill
                  className="object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                
                {/* Badge 2 Foto jika ada */}
                {hasMultiplePhotos && (
                  <div className="absolute top-3 left-3 flex items-center gap-1 rounded-md bg-obsidian/90 px-2 py-1 text-[11px] font-semibold text-gold border border-gold/30 backdrop-blur">
                    <LayersIcon className="size-3" />
                    <span>2 Foto</span>
                  </div>
                )}

                <span className="absolute bottom-3 left-3 rounded-md bg-obsidian/90 px-2 py-1 text-[11px] font-medium text-cream-muted backdrop-blur">
                  Klik untuk melihat detail
                </span>
                
                {isFinished && index === 0 && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-xs font-bold text-obsidian shadow">
                    <TrophyIcon className="size-3.5" />
                    Pemenang
                  </div>
                )}
              </div>

              {/* Konten & Identitas Desainer */}
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2">
                  <h3 className="text-lg font-bold text-cream group-hover:text-gold transition-colors">
                    {entry.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-cream-muted">
                    <UserIcon className="size-3.5 text-gold" />
                    <span>{entry.designerName}</span>
                    {entry.department && <span>• {entry.department}</span>}
                    {entry.batch && <span>({entry.batch})</span>}
                  </div>
                </div>

                <p className="line-clamp-3 text-xs leading-relaxed text-cream-muted">
                  {entry.description}
                </p>

                <div className="mt-5 pt-4 border-t border-white/5 flex flex-col gap-3">
                  {/* Progress Suara: Hanya tampil jika fase FINISHED (selesai). Selama VOTING berlangsung, skor suara di-keep private. */}
                  {isFinished ? (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-cream-muted">Perolehan Suara:</span>
                        <span className="font-bold text-cream">
                          {entry.voteCount} Suara ({votePercentage}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-gold transition-all duration-500"
                          style={{ width: `${votePercentage}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-white/5 bg-obsidian/40 px-3 py-2 text-xs text-cream-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-gold animate-pulse" />
                        Status Voting:
                      </span>
                      <span className="font-medium text-gold">Suara Dirahasiakan</span>
                    </div>
                  )}

                  {/* Tombol Aksi */}
                  {!isFinished && (
                    <Button
                      type="button"
                      disabled={isPending || Boolean(selectedEntryId)}
                      onClick={() => handleVote(entry.id)}
                      className={cn(
                        "mt-2 w-full font-semibold transition-all",
                        isVotedByMe
                          ? "bg-gold text-obsidian hover:bg-gold-light"
                          : selectedEntryId
                            ? "bg-white/5 text-cream-faint border border-white/10 cursor-not-allowed"
                            : "bg-obsidian border border-gold/40 text-gold hover:bg-gold hover:text-obsidian"
                      )}
                    >
                      {isVotedByMe ? (
                        <>
                          <CheckIcon className="size-4 mr-1.5" />
                          Pilihan Kamu
                        </>
                      ) : (
                        <>
                          <HeartIcon className="size-4 mr-1.5" />
                          {isLoggedIn ? "Vote Desain Ini" : "Masuk untuk Vote"}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Detail, Filosofi, & Carousel Gambar Desain */}
      {activeEntry && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/90 p-2 sm:p-4 backdrop-blur-md"
          onClick={() => setActiveEntry(null)}
        >
          <div
            className="relative max-h-[96vh] sm:max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/15 bg-coal p-3 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Carousel Container: di mobile aspect-square / min-h, di desktop aspect-16/10 atau h-[55vh] */}
            <div className="group/carousel relative aspect-square sm:aspect-16/10 sm:h-[55vh] w-full overflow-hidden rounded-xl bg-obsidian border border-white/10">
              <Image
                src={activeImages[activeImageIndex] || activeEntry.imageUrl}
                alt={`${activeEntry.title} - Foto ${activeImageIndex + 1}`}
                fill
                className="object-contain p-1.5 sm:p-4 transition-all duration-300"
                sizes="(max-width: 768px) 100vw, 900px"
              />

              {/* Kontrol Navigasi Carousel (Jika gambar > 1) */}
              {activeImages.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Foto sebelumnya"
                    onClick={() =>
                      setActiveImageIndex((prev) =>
                        prev === 0 ? activeImages.length - 1 : prev - 1
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-gold hover:scale-110 active:scale-95 transition-all drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                  >
                    <ChevronLeftIcon className="size-8 stroke-[2.5]" />
                  </button>

                  <button
                    type="button"
                    aria-label="Foto berikutnya"
                    onClick={() =>
                      setActiveImageIndex((prev) =>
                        prev === activeImages.length - 1 ? 0 : prev + 1
                      )
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-gold hover:scale-110 active:scale-95 transition-all drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                  >
                    <ChevronRightIcon className="size-8 stroke-[2.5]" />
                  </button>

                  {/* Indicator Dots & Page Label */}
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-obsidian/80 px-3 py-1 border border-white/15 backdrop-blur">
                    {activeImages.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        aria-label={`Lihat foto ${idx + 1}`}
                        className={cn(
                          "size-2 rounded-full transition-all",
                          activeImageIndex === idx
                            ? "bg-gold w-5"
                            : "bg-white/40 hover:bg-white/70"
                        )}
                      />
                    ))}
                    <span className="ml-1 text-[10px] font-mono text-cream-muted">
                      {activeImageIndex + 1}/{activeImages.length}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail Navigation Bar (Jika 2 foto) */}
            {activeImages.length > 1 && (
              <div className="mt-3 flex gap-2">
                {activeImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={cn(
                      "relative h-14 w-20 overflow-hidden rounded-lg border bg-obsidian transition-all",
                      activeImageIndex === idx
                        ? "border-gold ring-1 ring-gold opacity-100"
                        : "border-white/10 opacity-60 hover:opacity-100"
                    )}
                  >
                    <Image
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      fill
                      className="object-contain p-1"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Informasi Detail Karya */}
            <div className="mt-5">
              <h2 className="text-xl font-bold text-cream">{activeEntry.title}</h2>
              <p className="mt-1 text-sm text-gold">
                Karya: {activeEntry.designerName}{" "}
                {activeEntry.department ? `• ${activeEntry.department}` : ""}{" "}
                {activeEntry.batch ? `(${activeEntry.batch})` : ""}
              </p>

              <div className="mt-4 rounded-xl border border-white/5 bg-obsidian/50 p-4">
                <h4 className="text-xs font-bold tracking-wider text-cream-muted uppercase">
                  Konsep & Filosofi Desain
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-cream-muted whitespace-pre-line">
                  {activeEntry.description}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setActiveEntry(null)}
                  className="border-white/15 text-cream hover:bg-white/5"
                >
                  Tutup
                </Button>
                {!isFinished && (
                  <Button
                    disabled={isPending || Boolean(selectedEntryId)}
                    onClick={() => {
                      handleVote(activeEntry.id);
                      setActiveEntry(null);
                    }}
                    className="bg-gold text-obsidian font-bold hover:bg-gold-light"
                  >
                    {selectedEntryId === activeEntry.id ? "Sudah Kamu Vote" : "Vote Karya Ini"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
