"use server";

import { revalidatePath } from "next/cache";

import {
  capabilityDeniedResult,
  isUniqueConstraintError,
  serverErrorResult,
  validationFailure,
  type ActionResult,
} from "@/components/admin/action-result";
import { requireCapability } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  productFormSchema,
  variantFormSchema,
  type ProductImageValues,
} from "./schemas";

/** Halaman yang perlu disegarkan setiap kali katalog berubah. */
function revalidateCatalog() {
  revalidatePath("/admin");
  revalidatePath("/admin/produk");
  revalidatePath("/produk");
  revalidatePath("/pre-order");
  revalidatePath("/");
}

/** Penyegaran tambahan setiap kali varian sebuah produk berubah. */
function revalidateProductDetail(productId: string, productSlug?: string) {
  revalidateCatalog();
  revalidatePath(`/admin/produk/${productId}`);
  if (productSlug) revalidatePath(`/produk/${productSlug}`);
}

/**
 * Gambar dinormalisasi: yang ditandai "utama" dipindah ke urutan pertama,
 * sisanya mengikuti urutan input. Selalu tepat satu gambar utama.
 */
function normalizeImages(images: ProductImageValues[]) {
  if (images.length === 0) return [];

  const primaryIndex = Math.max(
    0,
    images.findIndex((image) => image.isPrimary),
  );
  const ordered = [
    images[primaryIndex],
    ...images.filter((_, index) => index !== primaryIndex),
  ];

  return ordered.map((image, index) => ({
    url: image.url,
    alt: image.alt === "" ? null : image.alt,
    sortOrder: index,
    isPrimary: index === 0,
  }));
}

/** Menambah produk baru. */
export async function createProduct(input: unknown): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_CATALOG");
  } catch {
    return capabilityDeniedResult("MANAGE_CATALOG");
  }

  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const data = parsed.data;
  const sku = data.sku === "" ? null : data.sku;

  try {
    const categoryCount = await prisma.category.count({
      where: { id: { in: data.categoryIds } },
    });
    if (categoryCount !== data.categoryIds.length) {
      return {
        ok: false,
        message: "Satu atau beberapa kategori tidak ditemukan.",
        fieldErrors: { categoryIds: "Pilih ulang kategori produk" },
      };
    }

    const slugTaken = await prisma.product.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (slugTaken) {
      return {
        ok: false,
        message: "Slug sudah dipakai produk lain.",
        fieldErrors: { slug: "Slug sudah dipakai produk lain" },
      };
    }

    if (sku) {
      const skuTaken = await prisma.product.findUnique({
        where: { sku },
        select: { id: true },
      });
      if (skuTaken) {
        return {
          ok: false,
          message: "SKU sudah dipakai produk lain.",
          fieldErrors: { sku: "SKU sudah dipakai produk lain" },
        };
      }
    }

    const product = await prisma.product.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description === "" ? null : data.description,
        price: Number(data.price),
        sku,
        brand: data.brand === "" ? null : data.brand,
        unit: data.unit,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
        categories: {
          connect: data.categoryIds.map((categoryId) => ({ id: categoryId })),
        },
        images: { create: normalizeImages(data.images) },
      },
      select: { id: true },
    });

    revalidateCatalog();

    return {
      ok: true,
      message:
        "Produk berhasil ditambahkan. Masukkan ke sebuah periode pre-order beserta kuotanya agar bisa dipesan.",
      id: product.id,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        message: "Slug atau SKU sudah dipakai produk lain.",
        fieldErrors: { slug: "Kemungkinan slug/SKU sudah dipakai" },
      };
    }
    return serverErrorResult("createProduct", error);
  }
}

