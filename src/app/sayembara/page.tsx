import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRightIcon,
  AwardIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  LayersIcon,
  SparklesIcon,
  TrophyIcon,
  UsersIcon,
  VoteIcon,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/storefront/section-heading";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { getContestPhase, CONTEST_PHASE_CONFIG } from "@/lib/contest";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sayembara & Voting Desain Merchandise Resmi BEM PENS",
  description:
    "Daftar sayembara desain merchandise resmi BEM PENS yang sedang dibuka, tahap kurasi, maupun pemungutan suara voting karya favorit.",
};

const STEPS = [
  {
    icon: SparklesIcon,
    title: "1. Pilih Sayembara",
    description:
      "Pilih sayembara merchandise yang sedang dibuka untuk melihat tema, ketentuan mockup, dan hadiah juara.",
  },
  {
    icon: LayersIcon,
    title: "2. Kirim Karya Desain",
    description:
      "Kirimkan desain terbaikmu (maksimal 2 mockup foto) beserta filosofi konsep karyamu sebelum batas waktu berakhir.",
  },
  {
    icon: CheckCircle2Icon,
    title: "3. Kurasi Panitia",
    description:
      "Karya diperiksa oleh panitia BEM PENS untuk memastikan orisinalitas dan kelayakan teknis sebelum masuk voting publik.",
  },
  {
    icon: VoteIcon,
    title: "4. Voting Mahasiswa",
    description:
      "Gunakan hak suaramu untuk memilih desain terfavorit. Karya pemenang akan diproduksi resmi pada batch Pre-Order!",
  },
] as const;

