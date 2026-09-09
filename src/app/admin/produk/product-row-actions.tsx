"use client";

import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { ToggleActive } from "@/components/admin/toggle-active";
import { deleteProduct, toggleProductActive } from "./actions";

/** Sakelar aktif/nonaktif pada baris tabel produk. */
export function ProductActiveToggle({
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
      label={`Status aktif produk ${name}`}
      onToggle={(next) => toggleProductActive(id, next)}
    />
  );
}

/** Tombol hapus + dialog konfirmasi pada baris tabel produk. */
export function ProductDeleteButton({
  id,
  name,
  usedInOrders,
}: {
  id: string;
  name: string;
  /** Produk yang pernah dipesan hanya bisa dinonaktifkan, tidak dihapus. */
  usedInOrders: boolean;
}) {
  return (
    <ConfirmDeleteDialog
      title={usedInOrders ? `Nonaktifkan "${name}"?` : `Hapus "${name}"?`}
      description={
        usedInOrders
          ? "Produk ini sudah pernah masuk pesanan, jadi tidak bisa dihapus agar riwayat pesanan pelanggan tetap utuh. Produk akan dinonaktifkan sehingga tidak muncul di katalog."
          : "Produk beserta gambarnya akan dihapus permanen. Baris kuota produk ini pada periode pre-order juga ikut terhapus. Tindakan ini tidak bisa dibatalkan."
      }
      confirmLabel={usedInOrders ? "Nonaktifkan" : "Hapus"}
      triggerLabel={usedInOrders ? `Nonaktifkan ${name}` : `Hapus ${name}`}
      onConfirm={() => deleteProduct(id)}
    />
  );
}
