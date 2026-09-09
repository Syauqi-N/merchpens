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
import { categoryFormSchema } from "./schemas";

function revalidateCategories() {
  revalidatePath("/admin/kategori");
  revalidatePath("/admin/produk");
  revalidatePath("/produk");
  revalidatePath("/");
}

/** Menambah kategori baru. */
export async function createCategory(input: unknown): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_CATALOG");
  } catch {
    return capabilityDeniedResult("MANAGE_CATALOG");
  }

  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const data = parsed.data;

  try {
    const slugTaken = await prisma.category.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (slugTaken) {
      return {
        ok: false,
        message: "Slug sudah dipakai kategori lain.",
        fieldErrors: { slug: "Slug sudah dipakai kategori lain" },
      };
    }

    const category = await prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description === "" ? null : data.description,
        imageUrl: data.imageUrl === "" ? null : data.imageUrl,
        sortOrder: data.sortOrder === "" ? 0 : Number(data.sortOrder),
        isActive: data.isActive,
      },
      select: { id: true, name: true },
    });

    revalidateCategories();

    return {
      ok: true,
      message: `Kategori "${category.name}" berhasil ditambahkan.`,
      id: category.id,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        message: "Slug sudah dipakai kategori lain.",
        fieldErrors: { slug: "Slug sudah dipakai kategori lain" },
      };
    }
    return serverErrorResult("createCategory", error);
  }
}

/** Mengubah kategori. */
export async function updateCategory(id: string, input: unknown): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_CATALOG");
  } catch {
    return capabilityDeniedResult("MANAGE_CATALOG");
  }

  if (typeof id !== "string" || id.trim() === "") {
    return { ok: false, message: "Kategori tidak dikenal." };
  }

  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const data = parsed.data;

  try {
    const existing = await prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return { ok: false, message: "Kategori tidak ditemukan (mungkin sudah dihapus)." };
    }

    const slugOwner = await prisma.category.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (slugOwner && slugOwner.id !== id) {
      return {
        ok: false,
        message: "Slug sudah dipakai kategori lain.",
        fieldErrors: { slug: "Slug sudah dipakai kategori lain" },
      };
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description === "" ? null : data.description,
        imageUrl: data.imageUrl === "" ? null : data.imageUrl,
        sortOrder: data.sortOrder === "" ? 0 : Number(data.sortOrder),
        isActive: data.isActive,
      },
      select: { name: true },
    });

    revalidateCategories();

    return { ok: true, message: `Kategori "${category.name}" tersimpan.`, id };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        message: "Slug sudah dipakai kategori lain.",
        fieldErrors: { slug: "Slug sudah dipakai kategori lain" },
      };
    }
    return serverErrorResult("updateCategory", error);
  }
}

/**
 * Menghapus kategori.
 *
 * Kategori yang masih dipakai produk tidak langsung dihapus agar admin tidak
 * tanpa sengaja membuat produk kehilangan klasifikasi. Lepaskan relasinya dari
 * tiap produk terlebih dahulu; produk boleh tetap punya kategori lain.
 */
export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    await requireCapability("MANAGE_CATALOG");
  } catch {
    return capabilityDeniedResult("MANAGE_CATALOG");
  }

  if (typeof id !== "string" || id.trim() === "") {
    return { ok: false, message: "Kategori tidak dikenal." };
  }

  try {
    const category = await prisma.category.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { products: true } } },
    });
    if (!category) {
      return { ok: false, message: "Kategori tidak ditemukan (mungkin sudah dihapus)." };
    }

    if (category._count.products > 0) {
      return {
        ok: false,
        message: `Kategori "${category.name}" masih dipakai ${category._count.products} produk. Lepaskan kategori ini dari produk-produk tersebut terlebih dahulu.`,
      };
    }

    await prisma.category.delete({ where: { id } });

    revalidateCategories();

    return { ok: true, message: `Kategori "${category.name}" berhasil dihapus.` };
  } catch (error) {
    return serverErrorResult("deleteCategory", error);
  }
}

/** Mengaktifkan / menonaktifkan kategori. */
export async function toggleCategoryActive(
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
    const category = await prisma.category.update({
      where: { id },
      data: { isActive },
      select: { name: true },
    });

    revalidateCategories();

    return {
      ok: true,
      message: isActive
        ? `Kategori "${category.name}" diaktifkan.`
        : `Kategori "${category.name}" dinonaktifkan.`,
    };
  } catch (error) {
    return serverErrorResult("toggleCategoryActive", error);
  }
}
