-- Modulo F: janela permitida para o lembrete diario (07:00-22:00),
-- exigida pelo briefing do produto. Validado tambem em
-- notification-preferences.schemas.ts (zod) - o constraint aqui e
-- defesa em profundidade caso alguma escrita futura pule a Server Action.
alter table public.user_preferences
  drop constraint if exists user_preferences_reminder_time_window;
alter table public.user_preferences
  add constraint user_preferences_reminder_time_window check (
    reminder_time is null
    or (reminder_time >= time '07:00' and reminder_time <= time '22:00')
  );
