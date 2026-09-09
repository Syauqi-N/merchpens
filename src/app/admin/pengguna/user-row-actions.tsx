"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  MoreHorizontalIcon,
  ShieldAlertIcon,
  UserCheckIcon,
  UserCogIcon,
  UserXIcon,
} from "lucide-react";
import { toast } from "sonner";

import { FormField } from "@/components/admin/form-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Role } from "@/generated/prisma/client";
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTION, ROLE_LABEL, can } from "@/lib/permissions";

import { resetUserPassword, setUserActive, updateUserRole } from "./actions";
import {
  changeRoleFormSchema,
  resetPasswordFormSchema,
  type ChangeRoleFormValues,
  type ResetPasswordFormValues,
} from "./schemas";

export type UserRowActionsProps = {
  userId: string;
  /** Nama yang enak dibaca (sudah jatuh ke email bila namanya kosong). */
  displayName: string;
  role: Role;
  isActive: boolean;
  /** Baris ini milik pengurus yang sedang membuka halaman. */
  isSelf: boolean;
};

type OpenDialog = "role" | "password" | "active" | null;

const ROLE_ITEMS = ASSIGNABLE_ROLES.map((role) => ({
  value: role as string,
  label: ROLE_LABEL[role],
}));

/**
 * Menu aksi pada satu baris daftar pengguna.
 *
 * Aksi ke DIRI SENDIRI (ubah peran, nonaktifkan) tidak ditampilkan sama sekali
 * — bukan sekadar dinonaktifkan — supaya tidak ada tombol yang menjanjikan
 * sesuatu lalu ditolak server. Penyembunyian ini murni kenyamanan: penolakan
 * yang sesungguhnya ada di dalam Server Action (`actions.ts`), karena action
 * bisa dipanggil lewat POST tanpa pernah melewati menu ini.
 *
 * Tidak ada aksi "Hapus pengguna" di sini dan itu disengaja: `Order.userId`
 * adalah relasi wajib, jadi menghapus akun akan merusak riwayat pesanannya.
 * Menonaktifkan adalah cara yang benar untuk mencabut akses.
 */
