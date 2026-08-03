import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type ActivePushSubscription = {
  auth: string;
  endpoint: string;
  id: string;
  p256dh: string;
  userId: string;
};

/**
 * Only ever called with the service-role client (the backend sender
 * processes many users' subscriptions in one pass, never a single user's
 * own session) - see src/app/api/cron/notifications/process/route.ts and
 * the immediate-send path. p256dh/auth are only ever read here, never
 * forwarded to any admin-facing UI query (see admin-notifications.service.ts,
 * which deliberately never selects these two columns).
 */
export async function getActivePushSubscriptionsForUsers(
  admin: SupabaseClient<Database>,
  userIds: string[],
): Promise<ActivePushSubscription[]> {
  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds)
    .is("revoked_at", null);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    auth: row.auth,
    endpoint: row.endpoint,
    id: row.id,
    p256dh: row.p256dh,
    userId: row.user_id,
  }));
}

export async function hasActivePushSubscription(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { count } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("revoked_at", null);

  return (count ?? 0) > 0;
}

export async function recordPushSuccess(admin: SupabaseClient<Database>, subscriptionId: string) {
  await admin
    .from("push_subscriptions")
    .update({ failure_count: 0, last_success_at: new Date().toISOString() })
    .eq("id", subscriptionId);
}

export async function recordPushFailure(
  admin: SupabaseClient<Database>,
  subscriptionId: string,
  options: { permanent: boolean },
) {
  const nowIso = new Date().toISOString();

  if (options.permanent) {
    // 404/410 from the push service - the subscription is gone for good,
    // never retry it. Soft-revoke, matching the same shape logout uses.
    await admin
      .from("push_subscriptions")
      .update({ last_failure_at: nowIso, revoked_at: nowIso })
      .eq("id", subscriptionId);
    return;
  }

  const { data } = await admin
    .from("push_subscriptions")
    .select("failure_count")
    .eq("id", subscriptionId)
    .maybeSingle();

  await admin
    .from("push_subscriptions")
    .update({
      failure_count: (data?.failure_count ?? 0) + 1,
      last_failure_at: nowIso,
    })
    .eq("id", subscriptionId);
}
