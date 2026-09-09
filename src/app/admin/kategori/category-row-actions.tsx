"use client";

import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { ToggleActive } from "@/components/admin/toggle-active";
import { deleteCategory, toggleCategoryActive } from "./actions";

/** Sakelar aktif/nonaktif pada baris tabel kategori. */
export function CategoryActiveToggle({
  id,
  name,
  isActive,
}: {
  id: string;
  name: string;
  isActive: boolean;
}) {
  return (
    <ToggleActive
      checked={isActive}
      label={`Status aktif kategori ${name}`}
      onToggle={(next) => toggleCategoryActive(id, next)}
    />
  );
}

/** Tombol hapus + dialog konfirmasi pada baris tabel kategori. */
export function CategoryDeleteButton({
  id,
  name,
  productCount,
}: {
  id: string;
  name: string;
  productCount: number;
}) {
  const hasProducts = productCount > 0;

  return (
    <ConfirmDeleteDialog
      title={`Hapus kategori "${name}"?`}
      description={
        hasProducts
          ? `Kategori ini masih dipakai ${productCount} produk sehingga tidak bisa dihapus. Pindahkan produknya ke kategori lain terlebih dahulu.`
          : "Kategori akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
      }
      confirmLabel="Hapus"
      triggerLabel={`Hapus kategori ${name}`}
      onConfirm={() => deleteCategory(id)}
    />
  );
}