/** Mengubah produk yang sudah ada. */
export async function updateProduct(id: string, input: unknown): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_CATALOG");
  } catch {
    return capabilityDeniedResult("MANAGE_CATALOG");
  }

  if (typeof id !== "string" || id.trim() === "") {
    return { ok: false, message: "Produk tidak dikenal." };
  }

  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const data = parsed.data;
  const sku = data.sku === "" ? null : data.sku;

  try {
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!existing) {
      return { ok: false, message: "Produk tidak ditemukan (mungkin sudah dihapus)." };
    }

    const categoryCount = await prisma.category.count({
      where: { id: { in: data.categoryIds } },
    });
    if (categoryCount !== data.categoryIds.length) {
      return {
        ok: false,
        message: "Satu atau beberapa kategori tidak ditemukan.",
        fieldErrors: { categoryIds: "Pilih ulang kategori produk" },
      };
    }

    const slugOwner = await prisma.product.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (slugOwner && slugOwner.id !== id) {
      return {
        ok: false,
        message: "Slug sudah dipakai produk lain.",
        fieldErrors: { slug: "Slug sudah dipakai produk lain" },
      };
    }

    if (sku) {
      const skuOwner = await prisma.product.findUnique({
        where: { sku },
        select: { id: true },
      });
      if (skuOwner && skuOwner.id !== id) {
        return {
          ok: false,
          message: "SKU sudah dipakai produk lain.",
          fieldErrors: { sku: "SKU sudah dipakai produk lain" },
        };
      }
    }

    // Tidak ada penjagaan stok di sini: ketersediaan produk sepenuhnya berasal
    // dari kuota `PreOrderItem` pada periode yang terbuka, dan kuota itu punya
    // penjaganya sendiri (tidak boleh turun di bawah yang sudah dipesan) di
    // `/admin/pre-order`.
    await prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.product.update({
        where: { id },
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description === "" ? null : data.description,
          price: Number(data.price),
          sku,
          brand: data.brand === "" ? null : data.brand,
          unit: data.unit,
          isActive: data.isActive,
          isFeatured: data.isFeatured,
          categories: {
            set: data.categoryIds.map((categoryId) => ({ id: categoryId })),
          },
          images: { create: normalizeImages(data.images) },
        },
      });
    });

    revalidateCatalog();
    revalidatePath(`/produk/${existing.slug}`);
    if (existing.slug !== data.slug) revalidatePath(`/produk/${data.slug}`);

    return { ok: true, message: "Perubahan produk tersimpan.", id };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        message: "Slug atau SKU sudah dipakai produk lain.",
        fieldErrors: { slug: "Kemungkinan slug/SKU sudah dipakai" },
      };
    }
    return serverErrorResult("updateProduct", error);
  }
}

/**
 * Menghapus produk.
 *
 * Produk yang pernah masuk pesanan TIDAK boleh dihapus — riwayat pesanan
 * pelanggan harus tetap utuh. Untuk kasus itu produk dinonaktifkan saja
 * sehingga hilang dari katalog tanpa merusak data lama.
 */
export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_CATALOG");
  } catch {
    return capabilityDeniedResult("MANAGE_CATALOG");
  }

  if (typeof id !== "string" || id.trim() === "") {
    return { ok: false, message: "Produk tidak dikenal." };
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, isActive: true },
    });
    if (!product) {
      return { ok: false, message: "Produk tidak ditemukan (mungkin sudah dihapus)." };
    }

    const [orderItemCount, usedQuotaCount] = await Promise.all([
      prisma.orderItem.count({ where: { productId: id } }),
      // Kuota kini dicatat PER VARIAN (`PreOrderVariantQuota.reserved`) —
      // `PreOrderItem` tidak lagi punya kolom `reserved`/`quota`.
      prisma.preOrderVariantQuota.count({
        where: { variant: { productId: id }, reserved: { gt: 0 } },
      }),
    ]);

    if (orderItemCount > 0 || usedQuotaCount > 0) {
      if (product.isActive) {
        await prisma.product.update({ where: { id }, data: { isActive: false } });
        revalidateCatalog();
        revalidatePath(`/produk/${product.slug}`);
        return {
          ok: true,
          message:
            "Produk sudah dipakai pesanan sehingga tidak bisa dihapus. Produk dinonaktifkan agar tidak muncul di katalog.",
        };
      }

      return {
        ok: false,
        message:
          "Produk sudah dipakai pesanan sehingga tidak bisa dihapus. Produk ini sudah dalam keadaan nonaktif.",
      };
    }

    await prisma.product.delete({ where: { id } });

    revalidateCatalog();
    revalidatePath(`/produk/${product.slug}`);

    return { ok: true, message: `Produk "${product.name}" berhasil dihapus.` };
  } catch (error) {
    return serverErrorResult("deleteProduct", error);
  }
}

