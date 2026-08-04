import { NextResponse } from "next/server";

import { shareCardFormatParamSchema } from "@/features/achievements/achievement-art.schemas";
import { enrollmentIdSchema, snapshotProgressCardKindParamSchema } from "@/features/achievements/progress-card.schemas";
import { recordAnalyticsEvent } from "@/server/services/analytics.service";
import { requireAuthUser } from "@/server/services/auth-session.service";
import { generateSnapshotShareCard } from "@/server/services/enrollment-snapshot-share.service";

export const runtime = "nodejs";

/**
 * Mesmo padrao de /api/progress-share/[dailyLogId] - so a ancora muda
 * (enrollmentId em vez de dailyLogId) para os 5 tipos que fotografam o
 * ESTADO da inscricao (halfway/last_7_days/weekly_summary/
 * challenge_progress/challenge_completed). Reaproveita os MESMOS eventos de
 * analytics (evolution_share_started/completed) - nunca duplica.
 */
export async function GET(request: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  await requireAuthUser("/app/dashboard");

  const { enrollmentId: rawEnrollmentId } = await params;
  const parsedId = enrollmentIdSchema.safeParse(rawEnrollmentId);

  if (!parsedId.success) {
    return NextResponse.json({ error: "Identificador de inscrição inválido." }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsedFormat = shareCardFormatParamSchema.safeParse(url.searchParams.get("format"));

  if (!parsedFormat.success) {
    return NextResponse.json({ error: "Formato inválido. Use story ou feed." }, { status: 400 });
  }

  const parsedKind = snapshotProgressCardKindParamSchema.safeParse(url.searchParams.get("kind"));

  if (!parsedKind.success) {
    return NextResponse.json({ error: "Tipo de card inválido." }, { status: 400 });
  }

  await recordAnalyticsEvent({
    eventName: "evolution_share_started",
    metadata: { format: parsedFormat.data, kind: parsedKind.data },
  });

  const result = await generateSnapshotShareCard(parsedId.data, parsedKind.data, parsedFormat.data);

  if (!result.ok) {
    const status = result.error.includes("não encontrada") ? 404 : result.error.includes("ainda não") || result.error.includes("Não há") ? 409 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  await recordAnalyticsEvent({
    eventName: "evolution_share_completed",
    metadata: { format: result.format, kind: parsedKind.data },
  });

  return NextResponse.json({
    format: result.format,
    height: result.height,
    imageUrl: result.imageUrl,
    width: result.width,
  });
}
