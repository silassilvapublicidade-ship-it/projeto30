# Projeto 30

Plataforma de desafios de 30 dias para evolução integral em quatro pilares —
**Corpo, Mente, Caráter e Espírito** — combinando hábitos diários, um Diário
pessoal privado, uma Biblioteca de conteúdo curado (com geração assistida por
IA sob revisão humana obrigatória), conquistas, notificações inteligentes e
um cockpit administrativo completo.

## Visão do produto

- **Hoje**: o usuário registra hábitos e reflexão do dia; a finalização,
  pontuação, sequência e desbloqueio de conquistas são calculados inteiramente
  em SQL (`finalize_daily_log_with_responses`), nunca no cliente.
- **Diário**: reflexões diárias em `/app/diario`, estritamente privadas —
  ninguém além do próprio usuário lê o conteúdo (nem admin comum, nem
  super_admin; ver `docs/decisions.md`).
- **Biblioteca**: conteúdo curado por pilar em `/app/biblioteca`, com fluxo
  editorial completo (rascunho → revisão → aprovado → publicado/agendado) em
  `/admin/biblioteca`, incluindo geração assistida por IA opcional que nunca
  publica sozinha (ver ADR-011 em `docs/decisions.md`).
- **Desafios, Conquistas, Dicas**: ciclos de 30 dias, marcos desbloqueáveis
  com cartões de compartilhamento, e conteúdo visual rápido (com link "Quero
  aprender mais" para a Biblioteca quando fizer sentido).
- **Feedback**: usuários relatam problemas/sugestões; quando o admin responde
  ou muda o status para planejado/resolvido, uma notificação fecha o ciclo
  automaticamente (nunca com o texto da resposta no push).
- **Notificações**: um único motor de campanhas para lembretes, campanhas
  manuais do admin e automações orientadas a evento.
- **Admin**: cockpit operacional, gestão de usuários/desafios/Biblioteca/
  notificações/feedback, Observabilidade (erros, auditoria de Storage) e
  limpeza de retenção.

## Stack

- Next.js App Router (Server Components / Server Actions)
- React, TypeScript estrito (`strict` + `noUncheckedIndexedAccess` +
  `exactOptionalPropertyTypes`)
- Tailwind CSS v4 com tokens de design (`docs/design-system.md`)
- Supabase: Auth, PostgreSQL, RLS, RPCs `security definer`, Storage
- Zod para validação de ambiente, formulários e saída de IA
- Vitest para regras de negócio e testes de comportamento (services com o
  cliente Supabase mockado na fronteira — ver `src/test/server-only-stub.ts`)
- Prettier e ESLint

## Executar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

A aplicação abre em `http://localhost:3000`. Sem Supabase conectado, as
telas públicas carregam normalmente; login, dados e a maior parte das
páginas exigem preencher as variáveis abaixo.

## Variáveis de ambiente

Ver `.env.example` para a lista completa e comentada. Resumo:

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Cliente Supabase (browser + server) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim para admin/cron/push | Cliente com service role, server-only |
| `AUTH_REDIRECT_URL` | Sim | Callback de OAuth/magic link |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Sim para push | Web Push (gerar com `npx web-push generate-vapid-keys`) |
| `CRON_CONTROL_SECRET` | Sim para o cron de notificações | Autentica `/api/cron/notifications/process` |
| `LIBRARY_AI_ENABLED` | Não (padrão `false`) | Feature flag mestra da geração por IA da Biblioteca — enquanto não for exatamente `"true"`, nenhuma chamada ao provedor acontece e a UI mostra "Em breve" no lugar do botão "Gerar com IA" |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Opcional, só com a flag `true` | Provedor de IA da Biblioteca (`/admin/biblioteca/gerar`) — sem elas, a rota mostra "IA não configurada" em vez de quebrar |
| `SENTRY_DSN` | Opcional | Observabilidade externa (hook reservado) |

Nenhuma chave sensível é lida no client — `src/lib/env/server.ts` é
`server-only`; `src/lib/env/client.ts` só expõe o que já é público por
natureza.

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run build
npm run verify   # typecheck + lint + test + build, em sequência
```

## Supabase e migrations

Todo o schema vive em `supabase/migrations/`, numeradas sequencialmente
(atualmente até `0090`, ver `LATEST_MIGRATION_ID` em
`src/config/system-version.ts` — mantido manualmente em sincronia). Regras:

- **Nunca editar uma migration já aplicada.** Correções e evoluções são
  sempre uma migration nova, mesmo que reescrevam uma função existente via
  `create or replace function` (ex.: `0081_journal_privacy_hardening.sql`
  reescreve `admin_participant_detail()` original de `0006`).
- Escritas sensíveis (jornada, pontos, sequência, conquistas, diário) passam
  por RPCs `security definer` com `set search_path = public, pg_temp`,
  nunca por INSERT/UPDATE direto do cliente onde uma regra de negócio real
  está em jogo. RLS cobre leitura e os poucos casos de escrita simples.
- Antes de aplicar contra produção, toda migration deste projeto é validada
  numa transação com rollback (`begin; ...; rollback;` via
  `supabase db query --linked`) impersonando um usuário real com
  `set local request.jwt.claim.sub = '<uuid>'`.
- Aplicar com `npx supabase db push --linked`; confirmar que
  `supabase migration list --linked` mostra local e remoto sincronizados.

Detalhes de schema em `docs/database.md`; analytics administrativo em
`docs/admin-analytics.md`.

## Testes

```bash
npm run test
```

Duas categorias convivem no repositório, cada uma com seu propósito:

- **Testes de comportamento real**: núcleos puros (`src/features/*/*.core.ts`)
  testados diretamente, e serviços de I/O (`src/server/services/**`,
  `src/server/ai/**`) testados com o cliente Supabase mockado na fronteira
  (`vi.mock` de `@/lib/supabase/server` / `@/lib/supabase/admin`) — provam
  comportamento de runtime real (parâmetros enviados à RPC, mapeamento de
  resposta, caminhos de erro), não apenas que uma string existe no arquivo.
- **Testes de regressão de código-fonte** (`readFileSync` + `toContain`/
  `toMatch`): usados deliberadamente só como guardrail para não perder um
  fix específico já validado contra produção (ex.: o texto exato de uma
  migration) ou para travar uma invariante que o TypeScript não pega sozinho
  (ex.: nenhum código chama uma RPC já revogada). Nunca tratados como prova
  de comportamento em runtime.

`src/test/server-only-stub.ts` (aliasado só no Vitest, nunca no build de
produção) permite importar diretamente arquivos com `import "server-only"`
em teste, o que viabiliza a primeira categoria acima para arquivos de
serviço.

## Deploy

Deploy contínuo via Vercel a partir de `main`. Checklist antes de mesclar:

```bash
npm run verify
npx supabase migration list --linked   # confirma local == remoto
```

`src/config/system-version.ts` expõe `APP_VERSION` (de `package.json`),
`LATEST_MIGRATION_ID` (mantido manualmente) e informações de deploy lidas
das variáveis de sistema da própria Vercel — usadas no cockpit
(`/admin`) e em Observabilidade (`/admin/observabilidade`).

## Segurança

- RLS habilitada em toda tabela com dado de usuário; onde a regra de negócio
  é complexa demais para uma policy, a tabela tem **zero policies de
  escrita** e só é mutável via RPC `security definer` (padrão usado por
  `journal_entries`, `user_feedback`, `system_error_events`).
- `SUPABASE_SERVICE_ROLE_KEY` só é lida em `src/lib/supabase/admin.ts`
  (`server-only`) — nunca em Client Components, nunca enviada ao browser.
- IA da Biblioteca vem **desligada por padrão** (`LIBRARY_AI_ENABLED`,
  padrão `false`) — enquanto desligada, nenhuma chamada ao provedor, nenhuma
  checagem de configuração e nenhum consumo de limite de geração acontece;
  a arquitetura inteira (schema, RPCs, service, provider, prompts, testes)
  continua intacta, só inativa. Quando configurada (flag `true`), o server
  monta um contexto explícito e restrito (allowlist) antes de qualquer
  chamada ao provedor; nenhum texto de usuário final (diário, feedback,
  e-mail, dado médico) entra nesse contexto. Saída sempre validada por
  schema Zod; inválida nunca é salva. Conteúdo gerado nunca publica
  sozinho — ver ADR-011 em `docs/decisions.md`.
- Rotas administrativas exigem papel `admin`/`super_admin`
  (`requireAdminUser`); algumas ações (exclusão de feedback, dados
  técnicos sensíveis de Observabilidade) exigem especificamente
  `super_admin`.

## Documentação

- `docs/architecture.md` — direção arquitetural e módulos
- `docs/database.md` — schema e convenções de banco
- `docs/decisions.md` — decisões técnicas (ADRs)
- `docs/admin-analytics.md` — analytics e cockpit administrativo
- `docs/design-system.md` — tokens visuais e componentes
- `docs/product-principles.md` — princípios de produto
- `docs/phase-1-acceptance.md` — critérios de aceite da fundação inicial
  (histórico)
- `docs/specs/` — lógica original de pontos/sequência em TypeScript,
  preservada como documentação histórica; **não executa em produção** (a
  regra real está em SQL desde `supabase/migrations/0037+`)
