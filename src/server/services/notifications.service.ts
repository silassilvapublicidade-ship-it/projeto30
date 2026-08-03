import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveNotificationDestinationPath } from "@/features/notifications/notification-destination.core";
import type { Tables } from "@/types/database";

import { requireAuthUser } from "./auth-session.service";

export type MemberNotification = {
  actionLabel: string | null;
  body: string;
  createdAt: string;
  destinationPath: string | null;
  id: string;
  imageUrl: string | null;
  readAt: string | null;
  status: Tables<"notifications">["status"];
  title: string;
  type: string;
};

const PAGE_SIZE = 30;

function mapRow(row: Tables<"notifications">): MemberNotification {
  return {
    actionLabel: row.action_label,
    body: row.body,
    createdAt: row.created_at,
    destinationPath: resolveNotificationDestinationPath(row.destination_type, row.destination_reference_id),
    id: row.id,
    imageUrl: row.image_url,
    readAt: row.read_at,
    status: row.status,
    title: row.title,
    type: row.type,
  };
}

/**
 * First page for the inbox page itself (server component) - the header
 * badge uses the cheaper getUnreadNotificationCount below instead of this,
 * to avoid pulling full rows just to render a number.
 */
export async function listMemberNotifications(options: { cursor?: string | null } = {}): Promise<{
  hasMore: boolean;
  notifications: MemberNotification[];
}> {
  const user = await requireAuthUser("/app/notificacoes");
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (options.cursor) {
    query = query.lt("created_at", options.cursor);
  }

  const { data, error } = await query;

  if (error || !data) {
    return { hasMore: false, notifications: [] };
  }

  const hasMore = data.length > PAGE_SIZE;
  const page = hasMore ? data.slice(0, PAGE_SIZE) : data;

  return { hasMore, notifications: page.map(mapRow) };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const user = await requireAuthUser("/app/hoje");
  const supabase = await createSupabaseServerClient();

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("status", "read");

  return count ?? 0;
}