/** Mengaktifkan / menonaktifkan produk dari daftar. */
export async function toggleProductActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_CATALOG");
  } catch {
    return capabilityDeniedResult("MANAGE_CATALOG");
  }

  if (typeof id !== "string" || id.trim() === "" || typeof isActive !== "boolean") {
    return { ok: false, message: "Permintaan tidak valid." };
  }

  try {
    const product = await prisma.product.update({
      where: { id },
      data: { isActive },
      select: { name: true, slug: true },
    });

    revalidateCatalog();
    revalidatePath(`/produk/${product.slug}`);

    return {
      ok: true,
      message: isActive
        ? `Produk "${product.name}" diaktifkan.`
        : `Produk "${product.name}" dinonaktifkan.`,
    };
  } catch (error) {
    return serverErrorResult("toggleProductActive", error);
  }
}

// ============================================================ varian produk

/** Normalisasi nilai opsional: string kosong menjadi null. */
function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Cek SKU varian terhadap tabel varian (unik) dan tabel produk.
 * Mengembalikan pesan field bila bentrok, atau null bila aman.
 */
async function findVariantSkuConflict(
  sku: string,
  excludeVariantId?: string,
): Promise<string | null> {
  const [variantOwner, productOwner] = await Promise.all([
    prisma.productVariant.findUnique({ where: { sku }, select: { id: true } }),
    prisma.product.findUnique({ where: { sku }, select: { id: true } }),
  ]);

  if (variantOwner && variantOwner.id !== excludeVariantId) {
    return "SKU sudah dipakai varian lain";
  }
  if (productOwner) {
    return "SKU sudah dipakai produk lain";
  }
  return null;
}

/** Menambah varian baru pada sebuah produk. */
export async function createVariant(
  productId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_CATALOG");
  } catch {
    return capabilityDeniedResult("MANAGE_CATALOG");
  }

  if (typeof productId !== "string" || productId.trim() === "") {
    return { ok: false, message: "Produk tidak dikenal." };
  }

  const parsed = variantFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const data = parsed.data;
  const sku = emptyToNull(data.sku);
  const priceDelta = Number(data.priceDelta);

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, slug: true, price: true },
    });
    if (!product) {
      return { ok: false, message: "Produk tidak ditemukan (mungkin sudah dihapus)." };
    }

    if (product.price + priceDelta <= 0) {
      return {
        ok: false,
        message: `Harga final varian (${product.price + priceDelta}) harus lebih dari 0. Sesuaikan selisih harga terhadap harga normal produk.`,
        fieldErrors: {
          priceDelta: "Harga final (harga produk + selisih) harus lebih dari 0",
        },
      };
    }

    if (sku) {
      const conflict = await findVariantSkuConflict(sku);
      if (conflict) {
        return {
          ok: false,
          message: "SKU sudah dipakai.",
          fieldErrors: { sku: conflict },
        };
      }
    }

    const sortOrder =
      data.sortOrder === "" ? await prisma.productVariant.count({ where: { productId } }) : Number(data.sortOrder);

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        name: data.name,
        size: emptyToNull(data.size),
        design: emptyToNull(data.design),
        sku,
        priceDelta,
        imageUrl: emptyToNull(data.imageUrl),
        isActive: data.isActive,
        sortOrder,
      },
      select: { id: true },
    });

    revalidateProductDetail(productId, product.slug);

    return {
      ok: true,
      message: `Varian "${data.name}" berhasil ditambahkan.`,
      id: variant.id,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        message: "SKU sudah dipakai varian atau produk lain.",
        fieldErrors: { sku: "SKU sudah dipakai" },
      };
    }
    return serverErrorResult("createVariant", error);
  }
}

