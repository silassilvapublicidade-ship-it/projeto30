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

## Pontuação

`point_events` é o ledger de pontuação. Cada evento tem `idempotency_key` única para
evitar duplicação ao repetir uma finalização ou reprocessamento.
