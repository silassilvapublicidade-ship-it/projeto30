"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminUser } from "@/server/services/admin-session.service";
import { resolveSystemErrorEvent } from "@/server/services/system-observability.service";

import { SYSTEM_ERROR_STATUSES } from "./system-error.core";

const resolveSchema = z.object({
  id: z.uuid("Ocorrência inválida."),
  status: z.enum(SYSTEM_ERROR_STATUSES),
  resolutionNote: z.string().trim().max(500).optional(),
  resolvedInVersion: z.string().trim().max(60).optional(),
});

export async function resolveSystemErrorEventAction(formData: FormData): Promise<void> {
  // requireAdminUser só garante admin/super_admin - o gate fino (só
  // super_admin resolve) é reforçado de novo dentro da RPC
  // admin_resolve_system_error_event (Parte P: ações de resolução exigem
  // super_admin mesmo que um admin comum de alguma forma submeta o form).
  await requireAdminUser();

  const parsed = resolveSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    resolutionNote: formData.get("resolutionNote") || undefined,
    resolvedInVersion: formData.get("resolvedInVersion") || undefined,
  });

  const redirectPath = `/admin/observabilidade/${String(formData.get("id"))}`;

  if (!parsed.success) {
    redirect(`${redirectPath}?feedback=invalid`);
  }

  const result = await resolveSystemErrorEvent({
    id: parsed.data.id,
    status: parsed.data.status,
    resolutionNote: parsed.data.resolutionNote,
    resolvedInVersion: parsed.data.resolvedInVersion,
  });

  if (!result.ok) {
    redirect(`${redirectPath}?feedback=forbidden`);
  }

  revalidatePath("/admin/observabilidade");
  revalidatePath(redirectPath);
  redirect(`${redirectPath}?feedback=updated`);
}
