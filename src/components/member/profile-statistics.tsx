import type { ProfileOverview } from "@/server/services/profile-dashboard.service";

/**
 * Estatísticas pessoais (Parte 10) - só contagens de dias com check
 * concluído (o mesmo dado que o motor de conquistas já usa), nunca uma
 * quantidade inventada (litros, páginas, minutos) que o sistema não
 * armazena de verdade.
 */
export function ProfileStatistics({ totals }: { totals: ProfileOverview["totals"] }) {
  const stats: Array<{ label: string; value: number }> = [
    { label: "Dias finalizados", value: totals.daysFinalized },
    { label: "Dias com 100%", value: totals.daysAt100 },
    { label: "Dias em que leu", value: totals.readingDays },
    { label: "Treinos registrados", value: totals.physicalActivityDays },
    { label: "Dias com reflexão", value: totals.reflectionDays },
    { label: "Conquistas desbloqueadas", value: totals.achievementsUnlocked },
  ];

  return (
    <section aria-labelledby="profile-statistics-heading" className="space-y-3">
      <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-action-soft" id="profile-statistics-heading">
        Estatísticas
      </h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {stats.map((stat) => (
          <div className="rounded-[1.1rem] border border-white/[0.08] bg-white/[0.03] p-3.5" key={stat.label}>
            <p className="font-display text-2xl leading-none text-foreground">{stat.value}</p>
            <p className="mt-1.5 text-[0.72rem] leading-4 text-muted-2">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
