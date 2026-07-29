import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

import { requireAuthUser } from "./auth-session.service";

const TIP_TYPE = "tip";

export type TipSummary = Pick<
  Tables<"content_items">,
  | "category"
  | "challenge_id"
  | "display_order"
  | "excerpt"
  | "id"
  | "media_url"
  | "published_at"
  | "slug"
  | "title"
>;

export type TipDetail = Pick<
  Tables<"content_items">,
  | "body"
  | "category"
  | "challenge_id"
  | "excerpt"
  | "id"
  | "media_url"
  | "published_at"
  | "slug"
  | "title"
>;

const summaryColumns =
  "id,title,slug,excerpt,media_url,category,challenge_id,display_order,published_at";
const detailColumns = "id,title,slug,excerpt,body,media_url,category,challenge_id,published_at";

export async function getPublishedTips(filters: {
  category?: string;
  challengeId?: string;
} = {}): Promise<TipSummary[]> {
  await requireAuthUser("/app/dicas");
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("content_items")
    .select(summaryColumns)
    .eq("type", TIP_TYPE)
    .eq("status", "published")
    .order("display_order", { ascending: true })
    .order("published_at", { ascending: false });

  if (filters.category) {
    query = query.eq("category", filters.category);
  }

  if (filters.challengeId) {
    query = query.eq("challenge_id", filters.challengeId);
  }

  const { data } = await query;
  return data ?? [];
}

export async function getTipCategories(): Promise<string[]> {
  await requireAuthUser("/app/dicas");
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("content_items")
    .select("category")
    .eq("type", TIP_TYPE)
    .eq("status", "published")
    .not("category", "is", null);

  const categories = new Set((data ?? []).map((row) => row.category).filter((value) => Boolean(value)));
  return Array.from(categories) as string[];
}

export async function getTipBySlug(slug: string): Promise<TipDetail | null> {
  await requireAuthUser("/app/dicas");
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("content_items")
    .select(detailColumns)
    .eq("type", TIP_TYPE)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();

  return data ?? null;
}

/**
 * Used by the challenge detail page for its "Dicas para este desafio"
 * section - only rendered when this returns at least one tip.
 */
export async function getTipsForChallenge(challengeId: string): Promise<TipSummary[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("content_items")
    .select(summaryColumns)
    .eq("type", TIP_TYPE)
    .eq("status", "published")
    .eq("challenge_id", challengeId)
    .order("display_order", { ascending: true });

  return data ?? [];
}
