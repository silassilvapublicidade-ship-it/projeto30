import { Skeleton } from "@/components/ui/feedback";

/**
 * Espelha a forma real de /app/perfil/editar (Refinamento premium, Parte B
 * item 5) - cabecalho + 4 secoes de card na mesma ordem da pagina real,
 * nunca o skeleton generico de /app.
 */
export default function EditarPerfilLoading() {
  return (
    <div className="space-y-6">
      <section className="max-w-3xl space-y-4">
        <Skeleton className="h-3 w-40 rounded-full" />
        <Skeleton className="size-12 rounded-full" />
        <Skeleton className="h-10 w-64 rounded-full" />
        <Skeleton className="h-4 w-80 rounded-full" />
      </section>

      {Array.from({ length: 4 }).map((_, index) => (
        <div className="space-y-4 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6" key={index}>
          <Skeleton className="h-4 w-40 rounded-full" />
          <Skeleton className="h-3 w-64 rounded-full" />
          <Skeleton className="h-24 w-full rounded-[1.1rem]" />
        </div>
      ))}
    </div>
  );
}
