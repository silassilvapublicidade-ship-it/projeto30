import type { Metadata } from "next";
import Link from "next/link";

import { AdminPagination } from "@/components/admin/admin-pagination";
import type { AdminSearchParams } from "@/components/admin/admin-query-utils";
import { buildAdminQuery } from "@/components/admin/admin-query-utils";
import { AdminSortLink } from "@/components/admin/admin-sort-link";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusCard } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import { getTotalPages, parseUserListParams } from "@/features/admin/admin-analytics.schemas";
import { ADMIN_USER_PAGE_SIZE, listAdminUsers } from "@/server/services/admin-users.service";

export const metadata: Metadata = {
  title: "Usuários · Administração",
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  moderator: "Moderador",
  super_admin: "Super admin",
  user: "Membro",
};

const statusLabels: Record<string, string> = {
  active: "Ativo",
  deleted: "Excluído",
  inactive: "Desativado",
  suspended: "Bloqueado",
};

const roleOptions = [
  { label: "Todos os papéis", value: "" },
  { label: "Membro", value: "user" },
  { label: "Moderador", value: "moderator" },
  { label: "Administrador", value: "admin" },
  { label: "Super admin", value: "super_admin" },
];

const statusOptions = [
  { label: "Todos os status", value: "" },
  { label: "Ativo", value: "active" },
  { label: "Desativado", value: "inactive" },
  { label: "Bloqueado", value: "suspended" },
];

const booleanOptions = (labelYes: string, labelNo: string) => [
  { label: "Todos", value: "" },
  { label: labelYes, value: "true" },
  { label: labelNo, value: "false" },
];

const feedbackMessages: Record<string, { description: string; title: string }> = {
  invalid: { title: "Solicitação inválida", description: "Identificador de usuário ausente." },
  error: { title: "Não foi possível concluir", description: "A ação falhou. Tente novamente." },
  "action-blocked": {
    title: "Ação bloqueada",
    description: "Esta é a única conta super_admin ativa - a ação foi impedida para não deixar a plataforma sem administrador.",
  },
  "not-found": { title: "Não encontrado", description: "Este usuário não existe mais." },
  "create-success": {
    title: "Usuário criado",
    description: "A conta foi criada e já pode ser usada para entrar.",
  },
  "create-success-enroll-failed": {
    title: "Usuário criado, mas a inscrição falhou",
    description: "A conta foi criada normalmente. Inscreva o usuário no desafio manualmente pela tela de Desafios.",
  },
  "delete-success": {
    title: "Usuário excluído",
    description: "A conta e seus dados foram removidos definitivamente.",
  },
  "delete-self-blocked": {
    title: "Ação não permitida",
    description: "Você não pode excluir sua própria conta por aqui.",
  },
  "delete-blocked": {
    title: "Exclusão bloqueada",
    description: "Esta é a única conta super_admin ativa e não pode ser excluída.",
  },
  "status-updated": { title: "Status atualizado", description: "O status do usuário foi alterado." },
  "role-updated": { title: "Papel atualizado", description: "O papel do usuário foi alterado." },
  "role-forbidden": {
    title: "Ação não permitida",
    description: "Apenas super_admin pode conceder ou revogar papéis administrativos.",
  },
  "require-password-change-success": {
    title: "Troca de senha exigida",
    description: "A conta precisará definir uma nova senha no próximo acesso.",
  },
  "enroll-success": { title: "Inscrição realizada", description: "O usuário foi inscrito no desafio." },
  "enroll-failed": { title: "Não foi possível inscrever", description: "Verifique se o desafio ainda está publicado." },
};

const errorFeedbackKeys = new Set([
  "error",
  "invalid",
  "not-found",
  "delete-self-blocked",
  "delete-blocked",
  "role-forbidden",
  "action-blocked",
  "enroll-failed",
]);
const warningFeedbackKeys = new Set(["create-success-enroll-failed"]);

