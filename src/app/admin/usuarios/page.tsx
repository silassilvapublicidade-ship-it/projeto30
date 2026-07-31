import type { Metadata } from "next";

import { AdminPagination } from "@/components/admin/admin-pagination";
import type { AdminSearchParams } from "@/components/admin/admin-query-utils";
import { buildAdminQuery } from "@/components/admin/admin-query-utils";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusCard } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import { getTotalPages } from "@/features/admin/admin-analytics.schemas";
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

const feedbackMessages: Record<string, { description: string; title: string }> = {
  invalid: { title: "Solicitação inválida", description: "Identificador de usuário ausente." },
  error: { title: "Não foi possível concluir", description: "A ação falhou. Tente novamente." },
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
};

type AdminUsersPageProps = {
  searchParams: Promise<AdminSearchParams>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const rawParams = await searchParams;
  const search = Array.isArray(rawParams.search) ? rawParams.search[0] : rawParams.search;
  const pageParam = Array.isArray(rawParams.page) ? rawParams.page[0] : rawParams.page;
  const page = Math.max(Number.parseInt(pageParam ?? "1", 10) || 1, 1);
  const feedbackKey = Array.isArray(rawParams.feedback) ? rawParams.feedback[0] : rawParams.feedback;
  const feedback = feedbackKey ? feedbackMessages[feedbackKey] : undefined;
  const redirectTo = `/admin/usuarios${buildAdminQuery(rawParams, { feedback: null })}`;

  const { data, error } = await listAdminUsers({ page, search });

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
            feedbackKey === "error" || feedbackKey === "invalid" || feedbackKey === "delete-self-blocked"
              ? "error"
              : feedbackKey === "create-success-enroll-failed"
                ? "warning"
                : "success"
          }
        />
      ) : null}

      <form
        className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:flex-row sm:items-center"
        method="get"
      >
        <Input
          aria-label="Buscar por nome ou e-mail"
          className="sm:max-w-xs"
          defaultValue={search ?? ""}
          name="search"
          placeholder="Buscar por nome ou e-mail"
          type="search"
        />
        <Button size="md" type="submit">
          Filtrar
        </Button>
        <Button as="a" href="/admin/usuarios" size="md" variant="ghost">
          Limpar
        </Button>
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
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.08em] text-muted-2">
              <tr>
                <th className="px-4 py-3 font-medium">Usuário</th>
                <th className="px-4 py-3 font-medium">Papel</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Onboarding</th>
                <th className="px-4 py-3 font-medium">Criado em</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {data.rows.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">
                      {user.display_name || user.name || user.email}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-2">{user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{roleLabels[user.role] ?? user.role}</td>
                  <td className="px-4 py-3 text-muted">{user.status}</td>
                  <td className="px-4 py-3 text-muted">
                    {user.onboarding_completed ? "Completo" : "Pendente"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(user.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <UserRowActions redirectTo={redirectTo} userEmail={user.email} userId={user.id} />
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
          page={Math.min(page, getTotalPages(data.totalCount, ADMIN_USER_PAGE_SIZE))}
          searchParams={rawParams}
          totalPages={getTotalPages(data.totalCount, ADMIN_USER_PAGE_SIZE)}
        />
      ) : null}
    </div>
  );
}
