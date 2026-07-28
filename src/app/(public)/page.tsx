import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Flame,
  Heart,
  Home as HomeIcon,
  LockKeyhole,
  Moon,
  Play,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Radio, Switch, Textarea } from "@/components/ui/field";
import { EmptyState, Skeleton, Spinner, StatusCard } from "@/components/ui/feedback";
import { Navigation } from "@/components/ui/navigation";
import {
  ConfirmActions,
  DialogPreview,
  Dropdown,
  SheetPreview,
} from "@/components/ui/overlays";
import { Progress } from "@/components/ui/progress";
import {
  colorTokens,
  elevationTokens,
  motionTokens,
  radiusTokens,
  spacingTokens,
} from "@/design-system/tokens";

const navItems = [
  {
    label: "Hoje",
    href: "#hero",
    active: true,
    icon: <HomeIcon aria-hidden="true" size={14} />,
  },
  {
    label: "Ritmo",
    href: "#rhythm",
    icon: <CalendarDays aria-hidden="true" size={14} />,
  },
  { label: "UI", href: "#components", icon: <Sparkles aria-hidden="true" size={14} /> },
];

const dayStates = Array.from({ length: 30 }, (_, index) => {
  const day = index + 1;

  return {
    day,
    state: day < 13 ? "done" : day === 13 ? "today" : day % 7 === 0 ? "rest" : "next",
  };
});

const typeSamples = [
  {
    label: "Display",
    value: "Ritmo que da vontade de voltar.",
    className: "font-display text-4xl leading-10",
  },
  {
    label: "Body",
    value: "Cada componente prioriza calma, contraste e decisao clara.",
    className: "text-base leading-7",
  },
  {
    label: "Data",
    value: "DIA 13 / 30  42%  07:30",
    className: "font-mono text-sm text-action-soft",
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="h-px w-8 bg-action/70" />
      <p className="font-mono text-xs font-medium text-muted">{children}</p>
    </div>
  );
}

function RhythmRail() {
  return (
    <div className="w-full max-w-full rounded-[var(--radius-card)] border border-white/[0.10] bg-white/[0.055] p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl">
      <div className="grid grid-cols-5 gap-2" aria-label="Trinta dias do ciclo">
        {dayStates.map((item) => (
          <span
            aria-label={`Dia ${item.day}`}
            className={[
              "flex aspect-square items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-transform duration-[var(--motion-base)] ease-[var(--ease-premium)] hover:scale-105",
              item.state === "done"
                ? "border-white/12 bg-white/[0.10] text-foreground"
                : item.state === "today"
                  ? "border-action bg-action text-background shadow-[0_0_0_5px_rgba(255,106,0,0.14)]"
                  : item.state === "rest"
                    ? "border-action/22 bg-action/10 text-action-soft"
                    : "border-white/[0.08] bg-black/20 text-muted-2",
            ].join(" ")}
            key={item.day}
          >
            {item.day}
          </span>
        ))}
      </div>
    </div>
  );
}

