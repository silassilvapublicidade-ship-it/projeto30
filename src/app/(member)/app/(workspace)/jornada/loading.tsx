import { Skeleton } from "@/components/ui/feedback";

/**
 * Espelha a forma real de /app/jornada (Refinamento premium, Parte B item
 * 5) - card de resumo com progresso, grade de calendario e painel de
 * detalhe do dia, nunca o skeleton generico de /app.
 */
export default function JornadaLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-56 rounded-full" />

      <div className="space-y-4 rounded-[1.75rem] border border-white/[0.08] bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-32 rounded-full" />
            <Skeleton className="h-7 w-52 rounded-full" />
            <Skeleton className="h-3 w-40 rounded-full" />
          </div>
          <Skeleton className="h-3 w-36 rounded-full" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      <div className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.03] p-5">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 28 }).map((_, index) => (
            <Skeleton className="aspect-square rounded-lg" key={index} />
          ))}
        </div>
      </div>

      <Skeleton className="h-40 rounded-[1.75rem]" />
    </div>
  );
}
