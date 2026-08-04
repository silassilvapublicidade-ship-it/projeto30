"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { reportClientErrorAction } from "@/features/observability/report-client-error.actions";

type AdminErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
};

export default function AdminError({ error, reset, unstable_retry }: AdminErrorProps) {
  const pathname = usePathname();

  useEffect(() => {
    // Server Components already redact the message in production (see the
    // Next.js error.js docs); logging it here client-side is safe and gives
    // us the route + digest pair needed to match this to server-side logs
    // without ever showing a stack trace to the user.
    console.error(`[ADMIN_AREA_LOAD_FAILED] route=${pathname} digest=${error.digest ?? "n/a"}:`, error.message);
    void reportClientErrorAction({
      area: "admin",
      digest: error.digest,
      message: error.message || "Erro desconhecido no carregamento da área administrativa.",
      route: pathname,
    });
  }, [error, pathname]);

  return (
    <div className="mx-auto max-w-xl">
      <StatusCard
        description="Não foi possível carregar esta área administrativa agora. Tente novamente em alguns segundos."
        title="Algo não carregou"
        tone="error"
      />
      <div className="mt-5">
        <Button onClick={unstable_retry ?? reset} type="button" variant="secondary">
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
