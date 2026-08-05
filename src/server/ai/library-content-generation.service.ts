import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { suggestLibrarySlug, suggestsEnhancedReview } from "@/features/library/library.core";
import { adminCreateLibraryContentAiDraft } from "@/server/services/admin-library.service";
import { recordSystemError } from "@/server/services/system-observability.service";

import { generateWithAiProvider, isAiProviderConfigured } from "./ai-provider";
import {
  libraryContentGenerationOutputSchema,
  LIBRARY_GENERATION_TONE_LABELS,
  type LibraryGenerationTone,
} from "./library-content-generation.schema";

export type GenerateLibraryContentInput = {
  actorId: string;
  category?: string | undefined;
  pillarHint?: string | undefined;
  relatedChallengeId?: string | undefined;
  targetReadingMinutes?: number | undefined;
  tone: LibraryGenerationTone;
  topic: string;
};

export type GenerateLibraryContentResult =
  | { contentId: string; ok: true }
  | { ok: false; reason: "not_configured" | "rate_limited" | "invalid_output" | "provider_error"; message: string };

const HOURLY_LIMIT = 10;
const DAILY_LIMIT = 30;

/**
 * Limite de custo/uso (Parte 20) - checado ANTES de chamar o provedor, para
 * nunca gastar uma chamada real só para descartar o resultado depois. Conta
 * por instalação (não por admin individual) porque o objetivo é controlar
 * custo externo agregado, não "cota por pessoa".
 */
async function checkRateLimit(): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createSupabaseServerClient();
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: hourlyCount }, { count: dailyCount }] = await Promise.all([
    supabase
      .from("library_contents")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "ai_assisted")
      .gte("created_at", hourAgo),
    supabase
      .from("library_contents")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "ai_assisted")
      .gte("created_at", dayAgo),
  ]);

  if ((hourlyCount ?? 0) >= HOURLY_LIMIT) {
    return { ok: false, message: `Limite de ${HOURLY_LIMIT} gerações por hora atingido. Tente novamente mais tarde.` };
  }
  if ((dailyCount ?? 0) >= DAILY_LIMIT) {
    return { ok: false, message: `Limite de ${DAILY_LIMIT} gerações por dia atingido. Tente novamente amanhã.` };
  }
  return { ok: true };
}

/**
 * Contexto do prompt (Parte 11) - allowlist explícita. Só entra aqui o que
 * o PRÓPRIO admin digitou neste formulário agora (tema, tom, pilar,
 * categoria, tempo alvo). Nunca: dado de usuário final, diário, feedback,
 * email, user_id, dado médico, comportamento individual, token, segredo,
 * log ou comentário privado - nada disso é buscado ou tem como chegar
 * aqui, porque esta função não recebe nada além do que está listado no
 * tipo GenerateLibraryContentInput.
 */
function buildSystemPrompt(): string {
  return `Você é um assistente editorial do Projeto 30, um app de desafios de hábitos com inspiração cristã (Corpo, Mente, Caráter, Espírito).

Gere APENAS um objeto JSON válido (sem markdown, sem texto fora do JSON) com este formato exato:
{
  "title": string (3-160 caracteres),
  "subtitle": string ou null,
  "summary": string ou null (até 400 caracteres),
  "introduction": string ou null,
  "body_sections": string[] (1 a 12 parágrafos, o corpo principal do texto),
  "practical_application": string ou null,
  "reflection_question": string ou null,
  "small_action": string ou null,
  "final_message": string ou null,
  "bible_reference": null,
  "bible_excerpt": null,
  "tags": string[] (até 10),
  "estimated_reading_minutes": number ou null,
  "suggested_category": string ou null,
  "suggested_pillar": "body" | "mind" | "character" | "spirit",
  "notification_copy": string ou null (até 180 caracteres),
  "card_copy": string ou null (até 280 caracteres)
}

Regras editoriais obrigatórias, sem exceção:
- NUNCA inclua um versículo bíblico ou referência bíblica específica - sempre retorne null em "bible_reference" e "bible_excerpt". Um humano vai adicionar o trecho correto manualmente depois de conferir a fonte.
- NUNCA dê diagnóstico médico ou psicológico, nem prescreva tratamento, dieta ou treino específico.
- NUNCA prometa cura, emagrecimento garantido ou qualquer resultado físico/financeiro garantido.
- NUNCA atribua sofrimento a falta de fé, nem garanta um resultado específico de Deus.
- NUNCA apresente uma opinião teológica pessoal como regra universal.
- NUNCA use culpa religiosa como motivação.
- NUNCA copie texto de terceiros - todo o conteúdo deve ser original.
- NUNCA use linguagem ofensiva ou discriminatória.
- Se o tema pedido tocar em saúde, alimentação, treino físico, Bíblia, teologia, oração ou aconselhamento emocional, mantenha o tom informativo e inspiracional, nunca prescritivo.
- Responda somente com o objeto JSON, nada mais.`;
}

