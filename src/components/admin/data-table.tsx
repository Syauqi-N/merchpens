import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  /** Kunci unik kolom (juga dipakai sebagai React key). */
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  /** Kelas untuk sel data. */
  className?: string;
  /** Kelas untuk sel header (default mengikuti `className`). */
  headerClassName?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  /** Tampilan saat tidak ada baris. */
  empty?: ReactNode;
  className?: string;
};

/**
 * Tabel data sederhana untuk panel admin.
 *
 * Sengaja Server Component: `cell` dipanggil saat render di server, sehingga
 * kolom boleh mengembalikan Server Component maupun island `'use client'`.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  empty,
  className,
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-white/10 bg-coal",
        className,
      )}
    >
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 bg-obsidian hover:bg-obsidian">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  "px-3 text-xs font-semibold tracking-wide text-cream-muted uppercase",
                  column.headerClassName ?? column.className,
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="px-3 py-10 text-center whitespace-normal text-cream-muted"
              >
                {empty ?? "Belum ada data."}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow key={getRowKey(row, index)} className="border-white/5">
                {columns.map((column) => (
                  <TableCell key={column.key} className={cn("px-3 py-2.5", column.className)}>
                    {column.cell(row, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
