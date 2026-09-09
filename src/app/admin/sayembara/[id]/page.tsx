import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon, TrophyIcon, PencilIcon, ExternalLinkIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getContestPhase, CONTEST_PHASE_CONFIG } from "@/lib/contest";
import { setContestStatus } from "../actions";
import { DeleteContestButton } from "../delete-button";
import { ModerationActions } from "./moderation-actions";
import { AdminEntryImagePreview } from "./entry-image-preview";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Kurasi Karya Sayembara | Admin Merch PENS",
};

export default async function AdminSayembaraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "MANAGE_CATALOG")) {
    redirect("/admin");
  }

  const { id } = await params;
  const contest = await prisma.contest.findUnique({
    where: { id },
    include: {
      entries: {
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { votes: true },
      },
    },
  });

  if (!contest) {
    notFound();
  }

  const phase = getContestPhase(contest);
  const phaseConfig = CONTEST_PHASE_CONFIG[phase];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/admin/sayembara"
          className="inline-flex items-center gap-2 text-xs font-semibold text-cream-muted hover:text-gold mb-3"
        >
          <ArrowLeftIcon className="size-3.5" />
          Kembali ke Daftar Sayembara
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-cream">{contest.title}</h1>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${phaseConfig.badgeClass}`}
              >
                Fase: {phaseConfig.label}
              </span>
            </div>
            <p className="text-sm text-cream-muted mt-1">
              Total {contest.entries.length} karya masuk • {contest._count.votes} suara terkumpul
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/sayembara/${contest.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-obsidian px-3 py-2 text-xs font-semibold text-cream hover:border-gold/50 hover:text-gold"
            >
              <PencilIcon className="size-3.5" />
              Edit Sayembara
            </Link>

            <Link
              href={`/sayembara?slug=${contest.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-obsidian px-3 py-2 text-xs font-semibold text-cream hover:border-gold/50 hover:text-gold"
            >
              <ExternalLinkIcon className="size-3.5" />
              Lihat di Web
            </Link>

            {contest.status !== "ANNOUNCED" ? (
              <form
                action={async () => {
                  "use server";
                  await setContestStatus(contest.id, "ANNOUNCED");
                }}
              >
                <Button
                  type="submit"
                  size="sm"
                  className="bg-gold text-obsidian font-bold hover:bg-gold-light"
                >
                  <TrophyIcon className="size-4 mr-1.5" />
                  Kunci & Umumkan Pemenang
                </Button>
              </form>
            ) : (
              <form
                action={async () => {
                  "use server";
                  await setContestStatus(contest.id, "PUBLISHED");
                }}
              >
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="border-white/20 text-cream"
                >
                  Buka Kembali Status Voting
                </Button>
              </form>
            )}

            <DeleteContestButton
              contestId={contest.id}
              contestTitle={contest.title}
              redirectAfter
            />
          </div>
        </div>
      </div>

      {/* Grid Kurasi Karya */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-cream">Kurasi & Moderasi Karya Peserta</h2>

        {contest.entries.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-coal p-12 text-center text-cream-muted">
            Belum ada karya yang masuk untuk sayembara ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {contest.entries.map((entry) => {
              return (
                <div
                  key={entry.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-coal"
                >
                  <div className="relative aspect-4/3 w-full bg-obsidian">
                    <AdminEntryImagePreview
                      title={entry.title}
                      imageUrl={entry.imageUrl}
                      imageUrl2={entry.imageUrl2}
                    />
                    <div className="pointer-events-none absolute top-3 left-3 z-10">
                      {entry.status === "APPROVED" && (
                        <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 backdrop-blur-sm">
                          Disetujui ✓
                        </span>
                      )}
                      {entry.status === "PENDING" && (
                        <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-400 backdrop-blur-sm">
                          Perlu Kurasi
                        </span>
                      )}
                      {entry.status === "REJECTED" && (
                        <span className="rounded-full bg-red-500/20 border border-red-500/30 px-2.5 py-0.5 text-xs font-semibold text-red-400 backdrop-blur-sm">
                          Ditolak ✕
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-bold text-cream text-base">{entry.title}</h3>
                    <p className="text-xs text-gold mt-0.5">
                      {entry.designerName} {entry.department ? `• ${entry.department}` : ""}
                    </p>
                    <p className="mt-3 text-xs leading-relaxed text-cream-muted line-clamp-3">
                      {entry.description}
                    </p>

                    {entry.status === "REJECTED" && entry.adminNote && (
                      <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-300">
                        <span className="font-semibold text-red-400">Catatan penolakan: </span>
                        {entry.adminNote}
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                      <span className="text-xs font-bold text-cream">
                        {entry.voteCount} Suara
                      </span>

                      {/* Tombol Aksi Moderasi */}
                      <ModerationActions
                        entryId={entry.id}
                        entryTitle={entry.title}
                        currentStatus={entry.status}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
