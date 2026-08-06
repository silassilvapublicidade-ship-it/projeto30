-- Projeto 30 - Desafio de Setembro - Efata
--
-- FINALIDADE
-- Cria de forma idempotente o desafio de setembro (slug:
-- desafio-setembro-efata) como RASCUNHO (status = 'draft'), seguindo
-- exatamente o mesmo modelo tecnico e de conteudo ja usado pelo desafio
-- real de agosto (scripts/challenges/create-august-irreconhecivel.sql),
-- auditado linha a linha em producao antes deste script (ver relatorio da
-- rodada). Nenhuma tabela, coluna, enum, trigger, RPC ou politica nova foi
-- criada - tudo aqui usa exatamente o schema ja existente e ja usado por
-- agosto.
--
-- ESTE SCRIPT E ADMINISTRATIVO (mesmo padrao do script de agosto).
-- - NAO e uma migration (nao pertence a supabase/migrations e nao deve ser
--   aplicado via `supabase db push`).
-- - NAO e seed (nao roda automaticamente em nenhum pipeline).
-- - NAO deve ser executado automaticamente por CI, cron ou build.
-- - So atua no banco remoto quando executado explicitamente por um operador,
--   com o Supabase CLI ja autenticado e linkado ao projeto correto:
--     npx.cmd supabase db query --linked --file scripts\challenges\create-september-efata.sql
-- - NAO contem credenciais, chaves ou segredos.
--
-- O QUE ESTE SCRIPT NUNCA FAZ
-- - Nao cria usuarios (auth.users / public.users).
-- - Nao cria challenge_enrollments, daily_logs, habit_logs, journal_entries,
--   point_events ou user_achievements - zero inscricoes.
-- - Nao envia nenhuma notificacao (challenge_habit_notifications e criado
--   com enabled = false em todas as linhas).
-- - Nao publica o desafio - status permanece SEMPRE 'draft' (o proprio
--   ON CONFLICT reafirma 'draft' a cada reexecucao, nunca promove).
-- - Nao toca em NENHUMA linha do desafio de agosto
--   (id a3080000-0000-4000-8000-000000000001) nem do desafio de validacao
--   interna (id a2300000-0000-4000-8000-000000000001) - guarda explicita
--   no bloco de validacao antes de qualquer insert.
--
-- IDEMPOTENCIA
-- IDs fixos (UUIDs deterministicos) + ON CONFLICT DO UPDATE somente nos
-- registros deste desafio. Pode ser executado quantas vezes forem
-- necessarias sem duplicar linhas.
--
-- FAIXA DE UUIDS (exclusiva - distinta de a2300000-... (validacao interna)
-- e a3080000-... (agosto); "a309" ecoa o mes 09/setembro, mesma convencao
-- mnemônica que "a308" usa para agosto):
--   Challenge:            a3090000-0000-4000-8000-000000000001
--   Dias (30):            a3090000-0000-4000-8001-000000000001 .. 000000000030
--   Habitos (15):         a3090000-0000-4000-8002-000000000001 .. 000000000015
--   Vinculos dia-habito:  a3090000-0000-4000-81DD-0000000000HH
--                         DD = numero do dia com 2 digitos (01-30)
--                         HH = numero do habito com 2 digitos (01-15)
--                         (30 dias x 15 habitos = 450 vinculos)
--   Achievements (10):    a3090000-0000-4000-8003-000000000001 .. 000000000010
--
-- AUDITORIA DO MODELO DE AGOSTO (Parte A do pedido, resumo - ver relatorio
-- completo na resposta desta rodada para o detalhamento coluna a coluna)
-- Consultada em producao, somente leitura, antes de escrever este script:
-- challenges (id, name, slug, description, duration_days, start_date,
-- end_date, enrollment_start, enrollment_end, status, theme_config,
-- rules_config); challenge_days (id, challenge_id, day_number, title,
-- message, theme, unlock_rule); habits (id, challenge_id, title,
-- description, category, habit_type, icon, points, is_required,
-- frequency_type, frequency_config, validation_config, sort_order, active,
-- daily_prompt, visibility_config); challenge_day_habits (vinculo dia x
-- habito, com required proprio); achievements (escopados por challenge_id,
-- unique(challenge_id, slug)); challenge_habit_notifications (lembrete por
-- habito, unique(habit_id), enabled boolean). Agosto hoje tem, de fato, 14
-- habitos (nao 13) - um 14o habito ("Concluir o livro do mes") foi
-- adicionado depois via migration 0036, separando "ler um pouco" (diario,
-- required=true em agosto) de "concluir o livro" (mensal, required=false,
-- 30 pontos). Este script de setembro ja nasce com essa mesma separacao
-- desde o inicio (Parte D, item 14 do pedido) - nunca precisa de uma
-- segunda rodada de migration para chegar la.
--
-- DADOS REAPROVEITADOS DE AGOSTO (estrutura, nunca conteudo)
-- - As 4 chaves de rules_config funcionais (reflection_points=10,
--   finalize_day_points=10, all_habits_bonus_points=30,
--   streak_minimum_completion=70) - MESMOS valores reais confirmados em
--   producao no desafio de agosto. Setembro define essas chaves
--   explicitamente no proprio insert (agosto nao precisa, porque ja
--   existiam antes deste script existir; setembro e um insert novo, entao
--   precisa afirmar o padrao explicitamente para nao nascer sem essas
--   chaves).
-- - As mesmas 4 chaves de "adesao" (enrollment_type=open,
--   allow_join_after_start=true, allow_abandonment=true,
--   participant_limit=null, single_active_challenge=true).
-- - O mesmo padrao de theme_config (headline/subheadline/tagline/
--   hero_message/short_description/cover_image_url/cta_label/
--   cta_supporting_text).
-- - Os mesmos 10 achievements canonicos (mesmos slugs, icones e
--   rule_config de agosto - nenhuma conquista exclusiva do Efata criada
--   nesta fase, conforme pedido Parte K).
-- - O mesmo padrao de pontos (10 por habito diario/semanal, 30 para a
--   conclusao mensal do livro) e o mesmo mecanismo de
--   frequency_type <> 'daily' para "nao bloquear a finalizacao diaria"
--   (nunca is_required=false para isso - is_required continua sendo sobre
--   "esse item e obrigatorio quando aplicavel", frequencia e o que decide
--   SE ele e aplicavel hoje; mesma leitura ja usada por agosto).
-- - O mesmo padrao de visibility_config (default {"type":"all_days"});
--   setembro e o primeiro desafio a de fato usar {"type":"last_day"} para
--   a acao de concluir o livro (agosto ficou no default all_days depois
--   que a coluna foi criada na migration 0050, ver auditoria acima) -
--   aplicacao nova de um mecanismo ja existente e ja testado
--   (public.habit_visible_on_day, migration 0050), nunca schema novo.
--
-- DADOS NOVOS DE SETEMBRO (conteudo, nunca estrutura)
-- - Todo texto (nome, headline, tagline, descricao, mensagens dos 30 dias,
--   perguntas diarias) e novo, escrito para o tema Efata (Marcos 7:34,
--   "abra-se"). Nenhuma mensagem cita um versiculo como texto biblico
--   literal - "Marcos 7:34" e citado apenas como referencia tematica no
--   posicionamento do desafio (description), nunca como uma citacao entre
--   aspas atribuida a Biblia.
-- - 15 habitos com conteudo proprio (13 itens simples + 2 acoes do livro
--   do mes), 4 pilares (Corpo/Mente/Carater/Espirito) expressos via
--   habits.category (coluna de texto ja existente, sem coluna nova - Parte
--   C do pedido).
-- - "Essencial" (Parte D) NAO existe como coluna no schema atual (busca
--   confirmada: nenhuma migration cria is_essential). Por instrucao
--   explicita de nao criar schema novo, o conceito e registrado apenas
--   como uma chave DECORATIVA dentro de habits.validation_config
--   ("essential": true|false) - mesmo padrao ja usado por agosto para
--   chaves decorativas em theme_config (documentado no cabecalho do
--   script de agosto). Nenhum codigo do app le essa chave hoje; ela existe
--   só para o admin ver o dado no JSON, nunca afeta calculo de pontos,
--   streak ou bloqueio de finalizacao - quem afeta isso e is_required e
--   frequency_type, exatamente como em agosto.
-- - 4 rascunhos de lembrete por habito (challenge_habit_notifications),
--   todos com enabled = false - nenhum e enviado ao criar o desafio nem
--   nunca, ate que um admin explicitamente ative um pelo Admin.
-- - Capa: nao gerada nesta execucao (Parte M do pedido). theme_config nao
--   define cover_image_url (fica ausente, mesmo efeito pratico de null) -
--   o catalogo/detalhe caem no fallback visual ja existente (gradiente),
--   igual a qualquer desafio sem capa. Sinalizado explicitamente via
--   theme_config.cover_status = 'pending_review' e
--   theme_config.cover_note = 'Capa pendente de revisao.' (chaves
--   decorativas, mesmo padrao acima) - nenhuma tela hoje renderiza essas
--   duas chaves como badge visual (nenhuma tela nova foi criada nesta
--   rodada para isso, por estar fora do pedido), entao a forma real de um
--   admin ver o aviso hoje e abrindo o registro/JSON do desafio ou lendo o
--   relatorio desta rodada. Documentado com essa limitacao, nao escondido.
--
-- STATUS
-- 'draft', sempre. Reexecutar este script nunca promove o desafio - o
-- proprio ON CONFLICT reafirma status = 'draft' a cada vez. Publicar (virar
-- 'active') e uma decisao humana futura, feita pelo Admin, fora deste
-- script.

