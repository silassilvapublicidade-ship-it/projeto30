import packageJson from "../../package.json";

/**
 * Fonte de "versão do sistema" para o painel de Observabilidade (Parte E).
 * Deliberadamente NÃO chama a CLI do Git/Supabase nem a API da Vercel em
 * runtime - só lê variáveis já injetadas pela própria Vercel em toda
 * função server-side (VERCEL_GIT_COMMIT_SHA etc., documentadas como
 * "System Environment Variables") e duas constantes de configuração
 * mantidas manualmente.
 */

export const APP_VERSION = packageJson.version;

// Mantido manualmente em sincronia com public/sw.js (SW_VERSION) - mesmo
// padrão de "mirror documentado" já usado em admin-access.core.ts para
// is_admin(). Atualizar os dois juntos ao mudar a estratégia de cache do SW.
export const SERVICE_WORKER_VERSION = "v1";

// Mantido manualmente em sincronia com o nome do arquivo da migration mais
// recente em supabase/migrations/. Atualizar ao criar uma nova migration.
export const LATEST_MIGRATION_ID = "0091_health_status_ignore_info_events";

export type DeployInfo = {
  commitSha: string | null;
  commitShaShort: string | null;
  environment: string;
  deployedAt: string | null;
};

export function getDeployInfo(): DeployInfo {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;

  return {
    commitSha,
    commitShaShort: commitSha ? commitSha.slice(0, 7) : null,
    environment: process.env.VERCEL_ENV ?? "development",
    // A Vercel não expõe a data do deploy como env var - fica null fora de
    // um contexto onde o chamador já sabe o horário (ex.: o próprio
    // recordSystemError registra occurred_at por execução).
    deployedAt: null,
  };
}
