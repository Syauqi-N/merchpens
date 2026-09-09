import { PaymentStatusBadge } from "@/app/admin/pesanan/status-badge";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import type { PaymentStatus } from "@/generated/prisma/client";
import { formatDateTime, formatNumber, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

import { isNumericKind, type RekapColumn, type RekapColumnKind } from "./schemas";

/**
 * Tabel rekap bergaya spreadsheet.
 *
 * Bukan komponen tabel bersama di `@/components/ui/table`: yang dibutuhkan di
 * sini padat dan lebar seperti lembar Excel — teks kecil, padding rapat, garis
 * kolom tipis, dan baris header yang LENGKET saat digulir. Semua itu memerlukan
 * `border-separate` (agar garis header ikut menempel saat sticky) yang justru
 * bertabrakan dengan gaya tabel bersama.
 *
 * Presentasional murni (tanpa `"use client"`), jadi dirender langsung di Server
 * Component tanpa menambah satu byte pun ke bundel klien.
 *
 * Kolomnya digerakkan oleh definisi di `./schemas` — daftar yang sama yang
 * dipakai endpoint unduh Excel.
 */

const HEAD_CELL =
  "sticky top-0 z-10 border-r border-b border-[#3A3A3A] bg-raise px-2.5 py-2 text-left align-bottom text-[11px] font-semibold tracking-wide text-[#D8D3C7] uppercase whitespace-nowrap last:border-r-0";

const BODY_CELL =
  "border-r border-b border-white/10 px-2.5 py-1.5 align-top text-[#D8D3C7] last:border-r-0";

/** Lencana status dikecilkan agar tinggi barisnya tetap padat. */
const PILL_COMPACT = "px-1.5 py-0 text-[11px]";

function EmptyCell() {
  return (
    <span className="text-[#6E6E6E]" aria-label="kosong">
      —
    </span>
  );
}

/** Isi satu sel sesuai jenis kolomnya. */
function CellValue({ kind, value }: { kind: RekapColumnKind; value: unknown }) {
  switch (kind) {
    case "code":
      return typeof value === "string" && value.trim() ? (
        <span className="font-mono text-xs text-cream">{value}</span>
      ) : (
        <EmptyCell />
      );

    case "date":
      return value instanceof Date ? (
        <span className="whitespace-nowrap">{formatDateTime(value)}</span>
      ) : (
        <EmptyCell />
      );

    case "money":
      return typeof value === "number" ? (
        <span className="font-medium text-cream">{formatRupiah(value)}</span>
      ) : (
        <EmptyCell />
      );

    case "number":
      return typeof value === "number" ? <span>{formatNumber(value)}</span> : <EmptyCell />;

    case "orderStatus":
      return typeof value === "string" ? (
        <OrderStatusBadge status={value} variant="admin" className={PILL_COMPACT} />
      ) : (
        <EmptyCell />
      );

    case "paymentStatus":
      return (
        <PaymentStatusBadge
          status={(value as PaymentStatus | null) ?? null}
          className={PILL_COMPACT}
        />
      );

    default:
      return typeof value === "string" && value.trim() ? (
        <span className="whitespace-pre-line">{value}</span>
      ) : (
        <EmptyCell />
      );
  }
}

export type RekapTableProps<Row> = {
  columns: readonly RekapColumn<Row>[];
  rows: readonly Row[];
  /** Kunci React tiap baris. */
  rowKey: (row: Row) => string;
  /** Keterangan tabel untuk pembaca layar. */
  caption: string;
};

export function RekapTable<Row>({ columns, rows, rowKey, caption }: RekapTableProps<Row>) {
  return (
    <div
      // Gulir HORIZONTAL terkurung di dalam kotak ini — halaman di belakangnya
      // tidak ikut melebar meski kolomnya banyak. Tingginya dibatasi supaya
      // header yang lengket punya sesuatu untuk digulir.
      className="max-h-[70vh] overflow-auto rounded-xl border border-[#3A3A3A] bg-coal"
    >
      <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
        <caption className="sr-only">{caption}</caption>

        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(HEAD_CELL, isNumericKind(column.kind) && "text-right")}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row)}
              // Baris belang tipis: mata mudah tersesat di tabel selebar ini.
              className={cn(index % 2 === 1 && "bg-obsidian/70", "hover:bg-gold/10")}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    BODY_CELL,
                    isNumericKind(column.kind) && "text-right tabular-nums",
                  )}
                >
                  <CellValue
                    kind={column.kind}
                    value={(row as Record<string, unknown>)[column.key]}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
