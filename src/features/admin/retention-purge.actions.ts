"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RETENTION_PURGE_CONFIRMATION_PHRASE } from "@/features/observability/system-error.core";
import { requireAdminUser } from "@/server/services/admin-session.service";
import { purgeOldSystemErrorEvents } from "@/server/services/system-observability.service";

/**
 * Segue o mesmo padrão de notification-campaigns.actions.ts (FormData +
 * redirect com ?feedback=... lido na próxima renderização) para poder ser
 * usada diretamente como formAction do ConfirmDialog compartilhado.
 */
export async function executeSystemErrorPurgeAction(formData: FormData) {
  const admin = await requireAdminUser();
  const target = "/admin/observabilidade";
  const confirmationPhrase = formData.get("confirmationPhrase");

  if (admin.role !== "super_admin") {
    redirect(`${target}?purgeFeedback=forbidden`);
  }

  if (confirmationPhrase !== RETENTION_PURGE_CONFIRMATION_PHRASE) {
    redirect(`${target}?purgeFeedback=invalid`);
  }

  const result = await purgeOldSystemErrorEvents();

  if (!result.ok) {
    redirect(`${target}?purgeFeedback=error`);
  }

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("record_analytics_event", {
    p_event_name: "error_retention_purge_completed",
    p_metadata: { deletedCount: result.deletedCount },
    p_source: "server",
  });

  redirect(`${target}?purgeFeedback=success&purgeDeleted=${result.deletedCount}`);
}
