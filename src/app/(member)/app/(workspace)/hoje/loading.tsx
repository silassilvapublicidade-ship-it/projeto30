import { Skeleton } from "@/components/ui/feedback";

/**
 * Skeleton dedicado de /app/hoje (Parte J) - antes usava só o skeleton
 * genérico do workspace, apesar de ser a rota de maior tráfego. Espelha
 * as seções reais de TodayExperience: contexto do dia, cartão de missão
 * (hábitos), reflexão e ação de finalizar - nunca reaproveita o skeleton
 * do Dashboard, que tem uma forma completamente diferente.
 */
export default function HojeLoading() {
  return (
    <div className="space-y-6 pb-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="space-y-3 rounded-[1.75rem] border border-white/[0.06] bg-white/[0.015] p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton className="h-16 w-full rounded-[1.25rem]" key={index} />
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-[1.75rem] border border-white/[0.06] bg-white/[0.015] p-3 sm:p-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-28 w-full rounded-[1.1rem]" />
      </div>

      <Skeleton className="h-12 w-full rounded-[var(--radius-pill)] sm:w-56" />
    </div>
  );
}
