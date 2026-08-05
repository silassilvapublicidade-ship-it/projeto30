import { z } from "zod";

// Categorias controladas (select) - "criar categoria nova apenas se houver
// modelo oficial para isso" (nao ha, entao a lista fica fechada por ora).
export const TIP_CATEGORIES = [
  "Leitura",
  "Organização",
  "Rotina",
  "Foco",
  "Motivação",
  "Alimentação",
  "Treino",
  "Sono",
  "Bem-estar",
  "Produtividade",
  "Geral",
] as const;

export type TipCategory = (typeof TIP_CATEGORIES)[number];

export const tipIdSchema = z.uuid("Identificador de dica inválido.");

export const tipFormSchema = z
  .object({
    altText: z.string().trim().max(200).optional(),
    category: z.enum(TIP_CATEGORIES, "Selecione uma categoria."),
    challengeId: z.uuid().optional(),
    content: z.string().trim().max(4000).optional(),
    displayOrder: z.coerce.number().int().min(0).max(9999).default(0),
    endsAt: z.string().trim().optional(),
    relatedLibraryContentId: z.uuid().optional(),
    slug: z
      .string()
      .trim()
      .min(3, "Informe um slug com pelo menos 3 caracteres.")
      .max(120)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens."),
    startsAt: z.string().trim().optional(),
    summary: z.string().trim().max(280).optional(),
    title: z.string().trim().min(3, "Informe um título com pelo menos 3 caracteres.").max(160),
  })
  .refine((data) => !data.startsAt || !data.endsAt || data.startsAt <= data.endsAt, {
    error: "O fim da exibição precisa ser igual ou depois do início.",
    path: ["endsAt"],
  });

export type TipFormInput = z.infer<typeof tipFormSchema>;

// Mesmo padrao de validateAvatarUpload (profile.schemas.ts): tamanho + MIME
// real, nunca confiando na extensao do nome do arquivo. SVG e arquivos
// executaveis nunca sao aceitos nesta primeira versao. Reforcado tambem no
// proprio bucket do Storage (0025_tip_cards_storage_hardening.sql) como
// defesa em profundidade.
const ACCEPTED_TIP_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const TIP_IMAGE_EXTENSION_BY_MIME: Record<(typeof ACCEPTED_TIP_IMAGE_MIME_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_TIP_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

// 4:5 e a proporcao recomendada (1080x1350) - nao exigida, mas usada para
// alertar quando a imagem enviada foge muito do padrao esperado do feed.
export const RECOMMENDED_TIP_IMAGE_RATIO = 4 / 5;
const RATIO_TOLERANCE = 0.12;

export type TipImageValidationResult =
  | { extension: string; ok: true }
  | { message: string; ok: false };

export function validateTipImageUpload(file: { size: number; type: string }): TipImageValidationResult {
  if (file.size <= 0) {
    return { ok: false, message: "O arquivo enviado está vazio." };
  }

  if (file.size > MAX_TIP_IMAGE_SIZE_BYTES) {
    return { ok: false, message: "A imagem precisa ter até 8 MB." };
  }

  if (
    !ACCEPTED_TIP_IMAGE_MIME_TYPES.includes(
      file.type as (typeof ACCEPTED_TIP_IMAGE_MIME_TYPES)[number],
    )
  ) {
    return { ok: false, message: "Envie uma imagem em JPEG, PNG ou WebP." };
  }

  return {
    ok: true,
    extension: TIP_IMAGE_EXTENSION_BY_MIME[file.type as (typeof ACCEPTED_TIP_IMAGE_MIME_TYPES)[number]],
  };
}

/**
 * Orientation hint only - never blocks upload/publish, just tells the admin
 * the art strays from the recommended 4:5 feed ratio (1080x1350) so text
 * baked into the art doesn't end up cropped by a hard aspect constraint
 * elsewhere.
 */
export function isRecommendedTipImageRatio(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) {
    return false;
  }

  const ratio = width / height;
  return Math.abs(ratio - RECOMMENDED_TIP_IMAGE_RATIO) <= RATIO_TOLERANCE;
}