type AdminUsersPageProps = {
  searchParams: Promise<AdminSearchParams>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const rawParams = await searchParams;
  const params = parseUserListParams(rawParams);
  const feedbackKey = Array.isArray(rawParams.feedback) ? rawParams.feedback[0] : rawParams.feedback;
  const feedback = feedbackKey ? feedbackMessages[feedbackKey] : undefined;
  const redirectTo = `/admin/usuarios${buildAdminQuery(rawParams, { feedback: null })}`;

  const { data, error } = await listAdminUsers({
    hasActiveChallenge: params.hasActiveChallenge,
    mustChangePassword: params.mustChangePassword,
    page: params.page,
    profileComplete: params.profileComplete,
    role: params.role,
    search: params.search,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    status: params.status,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Usuários</h1>
          <p className="mt-1 text-sm leading-6 text-muted">
            Contas da área de membros. Papéis administrativos continuam sendo geridos apenas via banco de dados.
          </p>
        </div>
        <Button as="a" href="/admin/usuarios/novo">
          Novo usuário
        </Button>
      </div>

      {feedback ? (
        <StatusCard
          description={feedback.description}
          title={feedback.title}
          tone={
            errorFeedbackKeys.has(feedbackKey ?? "")
              ? "error"
              : warningFeedbackKeys.has(feedbackKey ?? "")
                ? "warning"
                : "success"
          }
        />
      ) : null}

      <form
        className="grid grid-cols-1 gap-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:grid-cols-2 lg:grid-cols-6"
        method="get"
      >
        <Input
          aria-label="Buscar por nome ou e-mail"
          className="lg:col-span-2"
          defaultValue={params.search ?? ""}
          name="search"
          placeholder="Buscar por nome ou e-mail"
          type="search"
        />
        <select
          aria-label="Filtrar por papel"
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none"
          defaultValue={params.role ?? ""}
          name="role"
        >
          {roleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por status"
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none"
          defaultValue={params.status ?? ""}
          name="status"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por perfil completo"
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none"
          defaultValue={params.profileComplete === undefined ? "" : String(params.profileComplete)}
          name="profileComplete"
        >
          {booleanOptions("Perfil completo", "Perfil incompleto").map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por troca de senha pendente"
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none"
          defaultValue={params.mustChangePassword === undefined ? "" : String(params.mustChangePassword)}
          name="mustChangePassword"
        >
          {booleanOptions("Troca pendente", "Sem troca pendente").map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por desafio ativo"
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none"
          defaultValue={params.hasActiveChallenge === undefined ? "" : String(params.hasActiveChallenge)}
          name="hasActiveChallenge"
        >
          {booleanOptions("Com desafio ativo", "Sem desafio ativo").map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 lg:col-span-2">
          <Button size="md" type="submit">
            Filtrar
          </Button>
          <Button as="a" href="/admin/usuarios" size="md" variant="ghost">
            Limpar
          </Button>
        </div>
      </form>

      {error ? (
        <StatusCard description={error} title="Não foi possível listar" tone="error" />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState
          description="Nenhum usuário corresponde aos filtros atuais. Ajuste a busca ou crie o primeiro usuário manualmente."
          title="Nenhum usuário encontrado"
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-white/[0.08]">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.08em] text-muted-2">
              <tr>
                <th className="px-4 py-3 font-medium">
                  <AdminSortLink
                    basePath="/admin/usuarios"
                    currentSortBy={params.sortBy}
                    currentSortDir={params.sortDir}
                    label="Usuário"
                    searchParams={rawParams}
                    sortKey="name"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Papel</th>
                <th className="px-4 py-3 font-medium">
                  <AdminSortLink
                    basePath="/admin/usuarios"
                    currentSortBy={params.sortBy}
                    currentSortDir={params.sortDir}
                    label="Status"
                    searchParams={rawParams}
                    sortKey="status"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Onboarding</th>
                <th className="px-4 py-3 font-medium">Desafios ativos</th>
                <th className="px-4 py-3 font-medium">
                  <AdminSortLink
                    basePath="/admin/usuarios"
                    currentSortBy={params.sortBy}
                    currentSortDir={params.sortDir}
                    label="Criado em"
                    searchParams={rawParams}
                    sortKey="created_at"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {data.rows.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <Link
                      className="font-semibold text-foreground hover:text-action-soft focus-visible:outline-action-soft"
                      href={`/admin/usuarios/${user.id}`}
                    >
                      {user.display_name || user.name || user.email}
                    </Link>
                    <p className="truncate font-mono text-xs text-muted-2">{user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{roleLabels[user.role] ?? user.role}</td>
                  <td className="px-4 py-3 text-muted">{statusLabels[user.status] ?? user.status}</td>
                  <td className="px-4 py-3 text-muted">
                    {user.onboarding_completed ? "Completo" : "Pendente"}
                    {user.must_change_password ? (
                      <span className="ml-2 rounded-full bg-action/12 px-2 py-0.5 text-[0.65rem] font-semibold text-action-soft">
                        Troca pendente
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{user.active_challenge_count}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(user.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <UserRowActions
                      mustChangePassword={user.must_change_password}
                      redirectTo={redirectTo}
                      status={user.status}
                      userEmail={user.email}
                      userId={user.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalCount > ADMIN_USER_PAGE_SIZE ? (
        <AdminPagination
          basePath="/admin/usuarios"
          page={Math.min(params.page, getTotalPages(data.totalCount, ADMIN_USER_PAGE_SIZE))}
          searchParams={rawParams}
          totalPages={getTotalPages(data.totalCount, ADMIN_USER_PAGE_SIZE)}
        />
      ) : null}
    </div>
  );
}
