-- Fase 5: dados minimos de demonstracao para a area de Dicas.
--
-- ESTE SCRIPT E ADMINISTRATIVO (mesmo padrao de
-- scripts/challenges/create-august-irreconhecivel.sql):
-- - NAO e uma migration (nao pertence a supabase/migrations).
-- - NAO e seed (nao roda automaticamente em nenhum pipeline).
-- - So atua no banco remoto quando executado explicitamente por um operador:
--     npx.cmd supabase db query --linked --file scripts\content\create-demo-tips.sql
-- - NAO contem credenciais.
-- - Depende das colunas content_items.category / content_items.display_order
--   criadas em supabase/migrations/0011_tips_content.sql. Rode a migration
--   0011 antes deste script.
--
-- CONTEUDO
-- 6 dicas minimas (nao um conteudo real em massa), reaproveitando
-- public.content_items com content_type = 'tip_card'. 4 delas apontam para
-- o desafio de agosto (challenge_id = a3080000-...-000000000001) para
-- demonstrar a secao "Dicas para este desafio"; 2 ficam gerais (challenge_id
-- nulo) para demonstrar a listagem sem vinculo. NENHUMA delas tem image_url
-- (este script nunca foi executado contra o remoto - confirmado por audit
-- direto - e so serve como esqueleto textual; publicar um card de teste de
-- verdade exige subir uma imagem real pelo Admin, image_url e obrigatoria).
--
-- IDEMPOTENCIA
-- IDs fixos (UUIDs deterministicos, faixa a4000000-0000-4000-8000-...,
-- exclusiva e distinta de a2300000-... e a3080000-...) + ON CONFLICT (id) DO
-- UPDATE. Pode ser executado quantas vezes forem necessarias sem duplicar.
--
-- Nao apaga nenhuma linha. Nao cria usuarios. Nao altera nenhum outro
-- desafio ou tabela.

begin;

