# Fase 2 — Analytics e Gestão Administrativa

Painel administrativo real (dashboard, analytics por desafio, gestão de
participantes) construído sobre a fundação de autenticação e layout já entregue na
Fase A (`requireAdminUser`, `AdminShell`, navegação em `src/components/admin/`).

## Rotas

O domínio já usava rotas em português (`/admin/desafios`, `/admin/participantes`).
Esta fase preserva esse padrão e aninha participantes sob o desafio, já que toda
métrica de participante só faz sentido no contexto de um ciclo específico.

| Rota pedida na especificação | Rota real neste projeto |
| --- | --- |
| `/admin` | `/admin` (dashboard, reescrito) |
| `/admin/challenges` | `/admin/desafios` (lista, reescrita) |
| `/admin/challenges/[challengeId]` | `/admin/desafios/[challengeId]` (novo) |
| `/admin/challenges/[challengeId]/participants` | `/admin/desafios/[challengeId]/participantes` (novo) |
| — | `/admin/desafios/[challengeId]/participantes/[enrollmentId]` (novo, detalhe do participante) |

A antiga rota plana `/admin/participantes` (Fase A, placeholder) continua existindo,
mas agora só explica a mudança e linka para `/admin/desafios` — não há mais uma
listagem "todos os participantes de todos os desafios" nesta fase, porque nenhuma
métrica pedida (progresso, pontos, sequência, atividade) faz sentido fora do
contexto de um desafio.

## Arquitetura

Sem mudança de padrão: Server Components fazem a leitura, Server Actions fazem as
mutações de status, e toda a agregação pesada vive no banco, não no cliente.

```
Página (Server Component)
  -> src/server/services/admin-analytics.service.ts (supabase.rpc(...))
    -> supabase/migrations/0006_admin_analytics.sql (funções security definer)
  -> src/features/admin/admin-analytics.schemas.ts (parse de filtros/paginação, puro)
  -> src/features/admin/admin-metrics.core.ts (formatação/labels, puro)
```

Mutações de status de desafio (`publicar`/`despublicar`/`arquivar`) ficam em
`src/features/admin/admin-challenges.actions.ts`, como Server Actions que chamam
`requireAdminUser()` e depois fazem um `update` direto em `challenges`, protegido
pela RLS existente ("Admins can manage challenges"). Não foi necessário criar RPC
para essas transições — são updates simples de coluna, já cobertos pela RLS.

## Por que funções SQL e não queries agregadas no cliente

Ver ADR-008 em `docs/decisions.md`. Resumo: uma `view` ou uma agregação feita
"na mão" via várias chamadas do client Supabase herdaria a RLS de cada tabela
isoladamente, e para um usuário comum isso não bloqueia — devolve números errados
calculados só sobre o que ele pode ver. Funções `security definer` com
`public.is_admin()` checado explicitamente sempre bloqueiam com erro `42501` para
quem não é admin/super_admin, e ainda evitam N+1 (uma função = uma viagem ao
banco, mesmo fazendo várias sub-consultas internas).

## Funções criadas (`supabase/migrations/0006_admin_analytics.sql`)

Todas `stable security definer`, todas revogadas de `anon`/`authenticated` por
padrão e liberadas via `grant execute ... to authenticated` (a checagem de admin
acontece dentro da função, não no grant — o mesmo padrão das RPCs de jornada).

- `admin_require_admin()` — helper interno; lança `42501` se o papel do usuário
  autenticado não for `admin` nem `super_admin`, senão devolve o papel.
