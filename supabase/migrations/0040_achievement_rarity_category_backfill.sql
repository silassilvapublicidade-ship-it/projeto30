-- Backfill for the achievement share-card redesign. achievements.category
-- and achievements.rarity have existed since 0002/0012 but were never
-- populated for the 10 real canonical achievements (both null on every
-- row) - the new card renderer reads both to pick a rarity tier (visual
-- treatment) and a category badge label. Values chosen per the redesign
-- round's plan; both fields stay admin-editable free text afterward
-- (achievement-update-form already has inputs for them) - this is just a
-- sane starting point, not a locked taxonomy.
update public.achievements
set category = 'Início', rarity = 'bronze'
where slug in ('primeiro-habito', 'primeiro-dia');

update public.achievements
set category = 'Constância', rarity = 'prata'
where slug = 'tres-dias-seguidos';

update public.achievements
set category = 'Leitura', rarity = 'prata'
where slug = 'sete-leituras';

update public.achievements
set category = 'Movimento', rarity = 'prata'
where slug = 'sete-atividades-fisicas';

update public.achievements
set category = 'Autocuidado', rarity = 'prata'
where slug = 'sete-reflexoes';

update public.achievements
set category = 'Constância', rarity = 'ouro'
where slug = 'primeira-semana';

update public.achievements
set category = 'Jornada', rarity = 'ouro'
where slug = 'metade-do-caminho';

update public.achievements
set category = 'Constância', rarity = 'ouro'
where slug = 'retorno-forte';

update public.achievements
set category = 'Jornada', rarity = 'lendaria'
where slug = 'missao-concluida';

-- share_templates.config used to carry admin-free-text color/gradient
-- (accentColor, background.from/to, textColor) plus 2 display toggles. The
-- redesign moves every color decision into code (achievement-rarity.core.ts
-- / achievement-scene.core.ts) per the round's explicit "never random
-- colors" requirement - config now only carries structural dimensions, the
-- one thing genuinely template-specific (story vs feed size).
update public.share_templates
set config = jsonb_build_object(
  'format', config ->> 'format',
  'height', (config ->> 'height')::int,
  'width', (config ->> 'width')::int
)
where slug in ('achievement_story', 'achievement_feed');
