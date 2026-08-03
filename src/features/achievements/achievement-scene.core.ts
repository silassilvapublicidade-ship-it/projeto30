/**
 * Which decorative background motif a card should use, derived from the
 * achievement's slug. Pure mapping only - the actual vector shapes for each
 * motif are drawn in achievement-share-card.render.tsx (JSX/Satori
 * concerns don't belong in a .core module). Kept as a string union (not
 * JSX) so this stays trivially testable and reusable if the motif is ever
 * needed outside rendering (e.g. an admin picker).
 */
export const SCENE_IDS = [
  "ascending-lines",
  "sunrise-glow",
  "ember-rise",
  "sequence-marks",
  "open-book",
  "speed-lines",
  "soft-light",
  "progress-marker",
  "loop-arc",
  "grid-bloom",
] as const;

export type SceneId = (typeof SCENE_IDS)[number];

const SCENE_BY_SLUG: Record<string, SceneId> = {
  "metade-do-caminho": "progress-marker",
  "missao-concluida": "grid-bloom",
  "primeira-semana": "sequence-marks",
  "primeiro-dia": "sunrise-glow",
  "primeiro-habito": "ascending-lines",
  "retorno-forte": "loop-arc",
  "sete-atividades-fisicas": "speed-lines",
  "sete-leituras": "open-book",
  "sete-reflexoes": "soft-light",
  "tres-dias-seguidos": "ember-rise",
};

const FALLBACK_SCENE: SceneId = "soft-light";

/**
 * Falls back to the calmest, most generic motif (soft-light) for any slug
 * outside the 10 canonical achievements - e.g. a new one an admin creates
 * later - so the card is always a valid, minimal design instead of failing
 * to render.
 */
export function getSceneForAchievement(slug: string | null | undefined): SceneId {
  if (!slug) {
    return FALLBACK_SCENE;
  }

  return SCENE_BY_SLUG[slug] ?? FALLBACK_SCENE;
}
