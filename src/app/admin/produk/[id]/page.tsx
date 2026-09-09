import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/page-header";
import { ensurePageCapability } from "@/components/admin/guard";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "../product-form";
import type { ProductFormValues } from "../schemas";
import { VariantManager, type VariantManagerItem } from "../variant-manager";

export const metadata: Metadata = { title: "Ubah Produk" };

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensurePageCapability("MANAGE_CATALOG", "/admin/produk");

  const { id } = await params;

  const [product, categories, variants] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        categories: { select: { id: true } },
      },
    }),
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.productVariant.findMany({
      where: { productId: id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { quotas: true } } },
    }),
  ]);

  if (!product) notFound();

  const variantIds = variants.map((variant) => variant.id);
  const orderUsage =
    variantIds.length === 0
      ? []
      : await prisma.orderItem.groupBy({
          by: ["variantId"],
          where: { variantId: { in: variantIds } },
          _count: { _all: true },
        });
  const orderCountByVariant = new Map(
    orderUsage.map((row) => [row.variantId, row._count._all]),
  );

  const variantItems: VariantManagerItem[] = variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    size: variant.size,
    design: variant.design,
    sku: variant.sku,
    priceDelta: variant.priceDelta,
    imageUrl: variant.imageUrl,
    isActive: variant.isActive,
    sortOrder: variant.sortOrder,
    quotaCount: variant._count.quotas,
    orderItemCount: orderCountByVariant.get(variant.id) ?? 0,
  }));

  const defaultValues: ProductFormValues = {
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    price: String(product.price),
    sku: product.sku ?? "",
    brand: product.brand ?? "",
    unit: product.unit,
    categoryIds: product.categories.map((category) => category.id),
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    images: product.images.map((image) => ({
      url: image.url,
      alt: image.alt ?? "",
      isPrimary: image.isPrimary,
    })),
  };

  return (
    <>
      <AdminPageHeader
        title="Ubah Produk"
        description={product.name}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-10 gap-1.5"
              nativeButton={false}
              render={
                <Link href={`/produk/${product.slug}`} target="_blank" rel="noreferrer" />
              }
            >
              <ExternalLinkIcon className="size-4" aria-hidden />
              Lihat di toko
            </Button>

            <Button
              variant="outline"
              className="h-10 gap-1.5"
              nativeButton={false}
              render={<Link href="/admin/produk" />}
            >
              <ArrowLeftIcon className="size-4" aria-hidden />
              Kembali
            </Button>
          </div>
        }
      />

      <ProductForm
        mode="edit"
        productId={product.id}
        categories={categories}
        defaultValues={defaultValues}
      />

      <div className="mt-5">
        <VariantManager
          productId={product.id}
          productPrice={product.price}
          variants={variantItems}
        />
      </div>
    </>
  );
}
