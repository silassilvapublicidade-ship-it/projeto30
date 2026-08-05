import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type AdminLibraryContentRow = {
  id: string;
  slug: string;
  title: string;
  pillar: string;
  category: string | null;
  status: string;
  source_type: string;
  requires_enhanced_review: boolean;
  updated_at: string;
  published_at: string | null;
  scheduled_at: string | null;
};

export type AdminListLibraryFilters = {
  status?: string | undefined;
  pillar?: string | undefined;
  search?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export async function adminListLibraryContents(
  filters: AdminListLibraryFilters,
): Promise<{ rows: AdminLibraryContentRow[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_list_library_contents", {
    p_status: filters.status,
    p_pillar: filters.pillar,
    p_search: filters.search,
    p_limit: filters.limit ?? 20,
    p_offset: filters.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  const result = data as { rows: AdminLibraryContentRow[]; total: number };
  return { rows: result?.rows ?? [], total: result?.total ?? 0 };
}

export type AdminLibraryContentFull = {
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
  difficulty: string;
  status: string;
  source_type: string;
  ai_generation_status: string | null;
  requires_enhanced_review: boolean;
  related_challenge_id: string | null;
  related_habit_id: string | null;
  cover_image_url: string | null;
  cover_storage_path: string | null;
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  published_by: string | null;
  published_at: string | null;
  scheduled_at: string | null;
};

export async function adminGetLibraryContent(id: string): Promise<AdminLibraryContentFull | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_get_library_content", { p_id: id });
  if (error) throw new Error(error.message);
  return (data as AdminLibraryContentFull | null) ?? null;
}

export type AdminLibraryContentInput = {
  slug: string;
  title: string;
  pillar: string;
  category?: string | undefined;
  subtitle?: string | undefined;
  summary?: string | undefined;
  introduction?: string | undefined;
  body?: string | undefined;
  practicalApplication?: string | undefined;
  reflectionQuestion?: string | undefined;
  smallAction?: string | undefined;
  finalMessage?: string | undefined;
  bibleReference?: string | undefined;
  bibleExcerpt?: string | undefined;
  tags?: string[] | undefined;
  readingTimeMinutes?: number | undefined;
  difficulty?: string | undefined;
  relatedChallengeId?: string | undefined;
  relatedHabitId?: string | undefined;
  coverImageUrl?: string | undefined;
  coverStoragePath?: string | undefined;
  requiresEnhancedReview?: boolean | undefined;
};

export async function adminCreateLibraryContent(input: AdminLibraryContentInput): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_create_library_content", {
    p_slug: input.slug,
    p_title: input.title,
    p_pillar: input.pillar,
    p_category: input.category,
    p_subtitle: input.subtitle,
    p_summary: input.summary,
    p_introduction: input.introduction,
    p_body: input.body,
    p_practical_application: input.practicalApplication,
    p_reflection_question: input.reflectionQuestion,
    p_small_action: input.smallAction,
    p_final_message: input.finalMessage,
    p_bible_reference: input.bibleReference,
    p_bible_excerpt: input.bibleExcerpt,
    p_tags: input.tags,
    p_reading_time_minutes: input.readingTimeMinutes,
    p_difficulty: input.difficulty,
    p_related_challenge_id: input.relatedChallengeId,
    p_related_habit_id: input.relatedHabitId,
    p_cover_image_url: input.coverImageUrl,
    p_cover_storage_path: input.coverStoragePath,
    p_requires_enhanced_review: input.requiresEnhancedReview,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export type AdminLibraryAiDraftInput = AdminLibraryContentInput & {
  aiGenerationMetadata: Record<string, unknown>;
};

/**
 * Único caminho para gravar um rascunho gerado por IA (Parte 13: nasce
 * sempre draft, nunca published/approved). Reaproveita a mesma RPC de
 * criação manual (admin_create_library_content, estendida na migration
 * 0085) em vez de duplicar a lógica - só fixa source_type/author_type/
 * ai_generation_status e carrega os metadados sanitizados da geração
 * (modelo, tom, tema admin-fornecido - nunca dado pessoal de usuário).
 */
export async function adminCreateLibraryContentAiDraft(input: AdminLibraryAiDraftInput): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_create_library_content", {
    p_slug: input.slug,
    p_title: input.title,
    p_pillar: input.pillar,
    p_category: input.category,
    p_subtitle: input.subtitle,
    p_summary: input.summary,
    p_introduction: input.introduction,
    p_body: input.body,
    p_practical_application: input.practicalApplication,
    p_reflection_question: input.reflectionQuestion,
    p_small_action: input.smallAction,
    p_final_message: input.finalMessage,
    // Trecho biblico gerado por IA nunca e confiavel (Parte 16) - o service
    // de geracao ja descarta esses dois campos antes de chegar aqui, mas a
    // funcao nunca os aceita implicitamente por engano.
    p_bible_reference: undefined,
    p_bible_excerpt: undefined,
    p_tags: input.tags,
    p_reading_time_minutes: input.readingTimeMinutes,
    p_difficulty: input.difficulty,
    p_related_challenge_id: input.relatedChallengeId,
    p_related_habit_id: input.relatedHabitId,
    p_cover_image_url: input.coverImageUrl,
    p_cover_storage_path: input.coverStoragePath,
    p_requires_enhanced_review: input.requiresEnhancedReview,
    p_source_type: "ai_assisted",
    p_author_type: "ai_assisted",
    p_ai_generation_status: "completed",
    p_ai_generation_metadata: input.aiGenerationMetadata as Json,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function adminUpdateLibraryContent(id: string, input: Partial<AdminLibraryContentInput>): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_update_library_content", {
    p_id: id,
    p_title: input.title,
    p_pillar: input.pillar,
    p_category: input.category,
    p_subtitle: input.subtitle,
    p_summary: input.summary,
    p_introduction: input.introduction,
    p_body: input.body,
    p_practical_application: input.practicalApplication,
    p_reflection_question: input.reflectionQuestion,
    p_small_action: input.smallAction,
    p_final_message: input.finalMessage,
    p_bible_reference: input.bibleReference,
    p_bible_excerpt: input.bibleExcerpt,
    p_tags: input.tags,
    p_reading_time_minutes: input.readingTimeMinutes,
    p_difficulty: input.difficulty,
    p_related_challenge_id: input.relatedChallengeId,
    p_related_habit_id: input.relatedHabitId,
    p_cover_image_url: input.coverImageUrl,
    p_cover_storage_path: input.coverStoragePath,
    p_requires_enhanced_review: input.requiresEnhancedReview,
  });
  if (error) throw new Error(error.message);
}

export type LibraryContentStatus = "draft" | "in_review" | "approved" | "scheduled" | "published" | "archived";

export async function adminTransitionLibraryContentStatus(input: {
  id: string;
  status: LibraryContentStatus;
  scheduledAt?: string | undefined;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_transition_library_content_status", {
    p_id: input.id,
    p_status: input.status,
    p_scheduled_at: input.scheduledAt,
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

/**
 * Parte D - popula o seletor "Conteúdo relacionado na Biblioteca" no
 * formulário de Dicas. Só conteúdo published (nunca rascunho/em revisão) -
 * o link "Quero aprender mais" de uma Dica não pode abrir algo que o
 * usuário comum não teria como ver de outra forma.
 */
export async function listPublishedLibraryContentsForPicker(): Promise<Array<{ id: string; title: string }>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("library_contents")
    .select("id, title")
    .eq("status", "published")
    .order("title", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function adminMarkLibraryContentReviewed(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_mark_library_content_reviewed", { p_id: id });
  if (error) throw new Error(error.message);
}
