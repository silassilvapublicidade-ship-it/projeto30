import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";
import {
  processDueScheduledCampaigns,
  retryDueNotificationDeliveries,
} from "@/server/services/notification-dispatch.service";
import { runAllScheduledAutomations } from "@/server/services/notification-automations.service";
import { recordSystemError } from "@/server/services/system-observability.service";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The single source of truth for scheduled notification processing - the
 * only place notification_campaigns.status='scheduled' rows and pending
 * push retries ever get processed once no browser is open. Invoked by
 * Vercel Cron (which sends this exact bearer secret automatically once
 * configured in vercel.json) and, since this project is on the Vercel
 * Hobby plan (cron limited to once/day - confirmed via the VERCEL_OIDC_TOKEN
 * payload during this build), ALSO by any external authenticated pinger
 * that wants finer-grained scheduling than Hobby cron allows. Both callers
 * hit the exact same code path - there is no separate "manual" trigger.
 *
 * Every run - success or failure - records exactly one system_error_event
 * (area=cron, fixed operation name), so the Observabilidade panel always
 * has a "last cron run" to show even when nothing ever fails.
 */
export async function POST(request: Request) {
  const env = getServerEnv();

  if (!env.CRON_CONTROL_SECRET) {
    return NextResponse.json({ error: "CRON_CONTROL_SECRET não configurado." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${env.CRON_CONTROL_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const campaignsProcessed = await processDueScheduledCampaigns();
    const deliveriesRetried = await retryDueNotificationDeliveries();
    await runAllScheduledAutomations();
    const durationMs = Date.now() - startedAt;

    await recordSystemError({
      area: "cron",
      operation: "notifications_process_run",
      severity: "info",
      message: `Cron executado com sucesso: ${campaignsProcessed} campanhas, ${deliveriesRetried} deliveries em retry, 6 automações verificadas (${durationMs}ms).`,
      metadata: { campaignsProcessed, deliveriesRetried, automationTypesChecked: 6, durationMs },
    });

    return NextResponse.json({ ok: true, processedAt: new Date().toISOString() });
  } catch (unexpectedError) {
    const durationMs = Date.now() - startedAt;

    await recordSystemError({
      area: "cron",
      operation: "notifications_process_run",
      severity: "critical",
      message: "Cron de notificações falhou antes de concluir o processamento.",
      metadata: {
        durationMs,
        errorMessage: unexpectedError instanceof Error ? unexpectedError.message : "erro desconhecido",
      },
    });

    return NextResponse.json({ error: "Falha ao processar o cron de notificações." }, { status: 500 });
  }
}

// Vercel Cron only ever sends GET requests to the configured path - this
// just forwards to the same authenticated handler above rather than
// duplicating the logic.
export async function GET(request: Request) {
  return POST(request);
}
