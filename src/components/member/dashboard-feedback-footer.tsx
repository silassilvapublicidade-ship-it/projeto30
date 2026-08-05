import { Button } from "@/components/ui/button";

/**
 * Ponto de acesso real ao feedback (correção pós-deploy - Rodada 5 tinha
 * o link só em /app/configuracoes, uma página inalcançável no mobile:
 * MemberMobileNavigation só renderiza mainItems, nunca secondaryItems
 * onde Configurações vive). O Dashboard é a landing page e o primeiro
 * item da bottom nav em qualquer tela - por isso este bloco garante o
 * acesso em no máximo 2 toques, discreto e no fim da página (nunca na
 * primeira dobra, nunca competindo com a missão do dia).
 */
export function DashboardFeedbackFooter() {
  return (
    <section className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-5 text-center sm:p-6">
      <h2 className="text-sm font-semibold text-foreground">Ajude a melhorar o Projeto 30</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
        Encontrou algum problema ou teve uma ideia? Seu feedback ajuda a tornar a experiência melhor para todos.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
        <Button as="a" href="/app/feedback" size="sm">
          Enviar feedback
        </Button>
        <Button as="a" href="/app/feedback/meus" size="sm" variant="ghost">
          Acompanhar meus feedbacks
        </Button>
      </div>
    </section>
  );
}
