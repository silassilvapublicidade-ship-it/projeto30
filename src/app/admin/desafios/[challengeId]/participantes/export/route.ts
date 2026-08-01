import { notFound } from "next/navigation";

import {
  challengeIdSchema,
  parseParticipantListParams,
} from "@/features/admin/admin-analytics.schemas";
import { csvRow } from "@/features/admin/admin-csv.core";
import { describeActivity, describeEnrollmentStatus } from "@/features/admin/admin-metrics.core";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/server/services/admin-session.service";
import { listAdminParticipants } from "@/server/services/admin-analytics.service";

export const runtime = "nodejs";

/**
 * Streams the filtered participant list of one challenge as CSV, batching
 * through admin_list_participants page by page (same RPC/page size as the UI
 * list, no separate export query) instead of buffering the whole dataset in
 * memory before responding. Personal data (name, e-mail) is left out by
 * default - "p=1" only takes effect for a super_admin AND when "confirm=1" is
 * also present, so a bare copy-pasted/guessed URL from an "admin" role, or a
 * super_admin URL without going through the UI's confirmation step, never
 * leaks it.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ challengeId: string }> },
) {
  const admin = await requireAdminUser();
  const { challengeId } = await params;
  const parsedId = challengeIdSchema.safeParse(challengeId);

  if (!parsedId.success) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id,slug")
    .eq("id", parsedId.data)
    .is("deleted_at", null)
    .maybeSingle();

  if (!challenge) {
    notFound();
  }

  const url = new URL(request.url);
  const searchParams: Record<string, string | undefined> = {};
  url.searchParams.forEach((value, key) => {
    searchParams[key] = value;
  });
  const filters = parseParticipantListParams(searchParams);

  const includePersonalData =
    admin.role === "super_admin" &&
    searchParams.p === "1" &&
    searchParams.confirm === "1";

  const headerFields = includePersonalData
    ? ["Nome", "E-mail"]
    : ["ID do participante"];
  headerFields.push(
    "Status",
    "Atividade",
    "Inscrito em",
    "Dias concluídos",
    "Progresso (%)",
    "Pontos",
    "Sequência atual",
    "Maior sequência",
    "Última atividade",
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode("﻿"));
      controller.enqueue(encoder.encode(csvRow(headerFields)));

      let page = 1;
      while (true) {
        const { data, error } = await listAdminParticipants(parsedId.data, {
          ...filters,
          page,
        });

        if (error || !data || data.rows.length === 0) {
          break;
        }

        for (const participant of data.rows) {
          const identityFields = includePersonalData
            ? [participant.name || "Sem nome", participant.email]
            : [participant.enrollment_id];

          controller.enqueue(
            encoder.encode(
              csvRow([
                ...identityFields,
                describeEnrollmentStatus(participant.status),
                describeActivity(participant.activity),
                participant.joined_at,
                participant.finalized_days,
                participant.completion_percent,
                participant.points_total,
                participant.streak_current,
                participant.streak_best,
                participant.last_activity_at,
              ]),
            ),
          );
        }

        if (data.rows.length < 20) {
          break;
        }

        page += 1;
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="participantes-${challenge.slug}.csv"`,
      "content-type": "text/csv; charset=utf-8",
    },
  });
}
