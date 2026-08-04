import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminShareTemplate = {
  active: boolean;
  challengeId: string | null;
  config: { format: "feed" | "story"; height: number; width: number };
  id: string;
  name: string;
  slug: string | null;
  updatedAt: string;
};

/**
 * Lista dos templates de compartilhamento (Refinamento premium, Parte E
 * item 24) - a RLS "Admins can manage share templates" (0001) ja garante
 * que so admin le/escreve aqui, nenhum client service-role necessario.
 * challenge_id sempre nulo hoje (todos os 20 presets - 8 tipos x 2
 * formatos + achievement - sao globais), mas exposto porque o schema
 * permite um template dedicado a um desafio no futuro. Nao ha
 * "template_version" aqui: essa coluna vive em share_cards (a versao
 * usada em CADA card ja gerado), nunca em share_templates - a versao
 * "atual" para novas geracoes e a constante TEMPLATE_VERSION no codigo de
 * cada servico de renderizacao, deliberadamente fora do alcance do admin
 * (ver admin-share-templates.actions.ts).
 */
export async function getAdminShareTemplates(): Promise<AdminShareTemplate[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("share_templates")
    .select("id, slug, name, active, config, challenge_id, updated_at")
    .order("slug", { ascending: true });

  return (data ?? []).map((row) => ({
    active: row.active,
    challengeId: row.challenge_id,
    config: row.config as unknown as AdminShareTemplate["config"],
    id: row.id,
    name: row.name,
    slug: row.slug,
    updatedAt: row.updated_at,
  }));
}
