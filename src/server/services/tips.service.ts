import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

import { recordAnalyticsEvent } from "./analytics.service";
import { requireAuthUser } from "./auth-session.service";

const TIP_CONTENT_TYPE = "tip_card";

export type TipSummary = Pick<
  Tables<"content_items">,
  | "alt_text"
  | "category"
  | "challenge_id"
  | "display_order"
  | "id"
  | "image_url"
  | "published_at"
  | "slug"
  | "summary"
  | "title"
>;

export type TipDetail = Pick<
  Tables<"content_items">,
  | "alt_text"
  | "category"
  | "challenge_id"
  | "content"
  | "id"
  | "image_url"
  | "published_at"
  | "slug"
  | "summary"
  | "title"
>;

const summaryColumns =
  "id,title,slug,summary,image_url,alt_text,category,challenge_id,display_order,published_at";
const detailColumns =
  "id,title,slug,summary,content,image_url,alt_text,category,challenge_id,published_at";

// A published card only actually shows to members while starts_at (if set)
// has already passed and ends_at (if set) hasn't yet. Each .or() call below
// is AND'd with the rest of the query by postgrest, so both must hold
// independently - re-read at call time (not module load) so a long-lived
// server process never uses a stale "now".
function displayWindowFilters() {
  const nowIso = new Date().toISOString();
  return {
    endsFilter: `ends_at.is.null,ends_at.gte.${nowIso}`,
    startsFilter: `starts_at.is.null,starts_at.lte.${nowIso}`,
  };
}

export async function getPublishedTips(filters: {
  category?: string;
  challengeId?: string;
} = {}): Promise<TipSummary[]> {
  await requireAuthUser("/app/dicas");
  const supabase = await createSupabaseServerClient();
  const { endsFilter, startsFilter } = displayWindowFilters();

  let query = supabase
    .from("content_items")
    .select(summaryColumns)
    .eq("content_type", TIP_CONTENT_TYPE)
    .eq("status", "published")
    .or(startsFilter)
    .or(endsFilter)
    .order("display_order", { ascending: true })
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });

  if (filters.category) {
    query = query.eq("category", filters.category);
  }

  if (filters.challengeId) {
    query = query.eq("challenge_id", filters.challengeId);
  }

  const { data } = await query;
  const tips = data ?? [];

  // One event per card actually returned in this gallery response - the
  // same "record on render" philosophy as challenge_catalog_viewed/
  // challenge_detail_viewed, just once per item instead of once per page,
  // since "cards mais acessados" needs a per-card signal. Best-effort and
  // non-blocking (recordAnalyticsEvent never throws), so a slow/failed
  // event insert never delays the gallery render.
  await Promise.all(
    tips.map((tip) =>
      recordAnalyticsEvent({
        challengeId: tip.challenge_id,
        contentItemId: tip.id,
        eventName: "tip_card_viewed",
        metadata: tip.category ? { category: tip.category } : {},
      }),
    ),
  );

  return tips;
}

export async function getTipBySlug(slug: string): Promise<TipDetail | null> {
  await requireAuthUser("/app/dicas");
  const supabase = await createSupabaseServerClient();
  const { endsFilter, startsFilter } = displayWindowFilters();

  const { data } = await supabase
    .from("content_items")
    .select(detailColumns)
    .eq("content_type", TIP_CONTENT_TYPE)
    .eq("status", "published")
    .or(startsFilter)
    .or(endsFilter)
    .eq("slug", slug)
    .maybeSingle();

  if (data) {
    await recordAnalyticsEvent({
      challengeId: data.challenge_id,
      contentItemId: data.id,
      eventName: "tip_card_opened",
      metadata: data.category ? { category: data.category } : {},
    });
  }

  return data ?? null;
}

export type TipDownload = Pick<
  Tables<"content_items">,
  "id" | "image_storage_path" | "image_url" | "slug" | "title"
>;

const downloadColumns = "id,title,slug,image_url,image_storage_path";

/**
 * Backs the /api/dicas/[id]/download route. Deliberately mirrors
 * getTipBySlug's published+window filter rather than trusting the id alone -
 * a card that's draft, archived, or outside its display window must not be
 * downloadable even by a signed-in member who guesses/remembers its id.
 */
export async function getDownloadableTip(id: string): Promise<TipDownload | null> {
  await requireAuthUser("/app/dicas");
  const supabase = await createSupabaseServerClient();
  const { endsFilter, startsFilter } = displayWindowFilters();

  const { data } = await supabase
    .from("content_items")
    .select(downloadColumns)
    .eq("content_type", TIP_CONTENT_TYPE)
    .eq("status", "published")
    .or(startsFilter)
    .or(endsFilter)
    .eq("id", id)
    .maybeSingle();

  return data ?? null;
}

/**
 * Used by the challenge detail page for its "Dicas para este desafio"
 * section - only rendered when this returns at least one tip.
 */
export async function getTipsForChallenge(challengeId: string): Promise<TipSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { endsFilter, startsFilter } = displayWindowFilters();

  const { data } = await supabase
    .from("content_items")
    .select(summaryColumns)
    .eq("content_type", TIP_CONTENT_TYPE)
    .eq("status", "published")
    .or(startsFilter)
    .or(endsFilter)
    .eq("challenge_id", challengeId)
    .order("display_order", { ascending: true });

  return data ?? [];
}