function buildUserPrompt(input: GenerateLibraryContentInput): string {
  const lines = [
    `Tema/tópico solicitado pelo administrador: ${input.topic}`,
    `Tom desejado: ${LIBRARY_GENERATION_TONE_LABELS[input.tone]}`,
  ];
  if (input.pillarHint) lines.push(`Pilar sugerido: ${input.pillarHint}`);
  if (input.category) lines.push(`Categoria sugerida: ${input.category}`);
  if (input.targetReadingMinutes) lines.push(`Tempo de leitura alvo: ${input.targetReadingMinutes} minutos`);
  return lines.join("\n");
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Nenhum objeto JSON encontrado na resposta.");
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

export async function generateLibraryContentDraft(
  input: GenerateLibraryContentInput,
): Promise<GenerateLibraryContentResult> {
  if (!isAiProviderConfigured()) {
    return { message: "Nenhum provedor de IA está configurado. Peça ao responsável técnico para adicionar ANTHROPIC_API_KEY.", ok: false, reason: "not_configured" };
  }

  const rateLimit = await checkRateLimit();
  if (!rateLimit.ok) {
    return { message: rateLimit.message, ok: false, reason: "rate_limited" };
  }

  const result = await generateWithAiProvider({
    prompt: buildUserPrompt(input),
    system: buildSystemPrompt(),
  });

  if (!result.ok) {
    await recordSystemError({
      area: "admin",
      message: result.message,
      operation: "library_ai_generation_provider",
      route: "/admin/biblioteca/gerar",
      severity: "warning",
      userId: input.actorId,
    });
    return { message: result.message, ok: false, reason: "provider_error" };
  }

  let parsed: ReturnType<typeof libraryContentGenerationOutputSchema.parse>;
  try {
    const json = extractJson(result.text);
    parsed = libraryContentGenerationOutputSchema.parse(json);
  } catch {
    await recordSystemError({
      area: "admin",
      message: "A IA retornou um formato inválido para o conteúdo da Biblioteca.",
      operation: "library_ai_generation_invalid_output",
      route: "/admin/biblioteca/gerar",
      severity: "warning",
      userId: input.actorId,
    });
    return {
      message: "A IA retornou um conteúdo em formato inválido. Tente novamente.",
      ok: false,
      reason: "invalid_output",
    };
  }

  const slug = `${suggestLibrarySlug(parsed.title)}-${Date.now().toString(36)}`;
  const body = parsed.body_sections.join("\n\n");
  const enhancedReviewSignal = suggestsEnhancedReview(
    `${parsed.title} ${parsed.summary ?? ""} ${input.topic} ${parsed.suggested_category ?? ""}`,
  );

  const contentId = await adminCreateLibraryContentAiDraft({
    aiGenerationMetadata: {
      generatedAt: new Date().toISOString(),
      generatedBy: input.actorId,
      model: result.model,
      tone: input.tone,
      topic: input.topic,
    },
    body,
    category: parsed.suggested_category ?? input.category,
    finalMessage: parsed.final_message ?? undefined,
    introduction: parsed.introduction ?? undefined,
    pillar: input.pillarHint || parsed.suggested_pillar,
    practicalApplication: parsed.practical_application ?? undefined,
    readingTimeMinutes: parsed.estimated_reading_minutes ?? input.targetReadingMinutes,
    reflectionQuestion: parsed.reflection_question ?? undefined,
    relatedChallengeId: input.relatedChallengeId,
    requiresEnhancedReview: enhancedReviewSignal,
    slug,
    smallAction: parsed.small_action ?? undefined,
    subtitle: parsed.subtitle ?? undefined,
    summary: parsed.summary ?? undefined,
    tags: parsed.tags,
    title: parsed.title,
  });

  return { contentId, ok: true };
}
