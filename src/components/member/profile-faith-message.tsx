/**
 * Fé e propósito (Parte 13) - conteúdo sempre vindo de
 * daily_motivation_messages (Módulo G, categoria "fe"), nunca hardcoded
 * aqui. O componente inteiro fica de fora quando não há mensagem elegível -
 * nunca um texto vazio ou um placeholder genérico no lugar.
 */
export function ProfileFaithMessage({ message }: { message: { body: string; title: string } | null }) {
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-[1.1rem] border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 sm:px-5">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-2">{message.title}</p>
      <p className="mt-1 text-sm italic leading-6 text-muted">{message.body}</p>
    </div>
  );
}