begin;

do $$
begin
  if exists (
    select 1
    from public.challenges
    where slug = 'desafio-setembro-efata'
      and id <> 'a3090000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception
      'Desafio de Setembro (Efata) ja existe com um id diferente. Abortando para nao misturar dados de ciclos distintos.';
  end if;

  -- Guarda de isolamento: agosto e o desafio de validacao interna nunca
  -- podem ser alterados por este script. Falha alto (aborta a transacao
  -- inteira) se qualquer um dos dois nao estiver exatamente como esperado
  -- ANTES de qualquer insert de setembro rodar.
  if not exists (
    select 1 from public.challenges
    where id = 'a3080000-0000-4000-8000-000000000001'::uuid
      and slug = 'desafio-agosto-irreconhecivel'
  ) then
    raise exception
      'Desafio de Agosto nao encontrado intacto (id/slug esperados). Abortando antes de tocar em setembro.';
  end if;

  -- O desafio de validacao interna (a2300000-...) e mencionado no script de
  -- agosto mas NAO existe neste banco (confirmado por leitura direta antes
  -- desta rodada - producao real tem hoje um unico challenge: agosto). A
  -- guarda por isso e condicional: SE existir, precisa estar intacto; se
  -- nao existir, nao e criado nem exigido por este script (nunca cria
  -- dado de outro desafio so para satisfazer uma checagem).
  if exists (select 1 from public.challenges where id = 'a2300000-0000-4000-8000-000000000001'::uuid)
    and not exists (
      select 1 from public.challenges
      where id = 'a2300000-0000-4000-8000-000000000001'::uuid
        and slug = 'projeto-30-validacao-interna'
    )
  then
    raise exception
      'Desafio de validacao interna existe mas com slug inesperado. Abortando antes de tocar em setembro.';
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
  theme_config,
  rules_config
)
values (
  'a3090000-0000-4000-8000-000000000001',
  'Desafio de Setembro - Efatá',
  'desafio-setembro-efata',
  E'O Efatá é uma jornada de 30 dias voltada para fé, oração, leitura bíblica, gratidão, caráter, disciplina e cuidado com o corpo.\n\n"Efatá", que quer dizer "Abra-se" (referência temática: Marcos 7:34), é o convite deste ciclo: abrir espaço para Deus, renovar a mente, fortalecer o caráter, aprofundar a fé e continuar cuidando do corpo e da saúde.\n\nNão é um desafio de perfeição.\n\nÉ um convite para ouvir, refletir, agir e permanecer.',
  30,
  date '2026-09-01',
  date '2026-09-30',
  date '2026-08-28',
  date '2026-09-05',
  'draft', -- target_status: SEMPRE draft nesta fase - nunca publicar automaticamente
  jsonb_build_object(
    'headline', 'Abra-se para aquilo que Deus quer transformar em você.',
    'subheadline', 'Em agosto, você construiu disciplina. Em setembro, o convite é ir além.',
    'tagline', '30 dias para fortalecer a fé, renovar a mente, cuidar do corpo e viver com propósito.',
    'hero_message', E'Em agosto, você construiu disciplina.\n\nEm setembro, o convite é ir além.\n\nAbra sua mente.\n\nAbra seu coração.\n\nAbra espaço para Deus.',
    'short_description', 'Um ciclo de 30 dias para abrir espaço para Deus, renovar a mente, fortalecer o caráter, aprofundar a fé e continuar cuidando do corpo e da saúde.',
    'cta_label', 'Quero abrir esse espaço',
    'cta_supporting_text', 'EFATÁ. ABRA-SE.',
    -- Slogans do pedido (Parte B), guardados como chaves decorativas
    -- proprias - nunca sobrescrevem headline/tagline, que ja tem texto
    -- proprio definido acima.
    'slogan_primary', 'EFATÁ. ABRA-SE.',
    'slogan_secondary', 'Quanto mais espaço você dá para Deus, menos espaço sobra para aquilo que te afasta dEle.',
    'theme_reference', 'Marcos 7:34',
    -- Capa (Parte M) - nao gerada nesta execucao de proposito. Sem
    -- cover_image_url, o catalogo/detalhe usam o fallback visual padrao
    -- (gradiente) - mesmo efeito pratico de "sem capa" em qualquer outro
    -- desafio. As duas chaves abaixo sao so um registro explicito do
    -- pendente (nenhuma tela hoje renderiza estas duas chaves como badge -
    -- ver nota "Capa" no cabecalho deste script).
    'cover_status', 'pending_review',
    'cover_note', 'Capa pendente de revisão.'
  ),
  jsonb_build_object(
    -- mesmos valores reais confirmados hoje no desafio de agosto (Parte E/F
    -- do pedido - "manter isso como padrão").
    'reflection_points', 10,
    'finalize_day_points', 10,
    'all_habits_bonus_points', 30,
    'streak_minimum_completion', 70,
    'enrollment_type', 'open',
    'allow_join_after_start', true,
    'allow_abandonment', true,
    'participant_limit', null,
    'single_active_challenge', true
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
  status = 'draft', -- nunca promovido por uma reexecucao deste script
  theme_config = coalesce(public.challenges.theme_config, '{}'::jsonb) || excluded.theme_config,
  rules_config = coalesce(public.challenges.rules_config, '{}'::jsonb) || excluded.rules_config,
  updated_at = now();

-- DIAS (30) --------------------------------------------------------------------
-- Estrutura tematica por semana (Parte G do pedido): dias 1-7 "Abra os
-- ouvidos", 8-14 "Abra o coração", 15-21 "Abra a mente", 22-28 "Abra os
-- caminhos", 29-30 "Fechamento". Mensagens sao as 30 revisadas no pedido
-- (Parte H), usadas literalmente - nenhuma foi alterada. Nenhuma mensagem
-- usa culpa, promete cura, atribui falta de resultado a falta de fe, ou
-- cita um versiculo como se fosse texto biblico literal.

with day_catalog as (
  select
    t.day_number,
    t.title,
    th.theme,
    m.message
  from unnest(array[
    'Antes de pedir', 'Diminua o ruído', 'Ore por alguém', 'Silêncio diante de Deus',
    'O que preciso aprender', 'Respostas em silêncio', 'Abra os ouvidos',
    'Escolha perdoar', 'O bem sem esperar', 'Escuta verdadeira', 'Gratidão que transforma',
    'Sirva alguém', 'Sabedoria antes de reagir', 'Coração aberto',
    'Nem todo pensamento', 'Substitua a reclamação', 'O que você alimenta', 'Disciplina é fé',
    'Cuide do seu corpo', 'Recomeçar hoje', 'Uma verdade para lembrar',
    'Um caminho diferente', 'Coragem com propósito', 'Use o que você tem', 'Um passo adiante',
    'Comece a agir', 'Encontro na rotina', 'Permaneça',
    'Reconheça a mudança', 'Efatá. Continue aberto.'
  ]) with ordinality as t(title, day_number)
  join unnest(array[
    'ABRA OS OUVIDOS', 'ABRA OS OUVIDOS', 'ABRA OS OUVIDOS', 'ABRA OS OUVIDOS',
    'ABRA OS OUVIDOS', 'ABRA OS OUVIDOS', 'ABRA OS OUVIDOS',
    'ABRA O CORAÇÃO', 'ABRA O CORAÇÃO', 'ABRA O CORAÇÃO', 'ABRA O CORAÇÃO',
    'ABRA O CORAÇÃO', 'ABRA O CORAÇÃO', 'ABRA O CORAÇÃO',
    'ABRA A MENTE', 'ABRA A MENTE', 'ABRA A MENTE', 'ABRA A MENTE',
    'ABRA A MENTE', 'ABRA A MENTE', 'ABRA A MENTE',
    'ABRA OS CAMINHOS', 'ABRA OS CAMINHOS', 'ABRA OS CAMINHOS', 'ABRA OS CAMINHOS',
    'ABRA OS CAMINHOS', 'ABRA OS CAMINHOS', 'ABRA OS CAMINHOS',
    'FECHAMENTO', 'FECHAMENTO'
  ]) with ordinality as th(theme, day_number)
    using (day_number)
  join unnest(array[
    'Antes de pedir qualquer coisa, apenas agradeça.',
    'Hoje, diminua o ruído para ouvir melhor.',
    'Ore por alguém que talvez nunca saiba disso.',
    'Passe alguns minutos em silêncio diante de Deus.',
    'Leia a Bíblia perguntando: o que preciso aprender hoje?',
    'Nem toda resposta chega em forma de palavra.',
    'Abra os ouvidos antes de abrir a boca.',
    'Escolha perdoar, mesmo que o sentimento ainda não tenha acompanhado.',
    'Faça o bem sem esperar reconhecimento.',
    'Hoje, escute alguém com atenção verdadeira.',
    'Gratidão muda a forma como você enxerga o caminho.',
    'Sirva alguém em uma pequena necessidade.',
    'Peça sabedoria antes de reagir.',
    'Um coração aberto aprende até nos dias difíceis.',
    'Nem todo pensamento merece permanecer.',
    'Substitua uma reclamação por uma decisão.',
    'Aquilo que você alimenta dentro de si cresce.',
    'Disciplina também é uma forma de fé.',
    'Cuide do seu corpo como quem cuida de algo que recebeu.',
    'Recomeçar hoje ainda é melhor do que desistir.',
    'Escolha uma verdade para lembrar durante o dia.',
    'Talvez Deus esteja abrindo um caminho diferente do que você imaginou.',
    'Coragem não é ausência de medo, é continuar com propósito.',
    'Use aquilo que você tem para ajudar alguém.',
    'Dê um passo na direção da vida que você tem pedido.',
    'Não espere sentir tudo para começar a agir.',
    'Sua rotina também pode ser um lugar de encontro com Deus.',
    'Permaneça. Algumas transformações levam tempo.',
    'Reconheça o que mudou dentro de você.',
    'Efatá. Continue aberto para aquilo que Deus ainda fará.'
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
  ('a3090000-0000-4000-8001-' || lpad(day_number::text, 12, '0'))::uuid,
  'a3090000-0000-4000-8000-000000000001'::uuid,
  day_number,
  title,
  message,
  theme,
  '{"type": "sequential"}'::jsonb
from day_catalog
on conflict (challenge_id, day_number) do update set
  title = excluded.title,
  message = excluded.message,
  theme = excluded.theme,
  unlock_rule = excluded.unlock_rule,
  updated_at = now();

-- HABITOS (15 = 13 itens + 2 acoes do livro do mes) ------------------------------
-- category carrega o pilar (Corpo/Mente/Caráter/Espírito - coluna de texto
-- ja existente, Parte C do pedido). validation_config.essential e
-- decorativo (ver nota no cabecalho). daily_prompt e a pergunta sim/nao da
-- tela Hoje (mesma coluna e mesmo uso ja validado por agosto, migration
-- 0036).

with habit_catalog(
  seq, title, description, category, habit_type, icon, points, daily_prompt,
  is_required, frequency_type, validation_config, visibility_config, sort_order
) as (
  values
    (1, 'Beber no mínimo 3 litros de água', 'Consumir no mínimo 3 litros de água durante o dia.', 'Corpo', 'quantity'::public.habit_type, '💧', 10,
      'Bebeu pelo menos 3 litros de água hoje?', true, 'daily'::public.habit_frequency_type,
      '{"target": 3, "unit": "Litros", "short_title": "3 litros de água", "essential": true}'::jsonb,
      '{"type": "all_days"}'::jsonb, 10),
    (2, 'Fazer musculação 4 vezes por semana', 'Realizar pelo menos quatro sessões de musculação durante a semana. Não bloqueia a finalização diária.', 'Corpo', 'boolean'::public.habit_type, '🏋️', 10,
      'Treinou musculação hoje?', true, 'weekly'::public.habit_frequency_type,
      '{"target": 4, "unit": "Sessões", "short_title": "Musculação", "label": "Confirmar sessão de musculação", "essential": true}'::jsonb,
      '{"type": "all_days"}'::jsonb, 20),
    (3, 'Fazer 30 minutos de caminhada ou cardio', 'Realizar pelo menos 30 minutos de caminhada ou atividade cardiovascular durante o dia.', 'Corpo', 'duration'::public.habit_type, '🏃', 10,
      'Fez pelo menos 30 minutos de caminhada ou cardio hoje?', true, 'daily'::public.habit_frequency_type,
      '{"target": 30, "unit": "Minutos", "short_title": "Caminhada ou cardio", "essential": true}'::jsonb,
      '{"type": "all_days"}'::jsonb, 30),
    (4, 'Dormir entre 7 e 8 horas', 'Dormir entre sete e oito horas por noite. A meta registrada usa o mínimo (7h); o teto de 8h é apenas orientativo, sem suporte de meta-máxima no schema atual.', 'Corpo', 'quantity'::public.habit_type, '🛏️', 10,
      'Dormiu entre 7 e 8 horas na última noite?', true, 'daily'::public.habit_frequency_type,
      '{"target": 7, "unit": "Horas", "short_title": "Dormir de 7 a 8 horas", "target_max_informational": 8, "essential": true}'::jsonb,
      '{"type": "all_days"}'::jsonb, 40),
    (5, 'Comer pelo menos uma fruta por dia', 'Consumir pelo menos uma fruta durante o dia.', 'Corpo', 'quantity'::public.habit_type, '🍎', 10,
      'Comeu pelo menos uma fruta hoje?', true, 'daily'::public.habit_frequency_type,
      '{"target": 1, "unit": "Fruta", "short_title": "Comer uma fruta", "essential": false}'::jsonb,
      '{"type": "all_days"}'::jsonb, 50),
    (6, 'Ler um capítulo da Bíblia todos os dias', 'Ler pelo menos um capítulo da Bíblia durante o dia.', 'Espírito', 'quantity'::public.habit_type, '📖', 10,
      'Leu pelo menos um capítulo da Bíblia hoje?', true, 'daily'::public.habit_frequency_type,
      '{"target": 1, "unit": "Capítulo", "short_title": "Ler a Bíblia", "essential": true}'::jsonb,
      '{"type": "all_days"}'::jsonb, 60),
    (7, 'Orar ao acordar', 'Orar logo ao acordar, antes de sair da cama.', 'Espírito', 'boolean'::public.habit_type, '🙏', 10,
      'Você orou ao acordar hoje?', true, 'daily'::public.habit_frequency_type,
      '{"short_title": "Orar ao acordar", "label": "Confirmar com honestidade", "essential": true}'::jsonb,
      '{"type": "all_days"}'::jsonb, 70),
    (8, 'Orar antes de dormir', 'Orar antes de dormir, encerrando o dia.', 'Espírito', 'boolean'::public.habit_type, '🌙', 10,
      'Você orou antes de dormir hoje?', true, 'daily'::public.habit_frequency_type,
      '{"short_title": "Orar antes de dormir", "label": "Confirmar com honestidade", "essential": true}'::jsonb,
      '{"type": "all_days"}'::jsonb, 80),
    (9, 'Registrar uma gratidão por dia', 'Registrar pelo menos uma gratidão durante o dia.', 'Espírito', 'boolean'::public.habit_type, '🙌', 10,
      'Registrou pelo menos uma gratidão hoje?', true, 'daily'::public.habit_frequency_type,
      '{"short_title": "Registrar gratidão", "label": "Confirmar com honestidade", "essential": false}'::jsonb,
      '{"type": "all_days"}'::jsonb, 90),
    (10, 'Evitar reclamar e assumir postura de vítima', 'Manter uma postura consciente durante o dia, evitando reclamações desnecessárias e comportamentos de vitimização.', 'Caráter', 'boolean'::public.habit_type, '😡', 10,
      'Conseguiu evitar reclamações e postura de vítima hoje?', true, 'daily'::public.habit_frequency_type,
      '{"short_title": "Sem reclamação e vitimismo", "label": "Confirmar com honestidade", "essential": true}'::jsonb,
      '{"type": "all_days"}'::jsonb, 100),
    (11, 'Praticar uma atitude intencional de bondade', 'Praticar pelo menos uma atitude intencional de bondade durante a semana. Não bloqueia a finalização diária.', 'Caráter', 'boolean'::public.habit_type, '💛', 10,
      'Fez alguma atitude intencional de bondade hoje?', true, 'weekly'::public.habit_frequency_type,
      '{"target": 1, "unit": "Vezes", "short_title": "Bondade", "label": "Confirmar atitude de bondade", "essential": false}'::jsonb,
      '{"type": "all_days"}'::jsonb, 110),
    (12, 'Separar 10 minutos de silêncio e escuta', 'Separar pelo menos 10 minutos para silêncio, oração ou escuta durante o dia.', 'Espírito', 'duration'::public.habit_type, '🤫', 10,
      'Separou pelo menos 10 minutos para silêncio, oração ou escuta hoje?', true, 'daily'::public.habit_frequency_type,
      '{"target": 10, "unit": "Minutos", "short_title": "Silêncio e escuta", "essential": false}'::jsonb,
      '{"type": "all_days"}'::jsonb, 120),
    (13, 'Ficar 30 minutos sem celular antes de dormir', 'Ficar pelo menos 30 minutos sem celular antes de dormir.', 'Mente', 'duration'::public.habit_type, '📵', 10,
      'Ficou pelo menos 30 minutos sem celular antes de dormir?', true, 'daily'::public.habit_frequency_type,
      '{"target": 30, "unit": "Minutos", "short_title": "Sem celular antes de dormir", "essential": false}'::jsonb,
      '{"type": "all_days"}'::jsonb, 130),
    (14, 'Ler um pouco do seu livro', 'Ler um trecho do livro escolhido para o mês, todo dia em que for possível.', 'Mente', 'boolean'::public.habit_type, '📘', 10,
      'Leu um pouco do seu livro hoje?', false, 'monthly'::public.habit_frequency_type,
      '{"short_title": "Leitura do livro", "label": "Confirmar leitura do dia", "essential": false}'::jsonb,
      '{"type": "all_days"}'::jsonb, 140),
    (15, 'Concluir o livro do mês', 'Marcar quando terminar de ler o livro escolhido para o mês.', 'Mente', 'boolean'::public.habit_type, '📗', 30,
      'Concluiu o livro escolhido para este mês?', false, 'monthly'::public.habit_frequency_type,
      '{"short_title": "Livro concluído", "label": "Confirmar quando terminar o livro", "target": 1, "unit": "Livro", "essential": false}'::jsonb,
      '{"type": "last_day"}'::jsonb, 150)
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
  visibility_config,
  daily_prompt,
  sort_order,
  active
)
select
  ('a3090000-0000-4000-8002-' || lpad(seq::text, 12, '0'))::uuid,
  'a3090000-0000-4000-8000-000000000001'::uuid,
  title,
  description,
  category,
  habit_type,
  icon,
  points,
  is_required,
  frequency_type,
  jsonb_build_object('type', frequency_type::text),
  validation_config,
  visibility_config,
  daily_prompt,
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
  visibility_config = excluded.visibility_config,
  daily_prompt = excluded.daily_prompt,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

-- VINCULOS DIA x HABITO (30 x 15 = 450) ------------------------------------------
-- Todos os 15 habitos vinculados a todos os 30 dias (mesmo padrao de
-- agosto, inclusive para o habito 15 "Concluir o livro do mês" - o vinculo
-- existe em todos os dias, mas visibility_config = last_day faz com que
-- ele so fique "aplicavel"/visivel no dia 30, resolvido por
-- public.habit_visible_on_day - nunca uma condicional no vinculo em si).
-- "required" aqui (challenge_day_habits.required) segue o mesmo
-- is_required do habito, exatamente como agosto faz.

with day_numbers as (
  select generate_series(1, 30) as day_number
),
habit_seqs as (
  select generate_series(1, 15) as habit_seq
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
  ('a3090000-0000-4000-81' || lpad(link_catalog.day_number::text, 2, '0') || '-' || lpad(link_catalog.habit_seq::text, 12, '0'))::uuid,
  'a3090000-0000-4000-8000-000000000001'::uuid,
  ('a3090000-0000-4000-8001-' || lpad(link_catalog.day_number::text, 12, '0'))::uuid,
  ('a3090000-0000-4000-8002-' || lpad(link_catalog.habit_seq::text, 12, '0'))::uuid,
  null,
  null,
  link_catalog.habit_seq * 10,
  h.is_required
from link_catalog
join public.habits h
  on h.id = ('a3090000-0000-4000-8002-' || lpad(link_catalog.habit_seq::text, 12, '0'))::uuid
on conflict (challenge_day_id, habit_id) do update set
  override_points = excluded.override_points,
  override_description = excluded.override_description,
  sort_order = excluded.sort_order,
  required = excluded.required,
  updated_at = now();

-- ACHIEVEMENTS CANONICOS (10, reaproveitados de agosto) --------------------------
-- Mesmos slugs, icones e rule_config ja usados por agosto e pelo desafio
-- de validacao interna (Parte K do pedido - nunca duplicar conquistas
-- globais, nunca criar conquistas exclusivas do Efata nesta fase).

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
  ('a3090000-0000-4000-8003-000000000001', 'a3090000-0000-4000-8000-000000000001',
    'Primeiro hábito', 'primeiro-habito', 'Concluir o primeiro hábito do ciclo.', 'sparkles', 0,
    '{"type": "first_habit"}'::jsonb, true, 10),
  ('a3090000-0000-4000-8003-000000000002', 'a3090000-0000-4000-8000-000000000001',
    'Primeiro dia', 'primeiro-dia', 'Finalizar o primeiro dia do ciclo.', 'sunrise', 0,
    '{"type": "first_day"}'::jsonb, true, 20),
  ('a3090000-0000-4000-8003-000000000003', 'a3090000-0000-4000-8000-000000000001',
    'Três dias seguidos', 'tres-dias-seguidos', 'Manter três dias válidos em sequência.', 'flame', 0,
    '{"type": "streak", "days": 3}'::jsonb, true, 30),
  ('a3090000-0000-4000-8003-000000000004', 'a3090000-0000-4000-8000-000000000001',
    'Primeira semana', 'primeira-semana', 'Finalizar sete dias do ciclo.', 'calendar-check', 0,
    '{"type": "finalized_days", "days": 7}'::jsonb, true, 40),
  ('a3090000-0000-4000-8003-000000000005', 'a3090000-0000-4000-8000-000000000001',
    'Sete leituras', 'sete-leituras', 'Concluir sete leituras no ciclo.', 'book-open', 0,
    '{"type": "reading_completions", "count": 7}'::jsonb, true, 50),
  ('a3090000-0000-4000-8003-000000000006', 'a3090000-0000-4000-8000-000000000001',
    'Sete atividades físicas', 'sete-atividades-fisicas', 'Concluir sete atividades físicas no ciclo.', 'activity', 0,
    '{"type": "physical_activity_completions", "count": 7}'::jsonb, true, 60),
  ('a3090000-0000-4000-8003-000000000007', 'a3090000-0000-4000-8000-000000000001',
    'Sete reflexões', 'sete-reflexoes', 'Registrar sete reflexões.', 'pen-line', 0,
    '{"type": "reflection_days", "count": 7}'::jsonb, true, 70),
  ('a3090000-0000-4000-8003-000000000008', 'a3090000-0000-4000-8000-000000000001',
    'Metade do caminho', 'metade-do-caminho', 'Finalizar metade da duração configurada.', 'route', 0,
    '{"type": "halfway"}'::jsonb, true, 80),
  ('a3090000-0000-4000-8003-000000000009', 'a3090000-0000-4000-8000-000000000001',
    'Retorno forte', 'retorno-forte', 'Voltar com um dia válido depois de perder o ritmo.', 'rotate-ccw', 0,
    '{"type": "return_after_break"}'::jsonb, true, 90),
  ('a3090000-0000-4000-8003-000000000010', 'a3090000-0000-4000-8000-000000000001',
    'Missão concluída', 'missao-concluida', 'Finalizar a duração configurada do ciclo.', 'trophy', 0,
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

-- LEMBRETES POR HABITO (rascunhos, todos desativados) ----------------------------
-- challenge_habit_notifications (migration 0053) - unique(habit_id), uma
-- linha por habito. enabled = false em TODAS: nenhuma notificacao e
-- enviada ao criar o desafio, nem nunca, ate um admin ativar manualmente
-- (Parte J do pedido). weekdays cobre todos os dias da semana (o proprio
-- enabled=false ja impede qualquer envio, independente do agendamento).

insert into public.challenge_habit_notifications (
  habit_id, enabled, notification_title, notification_body,
  notification_time, frequency_type, weekdays, only_if_not_completed, priority
)
values
  -- Orar ao acordar -> "Oração da manhã"
  ('a3090000-0000-4000-8002-000000000007', false, 'Oração da manhã',
    'Comece o dia abrindo espaço para Deus.', '07:30', 'weekly',
    '[0,1,2,3,4,5,6]'::jsonb, true, 5),
  -- Ler um capítulo da Bíblia -> "Leitura bíblica"
  ('a3090000-0000-4000-8002-000000000006', false, 'Leitura bíblica',
    'Reserve alguns minutos para ouvir, refletir e permanecer.', '12:30', 'weekly',
    '[0,1,2,3,4,5,6]'::jsonb, true, 5),
  -- Orar antes de dormir -> "Oração da noite"
  ('a3090000-0000-4000-8002-000000000008', false, 'Oração da noite',
    'Antes de dormir, desacelere, agradeça e ore.', '21:30', 'weekly',
    '[0,1,2,3,4,5,6]'::jsonb, true, 5),
  -- Registrar uma gratidão -> "Gratidão"
  ('a3090000-0000-4000-8002-000000000009', false, 'Gratidão',
    'O que aconteceu hoje que merece sua gratidão?', '20:30', 'weekly',
    '[0,1,2,3,4,5,6]'::jsonb, true, 5)
on conflict (habit_id) do update set
  enabled = false, -- reafirma desativado mesmo em reexecucao
  notification_title = excluded.notification_title,
  notification_body = excluded.notification_body,
  notification_time = excluded.notification_time,
  frequency_type = excluded.frequency_type,
  weekdays = excluded.weekdays,
  only_if_not_completed = excluded.only_if_not_completed,
  priority = excluded.priority,
  updated_at = now();

-- AUDITORIA (registrada nos logs administrativos, Parte O do pedido) ------------
-- admin_audit_logs exige admin_user_id (referencia real a public.users) -
-- este script roda fora de uma sessao autenticada, entao nao ha um
-- auth.uid() para atribuir. Em vez de inventar um ator ou deixar de
-- registrar, o proprio "select informativo" no final deste arquivo (fora
-- da transacao) e a auditoria em texto: cada execucao imprime o estado
-- final do desafio para o operador colar no relatorio da rodada. Ver
-- tambem os comentarios de cabecalho, versionados no git, como o registro
-- permanente de quem/quando/por que.

-- VALIDACOES (dentro da transacao) --------------------------------------------

do $$
declare
  target_challenge_id uuid := 'a3090000-0000-4000-8000-000000000001';
  august_challenge_id uuid := 'a3080000-0000-4000-8000-000000000001';
  internal_challenge_id uuid := 'a2300000-0000-4000-8000-000000000001';
  v_count integer;
  v_sum integer;
begin
  select count(*) into v_count
  from public.challenges
  where slug = 'desafio-setembro-efata';
  if v_count <> 1 then
    raise exception 'Esperado 1 challenge com slug desafio-setembro-efata, encontrado %', v_count;
  end if;

  select count(*) into v_count
  from public.challenges
  where id = target_challenge_id and slug = 'desafio-setembro-efata';
  if v_count <> 1 then
    raise exception 'Challenge com slug esperado nao esta no UUID determinístico esperado.';
  end if;

  -- status precisa ser SEMPRE draft
  select count(*) into v_count
  from public.challenges
  where id = target_challenge_id and status = 'draft';
  if v_count <> 1 then
    raise exception 'Desafio de Setembro precisa estar em draft - nao publicado automaticamente.';
  end if;

  select count(*) into v_count
  from public.challenge_days
  where challenge_id = target_challenge_id;
  if v_count <> 30 then
    raise exception 'Esperado 30 dias, encontrado %', v_count;
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

  -- toda mensagem precisa existir e nao ser vazia
  select count(*) into v_count
  from public.challenge_days
  where challenge_id = target_challenge_id
    and (message is null or btrim(message) = '');
  if v_count <> 0 then
    raise exception 'Encontrados % dias sem mensagem.', v_count;
  end if;

  -- exatamente 15 habitos (13 itens + 2 acoes do livro)
  select count(*) into v_count
  from public.habits
  where challenge_id = target_challenge_id;
  if v_count <> 15 then
    raise exception 'Esperado 15 habitos, encontrado %', v_count;
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
    raise exception 'Encontrados % títulos de hábito duplicados.', v_count;
  end if;

  -- toda linha precisa ter daily_prompt preenchido
  select count(*) into v_count
  from public.habits
  where challenge_id = target_challenge_id
    and (daily_prompt is null or btrim(daily_prompt) = '');
  if v_count <> 0 then
    raise exception 'Encontrados % hábitos sem daily_prompt.', v_count;
  end if;

  -- frequencias: 11 diarios, 2 semanais, 2 mensais
  select count(*) into v_count
  from public.habits
  where challenge_id = target_challenge_id and frequency_type = 'daily';
  if v_count <> 11 then
    raise exception 'Esperado 11 hábitos diários, encontrado %', v_count;
  end if;

  select count(*) into v_count
  from public.habits
  where challenge_id = target_challenge_id and frequency_type = 'weekly';
  if v_count <> 2 then
    raise exception 'Esperado 2 hábitos semanais (Treino, Bondade), encontrado %', v_count;
  end if;

  select count(*) into v_count
  from public.habits
  where challenge_id = target_challenge_id and frequency_type = 'monthly';
  if v_count <> 2 then
    raise exception 'Esperado 2 hábitos mensais (livro diário + conclusão), encontrado %', v_count;
  end if;

  -- 13 obrigatorios, 2 nao obrigatorios (as 2 acoes do livro)
  select count(*) into v_count
  from public.habits
  where challenge_id = target_challenge_id and is_required = true;
  if v_count <> 13 then
    raise exception 'Esperado 13 hábitos obrigatórios, encontrado %', v_count;
  end if;

  select count(*) into v_count
  from public.habits
  where challenge_id = target_challenge_id and is_required = false;
  if v_count <> 2 then
    raise exception 'Esperado 2 hábitos não obrigatórios (livro), encontrado %', v_count;
  end if;

  -- "Concluir o livro do mês" precisa ser visível so no ultimo dia (30)
  select count(*) into v_count
  from public.habits
  where challenge_id = target_challenge_id
    and title = 'Concluir o livro do mês'
    and visibility_config = '{"type": "last_day"}'::jsonb
    and public.habit_visible_on_day(visibility_config, 30, 30) = true
    and public.habit_visible_on_day(visibility_config, 1, 30) = false
    and public.habit_visible_on_day(visibility_config, 15, 30) = false;
  if v_count <> 1 then
    raise exception '"Concluir o livro do mês" não está configurado como visível somente no último dia.';
  end if;

  -- pontuacao: obrigatorios = 130 (mesmo total de agosto), diarios = 110,
  -- nao-diarios = 60 (20 semanal + 40 livro), total geral = 170
  select coalesce(sum(points), 0) into v_sum
  from public.habits
  where challenge_id = target_challenge_id and is_required = true;
  if v_sum <> 130 then
    raise exception 'Esperado 130 pontos somados nos hábitos obrigatórios, encontrado %', v_sum;
  end if;

  select coalesce(sum(points), 0) into v_sum
  from public.habits
  where challenge_id = target_challenge_id and frequency_type = 'daily';
  if v_sum <> 110 then
    raise exception 'Esperado 110 pontos somados nos hábitos diários, encontrado %', v_sum;
  end if;

  select coalesce(sum(points), 0) into v_sum
  from public.habits
  where challenge_id = target_challenge_id and frequency_type <> 'daily';
  if v_sum <> 60 then
    raise exception 'Esperado 60 pontos somados nos hábitos não-diários, encontrado %', v_sum;
  end if;

  select coalesce(sum(points), 0) into v_sum
  from public.habits
  where challenge_id = target_challenge_id;
  if v_sum <> 170 then
    raise exception 'Esperado 170 pontos somados no total dos 15 hábitos, encontrado %', v_sum;
  end if;

  -- vinculos: 30 x 15 = 450, sem orfaos
  select count(*) into v_count
  from public.challenge_day_habits
  where challenge_id = target_challenge_id;
  if v_count <> 450 then
    raise exception 'Esperado 450 vínculos challenge_day_habits (30x15), encontrado %', v_count;
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
    raise exception 'Encontrados % vínculos órfãos em challenge_day_habits.', v_count;
  end if;

  -- rules_config / streak
  select count(*) into v_count
  from public.challenges
  where id = target_challenge_id
    and (rules_config ->> 'reflection_points')::int = 10
    and (rules_config ->> 'finalize_day_points')::int = 10
    and (rules_config ->> 'all_habits_bonus_points')::int = 30
    and (rules_config ->> 'streak_minimum_completion')::int = 70
    and rules_config ->> 'enrollment_type' = 'open'
    and (rules_config ->> 'allow_join_after_start')::boolean = true
    and (rules_config ->> 'allow_abandonment')::boolean = true
    and (rules_config ->> 'single_active_challenge')::boolean = true
    and rules_config ? 'participant_limit';
  if v_count <> 1 then
    raise exception 'rules_config do desafio não confere com o padrão oficial (mesmo de agosto).';
  end if;

  select count(*) into v_count
  from public.challenges
  where id = target_challenge_id
    and theme_config ? 'headline'
    and theme_config ? 'tagline'
    and theme_config ? 'cover_status'
    and theme_config ->> 'cover_status' = 'pending_review'
    and not (theme_config ? 'cover_image_url');
  if v_count <> 1 then
    raise exception 'theme_config do desafio não confere com o padrão esperado (capa pendente).';
  end if;

  select count(*) into v_count
  from public.challenges
  where id = target_challenge_id
    and duration_days = 30
    and start_date = date '2026-09-01'
    and end_date = date '2026-09-30'
    and enrollment_start = date '2026-08-28'
    and enrollment_end = date '2026-09-05'
    and enrollment_start <= enrollment_end;
  if v_count <> 1 then
    raise exception 'Datas do ciclo não conferem com o esperado.';
  end if;

  select c.duration_days into v_count
  from public.challenges c
  where c.id = target_challenge_id;
  if v_count <> (
    select count(*) from public.challenge_days where challenge_id = target_challenge_id
  ) then
    raise exception 'duration_days do challenge não bate com a quantidade de challenge_days.';
  end if;

  -- achievements
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
    raise exception 'Esperado 10 achievements canônicos ativos, encontrado %', v_count;
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

  -- lembretes: 4 rascunhos, todos desativados, todos apontando para
  -- habitos deste desafio
  select count(*) into v_count
  from public.challenge_habit_notifications chn
  join public.habits h on h.id = chn.habit_id
  where h.challenge_id = target_challenge_id;
  if v_count <> 4 then
    raise exception 'Esperado 4 rascunhos de notificação por hábito, encontrado %', v_count;
  end if;

  select count(*) into v_count
  from public.challenge_habit_notifications chn
  join public.habits h on h.id = chn.habit_id
  where h.challenge_id = target_challenge_id
    and chn.enabled = true;
  if v_count <> 0 then
    raise exception 'Encontrado(s) % lembrete(s) ativado(s) - todos precisam nascer desativados.', v_count;
  end if;

  -- zero inscricoes, zero progresso - nunca criados por este script
  select count(*) into v_count
  from public.challenge_enrollments
  where challenge_id = target_challenge_id;
  if v_count <> 0 then
    raise exception 'Esperado 0 inscrições no desafio de Setembro, encontrado %', v_count;
  end if;

  -- isolamento: agosto e o desafio de validacao interna continuam intactos
  select count(*) into v_count
  from public.challenges
  where id = august_challenge_id
    and slug = 'desafio-agosto-irreconhecivel'
    and status = 'active'
    and duration_days = 31;
  if v_count <> 1 then
    raise exception 'Desafio de Agosto não está mais intacto (id/slug/status/duração esperados).';
  end if;

  select count(*) into v_count
  from public.habits
  where challenge_id = august_challenge_id;
  if v_count <> 14 then
    raise exception 'Contagem de hábitos de Agosto mudou (esperado 14) - possível vazamento entre desafios.';
  end if;

  -- Condicional (ver nota na guarda de pre-check): so exige intacto se
  -- ja existia antes. Neste banco de producao ele nao existe hoje - nunca
  -- criado por este script so para "existir".
  if exists (select 1 from public.challenges where id = internal_challenge_id) then
    select count(*) into v_count
    from public.challenges
    where id = internal_challenge_id
      and slug = 'projeto-30-validacao-interna';
    if v_count <> 1 then
      raise exception 'Desafio interno de validação existe mas não está mais intacto (slug esperado).';
    end if;
  end if;

  raise notice 'OK: desafio-setembro-efata validado (1 challenge draft, 30 dias, 15 hábitos [11 diários + 2 semanais + 2 mensais], 450 vínculos, 10 achievements, 4 lembretes desativados, 0 inscrições, agosto intacto).';
end;
$$;

commit;

-- Consulta informativa (fora da transacao, somente leitura, executada
-- apenas apos o commit ter sido confirmado com sucesso).
select
  'september_efata_ready' as result,
  c.id,
  c.slug,
  c.name,
  c.status,
  c.duration_days,
  c.start_date,
  c.end_date,
  c.enrollment_start,
  c.enrollment_end,
  (select count(*) from public.challenge_days where challenge_id = c.id) as days_created,
  (select count(*) from public.habits where challenge_id = c.id) as habits_created,
  (select count(*) from public.challenge_day_habits where challenge_id = c.id) as links_created,
  (select count(*) from public.achievements where challenge_id = c.id) as achievements_created,
  (select count(*) from public.challenge_enrollments where challenge_id = c.id) as enrollments
from public.challenges c
where c.slug = 'desafio-setembro-efata';

-- Consultas adicionais para operadores (somente leitura):
-- select title, daily_prompt, frequency_type, is_required, points, category, visibility_config from public.habits where challenge_id = 'a3090000-0000-4000-8000-000000000001' order by sort_order;
-- select day_number, title, theme, message from public.challenge_days where challenge_id = 'a3090000-0000-4000-8000-000000000001' order by day_number;
--
-- Publicar (decisao humana, fora deste script): usar o fluxo normal do
-- Admin (/admin/desafios -> editar -> publicar), que ja roda
-- validateChallengeForPublish e a transicao de status guardada em
-- admin-challenges.actions.ts. Este script nunca publica sozinho.
--
-- Cleanup nao destrutivo (arquivar sem apagar):
-- update public.challenges
-- set status = 'archived',
--     deleted_at = coalesce(deleted_at, now()),
--     updated_at = now()
-- where id = 'a3090000-0000-4000-8000-000000000001';
--
-- Cleanup destrutivo, intencionalmente comentado. Exige aprovacao explicita
-- antes de qualquer uso. Nao remove usuarios de autenticacao. Seguro por
-- construcao (zero enrollments/daily_logs/habit_logs/journal_entries/
-- point_events/user_achievements neste desafio, ja que nunca foi
-- publicado) - listado aqui so por simetria com o script de agosto.
-- begin;
-- delete from public.challenge_habit_notifications
-- where habit_id in (select id from public.habits where challenge_id = 'a3090000-0000-4000-8000-000000000001');
-- delete from public.challenge_day_habits where challenge_id = 'a3090000-0000-4000-8000-000000000001';
-- delete from public.achievements where challenge_id = 'a3090000-0000-4000-8000-000000000001';
-- delete from public.habits where challenge_id = 'a3090000-0000-4000-8000-000000000001';
-- delete from public.challenge_days where challenge_id = 'a3090000-0000-4000-8000-000000000001';
-- delete from public.challenges where id = 'a3090000-0000-4000-8000-000000000001';
-- commit;
