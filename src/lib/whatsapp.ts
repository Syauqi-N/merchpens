/** Normalisasi nomor Indonesia/internasional untuk URL wa.me. */
export function normalizeWhatsAppNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string, message: string): string | null {
  const normalized = normalizeWhatsAppNumber(phone);
  if (normalized.length < 8) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildShippingMessage(input: {
  orderNumber: string;
  customerName: string;
  customerType?: string | null;
  items: Array<{ name: string; variantName?: string | null; quantity: number }>;
  totalLabel: string;
  address: string;
}): string {
  const itemLines = input.items.map(
    (item) =>
      `- ${item.name}${item.variantName ? ` (${item.variantName})` : ""} x${item.quantity}`,
  );
  return [
    "Halo Admin Merch PENS,",
    `Saya ${input.customerName}${input.customerType ? ` (${input.customerType})` : ""}.`,
    `Pesanan ${input.orderNumber} sudah saya bayar via payment gateway.`,
    "Detail pesanan:",
    ...itemLines,
    `Total sudah dibayar: ${input.totalLabel}`,
    `Alamat pengiriman: ${input.address}`,
    "Mohon info total ongkir dan nomor rekening/e-wallet untuk pembayaran ongkir. Terima kasih.",
  ].join("\n");
}
