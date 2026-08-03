import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type DailyMotivationMessageRow = Tables<"daily_motivation_messages">;

export async function listDailyMotivationMessages(): Promise<DailyMotivationMessageRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("daily_motivation_messages")
    .select("*")
    .order("category", { ascending: true })
    .order("created_at", { ascending: false });

  return data ?? [];
}
