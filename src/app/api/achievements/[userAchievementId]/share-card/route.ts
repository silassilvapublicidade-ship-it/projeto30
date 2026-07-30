import { NextResponse } from "next/server";

import { shareCardFormatParamSchema, userAchievementIdSchema } from "@/features/achievements/achievement-art.schemas";
import { generateAchievementShareCard } from "@/server/services/achievement-art.service";
import { recordAnalyticsEvent } from "@/server/services/analytics.service";
import { requireAuthUser } from "@/server/services/auth-session.service";

export const runtime = "nodejs";

// Primeiro Route Handler autenticado do projeto que faz trabalho real (todo
// o resto de mutacao no repo usa Server Actions - ver auditoria no relatorio
// final). Necessario aqui porque o resultado inclui a geracao de uma imagem
// (next/og ImageResponse), que uma Server Action nao consegue retornar.
//
// Rate limiting: nao ha infraestrutura de rate limiting no projeto (sem
// Redis/Upstash configurado). Mitigacao minima e documentada: a propria
// idempotencia (mesmo hash => reaproveita a imagem existente, nunca
// regenera) ja limita o custo de chamadas repetidas de um mesmo usuario para
// a mesma conquista/formato a uma unica geracao real. Uma limitacao real de
// taxa por IP/usuario fica como pendencia explicita para a proxima rodada.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userAchievementId: string }> },
) {
  await requireAuthUser("/app/conquistas");

  const { userAchievementId: rawUserAchievementId } = await params;
  const parsedId = userAchievementIdSchema.safeParse(rawUserAchievementId);

  if (!parsedId.success) {
    return NextResponse.json({ error: "Identificador de conquista inválido." }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsedFormat = shareCardFormatParamSchema.safeParse(url.searchParams.get("format"));

  if (!parsedFormat.success) {
    return NextResponse.json({ error: "Formato inválido. Use story ou feed." }, { status: 400 });
  }

  await recordAnalyticsEvent({
    eventName: "share_achievement_started",
    metadata: { format: parsedFormat.data },
  });

  const result = await generateAchievementShareCard(parsedId.data, parsedFormat.data);

  if (!result.ok) {
    const status = result.error.includes("encontrada") ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  await recordAnalyticsEvent({
    eventName: "share_achievement_completed",
    metadata: { format: result.format },
  });

  return NextResponse.json({
    achievementName: result.achievementName,
    format: result.format,
    height: result.height,
    imageUrl: result.imageUrl,
    width: result.width,
  });
}
