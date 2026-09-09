import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, TrophyIcon, UsersIcon, ExternalLinkIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { getContestPhase, CONTEST_PHASE_CONFIG } from "@/lib/contest";
import { formatDate } from "@/lib/format";
import { DeleteContestButton } from "./delete-button";

export const metadata: Metadata = {
  title: "Kelola Sayembara | Admin Merch PENS",
};

export default async function AdminSayembaraPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "MANAGE_CATALOG")) {
    redirect("/admin");
  }

  const contests = await prisma.contest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          entries: true,
          votes: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cream">Sayembara & Voting Desain</h1>
          <p className="text-sm text-cream-muted">
            Kelola periode lomba desain, hapus sayembara lampau, dan buat sayembara baru.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/sayembara"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-obsidian px-3.5 py-2.5 text-xs font-semibold text-cream hover:border-gold/50 hover:text-gold"
          >
            <ExternalLinkIcon className="size-3.5" />
            Lihat Halaman Publik
          </Link>
          <Link
            href="/admin/sayembara/baru"
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-obsidian hover:bg-gold-light"
          >
            <PlusIcon className="size-4" />
            Buat Sayembara Baru
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-coal overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-cream">
            <thead className="border-b border-white/10 bg-obsidian/60 text-xs font-semibold uppercase text-cream-muted">
              <tr>
                <th className="px-6 py-4">Judul Sayembara</th>
                <th className="px-6 py-4">Fase Timeline</th>
                <th className="px-6 py-4">Karya Masuk</th>
                <th className="px-6 py-4">Total Suara</th>
                <th className="px-6 py-4">Jadwal Voting</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {contests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-cream-muted">
                    Belum ada sayembara yang dibuat. Silakan klik tombol <strong>Buat Sayembara Baru</strong> di atas.
                  </td>
                </tr>
              ) : (
                contests.map((c) => {
                  const phase = getContestPhase(c);
                  const phaseConfig = CONTEST_PHASE_CONFIG[phase];

                  return (
                    <tr key={c.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-semibold text-cream">
                        <Link
                          href={`/admin/sayembara/${c.id}`}
                          className="hover:text-gold transition-colors"
                        >
                          {c.title}
                        </Link>
                        <p className="text-xs text-cream-muted font-mono mt-0.5">/{c.slug}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${phaseConfig.badgeClass}`}
                        >
                          {phaseConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-cream">
                          <UsersIcon className="size-4 text-gold" />
                          {c._count.entries} karya
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 font-bold text-gold">
                          <TrophyIcon className="size-4" />
                          {c._count.votes} suara
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-cream-muted">
                        {formatDate(c.votingStart)} - {formatDate(c.votingEnd)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/admin/sayembara/${c.id}/edit`}
                            className="rounded-lg border border-white/10 bg-obsidian px-2.5 py-1 text-xs font-medium text-cream-muted hover:border-gold/50 hover:text-gold"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/admin/sayembara/${c.id}`}
                            className="rounded-lg border border-white/10 bg-obsidian px-3 py-1 text-xs font-semibold text-cream hover:border-gold/50 hover:text-gold"
                          >
                            Kurasi
                          </Link>
                          <DeleteContestButton
                            contestId={c.id}
                            contestTitle={c.title}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
