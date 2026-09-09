import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { auth } from "@/lib/auth";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DIMENSION = 1600;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
type ImageMetadata = Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;

const ALLOWED_FORMATS = new Set(["jpeg", "jpg", "png", "webp", "avif"]);

function jsonError(message: string, status: number) {
  return Response.json({ ok: false, message }, { status });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("Kamu harus masuk (login) terlebih dahulu untuk mengunggah berkas.", 401);
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("file");
    if (value instanceof File) file = value;
  } catch {
    return jsonError("Data unggahan tidak dapat dibaca.", 400);
  }

  if (!file || file.size === 0) {
    return jsonError("Tidak ada berkas yang dipilih.", 400);
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return jsonError(`Ukuran gambar ${mb} MB melebihi batas 5 MB.`, 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let metadata: ImageMetadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return jsonError("Berkas ini bukan gambar yang valid.", 415);
  }

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    return jsonError("Format gambar harus JPG, PNG, WebP, atau AVIF.", 415);
  }

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });

    const optimized = await sharp(buffer)
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();

    const filename = `${randomUUID()}.webp`;
    await writeFile(path.join(UPLOAD_DIR, filename), optimized);

    return Response.json({
      ok: true,
      url: `/uploads/${filename}`,
      size: optimized.length,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
    });
  } catch (error) {
    console.error("[upload] gagal menyimpan gambar:", error);
    return jsonError("Gambar gagal disimpan. Coba lagi sebentar lagi.", 500);
  }
}
