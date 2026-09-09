"use client";

import { useId, useRef, useState } from "react";
import { ImageUpIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type ImageUploadButtonProps = {
  /** Dipanggil dengan URL publik gambar setelah unggahan berhasil. */
  onUploaded: (url: string) => void;
  label?: string;
  className?: string;
  size?: "sm" | "default";
};

/**
 * Tombol unggah gambar untuk panel admin.
 *
 * Mengirim berkas ke `POST /api/upload`, yang memvalidasi, mengecilkan, dan
 * mengubahnya jadi WebP, lalu mengembalikan URL publiknya. Dipasang berdampingan
 * dengan kolom URL supaya admin tetap bisa menempel tautan gambar dari luar
 * kalau memang sudah punya.
 */
export function ImageUploadButton({
  onUploaded,
  label = "Unggah",
  className,
  size = "sm",
}: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    const toastId = toast.loading("Mengunggah gambar...");

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/upload", { method: "POST", body });
      const data = (await response.json()) as {
        ok?: boolean;
        url?: string;
        message?: string;
      };

      if (!response.ok || !data.ok || !data.url) {
        toast.error(data.message ?? "Gambar gagal diunggah.", { id: toastId });
        return;
      }

      onUploaded(data.url);
      toast.success("Gambar berhasil diunggah.", { id: toastId });
    } catch {
      toast.error("Gambar gagal diunggah. Periksa koneksi kamu.", { id: toastId });
    } finally {
      setUploading(false);
      // Direset supaya memilih berkas yang sama dua kali tetap memicu onChange.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size={size}
        className={className}
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
        ) : (
          <ImageUpIcon className="size-4" aria-hidden />
        )}
        {label}
      </Button>
    </>
  );
}
