import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type JournalEntryRow = {
  daily_log_id: string;
  log_date: string;
  daily_log_status: string;
  finalized_at: string | null;
  points_earned: number;
  challenge_id: string;
  challenge_name: string;
  day_number: number | null;
  challenge_day_message: string | null;
  content: string | null;
  gratitude: string | null;
  difficulty: string | null;
  victory: string | null;
  tomorrow_focus: string | null;
  mood: string | null;
  updated_at: string;
};

export type JournalChallengeOption = { challenge_id: string; challenge_name: string };

export type ListJournalEntriesFilters = {
  challengeId?: string | undefined;
  periodDays?: number | undefined;
  onlyWithContent?: boolean | undefined;
  search?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export async function listJournalEntries(
  filters: ListJournalEntriesFilters,
): Promise<{ rows: JournalEntryRow[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("member_list_journal_entries", {
    p_challenge_id: filters.challengeId,
    p_period_days: filters.periodDays,
    p_only_with_content: filters.onlyWithContent ?? false,
    p_search: filters.search,
    p_limit: filters.limit ?? 20,
    p_offset: filters.offset ?? 0,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = data as { rows: JournalEntryRow[]; total: number };
  return { rows: result?.rows ?? [], total: result?.total ?? 0 };
}

export async function listJournalChallenges(): Promise<JournalChallengeOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("member_list_journal_challenges");

  if (error) {
    throw new Error(error.message);
  }

  return (data as JournalChallengeOption[] | null) ?? [];
}

/** Uma entrada "tem conteúdo" se qualquer um dos 5 campos livres não está vazio - mesma regra usada em admin_participant_detail (0081), nunca reimplementada de forma divergente. */
export function journalEntryHasContent(entry: Pick<JournalEntryRow, "content" | "gratitude" | "difficulty" | "victory" | "tomorrow_focus">): boolean {
  return [entry.content, entry.gratitude, entry.difficulty, entry.victory, entry.tomorrow_focus].some(
    (value) => Boolean(value && value.trim().length > 0),
  );
}
