"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeIcon, EyeOffIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerUser } from "../actions";
import { registerSchema, type RegisterValues } from "../schemas";

export function RegisterForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegisterValues) {
    setFormError(null);

    const result = await registerUser(values);

    if (!result.ok) {
      setFormError(result.message);
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          if (message) {
            setError(field as keyof RegisterValues, { type: "server", message });
          }
        }
      }
      return;
    }

    // Akun dibuat — langsung masuk agar pengguna tidak perlu mengisi form lagi.
    const signInResult = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (!signInResult || signInResult.error) {
      toast.success("Akun berhasil dibuat. Silakan masuk.");
      router.push(`/masuk?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    toast.success("Akun berhasil dibuat. Selamat datang!");
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {formError && (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Nama lengkap</Label>
        <Input
          id="name"
          autoComplete="name"
          placeholder="Nama kamu"
          aria-invalid={Boolean(errors.name)}
          className="h-10"
          {...register("name")}
        />
        {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="nama@email.com"
          aria-invalid={Boolean(errors.email)}
          className="h-10"
          {...register("email")}
        />
        {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Nomor telepon / WhatsApp</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="08xxxxxxxxxx"
          aria-invalid={Boolean(errors.phone)}
          className="h-10"
          {...register("phone")}
        />
        {errors.phone && <p className="text-xs text-red-400">{errors.phone.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Kata sandi</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            aria-invalid={Boolean(errors.password)}
            className="h-10 pr-10"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-[#8A8A8A] transition-colors hover:text-[#D8D3C7]"
          >
            {showPassword ? (
              <EyeOffIcon className="size-4" aria-hidden />
            ) : (
              <EyeIcon className="size-4" aria-hidden />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-400">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Ulangi kata sandi</Label>
        <Input
          id="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Ketik ulang kata sandi"
          aria-invalid={Boolean(errors.confirmPassword)}
          className="h-10"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-10 w-full bg-gold text-obsidian hover:bg-gold-light"
      >
        {isSubmitting && <LoaderCircleIcon className="animate-spin" aria-hidden />}
        {isSubmitting ? "Mendaftarkan..." : "Buat akun"}
      </Button>

      <p className="text-center text-sm text-cream-muted">
        Sudah punya akun?{" "}
        <Link
          href={`/masuk?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-medium text-gold hover:underline"
        >
          Masuk di sini
        </Link>
      </p>
    </form>
  );
}
