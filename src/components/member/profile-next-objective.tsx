import { Target } from "lucide-react";

/** "Próximo objetivo" (Parte 12) - só objetivos calculáveis, nunca surpresas reveladas. */
export function ProfileNextObjective({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-action-soft">
        <Target aria-hidden="true" size={16} />
      </span>
      <div>
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-2">Próximo objetivo</p>
        <p className="mt-1 text-sm leading-6 text-foreground">{message}</p>
      </div>
    </div>
  );
}
