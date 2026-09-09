"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Keranjang belanja sisi klien (disimpan di localStorage).
 *
 * Seluruh produk dijual lewat periode pre-order berkuota PER VARIAN, jadi
 * setiap baris keranjang adalah (produk, varian, baris kuota) — kunci
 * identitasnya `variantQuotaId`.
 *
 * PENTING:
 * - `unitPrice` WAJIB diisi dengan `effectivePrice` varian dari
 *   `resolveVariantAvailability()`, bukan `product.price` — harga PO dan delta
 *   varian bisa beda.
 * - `maxQty` diisi dengan sisa kuota varian saat itu. Nilai ini hanya
 *   optimistik; kebenaran final tetap divalidasi ulang di server saat checkout
 *   (`reserveForOrder`).
 */

export type CartPickupPeriod = {
  id: string;
  name: string;
  endAt: string;
  estimatedPickupAt: string;
  pickupLocation: string;
  pickupSchedule: string;
  pickupNote: string;
  shippingNote: string;
};

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  /** Varian yang dipilih. */
  variantId: string;
  variantName: string;
  /** Harga satuan yang berlaku (hasil `resolveVariantAvailability`). */
  unitPrice: number;
  quantity: number;
  /** Baris kuota VARIAN periode PO yang dipakai. */
  variantQuotaId: string | null;
  /** Baris produk PO (info periode/batch). */
  preOrderItemId: string | null;
  /** Informasi periode; disegarkan dari server saat keranjang dibuka. */
  pickupPeriod: CartPickupPeriod | null;
  /** Batas maksimum yang boleh dipesan (sisa kuota varian). */
  maxQty: number;
  /** Satuan produk: pcs, pack, set, ... */
  unit: string;
};

/** Data item tanpa `quantity` — jumlahnya dikirim terpisah ke `addItem`. */
export type CartItemInput = Omit<CartItem, "quantity">;

export const GUEST_CART_OWNER = "guest";

/** Kunci identitas satu baris keranjang. */
export function cartItemKey(item: Pick<CartItem, "variantQuotaId" | "productId" | "variantId">): string {
  return item.variantQuotaId ?? `${item.productId}:${item.variantId}`;
}

type PersistedCartState = {
  items: CartItem[];
  /**
   * Pemilik data keranjang di browser ini.
   *
   * `null` hanya dipakai sebelum sinkronisasi session pertama. Guest memakai
   * nilai eksplisit agar keranjangnya bisa diteruskan ketika login.
   */
  ownerKey: string | null;
};

export type CartState = {
  items: CartItem[];
  ownerKey: string | null;
  /**
   * Menyesuaikan keranjang dengan session aktif.
   *
   * Keranjang guest diteruskan saat login. Pergantian dari satu akun ke akun
   * lain (termasuk logout) menghapus isi agar data tidak bocor lintas akun.
   */
  syncOwner: (ownerKey: string) => void;
  /** Tambah item baru atau menambah jumlahnya bila sudah ada. Selalu dibatasi `maxQty`. */
  addItem: (item: CartItemInput, quantity?: number) => void;
  removeItem: (key: { variantQuotaId?: string | null; productId: string; variantId: string }) => void;
  /** Set jumlah baris. Jumlah <= 0 menghapus baris tersebut. */
  updateQuantity: (
    key: { variantQuotaId?: string | null; productId: string; variantId: string },
    quantity: number,
  ) => void;
  clear: () => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const sameKey =
  (key: { variantQuotaId?: string | null; productId: string; variantId: string }) =>
  (item: CartItem): boolean =>
    cartItemKey(item) ===
    (key.variantQuotaId ?? `${key.productId}:${key.variantId}`);

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      ownerKey: null,

      syncOwner: (ownerKey) =>
        set((state) => {
          if (state.ownerKey === ownerKey) return state;

          // Item yang dipilih sebelum login tetap dibawa ke akun yang dipakai
          // untuk checkout. Selain transisi guest -> user, keranjang dibersihkan.
          if (state.ownerKey === null || state.ownerKey === GUEST_CART_OWNER) {
            return { ownerKey };
          }

          return { items: [], ownerKey };
        }),

      addItem: (item, quantity = 1) =>
        set((state) => {
          const maxQty = Math.max(0, Math.floor(item.maxQty));
          if (maxQty <= 0) return state;

          const requested = Math.max(1, Math.floor(quantity));
          const key = cartItemKey(item);
          const existing = state.items.find((i) => cartItemKey(i) === key);

          if (!existing) {
            return {
              items: [
                ...state.items,
                { ...item, maxQty, quantity: clamp(requested, 1, maxQty) },
              ],
            };
          }

          return {
            items: state.items.map((i) =>
              cartItemKey(i) === key
                ? {
                    // Data selalu di-refresh dengan yang terbaru
                    // (harga & sisa kuota bisa berubah sejak item dimasukkan).
                    ...i,
                    ...item,
                    maxQty,
                    quantity: clamp(i.quantity + requested, 1, maxQty),
                  }
                : i,
            ),
          };
        }),

      removeItem: (key) =>
        set((state) => ({
          items: state.items.filter((i) => !sameKey(key)(i)),
        })),

      updateQuantity: (key, quantity) =>
        set((state) => {
          const next = Math.floor(quantity);
          if (next <= 0) {
            return { items: state.items.filter((i) => !sameKey(key)(i)) };
          }
          return {
            items: state.items.map((i) =>
              sameKey(key)(i)
                ? { ...i, quantity: clamp(next, 1, Math.max(1, i.maxQty)) }
                : i,
            ),
          };
        }),

      clear: () => set({ items: [] }),
    }),
    {
      name: "merch-cart",
      version: 4,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedCartState => ({
        items: state.items,
        ownerKey: state.ownerKey,
      }),
      // Skema baris berubah (kunci varian). Kosongkan sekali saat upgrade agar
      // keranjang lama tidak salah terbaca.
      migrate: (): PersistedCartState => ({ items: [], ownerKey: null }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

/** Total banyaknya barang (menjumlahkan quantity semua baris). */
export const selectTotalItems = (state: CartState): number =>
  state.items.reduce((total, item) => total + item.quantity, 0);

/** Subtotal keranjang dalam rupiah. */
export const selectSubtotal = (state: CartState): number =>
  state.items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);

/** Jumlah satu varian yang sudah ada di keranjang (0 bila belum ada). */
export const selectItemQuantity =
  (key: { variantQuotaId?: string | null; productId: string; variantId: string }) =>
  (state: CartState): number =>
    state.items.find((item) => sameKey(key)(item))?.quantity ?? 0;

/** Hook praktis: total banyaknya barang di keranjang. */
export function useCartTotalItems(): number {
  return useCartStore(selectTotalItems);
}

/** Hook praktis: subtotal keranjang. */
export function useCartSubtotal(): number {
  return useCartStore(selectSubtotal);
}

/**
 * True setelah isi keranjang selesai dibaca dari localStorage.
 *
 * Render pertama di server/klien selalu memakai keranjang kosong, jadi angka
 * apa pun yang berasal dari keranjang harus disembunyikan sampai hook ini
 * bernilai true agar tidak terjadi hydration mismatch.
 */
export function useCartHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToHydration,
    () => useCartStore.persist.hasHydrated(),
    // Snapshot server: keranjang selalu dianggap kosong saat render pertama.
    () => false,
  );
}

function subscribeToHydration(onStoreChange: () => void): () => void {
  return useCartStore.persist.onFinishHydration(onStoreChange);
}
