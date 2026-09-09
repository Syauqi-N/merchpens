"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { ContestStatus, SubmissionStatus } from "@/generated/prisma/client";
import { contestFormSchema } from "./schemas";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "MANAGE_CATALOG")) {
    throw new Error("Akses ditolak. Khusus pengurus/admin.");
  }
  return session.user;
}

export type SaveContestResult = {
  ok: boolean;
  message: string;
  contestId?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveContest(
  id: string | null,
  rawInput: Record<string, unknown>
): Promise<SaveContestResult> {
  await requireAdmin();

  const parsed = contestFormSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string") {
        fieldErrors[field] = issue.message;
      }
    }
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Input formulir tidak valid",
      fieldErrors,
    };
  }

  const { slug } = parsed.data;

  // Cek duplikasi slug
  const existingSlug = await prisma.contest.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existingSlug && existingSlug.id !== id) {
    return {
      ok: false,
      message: `Slug "${slug}" sudah digunakan oleh sayembara lain. Silakan ubah slug.`,
      fieldErrors: { slug: "Slug ini sudah digunakan" },
    };
  }

  try {
    let savedContest;
    const dataToSave = {
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description,
      rules: parsed.data.rules || null,
      prizeInfo: parsed.data.prizeInfo || null,
      bannerUrl: parsed.data.bannerUrl || null,
      status: parsed.data.status,
      submissionStart: new Date(parsed.data.submissionStart),
      submissionEnd: new Date(parsed.data.submissionEnd),
      votingStart: new Date(parsed.data.votingStart),
      votingEnd: new Date(parsed.data.votingEnd),
    };

    if (id) {
      savedContest = await prisma.contest.update({
        where: { id },
        data: dataToSave,
      });
    } else {
      savedContest = await prisma.contest.create({
        data: dataToSave,
      });
    }

    revalidatePath("/admin/sayembara");
    revalidatePath(`/admin/sayembara/${savedContest.id}`);
    revalidatePath("/sayembara");

    return {
      ok: true,
      message: id ? "Perubahan sayembara berhasil disimpan." : "Sayembara baru berhasil dibuat & diterbitkan!",
      contestId: savedContest.id,
    };
  } catch (err) {
    console.error("Save contest error:", err);
    return {
      ok: false,
      message: "Terjadi kesalahan server saat menyimpan data sayembara.",
    };
  }
}

export async function deleteContest(contestId: string) {
  await requireAdmin();

  try {
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
    });

    if (!contest) {
      return { success: false, error: "Sayembara tidak ditemukan." };
    }

    // Cascade delete relasi Contest -> ContestEntry -> ContestVote
    await prisma.contest.delete({
      where: { id: contestId },
    });

    revalidatePath("/admin/sayembara");
    revalidatePath("/sayembara");
    return { success: true, message: "Sayembara berhasil dihapus." };
  } catch (err) {
    console.error("Delete contest error:", err);
    return { success: false, error: "Gagal menghapus sayembara." };
  }
}

export async function updateSubmissionStatus(
  entryId: string,
  status: SubmissionStatus,
  adminNote?: string
) {
  await requireAdmin();

  try {
    const entry = await prisma.contestEntry.update({
      where: { id: entryId },
      data: {
        status,
        adminNote: adminNote ?? null,
      },
      include: { contest: true },
    });

    revalidatePath(`/admin/sayembara/${entry.contestId}`);
    revalidatePath("/sayembara");
    revalidatePath(`/sayembara/${entry.contest.slug}`);
    return { success: true };
  } catch (err) {
    console.error("Update submission status error:", err);
    return { success: false, error: "Gagal memperbarui status karya." };
  }
}

export async function setContestStatus(contestId: string, status: ContestStatus) {
  await requireAdmin();

  try {
    const contest = await prisma.contest.update({
      where: { id: contestId },
      data: { status },
    });

    revalidatePath("/admin/sayembara");
    revalidatePath(`/admin/sayembara/${contestId}`);
    revalidatePath("/sayembara");
    revalidatePath(`/sayembara/${contest.slug}`);
    return { success: true };
  } catch (err) {
    console.error("Set contest status error:", err);
    return { success: false, error: "Gagal mengubah status sayembara." };
  }
}
