-- Projeto 30 - Fase 2G - Desafio de Agosto - Irreconhecivel
--
-- FINALIDADE
-- Cria o primeiro desafio oficial do Projeto 30 (slug: desafio-agosto-irreconhecivel)
-- para uso em testes funcionais reais, validacao de UX, pontuacao, jornada e
-- conquistas, e futura divulgacao publica.
--
-- ESTE SCRIPT E ADMINISTRATIVO.
-- - NAO e uma migration (nao pertence a supabase/migrations e nao deve ser
--   aplicado via `supabase db push`).
-- - NAO e seed (nao roda automaticamente em nenhum pipeline).
-- - NAO deve ser executado automaticamente por CI, cron ou build.
-- - So atua no banco remoto quando executado explicitamente por um operador,
--   com o Supabase CLI ja autenticado e linkado ao projeto correto:
--     npx.cmd supabase db query --linked --file scripts\challenges\create-august-irreconhecivel.sql
-- - NAO contem credenciais, chaves ou segredos.
-- - Qualquer alteracao destrutiva (delete/drop) exige aprovacao explicita e
--   fica isolada em bloco comentado ao final do arquivo.
--
-- O QUE ESTE SCRIPT NUNCA FAZ
-- - Nao cria usuarios (auth.users / public.users).
-- - Nao cria challenge_enrollments, daily_logs, habit_logs, journal_entries,
--   point_events ou user_achievements.
-- - Nao altera o desafio interno "Projeto 30 - Validacao Interna"
--   (slug projeto-30-validacao-interna, id a2300000-0000-4000-8000-000000000001).
-- - Nao publica o desafio (status inicial e 'draft' - ver secao STATUS abaixo).
--
-- IDEMPOTENCIA
-- IDs fixos (UUIDs deterministicos) + ON CONFLICT DO UPDATE somente nos
-- registros deste desafio. Pode ser executado quantas vezes forem necessarias
-- sem duplicar linhas.
--
-- FAIXA DE UUIDS (exclusiva, distinta da faixa a2300000-... usada pelo desafio
-- de validacao interna):
--   Challenge:            a3080000-0000-4000-8000-000000000001
--   Dias (31):            a3080000-0000-4000-8001-000000000001 .. 000000000031
--   Habitos (13):         a3080000-0000-4000-8002-000000000001 .. 000000000013
--   Vinculos dia-habito:  a3080000-0000-4000-81DD-0000000000HH
--                         DD = numero do dia com 2 digitos (01-31)
--                         HH = numero do habito com 2 digitos (01-13)
--                         (31 dias x 13 habitos = 403 vinculos)
--   Achievements (10):    a3080000-0000-4000-8003-000000000001 .. 000000000010
--
-- STATUS
-- O desafio e criado com status = 'draft' (variavel target_status abaixo).
-- Motivo: RLS ("Anyone can read active challenges") e join_available_challenge()
-- so consideram desafios com status = 'active'. Com 'draft' o desafio fica
-- invisivel em listagens publicas e impossivel de "entrar" via
-- join_available_challenge() - nao ha risco de inscricao real acidental.
-- Para testes funcionais ponta a ponta (que exigem status ativo), troque
-- manualmente o valor de target_status abaixo para 'active' e rode de novo;
-- isso NAO e feito automaticamente por este script.
--
-- LIMITACOES CONHECIDAS DO MOTOR ATUAL (documentadas, nao corrigidas aqui):
-- 1) journey_recalculate_daily_log / finalize_daily_log calculam
--    completion_percent e o bonus de 100% sobre TODOS os habitos vinculados
--    ao dia, exceto os marcados 'not_applicable'. O campo
--    challenge_day_habits.required NAO filtra esse calculo. Os habitos
--    opcionais (Musculacao, Autocuidado) so ficam fora da conta se o usuario
--    tocar em "Nao se aplica" (botao ja disponivel na UI para missoes com
--    required = false). Se ficarem "pendentes", eles reduzem o
--    completion_percent e bloqueiam o bonus de +30, mesmo com os 11
--    obrigatorios 100% concluidos. Evolucao futura (nao aplicada aqui):
--    migration para os calculos considerarem apenas habitos required = true.
-- 2) O icone 'dumbbell' (pedido para Musculacao) esta na lista de icones que
--    finalize_daily_log usa para contar "atividade fisica" na conquista
--    sete-atividades-fisicas, junto com a categoria canonica. Mesmo usando a
--    categoria 'treino' (nao canonica, como instruido), o icone 'dumbbell'
--    ainda faz a Musculacao contar junto com o Cardio nessa conquista. Nao
--    alterado por conta propria: o icone foi pedido explicitamente. Troque
--    para outro icone (ex.: 'flame') se quiser eliminar essa duplicidade.
-- 3) Habits nao possuem coluna de slug no schema atual. Os slugs sugeridos no
--    briefing existem apenas como comentario/documentacao neste script; a
--    identificacao real e feita pelo UUID determinístico e pelo titulo.
-- 4) achievements sao escopados por challenge_id (unique(challenge_id, slug)).
--    A migration 0002 populou os 10 achievements canonicos apenas nos
--    desafios que ja existiam quando ela rodou; nao ha trigger que repita
--    isso para desafios novos. Por isso este script insere os mesmos 10
--    achievements canonicos (mesmos slugs/definicoes da migration e do
--    script de validacao interna) escopados a este novo challenge_id - sem
--    isso, nenhuma conquista jamais desbloquearia neste ciclo.
--
-- PONTUACAO ESPERADA (ver validacao no final do arquivo):
--   11 habitos obrigatorios x 10 pts = 110
--   reflexao = 10 | finalizacao = 10 | bonus 100% = 30
--   total diario obrigatorio esperado = 160
--   + 2 habitos opcionais x 10 pts (se concluidos) = 180 (maximo possivel)

