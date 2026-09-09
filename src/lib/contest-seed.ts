import { prisma } from "@/lib/prisma";

export async function seedDemoContest() {
  const existing = await prisma.contest.findFirst({
    where: { slug: "sayembara-desain-jaket-reformasi-asa" },
  });

  if (existing) {
    return existing;
  }

  const now = new Date();
  // Set timeline: submission start kemarin, voting buka sekarang sampai 7 hari ke depan
  const subStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const subEnd = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const voteStart = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 jam lalu
  const voteEnd = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000); // 6 hari lagi

  const admin = await prisma.user.findFirst({
    where: { role: "PENGURUS" },
  });

  if (!admin) return null;

  const contest = await prisma.contest.create({
    data: {
      title: "Sayembara Desain Jaket Angkatan BEM PENS 2026",
      slug: "sayembara-desain-jaket-reformasi-asa",
      description:
        "Sayembara terbuka bagi seluruh mahasiswa aktif PENS untuk merancang desain resmi Jaket Varsity & Sukajan edisi Kabinet ReformasiAsa. Desain dengan suara terbanyak akan diproduksi resmi pada batch pre-order berikutnya!",
      prizeInfo: "Juara 1: Rp 1.000.000 + Jaket Gratis + Piagam BEM PENS | Juara Favorit: Merchandise Pack Eksklusif",
      rules:
        "1. Desain original buatan mahasiswa PENS (D3/D4/Pasca).\n2. Memuat elemen identitas PENS (Batik/Garuda/Warna Kebanggaan Hitam & Emas).\n3. Tidak mengandung unsur SARA atau plagiarisme karya orang lain.\n4. Keputusan voting mahasiswa bersifat mutlak.",
      bannerUrl: "/brand/bg-batik.webp",
      status: "PUBLISHED",
      submissionStart: subStart,
      submissionEnd: subEnd,
      votingStart: voteStart,
      votingEnd: voteEnd,
    },
  });

  // Entry 1: Desain Garuda Abhipraya
  await prisma.contestEntry.create({
    data: {
      contestId: contest.id,
      userId: admin.id,
      title: "Varsity Garuda Abhipraya",
      designerName: "Fajar Wicaksono",
      department: "D4 Teknik Informatika",
      batch: "2023",
      description:
        "Menggabungkan siluet Burung Kebanggaan PENS dengan aksen border emas obsidian modern. Pada bagian punggung terdapat typografi ReformasiAsa bermotif batik parang nusantara yang melambangkan pantang menyerah.",
      imageUrl: "/brand/logo-hero.webp",
      status: "APPROVED",
      voteCount: 14,
    },
  });

  // Entry 2: Desain Neo-Cyber PENS
  await prisma.contestEntry.create({
    data: {
      contestId: contest.id,
      userId: admin.id,
      title: "Sukajan Neo-Cyber Kampus Perjuangan",
      designerName: "Anindya Putri",
      department: "D4 Rekayasa Komputer",
      batch: "2024",
      description:
        "Konsep Sukajan streetwear dengan bordir presisi tinggi. Mengambil tema teknologi dan tradisi, menyatukan sirkuit elektronik kampus teknologi dengan ornamen tradisional Jawa Timur.",
      imageUrl: "/brand/logo-hero.webp",
      status: "APPROVED",
      voteCount: 19,
    },
  });

  // Entry 3: Desain Minimalist Monogram
  await prisma.contestEntry.create({
    data: {
      contestId: contest.id,
      userId: admin.id,
      title: "Classic Minimalist PENS Monogram",
      designerName: "Rizky Ramadhan",
      department: "D3 Multimedia Broadcasting",
      batch: "2022",
      description:
        "Desain elegan timeless dengan dominasi warna obsidian hitam pekat dan aksen patch chenille emas di bagian dada kiri. Cocok dipakai kuliah harian maupun kegiatan formal BEM.",
      imageUrl: "/brand/logo-hero.webp",
      status: "APPROVED",
      voteCount: 8,
    },
  });

  return contest;
}
