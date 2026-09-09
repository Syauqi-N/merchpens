import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { ContestForm } from "../contest-form";

export const metadata: Metadata = {
  title: "Buat Sayembara Baru | Admin Merch PENS",
};

export default async function NewContestPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "MANAGE_CATALOG")) {
    redirect("/admin");
  }

  const now = new Date();
  const subStart = now.toISOString().slice(0, 16);
  const subEnd = new Date(now.getTime() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 16);
  const voteStart = new Date(now.getTime() + 15 * 24 * 3600 * 1000).toISOString().slice(0, 16);
  const voteEnd = new Date(now.getTime() + 22 * 24 * 3600 * 1000).toISOString().slice(0, 16);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/sayembara"
          className="inline-flex items-center gap-2 text-xs font-semibold text-cream-muted hover:text-gold mb-3 transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" />
          Kembali ke Daftar Sayembara
        </Link>
        <h1 className="text-2xl font-bold text-cream">Buat Sayembara Baru</h1>
        <p className="text-sm text-cream-muted">
          Tentukan periode pengumpulan karya dan pemungutan suara voting mahasiswa.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-coal p-6 sm:p-8">
        <ContestForm
          mode="create"
          defaultValues={{
            status: "PUBLISHED",
            submissionStart: subStart,
            submissionEnd: subEnd,
            votingStart: voteStart,
            votingEnd: voteEnd,
          }}
        />
      </div>
    </div>
  );
}
