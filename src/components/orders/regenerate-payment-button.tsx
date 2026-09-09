"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { regenerateDuitkuPayment } from "@/app/checkout/actions";
import { Button } from "@/components/ui/button";

export function RegeneratePaymentButton({
  orderNumber,
  className,
}: {
  orderNumber: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [redirecting, setRedirecting] = useState(false);

  function regenerate() {
    startTransition(async () => {
      const result = await regenerateDuitkuPayment(orderNumber);
      if (!result.ok) {
        toast.error(result.message);
        if (result.refresh) router.refresh();
        return;
      }

      setRedirecting(true);
      toast.success("Tautan pembayaran baru berhasil dibuat");
      window.location.assign(result.paymentUrl);
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending || redirecting}
      onClick={regenerate}
      className={className}
    >
      {pending || redirecting ? (
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
      ) : (
        <RefreshCwIcon className="size-4" aria-hidden />
      )}
      {redirecting ? "Mengarahkan..." : "Buat Ulang Link"}
    </Button>
  );
}
