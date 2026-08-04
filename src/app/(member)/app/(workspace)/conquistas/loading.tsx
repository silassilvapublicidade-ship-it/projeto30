import { Skeleton } from "@/components/ui/feedback";

/**
 * Espelha a forma real de /app/conquistas (Refinamento premium, Parte B
 * item 5) - cabecalho, secao "Desbloqueadas" e secao "Bloqueadas", cada uma
 * com uma grade de 3 cards do mesmo tamanho dos cards reais, nunca o
 * skeleton generico de /app.
 */
export default function ConquistasLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-6 w-40 rounded-full" />

      <div className="space-y-3">
        <Skeleton className="h-4 w-44 rounded-full" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton className="h-44 rounded-[1.5rem]" key={index} />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-40 rounded-full" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton className="h-32 rounded-[1.5rem]" key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
