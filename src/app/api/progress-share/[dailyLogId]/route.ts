import { NextResponse } from "next/server";

import { shareCardFormatParamSchema } from "@/features/achievements/achievement-art.schemas";
import { dailyLogIdSchema, progressCardKindParamSchema } from "@/features/achievements/progress-card.schemas";
import { recordAnalyticsEvent } from "@/server/services/analytics.service";
import { requireAuthUser } from "@/server/services/auth-session.service";
import { generateProgressShareCard } from "@/server/services/progress-share.service";

export const runtime = "nodejs";

// Mesmo padrao de /api/achievements/[userAchievementId]/share-card (unico
// outro Route Handler autenticado do projeto que faz trabalho real - a
// geracao de imagem via next/og ImageResponse nao pode ser retornada por
// uma Server Action). Mesma mitigacao de rate limiting: idempotencia via
// payload_hash (mesmo dado + mesmo template => reaproveita a imagem
// existente, nunca regenera) - limite de taxa por IP/usuario continua fora
// de escopo, documentado como pendencia.
export async function GET(request: Request, { params }: { params: Promise<{ dailyLogId: string }> }) {
  await requireAuthUser("/app/dashboard");

  const { dailyLogId: rawDailyLogId } = await params;
  const parsedId = dailyLogIdSchema.safeParse(rawDailyLogId);

  if (!parsedId.success) {
    return NextResponse.json({ error: "Identificador de dia inválido." }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsedFormat = shareCardFormatParamSchema.safeParse(url.searchParams.get("format"));

  if (!parsedFormat.success) {
    return NextResponse.json({ error: "Formato inválido. Use story ou feed." }, { status: 400 });
  }

  const parsedKind = progressCardKindParamSchema.safeParse(url.searchParams.get("kind"));

  if (!parsedKind.success) {
    return NextResponse.json({ error: "Tipo de card inválido." }, { status: 400 });
  }

  await recordAnalyticsEvent({
    eventName: "evolution_share_started",
    metadata: { format: parsedFormat.data, kind: parsedKind.data },
  });

  const result = await generateProgressShareCard(parsedId.data, parsedKind.data, parsedFormat.data);

  if (!result.ok) {
    const status = result.error.includes("encontrado") ? 404 : 500;
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
