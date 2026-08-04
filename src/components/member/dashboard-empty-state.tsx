import { Button } from "@/components/ui/button";

const STEPS = [
  { title: "Escolha um desafio", description: "Encontre um ciclo que combine com o momento que você quer viver." },
  { title: "Registre suas ações", description: "Cada dia, marque o que você realmente fez - sem culpa pelo que não deu." },
  { title: "Acompanhe sua evolução", description: "Pontos, sequência e conquistas mostram o caminho percorrido." },
];

/**
 * Estado inicial do Dashboard para quem nunca teve nenhuma inscrição
 * (Correções obrigatórias pre-lancamento, Parte A) - substitui a pilha de
 * secoes zeradas (missao nula, mensagem contextual generica, resumo
 * narrativo "0 dias/0 pontos", grade de 6 metricas zeradas) por um unico
 * painel premium com o CTA logo no topo. Deliberadamente NAO reaproveita o
 * JSX/copy de NoCycleToday (hoje/today-experience.tsx) - mesma linguagem
 * visual (painel arredondado com gradiente, tira de passos), texto proprio
 * do Dashboard.
 */
export function DashboardNewJourneyHero() {
  return (
    <div className="relative isolate overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] p-5 shadow-[var(--shadow-soft)] sm:p-8">
      <div className="max-w-2xl">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-action-soft">Bem-vindo ao Projeto 30</p>
        <h1 className="mt-6 font-display text-5xl leading-[0.98] text-foreground sm:text-6xl lg:text-7xl">
          Sua jornada começa aqui.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-8 text-muted sm:text-lg">
          Escolha um desafio para começar a construir sua evolução, um dia de cada vez.
        </p>
      </div>

      <div className="mt-8">
        <Button as="a" href="/app/desafios" size="lg">
          Explorar desafios
        </Button>
      </div>

      <div className="mt-12 grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <div className="rounded-[1.35rem] border border-white/[0.08] bg-black/22 p-4" key={step.title}>
            <p className="font-mono text-[0.68rem] text-action-soft">0{index + 1}</p>
            <p className="mt-3 text-base font-semibold text-foreground">{step.title}</p>
            <p className="mt-1.5 text-sm leading-6 text-muted">{step.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Banner compacto para quem tem historico real (dias finalizados, pontos,
 * conquistas) mas nenhuma inscricao ativa/pausada agora (Parte A) - nunca
 * tratado como usuario novo: o resto do Dashboard (metricas "Geral",
 * conquistas, timeline, "Meus desafios") continua renderizando normalmente
 * logo abaixo, com dados reais. Este banner so adiciona o CTA que falta.
 */
export function DashboardExploreChallengesBanner() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.25rem] border border-action/24 bg-[linear-gradient(180deg,rgba(255,106,0,0.1),rgba(255,255,255,0.02))] p-4 sm:p-5">
      <div>
        <p className="font-display text-lg leading-snug text-foreground sm:text-xl">
          Pronto para o próximo desafio?
        </p>
        <p className="mt-1 text-sm leading-6 text-muted">
          Sua evolução até aqui continua registrada abaixo. Escolha um novo ciclo quando quiser continuar.
        </p>
      </div>
      <Button as="a" href="/app/desafios">
        Explorar novos desafios
      </Button>
    </div>
  );
}