function TokenTable({
  items,
}: {
  items: Array<{ name: string; value: string; role: string }>;
}) {
  return (
    <div className="divide-y divide-white/[0.07] overflow-hidden rounded-[var(--radius-card)] border border-white/[0.08]">
      {items.map((item) => (
        <div className="grid grid-cols-[1fr_auto] gap-4 p-4" key={item.name}>
          <div>
            <p className="text-sm font-semibold text-foreground">{item.name}</p>
            <p className="mt-1 text-xs leading-5 text-muted">{item.role}</p>
          </div>
          <p className="font-mono text-xs text-muted-2">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl min-w-0">
        <header className="sticky top-3 z-30 flex min-w-0 items-center justify-between gap-3 rounded-[var(--radius-pill)] border border-white/[0.08] bg-background/78 px-3 py-2 shadow-[var(--shadow-hairline)] backdrop-blur-xl">
          <a
            aria-label="Projeto 30"
            className="flex min-w-0 items-center gap-3 rounded-[var(--radius-pill)] focus-visible:outline-action-soft"
            href="#hero"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-action text-background">
              <Flame aria-hidden="true" size={20} strokeWidth={2.4} />
            </span>
            <span className="hidden text-sm font-semibold text-foreground sm:block">
              Projeto 30
            </span>
          </a>
          <Navigation className="hidden sm:flex" items={navItems} />
          <Button size="sm" variant="secondary">
            Preview
          </Button>
        </header>

        <section
          className="grid min-h-[calc(100vh-5.5rem)] min-w-0 gap-10 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center"
          id="hero"
        >
          <div className="min-w-0 max-w-2xl">
            <Badge>Design System 2A</Badge>
            <h1 className="mt-6 font-display text-5xl leading-[1.02] text-foreground sm:text-6xl lg:text-7xl">
              Uma rotina que parece preciosa antes mesmo de comecar.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-muted sm:text-lg">
              O Projeto 30 agora tem uma linguagem visual propria: escura, silenciosa,
              precisa e desenhada para uso diario no celular.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button leadingIcon={<Play aria-hidden="true" size={16} />}>
                Ver sistema
              </Button>
              <Button variant="ghost">Explorar componentes</Button>
            </div>
          </div>

          <div className="min-w-0 space-y-4" id="rhythm">
            <Card tone="glass" className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="font-mono text-xs text-action-soft">DIA 13</p>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground">
                    Manha alinhada
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Um check-in curto, silencioso e facil de repetir.
                  </p>
                </div>
                <Badge tone="neutral">42%</Badge>
              </div>
              <div className="mt-6">
                <Progress label="Ciclo atual" value={42} />
              </div>
              <div className="mt-6 grid gap-2">
                {["Leitura", "Agua", "Gratidao"].map((habit, index) => (
                  <div
                    className="flex min-h-12 items-center justify-between rounded-[var(--radius-card)] border border-white/[0.08] bg-black/20 px-4"
                    key={habit}
                  >
                    <span className="text-sm font-semibold text-foreground">{habit}</span>
                    {index < 2 ? (
                      <CheckCircle2
                        aria-hidden="true"
                        className="text-success"
                        size={18}
                      />
                    ) : (
                      <span className="size-2 rounded-full bg-action" />
                    )}
                  </div>
                ))}
              </div>
            </Card>
            <RhythmRail />
          </div>
        </section>

        <section className="py-12" id="tokens">
          <SectionLabel>Tokens</SectionLabel>
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card tone="soft">
              <CardHeader>
                <CardTitle>Sistema de cores</CardTitle>
                <CardDescription>
                  Preto e grafite sustentam a interface; laranja aparece so quando existe
                  acao, progresso ou foco.
                </CardDescription>
              </CardHeader>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {colorTokens.map((token) => (
                  <div key={token.name}>
                    <span
                      className="block aspect-square rounded-[var(--radius-card)] border border-white/[0.08] shadow-[var(--shadow-hairline)]"
                      style={{ backgroundColor: token.value }}
                    />
                    <p className="mt-2 text-xs font-semibold text-foreground">
                      {token.name}
                    </p>
                    <p className="mt-1 font-mono text-[0.68rem] text-muted-2">
                      {token.value}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
            <Card tone="base">
              <CardHeader>
                <CardTitle>Tipografia</CardTitle>
                <CardDescription>
                  Display com personalidade usado em momentos raros; corpo limpo para
                  leitura diaria.
                </CardDescription>
              </CardHeader>
              <div className="mt-6 space-y-5">
                {typeSamples.map((sample) => (
                  <div key={sample.label}>
                    <p className="mb-2 font-mono text-xs text-muted-2">{sample.label}</p>
                    <p className={sample.className}>{sample.value}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Card>
              <CardTitle>Espacamento</CardTitle>
              <div className="mt-5">
                <TokenTable items={spacingTokens} />
              </div>
            </Card>
            <Card>
              <CardTitle>Radius</CardTitle>
              <div className="mt-5">
                <TokenTable items={radiusTokens} />
              </div>
            </Card>
            <Card>
              <CardTitle>Elevacao e motion</CardTitle>
              <div className="mt-5 space-y-3">
                <TokenTable items={elevationTokens} />
                <TokenTable items={motionTokens} />
              </div>
            </Card>
          </div>
        </section>

        <section className="py-12" id="components">
          <SectionLabel>Componentes</SectionLabel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card tone="glass">
              <CardHeader>
                <CardTitle>Botoes e badges</CardTitle>
                <CardDescription>
                  Acoes claras, toque confortavel e feedback discreto.
                </CardDescription>
              </CardHeader>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button>Primario</Button>
                <Button variant="secondary">Secundario</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Perigo</Button>
                <Button loading>Salvando</Button>
                <Button disabled variant="secondary">
                  Inativo
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge>Hoje</Badge>
                <Badge tone="neutral">Neutro</Badge>
                <Badge tone="success">Sucesso</Badge>
                <Badge tone="warning">Atencao</Badge>
                <Badge tone="danger">Erro</Badge>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Campos</CardTitle>
                <CardDescription>
                  Entradas altas, legiveis e desenhadas para polegar.
                </CardDescription>
              </CardHeader>
              <div className="mt-6 grid gap-4">
                <Field hint="Aparece apenas para voce." label="Intencao do dia">
                  <Input placeholder="Ex.: Caminhar com calma" />
                </Field>
                <Field label="Diario breve">
                  <Textarea placeholder="O que precisa ficar registrado hoje?" />
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Selecao</CardTitle>
                <CardDescription>
                  Estados nativos preservados, visual consistente por cima.
                </CardDescription>
              </CardHeader>
              <div className="mt-6 grid gap-4">
                <Switch
                  defaultChecked
                  description="Reduz transicoes e efeitos visuais."
                  label="Modo calmo"
                />
                <Checkbox
                  defaultChecked
                  description="Marca a tarefa sem expor dados privados."
                  label="Registrar habito"
                />
                <Radio
                  defaultChecked
                  description="Melhor para check-ins curtos."
                  label="Ritmo leve"
                  name="rhythm"
                />
                <Radio
                  description="Para dias de foco estendido."
                  label="Ritmo profundo"
                  name="rhythm"
                />
              </div>
            </Card>

            <Card tone="accent">
              <CardHeader>
                <CardTitle>Progresso e carregamento</CardTitle>
                <CardDescription>
                  Movimento baixo, legivel e respeitando reduced motion.
                </CardDescription>
              </CardHeader>
              <div className="mt-6 space-y-5">
                <Progress label="Semana" value={64} />
                <Spinner />
                <div className="grid gap-3">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-24" />
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estados</CardTitle>
                <CardDescription>
                  Vazio, erro e sucesso orientam sem dramatizar.
                </CardDescription>
              </CardHeader>
              <div className="mt-6 grid gap-3">
                <StatusCard
                  description="Seu diario foi salvo no ciclo correto."
                  title="Registro salvo"
                  tone="success"
                />
                <StatusCard
                  description="Revise o campo destacado antes de continuar."
                  title="Algo precisa de atencao"
                  tone="error"
                />
                <EmptyState
                  action={
                    <Button size="sm" variant="secondary">
                      Criar primeiro registro
                    </Button>
                  }
                  description="Quando o ciclo comecar, seus registros aparecem aqui."
                  title="Nada registrado ainda"
                />
              </div>
            </Card>

            <Card tone="soft">
              <CardHeader>
                <CardTitle>Overlays</CardTitle>
                <CardDescription>
                  Dialog, sheet e dropdown usam camadas escuras e foco claro.
                </CardDescription>
              </CardHeader>
              <div className="mt-6 space-y-4">
                <Dropdown
                  items={["Editar lembrete", "Duplicar rotina", "Arquivar ciclo"]}
                  label="Mais opcoes"
                  open
                />
                <DialogPreview
                  description="Confirme pequenas mudancas sem tirar o usuario do fluxo."
                  title="Salvar novo ritmo?"
                >
                  <ConfirmActions />
                </DialogPreview>
                <SheetPreview
                  description="No mobile, a sheet entra como uma camada baixa e direta."
                  title="Resumo do dia"
                >
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      ["3", "habitos"],
                      ["42", "pontos"],
                      ["13", "dia"],
                    ].map(([value, label]) => (
                      <div
                        className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.055] p-3"
                        key={label}
                      >
                        <p className="font-mono text-lg text-foreground">{value}</p>
                        <p className="mt-1 text-xs text-muted">{label}</p>
                      </div>
                    ))}
                  </div>
                </SheetPreview>
              </div>
            </Card>
          </div>
        </section>

        <section className="py-12">
          <SectionLabel>Ritmo visual</SectionLabel>
          <Card tone="glass" className="overflow-hidden p-0">
            <div className="grid gap-0 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="border-b border-white/[0.08] p-6 lg:border-b-0 lg:border-r">
                <Moon aria-hidden="true" className="text-action-soft" size={24} />
                <h2 className="mt-5 font-display text-4xl leading-10 text-foreground">
                  Motion system silencioso.
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted">
                  A interface se move como respiracao: curta no toque, suave em progresso,
                  quase invisivel em surfaces.
                </p>
              </div>
              <div className="grid gap-3 p-6">
                {[
                  {
                    icon: Sun,
                    title: "Hover",
                    text: "Leve elevacao e contraste, sem distrair.",
                  },
                  {
                    icon: Heart,
                    title: "Active",
                    text: "Resposta curta para toque mobile.",
                  },
                  {
                    icon: Bell,
                    title: "Focus",
                    text: "Anel laranja claro e sempre visivel.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Disabled",
                    text: "Baixa opacidade, sem remover contexto.",
                  },
                  {
                    icon: LockKeyhole,
                    title: "Loading",
                    text: "Pulso pequeno, sem spinner dominante.",
                  },
                ].map((item) => (
                  <div
                    className="grid grid-cols-[2.75rem_1fr] gap-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.045] p-3"
                    key={item.title}
                  >
                    <span className="flex size-11 items-center justify-center rounded-full bg-action/10 text-action-soft">
                      <item.icon aria-hidden="true" size={18} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-foreground">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted">
                        {item.text}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
