# Design System Projeto 30

## Direcao

O Projeto 30 deve parecer um produto de consumo premium, nao um painel
administrativo. A identidade e `disciplina calma`: escura, silenciosa,
espacosa e precisa - agora ancorada no logo oficial da marca.

Esta fase (Fase 1 do redesign) consolidou a fundacao do design system:
identidade/logo, tokens semanticos, tipografia, espacamento/layout,
radius/elevacao e motion. Nenhuma tela foi reconstruida ainda - isso vira em
fases seguintes.

## Identidade e uso do logo

O arquivo oficial vive em `public/brand/logo.png` (1024x1536, PNG com
transparencia real). Ele **nunca** deve ser recriado, redesenhado, recortado,
ter cores alteradas ou receber filtros permanentes.

Para uso pratico na interface (header, footer, autenticacao, area de
membros, favicon), existe uma derivacao tecnica gerada diretamente do arquivo
oficial: `public/brand/logo-mark-1024.png`. Essa derivacao apenas recorta a
margem transparente ao redor do simbolo (mantendo integralmente o simbolo,
as cores e a proporcao circular) para permitir uso em tamanhos pequenos sem
espaco vazio desperdicado. Nenhuma cor, traco ou elemento foi alterado.

O logo possui **uma unica versao** (marca circular com "P30" e "PROJETO 30"
integrados). Nao existe versao horizontal, nem versao apenas-icone separada
do texto, nem versao monocromatica - portanto o componente de marca nao deve
inventar essas variantes.

Uso correto:

```tsx
import { BrandLogo } from "@/components/brand/brand-logo";

<BrandLogo size={40} preload decorative />
```

- `size`: tamanho em px (largura = altura, a marca e circular).
- `preload`: usar `true` somente na instancia mais visivel/acima da dobra
  (ex.: header, sidebar, tela de autenticacao). Instancias secundarias (ex.:
  footer) devem manter o padrao `false`.
- `decorative`: `true` quando o nome "Projeto 30" ja aparece como texto ao
  lado do logo (evita repeticao para leitores de tela); `false` (com `label`)
  quando o logo e o unico identificador visual/textual daquele ponto.

Pontos onde o logo oficial substituiu o icone generico `Flame` nesta fase:
header publico, footer publico, `AuthShell` (login/cadastro/recuperacao) e a
sidebar do `MemberShell`. O favicon, `apple-touch-icon` e icone de app
tambem foram gerados a partir do mesmo arquivo oficial.

Nao usar `Flame` (lucide-react) como marca a partir desta fase. O unico uso
remanescente de `Flame` no codigo e semantico (icone de sequencia/streak na
tela "Hoje"), sem relacao com a identidade da marca.

## Principios

- mobile-first;
- preto fosco e grafite como base;
- branco de alto contraste para conteudo principal;
- laranja como assinatura principal (acao, progresso e foco); dourado/ambar
  como extensao - profundidade, progresso avancado e conquista - nunca como
  substituto do laranja;
- muito espaco em branco;
- radius consolidado em niveis (controle, card, painel, pill), nao um valor
  unico repetido em todo lugar;
- sombras discretas e glassmorphism leve somente em superficies especiais;
- glow reservado para hero, progresso, estados ativos, conquistas e CTAs
  principais - nunca aplicado de forma ampla;
- motion curto, suave e sempre opcional via `prefers-reduced-motion`.

## Cores

### Paleta principal

| Token | Valor | Papel |
| --- | --- | --- |
| `--p30-black` | `#050505` | Background principal |
| `--p30-graphite` | `#111418` | Superficie primaria |
| `--p30-surface` | `#1D2228` | Camadas e containers |
| `--p30-white` | `#F8F6F1` | Texto principal |
| `--p30-muted` | `#B7B4AC` | Texto secundario |
| `--p30-muted-2` | `#7C838B` | Texto discreto |

### Accent

| Token | Valor | Papel |
| --- | --- | --- |
| `--p30-orange` | `#FF6A00` | Accent **principal** - acao e progresso |
| `--p30-orange-soft` | `#FF9A3D` | Foco e realce |
| `--p30-amber` | `#F2A93B` | Accent **secundario** (dourado) - profundidade, progresso avancado, conquista |
| `--p30-amber-soft` | `#FFCB73` | Realce dourado sobre fundo escuro |
| `--p30-silver` | `#C9CDD3` | Neutro metalico discreto (uso pontual, nao substitui o branco de texto) |

