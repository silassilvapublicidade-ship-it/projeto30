-- Development seed only. It intentionally avoids auth users and passwords.

insert into public.challenges (
  id,
  name,
  slug,
  description,
  duration_days,
  status,
  theme_config,
  rules_config
) values (
  '10000000-0000-4000-8000-000000000030',
  'Projeto 30 - Ciclo Base',
  'projeto-30-ciclo-base',
  'Ciclo inicial de desenvolvimento para validar hábitos, leitura e gamificação saudável.',
  30,
  'active',
  '{"palette": {"background": "#050505", "surface": "#181B1F", "primary": "#FF6A00", "secondary": "#FFB000"}}'::jsonb,
  '{"streak_minimum_completion": 70, "allow_partial_day": true, "late_days_policy": "server_configured"}'::jsonb
) on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  theme_config = excluded.theme_config,
  rules_config = excluded.rules_config,
  updated_at = now();

insert into public.challenge_days (challenge_id, day_number, title, message)
select
  '10000000-0000-4000-8000-000000000030',
  day_number,
  'Dia ' || day_number,
  case
    when day_number = 1 then 'Um passo pequeno, feito hoje.'
    when day_number = 15 then 'Metade do caminho pede constância, não perfeição.'
    when day_number = 30 then 'Feche o ciclo com verdade e gratidão.'
    else 'Continue construindo um dia de cada vez.'
  end
from generate_series(1, 30) as day_number
on conflict (challenge_id, day_number) do update set
  title = excluded.title,
  message = excluded.message,
  updated_at = now();

insert into public.habits (
  id,
  challenge_id,
  title,
  description,
  category,
  habit_type,
  icon,
  points,
  sort_order
) values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000030',
    'Ler o capítulo do dia',
    'Referência configurada no plano de leitura.',
    'espirito',
    'reading',
    'book-open',
    10,
    10
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000030',
    'Orar ao acordar',
    'Começar o dia com gratidão e direção.',
    'espirito',
    'boolean',
    'sunrise',
    10,
    20
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000030',
    'Beber água',
    'Registrar a meta diária definida pelo ciclo.',
    'corpo',
    'boolean',
    'droplets',
    10,
    30
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000030',
    'Mover o corpo',
    'Treino, caminhada ou atividade física possível para o dia.',
    'corpo',
    'boolean',
    'activity',
    15,
    40
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000030',
    'Registrar gratidão',
    'Escrever uma frase honesta sobre o dia.',
    'mente',
    'boolean',
    'sparkles',
    10,
    50
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  habit_type = excluded.habit_type,
  icon = excluded.icon,
  points = excluded.points,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.challenge_day_habits (
  challenge_day_id,
  habit_id,
  sort_order,
  required
)
select
  cd.id,
  h.id,
  h.sort_order,
  true
from public.challenge_days cd
join public.habits h on h.challenge_id = cd.challenge_id
where cd.challenge_id = '10000000-0000-4000-8000-000000000030'
on conflict (challenge_day_id, habit_id) do update set
  sort_order = excluded.sort_order,
  required = excluded.required,
  updated_at = now();

insert into public.reading_plans (
  id,
  challenge_id,
  name,
  description,
  active
) values (
  '30000000-0000-4000-8000-000000000030',
  '10000000-0000-4000-8000-000000000030',
  'Marcos, Tiago, Filipenses e Efésios',
  'Plano inicial com referências e reflexões originais, sem reprodução de texto bíblico protegido.',
  true
) on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  active = excluded.active,
  updated_at = now();

