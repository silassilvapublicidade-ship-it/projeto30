import { Skeleton } from "@/components/ui/feedback";

/**
 * Skeleton dedicado do Dashboard de Evolucao Pessoal - espelha as secoes
 * reais (cabecalho, metricas, destaque/objetivo, desafios, timeline,
 * conquistas, estatisticas, evolucao recente) para evitar layout shift.
 * Nunca reaproveita o skeleton de /app/hoje - estrutura diferente.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton className="h-20" key={index} />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>

      <div className="space-y-2.5">
        <Skeleton className="h-4 w-32" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton className="h-56" key={index} />
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-72 w-full" />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton className="h-16" key={index} />
        ))}
      </div>
    </div>
  );
}
