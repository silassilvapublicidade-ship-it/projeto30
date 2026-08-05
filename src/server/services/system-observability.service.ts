import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDeployInfo } from "@/config/system-version";
import {
  containsForbiddenPattern,
  sanitizeErrorText,
  sanitizeMetadata,
  type SafeMetadata,
  type SystemErrorArea,
  type SystemErrorSeverity,
  type SystemErrorStatus,
} from "@/features/observability/system-error.core";

export type RecordSystemErrorInput = {
  area: SystemErrorArea;
  operation: string;
  severity: SystemErrorSeverity;
  message: string;
  route?: string | null | undefined;
  postgresCode?: string | null | undefined;
  userId?: string | null | undefined;
  metadata?: Record<string, unknown>;
};

/**
 * Helper central server-side (Parte L). Contrato:
 * - sanitiza antes de gravar (defesa em profundidade - a RPC sanitiza de
 *   novo no banco);
 * - nunca lança - uma falha ao registrar o erro nunca pode derrubar o
 *   fluxo que estava sendo observado;
 * - usa o client de service_role porque record_system_error só tem grant
 *   para service_role (Parte P - "nenhuma service_role no cliente": este
 *   módulo é "server-only" e nunca é importado por Client Components).
 */
export async function recordSystemError(input: RecordSystemErrorInput): Promise<{ errorCode: string | null }> {
  try {
    const operation = sanitizeErrorText(input.operation, 120);
    const message = sanitizeErrorText(input.message, 500);

    if (!operation || !message || containsForbiddenPattern(operation) || containsForbiddenPattern(message)) {
      console.error(`[system-error-invalid] area=${input.area} operation=${input.operation}`);
      return { errorCode: null };
    }

    const metadata: SafeMetadata = sanitizeMetadata(input.metadata);
    const admin = createSupabaseAdminClient();
    const appVersion = getDeployInfo().commitShaShort;

    const { data, error } = await admin.rpc("record_system_error", {
      p_area: input.area,
      p_operation: operation,
      p_severity: input.severity,
      p_message_safe: message,
      p_metadata_safe: metadata,
      ...(input.route ? { p_route: sanitizeErrorText(input.route, 200) } : {}),
      ...(input.postgresCode ? { p_postgres_code: input.postgresCode } : {}),
      ...(input.userId ? { p_user_id: input.userId } : {}),
      ...(appVersion ? { p_app_version: appVersion } : {}),
    });

    if (error) {
      console.error(`[system-error-record-failed] area=${input.area} operation=${operation}: ${error.message}`);
      return { errorCode: null };
    }

    return { errorCode: data?.[0]?.error_code ?? null };
  } catch (unexpected) {
    // Nunca deixa o logger derrubar o fluxo real - só regista no console
    // (Parte L: "nunca lançar outro erro se o registro falhar").
    console.error("[system-error-record-failed] unexpected", unexpected);
    return { errorCode: null };
  }
}

export type SystemHealthOverview = {
  status: "saudavel" | "atencao" | "degradado" | "critico";
  errors24h: number;
  errors7d: number;
  usersAffected24h: number;
  openCriticalErrors24h: number;
  openErrors24h: number;
  campaignsFailed24h: number;
  campaignsPartial24h: number;
  deliveriesFailed24h: number;
  deliveriesPending: number;
  deliveriesRetry: number;
  subscriptionsRevoked24h: number;
  subscriptionsActive: number;
  cardsFailed24h: number;
  uploadsFailed24h: number;
  onboardingStuck: number;
  lastCronRun: {
    lastSeenAt: string;
    occurrenceCount: number;
    severity: SystemErrorSeverity;
    metadata: SafeMetadata;
  } | null;
  overdueScheduledCampaigns: number;
  lastAutomationActivityAt: string | null;
  cronHasRecentEvidence: boolean;
};

export async function getSystemHealthOverview(): Promise<SystemHealthOverview> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_get_system_health_overview");

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível carregar a visão geral.");
  }

  return data as SystemHealthOverview;
}

export type SystemErrorEventRow = {
  id: string;
  error_code: string;
  area: SystemErrorArea;
  operation: string;
  severity: SystemErrorSeverity;
  message_safe: string;
  route: string | null;
  postgres_code: string | null;
  user_id: string | null;
  metadata_safe: SafeMetadata;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  status: SystemErrorStatus;
  resolved_at: string | null;
  resolution_note: string | null;
  app_version: string | null;
  total_count: number;
};

