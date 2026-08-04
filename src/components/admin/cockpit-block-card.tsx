import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export type CockpitBlockStatus = "saudavel" | "atencao" | "degradado" | "critico";

const statusBadgeTone: Record<CockpitBlockStatus, "success" | "accent" | "warning" | "danger"> = {
  saudavel: "success",
  atencao: "accent",
  degradado: "warning",
  critico: "danger",
};

const statusLabel: Record<CockpitBlockStatus, string> = {
  saudavel: "Saudável",
  atencao: "Atenção",
  degradado: "Degradado",
  critico: "Crítico",
};

export function CockpitBlockCard({
  title,
  status,
  headline,
  description,
  href,
  ctaLabel,
}: {
  title: string;
  status?: CockpitBlockStatus;
  headline: string;
  description: string;
  href: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">{title}</h3>
        {status ? <Badge tone={statusBadgeTone[status]}>{statusLabel[status]}</Badge> : null}
      </div>
      <p className="mt-3 text-lg font-semibold text-foreground">{headline}</p>
      <p className="mt-1 flex-1 text-sm leading-6 text-muted">{description}</p>
      <Link
        className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-action-soft transition-colors hover:text-action focus-visible:outline-action-soft"
        href={href}
      >
        {ctaLabel}
        <ArrowRight aria-hidden="true" size={14} />
      </Link>
    </div>
  );
}
