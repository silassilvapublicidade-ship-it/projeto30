import type { Metadata } from "next";

import { ShareTemplateToggle } from "@/components/admin/share-template-toggle";
import { EmptyState } from "@/components/ui/feedback";
import { getAdminShareTemplates } from "@/server/services/admin-share-templates.service";

export const metadata: Metadata = {
  title: "Compartilhamentos · Administração",
};

const KIND_LABEL_BY_SLUG_PREFIX: Record<string, string> = {
  achievement: "Conquista",
  challenge_completed: "Desafio concluído",
  challenge_progress: "Progresso do desafio",
  halfway: "Metade do desafio",
  last_7_days: "Últimos 7 dias",
  progress_day: "Dia concluído",
  streak_reached: "Sequência atingida",
  streak_record: "Novo recorde",
  weekly_summary: "Resumo semanal",
};

function kindLabelForSlug(slug: string | null): string {
  if (!slug) return "—";
  const prefix = Object.keys(KIND_LABEL_BY_SLUG_PREFIX)
    .sort((a, b) => b.length - a.length)
    .find((key) => slug.startsWith(key));
  return prefix ? KIND_LABEL_BY_SLUG_PREFIX[prefix]! : slug;
}

/**
 * Admin minimo de templates (Refinamento premium, Parte E item 24) -
 * ativar/desativar cada um dos 20 presets de compartilhamento (8 tipos de
 * progresso x 2 formatos + achievement x 2 formatos). Deliberadamente NÃO
 * oferece escolher fundo/
 * cena nem editar a mensagem padrão: ambos são computados a partir de dado
 * real do usuário em progress-card.core.ts/achievement-art.core.ts - um
 * editor livre aqui reabriria a fabricação de conteúdo que a rodada
 * anterior fechou ao simplificar share_templates.config para apenas
 * {format, width, height}. "Publicar" um redesign de layout (que exigiria
 * incrementar template_version) continua uma mudança de código, não uma
 * ação de admin - deixar isso editável na UI permitiria desincronizar o
 * número da versão do layout realmente renderizado.
 */
export default async function AdminCompartilhamentosPage() {
  const templates = await getAdminShareTemplates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Compartilhamentos</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Ative ou desative cada modelo de card premium. Cor, cena e mensagem sempre vêm dos dados
          reais do usuário - nunca de texto livre editado aqui.
        </p>
      </div>

      {templates.length === 0 ? (
        <EmptyState description="Nenhum template cadastrado ainda." title="Sem templates" />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-white/[0.08]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.08em] text-muted-2">
              <tr>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Formato</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {templates.map((template) => (
                <tr key={template.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{kindLabelForSlug(template.slug)}</p>
                    <p className="font-mono text-[0.62rem] text-muted-2">{template.slug ?? template.id}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {template.config.format === "story" ? "Story (1080×1920)" : "Feed (1080×1350)"}
                  </td>
                  <td className="px-4 py-3">
                    <ShareTemplateToggle active={template.active} templateId={template.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
