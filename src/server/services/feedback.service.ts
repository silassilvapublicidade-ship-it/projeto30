import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MyFeedbackRow = {
  id: string;
  protocol_code: string;
  feedback_type: string;
  category: string | null;
  title: string;
  status: string;
  sentiment: string | null;
  admin_response: string | null;
  resolved_in_version: string | null;
  created_at: string;
  responded_at: string | null;
  resolved_at: string | null;
};

export async function listMyFeedback(): Promise<MyFeedbackRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("user_list_my_feedback", { p_limit: 30, p_offset: 0 });
  if (error) throw new Error(error.message);
  return (data ?? []) as MyFeedbackRow[];
}

export async function withdrawFeedback(id: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("user_withdraw_feedback", { p_id: id });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export type CreateFeedbackInput = {
  id: string;
  feedbackType: string;
  category: string | null;
  title: string;
  description: string;
  sentiment: string | null;
  allowContact: boolean;
  includeTechnical: boolean;
  route: string | null;
  diagnosticCode: string | null;
  appVersion: string | null;
  browser: string | null;
  operatingSystem: string | null;
  isPwa: boolean;
  viewport: string | null;
  attachmentStoragePath: string | null;
};

export async function createFeedback(input: CreateFeedbackInput): Promise<{ id: string; protocolCode: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_user_feedback", {
    p_id: input.id,
    p_feedback_type: input.feedbackType,
    p_category: input.category ?? undefined,
    p_title: input.title,
    p_description: input.description,
    p_sentiment: input.sentiment ?? undefined,
    p_allow_contact: input.allowContact,
    p_include_technical: input.includeTechnical,
    p_route: input.route ?? undefined,
    p_diagnostic_code: input.diagnosticCode ?? undefined,
    p_app_version: input.appVersion ?? undefined,
    p_browser: input.browser ?? undefined,
    p_operating_system: input.operatingSystem ?? undefined,
    p_is_pwa: input.isPwa,
    p_viewport: input.viewport ?? undefined,
    p_attachment_storage_path: input.attachmentStoragePath ?? undefined,
  });
  if (error) throw new Error(error.message);
  const result = data as { id: string; protocolCode: string };
  return result;
}

export type AdminFeedbackListFilters = {
  search?: string | undefined;
  feedbackType?: string | undefined;
  category?: string | undefined;
  status?: string | undefined;
  priority?: string | undefined;
  hasAttachment?: boolean | undefined;
  hasDiagnostic?: boolean | undefined;
  periodStart?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export type AdminFeedbackListRow = {
  id: string;
  protocol_code: string;
  feedback_type: string;
  category: string | null;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  diagnostic_code: string | null;
  app_version: string | null;
  has_attachment: boolean;
  user_display_name: string | null;
};

export async function adminListFeedback(
  filters: AdminFeedbackListFilters,
): Promise<{ rows: AdminFeedbackListRow[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_list_user_feedback", {
    p_search: filters.search || undefined,
    p_feedback_type: filters.feedbackType || undefined,
    p_category: filters.category || undefined,
    p_status: filters.status || undefined,
    p_priority: filters.priority || undefined,
    p_has_attachment: filters.hasAttachment,
    p_has_diagnostic: filters.hasDiagnostic,
    p_period_start: filters.periodStart || undefined,
    p_limit: filters.limit ?? 20,
    p_offset: filters.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  const result = data as { rows: AdminFeedbackListRow[]; total: number };
  return { rows: result?.rows ?? [], total: result?.total ?? 0 };
}

export type AdminFeedbackDetail = {
  id: string;
  protocolCode: string;
  userId: string;
  userDisplayName: string | null;
  feedbackType: string;
  category: string | null;
  title: string;
  description: string;
  sentiment: string | null;
  status: string;
  priority: string;
  route: string | null;
  diagnosticCode: string | null;
  appVersion: string | null;
  browser: string | null;
  operatingSystem: string | null;
  isPwa: boolean;
  viewport: string | null;
  attachmentStoragePath: string | null;
  allowContact: boolean;
  adminResponse: string | null;
  internalNotes: string | null;
  resolvedInVersion: string | null;
  respondedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  linkedErrorEventCount: number;
};

export async function adminGetFeedbackDetail(id: string): Promise<AdminFeedbackDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_get_user_feedback_detail", { p_id: id });
  if (error) throw new Error(error.message);
  return (data as AdminFeedbackDetail | null) ?? null;
}

export type AdminUpdateFeedbackInput = {
  id: string;
  status?: string | undefined;
  priority?: string | undefined;
  adminResponse?: string | undefined;
  internalNotes?: string | undefined;
  resolvedInVersion?: string | undefined;
  diagnosticCode?: string | undefined;
};

export async function adminUpdateFeedback(input: AdminUpdateFeedbackInput): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_update_user_feedback", {
    p_id: input.id,
    p_status: input.status || undefined,
    p_priority: input.priority || undefined,
    p_admin_response: input.adminResponse || undefined,
    p_internal_notes: input.internalNotes || undefined,
    p_resolved_in_version: input.resolvedInVersion || undefined,
    p_diagnostic_code: input.diagnosticCode || undefined,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/**
 * super_admin only (a RPC já reforça isso). Remove a linha e, se havia
 * anexo, o objeto correspondente no bucket privado - nunca deixa um
 * arquivo órfão para trás quando o feedback é excluído permanentemente.
 */
export async function adminDeleteFeedback(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: attachmentPath, error } = await supabase.rpc("admin_delete_user_feedback", { p_id: id });
  if (error) throw new Error(error.message);

  if (attachmentPath) {
    const admin = createSupabaseAdminClient();
    await admin.storage.from("user-feedback-attachments").remove([attachmentPath]);
  }
}

export async function countFeedbackForDiagnostic(errorCode: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_count_feedback_for_diagnostic", { p_error_code: errorCode });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

export type FeedbackCockpitSummary = {
  newCount: number;
  urgentCount: number;
  reviewingCount: number;
  recentNegativeRatings: number;
};

export async function getFeedbackCockpitSummary(): Promise<FeedbackCockpitSummary> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_feedback_cockpit_summary");
  if (error) throw new Error(error.message);
  const result = data as FeedbackCockpitSummary | null;
  return {
    newCount: result?.newCount ?? 0,
    urgentCount: result?.urgentCount ?? 0,
    reviewingCount: result?.reviewingCount ?? 0,
    recentNegativeRatings: result?.recentNegativeRatings ?? 0,
  };
}
