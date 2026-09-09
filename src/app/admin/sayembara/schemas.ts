import { z } from "zod";

export const contestFormSchema = z
  .object({
    title: z.string().trim().min(3, "Judul sayembara minimal 3 karakter"),
    slug: z
      .string()
      .trim()
      .min(3, "Slug minimal 3 karakter")
      .regex(/^[a-z0-9-]+$/, "Slug hanya boleh berisi huruf kecil, angka, dan tanda minus (-)"),
    description: z.string().trim().min(10, "Deskripsi minimal 10 karakter"),
    rules: z.string().trim().optional(),
    prizeInfo: z.string().trim().optional(),
    bannerUrl: z.string().trim().optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "CLOSED", "ANNOUNCED"]),
    submissionStart: z.string().min(1, "Jadwal mulai submission wajib diisi"),
    submissionEnd: z.string().min(1, "Batas submission wajib diisi"),
    votingStart: z.string().min(1, "Jadwal mulai voting wajib diisi"),
    votingEnd: z.string().min(1, "Batas voting wajib diisi"),
  })
  .refine(
    (data) => new Date(data.submissionEnd).getTime() > new Date(data.submissionStart).getTime(),
    {
      message: "Batas submission harus setelah tanggal mulai submission",
      path: ["submissionEnd"],
    }
  )
  .refine(
    (data) => new Date(data.votingEnd).getTime() > new Date(data.votingStart).getTime(),
    {
      message: "Batas voting harus setelah tanggal mulai voting",
      path: ["votingEnd"],
    }
  );

export type ContestFormValues = z.infer<typeof contestFormSchema>;
