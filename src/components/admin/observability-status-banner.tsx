import { AlertOctagon, AlertTriangle, CheckCircle2, Gauge } from "lucide-react";

import { cn } from "@/lib/utils";

export type ObservabilityStatus = "saudavel" | "atencao" | "degradado" | "critico";

const STATUS_META: Record<
  ObservabilityStatus,
  { label: string; description: string; icon: typeof CheckCircle2; className: string }
> = {
  saudavel: {
    label: "Saudável",
    description: "Nenhum problema relevante detectado nas últimas 24 horas.",
    icon: CheckCircle2,
    className: "border-success/25 bg-success-wash text-success",
  },
  atencao: {
    label: "Atenção",
    description: "Há falhas isoladas ou usuários presos - vale uma checada, sem urgência.",
    icon: AlertTriangle,
    className: "border-action/30 bg-action/10 text-action-soft",
  },
  degradado: {
    label: "Degradado",
    description: "Um erro está se repetindo ou uma campanha entregou só parcialmente.",
    icon: AlertTriangle,
    className: "border-warning/30 bg-warning-wash text-warning",
  },
  critico: {
    label: "Crítico",
    description: "Falha ampla, campanha totalmente falha ou o cron parou de rodar.",
    icon: AlertOctagon,
    className: "border-danger/30 bg-danger-wash text-danger",
  },
};

export function ObservabilityStatusBanner({ status }: { status: ObservabilityStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.saudavel;
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-card)] border p-4 shadow-[var(--shadow-hairline)] sm:p-5",
        meta.className,
      )}
      role="status"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-current/10">
        <Icon aria-hidden="true" size={20} />
      </span>
      <div>
        <p className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.16em] text-current/80">
          <Gauge aria-hidden="true" size={12} />
          Status geral
        </p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">{meta.label}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{meta.description}</p>
      </div>
    </div>
  );
}
