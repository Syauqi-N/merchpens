"use client";

import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { ToggleActive } from "@/components/admin/toggle-active";
import { deleteBanner, toggleBannerActive } from "./actions";

/** Sakelar tampil/sembunyi pada baris tabel banner. */
export function BannerActiveToggle({
  id,
  title,
  isActive,
}: {
  id: string;
  title: string;
  isActive: boolean;
}) {
  return (
    <ToggleActive
      checked={isActive}
      label={`Status tampil banner ${title}`}
      activeText="Tampil"
      inactiveText="Disembunyikan"
      onToggle={(next) => toggleBannerActive(id, next)}
    />
  );
}

/** Tombol hapus + dialog konfirmasi pada baris tabel banner. */
export function BannerDeleteButton({ id, title }: { id: string; title: string }) {
  return (
    <ConfirmDeleteDialog
      title={`Hapus banner "${title}"?`}
      description="Banner akan dihapus permanen dari beranda. Tindakan ini tidak bisa dibatalkan."
      confirmLabel="Hapus"
      triggerLabel={`Hapus banner ${title}`}
      onConfirm={() => deleteBanner(id)}
    />
  );
}
