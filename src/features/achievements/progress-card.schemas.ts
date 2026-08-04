import { z } from "zod";

export const progressCardKindParamSchema = z.enum(["day_completed", "streak_record"]);

export const dailyLogIdSchema = z.uuid("Identificador de dia inválido.");
