import { AlertTriangle, Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type StatLineTone = "positive" | "attention" | "neutral";

const toneMeta = {
  positive: { icon: Check, className: "text-success" },
  attention: { icon: AlertTriangle, className: "text-warning" },
  neutral: { icon: Check, className: "text-muted-2" },
} as const;

/**
 * Uma linha "métrica com contexto" (Parte 10): zero vira texto positivo e
 * discreto, valor que exige atenção fica destacado - nunca só um número
 * pelado. min-w-0 + break-words no texto evita overflow com labels longos.
 */
export function StatLine({ tone, text }: { tone: StatLineTone; text: string }) {
  const meta = toneMeta[tone];
  const Icon = meta.icon;

  return (
    <div className="flex min-w-0 items-start gap-2 text-sm">
      <Icon aria-hidden="true" className={cn("mt-0.5 shrink-0", meta.className)} size={15} />
      <span className={cn("min-w-0 break-words", tone === "attention" ? "font-semibold text-foreground" : "text-muted")}>
        {text}
      </span>
    </div>
  );
}
