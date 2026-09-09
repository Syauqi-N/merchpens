import { z } from "zod";

export const PENS_DEPARTMENTS = [
  "D4 Teknik Informatika",
  "D3 Teknik Informatika",
  "D4 Teknik Komputer",
  "D3 Teknik Telekomunikasi",
  "D4 Teknik Telekomunikasi",
  "D3 Teknik Elektronika",
  "D4 Teknik Elektronika",
  "D3 Teknik Elektro Industri",
  "D4 Teknik Elektro Industri",
  "D4 Teknik Mekatronika",
  "D4 Sistem Pembangkit Energi",
  "D4 Teknologi Rekayasa Multimedia",
  "D4 Teknologi Game",
  "D4 Sains Data Terapan",
  "D4 Teknologi Rekayasa Internet",
  "Pascasarjana Terapan",
  "Lainnya / Sivitas Akademika PENS",
] as const;

export const submitEntrySchema = z.object({
  contestId: z.string().min(1, "ID kontes tidak valid"),
  title: z
    .string()
    .trim()
    .min(3, "Judul karya minimal 3 karakter")
    .max(100, "Judul karya maksimal 100 karakter"),
  designerName: z
    .string()
    .trim()
    .min(3, "Nama lengkap peserta minimal 3 karakter")
    .max(80, "Nama maksimal 80 karakter"),
  department: z
    .string()
    .trim()
    .min(1, "Jurusan / Program Studi wajib dipilih"),
  batch: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Angkatan wajib 4 digit angka (contoh: 2024)"),
  description: z
    .string()
    .trim()
    .min(20, "Konsep & filosofi desain minimal 20 karakter"),
  imageUrl: z
    .string()
    .trim()
    .min(1, "Wajib mengunggah minimal foto desain utama (foto 1)")
    .refine(
      (val) => val.startsWith("/") || val.startsWith("http://") || val.startsWith("https://"),
      { message: "Path atau URL gambar tidak valid" }
    ),
  imageUrl2: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine(
      (val) => !val || val.startsWith("/") || val.startsWith("http://") || val.startsWith("https://"),
      { message: "Path atau URL gambar kedua tidak valid" }
    ),
});

export type SubmitEntryValues = z.infer<typeof submitEntrySchema>;
