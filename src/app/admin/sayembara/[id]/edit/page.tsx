import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ContestForm } from "../../contest-form";

export const metadata: Metadata = {
  title: "Edit Sayembara | Admin Merch PENS",
};

export default async function EditContestPage({
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
  });

  if (!contest) {
    notFound();
  }

  // Format ke YYYY-MM-DDTHH:mm
  const formatInput = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/admin/sayembara/${contest.id}`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-cream-muted hover:text-gold mb-3 transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" />
          Kembali ke Detail Sayembara
        </Link>
        <h1 className="text-2xl font-bold text-cream">Edit Sayembara</h1>
        <p className="text-sm text-cream-muted">
          Perbarui informasi lomba, hadiah, jadwal timeline, atau status publikasi.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-coal p-6 sm:p-8">
        <ContestForm
          mode="edit"
          contestId={contest.id}
          defaultValues={{
            title: contest.title,
            slug: contest.slug,
            description: contest.description,
            rules: contest.rules ?? "",
            prizeInfo: contest.prizeInfo ?? "",
            bannerUrl: contest.bannerUrl ?? "",
            status: contest.status,
            submissionStart: formatInput(contest.submissionStart),
            submissionEnd: formatInput(contest.submissionEnd),
            votingStart: formatInput(contest.votingStart),
            votingEnd: formatInput(contest.votingEnd),
          }}
        />
      </div>
    </div>
  );
}
