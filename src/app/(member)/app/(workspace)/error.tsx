"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { reportClientErrorAction } from "@/features/observability/report-client-error.actions";

type WorkspaceErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function WorkspaceError({ error, reset }: WorkspaceErrorProps) {
  const pathname = usePathname();
  const [diagnosticCode, setDiagnosticCode] = useState<string | null>(null);

  useEffect(() => {
    console.error(`[WORKSPACE_AREA_LOAD_FAILED] route=${pathname} digest=${error.digest ?? "n/a"}:`, error.message);
    void reportClientErrorAction({
      area: "app",
      digest: error.digest,
      message: error.message || "Erro desconhecido no carregamento da área de membros.",
      route: pathname,
    }).then((result) => setDiagnosticCode(result.errorCode));
  }, [error, pathname]);

  const reportHref = `/app/feedback?tipo=problem${diagnosticCode ? `&diagnostico=${encodeURIComponent(diagnosticCode)}` : ""}&rota=${encodeURIComponent(pathname)}`;

  return (
    <div className="mx-auto max-w-xl">
      <StatusCard
        description="Não foi possível carregar esta parte da sua jornada agora. Tente novamente em alguns segundos."
        title="Algo saiu do ritmo"
        tone="error"
      />
      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={reset} type="button" variant="secondary">
          Tentar novamente
        </Button>
        <Button as="a" href={reportHref} variant="ghost">
          Relatar este problema
        </Button>
      </div>
    </div>
  );
}
