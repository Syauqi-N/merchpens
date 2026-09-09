

export type ContestPhase = "DRAFT" | "SUBMISSION" | "REVIEW" | "VOTING" | "FINISHED";

export function getContestPhase(contest: {
  status: string;
  submissionStart: Date;
  submissionEnd: Date;
  votingStart: Date;
  votingEnd: Date;
}, now = new Date()): ContestPhase {
  if (contest.status === "DRAFT") return "DRAFT";
  if (contest.status === "ANNOUNCED" || contest.status === "CLOSED") return "FINISHED";

  const currentTime = now.getTime();
  const subStart = new Date(contest.submissionStart).getTime();
  const subEnd = new Date(contest.submissionEnd).getTime();
  const voteStart = new Date(contest.votingStart).getTime();
  const voteEnd = new Date(contest.votingEnd).getTime();

  if (currentTime < subStart) {
    return "DRAFT";
  }
  if (currentTime >= subStart && currentTime <= subEnd) {
    return "SUBMISSION";
  }
  if (currentTime > subEnd && currentTime < voteStart) {
    return "REVIEW";
  }
  if (currentTime >= voteStart && currentTime <= voteEnd) {
    return "VOTING";
  }
  return "FINISHED";
}

export const CONTEST_PHASE_CONFIG: Record<
  ContestPhase,
  { label: string; badgeClass: string; description: string }
> = {
  DRAFT: {
    label: "Segera Dibuka",
    badgeClass: "bg-white/10 text-cream-muted border-white/15",
    description: "Sayembara sedang disiapkan oleh panitia BEM PENS.",
  },
  SUBMISSION: {
    label: "Pengumpulan Karya",
    badgeClass: "bg-gold/15 text-gold border-gold/30",
    description: "Kirimkan karya desain terbaikmu untuk merchandise resmi PENS.",
  },
  REVIEW: {
    label: "Kurasi Desain",
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    description: "Karya masuk sedang dikurasi oleh panitia sebelum voting dibuka.",
  },
  VOTING: {
    label: "Voting Mahasiswa",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    description: "Beri suaramu untuk karya favorit! 1 mahasiswa = 1 suara.",
  },
  FINISHED: {
    label: "Selesai & Pengumuman",
    badgeClass: "bg-gold/20 text-gold-light border-gold/40",
    description: "Voting telah selesai. Cek pemenang desain resmi di bawah.",
  },
};
