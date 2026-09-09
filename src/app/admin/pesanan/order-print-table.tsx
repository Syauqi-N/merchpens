"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EyeIcon, PrinterIcon } from "lucide-react";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { PaymentStatusBadge } from "./status-badge";

export type OrderPrintTableRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerType: string;
  customerBatch: string;
  customerProgram: string;
  fulfillmentType: string;
  variantLabel: string;
  createdAt: string;
  total: string;
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | null;
  status: string;
  printable: boolean;
};

const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  MAHASISWA: "Mahasiswa",
  ALUMNI: "Alumni",
};

const FULFILLMENT_LABEL: Record<string, string> = {
  PICKUP: "Ambil",
  SHIPPED: "Kirim",
};

export function OrderPrintTable({ rows }: { rows: OrderPrintTableRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const printableIds = useMemo(
    () => rows.filter((row) => row.printable).map((row) => row.id),
    [rows],
  );
  const allSelected =
    printableIds.length > 0 &&
    printableIds.every((id) => selected.has(id));

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(printableIds) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function printSelected() {
    const ids = rows
      .filter((row) => selected.has(row.id))
      .map((row) => row.id);
    if (ids.length === 0) return;
    window.open(
      `/api/admin/pesanan/resi?ids=${encodeURIComponent(ids.join(","))}&print=1`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-white/10 bg-obsidian px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-cream">
            Resi Pengambilan Disposisi
          </p>
          <p className="text-xs text-cream-muted">
            Pilih maksimal 20 pesanan pada halaman ini. Setiap pesanan dicetak
            pada satu halaman A5.
          </p>
        </div>
        <Button
          type="button"
          onClick={printSelected}
          disabled={selected.size === 0}
          className="shrink-0"
        >
          <PrinterIcon className="size-4" aria-hidden />
          Cetak Resi ({selected.size})
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-obsidian">
              <TableHead className="w-12 px-4">
                <Checkbox
                  checked={allSelected}
                  disabled={printableIds.length === 0}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                  aria-label="Pilih semua pesanan yang dapat dicetak di halaman ini"
                />
              </TableHead>
              <TableHead className="px-4">Nomor</TableHead>
              <TableHead className="px-4">Pemesan</TableHead>
              <TableHead className="px-4">Tipe</TableHead>
              <TableHead className="px-4">Angkatan</TableHead>
              <TableHead className="px-4">Jurusan</TableHead>
              <TableHead className="px-4">Varian</TableHead>
              <TableHead className="px-4">Terima</TableHead>
              <TableHead className="px-4">Tanggal</TableHead>
              <TableHead className="px-4 text-right">Total</TableHead>
              <TableHead className="px-4">Pembayaran</TableHead>
              <TableHead className="px-4">Status</TableHead>
              <TableHead className="px-4 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="px-4">
                  <Checkbox
                    checked={selected.has(order.id)}
                    disabled={!order.printable}
                    onCheckedChange={(checked) =>
                      toggleOne(order.id, checked === true)
                    }
                    aria-label={
                      order.printable
                        ? `Pilih pesanan ${order.orderNumber}`
                        : `Pesanan ${order.orderNumber} belum bisa dicetak`
                    }
                  />
                </TableCell>
                <TableCell className="px-4 font-medium">
                  <Link
                    href={`/admin/pesanan/${order.id}`}
                    className="text-gold underline-offset-4 hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                </TableCell>
                <TableCell className="px-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-cream">
                      {order.customerName}
                    </span>
                    <span className="text-xs text-cream-muted">
                      {order.customerEmail}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="px-4 text-[#D8D3C7]">
                  {CUSTOMER_TYPE_LABEL[order.customerType] ?? order.customerType}
                </TableCell>
                <TableCell className="px-4 text-[#D8D3C7]">
                  {order.customerBatch}
                </TableCell>
                <TableCell className="max-w-44 truncate px-4 text-[#D8D3C7]" title={order.customerProgram}>
                  {order.customerProgram}
                </TableCell>
                <TableCell className="max-w-44 truncate px-4 text-cream-muted" title={order.variantLabel || undefined}>
                  {order.variantLabel || <span className="text-[#8A8A8A]">—</span>}
                </TableCell>
                <TableCell className="px-4">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
                      order.fulfillmentType === "SHIPPED"
                        ? "bg-violet-50 text-violet-700 ring-violet-200"
                        : "bg-gold/10 text-gold ring-gold/30",
                    )}
                  >
                    {FULFILLMENT_LABEL[order.fulfillmentType] ?? order.fulfillmentType}
                  </span>
                </TableCell>
                <TableCell className="px-4 text-cream-muted">
                  {order.createdAt}
                </TableCell>
                <TableCell className="px-4 text-right font-medium tabular-nums">
                  {order.total}
                </TableCell>
                <TableCell className="px-4">
                  <PaymentStatusBadge status={order.paymentStatus} />
                </TableCell>
                <TableCell className="px-4">
                  <OrderStatusBadge status={order.status} variant="admin" />
                </TableCell>
                <TableCell className="px-4 text-right">
                  <Button
                    nativeButton={false}
                    variant="outline"
                    size="sm"
                    render={<Link href={`/admin/pesanan/${order.id}`} />}
                  >
                    <EyeIcon className="size-3.5" aria-hidden />
                    Detail
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