with tip_catalog(
  seq, title, slug, summary, content, category, challenge_id, display_order
) as (
  values
    (1,
      'Como beber mais água',
      'como-beber-mais-agua',
      'Pequenos gatilhos ao longo do dia valem mais do que tentar beber tudo de uma vez.',
      E'Encha uma garrafa grande logo pela manhã e defina 2 ou 3 horários fixos do dia (ao acordar, no almoço, no fim da tarde) para esvaziá-la.\n\nDeixar a garrafa sempre visível, na mesa ou na bolsa, reduz a chance de esquecer. Se preferir, associe cada copo a um hábito que você já faz - por exemplo, beber água antes de cada refeição.',
      'Bem-estar',
      'a3080000-0000-4000-8000-000000000001'::uuid,
      10),
    (2,
      'Como organizar quatro treinos na semana',
      'como-organizar-quatro-treinos-na-semana',
      'Fixar os mesmos dias e horários facilita muito mais do que decidir a cada manhã.',
      E'Escolha 4 dias fixos (por exemplo: segunda, terça, quinta e sexta) e trate-os como compromissos, não como algo opcional do dia.\n\nSe perder um dia, troque-o pelo próximo disponível na semana em vez de tentar compensar dobrando o treino - a meta é sustentar o ritmo, não perseguir um número perfeito.',
      'Treino',
      'a3080000-0000-4000-8000-000000000001'::uuid,
      20),
    (3,
      'Fontes simples de proteína',
      'fontes-simples-de-proteina',
      'Não precisa ser complicado: algumas opções práticas já resolvem a maioria das refeições.',
      E'Ovos, iogurte natural, feijão, frango, atum em lata e queijo branco são fontes acessíveis e rápidas de preparar.\n\nUma forma simples de garantir proteína em toda refeição é sempre perguntar "qual é a proteína deste prato?" antes de servir - se a resposta não for clara, é sinal de que falta incluir uma.',
      'Alimentação',
      'a3080000-0000-4000-8000-000000000001'::uuid,
      30),
    (4,
      'Como reduzir cafeína após as 16h',
      'como-reduzir-cafeina-apos-as-16h',
      'A troca não precisa ser radical - só precisa ser consistente no fim da tarde.',
      E'Troque o café da tarde por chá de ervas, água com limão ou apenas água gelada - o ritual de "ter algo na mão" costuma ser tão importante quanto a bebida em si.\n\nSe o cansaço no fim da tarde for o gatilho, um alongamento rápido ou uma caminhada curta ajuda mais do que outra dose de cafeína, e não compromete o sono à noite.',
      'Alimentação',
      'a3080000-0000-4000-8000-000000000001'::uuid,
      40),
    (5,
      'Ideias de autocuidado',
      'ideias-de-autocuidado',
      'Autocuidado não precisa ser caro nem demorado para contar.',
      E'Algumas ideias simples: um banho mais demorado sem pressa, 10 minutos sem celular antes de dormir, organizar um espaço pequeno da casa, ou marcar um horário só seu na agenda.\n\nO importante não é a ação em si, mas a intenção por trás dela: um momento em que você escolhe cuidar de si mesmo, sem culpa.',
      'Bem-estar',
      'a3080000-0000-4000-8000-000000000001'::uuid,
      50),
    (6,
      'Como melhorar o sono',
      'como-melhorar-o-sono',
      'Pequenos ajustes na rotina noturna pesam mais do que qualquer suplemento.',
      E'Tente manter o mesmo horário para dormir e acordar, mesmo nos fins de semana. Evite telas brilhantes na última meia hora antes de deitar e deixe o quarto o mais escuro possível.\n\nSe a cabeça ainda estiver acelerada, escrever por 2 minutos o que ficou pendente para o dia seguinte ajuda a "descarregar" a mente antes de dormir.',
      'Sono',
      null,
      60)
)
insert into public.content_items (
  id,
  challenge_id,
  content_type,
  title,
  slug,
  summary,
  content,
  category,
  status,
  published_at,
  display_order
)
select
  ('a4000000-0000-4000-8000-' || lpad(seq::text, 12, '0'))::uuid,
  challenge_id,
  'tip_card',
  title,
  slug,
  summary,
  content,
  category,
  -- draft, nao published: sem image_url um card nunca deve ficar visivel a
  -- usuarios reais (a Admin UI ja bloqueia publicar sem imagem - este script
  -- SQL direto nao passa por essa validacao, entao a seguranca fica aqui).
  'draft',
  null,
  display_order
from tip_catalog
on conflict (id) do update set
  challenge_id = excluded.challenge_id,
  title = excluded.title,
  slug = excluded.slug,
  summary = excluded.summary,
  content = excluded.content,
  category = excluded.category,
  status = excluded.status,
  display_order = excluded.display_order,
  updated_at = now();

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.content_items
  where content_type = 'tip_card'
    and id::text like 'a4000000-0000-4000-8000-%';
  if v_count <> 6 then
    raise exception 'Esperado 6 dicas de demonstracao, encontrado %', v_count;
  end if;

  select count(*) into v_count
  from public.content_items
  where content_type = 'tip_card'
    and challenge_id = 'a3080000-0000-4000-8000-000000000001'::uuid;
  if v_count <> 4 then
    raise exception 'Esperado 4 dicas vinculadas ao desafio de agosto, encontrado %', v_count;
  end if;

  select count(*) into v_count
  from (
    select slug from public.content_items where content_type = 'tip_card' group by slug having count(*) > 1
  ) duplicated;
  if v_count <> 0 then
    raise exception 'Encontrados % slugs de dica duplicados.', v_count;
  end if;

  raise notice 'OK: 6 rascunhos de demonstracao inseridos (4 vinculados ao desafio de agosto, 2 gerais), status = draft de proposito. Para publicar de verdade: abra /admin/dicas, edite cada um, envie uma imagem real e publique - nunca fica visivel a usuarios sem isso.';
end;
$$;

commit;

select id, slug, category, challenge_id, status, image_url from public.content_items where content_type = 'tip_card' order by display_order;