export default async function SayembaraIndexPage() {
  const now = new Date();

  // Ambil semua sayembara yang tidak berstatus DRAFT
  const contests = await prisma.contest.findMany({
    where: {
      status: { in: ["PUBLISHED", "ANNOUNCED", "CLOSED"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          entries: { where: { status: "APPROVED" } },
          votes: true,
        },
      },
    },
  });

  const activeContests = contests.filter((c) => {
    const phase = getContestPhase(c, now);
    return phase === "SUBMISSION" || phase === "VOTING" || phase === "REVIEW";
  });

  const featuredContest = activeContests[0] ?? contests[0] ?? null;

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-obsidian">
        <div
          aria-hidden
          className="bg-batik pointer-events-none absolute inset-0 opacity-70"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 h-[360px] w-[520px] translate-x-1/4 -translate-y-1/3 rounded-full bg-gold/10 blur-[120px]"
        />
        <div
          aria-hidden
          className="gold-divider absolute inset-x-0 bottom-0 h-px"
        />

        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-8 sm:gap-10 px-4 py-8 sm:py-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] sm:text-[11px] font-bold tracking-[0.22em] text-gold uppercase">
              <TrophyIcon className="size-3.5" aria-hidden />
              Sayembara Desain BEM PENS
            </span>
            <h1 className="font-display mt-3 sm:mt-4 max-w-3xl text-2xl sm:text-4xl lg:text-5xl leading-tight font-extrabold tracking-tight text-cream uppercase">
              Suara & Karya Mahasiswa untuk Kampus
            </h1>
            <p className="mt-3 sm:mt-4 max-w-2xl text-xs sm:text-base leading-relaxed text-cream-muted">
              Wadah kompetisi desain merchandise resmi PENS. Mahasiswa dapat menyalurkan ide kreatif dan seluruh sivitas akademika ikut menentukan karya terbaik lewat pemungutan suara resmi.
            </p>
            {activeContests.length > 0 && (
              <p className="mt-4 sm:mt-5 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                {activeContests.length} sayembara sedang berlangsung
              </p>
            )}
          </div>

          {featuredContest ? (
            <div className="w-full rounded-2xl sm:rounded-3xl border border-gold/30 bg-coal/80 p-4 sm:p-6 backdrop-blur-sm">
              {(() => {
                const phase = getContestPhase(featuredContest, now);
                const phaseConfig = CONTEST_PHASE_CONFIG[phase];
                return (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold tracking-[0.22em] text-gold uppercase">
                        Sorotan Sayembara
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${phaseConfig.badgeClass}`}
                      >
                        {phaseConfig.label}
                      </span>
                    </div>

                    <p className="font-display mt-3 text-xl font-extrabold tracking-tight text-cream sm:text-2xl">
                      {featuredContest.title}
                    </p>

                    <p className="mt-2 text-xs leading-relaxed text-cream-muted line-clamp-2">
                      {featuredContest.description}
                    </p>

                    {featuredContest.prizeInfo && (
                      <div className="mt-4 flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold">
                        <AwardIcon className="size-4 shrink-0" />
                        <span className="font-semibold truncate">
                          {featuredContest.prizeInfo}
                        </span>
                      </div>
                    )}

                    <div className="mt-4 sm:mt-5 border-t border-white/10 pt-3 sm:pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-xs text-cream-muted">
                        <span className="text-gold font-bold">{featuredContest._count.entries}</span> karya disetujui • <span className="text-gold font-bold">{featuredContest._count.votes}</span> suara
                      </div>

                      <Link
                        href={`/sayembara/${featuredContest.slug}`}
                        className="inline-flex h-10 sm:h-9 items-center justify-center gap-1.5 rounded-xl bg-gold px-4 text-xs font-bold text-obsidian hover:bg-gold-light transition-colors"
                      >
                        Buka Sayembara
                        <ArrowRightIcon className="size-3.5" />
                      </Link>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : null}
        </div>
      </section>

      {/* Alur Sayembara */}
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-12">
        <SectionHeading
          number="01"
          eyebrow="Alur"
          title="Cara Mengikuti Sayembara"
          description="Kirimkan desainmu atau gunakan hak suaramu untuk menentukan merchandise resmi kampus."
        />

        <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-coal p-4"
              >
                <span
                  aria-hidden
                  className="grid size-10 place-items-center rounded-xl bg-gold/10 text-gold"
                >
                  <Icon className="size-5" />
                </span>
                <p className="text-sm font-semibold text-cream">{step.title}</p>
                <p className="text-xs leading-relaxed text-cream-muted">
                  {step.description}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Daftar Sayembara */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-10 sm:pb-16">
        <SectionHeading
          number="02"
          eyebrow="Sayembara"
          title="Daftar Sayembara Desain"
          description="Pilih salah satu sayembara untuk melihat detail karya, mengirim desain, atau memberikan voting suara."
        />

        {contests.length === 0 ? (
          <EmptyState
            icon={<TrophyIcon />}
            title="Belum ada sayembara yang dibuka"
            description="Panitia BEM PENS sedang menyiapkan periode sayembara berikutnya. Silakan pantau kembali berkala!"
            className="mt-6"
            action={
              <Link
                href="/produk"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-medium text-obsidian transition-colors hover:bg-gold-light"
              >
                Lihat katalog produk
              </Link>
            }
          />
        ) : (
          <div className="mt-6 grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {contests.map((contest) => {
              const phase = getContestPhase(contest, now);
              const phaseConfig = CONTEST_PHASE_CONFIG[phase];

              return (
                <Link
                  key={contest.id}
                  href={`/sayembara/${contest.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-coal transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <div className="flex flex-1 flex-col gap-3.5 sm:gap-4 p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${phaseConfig.badgeClass}`}
                      >
                        {phaseConfig.label}
                      </span>
                      <span
                        aria-hidden
                        className="grid size-8 shrink-0 place-items-center rounded-full bg-gold/10 text-gold transition-transform group-hover:translate-x-1"
                      >
                        <ArrowRightIcon className="size-4" />
                      </span>
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-cream transition-colors group-hover:text-gold-light line-clamp-1">
                        {contest.title}
                      </h2>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-cream-muted">
                        {contest.description}
                      </p>
                    </div>

                    {contest.prizeInfo && (
                      <div className="flex items-center gap-2 rounded-xl border border-gold/20 bg-gold/5 px-3 py-2 text-xs text-gold">
                        <AwardIcon className="size-4 shrink-0" />
                        <span className="font-semibold truncate">{contest.prizeInfo}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-obsidian p-2.5">
                        <span className="text-[11px] text-cream-muted block">Pengumpulan</span>
                        <span className="font-semibold text-cream mt-0.5 block">
                          s/d {formatDate(contest.submissionEnd)}
                        </span>
                      </div>
                      <div className="rounded-xl bg-obsidian p-2.5">
                        <span className="text-[11px] text-cream-muted block">Voting</span>
                        <span className="font-semibold text-cream mt-0.5 block">
                          s/d {formatDate(contest.votingEnd)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-3 text-xs text-cream-muted">
                      <span className="inline-flex items-center gap-1">
                        <UsersIcon className="size-3.5 text-gold" />
                        {contest._count.entries} karya disetujui
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-gold">
                        <TrophyIcon className="size-3.5" />
                        {contest._count.votes} suara
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 bg-obsidian px-5 py-3 text-xs font-bold text-[#D8D3C7] group-hover:text-gold-light sm:px-6">
                    <span>Masuk ke Sayembara</span>
                    <ArrowRightIcon className="size-3.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
