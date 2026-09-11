import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, TriangleAlertIcon } from "lucide-react";

import { ensurePageCapability } from "@/components/admin/guard";
import { StatCard } from "@/components/admin/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateTime, formatNumber } from "@/lib/format";
import { isPeriodOpen } from "@/lib/preorder";
import { prisma } from "@/lib/prisma";
import { getPickupDefaults } from "@/lib/settings";

import { PeriodStateBadge, PeriodStatusBadge, describePeriod } from "../period-state";
import { PeriodForm, type PeriodFormValues } from "../period-form";
import { toDateTimeLocalValue } from "../schemas";
import { PeriodQuickActions } from "./period-actions";
import {
  QuotaManager,
  type PeriodProductGroup,
  type ProductCandidate,
} from "./quota-manager";
import { BoxesIcon, PackageIcon, PackageCheckIcon, PackageOpenIcon } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const period = await prisma.preOrderPeriod.findUnique({
    where: { id },
    select: { name: true },
  });

  return { title: period ? period.name : "Periode Pre-Order" };
}

export default async function EditPreOrderPeriodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensurePageCapability("MANAGE_CATALOG", "/admin/pre-order");

  const { id } = await params;
  const now = new Date();

  const period = await prisma.preOrderPeriod.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { product: { name: "asc" } },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              unit: true,
              price: true,
              isActive: true,
              variants: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
                select: {
                  id: true,
                  name: true,
                  size: true,
                  design: true,
                  priceDelta: true,
                  isActive: true,
                },
              },
            },
          },
          variantQuotas: {
            orderBy: { variant: { sortOrder: "asc" } },
            include: {
              variant: {
                select: {
                  id: true,
                  name: true,
                  size: true,
                  design: true,
                  priceDelta: true,
                  isActive: true,
                },
              },
              _count: { select: { orderItems: true } },
            },
          },
          _count: { select: { orderItems: true } },
        },
      },
    },
  });

  if (!period) notFound();

  const candidateRows = await prisma.product.findMany({
    where: {
      isActive: true,
      preOrderItems: { none: { periodId: id } },
    },
    select: {
      id: true,
      name: true,
      price: true,
      unit: true,
      variants: {
        where: { isActive: true },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const open = isPeriodOpen(period, now);
  const state = describePeriod(period, open, now);

  const groups: PeriodProductGroup[] = period.items.map((item) => {
    const quotas = item.variantQuotas.map((row) => ({
      quotaId: row.id,
      variantId: row.variant.id,
      variantName: row.variant.name,
      size: row.variant.size,
      design: row.variant.design,
      priceDelta: row.variant.priceDelta,
      isActive: row.variant.isActive,
      quota: row.quota,
      reserved: row.reserved,
      price: row.price,
      orderItemCount: row._count.orderItems,
      effectivePrice:
        row.price ?? item.price ?? item.product.price + row.variant.priceDelta,
    }));

    const existingIds = new Set(quotas.map((q) => q.variantId));
    const missing = item.product.variants
      .filter((variant) => !existingIds.has(variant.id))
      .map((variant) => ({
        variantId: variant.id,
        variantName: variant.name,
        size: variant.size,
        design: variant.design,
        priceDelta: variant.priceDelta,
      }));

    return {
      preOrderItemId: item.id,
      productId: item.product.id,
      productName: item.product.name,
      unit: item.product.unit,
      basePrice: item.product.price,
      itemPrice: item.price,
      isActive: item.product.isActive,
      orderItemCount: item._count.orderItems,
      quotas,
      missing,
    };
  });

  const candidates: ProductCandidate[] = candidateRows.map((product) => ({
    id: product.id,
    name: product.name,
    price: product.price,
    unit: product.unit,
    variantCount: product.variants.length,
  }));

  const totalQuota = groups.reduce(
    (sum, group) => sum + group.quotas.reduce((inner, row) => inner + row.quota, 0),
    0,
  );
  const totalReserved = groups.reduce(
    (sum, group) => sum + group.quotas.reduce((inner, row) => inner + row.reserved, 0),
    0,
  );
  const totalVariants = groups.reduce((sum, group) => sum + group.quotas.length, 0);

  const pickupDefaults = await getPickupDefaults();
  const estimatedPickupAt =
    period.estimatedPickupAt ??
    new Date(period.endAt.getTime() + pickupDefaults.leadDays * 86_400_000);

  const initial: PeriodFormValues = {
    name: period.name,
    slug: period.slug,
    description: period.description ?? "",
    startAt: toDateTimeLocalValue(period.startAt),
    endAt: toDateTimeLocalValue(period.endAt),
    estimatedPickupAt: toDateTimeLocalValue(estimatedPickupAt),
    pickupLocation: period.pickupLocation ?? pickupDefaults.location,
    pickupSchedule: period.pickupSchedule ?? pickupDefaults.schedule,
    pickupNote: period.pickupNote ?? pickupDefaults.note,
    shippingNote: period.shippingNote ?? "",
    whatsappGroupUrl: period.whatsappGroupUrl ?? "",
    status: period.status,
  };

  const activeButExpired = period.status === "ACTIVE" && period.endAt < now;
  const activeButNotStarted = period.status === "ACTIVE" && period.startAt > now;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/pre-order"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-cream-muted transition-colors hover:text-gold"
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
          Kembali ke daftar periode
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-cream">{period.name}</h1>
              <PeriodStateBadge state={state} />
              <PeriodStatusBadge status={period.status} />
            </div>
            <p className="mt-1 text-sm text-cream-muted">
              {formatDateTime(period.startAt)} — {formatDateTime(period.endAt)}
              {period.closedAt ? ` · ditutup manual ${formatDateTime(period.closedAt)}` : ""}
            </p>
          </div>

          <PeriodQuickActions periodId={period.id} status={period.status} isOpen={open} />
        </div>
      </div>

      {activeButExpired ? (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-200">
          <TriangleAlertIcon className="size-4 text-amber-300" aria-hidden />
          <AlertTitle>Periode sudah tertutup otomatis</AlertTitle>
          <AlertDescription className="text-amber-200/90">
            Statusnya masih Aktif, tetapi tanggal berakhir sudah lewat sehingga pemesanan berhenti
            dengan sendirinya — ini memang perilaku yang diharapkan dan{" "}
            <strong>tidak perlu dibereskan manual</strong>. Kalau kamu ingin membuka batch ini
            lagi, cukup majukan tanggal berakhirnya.
          </AlertDescription>
        </Alert>
      ) : null}

      {activeButNotStarted ? (
        <Alert className="border-gold/30 bg-gold/10 text-gold-light">
          <TriangleAlertIcon className="size-4 text-gold" aria-hidden />
          <AlertTitle>Periode belum dimulai</AlertTitle>
          <AlertDescription className="text-gold-light/90">
            Statusnya Aktif, tetapi pemesanan baru terbuka sendiri pada{" "}
            {formatDateTime(period.startAt)}.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Produk"
          value={formatNumber(groups.length)}
          hint={`${formatNumber(totalVariants)} varian berkuota`}
          icon={PackageIcon}
          tone="slate"
        />
        <StatCard
          label="Total kuota varian"
          value={formatNumber(totalQuota)}
          hint="akumulasi semua varian"
          icon={BoxesIcon}
          tone="sky"
        />
        <StatCard
          label="Terpakai"
          value={formatNumber(totalReserved)}
          hint={
            totalQuota > 0
              ? `${Math.round((totalReserved / totalQuota) * 100)}% dari total kuota`
              : "belum ada kuota"
          }
          icon={PackageCheckIcon}
          tone="amber"
        />
        <StatCard
          label="Sisa"
          value={formatNumber(Math.max(0, totalQuota - totalReserved))}
          hint={open ? "masih bisa dipesan" : "periode sedang tidak menerima pesanan"}
          icon={PackageOpenIcon}
          tone={open ? "emerald" : "slate"}
        />
      </div>

      <QuotaManager periodId={period.id} groups={groups} candidates={candidates} />

      <div className="max-w-3xl">
        <PeriodForm
          mode="edit"
          periodId={period.id}
          initial={initial}
          pickupLeadDays={pickupDefaults.leadDays}
        />
      </div>
    </div>
  );
}
