"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/server/services/admin-session.service";

const toggleSchema = z.object({
  active: z.boolean(),
  templateId: z.uuid(),
});

/**
 * "Ativar/desativar tipo" (Refinamento premium, Parte E item 24) - a unica
 * escrita administrativa que este schema suporta com seguranca sem virar
 * um editor grafico livre. Fundo/cena e mensagem padrao NÃO sao editaveis
 * aqui de proposito: ambos sao computados a partir de dado real
 * (progress-card.core.ts) - deixa-los editaveis por admin reabriria a
 * exata lacuna ("cores aleatorias"/texto fabricado) que a rodada anterior
 * fechou ao simplificar share_templates.config. RLS "Admins can manage
 * share templates" (0001) e quem realmente impede um nao-admin de chamar
 * isto - requireAdminUser aqui e so a mensagem de erro amigavel antes
 * disso.
 */
export async function toggleShareTemplateActiveAction(templateId: string, active: boolean): Promise<{ error?: string }> {
  await requireAdminUser();

  const parsed = toggleSchema.safeParse({ active, templateId });
  if (!parsed.success) {
    return { error: "Dados inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("share_templates")
    .update({ active: parsed.data.active })
    .eq("id", parsed.data.templateId);

  if (error) {
    return { error: "Não foi possível atualizar o template agora." };
  }

  revalidatePath("/admin/compartilhamentos");
  return {};
}
