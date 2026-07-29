-- Projeto 30 - Fase 2G/Catalogo - Desafio de Agosto - Irreconhecivel
--
-- FINALIDADE
-- Cria/atualiza de forma idempotente o desafio oficial de agosto (slug:
-- desafio-agosto-irreconhecivel) com os dados canonicos aprovados: 13
-- habitos, capa, textos de identidade e regras de adesao.
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
-- - Depende das colunas/enum criados em
--   supabase/migrations/0009_habit_frequency_and_challenge_media.sql
--   (habits.frequency_type, challenges.cover_image_url). Rode a migration
--   0009 antes deste script.
--
-- O QUE ESTE SCRIPT NUNCA FAZ
-- - Nao cria usuarios (auth.users / public.users).
-- - Nao cria challenge_enrollments, daily_logs, habit_logs, journal_entries,
--   point_events ou user_achievements.
-- - Nao altera o desafio interno "Projeto 30 - Validacao Interna"
--   (slug projeto-30-validacao-interna, id a2300000-0000-4000-8000-000000000001).
--
-- IDEMPOTENCIA
-- IDs fixos (UUIDs deterministicos) + ON CONFLICT DO UPDATE somente nos
-- registros deste desafio. Pode ser executado quantas vezes forem necessarias
-- sem duplicar linhas. Os UUIDs de habito (seq 1-13) sao os MESMOS ja usados
-- desde a primeira versao deste script - so o conteudo das colunas muda.
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
-- SLUG
-- Preservado como "desafio-agosto-irreconhecivel" (nao trocado para o novo
-- sugerido "irreconhecivel-em-agosto-2026"). Motivo: e o slug ja versionado
-- neste script desde a primeira execucao, coberto por teste de regressao
-- (august-challenge-script.test.ts) e usado nas rotas /app/desafios/[slug]
-- do catalogo ja implementado. Trocar o slug nao quebraria nenhuma FK (slug
-- nao e referenciado por nenhuma outra tabela), mas quebraria o link direto
-- e exigiria atualizar o teste sem nenhum ganho funcional. Titulo curto,
-- subtitulo e demais textos de identidade foram atualizados normalmente.
--
-- STATUS
-- Mantido como 'active' (target_status abaixo). O desafio ja esta ativo no
-- ambiente usado para validacao (Fase de catalogo) e ja tem uma inscricao de
-- teste real (conta QA) em andamento; voltar para 'draft' o esconderia do
-- catalogo e quebraria essa validacao em curso. Decisao documentada aqui
-- conforme pedido, em vez de alterar silenciosamente.
--
-- LIMITACOES CONHECIDAS DO MOTOR ATUAL (documentadas, nao "resolvidas
-- silenciosamente"):
-- 1) Sono (habito 8): a meta oficial e uma faixa (7 a 8 horas), mas
--    habits.validation_config so tem um "target" numerico unico (sem campo
--    de teto). Registrado target = 7 (o minimo, compativel com o mecanismo
--    atual) e a faixa completa (7 a 8h) fica expressa apenas na descricao do
--    habito. Nao foi criada nenhuma coluna nova so para isso.
-- 2) Habits nao possuem coluna de slug no schema atual. A identificacao real
--    e feita pelo UUID deterministico e pelo titulo.
-- 3) achievements sao escopados por challenge_id (unique(challenge_id, slug)).
--    Este script insere os mesmos 10 achievements canonicos ja usados pela
--    migration 0002 e pelo desafio de validacao interna, escopados a este
--    challenge_id.
--
-- FREQUENCIA (corrigido nesta rodada via migration 0009)
-- Musculacao (semanal, meta 4 sessoes) e Livro/Autocuidado (mensal, metas 1
-- e 2) agora tem habits.frequency_type <> 'daily'. journey_recalculate_daily_log
-- (redefinida em 0009) passou a considerar SOMENTE habitos frequency_type =
-- 'daily' no completion_percent do dia e no bonus de "todos os habitos
-- concluidos" - portanto essas 3 metas nunca reduzem a conclusao diaria nem
-- bloqueiam o bonus, mesmo pendentes. Elas continuam registraveis em
-- qualquer dia do ciclo (update_habit_log nao muda) e continuam gerando
-- pontos por conclusao (finalize_daily_log nao muda nisso), mas o PROGRESSO
-- acumulado da semana/mes e calculado e exibido pela camada de aplicacao
-- (nao no banco), lendo os habit_logos ja existentes.
--
-- PONTUACAO ESPERADA (ver validacao no final do arquivo):
--   13 habitos obrigatorios x 10 pts = 130 (nenhum habito opcional nesta
--   versao - Musculacao e Autocuidado passaram a ser obrigatorios tambem,
--   apenas com frequencia diferente de diaria)
--   10 habitos diarios x 10 pts = 100 | reflexao = 10 | finalizacao = 10 |
--   bonus 100% (calculado so sobre os 10 diarios) = 30
--   total diario obrigatorio esperado = 150
--   + 3 habitos nao-diarios (Musculacao, Livro, Autocuidado) x 10 pts,
--   conforme completados ao longo da semana/mes = 30 (fora do calculo diario)

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
  cover_image_url,
  theme_config,
  rules_config
)
values (
  'a3080000-0000-4000-8000-000000000001',
  'Desafio para se tornar irreconhecivel em agosto',
  'desafio-agosto-irreconhecivel',
  'Agosto sera o mes da disciplina. Durante 31 dias, voce assumira um compromisso consigo mesmo por meio de habitos simples, mas consistentes. O objetivo nao e buscar perfeicao, mas criar constancia. Cada habito concluido representa mais um passo para uma versao mais saudavel, disciplinada e consciente de voce mesmo. Pequenas escolhas diarias podem gerar grandes resultados para sempre.',
  31,
  date '2026-08-01',
  date '2026-08-31',
  date '2026-07-28',
  date '2026-08-05',
  'active', -- target_status: ja ativo (ver secao STATUS no cabecalho)
  null, -- cover_image_url: imagem oficial fornecida no chat, mas o arquivo
        -- local (/mnt/data/...) nao esta acessivel neste ambiente de
        -- execucao. Atualize manualmente apos subir o arquivo ao bucket
        -- challenge-covers (ver docs/challenge-content-model.md).
  jsonb_build_object(
    -- chaves canonicas novas (padrao obrigatorio para qualquer desafio)
    'short_title', 'Irreconhecivel em Agosto',
    'subtitle', 'Pequenas escolhas diarias, grandes resultados para sempre.',
    'short_description', 'Um desafio de transformacao pessoal baseado em disciplina, saude, treino, alimentacao, sono, desenvolvimento pessoal, autocuidado, mentalidade e espiritualidade.',
    'motivational_phrase', 'Disciplina hoje, liberdade amanha!',
    'cta_label', 'Vem comigo!',
    'cta_subtext', 'O melhor mes do ano comeca agora.',
    -- chaves ja existentes desde a primeira versao (mantidas por
    -- compatibilidade; nao lidas pelo codigo novo, apenas preservadas)
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
    'closing_message', 'Voce nao terminou apenas um desafio. Voce provou que consegue sustentar novas escolhas.'
  ),
  jsonb_build_object(
    'reflection_points', 10,
    'finalize_day_points', 10,
    'all_habits_bonus_points', 30,
    'streak_minimum_completion', 70,
    'journal_edit_minutes_after_finalize', 0,
    -- chaves canonicas novas (regras de adesao - padrao obrigatorio)
    'admission_type', 'open',
    'allow_late_entry', true,
    'allow_abandonment', true,
    'max_participants', null,
    'completion_criteria', 'finalize_all_days'
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
  cover_image_url = coalesce(public.challenges.cover_image_url, excluded.cover_image_url),
  theme_config = excluded.theme_config,
  rules_config = excluded.rules_config,
  updated_at = now();

-- DIAS (31) -------------------------------------------------------------------
-- Inalterado desde a primeira versao (titulo e mensagem motivacional por dia).

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
-- Todos os 13 sao obrigatorios (is_required = true). O que antes era
-- resolvido com is_required = false (Musculacao, Autocuidado) agora e
-- resolvido com frequency_type <> 'daily' (weekly/monthly) - ver migration
-- 0009. seq 1-13 preserva o UUID deterministico ja usado desde a primeira
-- versao deste script.

with habit_catalog(
  seq, title, description, category, habit_type, icon, points,
  frequency_type, validation_config, sort_order
) as (
  values
    (1, 'Beber no minimo 3 litros de agua', 'Consumir no minimo 3 litros de agua durante o dia.', 'Saude', 'quantity'::public.habit_type, '💧', 10,
      'daily'::public.habit_frequency_type,
      '{"target": 3, "unit": "Litros", "short_title": "3 litros de agua"}'::jsonb, 10),
    (2, 'Fazer musculacao 4 vezes por semana', 'Realizar pelo menos quatro sessoes de musculacao durante a semana.', 'Treino', 'boolean'::public.habit_type, '🏋️', 10,
      'weekly'::public.habit_frequency_type,
      '{"target": 4, "unit": "Sessoes", "short_title": "Musculacao", "label": "Confirmar sessao de musculacao"}'::jsonb, 20),
    (3, 'Fazer 30 minutos de cardio', 'Realizar pelo menos 30 minutos de atividade cardiovascular durante o dia.', 'Treino', 'duration'::public.habit_type, '🏃', 10,
      'daily'::public.habit_frequency_type,
      '{"target": 30, "unit": "Minutos", "short_title": "30 minutos de cardio"}'::jsonb, 30),
    (4, 'Tomar 15 minutos de sol', 'Ter pelo menos 15 minutos de exposicao ao sol durante o dia.', 'Saude', 'duration'::public.habit_type, '☀️', 10,
      'daily'::public.habit_frequency_type,
      '{"target": 15, "unit": "Minutos", "short_title": "15 minutos de sol"}'::jsonb, 40),
    (5, 'Nao consumir cafeina apos as 16h', 'Evitar cafe, energeticos, pre-treinos e outras fontes de cafeina depois das 16 horas.', 'Nutricao', 'boolean'::public.habit_type, '☕', 10,
      'daily'::public.habit_frequency_type,
      '{"short_title": "Sem cafeina apos as 16h", "label": "Confirmar com honestidade"}'::jsonb, 50),
    (6, 'Consumir proteina em todas as refeicoes', 'Incluir alguma fonte de proteina em todas as refeicoes realizadas durante o dia.', 'Nutricao', 'boolean'::public.habit_type, '🥩', 10,
      'daily'::public.habit_frequency_type,
      '{"short_title": "Proteina em todas as refeicoes", "label": "Confirmar com honestidade"}'::jsonb, 60),
    (7, 'Comer ao menos uma fruta por dia', 'Consumir pelo menos uma fruta durante o dia.', 'Nutricao', 'quantity'::public.habit_type, '🍎', 10,
      'daily'::public.habit_frequency_type,
      '{"target": 1, "unit": "Fruta", "short_title": "Comer uma fruta"}'::jsonb, 70),
    (8, 'Dormir entre 7 e 8 horas', 'Dormir entre sete e oito horas por noite. A meta registrada no sistema usa o minimo (7h); o teto de 8h e apenas orientativo nesta fase, sem suporte de meta-maxima no schema atual.', 'Sono', 'quantity'::public.habit_type, '🛏️', 10,
      'daily'::public.habit_frequency_type,
      '{"target": 7, "unit": "Horas", "short_title": "Dormir de 7 a 8 horas", "target_max_informational": 8}'::jsonb, 80),
    (9, 'Ler pelo menos um livro', 'Concluir a leitura de pelo menos um livro durante o mes de agosto.', 'Desenvolvimento pessoal', 'boolean'::public.habit_type, '📚', 10,
      'monthly'::public.habit_frequency_type,
      '{"target": 1, "unit": "Livro", "short_title": "Ler um livro", "label": "Confirmar quando concluir o livro"}'::jsonb, 90),
    (10, 'Ler um capitulo da Biblia todos os dias', 'Ler pelo menos um capitulo da Biblia durante o dia.', 'Espiritualidade', 'quantity'::public.habit_type, '📖', 10,
      'daily'::public.habit_frequency_type,
      '{"target": 1, "unit": "Capitulo", "short_title": "Ler a Biblia"}'::jsonb, 100),
    (11, 'Realizar duas acoes de autocuidado', 'Realizar pelo menos duas acoes de autocuidado durante o mes.', 'Bem-estar', 'boolean'::public.habit_type, '🧖‍♀️', 10,
      'monthly'::public.habit_frequency_type,
      '{"target": 2, "unit": "Acoes", "short_title": "Autocuidado", "label": "Confirmar acao de autocuidado"}'::jsonb, 110),
    (12, 'Evitar reclamar e assumir postura de vitima', 'Manter uma postura consciente durante o dia, evitando reclamacoes desnecessarias e comportamentos de vitimizacao.', 'Mentalidade', 'boolean'::public.habit_type, '😡', 10,
      'daily'::public.habit_frequency_type,
      '{"short_title": "Sem reclamacao e vitimismo", "label": "Confirmar com honestidade"}'::jsonb, 120),
    (13, 'Agradecer e orar todos os dias', 'Agradecer e orar antes de dormir e antes de sair da cama.', 'Espiritualidade', 'quantity'::public.habit_type, '🙏', 10,
      'daily'::public.habit_frequency_type,
      '{"target": 2, "unit": "Momentos", "short_title": "Agradecer e orar"}'::jsonb, 130)
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
  frequency_type,
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
  true,
  frequency_type,
  jsonb_build_object('type', frequency_type::text),
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
  frequency_type = excluded.frequency_type,
  frequency_config = excluded.frequency_config,
  validation_config = excluded.validation_config,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

-- VINCULOS DIA x HABITO (31 x 13 = 403) ------------------------------------------
-- Todos os 13 habitos sao vinculados a todos os 31 dias, todos required=true
-- (o "opcional" de antes agora e resolvido por frequencia, nao por required).

with day_numbers as (
  select generate_series(1, 31) as day_number
),
habit_seqs as (
  select generate_series(1, 13) as habit_seq
),
link_catalog as (
  select d.day_number, h.habit_seq
  from day_numbers d
  cross join habit_seqs h
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
  true
from link_catalog
on conflict (challenge_day_id, habit_id) do update set
  override_points = excluded.override_points,
  override_description = excluded.override_description,
  sort_order = excluded.sort_order,
  required = excluded.required,
  updated_at = now();

-- ACHIEVEMENTS CANONICOS (10) -----------------------------------------------------
-- Inalterado desde a primeira versao.

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

do $$
declare
  target_challenge_id uuid := 'a3080000-0000-4000-8000-000000000001';
  internal_challenge_id uuid := 'a2300000-0000-4000-8000-000000000001';
  v_count integer;
  v_sum integer;
begin
  select count(*) into v_count
  from public.challenges
  where slug = 'desafio-agosto-irreconhecivel';
  if v_count <> 1 then
    raise exception 'Esperado 1 challenge com slug desafio-agosto-irreconhecivel, encontrado %', v_count;
  end if;

  select count(*) into v_count
  from public.challenges
  where id = target_challenge_id and slug = 'desafio-agosto-irreconhecivel';
  if v_count <> 1 then
    raise exception 'Challenge com slug esperado nao esta no UUID determinístico esperado.';
  end if;

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

  -- exatamente 13 habitos, todos obrigatorios (opcionalidade agora vem da
  -- frequencia, nao de is_required)
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
  if v_count <> 0 then
    raise exception 'Esperado 0 habitos opcionais (todos sao obrigatorios nesta versao), encontrado %', v_count;
  end if;

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

  select count(*) into v_count
  from public.habits
  where challenge_id = target_challenge_id
    and habit_type not in ('boolean', 'quantity', 'duration', 'reading');
  if v_count <> 0 then
    raise exception 'Encontrados % habitos com tipo fora do esperado para este desafio.', v_count;
  end if;

  -- frequencias: 10 diarios, 1 semanal (Musculacao), 2 mensais (Livro, Autocuidado)
  select count(*) into v_count
  from public.habits
  where challenge_id = target_challenge_id and frequency_type = 'daily';
  if v_count <> 10 then
    raise exception 'Esperado 10 habitos diarios, encontrado %', v_count;
  end if;

  select count(*) into v_count
  from public.habits
  where challenge_id = target_challenge_id and frequency_type = 'weekly';
  if v_count <> 1 then
    raise exception 'Esperado 1 habito semanal (Musculacao), encontrado %', v_count;
  end if;

  select count(*) into v_count
  from public.habits
  where challenge_id = target_challenge_id and frequency_type = 'monthly';
  if v_count <> 2 then
    raise exception 'Esperado 2 habitos mensais (Livro, Autocuidado), encontrado %', v_count;
  end if;

  select count(*) into v_count
  from public.challenge_day_habits
  where challenge_id = target_challenge_id;
  if v_count <> 403 then
    raise exception 'Esperado 403 vinculos challenge_day_habits (31x13), encontrado %', v_count;
  end if;

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

  -- pontuacao total dos 13 habitos obrigatorios = 130
  select coalesce(sum(points), 0) into v_sum
  from public.habits
  where challenge_id = target_challenge_id
    and is_required = true;
  if v_sum <> 130 then
    raise exception 'Esperado 130 pontos somados nos habitos obrigatorios, encontrado %', v_sum;
  end if;

  -- pontuacao dos habitos diarios (base do calculo diario) = 100
  select coalesce(sum(points), 0) into v_sum
  from public.habits
  where challenge_id = target_challenge_id
    and frequency_type = 'daily';
  if v_sum <> 100 then
    raise exception 'Esperado 100 pontos somados nos habitos diarios, encontrado %', v_sum;
  end if;

  -- pontuacao dos habitos nao-diarios (fora do calculo diario) = 30
  select coalesce(sum(points), 0) into v_sum
  from public.habits
  where challenge_id = target_challenge_id
    and frequency_type <> 'daily';
  if v_sum <> 30 then
    raise exception 'Esperado 30 pontos somados nos habitos nao-diarios, encontrado %', v_sum;
  end if;

  select count(*) into v_count
  from public.challenges
  where id = target_challenge_id
    and (rules_config ->> 'reflection_points')::int = 10
    and (rules_config ->> 'finalize_day_points')::int = 10
    and (rules_config ->> 'all_habits_bonus_points')::int = 30
    and (rules_config ->> 'streak_minimum_completion')::int = 70
    and rules_config ->> 'admission_type' = 'open'
    and (rules_config ->> 'allow_late_entry')::boolean = true
    and (rules_config ->> 'allow_abandonment')::boolean = true;
  if v_count <> 1 then
    raise exception 'rules_config do desafio nao confere com o esperado.';
  end if;

  select count(*) into v_count
  from public.challenges
  where id = target_challenge_id
    and theme_config ? 'short_title'
    and theme_config ? 'subtitle'
    and theme_config ? 'short_description'
    and theme_config ? 'motivational_phrase'
    and theme_config ? 'cta_label'
    and theme_config ->> 'short_title' = 'Irreconhecivel em Agosto';
  if v_count <> 1 then
    raise exception 'theme_config do desafio nao confere com o padrao canonico esperado.';
  end if;

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

  select c.duration_days into v_count
  from public.challenges c
  where c.id = target_challenge_id;
  if v_count <> (
    select count(*) from public.challenge_days where challenge_id = target_challenge_id
  ) then
    raise exception 'duration_days do challenge nao bate com a quantidade de challenge_days.';
  end if;

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

  select count(*) into v_count
  from public.challenges
  where id = internal_challenge_id
    and slug = 'projeto-30-validacao-interna';
  if v_count <> 1 then
    raise exception 'Desafio interno de validacao nao foi encontrado intacto (id/slug esperados).';
  end if;

  raise notice 'OK: desafio-agosto-irreconhecivel validado (1 challenge, 31 dias, 13 habitos [10 diarios + 1 semanal + 2 mensais], 403 vinculos, 10 achievements).';
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
  c.cover_image_url,
  c.duration_days,
  c.start_date,
  c.end_date,
  c.enrollment_start,
  c.enrollment_end
from public.challenges c
where c.slug = 'desafio-agosto-irreconhecivel';

-- Consultas adicionais para operadores (somente leitura):
-- select id, title, frequency_type, is_required, points from public.habits where challenge_id = 'a3080000-0000-4000-8000-000000000001' order by sort_order;
--
-- Atualizar a capa depois de subir o arquivo ao bucket challenge-covers:
-- update public.challenges set cover_image_url = 'https://<project>.supabase.co/storage/v1/object/public/challenge-covers/challenges/a3080000-0000-4000-8000-000000000001/cover.webp', updated_at = now()
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
