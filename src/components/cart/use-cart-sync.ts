"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { revalidateCart } from "@/app/keranjang/actions";
import type { RevalidateCartResult } from "@/app/keranjang/types";
import { cartItemKey, useCartHydrated, useCartStore, type CartItem } from "@/store/cart";

export type CartSyncState = {
  /** true setelah keranjang selesai dibaca dari localStorage. */
  hydrated: boolean;
  /** true selama pemeriksaan ke server berjalan. */
  checking: boolean;
  /** Peringatan siap tampil dari pemeriksaan terakhir. */
  warnings: string[];
  /** Waktu pemeriksaan terakhir (null bila belum pernah). */
  checkedAt: Date | null;
  /** Terjadi kegagalan jaringan/server saat memeriksa. */
  failed: boolean;
  /** Memeriksa ulang secara manual (mis. tombol "Periksa ketersediaan"). */
  recheck: () => Promise<RevalidateCartResult | null>;
};

/**
 * Menyelaraskan keranjang localStorage dengan kebenaran versi server.
 *
 * Keranjang bisa mengendap berhari-hari di browser: harga PO berubah, periode
 * PO tutup, atau kuota habis dipesan orang lain. Hook ini memeriksa sekali
 * setelah hidrasi, lalu MENIMPA baris keranjang dengan data terbaru
 * (harga, sisa kuota, id PreOrderItem) dan mengeluarkan item yang sudah tidak
 * bisa dipesan.
 *
 * Catatan: ini hanya lapisan pengalaman pengguna. Kebenaran final tetap
 * ditegakkan `reserveForOrder()` di dalam transaksi checkout.
 */
export function useCartSync(): CartSyncState {
  const hydrated = useCartHydrated();
  const [checking, setChecking] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [failed, setFailed] = useState(false);

  // Menahan pemeriksaan ganda dari StrictMode / render ulang.
  const inFlight = useRef(false);
  const didInitialCheck = useRef(false);

  const recheck = useCallback(async (): Promise<RevalidateCartResult | null> => {
    if (inFlight.current) return null;

    const items = useCartStore.getState().items;
    if (items.length === 0) {
      setWarnings([]);
      setFailed(false);
      setCheckedAt(new Date());
      return {
        ok: true,
        checkedAt: new Date().toISOString(),
        lines: [],
        messages: [],
        emptied: true,
      };
    }

    inFlight.current = true;
    setChecking(true);

    try {
      const result = await revalidateCart(
        items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          variantQuotaId: item.variantQuotaId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      );

      const byKey = new Map(result.lines.map((line) => [line.variantQuotaId ?? `${line.productId}:${line.variantId}`, line]));

      // Zustand `setState` tetap melewati middleware `persist`, jadi hasil
      // koreksi ikut tersimpan ke localStorage.
      useCartStore.setState((state) => ({
        items: state.items.reduce<CartItem[]>((next, item) => {
          const line = byKey.get(cartItemKey(item));
          if (!line) {
            next.push(item); // tidak ikut diperiksa — biarkan apa adanya
            return next;
          }
          if (!line.fresh || line.allowedQuantity <= 0) return next; // keluarkan

          next.push({
            ...item,
            ...line.fresh,
            quantity: Math.max(1, Math.min(item.quantity, line.allowedQuantity)),
          });
          return next;
        }, []),
      }));

      setWarnings(result.messages);
      setFailed(false);
      setCheckedAt(new Date(result.checkedAt));
      return result;
    } catch (error) {
      console.error("[useCartSync] gagal memeriksa keranjang:", error);
      setFailed(true);
      return null;
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || didInitialCheck.current) return;
    didInitialCheck.current = true;
    void recheck();
  }, [hydrated, recheck]);

  return { hydrated, checking, warnings, checkedAt, failed, recheck };
}
