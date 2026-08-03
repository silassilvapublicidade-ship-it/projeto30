import { NextResponse } from "next/server";

import { achievementPreviewSchema } from "@/features/admin/admin-achievements.schemas";
import { buildAchievementCardContent } from "@/features/achievements/achievement-art.core";
import { shareCardTemplateConfigSchema, TEMPLATE_SLUGS_BY_FORMAT } from "@/features/achievements/achievement-art.schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/server/services/admin-session.service";
import { renderAchievementShareCardImage } from "@/server/rendering/achievement-share-card.render";

export const runtime = "nodejs";

/**
 * Renders a live preview of the share-card art for an achievement that is
 * still being drafted in the admin form - reuses the exact same pure
 * content-builder + renderer as the real member-facing share card
 * (achievement-art.service.ts), but with synthetic data (a placeholder
 * "desbloqueou" attribution and today's date) instead of a real
 * user_achievements row. Deliberately never touches the database beyond the
 * read-only share_templates lookup, never uploads to storage, and never
 * needs the service-role client - this is a pure render-and-return, nothing
 * is persisted.
 */
export async function POST(request: Request) {
  await requireAdminUser();

  const body = await request.json().catch(() => null);
  const parsed = achievementPreviewSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados de prévia inválidos." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: templateRow, error: templateError } = await supabase
    .from("share_templates")
    .select("config")
    .eq("slug", TEMPLATE_SLUGS_BY_FORMAT[parsed.data.format])
    .eq("active", true)
    .maybeSingle();

  if (templateError || !templateRow) {
    return NextResponse.json({ error: "Modelo de arte indisponível no momento." }, { status: 500 });
  }

  const parsedConfig = shareCardTemplateConfigSchema.safeParse(templateRow.config);

  if (!parsedConfig.success) {
    return NextResponse.json({ error: "Configuração do modelo de arte é inválida." }, { status: 500 });
  }

  const content = buildAchievementCardContent(
    {
      category: parsed.data.category ?? null,
      challengeName: parsed.data.challengeName ?? null,
      description: parsed.data.description ?? null,
      icon: parsed.data.icon ?? null,
      name: parsed.data.name,
      rarity: parsed.data.rarity ?? null,
      shareMessage: parsed.data.shareMessage ?? null,
      shareTitle: parsed.data.shareTitle ?? null,
      // No real achievement row exists yet for a draft being previewed - no
      // slug to pick a scene by (falls back to the generic soft-light
      // motif) and no real unlock/position data to show a number or percent.
      unlockedAt: new Date().toISOString(),
    },
    "Você",
  );

  return renderAchievementShareCardImage(content, parsedConfig.data);
}
