import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AwardIcon, CalendarIcon, SparklesIcon } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getContestPhase, CONTEST_PHASE_CONFIG } from "@/lib/contest";
import { ContestTimelineTracker } from "@/components/sayembara/contest-timeline";
import { VotingGallery } from "@/components/sayembara/voting-gallery";
import { SubmissionForm } from "@/components/sayembara/submission-form";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Sayembara & Voting Desain Resmi BEM PENS",
  description:
    "Ikuti sayembara desain merchandise resmi BEM PENS dan berikan suara voting kamu untuk karya favorit sivitas akademika.",
};

export default async function SayembaraPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;

  // 1. Ambil semua sayembara yang berstatus publik
  const allContests = await prisma.contest.findMany({
    where: {
      status: { in: ["PUBLISHED", "ANNOUNCED", "CLOSED"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      submissionStart: true,
      submissionEnd: true,
      votingStart: true,
      votingEnd: true,
    },
  });

  // 2. Tentukan sayembara yang sedang ditampilkan:
  // Jika ada query ?slug=xyz, tampilkan itu. Jika tidak, pilih yang terbaru.
  const targetContestMeta =
    (slug ? allContests.find((c) => c.slug === slug) : allContests[0]) ?? null;

  let contest = null;
  if (targetContestMeta) {
    contest = await prisma.contest.findUnique({
      where: { id: targetContestMeta.id },
      include: {
        entries: {
          where: { status: "APPROVED" },
          select: {
            id: true,
            title: true,
            designerName: true,
            department: true,
            batch: true,
            description: true,
            imageUrl: true,
            imageUrl2: true,
            voteCount: true,
          },
          orderBy: { voteCount: "desc" },
        },
      },
    });
  }

  if (!contest) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-gold/10 text-gold">
          <SparklesIcon className="size-7" />
        </div>
        <h1 className="text-2xl font-bold text-cream">Belum Ada Sayembara Aktif</h1>
        <p className="mt-2 text-sm text-cream-muted max-w-md mx-auto">
          Panitia BEM PENS sedang menyiapkan periode sayembara berikutnya. Silakan pantau kembali berkala!
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-obsidian hover:bg-gold-light"
        >
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  const currentPhase = getContestPhase(contest);
  const phaseInfo = CONTEST_PHASE_CONFIG[currentPhase];

  // Cek apakah user saat ini sudah vote di sayembara ini
  let userVotedEntryId: string | null = null;
  let userExistingEntry = null;

  if (userId) {
    const [existingVote, existingEntry] = await Promise.all([
      prisma.contestVote.findUnique({
        where: {
          contestId_userId: {
            contestId: contest.id,
            userId,
          },
        },
        select: { entryId: true },
      }),
      prisma.contestEntry.findFirst({
        where: {
          contestId: contest.id,
          userId,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          designerName: true,
          department: true,
          batch: true,
          description: true,
          imageUrl: true,
          status: true,
          adminNote: true,
          createdAt: true,
        },
      }),
    ]);

    userVotedEntryId = existingVote?.entryId ?? null;
    if (existingEntry) {
      userExistingEntry = {
        ...existingEntry,
        createdAt: existingEntry.createdAt.toISOString(),
      };
    }
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-gold/20 bg-obsidian py-12 sm:py-16">
        <div className="absolute inset-0 opacity-15">
          <Image
            src="/brand/bg-batik.webp"
            alt="Motif Batik"
            fill
            className="object-cover"
            priority
          />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Baris Selector Sayembara (jika ada lebih dari 1 sayembara) */}
          {allContests.length > 1 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="text-xs text-cream-muted">Pilih Sayembara:</span>
              <div className="flex flex-wrap gap-1.5">
                {allContests.map((item) => {
                  const isCurrent = item.slug === contest.slug;
                  return (
                    <Link
                      key={item.id}
                      href={`/sayembara?slug=${item.slug}`}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                        isCurrent
                          ? "bg-gold text-obsidian shadow-sm shadow-gold/20"
                          : "border border-white/15 bg-white/5 text-cream-muted hover:border-gold/40 hover:text-cream"
                      }`}
                    >
                      {item.title}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
              <SparklesIcon className="size-3.5" />
              SAYEMBARA BEM PENS • REFORMASIASA
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${phaseInfo.badgeClass}`}
            >
              Fase: {phaseInfo.label}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-cream sm:text-4xl lg:text-5xl">
            {contest.title}
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-cream-muted sm:text-base">
            {contest.description}
          </p>

          {contest.prizeInfo && (
            <div className="mt-6 inline-flex flex-wrap items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2.5 text-xs text-gold">
              <AwardIcon className="size-4 shrink-0" />
              <span className="font-semibold">{contest.prizeInfo}</span>
            </div>
          )}

          {/* Timeline Tracker */}
          <div className="mt-8">
            <ContestTimelineTracker currentPhase={currentPhase} />
          </div>
        </div>
      </section>

      {/* Dynamic Content Section Sesuai Timeline */}
      <main className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 lg:px-8">
        {/* FASE 1: SUBMISSION */}
        {currentPhase === "SUBMISSION" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-2xl border border-white/10 bg-coal p-6">
                <h3 className="text-lg font-bold text-cream mb-3">Ketentuan Sayembara</h3>
                <div className="text-xs leading-relaxed text-cream-muted whitespace-pre-line">
                  {contest.rules ?? "Ikuti panduan desain resmi kampus perjuangan."}
                </div>
              </div>

              <div className="rounded-2xl border border-gold/30 bg-gold/5 p-6">
                <div className="flex items-center gap-2 text-gold font-bold text-sm mb-2">
                  <CalendarIcon className="size-4" />
                  Batas Waktu Pengumpulan
                </div>
                <p className="text-xs text-cream-muted">
                  Karya diterima paling lambat{" "}
                  <strong className="text-cream">{formatDate(contest.submissionEnd)}</strong>.
                  Setelah itu form submit otomatis ditutup dan masuk tahap kurasi panitia.
                </p>
              </div>
            </div>

            <div className="lg:col-span-7">
              <SubmissionForm
                contestId={contest.id}
                isLoggedIn={Boolean(userId)}
                userEntry={userExistingEntry}
              />
            </div>
          </div>
        )}

        {/* FASE 2: REVIEW */}
        {currentPhase === "REVIEW" && (
          <div className="rounded-2xl border border-blue-500/20 bg-coal p-10 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
              <SparklesIcon className="size-6" />
            </div>
            <h2 className="text-2xl font-bold text-cream">Pengumpulan Karya Telah Berakhir</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-cream-muted">
              Saat ini dewan juri & panitia BEM PENS sedang melakukan kurasi orisinalitas dan verifikasi teknis karya peserta.
              Voting mahasiswa akan resmi dibuka pada{" "}
              <strong className="text-gold">{formatDate(contest.votingStart)}</strong>.
            </p>
          </div>
        )}

        {/* FASE 3: VOTING */}
        {currentPhase === "VOTING" && (
          <div>
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-2xl font-bold text-cream">Galeri Karya & Pemungutan Suara</h2>
                <p className="mt-1 text-sm text-cream-muted">
                  Gunakan hak suaramu untuk menentukan desain resmi merchandise Kabinet ReformasiAsa!
                </p>
              </div>
              <div className="text-xs text-gold border border-gold/30 bg-gold/10 px-3 py-1.5 rounded-lg shrink-0">
                Voting ditutup: {formatDate(contest.votingEnd)}
              </div>
            </div>

            <VotingGallery
              contestId={contest.id}
              entries={contest.entries}
              userVotedEntryId={userVotedEntryId}
              isLoggedIn={Boolean(userId)}
            />
          </div>
        )}

        {/* FASE 4: FINISHED / PENGUMUMAN */}
        {currentPhase === "FINISHED" && (
          <div>
            <div className="mb-8 rounded-2xl border border-gold/40 bg-gold/10 p-6 text-center sm:p-8">
              <AwardIcon className="mx-auto size-10 text-gold mb-3" />
              <h2 className="text-2xl font-bold text-cream sm:text-3xl">
                Voting Resmi Telah Berakhir!
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-cream-muted">
                Terima kasih atas partisipasi aktif seluruh mahasiswa PENS. Berikut adalah perolehan hasil voting karya desain terbaik.
              </p>
            </div>

            <VotingGallery
              contestId={contest.id}
              entries={contest.entries}
              userVotedEntryId={userVotedEntryId}
              isLoggedIn={Boolean(userId)}
              isFinished
            />
          </div>
        )}
      </main>
    </div>
  );
}