insert into public.reading_plan_items (
  reading_plan_id,
  day_number,
  reference,
  title,
  summary,
  reflection,
  question,
  sort_order
) values
  ('30000000-0000-4000-8000-000000000030', 1, 'Marcos 1', 'Jesus em ação', 'Observe autoridade, compaixão e chamado.', 'A fé começa em movimento.', 'Qual atitude prática esse capítulo te chama a viver?', 1),
  ('30000000-0000-4000-8000-000000000030', 2, 'Marcos 2', 'Graça que levanta', 'Perceba como Jesus encontra pessoas em situações reais.', 'Recomeçar também é parte da jornada.', 'Onde você precisa aceitar ajuda hoje?', 1),
  ('30000000-0000-4000-8000-000000000030', 3, 'Marcos 3', 'Propósito com firmeza', 'Jesus age com clareza mesmo sob pressão.', 'Disciplina também é escolher o essencial.', 'Que distração precisa perder força hoje?', 1),
  ('30000000-0000-4000-8000-000000000030', 4, 'Marcos 4', 'Semente e constância', 'A transformação cresce no terreno preparado.', 'Pequenas ações repetidas criam raízes.', 'Qual hábito você vai proteger hoje?', 1),
  ('30000000-0000-4000-8000-000000000030', 5, 'Marcos 5', 'Restauração', 'Jesus atravessa dor, medo e vergonha.', 'Nada precisa ser escondido para sempre.', 'Qual área pede coragem para ser cuidada?', 1),
  ('30000000-0000-4000-8000-000000000030', 6, 'Marcos 6', 'Serviço possível', 'O pouco entregue com fé pode alimentar muitos.', 'Você não precisa esperar condições perfeitas.', 'O que você pode oferecer hoje?', 1),
  ('30000000-0000-4000-8000-000000000030', 7, 'Marcos 7', 'Coração alinhado', 'Jesus aponta para uma vida íntegra por dentro e por fora.', 'Evolução real começa no interior.', 'Que intenção você quer purificar nesta semana?', 1),
  ('30000000-0000-4000-8000-000000000030', 8, 'Marcos 8', 'Visão recuperada', 'A caminhada com Jesus ajusta a forma de ver.', 'Nem toda clareza chega de uma vez.', 'Qual decisão precisa de uma segunda olhada?', 1),
  ('30000000-0000-4000-8000-000000000030', 9, 'Marcos 9', 'Fé em processo', 'Há espaço para fé e pedido de ajuda no mesmo coração.', 'Fragilidade não cancela crescimento.', 'Onde você precisa ser honesto sobre sua dificuldade?', 1),
  ('30000000-0000-4000-8000-000000000030', 10, 'Marcos 10', 'Servir melhor', 'Grandeza aparece como serviço, não como palco.', 'Propósito amadurece quando vira cuidado.', 'Quem será servido por sua disciplina hoje?', 1),
  ('30000000-0000-4000-8000-000000000030', 11, 'Marcos 11', 'Fruto e oração', 'Fé prática aparece no que produzimos.', 'Rotina sem fruto precisa ser revista.', 'Qual fruto concreto você quer gerar?', 1),
  ('30000000-0000-4000-8000-000000000030', 12, 'Marcos 12', 'Prioridades', 'Amar a Deus e ao próximo organiza todo o resto.', 'Disciplina sem amor vira peso.', 'Como seu dia pode expressar amor de forma prática?', 1),
  ('30000000-0000-4000-8000-000000000030', 13, 'Marcos 13', 'Vigilância', 'Jesus ensina atenção e perseverança.', 'Constância é permanecer desperto.', 'Que sinal do seu dia pede atenção?', 1),
  ('30000000-0000-4000-8000-000000000030', 14, 'Marcos 14', 'Entrega', 'A fidelidade é testada em escolhas concretas.', 'Propósito fica visível quando custa algo.', 'O que você precisa entregar hoje?', 1),
  ('30000000-0000-4000-8000-000000000030', 15, 'Marcos 15', 'Sacrifício', 'Olhe para a entrega de Jesus com reverência.', 'Metade do caminho também é lugar de humildade.', 'O que mudou em você até aqui?', 1),
  ('30000000-0000-4000-8000-000000000030', 16, 'Marcos 16', 'Esperança viva', 'A vitória abre caminho para missão.', 'O fim de uma fase pode ser começo.', 'Que esperança precisa voltar ao centro?', 1),
  ('30000000-0000-4000-8000-000000000030', 17, 'Tiago 1', 'Perseverança', 'Maturidade cresce em meio a provas e prática.', 'Constância se fortalece no dia difícil.', 'Como você vai praticar perseverança hoje?', 1),
  ('30000000-0000-4000-8000-000000000030', 18, 'Tiago 2', 'Fé visível', 'A fé madura aparece em atitudes.', 'Intenção boa precisa virar gesto.', 'Qual atitude vai confirmar sua decisão?', 1),
  ('30000000-0000-4000-8000-000000000030', 19, 'Tiago 3', 'Palavras', 'A fala pode construir ou ferir.', 'Disciplina também passa pela boca.', 'Que palavra você precisa escolher melhor hoje?', 1),
  ('30000000-0000-4000-8000-000000000030', 20, 'Tiago 4', 'Humildade', 'Aproximar-se de Deus reorganiza desejos.', 'Controle não é o mesmo que entrega.', 'Onde você precisa diminuir para amadurecer?', 1),
  ('30000000-0000-4000-8000-000000000030', 21, 'Tiago 5', 'Paciência', 'O tempo também trabalha na formação.', 'Nem tudo floresce no seu calendário.', 'O que você precisa esperar com fidelidade?', 1),
  ('30000000-0000-4000-8000-000000000030', 22, 'Filipenses 1', 'Alegria com propósito', 'Paulo encontra sentido mesmo em limitações.', 'Propósito sustenta alegria real.', 'Como seu desafio pode servir algo maior?', 1),
  ('30000000-0000-4000-8000-000000000030', 23, 'Filipenses 2', 'Humildade ativa', 'A mente de Cristo aparece em serviço.', 'Evoluir é aprender a servir melhor.', 'Qual escolha humilde você fará hoje?', 1),
  ('30000000-0000-4000-8000-000000000030', 24, 'Filipenses 3', 'Foco', 'Prosseguir exige deixar pesos para trás.', 'A meta precisa orientar o ritmo.', 'O que você vai deixar para avançar?', 1),
  ('30000000-0000-4000-8000-000000000030', 25, 'Filipenses 4', 'Paz treinada', 'Gratidão, oração e pensamento correto formam o coração.', 'Paz também é prática diária.', 'Que pensamento você vai alimentar hoje?', 1),
  ('30000000-0000-4000-8000-000000000030', 26, 'Efésios 1', 'Identidade', 'Antes de fazer, lembre quem você é em Cristo.', 'Identidade sustenta disciplina.', 'Que verdade precisa guiar seu dia?', 1),
  ('30000000-0000-4000-8000-000000000030', 27, 'Efésios 2', 'Graça', 'A vida nova nasce da graça, não da performance.', 'Constância não compra valor pessoal.', 'Como descansar sem desistir?', 1),
  ('30000000-0000-4000-8000-000000000030', 28, 'Efésios 3', 'Força interior', 'A transformação acontece de dentro para fora.', 'Força real começa no íntimo.', 'Qual área interior precisa ser fortalecida?', 1),
  ('30000000-0000-4000-8000-000000000030', 29, 'Efésios 4', 'Nova prática', 'A nova vida aparece em hábitos concretos.', 'Evolução é vestir uma nova forma de agir.', 'Que prática antiga você vai substituir?', 1),
  ('30000000-0000-4000-8000-000000000030', 30, 'Efésios 5', 'Caminhar em luz', 'Feche o ciclo escolhendo clareza, gratidão e propósito.', 'Você chegou até aqui construindo dia por dia.', 'O que começa depois desses 30 dias?', 1)