export function UserRowActions({
  userId,
  displayName,
  role,
  isActive,
  isSelf,
}: UserRowActionsProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [togglingActive, startToggleActive] = useTransition();

  const roleForm = useForm<ChangeRoleFormValues>({
    resolver: zodResolver(changeRoleFormSchema),
    defaultValues: { role },
  });

  const passwordForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: "" },
  });

  // useWatch (bukan roleForm.watch()) supaya React Compiler tetap bisa memoize
  // komponen ini — watch() mengembalikan fungsi yang tidak aman dimemoize.
  const selectedRole = useWatch({ control: roleForm.control, name: "role" });

  /** Peran yang dipilih mencabut akses panel yang sekarang dimiliki. */
  const willLoseAdminAccess =
    can(role, "ACCESS_ADMIN") && !can(selectedRole, "ACCESS_ADMIN");

  function openRoleDialog() {
    roleForm.reset({ role });
    setDialog("role");
  }

  function openPasswordDialog() {
    passwordForm.reset({ password: "" });
    setShowPassword(false);
    setDialog("password");
  }

  async function submitRole(values: ChangeRoleFormValues) {
    const result = await updateUserRole({ userId, role: values.role });

    if (result.ok) {
      toast.success(result.message);
      setDialog(null);
      router.refresh();
      return;
    }

    if (result.fieldErrors?.role) {
      roleForm.setError("role", { type: "server", message: result.fieldErrors.role });
    }
    toast.error(result.message);
  }

  async function submitPassword(values: ResetPasswordFormValues) {
    const result = await resetUserPassword({ userId, password: values.password });

    if (result.ok) {
      toast.success(result.message, {
        description:
          "Sampaikan kata sandi baru lewat jalur pribadi — bukan grup kelas. Kata sandi ini tidak bisa ditampilkan lagi setelah dialog ditutup, jadi catat dulu bila perlu, lalu minta dia menggantinya setelah berhasil masuk.",
        duration: 12000,
      });
      passwordForm.reset({ password: "" });
      setShowPassword(false);
      setDialog(null);
      router.refresh();
      return;
    }

    if (result.fieldErrors?.password) {
      passwordForm.setError("password", {
        type: "server",
        message: result.fieldErrors.password,
      });
    }
    toast.error(result.message);
  }

  function confirmToggleActive() {
    startToggleActive(async () => {
      const result = await setUserActive({ userId, isActive: !isActive });

      if (result.ok) {
        toast.success(result.message);
        setDialog(null);
        router.refresh();
        return;
      }

      toast.error(result.message);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Aksi untuk ${displayName}`}
              className="text-cream-muted hover:text-cream"
            />
          }
        >
          <MoreHorizontalIcon className="size-4" aria-hidden />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          {/* Base UI: DropdownMenuLabel adalah `Menu.GroupLabel`, jadi ia WAJIB
              berada di dalam sebuah Group — di luar itu ia melempar
              "MenuGroupContext is missing" saat dirender. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate text-cream">
              {displayName}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {!isSelf && (
              <DropdownMenuItem onClick={openRoleDialog}>
                <UserCogIcon aria-hidden />
                Ubah Peran
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={openPasswordDialog}>
              <KeyRoundIcon aria-hidden />
              Reset Password
            </DropdownMenuItem>
          </DropdownMenuGroup>

          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant={isActive ? "destructive" : "default"}
                onClick={() => setDialog("active")}
              >
                {isActive ? (
                  <UserXIcon aria-hidden />
                ) : (
                  <UserCheckIcon aria-hidden />
                )}
                {isActive ? "Nonaktifkan" : "Aktifkan"}
              </DropdownMenuItem>
            </>
          )}

          {isSelf && (
            <p className="px-1.5 py-1 text-xs text-cream-muted">
              Peran dan status akunmu sendiri hanya bisa diubah Pengurus Inti lain.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Ubah peran */}
      <Dialog
        open={dialog === "role"}
        onOpenChange={(next: boolean) => setDialog(next ? "role" : null)}
      >
        <DialogContent className="gap-0 sm:max-w-md">
          <DialogHeader className="mb-4">
            <DialogTitle>Ubah peran {displayName}</DialogTitle>
            <DialogDescription>
              Peran menentukan bagian panel mana yang boleh dia buka. Perubahannya
              berlaku seketika, bahkan untuk sesi yang sedang terbuka.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={roleForm.handleSubmit(submitRole)}
            noValidate
            className="space-y-4"
          >
            <Controller
              control={roleForm.control}
              name="role"
              render={({ field }) => (
                <FormField
                  label="Peran baru"
                  required
                  error={roleForm.formState.errors.role?.message}
                >
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

            <div className="rounded-lg bg-obsidian p-3 text-xs text-cream-muted">
              <p>
                Peran sekarang:{" "}
                <span className="font-medium text-cream">{ROLE_LABEL[role]}</span>
              </p>
              {willLoseAdminAccess && (
                <p className="mt-1.5 font-medium text-amber-300">
                  Dengan peran {ROLE_LABEL[selectedRole]}, dia kehilangan akses panel
                  admin sepenuhnya. Riwayat pesanannya tetap utuh.
                </p>
              )}
              {selectedRole === "PENGURUS" && role !== "PENGURUS" && (
                <p className="mt-1.5 font-medium text-gold">
                  Pengurus bisa mengelola katalog, pesanan, dan akun seluruh
                  pengguna, termasuk peranmu sendiri. Berikan hanya kepada orang
                  yang memang memegang kepengurusan.
                </p>
              )}
            </div>

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                disabled={roleForm.formState.isSubmitting}
                onClick={() => setDialog(null)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={roleForm.formState.isSubmitting}
                className="bg-gold text-obsidian hover:bg-gold-light"
              >
                {roleForm.formState.isSubmitting && (
                  <LoaderCircleIcon className="animate-spin" aria-hidden />
                )}
                {roleForm.formState.isSubmitting ? "Menyimpan..." : "Simpan Peran"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset kata sandi */}
      <Dialog
        open={dialog === "password"}
        onOpenChange={(next: boolean) => {
          if (!next) {
            passwordForm.reset({ password: "" });
            setShowPassword(false);
          }
          setDialog(next ? "password" : null);
        }}
      >
        <DialogContent className="gap-0 sm:max-w-md">
          <DialogHeader className="mb-4">
            <DialogTitle>Reset kata sandi {displayName}</DialogTitle>
            <DialogDescription>
              Kata sandi lama tidak bisa dibaca siapa pun — yang tersimpan hanya
              hash-nya. Kamu menetapkan kata sandi baru di sini, lalu
              menyampaikannya sendiri kepada yang bersangkutan.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={passwordForm.handleSubmit(submitPassword)}
            noValidate
            className="space-y-4"
          >
            <FormField
              label="Kata sandi baru"
              htmlFor={`reset-password-${userId}`}
              required
              error={passwordForm.formState.errors.password?.message}
              hint="Minimal 8 karakter. Jangan pakai kata sandi yang sama untuk beberapa pengurus."
            >
              <div className="flex gap-2">
                <Input
                  id={`reset-password-${userId}`}
                  type={showPassword ? "text" : "password"}
                  className="h-10"
                  placeholder="Minimal 8 karakter"
                  autoComplete="new-password"
                  aria-invalid={Boolean(passwordForm.formState.errors.password)}
                  {...passwordForm.register("password")}
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

            <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-200">
              Sampaikan kata sandi ini lewat jalur pribadi, bukan grup kelas atau
              angkatan. Setelah dialog ditutup, kata sandinya tidak bisa ditampilkan
              lagi.
            </p>

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                disabled={passwordForm.formState.isSubmitting}
                onClick={() => setDialog(null)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={passwordForm.formState.isSubmitting}
                className="bg-gold text-obsidian hover:bg-gold-light"
              >
                {passwordForm.formState.isSubmitting && (
                  <LoaderCircleIcon className="animate-spin" aria-hidden />
                )}
                {passwordForm.formState.isSubmitting
                  ? "Menyimpan..."
                  : "Simpan Kata Sandi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Aktifkan / nonaktifkan */}
      <AlertDialog
        open={dialog === "active"}
        onOpenChange={(next: boolean) => setDialog(next ? "active" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia
              className={
                isActive ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-600"
              }
            >
              {isActive ? (
                <ShieldAlertIcon aria-hidden />
              ) : (
                <UserCheckIcon aria-hidden />
              )}
            </AlertDialogMedia>
            <AlertDialogTitle>
              {isActive
                ? `Nonaktifkan akun ${displayName}?`
                : `Aktifkan kembali akun ${displayName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? "Dia langsung tidak bisa masuk lagi, termasuk dari sesi yang sedang terbuka. Akunnya tidak dihapus dan seluruh riwayat pesanannya tetap utuh — kamu bisa mengaktifkannya kembali kapan saja."
                : `Dia bisa masuk lagi memakai email dan kata sandinya, dengan peran ${ROLE_LABEL[role]}. Bila lupa kata sandinya, pakai menu Reset Password.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={togglingActive}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggleActive}
              disabled={togglingActive}
              className={
                isActive
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }
            >
              {togglingActive && <LoaderCircleIcon className="animate-spin" aria-hidden />}
              {togglingActive
                ? "Memproses..."
                : isActive
                  ? "Ya, nonaktifkan"
                  : "Ya, aktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
