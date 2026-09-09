import { cn } from "@/lib/utils";

export type PoProgressProps = {
  /** Kuota awal yang ditetapkan admin. */
  quota: number;
  /** Jumlah yang sudah dipesan (termasuk pesanan yang belum lunas). */
  reserved: number;
  /** Satuan produk, mis. "pcs" / "box". */
  unit?: string;
  /** Tampilkan baris teks "Terpakai … / Sisa …" di atas bar. */
  showLabels?: boolean;
  className?: string;
};

/**
 * Bar progres pemakaian kuota pre-order.
 *
 * Server Component murni (tanpa JavaScript sisi klien) agar aman dipakai di
 * daftar produk yang panjang. Warna berubah menjadi oranye saat kuota menipis
 * dan merah saat habis.
 */
export function PoProgress({
  quota,
  reserved,
  unit = "pcs",
  showLabels = true,
  className,
}: PoProgressProps) {
  const safeQuota = Math.max(0, quota);
  const used = Math.min(Math.max(0, reserved), safeQuota);
  const left = Math.max(0, safeQuota - used);
  const percent = safeQuota === 0 ? 100 : Math.round((used / safeQuota) * 100);

  const isFull = left === 0;
  const isLow = !isFull && percent >= 80;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {showLabels && (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="text-cream-muted">
            Terpakai{" "}
            <span className="font-medium text-[#D8D3C7] tabular-nums">
              {used}
            </span>{" "}
            dari <span className="tabular-nums">{safeQuota}</span> {unit}
          </span>
          <span
            className={cn(
              "font-medium tabular-nums",
              isFull ? "text-red-400" : isLow ? "text-gold-deep" : "text-gold",
            )}
          >
            {isFull ? "Kuota habis" : `Sisa ${left} ${unit}`}
          </span>
        </div>
      )}

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeQuota}
        aria-valuenow={used}
        aria-valuetext={`Terpakai ${used} dari ${safeQuota} ${unit}`}
        className="h-2 w-full overflow-hidden rounded-full bg-raise"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isFull ? "bg-red-500" : isLow ? "bg-gold" : "bg-gold",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
