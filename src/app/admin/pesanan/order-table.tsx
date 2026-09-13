"use client";

import Link from "next/link";
import { EyeIcon } from "lucide-react";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
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

export type OrderTableRow = {
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
};

const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  MAHASISWA: "Mahasiswa",
  ALUMNI: "Alumni",
};

const FULFILLMENT_LABEL: Record<string, string> = {
  PICKUP: "Ambil",
  SHIPPED: "Kirim",
};

export function OrderTable({ rows }: { rows: OrderTableRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-obsidian">
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
  );
}
