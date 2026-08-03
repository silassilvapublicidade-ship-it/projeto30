import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/server/services/auth-session.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  deliveryId: z.uuid().nullable().optional(),
  notificationId: z.uuid().nullable().optional(),
});

/**
 * Called by the service worker's notificationclick handler (public/sw.js) -
 * a plain fetch with credentials, not a Server Action, since a service
 * worker can't invoke Next.js's Server Action wire format. Marks both the
 * inbox row (notifications) and, when the push came from a campaign, the
 * per-user delivery row (notification_deliveries) - same ownership checks
 * as the RPCs used everywhere else (mark_notification_clicked,
 * mark_delivery_clicked), just reachable from a plain POST.
 */
export async function POST(request: Request) {
  await requireAuthUser("/app/hoje");

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  if (parsed.data.notificationId) {
    await supabase.rpc("mark_notification_clicked", { p_notification_id: parsed.data.notificationId });
  }

  if (parsed.data.deliveryId) {
    await supabase.rpc("mark_delivery_clicked", { p_delivery_id: parsed.data.deliveryId });
  }

  return NextResponse.json({ ok: true });
}
