import { Sparkles } from "lucide-react";

/** Bloco de destaque de evolução (Parte 5) - uma única mensagem real, nunca duas empilhadas. */
export function ProfileEvolutionHighlight({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[1.25rem] border border-action/24 bg-[linear-gradient(180deg,rgba(255,106,0,0.1),rgba(255,255,255,0.02))] p-4 sm:p-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-action/30 bg-action/14 text-action-soft">
        <Sparkles aria-hidden="true" size={17} />
      </span>
      <p className="font-display text-lg leading-snug text-foreground sm:text-xl">{message}</p>
    </div>
  );
}