on conflict (reading_plan_id, day_number, sort_order) do update set
  reference = excluded.reference,
  title = excluded.title,
  summary = excluded.summary,
  reflection = excluded.reflection,
  question = excluded.question,
  updated_at = now();

insert into public.achievements (
  id,
  challenge_id,
  name,
  slug,
  description,
  icon,
  points_bonus,
  rule_config,
  sort_order
) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000030', 'Primeiro passo', 'primeiro-passo', 'Concluir o primeiro hábito.', 'footprints', 0, '{"type": "first_habit_completed"}'::jsonb, 10),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000030', 'Três dias de constância', 'tres-dias-de-constancia', 'Finalizar três dias consecutivos.', 'flame', 20, '{"type": "streak", "days": 3}'::jsonb, 20),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000030', 'Missão concluída', 'missao-concluida', 'Finalizar o ciclo.', 'trophy', 300, '{"type": "challenge_completed"}'::jsonb, 30)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  points_bonus = excluded.points_bonus,
  rule_config = excluded.rule_config,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.share_templates (
  id,
  challenge_id,
  name,
  config,
  active
) values (
  '50000000-0000-4000-8000-000000000030',
  '10000000-0000-4000-8000-000000000030',
  'Story base Projeto 30',
  '{"size": {"width": 1080, "height": 1920}, "safe_area": 96, "palette": {"background": "#050505", "primary": "#FF6A00", "text": "#F7F4EF"}}'::jsonb,
  true
) on conflict (id) do update set
  name = excluded.name,
  config = excluded.config,
  active = excluded.active,
  updated_at = now();
