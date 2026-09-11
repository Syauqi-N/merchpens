"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarClockIcon,
  ImageIcon,
  InfoIcon,
  LoaderCircleIcon,
  LockIcon,
  MapPinIcon,
  MessageCircleIcon,
  PackageIcon,
  ShoppingCartIcon,
  StoreIcon,
  TriangleAlertIcon,
  TruckIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useCartSync } from "@/components/cart/use-cart-sync";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatRupiah } from "@/lib/format";
// Tipe saja — `@/lib/settings` adalah modul `server-only`, jadi impornya WAJIB
// `import type` supaya benar-benar terhapus dan tidak ikut ke bundel klien.
import type { MasterLists, PickupInfo } from "@/lib/settings";
import {
  cartItemKey,
  selectSubtotal,
  useCartStore,
  type CartPickupPeriod,
} from "@/store/cart";
import { createOrderAndPay } from "./actions";
import { checkoutFormSchema, type CheckoutFormValues } from "./schemas";
import { TransactionTermsDialog } from "./terms-dialog";

export function CheckoutForm({
  defaults,
  pickup,
  master,
}: {
  defaults: CheckoutFormValues;
  pickup: PickupInfo;
  master: MasterLists;
}) {
  const router = useRouter();

  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore(selectSubtotal);
  const clearCart = useCartStore((state) => state.clear);

  const { hydrated, checking, warnings, recheck } = useCartSync();

  const [formError, setFormError] = useState<string | null>(null);
  const [itemMessages, setItemMessages] = useState<string[]>([]);
  const [redirecting, setRedirecting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: defaults,
  });

  // Ongkir kirim dibayar MANUAL via WhatsApp admin → total gateway = subtotal.
  const total = subtotal;
  const busy = isSubmitting || redirecting || checking;
  const pickupPeriods = [
    ...new Map(
      items
        .filter(
          (item): item is typeof item & { pickupPeriod: CartPickupPeriod } =>
            Boolean(item.pickupPeriod),
        )
        .map((item) => [item.pickupPeriod.id, item.pickupPeriod]),
    ).values(),
  ];
  const fulfillmentType = useWatch({ control, name: "fulfillmentType" });

  async function onSubmit(values: CheckoutFormValues) {
    setFormError(null);
    setItemMessages([]);

    const cartItems = useCartStore.getState().items;
    if (cartItems.length === 0) {
      setFormError("Keranjang kosong. Tambahkan produk terlebih dahulu.");
      return;
    }

    let result;
    try {
      result = await createOrderAndPay({
        ...values,
        items: cartItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          variantQuotaId: item.variantQuotaId,
          quantity: item.quantity,
        })),
      });
    } catch {
      setFormError("Pesanan gagal diproses. Periksa koneksi lalu coba lagi.");
      return;
    }

    if (result.ok) {
      // Keranjang dikosongkan sebelum meninggalkan aplikasi: kuotanya sudah
      // terkunci di pesanan, jadi menyimpannya hanya bikin pesanan ganda.
      clearCart();
      setRedirecting(true);

      toast.success("Pesanan dibuat", {
        description: `Nomor pesanan ${result.orderNumber}. Mengarahkan ke halaman pembayaran...`,
      });
      // Duitku adalah domain lain → keluar dari router Next.js.
      window.location.assign(result.paymentUrl);
      return;
    }

    if (result.code === "UNAUTHENTICATED") {
      toast.error(result.message);
      router.push(`/masuk?callbackUrl=${encodeURIComponent("/checkout")}`);
      return;
    }

    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (message) {
          setError(field as keyof CheckoutFormValues, { type: "server", message });
        }
      }
    }

    setFormError(result.message);
    setItemMessages(result.itemMessages ?? []);

    if (result.code === "AVAILABILITY" || result.code === "EMPTY_CART") {
      // Selaraskan keranjang supaya angka yang dilihat pengguna sesuai server.
      void recheck();
    }
  }

  if (!hydrated) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardContent className="space-y-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-11 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCartIcon />}
        title="Tidak ada yang bisa di-checkout"
        description="Keranjang kamu kosong. Tambahkan produk terlebih dahulu sebelum melanjutkan ke pembayaran."
        action={
          <Button
            className="bg-gold text-obsidian hover:bg-gold-light"
            nativeButton={false}
            render={<Link href="/produk" />}
          >
            Lihat Produk
          </Button>
        }
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
    >
      <div className="space-y-4">
        {warnings.length > 0 && (
          <Alert variant="destructive" className="border-gold/30 bg-gold/10">
            <TriangleAlertIcon aria-hidden />
            <AlertTitle className="text-gold-light">
              Keranjang disesuaikan dengan ketersediaan terbaru
            </AlertTitle>
            <AlertDescription>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-gold-light/90">
                {warnings.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {formError && (
          <Alert variant="destructive">
            <TriangleAlertIcon aria-hidden />
            <AlertTitle>Pesanan belum bisa diproses</AlertTitle>
            <AlertDescription>
              <p>{formError}</p>
              {itemMessages.length > 0 && (
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {itemMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}

        <PickupInfoCard pickup={pickup} periods={pickupPeriods} />

        <Card>
          <CardContent className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-cream">Data Pemesan</h2>
              <p className="text-sm text-cream-muted">
                Data ini dipakai panitia untuk rekap dan menghubungimu. Pastikan
                nomor WhatsApp aktif.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="customerName"
                label="Nama lengkap"
                error={errors.customerName?.message}
              >
                <Input
                  id="customerName"
                  autoComplete="name"
                  placeholder="Nama lengkap"
                  aria-invalid={Boolean(errors.customerName)}
                  className="h-10"
                  {...register("customerName")}
                />
              </Field>

              <Field
                id="customerPhone"
                label="Nomor WhatsApp"
                error={errors.customerPhone?.message}
              >
                <Input
                  id="customerPhone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="08xxxxxxxxxx"
                  aria-invalid={Boolean(errors.customerPhone)}
                  className="h-10"
                  {...register("customerPhone")}
                />
              </Field>
            </div>

            <Field id="customerEmail" label="Email" error={errors.customerEmail?.message}>
              <Input
                id="customerEmail"
                type="email"
                autoComplete="email"
                placeholder="nama@email.com"
                aria-invalid={Boolean(errors.customerEmail)}
                className="h-10"
                {...register("customerEmail")}
              />
            </Field>

            <div>
              <Label className="mb-2 block">Status</Label>
              <Controller
                name="customerType"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    {(
                      [
                        { value: "MAHASISWA", label: "Mahasiswa PENS" },
                        { value: "ALUMNI", label: "Alumni PENS" },
                      ] as const
                    ).map((option) => (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3.5 transition-colors ${
                          field.value === option.value
                            ? "border-gold bg-gold/10 ring-2 ring-gold/20"
                            : "border-white/10 hover:border-[#3A3A3A]"
                        }`}
                      >
                        <RadioGroupItem value={option.value} />
                        <span className="text-sm font-semibold text-cream">
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                )}
              />
              {errors.customerType?.message && (
                <p className="mt-1.5 text-xs text-red-400">
                  {errors.customerType.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="customerBatch">Angkatan</Label>
                <Controller
                  name="customerBatch"
                  control={control}
                  render={({ field }) => (
                    <Select
                      items={master.angkatan.map((year) => ({ value: year, label: year }))}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger id="customerBatch" className="h-10 w-full">
                        <SelectValue placeholder="Pilih angkatan">
                          {field.value || undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {master.angkatan.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.customerBatch?.message && (
                  <p className="text-xs text-red-400">{errors.customerBatch.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="customerProgram">Jurusan</Label>
                <Controller
                  name="customerProgram"
                  control={control}
                  render={({ field }) => (
                    <Select
                      items={master.jurusan.map((major) => ({ value: major, label: major }))}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger id="customerProgram" className="h-10 w-full">
                        <SelectValue placeholder="Pilih jurusan">
                          {field.value || undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {master.jurusan.map((major) => (
                          <SelectItem key={major} value={major}>
                            {major}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.customerProgram?.message && (
                  <p className="text-xs text-red-400">{errors.customerProgram.message}</p>
                )}
              </div>
            </div>

            <Field
              id="note"
              label="Catatan untuk panitia (opsional)"
              error={errors.note?.message}
            >
              <Textarea
                id="note"
                rows={2}
                placeholder="Contoh: titip diambilkan teman sekelas"
                aria-invalid={Boolean(errors.note)}
                {...register("note")}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-cream">
                Cara Terima Barang
              </h2>
              <p className="text-sm text-cream-muted">
                Ongkir kirim <strong>tidak termasuk</strong> di pembayaran ini dan
                dibayar manual via WhatsApp admin setelah pesanan lunas.
              </p>
            </div>

            <Controller
              name="fulfillmentType"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                  className="grid gap-3"
                >
                  <label
                    className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                      field.value === "PICKUP"
                        ? "border-gold bg-gold/10 ring-2 ring-gold/20"
                        : "border-white/10 hover:border-[#3A3A3A]"
                    }`}
                  >
                    <RadioGroupItem value="PICKUP" className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-semibold text-cream">
                        <StoreIcon className="size-4 text-gold" aria-hidden />
                        Ambil di kampus
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-cream-muted">
                        Gratis. Ambil sendiri sesuai jadwal pengambilan.
                      </span>
                    </span>
                  </label>

                  <label
                    className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                      field.value === "SHIPPED"
                        ? "border-gold bg-gold/10 ring-2 ring-gold/20"
                        : "border-white/10 hover:border-[#3A3A3A]"
                    }`}
                  >
                    <RadioGroupItem value="SHIPPED" className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-semibold text-cream">
                        <TruckIcon className="size-4 text-gold" aria-hidden />
                        Kirim ke alamat
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-cream-muted">
                        Ongkir dibayar terpisah via WhatsApp admin setelah pesanan
                        lunas.
                      </span>
                    </span>
                  </label>
                </RadioGroup>
              )}
            />
            {errors.fulfillmentType?.message && (
              <p className="text-xs text-red-400">{errors.fulfillmentType.message}</p>
            )}

            {fulfillmentType === "SHIPPED" && (
              <Field
                id="shippingAddress"
                label="Alamat pengiriman lengkap"
                error={errors.shippingAddress?.message}
              >
                <Textarea
                  id="shippingAddress"
                  rows={3}
                  placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan, kecamatan, kota, kode pos"
                  aria-invalid={Boolean(errors.shippingAddress)}
                  {...register("shippingAddress")}
                />
              </Field>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-24">
        <CardContent className="space-y-4">
          <h2 className="text-base font-semibold text-cream">Ringkasan Pesanan</h2>

          <ul className="space-y-3">
            {items.map((item) => (
              <li key={cartItemKey(item)} className="flex gap-3">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-raise ring-1 ring-white/10">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      width={48}
                      height={48}
                      className="size-12 object-cover"
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-[#8A8A8A]">
                      <ImageIcon className="size-4" aria-hidden />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-cream">
                    {item.name}
                  </p>
                  <p className="text-xs font-medium text-gold">{item.variantName}</p>
                  <p className="text-xs text-cream-muted">
                    {item.quantity} {item.unit} &times; {formatRupiah(item.unitPrice)}
                  </p>
                </div>

                <span className="text-sm font-semibold text-cream tabular-nums">
                  {formatRupiah(item.unitPrice * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <Separator />

          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-cream-muted">Subtotal</dt>
              <dd className="font-medium text-cream tabular-nums">
                {formatRupiah(subtotal)}
              </dd>
            </div>
          </dl>

          <Separator />

          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-[#D8D3C7]">Total tagihan</span>
            <span className="text-xl font-bold text-gold tabular-nums">
              {formatRupiah(total)}
            </span>
          </div>

          <div className="flex gap-2 rounded-lg bg-gold/10 p-3 text-xs text-gold-light">
            <MessageCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Batas bayar <strong>60 menit</strong>. Lewat dari itu pesanan
              otomatis kadaluarsa dan kuotanya dilepas.
            </p>
          </div>

          <div className="flex gap-2 rounded-lg bg-gold/10 p-3 text-xs text-gold-light">
            <PackageIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Ini adalah pesanan <strong>pre-order</strong>. Barang diproduksi
              setelah periode PO ditutup.
            </p>
          </div>

          <Controller
            name="termsAccepted"
            control={control}
            render={({ field }) => (
              <div className="space-y-1.5">
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/10 p-3 text-xs leading-5 text-[#D8D3C7]">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    aria-invalid={Boolean(errors.termsAccepted)}
                    className="mt-0.5"
                  />
                  <span>
                    Saya wajib menyetujui <TransactionTermsDialog />.
                  </span>
                </label>
                {errors.termsAccepted?.message && (
                  <p className="text-xs text-red-400">
                    {errors.termsAccepted.message}
                  </p>
                )}
              </div>
            )}
          />

          <Button
            type="submit"
            size="lg"
            disabled={busy}
            className="h-11 w-full bg-gold text-obsidian hover:bg-gold-light"
          >
            {busy ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden />
            ) : (
              <LockIcon className="size-5" aria-hidden />
            )}
            {redirecting || isSubmitting ? "Memproses pesanan..." : "Bayar Sekarang"}
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-cream-muted">
            <LockIcon className="size-3" aria-hidden />
            Pembayaran aman via Duitku (QRIS / VA / e-wallet).
          </p>

          <Button
            variant="ghost"
            size="lg"
            className="w-full text-cream-muted hover:text-cream"
            nativeButton={false}
            render={<Link href="/keranjang" />}
          >
            Kembali ke keranjang
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

/**
 * Kartu read-only berisi tempat, jadwal, dan catatan pengambilan/pengiriman.
 *
 * Sengaja ditaruh DI ATAS form identitas: pembeli harus tahu lebih dulu cara
 * terima barang sebelum mengisi data dirinya.
 */
function PickupInfoCard({
  pickup,
  periods,
}: {
  pickup: PickupInfo;
  periods: CartPickupPeriod[];
}) {
  return (
    <Card className="border-gold/30 bg-gold/10/60">
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-gold text-obsidian"
          >
            <StoreIcon className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-cream">
              Informasi Terima Barang
            </h2>
            <p className="text-sm text-[#D8D3C7]">
              Pilih <strong>ambil di kampus</strong> atau{" "}
              <strong>kirim ke alamat</strong> (ongkir manual via WhatsApp admin)
              sesuai estimasi masing-masing periode PO.
            </p>
          </div>
        </div>

        {periods.length > 0 ? (
          <div className="space-y-3">
            {periods.map((period) => (
              <section
                key={period.id}
                className="space-y-3 rounded-xl bg-obsidian/80 p-3 ring-1 ring-gold/30"
              >
                <h3 className="text-sm font-semibold text-gold-light">
                  {period.name}
                </h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <PickupDetail
                    icon={<CalendarClockIcon className="size-4" aria-hidden />}
                    label="Estimasi mulai bisa diambil"
                    value={formatDateTime(period.estimatedPickupAt)}
                  />
                  <PickupDetail
                    icon={<MapPinIcon className="size-4" aria-hidden />}
                    label="Tempat pengambilan"
                    value={period.pickupLocation}
                  />
                  <PickupDetail
                    icon={<CalendarClockIcon className="size-4" aria-hidden />}
                    label="Jadwal pengambilan"
                    value={period.pickupSchedule}
                  />
                </dl>
                {period.pickupNote.trim() !== "" && (
                  <div className="flex gap-2 rounded-lg bg-gold/10 p-3 text-xs text-[#D8D3C7]">
                    <InfoIcon
                      className="mt-0.5 size-4 shrink-0 text-gold"
                      aria-hidden
                    />
                    <p>{period.pickupNote}</p>
                  </div>
                )}
                {period.shippingNote.trim() !== "" && (
                  <div className="flex gap-2 rounded-lg bg-gold/10 p-3 text-xs text-[#D8D3C7]">
                    <TruckIcon
                      className="mt-0.5 size-4 shrink-0 text-gold-deep"
                      aria-hidden
                    />
                    <p>{period.shippingNote}</p>
                  </div>
                )}
              </section>
            ))}
          </div>
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <PickupDetail
                icon={<MapPinIcon className="size-4" aria-hidden />}
                label="Tempat pengambilan"
                value={pickup.location}
              />
              <PickupDetail
                icon={<CalendarClockIcon className="size-4" aria-hidden />}
                label="Jadwal pengambilan"
                value={pickup.schedule}
              />
            </dl>

            {pickup.note.trim() !== "" && (
              <div className="flex gap-2 rounded-lg bg-obsidian/80 p-3 text-xs text-[#D8D3C7] ring-1 ring-gold/30">
                <InfoIcon
                  className="mt-0.5 size-4 shrink-0 text-gold"
                  aria-hidden
                />
                <p>{pickup.note}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PickupDetail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 shrink-0 text-gold">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-cream-muted">{label}</dt>
        <dd className="text-sm font-medium text-cream">{value}</dd>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
