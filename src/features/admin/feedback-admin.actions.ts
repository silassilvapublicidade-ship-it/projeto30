"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FEEDBACK_DELETE_CONFIRMATION_PHRASE } from "@/features/feedback/feedback.core";
import { requireAdminUser } from "@/server/services/admin-session.service";
import { adminDeleteFeedback, adminUpdateFeedback } from "@/server/services/feedback.service";
import { recordSystemError } from "@/server/services/system-observability.service";

function detailPath(id: string) {
  return `/admin/feedback/${id}`;
}

export async function updateFeedbackAction(formData: FormData) {
  await requireAdminUser();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    redirect("/admin/feedback");
  }

  const status = String(formData.get("status") ?? "") || undefined;
  const priority = String(formData.get("priority") ?? "") || undefined;
  const adminResponse = String(formData.get("adminResponse") ?? "").trim() || undefined;
  const internalNotes = String(formData.get("internalNotes") ?? "").trim() || undefined;
  const resolvedInVersion = String(formData.get("resolvedInVersion") ?? "").trim() || undefined;
  const diagnosticCode = String(formData.get("diagnosticCode") ?? "").trim() || undefined;

  try {
    await adminUpdateFeedback({ id, status, priority, adminResponse, internalNotes, resolvedInVersion, diagnosticCode });

    if (adminResponse) {
      const supabase = await createSupabaseServerClient();
      await supabase.rpc("record_analytics_event", { p_event_name: "feedback_response_sent", p_source: "server" });
    }
    if (status) {
      const supabase = await createSupabaseServerClient();
      await supabase.rpc("record_analytics_event", {
        p_event_name: "feedback_status_changed",
        p_metadata: { status },
        p_source: "server",
      });
    }
  } catch (error) {
    await recordSystemError({
      area: "feedback",
      operation: "feedback_admin_update",
      severity: "warning",
      message: error instanceof Error ? error.message : "Falha ao atualizar feedback.",
    });
    redirect(`${detailPath(id)}?feedback=error`);
  }

  redirect(`${detailPath(id)}?feedback=success`);
}

export async function deleteFeedbackAction(formData: FormData) {
  const admin = await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  const confirmationPhrase = String(formData.get("confirmationPhrase") ?? "");

  if (admin.role !== "super_admin") {
    redirect(`${detailPath(id)}?feedback=forbidden`);
  }

  if (confirmationPhrase !== FEEDBACK_DELETE_CONFIRMATION_PHRASE) {
    redirect(`${detailPath(id)}?feedback=invalid`);
  }

  try {
    await adminDeleteFeedback(id);
  } catch (error) {
    await recordSystemError({
      area: "feedback",
      operation: "feedback_admin_delete",
      severity: "warning",
      message: error instanceof Error ? error.message : "Falha ao excluir feedback.",
    });
    redirect(`${detailPath(id)}?feedback=error`);
  }

  redirect("/admin/feedback?feedback=deleted");
}
