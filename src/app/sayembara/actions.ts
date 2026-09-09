"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getContestPhase } from "@/lib/contest";
import { submitEntrySchema } from "./schema";

export type SubmitEntryResult = {
  success: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function submitContestEntry(
  rawInput: Record<string, unknown>
): Promise<SubmitEntryResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "Kamu harus login terlebih dahulu untuk mengirim karya.",
    };
  }

  const parsed = submitEntrySchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string") {
        fieldErrors[field] = issue.message;
      }
    }
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input formulir tidak valid.",
      fieldErrors,
    };
  }

  const contest = await prisma.contest.findUnique({
    where: { id: parsed.data.contestId },
  });

  if (!contest) {
    return { success: false, error: "Sayembara tidak ditemukan." };
  }

  const phase = getContestPhase(contest);
  if (phase !== "SUBMISSION") {
    return {
      success: false,
      error: "Periode pengumpulan karya untuk sayembara ini sudah ditutup.",
    };
  }

  // 1 Akun hanya bisa submit 1 karya aktif (PENDING atau APPROVED).
  // Hanya jika karya sebelumnya REJECTED, peserta diizinkan mengajukan kembali.
  const existingActiveEntry = await prisma.contestEntry.findFirst({
    where: {
      contestId: parsed.data.contestId,
      userId: session.user.id,
      status: { in: ["PENDING", "APPROVED"] },
    },
  });

  if (existingActiveEntry) {
    return {
      success: false,
      error:
        existingActiveEntry.status === "PENDING"
          ? "Kamu sudah memiliki 1 karya yang sedang menunggu kurasi. 1 akun hanya dapat mengirim 1 karya."
          : "Karya desain kamu sudah disetujui untuk sayembara ini. Setiap akun hanya boleh mengirim 1 karya.",
    };
  }

  try {
    // Cari apakah ada entri sebelumnya yang berstatus REJECTED
    const existingRejected = await prisma.contestEntry.findFirst({
      where: {
        contestId: parsed.data.contestId,
        userId: session.user.id,
        status: "REJECTED",
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingRejected) {
      // Perbarui karya yang ditolak menjadi karya baru yang siap dikurasi ulang
      await prisma.contestEntry.update({
        where: { id: existingRejected.id },
        data: {
          title: parsed.data.title,
          designerName: parsed.data.designerName,
          department: parsed.data.department,
          batch: parsed.data.batch,
          description: parsed.data.description,
          imageUrl: parsed.data.imageUrl,
          imageUrl2: parsed.data.imageUrl2 || null,
          status: "PENDING",
          adminNote: null,
          voteCount: 0,
        },
      });
    } else {
      // Buat entri baru pertama kali
      await prisma.contestEntry.create({
        data: {
          contestId: parsed.data.contestId,
          userId: session.user.id,
          title: parsed.data.title,
          designerName: parsed.data.designerName,
          department: parsed.data.department,
          batch: parsed.data.batch,
          description: parsed.data.description,
          imageUrl: parsed.data.imageUrl,
          imageUrl2: parsed.data.imageUrl2 || null,
          status: "PENDING",
        },
      });
    }

    revalidatePath("/sayembara");
    revalidatePath(`/sayembara/${contest.slug}`);
    return {
      success: true,
      message: "Karya berhasil dikirim! Panitia BEM PENS akan segera melakukan kurasi.",
    };
  } catch (err) {
    console.error("Failed to submit contest entry:", err);
    return {
      success: false,
      error: "Gagal menyimpan karya. Silakan periksa koneksi dan coba lagi.",
    };
  }
}

export async function castVote(contestId: string, entryId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Silakan login terlebih dahulu untuk memberikan suara." };
  }

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
  });

  if (!contest) {
    return { success: false, error: "Sayembara tidak ditemukan." };
  }

  const phase = getContestPhase(contest);
  if (phase !== "VOTING") {
    return { success: false, error: "Voting saat ini sedang tidak dibuka." };
  }

  const userId = session.user.id;

  try {
    await prisma.$transaction(async (tx) => {
      // Cek apakah user sudah pernah vote di kontes ini
      const existingVote = await tx.contestVote.findUnique({
        where: {
          contestId_userId: {
            contestId,
            userId,
          },
        },
      });

      if (existingVote) {
        throw new Error("Kamu sudah menggunakan hak suara pada sayembara ini.");
      }

      // Pastikan entry yang divote valid dan disetujui (APPROVED)
      const entry = await tx.contestEntry.findFirst({
        where: {
          id: entryId,
          contestId,
          status: "APPROVED",
        },
      });

      if (!entry) {
        throw new Error("Karya tidak ditemukan atau belum disetujui.");
      }

      // 1. Buat vote
      await tx.contestVote.create({
        data: {
          contestId,
          entryId,
          userId,
        },
      });

      // 2. Increment voteCount secara atomik
      await tx.contestEntry.update({
        where: { id: entryId },
        data: {
          voteCount: { increment: 1 },
        },
      });

      return true;
    });

    revalidatePath("/sayembara");
    revalidatePath(`/sayembara/${contest.slug}`);
    return { success: true, message: "Suaramu berhasil disimpan! Terima kasih sudah berpartisipasi." };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memberikan suara.";
    return { success: false, error: message };
  }
}
