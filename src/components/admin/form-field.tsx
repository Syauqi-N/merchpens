import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FormFieldProps = {
  label: ReactNode;
  /** `id` input yang dibungkus — menghubungkan label dengan input. */
  htmlFor?: string;
  /** Penjelasan singkat di bawah label (mis. aturan bisnis PO). */
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Pembungkus satu baris form: label, input, penjelasan, dan pesan kesalahan.
 * Dipakai semua form admin agar tata letak & aksesibilitasnya konsisten.
 */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: FormFieldProps) {
  const describedBy = [hint ? `${htmlFor}-hint` : null, error ? `${htmlFor}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-cream-soft">
        {label}
        {required && (
          <span className="text-red-400" aria-hidden>
            *
          </span>
        )}
      </Label>

      {hint && (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-xs text-cream-muted">
          {hint}
        </p>
      )}

      <div data-described-by={describedBy || undefined}>{children}</div>

      {error && (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          className="text-xs font-medium text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** Kelompok field dengan judul (mis. "Informasi Dasar", "Gambar Produk"). */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-xl border border-white/10 bg-coal p-4 sm:p-5", className)}
    >
      <header className="mb-4 space-y-1">
        <h2 className="text-base font-semibold text-cream">{title}</h2>
        {description && <p className="text-sm text-cream-muted">{description}</p>}
      </header>

      <div className="space-y-4">{children}</div>
    </section>
  );
}
