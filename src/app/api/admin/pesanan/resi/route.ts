import { requireCapability } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PRINTABLE_STATUSES = ["PAID", "PROCESSING", "COMPLETED"] as const;
const MAX_RECEIPTS = 20;
// Layout A5 portrait:
//   Halaman 1 punya header + data pemesan, jadi muat lebih sedikit item.
//   Halaman tengah hanya lanjutan tabel, muat lebih banyak.
//   Halaman terakhir harus menyisakan ruang untuk footer (pickup, tanda tangan).
const FIRST_PAGE_MAX_ITEMS = 15;
const MIDDLE_PAGE_MAX_ITEMS = 20;
const LAST_PAGE_MAX_ITEMS = 15;

const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  MAHASISWA: "Mahasiswa",
  ALUMNI: "Alumni",
};

const FULFILLMENT_LABEL: Record<string, string> = {
  PICKUP: "Ambil di kampus",
  SHIPPED: "Kirim ke alamat",
};

const receiptOrderInclude = {
  payment: true,
  items: {
    orderBy: { productName: "asc" as const },
    include: {
      product: { select: { unit: true } },
      variantQuota: {
        select: {
          variant: { select: { name: true } },
        },
      },
      preOrderItem: {
        select: {
          period: {
            select: {
              id: true,
              name: true,
              estimatedPickupAt: true,
              pickupLocation: true,
              pickupSchedule: true,
              pickupNote: true,
              shippingNote: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

export async function GET(request: Request) {
  try {
    await requireCapability("MANAGE_ORDERS");
  } catch {
    return new Response("Tidak diizinkan.", { status: 403 });
  }

  const requestUrl = new URL(request.url);
  const autoPrint = requestUrl.searchParams.get("print") === "1";
  const ids = [
    ...new Set(
      (requestUrl.searchParams.get("ids") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => /^[a-z0-9]{10,40}$/i.test(value)),
    ),
  ].slice(0, MAX_RECEIPTS);

  if (ids.length === 0) {
    return new Response("Tidak ada pesanan yang dipilih.", { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: {
      id: { in: ids },
      status: { in: [...PRINTABLE_STATUSES] },
    },
    include: receiptOrderInclude,
  });

  const byId = new Map(orders.map((order) => [order.id, order]));
  const sorted = ids.flatMap((id) => {
    const order = byId.get(id);
    return order ? [order] : [];
  });

  if (sorted.length === 0) {
    return new Response(
      "Pesanan yang dipilih belum berstatus Dibayar, Diproses, atau Selesai.",
      { status: 400 },
    );
  }

  const totalOrders = ids.length;
  const pages = [];
  for (const order of sorted) {
    const receiptPages = renderPaginatedReceipt(order, ids.indexOf(order.id) + 1);
    pages.push(receiptPages.join(""));
  }

  return new Response(
    `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Resi Pengambilan Disposisi</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #e2e8f0; color: #0f172a; font-family: Arial, sans-serif; }
    .toolbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 18px; background: #0f172a; color: white; }
    .toolbar p { margin: 0; font-size: 13px; }
    .toolbar button { border: 0; border-radius: 8px; background: #d4a359; color: #0d0d0d; padding: 9px 14px; font-weight: 700; cursor: pointer; }
    .receipt { width: 148mm; min-height: 210mm; margin: 12px auto; padding: 9mm; background: white; page-break-after: always; break-after: page; }
    .receipt:last-child { page-break-after: auto; break-after: auto; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10mm; border-bottom: 2px solid #d4a359; padding-bottom: 4mm; }
    .brand { width: 48mm; height: auto; }
    h1 { margin: 0; font-size: 14pt; }
    h2 { margin: 4mm 0 2mm; font-size: 9pt; text-transform: uppercase; letter-spacing: .05em; color: #9e7638; }
    p { margin: 0; }
    .muted { color: #475569; }
    .small { font-size: 7.5pt; }
    .code { margin-top: 1mm; font-family: ui-monospace, monospace; font-size: 9pt; font-weight: 700; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 8mm; font-size: 8pt; }
    .row { display: flex; justify-content: space-between; gap: 5mm; border-bottom: 1px dotted #cbd5e1; padding: 1mm 0; }
    .row span:last-child { text-align: right; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
    th, td { border: 1px solid #cbd5e1; padding: 1.2mm 1.5mm; text-align: left; vertical-align: top; }
    th { background: #fef7ed; color: #9e7638; }
    .right { text-align: right; }
    .pickup { border: 1px solid #fed7aa; background: #fffaf5; border-radius: 2mm; padding: 2.5mm; font-size: 7.5pt; }
    .pickup + .pickup { margin-top: 2mm; }
    .address { border: 1px solid #fcd34d; background: #fffbeb; border-radius: 2mm; padding: 2.5mm; font-size: 7.5pt; }
    .checklist { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 8mm; font-size: 7.5pt; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 14mm; margin-top: 5mm; text-align: center; font-size: 7.5pt; }
    .signature-line { height: 14mm; border-bottom: 1px solid #0f172a; }
    .notice { margin-top: 4mm; border-top: 1px solid #cbd5e1; padding-top: 2mm; font-size: 6.8pt; line-height: 1.35; color: #475569; }
    @page { size: A5 portrait; margin: 0; }
    @media print {
      body { background: white; }
      .toolbar { display: none; }
      /* Setiap <section class="receipt"> adalah 1 halaman A5. */
      .receipt { 
        width: 148mm; 
        margin: 0;              /* No margins during print */
        page-break-after: always;
        break-after: page;
      }
      .receipt:last-child { page-break-after: auto; break-after: auto; }
      /* Cegah baris tabel terpotong di tengah saat pindah halaman. */
      tr { break-inside: avoid-page; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <p>${totalOrders} resi · A5 · halaman 1 &amp; terakhir maksimal ${FIRST_PAGE_MAX_ITEMS} item, halaman tengah maksimal ${MIDDLE_PAGE_MAX_ITEMS} item</p>
    <button type="button" onclick="window.print()">Cetak / Simpan PDF</button>
  </div>
  ${(pages.join("").replaceAll("__LOGO__", "/brand/logo-secondary.webp"))}
  ${autoPrint ? '<script>window.addEventListener("load", function () { window.print(); });</script>' : ""}
</body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

type ReceiptOrder = Prisma.OrderGetPayload<{
  include: typeof receiptOrderInclude;
}>;

function splitItemsIntoPages(items: ReceiptOrder["items"]): ReceiptOrder["items"][] {
  // Semua item muat di 1 halaman (footer cukup ruang).
  if (items.length <= LAST_PAGE_MAX_ITEMS) {
    return [items];
  }

  // Halaman 1 terpisah karena ada header + data pemesan.
  const firstPage = items.slice(0, FIRST_PAGE_MAX_ITEMS);
  let remaining = items.slice(FIRST_PAGE_MAX_ITEMS);
  const pages: ReceiptOrder["items"][] = [firstPage];

  // Jika sisa ≤ LAST_PAGE_MAX_ITEMS, masukkan semua sebagai halaman terakhir.
  if (remaining.length <= LAST_PAGE_MAX_ITEMS) {
    pages.push(remaining);
    return pages;
  }

  // Sisa masih banyak: isi halaman tengah dengan MIDDLE_PAGE_MAX_ITEMS,
  // tapi pastikan halaman terakhir tidak melebihi LAST_PAGE_MAX_ITEMS.
  while (remaining.length > MIDDLE_PAGE_MAX_ITEMS + LAST_PAGE_MAX_ITEMS) {
    pages.push(remaining.slice(0, MIDDLE_PAGE_MAX_ITEMS));
    remaining = remaining.slice(MIDDLE_PAGE_MAX_ITEMS);
  }

  // Sekarang remaining antara (MIDDLE_PAGE_MAX_ITEMS+1) sampai
  // (MIDDLE_PAGE_MAX_ITEMS + LAST_PAGE_MAX_ITEMS).
  if (remaining.length <= MIDDLE_PAGE_MAX_ITEMS) {
    // remaining 16..20: halaman tengah sebanyak mungkin (max 20),
    // sisanya untuk halaman terakhir (≤15).
    const middlePageSize = Math.min(MIDDLE_PAGE_MAX_ITEMS, remaining.length - 1);
    pages.push(remaining.slice(0, middlePageSize));
    pages.push(remaining.slice(middlePageSize));
  } else {
    // remaining 21..35: [20, sisanya] (sisanya ≤15).
    pages.push(remaining.slice(0, MIDDLE_PAGE_MAX_ITEMS));
    pages.push(remaining.slice(MIDDLE_PAGE_MAX_ITEMS));
  }

  return pages;
}

function renderPaginatedReceipt(order: ReceiptOrder, orderIndex: number): string[] {
  const pagesOfItems = splitItemsIntoPages(order.items);
  const totalPages = pagesOfItems.length;

  const periods = [
    ...new Map(
      order.items
        .filter((item) => item.preOrderItem?.period)
        .map((item) => [
          item.preOrderItem!.period.id,
          item.preOrderItem!.period,
        ]),
    ).values(),
  ];

  const isShipped = order.fulfillmentType === "SHIPPED";

  const pickupBlocks = periods
    .map(
      (period) => `<div class="pickup">
        <strong>${escapeHtml(period.name)}</strong><br>
        Estimasi: ${escapeHtml(formatDateTime(period.estimatedPickupAt))}<br>
        Lokasi: ${escapeHtml(period.pickupLocation)}<br>
        Jadwal: ${escapeHtml(period.pickupSchedule)}
        ${period.pickupNote ? `<br>Catatan: ${escapeHtml(period.pickupNote)}` : ""}
        ${period.shippingNote ? `<br>Info kirim: ${escapeHtml(period.shippingNote)}` : ""}
      </div>`,
    )
    .join("");

  const addressBlock = isShipped
    ? `<div class="address">
        <strong>Alamat pengiriman</strong><br>
        ${escapeHtml(order.shippingAddress?.trim() || "Alamat belum diisi.")}
        <br><br>Ongkir <strong>tidak termasuk</strong> pembayaran gateway. Selesaikan ongkir manual via WhatsApp panitia.
      </div>`
    : "";

  const renderItemRows = (pageItems: ReceiptOrder["items"], startIndex: number) => `<table>
    <thead><tr><th style="width:8mm">No.</th><th>Produk</th><th>Varian</th><th style="width:25mm">Jumlah</th><th style="width:31mm">Subtotal</th></tr></thead>
    <tbody>${pageItems
      .map(
        (item, idx) => `<tr>
          <td>${startIndex + idx + 1}</td>
          <td>${escapeHtml(item.productName)}</td>
          <td>${escapeHtml(item.variantName?.trim() || item.variantQuota?.variant.name?.trim() || "—")}</td>
          <td class="right">${item.quantity} ${escapeHtml(item.product?.unit ?? "pcs")}</td>
          <td class="right">${escapeHtml(formatRupiah(item.subtotal))}</td>
        </tr>`,
      )
      .join("")}</tbody>
    <tfoot><tr><th colspan="4" class="right">Total</th><th class="right">${escapeHtml(formatRupiah(order.total))}</th></tr></tfoot>
  </table>`;

  const renderHeader = (pageNum: number) => `<header>
    <img class="brand" src="__LOGO__" alt="Merch PENS">
    <div style="text-align:right">
      <h1>Resi Pengambilan Disposisi</h1>
      <p class="code">${escapeHtml(order.orderNumber)}</p>
      <p class="small muted">Halaman ${pageNum} dari ${totalPages}</p>
      <p class="small muted">Dibuat ${escapeHtml(formatDateTime(order.createdAt))}</p>
    </div>
  </header>`;

  const renderFooter = () => `<h2>${isShipped ? "Informasi Pengiriman & Pengambilan" : "Informasi Pengambilan"}</h2>
    ${addressBlock}
    ${pickupBlocks || '<div class="pickup">Konfirmasi lokasi dan jadwal kepada panitia.</div>'}

    <h2>Checklist Serah Terima</h2>
    <div class="checklist">
      <span>☐ Identitas sesuai</span>
      <span>☐ Jumlah barang sesuai</span>
      <span>☐ Kondisi barang diperiksa</span>
      <span>☐ Pembayaran terkonfirmasi</span>
    </div>

    <section class="signatures">
      <div class="signatures">
        <div><p>Panitia yang menyerahkan</p><div class="signature-line"></div><p>(Nama &amp; tanda tangan)</p></div>
        <div><p>Penerima barang</p><div class="signature-line"></div><p>(Nama &amp; tanda tangan)</p></div>
      </div>
      <div class="row small" style="margin-top:4mm"><span>Jika diwakilkan, diambilkan oleh</span><span>................................................</span></div>
    </section>
    <p class="notice">
      Penerima telah memeriksa jumlah dan kondisi barang. Komplain wajib disertai
      video unboxing/penggunaan pertama dan disampaikan maksimal 14 hari setelah
      pengambilan sesuai syarat transaksi Merch PENS.
    </p>`;

  const renderCustomerGrid = () => `<div class="grid">
    ${infoRow("Nama", order.customerName)}
    ${infoRow("Tipe", CUSTOMER_TYPE_LABEL[order.customerType] ?? order.customerType)}
    ${infoRow("Angkatan", order.customerBatch || "—")}
    ${infoRow("Jurusan", order.customerProgram || "—")}
    ${infoRow("WhatsApp", order.customerPhone)}
    ${infoRow("Terima", FULFILLMENT_LABEL[order.fulfillmentType] ?? order.fulfillmentType)}
    ${infoRow("Metode", "Duitku")}
  </div>`;

  // Hitung start index tiap halaman untuk nomor urut item.
  let accumulatedItems = 0;

  return pagesOfItems.map((pageItems, pageIndex) => {
    const pageNum = pageIndex + 1;
    const isFirstPage = pageIndex === 0;
    const isLastPage = pageIndex === pagesOfItems.length - 1;
    const startIndex = accumulatedItems;
    accumulatedItems += pageItems.length;

    if (isFirstPage && pagesOfItems.length === 1) {
      // Single page receipt.
      return `<section class="receipt" data-order="${orderIndex}" data-total-pages="1">
        ${renderHeader(1)}

        <h2>Data Pemesan</h2>
        ${renderCustomerGrid()}

        <h2>Item Pesanan</h2>
        ${renderItemRows(pageItems, startIndex)}

        ${renderFooter()}
      </section>`;
    }

    if (isFirstPage) {
      // First page of multi-page receipt.
      return `<section class="receipt" data-order="${orderIndex}" data-page="1" data-total-pages="${totalPages}">
        ${renderHeader(1)}

        <h2>Data Pemesan</h2>
        ${renderCustomerGrid()}

    <h2>Item Pesanan</h2>
    ${renderItemRows(pageItems, startIndex)}
  </section>`;
    }

    // Continuation page (page 2+).
    return `<section class="receipt" data-order="${orderIndex}" data-page="${pageNum}" data-total-pages="${totalPages}">
      <header>
        <div style="text-align:left">
          <h1>Resi Pengambilan Disposisi</h1>
          <p class="code">${escapeHtml(order.orderNumber)}</p>
          <p class="small muted">Halaman ${pageNum} dari ${totalPages}</p>
          <p class="small muted">${formatDateTime(order.createdAt)}</p>
        </div>
        <div style="text-align:center; font-size:14pt; color:#9e7638;">
          <strong>Lanjutan Halaman Sebelumnya</strong>
        </div>
      </header>

      <h2>Item Pesanan (Lanjutan)</h2>
      ${renderItemRows(pageItems, startIndex)}

      ${isLastPage ? renderFooter() : ""}
    </section>`;
  });
}

function infoRow(label: string, value: string): string {
  return `<div class="row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