begin;

do $$
begin
  if exists (
    select 1
    from public.challenges
    where slug = 'desafio-agosto-irreconhecivel'
      and id <> 'a3080000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception
      'Desafio de Agosto ja existe com um id diferente. Abortando para nao misturar dados de ciclos distintos.';
  end if;
end;
$$;

-- CHALLENGE ------------------------------------------------------------------
-- Troque apenas este valor (draft -> active) quando decidir publicar o ciclo.
-- Nao alterado automaticamente por este script.

insert into public.challenges (
  id,
  name,
  slug,
  description,
  duration_days,
  start_date,
  end_date,
  enrollment_start,
  enrollment_end,
  status,
  theme_config,
  rules_config
)
values (
  'a3080000-0000-4000-8000-000000000001',
  'Desafio de Agosto - Irreconhecivel',
  'desafio-agosto-irreconhecivel',
  'Um desafio de transformacao pessoal baseado em disciplina, constancia e pequenas decisoes diarias. Durante o mes de agosto, o participante sera incentivado a cuidar do corpo, da mente, da fe, da alimentacao, do sono e da propria rotina.',
  31,
  date '2026-08-01',
  date '2026-08-31',
  date '2026-07-28',
  date '2026-08-05',
  'draft', -- target_status: troque para 'active' manualmente quando for publicar
  jsonb_build_object(
    'scope', 'public',
    'visibility', 'public',
    'category', 'transformacao-pessoal',
    'difficulty', 'intermediaria',
    'audience', 'adultos',
    'campaign', 'agosto_2026',
    'visual_style', 'premium_dark',
    'mood', 'intense',
    'accent', 'orange',
    'timezone', 'America/Sao_Paulo',
    'headline', 'Desafio para se tornar irreconhecivel em agosto.',
    'subheadline', 'Pequenas escolhas diarias. Grandes resultados para sempre.',
    'hero_message', 'Disciplina hoje. Liberdade amanha.',
    'tagline', 'Disciplina hoje. Liberdade amanha.',
    'entry_message', 'O melhor mes do ano comeca agora. Voce nao precisa mudar tudo de uma vez. Precisa apenas cumprir o compromisso de hoje.',
    'closing_message', 'Voce nao terminou apenas um desafio. Voce provou que consegue sustentar novas escolhas.'
  ),
  jsonb_build_object(
    'reflection_points', 10,
    'finalize_day_points', 10,
    'all_habits_bonus_points', 30,
    'streak_minimum_completion', 70,
    'journal_edit_minutes_after_finalize', 0
  )
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  duration_days = excluded.duration_days,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  enrollment_start = excluded.enrollment_start,
  enrollment_end = excluded.enrollment_end,
  status = excluded.status,
  theme_config = excluded.theme_config,
  rules_config = excluded.rules_config,
  updated_at = now();

-- DIAS (31) -------------------------------------------------------------------
-- Titulo e mensagem motivacional curta e original por dia. unlock_rule segue o
-- mesmo padrao sequencial do script de validacao interna.

with day_catalog as (
  select
    t.day_number,
    t.title,
    m.message
  from unnest(array[
    'O comeco',
    'Uma escolha',
    'Continue',
    'Sem desculpas',
    'O ritmo',
    'Mais forte',
    'Primeira semana',
    'Recomece',
    'Constancia',
    'Compromisso',
    'Corpo e mente',
    'Nao negocie',
    'Presenca',
    'Duas semanas',
    'Metade do caminho',
    'Avance',
    'Controle',
    'Disciplina',
    'Persistencia',
    'Um dia de cada vez',
    'Tres semanas',
    'Sua nova rotina',
    'Mantenha o foco',
    'Voce consegue',
    'Proximo nivel',
    'Nao pare',
    'Quase la',
    'Quatro semanas',
    'Ultimo esforco',
    'Voce mudou',
    'Irreconhecivel'
  ]) with ordinality as t(title, day_number)
  join unnest(array[
    'O comeco nao exige perfeicao. Exige presenca hoje.',
    'Cada escolha de hoje e o tijolo do mes que voce quer viver.',
    'Continuar e a prova de que ontem nao foi por acaso.',
    'Hoje nao e dia de desculpa. E dia de decisao.',
    'Encontre o seu ritmo e proteja-o como um compromisso serio.',
    'Voce esta ficando mais forte a cada escolha simples e repetida.',
    'Uma semana inteira sustentada e a sua primeira grande prova.',
    'Recomecar com honestidade vale mais que fingir que nunca parou.',
    'Constancia e o que transforma intencao em identidade.',
    'Hoje o compromisso e com quem voce decidiu se tornar.',
    'Corpo cuidado e mente presente caminham na mesma direcao.',
    'Nao negocie o essencial so porque o dia ficou dificil.',
    'Esteja presente no que voce esta construindo agora.',
    'Duas semanas de escolhas reais ja mudam a forma como voce se ve.',
    'Voce esta na metade do caminho. Ainda da tempo de fazer valer.',
    'Avance um passo, mesmo que pequeno, mesmo que devagar.',
    'Controle comeca nas pequenas decisoes que ninguem ve.',
    'Disciplina e lembrar da sua decisao mesmo quando a vontade sumiu.',
    'Persistencia e continuar depois que a novidade passou.',
    'Um dia de cada vez ainda e a forma mais honesta de mudar.',
    'Tres semanas de pratica ja vivem no seu corpo e na sua rotina.',
    'Isso que parecia esforco esta virando sua nova rotina.',
    'Mantenha o foco no que importa, nao no que e urgente.',
    'Voce ja provou, dia apos dia, que consegue sustentar isso.',
    'Um novo nivel pede a mesma constancia, so que mais profunda.',
    'Nao pare agora. O que resta e mais curto que o que voce ja andou.',
    'Esta quase la. Nao deixe o cansaco decidir por voce.',
    'Quatro semanas de disciplina construiram uma pessoa mais firme.',
    'Este e o ultimo esforco deste ciclo. Termine como comecou: presente.',
    'Voce mudou nas escolhas pequenas que ninguem aplaudiu.',
    'Irreconhecivel nao e sobre aparencia. E sobre quem voce provou que consegue ser.'
  ]) with ordinality as m(message, day_number)
    using (day_number)
)
insert into public.challenge_days (
  id,
  challenge_id,
  day_number,
  title,
  message,
  theme,
  unlock_rule
)
select
  ('a3080000-0000-4000-8001-' || lpad(day_number::text, 12, '0'))::uuid,
  'a3080000-0000-4000-8000-000000000001'::uuid,
  day_number,
  title,
  message,
  null,
  '{"type": "sequential"}'::jsonb
from day_catalog
on conflict (challenge_id, day_number) do update set
  title = excluded.title,
  message = excluded.message,
  unlock_rule = excluded.unlock_rule,
  updated_at = now();

-- HABITOS (13) ------------------------------------------------------------------
-- seq 1-13 define o UUID do habito e do vinculo dia-habito (HH abaixo).
-- required = obrigatorio para os 11 primeiros; opcional (false) para
-- Musculacao (seq 2) e Autocuidado (seq 11).
-- validation_config carrega meta/unidade; para Musculacao e Autocuidado carrega
-- tambem a meta conceitual original (4x/semana e 2x/mes) apenas como metadado
-- informativo, sem qualquer enforcement semanal/mensal no motor atual.

with habit_catalog(
  seq, title, description, category, habit_type, icon, points, is_required, validation_config, sort_order
) as (
  values
    (1, 'Agua', 'Beba no minimo 3 litros de agua ao longo do dia.', 'hidratacao', 'quantity'::public.habit_type, 'droplets', 10, true,
      '{"target": 3000, "unit": "ml", "metric": "agua"}'::jsonb, 10),
    (2, 'Musculacao', 'Registre se realizou treino de musculacao no dia.', 'treino', 'boolean'::public.habit_type, 'dumbbell', 10, false,
      '{"label": "Confirmar com honestidade", "conceptual_weekly_target": 4, "note": "Meta conceitual: 4 sessoes por semana. Registrado como check-in diario opcional; dias de descanso nao sao penalizados. Sem regra semanal no motor atual."}'::jsonb, 20),
    (3, 'Cardio', 'Faca pelo menos 30 minutos de cardio.', 'atividade fisica', 'duration'::public.habit_type, 'activity', 10, true,
      '{"target": 30, "unit": "min", "metric": "cardio"}'::jsonb, 30),
    (4, 'Sol', 'Tenha pelo menos 15 minutos de exposicao consciente ao sol.', 'bem-estar', 'duration'::public.habit_type, 'sun', 10, true,
      '{"target": 15, "unit": "min", "metric": "sol"}'::jsonb, 40),
    (5, 'Sem cafeina apos 16h', 'Evite consumir cafe, energetico, pre-treino ou outras fontes relevantes de cafeina apos as 16h.', 'sono', 'boolean'::public.habit_type, 'coffee', 10, true,
      '{"label": "Confirmar com honestidade"}'::jsonb, 50),
    (6, 'Proteina nas refeicoes', 'Inclua uma fonte de proteina nas principais refeicoes do dia.', 'alimentacao', 'boolean'::public.habit_type, 'beef', 10, true,
      '{"label": "Confirmar com honestidade"}'::jsonb, 60),
    (7, 'Fruta do dia', 'Coma pelo menos uma fruta no dia.', 'alimentacao', 'quantity'::public.habit_type, 'apple', 10, true,
      '{"target": 1, "unit": "fruta", "metric": "fruta"}'::jsonb, 70),
    (8, 'Sono', 'Durma pelo menos 7 horas durante a noite.', 'sono', 'quantity'::public.habit_type, 'bed', 10, true,
      '{"target": 7, "unit": "horas", "metric": "sono"}'::jsonb, 80),
    (9, 'Leitura', 'Leia pelo menos 10 paginas de um livro.', 'leitura', 'reading'::public.habit_type, 'book-open', 10, true,
      '{"target": 10, "unit": "paginas", "metric": "leitura"}'::jsonb, 90),
    (10, 'Leitura da Biblia', 'Leia pelo menos um capitulo da Biblia.', 'fe', 'quantity'::public.habit_type, 'book-heart', 10, true,
      '{"target": 1, "unit": "capitulo", "metric": "biblia"}'::jsonb, 100),
    (11, 'Autocuidado', 'Realize uma acao de autocuidado consciente.', 'autocuidado', 'boolean'::public.habit_type, 'sparkles', 10, false,
      '{"label": "Confirmar com honestidade", "conceptual_monthly_target": 2, "note": "Meta conceitual: 2 acoes de autocuidado no mes. Check-in opcional; ausencia nao impede 100% do dia quando marcado como nao aplicavel. Sem regra mensal no motor atual."}'::jsonb, 110),
    (12, 'Sem reclamacao e vitimismo', 'Observe sua postura durante o dia e evite permanecer em reclamacao, culpa ou vitimismo.', 'mentalidade', 'boolean'::public.habit_type, 'brain', 10, true,
      '{"label": "Confirmar com honestidade"}'::jsonb, 120),
    (13, 'Oracao e gratidao', 'Ore e agradeca antes de dormir e antes de comecar o dia.', 'fe', 'boolean'::public.habit_type, 'hand-heart', 10, true,
      '{"label": "Confirmar com honestidade"}'::jsonb, 130)
)
insert into public.habits (
  id,
  challenge_id,
  title,
  description,
  category,
  habit_type,
  icon,
  points,
  is_required,
  frequency_config,
  validation_config,
  sort_order,
  active
)
select
  ('a3080000-0000-4000-8002-' || lpad(seq::text, 12, '0'))::uuid,
  'a3080000-0000-4000-8000-000000000001'::uuid,
  title,
  description,
  category,
  habit_type,
  icon,
  points,
  is_required,
  '{"type": "daily"}'::jsonb,
  validation_config,
  sort_order,
  true
from habit_catalog
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  habit_type = excluded.habit_type,
  icon = excluded.icon,
  points = excluded.points,
  is_required = excluded.is_required,
  frequency_config = excluded.frequency_config,
  validation_config = excluded.validation_config,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

-- VINCULOS DIA x HABITO (31 x 13 = 403) ------------------------------------------
-- Todos os 13 habitos sao vinculados a todos os 31 dias. required replica o
-- is_required do habito (11 obrigatorios, 2 opcionais: Musculacao e Autocuidado).

with habit_required(seq, required) as (
  values
    (1, true), (2, false), (3, true), (4, true), (5, true), (6, true), (7, true),
    (8, true), (9, true), (10, true), (11, false), (12, true), (13, true)
),
day_numbers as (
  select generate_series(1, 31) as day_number
),
link_catalog as (
  select
    d.day_number,
    h.seq as habit_seq,
    h.required
  from day_numbers d
  cross join habit_required h
)
insert into public.challenge_day_habits (
  id,
  challenge_id,
  challenge_day_id,
  habit_id,
  override_points,
  override_description,
  sort_order,
  required
)
select
  ('a3080000-0000-4000-81' || lpad(day_number::text, 2, '0') || '-' || lpad(habit_seq::text, 12, '0'))::uuid,
  'a3080000-0000-4000-8000-000000000001'::uuid,
  ('a3080000-0000-4000-8001-' || lpad(day_number::text, 12, '0'))::uuid,
  ('a3080000-0000-4000-8002-' || lpad(habit_seq::text, 12, '0'))::uuid,
  null,
  null,
  habit_seq * 10,
  required
from link_catalog
on conflict (challenge_day_id, habit_id) do update set
  override_points = excluded.override_points,
  override_description = excluded.override_description,
  sort_order = excluded.sort_order,
  required = excluded.required,
  updated_at = now();

-- ACHIEVEMENTS CANONICOS (10) -----------------------------------------------------
-- Mesmos slugs/definicoes ja usados pela migration 0002 e pelo desafio de
-- validacao interna, escopados a este novo challenge_id. Nenhum slug novo e
-- criado nesta execucao (agosto-irreconhecivel, hidratacao-em-dia, etc. ficam
-- documentados como viabilidade futura, nao implementados agora).

insert into public.achievements (
  id,
  challenge_id,
  name,
  slug,
  description,
  icon,
  points_bonus,
  rule_config,
  active,
  sort_order
)
values
  ('a3080000-0000-4000-8003-000000000001', 'a3080000-0000-4000-8000-000000000001',
    'Primeiro habito', 'primeiro-habito', 'Concluir o primeiro habito do ciclo.', 'sparkles', 0,
    '{"type": "first_habit"}'::jsonb, true, 10),
  ('a3080000-0000-4000-8003-000000000002', 'a3080000-0000-4000-8000-000000000001',
    'Primeiro dia', 'primeiro-dia', 'Finalizar o primeiro dia do ciclo.', 'sunrise', 0,
    '{"type": "first_day"}'::jsonb, true, 20),
  ('a3080000-0000-4000-8003-000000000003', 'a3080000-0000-4000-8000-000000000001',
    'Tres dias seguidos', 'tres-dias-seguidos', 'Manter tres dias validos em sequencia.', 'flame', 0,
    '{"type": "streak", "days": 3}'::jsonb, true, 30),
  ('a3080000-0000-4000-8003-000000000004', 'a3080000-0000-4000-8000-000000000001',
    'Primeira semana', 'primeira-semana', 'Finalizar sete dias do ciclo.', 'calendar-check', 0,
    '{"type": "finalized_days", "days": 7}'::jsonb, true, 40),
  ('a3080000-0000-4000-8003-000000000005', 'a3080000-0000-4000-8000-000000000001',
    'Sete leituras', 'sete-leituras', 'Concluir sete leituras no ciclo.', 'book-open', 0,
    '{"type": "reading_completions", "count": 7}'::jsonb, true, 50),
  ('a3080000-0000-4000-8003-000000000006', 'a3080000-0000-4000-8000-000000000001',
    'Sete atividades fisicas', 'sete-atividades-fisicas', 'Concluir sete atividades fisicas no ciclo.', 'activity', 0,
    '{"type": "physical_activity_completions", "count": 7}'::jsonb, true, 60),
  ('a3080000-0000-4000-8003-000000000007', 'a3080000-0000-4000-8000-000000000001',
    'Sete reflexoes', 'sete-reflexoes', 'Registrar sete reflexoes.', 'pen-line', 0,
    '{"type": "reflection_days", "count": 7}'::jsonb, true, 70),
  ('a3080000-0000-4000-8003-000000000008', 'a3080000-0000-4000-8000-000000000001',
    'Metade do caminho', 'metade-do-caminho', 'Finalizar metade da duracao configurada.', 'route', 0,
    '{"type": "halfway"}'::jsonb, true, 80),
  ('a3080000-0000-4000-8003-000000000009', 'a3080000-0000-4000-8000-000000000001',
    'Retorno forte', 'retorno-forte', 'Voltar com um dia valido depois de perder o ritmo.', 'rotate-ccw', 0,
    '{"type": "return_after_break"}'::jsonb, true, 90),
  ('a3080000-0000-4000-8003-000000000010', 'a3080000-0000-4000-8000-000000000001',
    'Missao concluida', 'missao-concluida', 'Finalizar a duracao configurada do ciclo.', 'trophy', 0,
    '{"type": "challenge_completed"}'::jsonb, true, 100)
on conflict (challenge_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  points_bonus = excluded.points_bonus,
  rule_config = excluded.rule_config,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- VALIDACOES (dentro da transacao) --------------------------------------------
-- Bloco de asserts com mensagens objetivas. Roda ANTES do commit, na mesma
-- transacao das inserções acima. Se qualquer verificacao falhar, a excecao
-- propaga, a transacao fica abortada e o COMMIT abaixo se torna, na pratica,
-- um ROLLBACK integral (nenhuma insercao desta execucao e persistida).

do $$
declare
  target_challenge_id uuid := 'a3080000-0000-4000-8000-000000000001';
  internal_challenge_id uuid := 'a2300000-0000-4000-8000-000000000001';
  v_count integer;
  v_sum integer;
begin
  -- exatamente 1 challenge com o slug esperado
  select count(*) into v_count
  from public.challenges
  where slug = 'desafio-agosto-irreconhecivel';
  if v_count <> 1 then
    raise exception 'Esperado 1 challenge com slug desafio-agosto-irreconhecivel, encontrado %', v_count;
  end if;

  -- id determinístico correto
  select count(*) into v_count
  from public.challenges
  where id = target_challenge_id and slug = 'desafio-agosto-irreconhecivel';
  if v_count <> 1 then
    raise exception 'Challenge com slug esperado nao esta no UUID determinístico esperado.';
  end if;

  -- exatamente 31 dias, sem duplicidade de day_number
  select count(*) into v_count
  from public.challenge_days
  where challenge_id = target_challenge_id;
  if v_count <> 31 then
    raise exception 'Esperado 31 dias, encontrado %', v_count;
  end if;

  select count(*) into v_count
  from (
    select day_number
    from public.challenge_days
    where challenge_id = target_challenge_id
    group by day_number
    having count(*) > 1
  ) duplicated;
  if v_count <> 0 then
    raise exception 'Encontrados % day_number duplicados.', v_count;
  end if;

  -- exatamente 13 habitos (11 obrigatorios + 2 opcionais, opcionalidade suportada via required)
  select count(*) into v_count
  from public.habits
  where challenge_id = target_challenge_id;
  if v_count <> 13 then
    raise exception 'Esperado 13 habitos, encontrado %', v_count;
  end if;

  select count(*) into v_count
  from public.habits
  where challenge_id = target_challenge_id
    and is_required = false;
  if v_count <> 2 then
    raise exception 'Esperado 2 habitos opcionais (Musculacao, Autocuidado), encontrado %', v_count;
  end if;

  -- habitos sem duplicidade de titulo (nao ha coluna slug em habits)
  select count(*) into v_count
  from (
    select title
    from public.habits
    where challenge_id = target_challenge_id
    group by title
    having count(*) > 1
  ) duplicated_habits;
  if v_count <> 0 then
    raise exception 'Encontrados % titulos de habito duplicados.', v_count;
  end if;

  -- tipos de habito validos (enum garante isso, mas confirmamos os 4 tipos usados)
  select count(*) into v_count
  from public.habits
  where challenge_id = target_challenge_id
    and habit_type not in ('boolean', 'quantity', 'duration', 'reading');
  if v_count <> 0 then
    raise exception 'Encontrados % habitos com tipo fora do esperado para este desafio.', v_count;
  end if;

  -- quantidade esperada de vinculos dia-habito: 31 x 13 = 403
  select count(*) into v_count
  from public.challenge_day_habits
  where challenge_id = target_challenge_id;
  if v_count <> 403 then
    raise exception 'Esperado 403 vinculos challenge_day_habits (31x13), encontrado %', v_count;
  end if;

  -- ausencia de vinculos orfaos (dia ou habito fora deste challenge)
  select count(*) into v_count
  from public.challenge_day_habits cdh
  left join public.challenge_days cd
    on cd.id = cdh.challenge_day_id and cd.challenge_id = cdh.challenge_id
  left join public.habits h
    on h.id = cdh.habit_id and h.challenge_id = cdh.challenge_id
  where cdh.challenge_id = target_challenge_id
    and (cd.id is null or h.id is null);
  if v_count <> 0 then
    raise exception 'Encontrados % vinculos orfaos em challenge_day_habits.', v_count;
  end if;

  -- vinculos obrigatorios batem com is_required do habito (nenhuma inconsistencia)
  select count(*) into v_count
  from public.challenge_day_habits cdh
  join public.habits h on h.id = cdh.habit_id and h.challenge_id = cdh.challenge_id
  where cdh.challenge_id = target_challenge_id
    and cdh.required <> h.is_required;
  if v_count <> 0 then
    raise exception 'Encontrados % vinculos com required diferente do is_required do habito.', v_count;
  end if;

  -- pontuacao: soma dos pontos dos 11 habitos obrigatorios = 110
  select coalesce(sum(points), 0) into v_sum
  from public.habits
  where challenge_id = target_challenge_id
    and is_required = true;
  if v_sum <> 110 then
    raise exception 'Esperado 110 pontos somados nos habitos obrigatorios, encontrado %', v_sum;
  end if;

  -- pontuacao: soma dos pontos dos 2 habitos opcionais = 20
  select coalesce(sum(points), 0) into v_sum
  from public.habits
  where challenge_id = target_challenge_id
    and is_required = false;
  if v_sum <> 20 then
    raise exception 'Esperado 20 pontos somados nos habitos opcionais, encontrado %', v_sum;
  end if;

  -- rules_config correto
  select count(*) into v_count
  from public.challenges
  where id = target_challenge_id
    and (rules_config ->> 'reflection_points')::int = 10
    and (rules_config ->> 'finalize_day_points')::int = 10
    and (rules_config ->> 'all_habits_bonus_points')::int = 30
    and (rules_config ->> 'streak_minimum_completion')::int = 70;
  if v_count <> 1 then
    raise exception 'rules_config do desafio nao confere com o esperado.';
  end if;

  -- theme_config correto (chaves essenciais presentes)
  select count(*) into v_count
  from public.challenges
  where id = target_challenge_id
    and theme_config ? 'visibility'
    and theme_config ? 'category'
    and theme_config ? 'difficulty'
    and theme_config ? 'audience'
    and theme_config ? 'campaign'
    and theme_config ? 'visual_style'
    and theme_config ? 'mood'
    and theme_config ? 'accent'
    and theme_config ? 'hero_message'
    and theme_config ->> 'visibility' = 'public';
  if v_count <> 1 then
    raise exception 'theme_config do desafio nao confere com o esperado.';
  end if;

  -- compatibilidade estrutural com join_available_challenge(): enrollment_start <= enrollment_end,
  -- e ambos dentro ou ao redor de start_date/end_date
  select count(*) into v_count
  from public.challenges
  where id = target_challenge_id
    and duration_days = 31
    and start_date = date '2026-08-01'
    and end_date = date '2026-08-31'
    and enrollment_start = date '2026-07-28'
    and enrollment_end = date '2026-08-05'
    and enrollment_start <= enrollment_end;
  if v_count <> 1 then
    raise exception 'Datas do ciclo nao conferem com o esperado.';
  end if;

  -- compatibilidade estrutural com ensure_today_daily_log(): duration_days bate com a contagem de dias
  select c.duration_days into v_count
  from public.challenges c
  where c.id = target_challenge_id;
  if v_count <> (
    select count(*) from public.challenge_days where challenge_id = target_challenge_id
  ) then
    raise exception 'duration_days do challenge nao bate com a quantidade de challenge_days.';
  end if;

  -- compatibilidade estrutural com finalize_daily_log(): existem os 10 achievements
  -- canonicos esperados, ativos, escopados a este challenge
  select count(*) into v_count
  from public.achievements
  where challenge_id = target_challenge_id
    and active
    and slug in (
      'primeiro-habito', 'primeiro-dia', 'tres-dias-seguidos', 'primeira-semana',
      'sete-leituras', 'sete-atividades-fisicas', 'sete-reflexoes',
      'metade-do-caminho', 'retorno-forte', 'missao-concluida'
    );
  if v_count <> 10 then
    raise exception 'Esperado 10 achievements canonicos ativos, encontrado %', v_count;
  end if;

  -- nenhum slug de achievement duplicado dentro deste challenge
  select count(*) into v_count
  from (
    select slug
    from public.achievements
    where challenge_id = target_challenge_id
    group by slug
    having count(*) > 1
  ) duplicated_achievements;
  if v_count <> 0 then
    raise exception 'Encontrados % slugs de achievement duplicados neste challenge.', v_count;
  end if;

  -- nenhuma alteracao no desafio interno
  select count(*) into v_count
  from public.challenges
  where id = internal_challenge_id
    and slug = 'projeto-30-validacao-interna';
  if v_count <> 1 then
    raise exception 'Desafio interno de validacao nao foi encontrado intacto (id/slug esperados).';
  end if;

  -- nenhum usuario, enrollment, daily_log, point_event, user_achievement criado para este challenge
  select count(*) into v_count from public.challenge_enrollments where challenge_id = target_challenge_id;
  if v_count <> 0 then
    raise exception 'Encontrados % enrollments para o desafio de agosto (esperado 0 nesta fase).', v_count;
  end if;

  select count(*) into v_count from public.daily_logs where challenge_id = target_challenge_id;
  if v_count <> 0 then
    raise exception 'Encontrados % daily_logs para o desafio de agosto (esperado 0 nesta fase).', v_count;
  end if;

  select count(*) into v_count from public.point_events where challenge_id = target_challenge_id;
  if v_count <> 0 then
    raise exception 'Encontrados % point_events para o desafio de agosto (esperado 0 nesta fase).', v_count;
  end if;

  select count(*) into v_count from public.user_achievements where challenge_id = target_challenge_id;
  if v_count <> 0 then
    raise exception 'Encontrados % user_achievements para o desafio de agosto (esperado 0 nesta fase).', v_count;
  end if;

  raise notice 'OK: desafio-agosto-irreconhecivel validado (1 challenge, 31 dias, 13 habitos, 403 vinculos, 10 achievements, 0 dados de usuario).';
end;
$$;

commit;

-- Consulta informativa (fora da transacao, somente leitura, executada apenas
-- apos o commit ter sido confirmado com sucesso).
select
  'august_irreconhecivel_ready' as result,
  c.id,
  c.slug,
  c.status,
  c.duration_days,
  c.start_date,
  c.end_date,
  c.enrollment_start,
  c.enrollment_end
from public.challenges c
where c.slug = 'desafio-agosto-irreconhecivel';

-- Consultas adicionais para operadores (somente leitura):
-- select count(*) from public.challenge_days where challenge_id = 'a3080000-0000-4000-8000-000000000001';
-- select count(*) from public.habits where challenge_id = 'a3080000-0000-4000-8000-000000000001';
-- select count(*) from public.challenge_day_habits where challenge_id = 'a3080000-0000-4000-8000-000000000001';
-- select count(*) from public.achievements where challenge_id = 'a3080000-0000-4000-8000-000000000001';
-- select id, title, is_required, points from public.habits where challenge_id = 'a3080000-0000-4000-8000-000000000001' order by sort_order;
--
-- Publicacao (NAO executar nesta fase - requer aprovacao explicita):
-- update public.challenges set status = 'active', updated_at = now()
-- where id = 'a3080000-0000-4000-8000-000000000001';
--
-- Cleanup nao destrutivo (arquivar sem apagar):
-- update public.challenges
-- set status = 'archived',
--     deleted_at = coalesce(deleted_at, now()),
--     updated_at = now()
-- where id = 'a3080000-0000-4000-8000-000000000001';
--
-- Cleanup destrutivo, intencionalmente comentado. Exige aprovacao explicita
-- antes de qualquer uso. Nao remove usuarios de autenticacao.
-- begin;
-- delete from public.user_achievements where challenge_id = 'a3080000-0000-4000-8000-000000000001';
-- delete from public.point_events where challenge_id = 'a3080000-0000-4000-8000-000000000001';
-- delete from public.journal_entries
-- where enrollment_id in (
--   select id from public.challenge_enrollments
--   where challenge_id = 'a3080000-0000-4000-8000-000000000001'
-- );
-- delete from public.habit_logs
-- where daily_log_id in (
--   select id from public.daily_logs
--   where challenge_id = 'a3080000-0000-4000-8000-000000000001'
-- );
-- delete from public.daily_logs where challenge_id = 'a3080000-0000-4000-8000-000000000001';
-- delete from public.challenge_enrollments where challenge_id = 'a3080000-0000-4000-8000-000000000001';
-- delete from public.challenge_day_habits where challenge_id = 'a3080000-0000-4000-8000-000000000001';
-- delete from public.achievements where challenge_id = 'a3080000-0000-4000-8000-000000000001';
-- delete from public.habits where challenge_id = 'a3080000-0000-4000-8000-000000000001';
-- delete from public.challenge_days where challenge_id = 'a3080000-0000-4000-8000-000000000001';
-- delete from public.challenges where id = 'a3080000-0000-4000-8000-000000000001';
-- commit;
