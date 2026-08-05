import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LibraryContentSummary = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  pillar: string;
  category: string | null;
  reading_time_minutes: number | null;
  cover_image_url: string | null;
  published_at: string | null;
  tags: string[];
  progress_status: string;
  progress_percent: number;
};

export type ListLibraryContentsFilters = {
  pillar?: string | undefined;
  category?: string | undefined;
  challengeId?: string | undefined;
  search?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export async function listLibraryContents(
  filters: ListLibraryContentsFilters,
): Promise<{ rows: LibraryContentSummary[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("member_list_library_contents", {
    p_pillar: filters.pillar,
    p_category: filters.category,
    p_challenge_id: filters.challengeId,
    p_search: filters.search,
    p_limit: filters.limit ?? 20,
    p_offset: filters.offset ?? 0,
  });

  if (error) throw new Error(error.message);

  const result = data as { rows: LibraryContentSummary[]; total: number };
  return { rows: result?.rows ?? [], total: result?.total ?? 0 };
}

export type LibraryContentDetail = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  introduction: string | null;
  body: string | null;
  practical_application: string | null;
  reflection_question: string | null;
  small_action: string | null;
  final_message: string | null;
  bible_reference: string | null;
  bible_excerpt: string | null;
  tags: string[];
  pillar: string;
  category: string | null;
  reading_time_minutes: number | null;
  cover_image_url: string | null;
  published_at: string | null;
  progress: { status: string; progress_percent: number; started_at: string | null; completed_at: string | null } | null;
  related: Array<{
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    pillar: string;
    reading_time_minutes: number | null;
    cover_image_url: string | null;
  }>;
};

export async function getLibraryContentBySlug(slug: string): Promise<LibraryContentDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("member_get_library_content", { p_slug: slug });
  if (error) throw new Error(error.message);
  return (data as LibraryContentDetail | null) ?? null;
}

export async function upsertLibraryProgress(input: {
  contentId: string;
  status: "not_started" | "reading" | "completed";
  progressPercent?: number;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("member_upsert_library_progress", {
    p_content_id: input.contentId,
    p_status: input.status,
    p_progress_percent: input.progressPercent,
  });
  if (error) throw new Error(error.message);
}

export type LibraryRecommendation = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  pillar: string;
  reading_time_minutes: number | null;
  cover_image_url: string | null;
} | null;

export async function getLibraryRecommendation(): Promise<LibraryRecommendation> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("member_get_library_recommendation");
  if (error) throw new Error(error.message);
  return (data as LibraryRecommendation) ?? null;
}
