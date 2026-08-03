import { z } from "zod";

import { NOTIFICATION_DESTINATION_TYPES } from "@/features/notifications/notification-destination.core";

// Mirrors notification_campaigns_audience_type_check (migration 0041) -
// keep both in sync by hand, the same discipline already used for
// destination_type between this file, the DB CHECK and the service worker.
export const NOTIFICATION_AUDIENCE_TYPES = [
  "all_active_users",
  "specific_user",
  "challenge_participants",
  "active_enrollment",
  "day_not_finalized",
  "day_finalized",
  "push_enabled",
  "push_disabled_internal_only",
  "admins",
  "super_admins",
] as const;

export type NotificationAudienceType = (typeof NOTIFICATION_AUDIENCE_TYPES)[number];

export const NOTIFICATION_AUDIENCE_LABELS: Record<NotificationAudienceType, string> = {
  all_active_users: "Todos os usuários ativos",
  specific_user: "Um usuário específico",
  challenge_participants: "Participantes de um desafio",
  active_enrollment: "Inscrições ativas (qualquer desafio)",
  day_not_finalized: "Não finalizaram o dia de hoje",
  day_finalized: "Já finalizaram o dia de hoje",
  push_enabled: "Com push ativado",
  push_disabled_internal_only: "Sem push (só central interna)",
  admins: "Administradores",
  super_admins: "Super administradores",
};

/** Which audience types require which extra parameter, mirrored by resolve_notification_audience. */
export const AUDIENCE_REQUIRES_CHALLENGE: ReadonlySet<NotificationAudienceType> = new Set([
  "challenge_participants",
]);
export const AUDIENCE_REQUIRES_USER: ReadonlySet<NotificationAudienceType> = new Set(["specific_user"]);

export const campaignTitleSchema = z
  .string()
  .trim()
  .min(3, "Informe um título com pelo menos 3 caracteres.")
  .max(120, "O título pode ter até 120 caracteres.");

export const campaignMessageSchema = z
  .string()
  .trim()
  .min(3, "Informe uma mensagem com pelo menos 3 caracteres.")
  .max(500, "A mensagem pode ter até 500 caracteres.");

export const campaignFormSchema = z
  .object({
    actionLabel: z.string().trim().max(40, "O texto do botão pode ter até 40 caracteres.").optional(),
    audienceType: z.enum(NOTIFICATION_AUDIENCE_TYPES, "Selecione um público."),
    channelInternal: z.coerce.boolean().default(true),
    channelPush: z.coerce.boolean().default(true),
    challengeId: z.uuid().optional(),
    destinationReferenceId: z.string().trim().max(160).optional(),
    destinationType: z.enum(NOTIFICATION_DESTINATION_TYPES, "Selecione um destino."),
    imageUrl: z.url().optional(),
    message: campaignMessageSchema,
    specificUserId: z.uuid().optional(),
    title: campaignTitleSchema,
  })
  .refine((data) => data.channelInternal || data.channelPush, {
    error: "Selecione ao menos um canal (interno ou push).",
    path: ["channelPush"],
  })
  .refine(
    (data) => !AUDIENCE_REQUIRES_CHALLENGE.has(data.audienceType) || !!data.challengeId,
    {
      error: "Selecione o desafio para este público.",
      path: ["challengeId"],
    },
  )
  .refine(
    (data) => !AUDIENCE_REQUIRES_USER.has(data.audienceType) || !!data.specificUserId,
    {
      error: "Selecione o usuário para este público.",
      path: ["specificUserId"],
    },
  );

export type CampaignFormInput = z.infer<typeof campaignFormSchema>;

export const campaignIdSchema = z.uuid("Identificador de campanha inválido.");

export const REQUIRED_SEND_CONFIRMATION_PHRASE = "ENVIAR NOTIFICAÇÃO";

// Reuses the exact same validation the Dicas image pipeline already
// enforces (size + real MIME, never trusting the file extension) - see
// admin-tips.schemas.ts. Not re-exported under a new name on purpose: this
// import IS the reuse the briefing asked for ("reaproveitar o pipeline de
// imagens de Dicas"), not a parallel implementation.
export { MAX_TIP_IMAGE_SIZE_BYTES as MAX_NOTIFICATION_IMAGE_SIZE_BYTES, validateTipImageUpload as validateNotificationImageUpload } from "./admin-tips.schemas";
