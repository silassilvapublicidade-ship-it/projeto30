import { Award, CalendarCheck, Church, Flame, PartyPopper, Sparkles, Sunrise, TrendingUp } from "lucide-react";

import type { ContextMessage } from "@/features/dashboard/dashboard-context-message.core";

const ICON_BY_CATEGORY: Record<ContextMessage["category"], typeof Sparkles> = {
  close_to_achievement: Award,
  close_to_record: Flame,
  day_completed: CalendarCheck,
  day_message: Sparkles,
  fallback: Sunrise,
  faith: Church,
  final_stretch: PartyPopper,
  halfway: TrendingUp,
  new_record: Flame,
  vs_yesterday: TrendingUp,
};

/**
 * Mensagem contextual central do Dashboard (Refinamento premium, Parte C
 * item 7) - substitui o antigo ProfileEvolutionHighlight: mesma posicao
 * visual, mas o texto agora vem de resolveDashboardContextMessage (10
 * prioridades), nunca de logica espalhada no componente. Sempre exatamente
 * UMA mensagem.
 */
export function DashboardContextMessage({ message }: { message: ContextMessage }) {
  const Icon = ICON_BY_CATEGORY[message.category];

  return (
    <div className="flex items-center gap-3 rounded-[1.25rem] border border-action/24 bg-[linear-gradient(180deg,rgba(255,106,0,0.1),rgba(255,255,255,0.02))] p-4 transition-shadow duration-[var(--motion-base)] ease-[var(--ease-premium)] sm:p-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-action/30 bg-action/14 text-action-soft">
        <Icon aria-hidden="true" size={17} />
      </span>
      <p className="font-display text-lg leading-snug text-foreground sm:text-xl">{message.text}</p>
    </div>
  );
}
