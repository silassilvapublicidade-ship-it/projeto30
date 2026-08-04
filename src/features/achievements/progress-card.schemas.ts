import { z } from "zod";

/** 3 tipos ancorados num dia especifico - ver DAY_ANCHORED_PROGRESS_CARD_KINDS em progress-card.core.ts. */
export const progressCardKindParamSchema = z.enum(["day_completed", "streak_record", "streak_reached"]);

/** 5 tipos que fotografam o estado da inscricao - ver ENROLLMENT_SNAPSHOT_PROGRESS_CARD_KINDS. */
export const snapshotProgressCardKindParamSchema = z.enum([
  "halfway",
  "last_7_days",
  "weekly_summary",
  "challenge_progress",
  "challenge_completed",
]);

export const dailyLogIdSchema = z.uuid("Identificador de dia inválido.");

export const enrollmentIdSchema = z.uuid("Identificador de inscrição inválido.");
