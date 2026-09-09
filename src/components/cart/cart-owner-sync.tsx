"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

import { GUEST_CART_OWNER, useCartStore } from "@/store/cart";

/**
 * Menjaga localStorage keranjang tetap selaras dengan akun yang sedang aktif.
 * Komponen ini tidak merender UI dan dipasang sekali di provider aplikasi.
 */
export function CartOwnerSync() {
  const { data: session, status } = useSession();
  const syncOwner = useCartStore((state) => state.syncOwner);

  useEffect(() => {
    if (status === "loading") return;

    const ownerKey = session?.user.id
      ? `user:${session.user.id}`
      : GUEST_CART_OWNER;

    syncOwner(ownerKey);
  }, [session?.user.id, status, syncOwner]);

  return null;
}
