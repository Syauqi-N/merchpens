"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  EyeIcon,
  EyeOffIcon,
  LoaderCircleIcon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { FormField } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Role } from "@/generated/prisma/client";
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/permissions";
import { createStaff } from "./actions";
import {
  createStaffSchema,
  emptyCreateStaffValues,
  type CreateStaffValues,
} from "./schemas";

const inputClass = "h-10";

const ROLE_ITEMS = ASSIGNABLE_ROLES.map((role) => ({
  value: role as string,
  label: ROLE_LABEL[role],
}));

/**
 * Dialog "Tambah Pengurus".
 *
 * Validasinya memakai skema yang sama persis dengan Server Action-nya, jadi
 * yang lolos di layar pasti lolos di server — dan sebaliknya, mematikan
 * JavaScript tidak membuka celah apa pun karena server memvalidasi ulang.
 */
export function UserFormDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateStaffValues>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: emptyCreateStaffValues(),
  });

  // useWatch (bukan watch() dari useForm) supaya React Compiler tetap bisa
  // memoize komponen ini — watch() mengembalikan fungsi yang tidak aman dimemoize.
  const selectedRole = useWatch({ control, name: "role" });

  function handleOpenChange(next: boolean) {
    if (next) {
      reset(emptyCreateStaffValues());
      setShowPassword(false);
    }
    setOpen(next);
  }

  async function onSubmit(values: CreateStaffValues) {
    const result = await createStaff(values);

    if (result.ok) {
      toast.success(result.message);
      setOpen(false);
      router.refresh();
      return;
    }

    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        setError(field as keyof CreateStaffValues, { type: "server", message });
      }
    }
    toast.error(result.message);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button className="h-10 gap-1.5 bg-gold text-obsidian hover:bg-gold-light" />}
      >
        <UserPlusIcon className="size-4" aria-hidden />
        Tambah Pengurus
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader className="mb-4">
          <DialogTitle>Tambah Pengurus</DialogTitle>
          <DialogDescription>
            Buatkan akun untuk pengurus baru. Kamu yang menentukan kata sandi
            pertamanya — sampaikan lewat jalur pribadi, lalu minta dia menggantinya
            sendiri setelah berhasil masuk.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField
            label="Nama lengkap"
            htmlFor="staff-name"
            required
            error={errors.name?.message}
          >
            <Input
              id="staff-name"
              className={inputClass}
              placeholder="Contoh: Rani Puspita"
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
          </FormField>

          <FormField
            label="Email"
            htmlFor="staff-email"
            required
            error={errors.email?.message}
            hint="Dipakai untuk masuk. Satu email hanya bisa dipakai satu akun."
          >
            <Input
              id="staff-email"
              type="email"
              className={inputClass}
              placeholder="nama@kampus.ac.id"
              autoComplete="off"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
          </FormField>

          <FormField
            label="Nomor telepon"
            htmlFor="staff-phone"
            error={errors.phone?.message}
            hint="Opsional. Memudahkan menghubunginya saat ada pesanan mendesak."
          >
            <Input
              id="staff-phone"
              inputMode="tel"
              className={inputClass}
              placeholder="08xxxxxxxxxx"
              autoComplete="off"
              aria-invalid={Boolean(errors.phone)}
              {...register("phone")}
            />
          </FormField>

          <FormField
            label="Kata sandi pertama"
            htmlFor="staff-password"
            required
            error={errors.password?.message}
            hint="Minimal 8 karakter."
          >
            <div className="flex gap-2">
              <Input
                id="staff-password"
                type={showPassword ? "text" : "password"}
                className={inputClass}
                placeholder="Minimal 8 karakter"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0"
                aria-label={
                  showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
                }
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? (
                  <EyeOffIcon className="size-4" aria-hidden />
                ) : (
                  <EyeIcon className="size-4" aria-hidden />
                )}
              </Button>
            </div>
          </FormField>

          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <FormField label="Peran" required error={errors.role?.message}>
                <Select
                  items={ROLE_ITEMS}
                  value={field.value}
                  onValueChange={(value: string | null) => {
                    if (value) field.onChange(value as Role);
                  }}
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <p className="mt-1.5 text-xs text-cream-muted">
                  {ROLE_DESCRIPTION[selectedRole]}
                </p>
              </FormField>
            )}
          />

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gold text-obsidian hover:bg-gold-light"
            >
              {isSubmitting && <LoaderCircleIcon className="animate-spin" aria-hidden />}
              {isSubmitting ? "Menyimpan..." : "Buat Akun"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
