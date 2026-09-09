import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/page-header";
import { ensurePageCapability } from "@/components/admin/guard";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "../product-form";
import { emptyProductFormValues } from "../schemas";

export const metadata: Metadata = { title: "Tambah Produk" };

export default async function AdminNewProductPage() {
  await ensurePageCapability("MANAGE_CATALOG", "/admin/produk/baru");

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <>
      <AdminPageHeader
        title="Tambah Produk"
        description="Lengkapi data produk. Slug dibuat otomatis dari nama, namun tetap bisa diubah."
        action={
          <Button
            variant="outline"
            className="h-10 gap-1.5"
            nativeButton={false}
            render={<Link href="/admin/produk" />}
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
            Kembali
          </Button>
        }
      />

      <ProductForm
        mode="create"
        categories={categories}
        defaultValues={emptyProductFormValues()}
      />
    </>
  );
}
