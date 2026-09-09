"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EyeIcon, EyeOffIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginValues } from "../schemas";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);

    const trimmedEmail = values.email.trim();
    const trimmedPassword = values.password.trim();

    const result = await signIn("credentials", {
      email: trimmedEmail,
      password: trimmedPassword,
      redirect: false,
    });
    console.log("[LOGIN_CLIENT] signIn result:", result);

    if (!result || result.error) {
      setFormError(result?.error === "CredentialsSignin" 
        ? "Email atau kata sandi salah. Silakan periksa kembali." 
        : `Gagal masuk: ${result?.error ?? "terjadi kesalahan tak terduga"}`
      );
      return;
    }

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
        {errors.email && (
          <p className="text-xs text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Kata sandi</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Masukkan kata sandi"
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

      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-10 w-full bg-gold text-obsidian hover:bg-gold-light"
      >
        {isSubmitting && <LoaderCircleIcon className="animate-spin" aria-hidden />}
        {isSubmitting ? "Memproses..." : "Masuk"}
      </Button>

      <p className="text-center text-sm text-cream-muted">
        Belum punya akun?{" "}
        <Link
          href={`/daftar?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-medium text-gold hover:underline"
        >
          Daftar sekarang
        </Link>
      </p>
    </form>
  );
}