export type ListSystemErrorEventsFilters = {
  area?: SystemErrorArea | null | undefined;
  severity?: SystemErrorSeverity | null | undefined;
  status?: SystemErrorStatus | null | undefined;
  operation?: string | null | undefined;
  errorCode?: string | null | undefined;
  periodStart?: string | null | undefined;
  limit?: number;
  offset?: number;
};

export async function listSystemErrorEvents(
  filters: ListSystemErrorEventsFilters = {},
): Promise<{ rows: SystemErrorEventRow[]; totalCount: number }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_list_system_error_events", {
    p_limit: filters.limit ?? 25,
    p_offset: filters.offset ?? 0,
    ...(filters.area ? { p_area: filters.area } : {}),
    ...(filters.severity ? { p_severity: filters.severity } : {}),
    ...(filters.status ? { p_status: filters.status } : {}),
    ...(filters.operation ? { p_operation: filters.operation } : {}),
    ...(filters.errorCode ? { p_error_code: filters.errorCode } : {}),
    ...(filters.periodStart ? { p_period_start: filters.periodStart } : {}),
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as SystemErrorEventRow[];
  return { rows, totalCount: rows[0]?.total_count ?? 0 };
}

export type SystemErrorEventDetail = Omit<SystemErrorEventRow, "total_count"> & {
  resolved_by: string | null;
  resolved_in_version: string | null;
};

export async function getSystemErrorEvent(id: string): Promise<SystemErrorEventDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_get_system_error_event", { p_id: id });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as SystemErrorEventDetail[];
  return rows[0] ?? null;
}

export async function resolveSystemErrorEvent(input: {
  id: string;
  status: SystemErrorStatus;
  resolutionNote?: string | null | undefined;
  resolvedInVersion?: string | null | undefined;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_resolve_system_error_event", {
    p_id: input.id,
    p_status: input.status,
    ...(input.resolutionNote ? { p_resolution_note: input.resolutionNote } : {}),
    ...(input.resolvedInVersion ? { p_resolved_in_version: input.resolvedInVersion } : {}),
  });

  if (error) {
    if (error.code === "42501") {
      return { ok: false, message: "Apenas super administradores podem alterar o status de uma ocorrência." };
    }
    return { ok: false, message: "Não foi possível atualizar a ocorrência agora." };
  }

  return { ok: true };
}

export type SystemErrorPurgePreview = {
  eligibleCount: number;
  oldestResolvedAt: string | null;
  newestResolvedAt: string | null;
  severityBreakdown: Record<string, number>;
  areaBreakdown: Record<string, number>;
  cutoffDays: number;
};

const RETENTION_DAYS = 60;

/**
 * Somente leitura - qualquer admin pode ver (Parte B.7: "admin comum pode
 * visualizar o resumo"). Nunca inclui message_safe/metadata (Parte B: "nunca
 * mensagem sensível") - só contagens e datas.
 */
export async function previewSystemErrorPurge(): Promise<SystemErrorPurgePreview> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_preview_system_error_purge", {
    p_older_than_days: RETENTION_DAYS,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = data as {
    eligibleCount: number;
    oldestResolvedAt: string | null;
    newestResolvedAt: string | null;
    severityBreakdown: Record<string, number>;
    areaBreakdown: Record<string, number>;
    cutoffDays: number;
  };

  return {
    eligibleCount: result?.eligibleCount ?? 0,
    oldestResolvedAt: result?.oldestResolvedAt ?? null,
    newestResolvedAt: result?.newestResolvedAt ?? null,
    severityBreakdown: result?.severityBreakdown ?? {},
    areaBreakdown: result?.areaBreakdown ?? {},
    cutoffDays: result?.cutoffDays ?? RETENTION_DAYS,
  };
}

export async function purgeOldSystemErrorEvents(): Promise<
  { ok: true; deletedCount: number } | { ok: false; message: string }
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_purge_old_system_error_events", {
    p_older_than_days: RETENTION_DAYS,
  });

  if (error) {
    if (error.code === "42501") {
      return { ok: false, message: "Apenas super administradores podem executar a limpeza." };
    }
    return { ok: false, message: "Não foi possível executar a limpeza agora." };
  }

  return { ok: true, deletedCount: data ?? 0 };
}
