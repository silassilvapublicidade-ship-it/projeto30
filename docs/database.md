# Banco De Dados

## Modelo inicial

```mermaid
erDiagram
  users ||--|| user_preferences : has
  users ||--o{ challenge_enrollments : joins
  users ||--o{ journal_entries : writes
  users ||--o{ point_events : receives
  users ||--o{ user_achievements : unlocks
  users ||--o{ share_cards : generates
  users ||--o{ notifications : receives

  challenges ||--o{ challenge_days : contains
  challenges ||--o{ habits : configures
  challenges ||--o{ challenge_enrollments : receives
  challenges ||--o{ achievements : scopes
  challenges ||--o{ reading_plans : owns
  challenges ||--o{ share_templates : styles
  challenges ||--o{ content_items : publishes

  challenge_days ||--o{ challenge_day_habits : lists
  habits ||--o{ challenge_day_habits : appears_in
  challenge_enrollments ||--o{ daily_logs : records
  challenge_enrollments ||--o{ point_events : aggregates
  daily_logs ||--o{ habit_logs : contains
  daily_logs ||--|| journal_entries : has
  daily_logs ||--o{ point_events : creates
  daily_logs ||--o{ share_cards : generates
  achievements ||--o{ user_achievements : unlocks
  reading_plans ||--o{ reading_plan_items : contains
  share_templates ||--o{ share_cards : renders
```

## Tabelas

- `users`
- `user_preferences`
- `challenges`
- `challenge_days`
- `habits`
- `challenge_day_habits`
- `challenge_enrollments`
- `daily_logs`
- `habit_logs`
- `journal_entries`
- `point_events`
- `achievements`
- `user_achievements`
- `reading_plans`
- `reading_plan_items`
- `share_templates`
- `share_cards`
- `content_items`
- `notifications`
- `admin_audit_logs`

## Segurança

RLS está habilitado em todas as tabelas públicas. A política inicial é
conservadora:

- usuários leem apenas os próprios dados;
- diário, logs, pontos, cards e conquistas do usuário são privados;
- desafios ativos, hábitos ativos, plano de leitura publicado, conquistas ativas e
  conteúdo publicado podem ser lidos;
- escritas sensíveis de jornada, pontuação, diário e conquistas ficam reservadas ao
  servidor ou ao administrador;
- administradores usam políticas específicas via `public.is_admin()`.

## Jornada Diaria

A Fase 2D propoe a migration `0002_daily_journey_core.sql` para evitar que o cliente
seja fonte de verdade. As tabelas `challenge_enrollments`, `daily_logs`,
`habit_logs`, `journal_entries`, `point_events` e `user_achievements` continuam sem
escrita direta para usuario comum. A aplicacao chama RPCs autenticadas, com
`SECURITY DEFINER`, `search_path` explicito e validacao de `auth.uid()` antes de
qualquer alteracao.

RPCs propostas:

- `join_available_challenge()`
- `ensure_today_daily_log(uuid)`
- `update_habit_log(uuid, uuid, habit_log_status, jsonb, text)`
- `save_journal_entry(uuid, text, text, text, text, text, text)`
- `finalize_daily_log(uuid)`

A finalizacao e idempotente: pontos sao gravados em `point_events` com
`idempotency_key`, a sequencia e recalculada no servidor e conquistas sao registradas
com constraint unica em `user_achievements`.

## Pontuação

`point_events` é o ledger de pontuação. Cada evento tem `idempotency_key` única para
evitar duplicação ao repetir uma finalização ou reprocessamento.

## Ciclos e Histórico

O modelo trata cada participação como uma linha em `challenge_enrollments`. Um usuário
pode participar de desafios diferentes ou voltar ao mesmo desafio em outro momento,
desde que não tenha duas inscrições simultâneas `active` ou `paused` para o mesmo
desafio.

Dados diários e históricos carregam o vínculo com a inscrição e, quando necessário,
com o desafio:

- `daily_logs` valida que o dia pertence ao mesmo desafio da inscrição;
- `habit_logs` valida que o hábito pertence ao dia registrado;
- `journal_entries`, `point_events`, `user_achievements` e `share_cards` validam que
  usuário, inscrição e desafio apontam para o mesmo ciclo;
- conquistas e templates de compartilhamento são escopados ao desafio.

Essa estrutura permite arquivar um desafio, criar outro e preservar o histórico antigo
sem alterar a estrutura do banco.

## Primeiro Administrador

A criação do primeiro administrador não é feita por RPC pública nem pelo cliente.
O fluxo aprovado é:

1. cadastrar o usuário normalmente pelo fluxo de autenticação;
2. abrir o SQL Editor do Supabase;
3. promover manualmente o usuário pelo e-mail cadastrado;
4. conferir que apenas um operador autorizado executou o procedimento.

Use o SQL abaixo substituindo somente o placeholder `ADMIN_EMAIL_AQUI`:

```sql
update public.users
set role = 'admin'::public.user_role,
    updated_at = now()
where id = (
  select id
  from auth.users
  where email = 'ADMIN_EMAIL_AQUI'
);
```

O usuário nunca deve conseguir alterar o próprio `role` pela aplicação.

## Analytics Administrativo (Fase 2)

A migration `0006_admin_analytics.sql` adiciona funções somente-leitura
`security definer` para o painel administrativo (`admin_dashboard_overview`,
`admin_list_challenges`, `admin_challenge_detail`, `admin_list_participants`,
`admin_participant_detail`), todas gated por `public.is_admin()` internamente.
Fórmulas de métricas, contrato de cada função e limitações conhecidas estão em
`docs/admin-analytics.md`.

## Foto de perfil e Storage (Fase 3)

Auditoria prévia (`select * from storage.buckets`) não encontrou nenhum bucket
configurado — não havia padrão existente para reutilizar. A migration
`0007_profile_avatars.sql` cria o primeiro:

- bucket `avatars`, **público para leitura** (fotos de perfil não são dado
  sensível, diferente do diário); escrita/atualização/remoção restritas ao
  próprio dono via RLS em `storage.objects`, checando
  `(storage.foldername(name))[1] = auth.uid()::text`;
- caminho fixo `avatars/{userId}/profile.<ext>` — o `{userId}` vem sempre de
  `auth.uid()` no servidor (nunca do nome de arquivo enviado pelo cliente ou
  de outro campo controlável pelo usuário), então a extensão é derivada do
  MIME type validado, nunca do nome original do arquivo;
- formatos aceitos: JPEG, PNG, WebP (SVG é rejeitado de propósito, para evitar
  XSS armazenado via `<script>` embutido em SVG); limite de 5 MB.

`public.users.avatar_url` e `public.users.city` já existiam desde
`0001_initial_schema.sql` — nenhuma coluna nova foi necessária para o perfil.

Como não existe uma política "usuário atualiza o próprio perfil" em
`public.users` (só existe leitura própria e escrita por admin), a atualização
de `name`/`display_name`/`city`/`avatar_url` usa `createSupabaseAdminClient()`
no server action, no mesmo padrão já usado por `completeOnboardingAction` no
onboarding — nunca no browser.

### Troca de senha

O Supabase Auth não expõe uma checagem isolada de "senha atual" sem afetar a
sessão. A confirmação real (não simulada) é reautenticar com
`supabase.auth.signInWithPassword({ email, password: senhaAtual })` antes de
chamar `supabase.auth.updateUser({ password: novaSenha })`. Se a
reautenticação falhar, a senha atual está incorreta — não há verificação
falsa.
