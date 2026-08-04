import { BookOpen } from "lucide-react";

import type { NarrativeSummary } from "@/features/dashboard/dashboard-narrative-summary.core";

/**
 * "Resumo narrativo" (Refinamento premium, Parte D item 14) - bloco
 * compacto, uma frase principal + uma frase de contexto opcional, nunca um
 * repeat dos cards de metricas logo abaixo.
 */
export function DashboardNarrativeSummary({ summary }: { summary: NarrativeSummary }) {
  return (
    <div className="flex items-start gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-action-soft">
        <BookOpen aria-hidden="true" size={16} />
      </span>
      <div>
        <p className="text-sm leading-6 text-foreground">{summary.primary}</p>
        {summary.secondary ? <p className="mt-1 text-sm leading-6 text-muted">{summary.secondary}</p> : null}
      </div>
    </div>
  );
}
