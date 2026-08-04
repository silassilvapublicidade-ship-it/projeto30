import Link from "next/link";
import { Medal } from "lucide-react";

import type { ClosestLockedAchievement } from "@/features/profile/profile-evolution.core";

/**
 * "Próxima conquista" (Dashboard como alma do app, Parte B item 10) - bloco
 * dedicado, distinto de "Próximo objetivo". So renderiza quando existe uma
 * conquista bloqueada com progresso numérico real e calculável
 * (findClosestLockedAchievement já filtra critérios booleanos/secretos -
 * nunca revela uma conquista que não pode ser medida com segurança).
 */
export function ProfileNextAchievement({ achievement }: { achievement: ClosestLockedAchievement | null }) {
  if (!achievement) {
    return null;
  }

  const gap = achievement.target - achievement.current;
  const distanceLabel = `Faltam ${gap} ${gap === 1 ? "passo" : "passos"} para desbloquear.`;

  return (
    <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-action/28 bg-action/10 text-action-soft">
          <Medal aria-hidden="true" size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-2">Próxima conquista</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{achievement.name}</p>
          {achievement.description ? (
            <p className="mt-0.5 text-xs leading-5 text-muted-2">{achievement.description}</p>
          ) : null}
          {achievement.challengeName ? (
            <p className="mt-1 text-[0.68rem] text-muted-2">{achievement.challengeName}</p>
          ) : null}

          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--p30-orange),var(--p30-amber))]"
                style={{
                  width: `${Math.min(100, Math.max(0, (achievement.current / achievement.target) * 100))}%`,
                }}
              />
            </div>
            <p className="font-mono text-[0.62rem] text-muted-2">{distanceLabel}</p>
          </div>

          <Link
            className="mt-3 inline-block text-xs font-semibold text-action-soft transition-colors hover:text-foreground"
            href="/app/conquistas"
          >
            Ver conquistas
          </Link>
        </div>
      </div>
    </div>
  );
}
