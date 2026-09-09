import { Workbook, type Worksheet } from "exceljs";

import {
  REKAP_ITEM_COLUMNS,
  REKAP_ORDER_COLUMNS,
  REKAP_SHEET_NAME,
  isNumericKind,
  parseRekapFilters,
  type RekapColumn,
  type RekapColumnKind,
  type RekapItemRow,
  type RekapOrderRow,
} from "@/app/admin/rekap/schemas";
import { getRekap } from "@/app/admin/rekap/rekap-query";
import { requireCapability } from "@/lib/auth";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, slugify } from "@/lib/format";

/**
 * Unduh rekap pembeli sebagai satu berkas .xlsx berisi dua lembar
 * (Per Pesanan & Per Item).
 *
 * Datanya diambil lewat query bersama `getRekap` — persis yang dipakai halaman
 * `/admin/rekap`. Filternya pun dibaca dengan `parseRekapFilters` yang sama,
 * jadi tautan "Unduh Excel" yang membawa query string halaman menghasilkan isi
 * yang sama dengan yang sedang tampil di layar.
 *
 * Berkas ditulis ke buffer di memori, tidak pernah menyentuh disk.
 */

// Endpoint ini membaca sesi dan query string; tidak boleh ada hasil yang
// tersimpan dan terlayani ulang untuk pengguna lain.
export const dynamic = "force-dynamic";

/** Format tanggal Excel yang lazim dibaca di Indonesia. */
const DATE_FORMAT = "dd/mm/yyyy hh:mm";
/** Rupiah sebagai ANGKA — supaya bisa dijumlah, bukan teks. */
const MONEY_FORMAT = "#,##0";
/** Teks murni: menjaga kode, no HP, dan angkatan tidak diubah Excel jadi angka. */
const TEXT_FORMAT = "@";

const HEADER_FILL = "FFE2E8F0"; // slate-200
const BORDER_COLOR = "FFCBD5E1"; // slate-300;

/** Kolom yang nilainya string dan wajib ditulis sebagai teks di Excel. */
const TEXT_KEY = new Set(["kodePesanan", "telepon", "angkatan", "jurusan", "email"]);

/**
 * Nilai satu sel untuk Excel.
 *
 * Berbeda dengan tabel di layar, di sini tanggal tetap `Date` dan uang tetap
 * `number` — yang mengubahnya jadi tampilan enak dibaca adalah `numFmt` kolom,
 * bukan string yang sudah terlanjur diformat. Dengan begitu panitia masih bisa
 * menjumlah, mengurutkan, dan mem-filter di Excel.
 */
function cellValue(kind: RekapColumnKind, value: unknown): string | number | Date | null {
  switch (kind) {
    case "date":
      return value instanceof Date ? value : null;

    case "money":
    case "number":
      return typeof value === "number" ? value : null;

    case "orderStatus":
      return typeof value === "string" ? (ORDER_STATUS_LABEL[value] ?? value) : null;

    case "paymentStatus":
      return typeof value === "string" ? (PAYMENT_STATUS_LABEL[value] ?? value) : "Belum ada";

    default:
      return typeof value === "string" && value.trim() ? value : null;
  }
}

function numFmtFor(kind: RekapColumnKind, key: string): string | undefined {
  switch (kind) {
    case "date":
      return DATE_FORMAT;
    case "money":
    case "number":
      return MONEY_FORMAT;
    case "code":
      return TEXT_FORMAT;
    default:
      // Angkatan & jurusan (dan teks identitas lain) dipaksa ber-format teks
      // supaya "2024" tidak dibuka Excel sebagai angka.
      return TEXT_KEY.has(key) ? TEXT_FORMAT : undefined;
  }
}

/** Menulis satu lembar lengkap dengan header tebal, freeze pane, dan autofilter. */
function writeSheet<Row>(
  workbook: Workbook,
  name: string,
  columns: readonly RekapColumn<Row>[],
  rows: readonly Row[],
): Worksheet {
  const sheet = workbook.addWorksheet(name, {
    // Baris header dibekukan supaya tetap terlihat saat digulir ke bawah —
    // padanan header lengket di halaman.
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
  });

  sheet.columns = columns.map((column) => ({
    header: column.label,
    key: column.key,
    width: column.width,
    style: {
      numFmt: numFmtFor(column.kind, column.key),
      alignment: {
        horizontal: isNumericKind(column.kind) ? "right" : "left",
        vertical: "top",
        wrapText: false,
      },
    },
  }));

  for (const row of rows) {
    const record: Record<string, string | number | Date | null> = {};
    for (const column of columns) {
      record[column.key] = cellValue(
        column.kind,
        (row as Record<string, unknown>)[column.key],
      );
    }
    sheet.addRow(record);
  }

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.border = {
      top: { style: "thin", color: { argb: BORDER_COLOR } },
      left: { style: "thin", color: { argb: BORDER_COLOR } },
      bottom: { style: "medium", color: { argb: BORDER_COLOR } },
      right: { style: "thin", color: { argb: BORDER_COLOR } },
    };
  });

  // Autofilter selalu dipasang di baris header, bahkan saat isinya kosong,
  // supaya bentuk lembarnya tidak berubah-ubah tergantung hasil saringan.
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: columns.length },
  };

  return sheet;
}

/** Nama berkas yang aman dipakai lintas sistem berkas. */
function buildFilename(periodeName: string | null): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  const slug = slugify(periodeName ?? "semua-periode") || "semua-periode";
  return `rekap-pesanan-${slug}-${stamp}.xlsx`;
}

export async function GET(request: Request) {
  // Otorisasi DI DALAM handler: route bisa dipanggil siapa saja, dan berkas ini
  // memuat nomor HP serta email seluruh pembeli. Jawabannya 403 — BUKAN
  // redirect ke halaman masuk — karena yang meminta adalah unduhan berkas, dan
  // halaman HTML yang menyamar sebagai .xlsx hanya membuat bingung.
  try {
    await requireCapability("MANAGE_ORDERS");
  } catch {
    return Response.json(
      { ok: false, message: "Kamu tidak punya akses untuk mengunduh rekap pesanan." },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const filters = parseRekapFilters((key) => url.searchParams.get(key));

  const rekap = await getRekap(filters);

  const workbook = new Workbook();
  workbook.creator = "Panel Admin";
  workbook.created = new Date();

  writeSheet<RekapOrderRow>(
    workbook,
    REKAP_SHEET_NAME.pesanan,
    REKAP_ORDER_COLUMNS,
    rekap.barisPesanan,
  );
  writeSheet<RekapItemRow>(
    workbook,
    REKAP_SHEET_NAME.item,
    REKAP_ITEM_COLUMNS,
    rekap.barisItem,
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = buildFilename(rekap.periode?.name ?? null);

  return new Response(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // `slugify` sudah memangkas nama periode menjadi huruf, angka, dan tanda
      // hubung saja, jadi tidak ada tanda kutip atau baris baru yang bisa
      // merusak header ini. `filename*` disertakan sebagai bentuk baku modern,
      // `filename` biasa sebagai cadangan untuk peramban lama.
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
        filename,
      )}`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