O laranja continua sendo a assinatura principal do produto. O dourado nunca
deve dominar uma tela - e um acento que aparece em contextos de progresso
avancado, celebracao e conquista.

### Estado

| Token | Valor | Papel |
| --- | --- | --- |
| `--p30-success` | `#83D9A3` | Sucesso |
| `--p30-warning` | `#FFD166` | Aviso |
| `--p30-danger` (alias `--color-error`) | `#FF7A70` | Erro |
| `--p30-info` | `#6BB8E0` | Informativo (novo nesta fase) |

Cada estado tem um tom "wash" (`*-wash`) para fundos discretos (ex.:
`--p30-danger-wash`).

### Camadas semanticas (novas nesta fase)

| Token | Papel |
| --- | --- |
| `--surface-base` | Background principal |
| `--surface-elevated` | Background elevado (paineis, cards soft) |
| `--surface-subtle` | Background sutil (blocos discretos) |
| `--surface-translucent` | Superficie translucida (glass, com backdrop-blur) |
| `--text-primary` / `--text-secondary` / `--text-tertiary` | Hierarquia de texto |
| `--border-subtle` / `--border-active` | Bordas |
| `--focus-ring` | Cor do anel de foco |
| `--overlay-scrim` / `--overlay-scrim-strong` | Overlays para futuros modais/sheets |

## Gradientes e glow

| Token | Uso |
| --- | --- |
| `--gradient-accent` | Destaque principal (ex.: preenchimento de progresso) |
| `--gradient-accent-soft` | Fundo suave de blocos de destaque |
| `--glow-amber` | Halo radial - hero, conquistas, celebracao |
| `--shadow-glow-accent` | Glow reservado para hero, progresso, estados ativos e conquistas |

Regra: nenhum texto longo deve depender de gradiente para legibilidade. Glow
e reservado para os pontos listados acima - nao aplicar em cards comuns,
listas ou texto de corpo.

## Tipografia

Familias (inalteradas nesta fase):

- `Fraunces` (`--font-display`): display, usado com restricao em momentos de
  marca e headlines editoriais.
- `Manrope` (`--font-body` / `--font-sans`): corpo principal.
- `IBM Plex Mono` (`--font-mono`): dados curtos, status, rotulos uppercase e
  metricas.

Escala semantica (tamanho / altura de linha), disponivel via utilitarios
Tailwind gerados a partir do tema (`text-display-hero`, `text-headline`,
etc.):

| Nome | Tamanho / altura de linha | Uso |
| --- | --- | --- |
| `display-hero` | 4.5rem / 1.02 | Hero da landing |
| `display-day` | 3.5rem / 1.05 | Numero do dia em destaque |
| `headline` | 2.25rem / 1.15 | Titulos de secao |
| `title` | 1.5rem / 1.3 | Titulos de card/bloco |
| `subtitle` | 1.125rem / 1.5 | Subtitulos |
| `body` | 1rem / 1.7 | Texto corrido |
| `small` | 0.875rem / 1.6 | Texto secundario |
| `caption` | 0.75rem / 1.5 | Legendas |
| `label` | 0.68rem / 1.4 | Rotulos mono uppercase |
| `numeric-display` | 3rem / 1 | Numeros grandes (streak, pontos, dia) |
| `mono-data` | 0.875rem / 1.4 | Dados tabulares/mono |

Tracking consolidado para rotulos uppercase (antes espalhado como valores
arbitrarios repetidos): `--tracking-label-tight` (0.14em),
`--tracking-label` (0.18em), `--tracking-label-wide` (0.22em).

Textos longos (paragrafos, descricoes) devem usar `body`/`small` com a
largura de leitura `--container-reading` (42rem) - nunca depender de
gradiente ou glow para permanecerem legiveis.

## Espacamento e layout

