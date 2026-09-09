import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightLeftIcon,
  GraduationCapIcon,
  InfoIcon,
  UserCogIcon,
  UserRoundSearchIcon,
  UsersIcon,
} from "lucide-react";

import { AdminPagination } from "@/components/admin/admin-pagination";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { ensurePageCapability } from "@/components/admin/guard";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { Prisma, Role } from "@/generated/prisma/client";
import { formatDate, formatNumber } from "@/lib/format";
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { PAGE_SIZE, assignableRoleSchema, userStatusFilterSchema } from "./schemas";
import { UserFilters, type UserFilterState } from "./user-filters";
import { UserFormDialog } from "./user-form";
import { UserRowActions } from "./user-row-actions";

export const metadata: Metadata = { title: "Pengguna" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** Ambil satu nilai dari searchParams (kunci yang diulang datang sebagai array). */
function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Warna lencana peran — sama keluarga warnanya dengan lencana lain di panel. */
const ROLE_BADGE_CLASS: Record<Role, string> = {
  PENGURUS: "bg-amber-500/15 text-amber-200",
  CUSTOMER: "bg-raise text-[#D8D3C7]",
};

/** Ikon kartu ringkas per peran. */
const ROLE_ICON: Record<Role, typeof UsersIcon> = {
  PENGURUS: UserCogIcon,
  CUSTOMER: GraduationCapIcon,
};

/** Warna aksen kartu ringkas per peran. */
const ROLE_TONE: Record<Role, "sky" | "amber" | "emerald" | "slate"> = {
  PENGURUS: "amber",
  CUSTOMER: "emerald",
};

type RoleTally = { total: number; active: number };

type UserRow = {
  id: string;
  name: string | null;
  displayName: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  orderCount: number;
  isSelf: boolean;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Guard di layout TIDAK cukup: di Next 16 layout dan page dirender bersamaan,
  // jadi tanpa baris ini query di bawah tetap berjalan untuk peran yang tidak
  // berhak. Halaman ini khusus pengurus (MANAGE_USERS).
  const actor = await ensurePageCapability("MANAGE_USERS", "/admin/pengguna");

  const params = await searchParams;

  const q = first(params.q).trim();

  // Nilai filter yang tidak dikenal diperlakukan sebagai "tidak difilter" — URL
  // yang diketik sembarangan tidak boleh membuat halaman gagal render.
  const parsedRole = assignableRoleSchema.safeParse(first(params.peran).trim());
  const parsedStatus = userStatusFilterSchema.safeParse(first(params.status).trim());

  const pageRaw = Number.parseInt(first(params.page), 10);
  const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const where: Prisma.UserWhereInput = {};
  if (q !== "") {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }
  if (parsedRole.success) where.role = parsedRole.data;
  if (parsedStatus.success) where.isActive = parsedStatus.data === "aktif";

  // Kartu ringkas menghitung SELURUH pengguna (tidak ikut filter) supaya
  // angkanya tetap menjawab "berapa pengurus yang kita punya", apa pun yang
  // sedang dicari di tabel. Satu `groupBy` sudah cukup — tidak perlu satu query
  // per peran.
  const [totalItems, roleGroups] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.groupBy({
      by: ["role", "isActive"],
      _count: { _all: true },
    }),
  ]);

  const tally = new Map<Role, RoleTally>(
    ASSIGNABLE_ROLES.map((role) => [role, { total: 0, active: 0 }]),
  );
  for (const group of roleGroups) {
    const entry = tally.get(group.role) ?? { total: 0, active: 0 };
    entry.total += group._count._all;
    if (group.isActive) entry.active += group._count._all;
    tally.set(group.role, entry);
  }

  function countOf(role: Role): RoleTally {
    return tally.get(role) ?? { total: 0, active: 0 };
  }

  const allUsers = [...tally.values()].reduce(
    (sum, entry) => ({
      total: sum.total + entry.total,
      active: sum.active + entry.active,
    }),
    { total: 0, active: 0 },
  );

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const users = await prisma.user.findMany({
    where,
    // Pengurus lebih dulu (urutan enum Role: CUSTOMER → PENGURUS, jadi `desc`),
    // baru yang terbaru mendaftar. Daftar customer panjang; yang paling sering
    // dicari di halaman ini adalah pengurus.
    orderBy: [{ role: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    // Select EKSPLISIT, bukan `include`: `passwordHash` tidak boleh ikut
    // terkirim ke browser. Hash bcrypt memang tidak bisa dibalik, tetapi
    // mengirimkannya ke klien berarti menyerahkan bahan untuk ditebak secara
    // offline tanpa satu pun percobaan login yang terlihat.
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      // Jumlah pesanan lewat _count: satu query untuk seluruh halaman, bukan
      // satu query per baris.
      _count: { select: { orders: true } },
    },
  });

  const rows: UserRow[] = users.map((user) => {
    const trimmedName = user.name?.trim() ?? "";
    return {
      id: user.id,
      name: user.name,
      displayName: trimmedName === "" ? user.email : trimmedName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      orderCount: user._count.orders,
      isSelf: user.id === actor.id,
    };
  });

  const filters: UserFilterState = {
    q,
    peran: parsedRole.success ? parsedRole.data : "",
    status: parsedStatus.success ? parsedStatus.data : "",
  };

  const hasFilter = Boolean(filters.q || filters.peran || filters.status);

  /** Tautan paginasi yang mempertahankan seluruh filter aktif. */
  function createHref(targetPage: number): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) search.set(key, value);
    }
    if (targetPage > 1) search.set("page", String(targetPage));
    const query = search.toString();
    return query === "" ? "/admin/pengguna" : `/admin/pengguna?${query}`;
  }

  const columns: DataTableColumn<UserRow>[] = [
    {
      key: "name",
      header: "Nama",
      className: "min-w-48 whitespace-normal",
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-cream">
            {row.name?.trim() ? row.name : <span className="text-[#8A8A8A]">Tanpa nama</span>}
          </span>
          {row.isSelf && (
            <Badge className="bg-gold/10 text-gold">(kamu)</Badge>
          )}
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      className: "max-w-56 text-sm text-cream-muted",
      cell: (row) => <span className="block truncate">{row.email}</span>,
    },
    {
      key: "phone",
      header: "Telepon",
      className: "text-sm text-cream-muted",
      cell: (row) =>
        row.phone?.trim() ? row.phone : <span className="text-[#8A8A8A]">—</span>,
    },
    {
      key: "role",
      header: "Peran",
      cell: (row) => (
        <Badge className={ROLE_BADGE_CLASS[row.role]}>{ROLE_LABEL[row.role]}</Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) =>
        row.isActive ? (
          <Badge className="bg-emerald-500/15 text-emerald-200">Aktif</Badge>
        ) : (
          <Badge className="bg-[#2A2A2A] text-[#D8D3C7]">Nonaktif</Badge>
        ),
    },
    {
      key: "orders",
      header: "Pesanan",
      className: "text-center",
      headerClassName: "text-center",
      cell: (row) =>
        row.orderCount === 0 ? (
          <span className="text-sm text-[#8A8A8A]">0</span>
        ) : (
          <Link
            href={`/admin/pesanan?q=${encodeURIComponent(row.email)}`}
            className="text-sm font-medium text-gold tabular-nums hover:underline"
          >
            {formatNumber(row.orderCount)}
          </Link>
        ),
    },
    {
      key: "createdAt",
      header: "Tanggal Daftar",
      className: "text-sm whitespace-nowrap text-cream-muted",
      cell: (row) => formatDate(row.createdAt),
    },
    {
      key: "actions",
      header: <span className="sr-only">Aksi</span>,
      className: "text-right",
      headerClassName: "text-right",
      cell: (row) => (
        <div className="flex items-center justify-end">
          <UserRowActions
            userId={row.id}
            displayName={row.displayName}
            role={row.role}
            isActive={row.isActive}
            isSelf={row.isSelf}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Pengguna"
        description="Akun pengurus dan mahasiswa. Hanya Pengurus Inti yang bisa membuka halaman ini."
        action={<UserFormDialog />}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total pengguna"
          value={formatNumber(allUsers.total)}
          hint={`${formatNumber(allUsers.active)} aktif · ${formatNumber(
            allUsers.total - allUsers.active,
          )} nonaktif`}
          icon={UsersIcon}
          tone="slate"
        />

        {/* Peran pengurus, dari yang paling berwenang. */}
        {[...ASSIGNABLE_ROLES]
          .filter((role) => role !== "CUSTOMER")
          .reverse()
          .map((role) => {
            const entry = countOf(role);
            return (
              <StatCard
                key={role}
                label={ROLE_LABEL[role]}
                value={formatNumber(entry.total)}
                hint={
                  entry.total === entry.active
                    ? `${formatNumber(entry.active)} aktif`
                    : `${formatNumber(entry.active)} aktif · ${formatNumber(
                        entry.total - entry.active,
                      )} nonaktif`
                }
                icon={ROLE_ICON[role]}
                tone={ROLE_TONE[role]}
                href={`/admin/pengguna?peran=${role}`}
              />
            );
          })}

        <StatCard
          label={ROLE_LABEL.CUSTOMER}
          value={formatNumber(countOf("CUSTOMER").total)}
          hint={`${formatNumber(countOf("CUSTOMER").active)} bisa memesan`}
          icon={ROLE_ICON.CUSTOMER}
          tone={ROLE_TONE.CUSTOMER}
          href="/admin/pengguna?peran=CUSTOMER"
        />
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        <Alert className="border-white/10">
          <InfoIcon aria-hidden className="text-gold" />
          <AlertTitle>Arti tiap peran</AlertTitle>
          <AlertDescription>
            <dl className="mt-1 space-y-1.5">
              {ASSIGNABLE_ROLES.map((role) => (
                <div key={role} className="text-sm">
                  <dt className="inline font-medium text-cream-soft">
                    {ROLE_LABEL[role]}:
                  </dt>{" "}
                  <dd className="inline text-cream-muted">{ROLE_DESCRIPTION[role]}</dd>
                </div>
              ))}
            </dl>
          </AlertDescription>
        </Alert>

        <Alert className="border-gold/30 bg-gold/10/50">
          <ArrowRightLeftIcon aria-hidden className="text-gold" />
          <AlertTitle>Serah terima kepengurusan</AlertTitle>
          <AlertDescription>
            <p className="text-cream-muted">
              Kepengurusan BEM berganti tiap tahun. Lakukan urutannya seperti ini
              supaya tidak ada yang terkunci di luar panel:
            </p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-sm text-cream-muted">
              <li>
                Angkat pengurus baru menjadi{" "}
                <span className="font-medium text-cream-soft">Pengurus Inti</span> lewat
                menu <span className="font-medium text-cream-soft">Ubah Peran</span>.
              </li>
              <li>
                Pastikan dia benar-benar bisa masuk dengan akunnya sendiri — minta dia
                mencobanya sekarang juga. Kalau kata sandinya terlupa, pakai{" "}
                <span className="font-medium text-cream-soft">Reset Password</span>.
              </li>
              <li>
                Setelah itu barulah{" "}
                <span className="font-medium text-cream-soft">nonaktifkan</span> akun
                pengurus lama.
              </li>
            </ol>
            <p className="mt-1.5 text-sm text-cream-muted">
              Akun tidak pernah dihapus agar riwayat pesanannya tetap utuh, dan sistem
              menolak menurunkan atau menonaktifkan Pengurus Inti aktif yang terakhir.
            </p>
          </AlertDescription>
        </Alert>
      </div>

      <div className="mb-4 rounded-xl border border-white/10 bg-coal p-4">
        <UserFilters key={JSON.stringify(filters)} initial={filters} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty={
          <div className="flex flex-col items-center gap-2">
            <UserRoundSearchIcon className="size-8 text-[#6E6E6E]" aria-hidden />
            <p className="font-medium text-[#D8D3C7]">Pengguna tidak ditemukan</p>
            <p className="text-sm text-cream-muted">
              {hasFilter
                ? "Tidak ada pengguna yang cocok dengan pencarian atau filter yang kamu pilih."
                : "Belum ada akun terdaftar. Tambahkan pengurus lewat tombol di atas."}
            </p>
          </div>
        }
      />

      <AdminPagination
        className="mt-4"
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        createHref={createHref}
      />
    </>
  );
}