/** Mengubah varian yang sudah ada. */
export async function updateVariant(
  variantId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_CATALOG");
  } catch {
    return capabilityDeniedResult("MANAGE_CATALOG");
  }

  if (typeof variantId !== "string" || variantId.trim() === "") {
    return { ok: false, message: "Varian tidak dikenal." };
  }

  const parsed = variantFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const data = parsed.data;
  const sku = emptyToNull(data.sku);
  const priceDelta = Number(data.priceDelta);

  try {
    const existing = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        productId: true,
        product: { select: { price: true, slug: true } },
      },
    });
    if (!existing) {
      return { ok: false, message: "Varian tidak ditemukan (mungkin sudah dihapus)." };
    }

    if (existing.product.price + priceDelta <= 0) {
      return {
        ok: false,
        message: "Harga final (harga produk + selisih) harus lebih dari 0.",
        fieldErrors: {
          priceDelta: "Harga final (harga produk + selisih) harus lebih dari 0",
        },
      };
    }

    if (sku) {
      const conflict = await findVariantSkuConflict(sku, variantId);
      if (conflict) {
        return {
          ok: false,
          message: "SKU sudah dipakai.",
          fieldErrors: { sku: conflict },
        };
      }
    }

    await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        name: data.name,
        size: emptyToNull(data.size),
        design: emptyToNull(data.design),
        sku,
        priceDelta,
        imageUrl: emptyToNull(data.imageUrl),
        isActive: data.isActive,
        sortOrder: data.sortOrder === "" ? 0 : Number(data.sortOrder),
      },
    });

    revalidateProductDetail(existing.productId, existing.product.slug);

    return { ok: true, message: `Varian "${data.name}" tersimpan.`, id: variantId };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        message: "SKU sudah dipakai varian atau produk lain.",
        fieldErrors: { sku: "SKU sudah dipakai" },
      };
    }
    return serverErrorResult("updateVariant", error);
  }
}

/** Mengaktifkan / menonaktifkan varian. */
export async function setVariantActive(
  variantId: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_CATALOG");
  } catch {
    return capabilityDeniedResult("MANAGE_CATALOG");
  }

  if (
    typeof variantId !== "string" ||
    variantId.trim() === "" ||
    typeof isActive !== "boolean"
  ) {
    return { ok: false, message: "Permintaan tidak valid." };
  }

  try {
    const variant = await prisma.productVariant.update({
      where: { id: variantId },
      data: { isActive },
      select: {
        name: true,
        productId: true,
        product: { select: { slug: true } },
      },
    });

    revalidateProductDetail(variant.productId, variant.product.slug);

    return {
      ok: true,
      message: isActive
        ? `Varian "${variant.name}" diaktifkan.`
        : `Varian "${variant.name}" dinonaktifkan.`,
    };
  } catch (error) {
    return serverErrorResult("setVariantActive", error);
  }
}

/**
 * Menghapus varian.
 *
 * Varian yang sudah dipakai kuota PO (`PreOrderVariantQuota`) atau baris
 * pesanan (`OrderItem.variantId`) TIDAK boleh dihapus fisik — riwayat kuota
 * dan pesanan harus tetap utuh. Untuk kasus itu varian dinonaktifkan saja.
 */
export async function deleteVariant(variantId: string): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_CATALOG");
  } catch {
    return capabilityDeniedResult("MANAGE_CATALOG");
  }

  if (typeof variantId !== "string" || variantId.trim() === "") {
    return { ok: false, message: "Varian tidak dikenal." };
  }

  try {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        name: true,
        isActive: true,
        productId: true,
        product: { select: { slug: true } },
      },
    });
    if (!variant) {
      return { ok: false, message: "Varian tidak ditemukan (mungkin sudah dihapus)." };
    }

    const [quotaCount, orderItemCount] = await Promise.all([
      prisma.preOrderVariantQuota.count({ where: { variantId } }),
      prisma.orderItem.count({ where: { variantId } }),
    ]);

    if (quotaCount > 0 || orderItemCount > 0) {
      if (variant.isActive) {
        await prisma.productVariant.update({
          where: { id: variantId },
          data: { isActive: false },
        });
        revalidateProductDetail(variant.productId, variant.product.slug);
        return {
          ok: true,
          message:
            `Varian "${variant.name}" sudah dipakai kuota PO atau pesanan sehingga tidak bisa dihapus. ` +
            "Varian dinonaktifkan agar tidak bisa dipesan lagi.",
        };
      }

      return {
        ok: false,
        message:
          `Varian "${variant.name}" sudah dipakai kuota PO atau pesanan sehingga tidak bisa dihapus. ` +
          "Varian ini sudah dalam keadaan nonaktif.",
      };
    }

    await prisma.productVariant.delete({ where: { id: variantId } });

    revalidateProductDetail(variant.productId, variant.product.slug);

    return { ok: true, message: `Varian "${variant.name}" berhasil dihapus.` };
  } catch (error) {
    return serverErrorResult("deleteVariant", error);
  }
}