| Token | Valor | Uso |
| --- | --- | --- |
| `--container-content` | 72rem | Largura maxima de conteudo padrao |
| `--container-narrow` | 48rem | Formularios e blocos focados |
| `--container-reading` | 42rem | Largura ideal de leitura longa |
| `--space-mobile-margin` | 1rem | Margem lateral mobile |
| `--space-desktop-margin` | 2rem | Margem lateral desktop |
| `--nav-bottom-height` | 4.75rem | Altura da navegacao inferior (preparacao para fases futuras) |
| `--safe-area-bottom` | `env(safe-area-inset-bottom)` | Respeito a safe area em dispositivos com notch/home indicator |
| `--z-header`, `--z-nav`, `--z-dropdown`, `--z-overlay`, `--z-modal`, `--z-toast` | 40/40/20/50/60/70 | Escala de z-index consolidada |

Esses tokens preparam a remocao futura da sidebar do `MemberShell` (nao
removida nesta fase).

## Radius, bordas e elevacao

| Nivel | Token | Valor | Uso |
| --- | --- | --- | --- |
| Controle | `--radius-control` | 16px | Inputs e campos |
| Card | `--radius-card` | 8px | Superficies de conteudo |
| Painel | `--radius-panel` | 28px | Paineis e sheets grandes (novo nesta fase, fundacao para telas futuras) |
| Pill | `--radius-pill` | 999px | Acoes, badges, navegacao |
| Circulo | utilitario `rounded-full` do Tailwind | - | Avatares e icones circulares |

Elevacao (inalterada nesta fase, apenas documentada):

| Nivel | Token | Uso |
| --- | --- | --- |
| Hairline | `--shadow-hairline` | Separacao sutil |
| Soft | `--shadow-soft` | Glass leve |
| Lift | `--shadow-lift` | Dialogos e sheets |
| Glow accent | `--shadow-glow-accent` | Hero, progresso, conquistas (uso reservado) |

Sombras sao sempre escuras/discretas, nunca sombras claras genericas de
template.

## Motion

| Token | Valor | Uso |
| --- | --- | --- |
| `--motion-fast` / `--motion-press` | 140ms | Feedback imediato, press |
| `--motion-base` / `--motion-hover` | 220ms | Hover, focus, controles |
| `--motion-slow` / `--motion-entrance` / `--motion-progress` | 420ms | Entrada, progresso, surfaces |
| `--motion-exit` | 140ms | Saida rapida |
| `--motion-reveal` | 560ms | Revelacao de conteudo (uso futuro em scroll) |
| `--motion-celebration` | 900ms | Celebracao (token preparado; nenhuma animacao de celebracao foi implementada ainda) |
| `--ease-premium` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Movimento premium (hero, emphasis) |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Transicoes utilitarias simples |

`prefers-reduced-motion: reduce` continua desativando transicoes/animacoes
globalmente (`transition-duration`/`animation-duration` forcados a 1ms).
Nenhuma biblioteca de animacao foi adicionada nesta fase.

## Assinatura

A assinatura visual da marca combina o logo oficial com o `rhythm rail`: uma
leitura de 30 pontos que representa o ciclo sem transformar a interface em
calendario generico.

## Componentes

Primitives existentes (inalterados nesta fase):

- botoes, inputs, textareas, switches, checkboxes, radio buttons;
- progress, badges, cards;
- dialogs, sheets, dropdowns;
- navegacao, loading, skeleton;
- empty states, estados de erro, estados de sucesso.

Novo componente desta fase:

- `BrandLogo` (`src/components/brand/brand-logo.tsx`) - unico componente de
  marca reutilizavel, ver secao "Identidade e uso do logo" acima.

## Regras De Qualidade

Antes de uma tela ser considerada pronta:

- validar alinhamentos;
- revisar espacamento mobile;
- confirmar contraste (AA);
- conferir estados hover, active, focus, disabled e loading;
- respeitar reduced motion;
- testar visualmente em mobile e desktop.

## Usos a evitar

- Nao recriar, redesenhar, recortar ou aplicar filtro no logo oficial.
- Nao inventar variantes do logo (horizontal, monocromatica) que nao existem
  no arquivo oficial.
- Nao usar `Flame` como marca.
- Nao aplicar glow/gradiente em texto de corpo longo.
- Nao deixar todos os elementos com o mesmo radius (usar os niveis
  control/card/panel/pill de forma coerente).
- Nao sacrificar contraste (AA) em nome de estetica.