- `admin_dashboard_overview()` — números do dashboard (seção "Definição das
  métricas" abaixo).
- `admin_list_challenges(p_search, p_status, p_sort_by, p_sort_dir, p_limit, p_offset)`
  — lista paginada de desafios com contagem de participantes e progresso médio via
  `lateral join`, mais `count(*) over()` para o total (uma única consulta).
- `admin_challenge_detail(p_challenge_id)` — KPIs do desafio, evolução de
  inscrições (últimos 60 dias com registro), conclusão diária por dia do ciclo,
  adesão por hábito e distribuição de progresso.
- `admin_list_participants(p_challenge_id, p_search, p_status, p_activity, p_min_progress, p_max_progress, p_sort_by, p_sort_dir, p_limit, p_offset)`
  — lista paginada de participantes de um desafio, com atividade derivada e
  `count(*) over()` para o total.
- `admin_participant_detail(p_enrollment_id)` — detalhe completo de um
  participante: histórico diário, conquistas e, **apenas se o papel do chamador for
  `super_admin`**, as reflexões (`journal_entries`). O JSON de retorno sempre inclui
  `reflections_visible: boolean` para a UI saber se deve mostrar o aviso de
  restrição.

`p_sort_by`/`p_sort_dir` são validados contra uma lista fixa de colunas permitidas
dentro da própria função antes de compor o `ORDER BY` dinamicamente — não há
interpolação de texto livre do usuário na query.

## Definição de cada métrica

- **Participante ativo**: inscrição com `status = 'active'` **e** ao menos um
  `daily_logs.updated_at` nos últimos **3 dias** (`ADMIN_ACTIVE_WINDOW_DAYS` em
  `admin-metrics.core.ts`, mesmo valor hardcoded como `interval '3 days'` em cada
  função SQL — os dois precisam ser mantidos em sincronia manualmente, não há uma
  fonte única hoje).
- **Participante inativo**: tudo que não é `completed` nem `active`-com-atividade-
  recente (cobre `active` parado, `paused`, `abandoned`, `restarted`). É o
  complemento dos outros dois grupos, garantindo que todo participante caia em
  exatamente um dos três buckets (`active` / `inactive` / `completed`).
- **Participante concluído**: `challenge_enrollments.status = 'completed'`.
- **Progresso**: lido diretamente de `challenge_enrollments.completion_percent`
  (já calculado e persistido por `finalize_daily_log()` como
  `dias finalizados / duration_days`). Nunca recalculado com uma fórmula diferente.
- **Sequência (atual e recorde)**: lida diretamente de `streak_current` e
  `streak_best` em `challenge_enrollments`, ambos escritos por
  `finalize_daily_log()`. Nunca recalculada aqui.
- **Taxa de conclusão do desafio**: `participantes com status completed / total de
  inscritos` daquele desafio.
- **Adesão por hábito**: `conclusões do hábito / oportunidades`, onde
  "oportunidade" é um `daily_logs` existente para um dia que inclui aquele hábito
  (via `challenge_day_habits`) e cujo `habit_log` (se existir) não está
  `not_applicable` — mesmo critério usado por `journey_recalculate_daily_log()`
  para excluir hábitos não aplicáveis do denominador.
- **Distribuição de progresso**: contagem de inscrições em 5 faixas fixas (0–20,
  21–40, 41–60, 61–80, 81–100%) de `completion_percent`.
- **Dias finalizados**: contagem de `daily_logs.status = 'finalized'`.

## Autorização

- `requireAdminUser()` (Fase A, inalterado) protege o layout `/admin` inteiro —
  qualquer página nova herda essa proteção automaticamente.
- Cada função `admin_*` do banco chama `admin_require_admin()` internamente, então
  mesmo que alguém chamasse a RPC diretamente (fora da UI), receberia `42501`.
- Reflexões (`journal_entries`) só entram no JSON de `admin_participant_detail`
  quando o papel é `super_admin` — `admin` comum recebe `reflections_visible: false`
  e nenhum conteúdo de diário.
- Nenhuma chave privilegiada (`service_role`) é usada nesta fase — todas as
  leituras passam pelo cliente autenticado normal (`createSupabaseServerClient`),
  sempre no servidor.

## Paginação

Server-side, tamanho fixo de 20 itens (`ADMIN_PAGE_SIZE` em
`admin-analytics.schemas.ts`). Cada função de listagem devolve `total_count` via
`count(*) over()` na mesma consulta — nunca uma segunda query de contagem, nunca o
dataset inteiro carregado no cliente.

## Estados de UI

- `loading.tsx` em `/admin` e `/admin/desafios` (cobre também as rotas aninhadas de
  desafio/participantes, que herdam o boundary mais próximo).
- `error.tsx` em `/admin` (mesmo padrão já usado em `/app`).
- Estado vazio (`EmptyState`) quando filtros não retornam nada, quando um desafio
  não tem inscrições, dias configurados ou hábitos.
- Estado de erro (`StatusCard tone="error"`) quando a função SQL falha ou nega
  acesso.
- Feedback de ação (`?feedback=publish-success` etc.) após publicar/despublicar/
  arquivar um desafio.

## Validação executada (banco real)

Sem Docker/Podman neste ambiente, não é possível rodar um Supabase local
(`supabase start`). Não havia também um segundo projeto Supabase configurado
como staging — `.env.local` só aponta para um único projeto remoto. Com
autorização explícita, esse projeto foi usado como ambiente de validação via
`supabase db push` / `supabase db query --linked` (sem tocar em dados de
produção além de aplicar a própria migration).

- **Bug real encontrado e corrigido**: `admin_require_admin()` usava uma
  variável local chamada `current_role`, que é uma palavra reservada do
  Postgres (`CURRENT_ROLE`). Isso quebrava a aplicação da migration inteira com
  `42601: syntax error at or near "current_role"`. Renomeada para
  `v_current_role` em `0006_admin_analytics.sql`.
- **Migration aplicada** com sucesso após a correção (`supabase db push`,
  confirmado via `supabase migration list`: `0006` local e remoto batem).
- **Autorização testada com identidades reais**: sem sessão → `42501`; conta QA
  real (`role = 'user'`) chamando `admin_participant_detail` → `42501`; conta
  `super_admin` real chamando todas as 5 funções → dados retornados
  corretamente.
- **Restrição de reflexões testada**: com a conta `super_admin` real,
  `reflections_visible: true` e `reflections: []` (sem entradas ainda). Para
  testar o papel `admin` comum sem criar uma conta nova nem tocar em QA/
  super_admin, `current_user_role()` foi temporariamente substituída (dentro da
  mesma transação de teste) por uma versão que retorna `'admin'` fixo, a
  chamada foi repetida (resultado: `reflections_visible: false`,
  `reflections: null` — correto) e a função original foi restaurada
  imediatamente depois, com a restauração confirmada por uma nova chamada como
  `super_admin`.
- **Métricas conferidas**: números do dashboard batem com a soma dos desafios/
  inscrições reais (2 desafios ativos, 2 inscrições, 1 participante ativo);
  `admin_challenge_detail` devolveu exatamente `duration_days` linhas em
  `daily_completion` e um bucket de distribuição coerente com o progresso real
  (0%) da única inscrição do desafio testado.
- **Filtros e paginação testados**: busca por nome/slug, filtro de status
  (`draft` corretamente vazio), filtro de atividade (`active` vazio para um
  participante inativo), faixa de progresso (`minProgress=50` corretamente
  vazio), `limit`/`offset` (offset 1 devolveu a segunda linha da ordenação,
  `total_count` consistente entre páginas).

Nenhum dado de usuário foi alterado durante essa validação — apenas leituras e
a aplicação da própria migration (que só cria funções, não altera linhas).

## Limitações conhecidas

- **Criar/editar desafio não foi implementado.** A especificação desta fase não
  detalhou os campos de um formulário de criação/edição (nome, slug, duração,
  datas, `rules_config`, dias, hábitos) e isso é um escopo de conteúdo maior,
  separado de analytics/gestão. Publicar, despublicar e arquivar (transições de
  status) foram implementados; criar e editar ficam para uma fase futura.
- **Janela de "ativo" duplicada.** `ADMIN_ACTIVE_WINDOW_DAYS = 3` existe tanto em
  `admin-metrics.core.ts` (só para texto de UI) quanto hardcoded em 4 funções SQL
  (fonte de verdade real). Se o valor mudar, os dois lugares precisam ser
  atualizados manualmente — não há um mecanismo automático de sincronização.
- **Menu mobile do admin.** A navegação administrativa mobile já existente (Fase A,
  `AdminMobileNavigation`) não foi alterada; ela continua cobrindo os itens de
  primeiro nível (Desafios, Participantes etc.), não os sub-níveis novos
  (detalhe do desafio, participantes por desafio) — a navegação para essas telas
  acontece por link dentro da própria página, não por um item de menu dedicado.

## Possíveis melhorias futuras

- Extrair `ADMIN_ACTIVE_WINDOW_DAYS` para uma única fonte (ex.: uma função SQL
  `admin_active_window()` que os outros `admin_*` chamam, e que o serviço TS lê via
  RPC em vez de duplicar o número).
- Adicionar exportação (CSV) da lista de participantes filtrada.
- Formulário de criação/edição de desafio, hábitos e dias do ciclo.
- Testar as funções SQL contra um Postgres real assim que houver Docker/Podman
  disponível no ambiente, substituindo parte da cobertura estática por testes de
  integração de verdade.
