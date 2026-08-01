import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminMetricCard } from "@/components/admin/admin-metric-card";
import { UserDetailActions } from "@/components/admin/user-detail-actions";
import { UserEditForm } from "@/components/admin/user-edit-form";
import { StatusCard } from "@/components/ui/feedback";
import {
  getAdminUserDetail,
  listPublishedChallengesForEnrollPicker,
} from "@/server/services/admin-users.service";
import { requireAdminUser } from "@/server/services/admin-session.service";

export const metadata: Metadata = {
  title: "Detalhe do usuário · Administração",
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

const enrollmentStatusLabels: Record<string, string> = {
  abandoned: "Abandonado",
  active: "Ativo",
  completed: "Concluído",
  paused: "Pausado",
  restarted: "Reiniciado",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

type UserDetailPageProps = {
  params: Promise<{ userId: string }>;
};

export default async function AdminUserDetailPage({ params }: UserDetailPageProps) {
  const { userId } = await params;
  const [admin, { data, error }, publishedChallenges] = await Promise.all([
    requireAdminUser(),
    getAdminUserDetail(userId),
    listPublishedChallengesForEnrollPicker(),
  ]);

  if (error) {
    return <StatusCard description={error} title="Não foi possível carregar" tone="error" />;
  }

  if (!data) {
    notFound();
  }

  const { achievements, enrollments, profile, recent_audit_logs: auditLogs } = data;
  const isSelf = profile.id === admin.id;
  const canChangeRole = admin.role === "super_admin";
  const activeEnrollmentIds = new Set(
    enrollments.filter((enrollment) => enrollment.status === "active" || enrollment.status === "paused")
      .map((enrollment) => enrollment.challenge_id),
  );
  const availableChallenges = publishedChallenges.filter(
    (challenge) => !activeEnrollmentIds.has(challenge.id),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href="/admin/usuarios"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para usuários
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="break-words text-2xl font-semibold text-foreground">
            {profile.display_name || profile.name || profile.email}
          </h1>
          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-muted">
            {roleLabels[profile.role] ?? profile.role}
          </span>
          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-muted">
            {statusLabels[profile.status] ?? profile.status}
          </span>
          {profile.must_change_password ? (
            <span className="rounded-full bg-action/12 px-2.5 py-1 text-xs font-semibold text-action-soft">
              Troca de senha pendente
            </span>
          ) : null}
        </div>
        <p className="mt-1 break-all font-mono text-xs text-muted-2">{profile.email}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <AdminMetricCard label="Desafios ativos" value={String(activeEnrollmentIds.size)} />
        <AdminMetricCard label="Conquistas desbloqueadas" value={String(achievements.length)} />
        <AdminMetricCard label="Criado em" value={formatDate(profile.created_at)} />
      </div>

      <section className="space-y-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
        <h2 className="text-sm font-semibold text-foreground">Dados básicos</h2>
        <p className="text-xs leading-5 text-muted-2">
          Foto, objetivos, peso, altura e demais informações de perfil são preenchidos pelo próprio usuário na
          área de membros.
        </p>
        <UserEditForm city={profile.city} displayName={profile.display_name} name={profile.name} userId={profile.id} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="space-y-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold text-foreground">Desafios (atuais e histórico)</h2>
            {enrollments.length === 0 ? (
              <p className="text-xs leading-5 text-muted-2">Nenhuma inscrição ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.08em] text-muted-2">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Desafio</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Progresso</th>
                      <th className="py-2 pr-3 font-medium">Pontos</th>
                      <th className="py-2 pr-3 font-medium">Sequência</th>
                      <th className="py-2 pr-3 font-medium">Entrou em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {enrollments.map((enrollment) => (
                      <tr key={enrollment.enrollment_id}>
                        <td className="py-2 pr-3 font-semibold text-foreground">{enrollment.challenge_name}</td>
                        <td className="py-2 pr-3 text-muted">
                          {enrollmentStatusLabels[enrollment.status] ?? enrollment.status}
                        </td>
                        <td className="py-2 pr-3 text-muted">{enrollment.completion_percent}%</td>
                        <td className="py-2 pr-3 text-muted">{enrollment.points_total}</td>
                        <td className="py-2 pr-3 text-muted">
                          {enrollment.streak_current} (melhor: {enrollment.streak_best})
                        </td>
                        <td className="py-2 pr-3 text-muted">{formatDate(enrollment.joined_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold text-foreground">Conquistas</h2>
            {achievements.length === 0 ? (
              <p className="text-xs leading-5 text-muted-2">Nenhuma conquista desbloqueada ainda.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {achievements.map((achievement) => (
                  <li
                    className="rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.03] p-3"
                    key={achievement.user_achievement_id}
                  >
                    <p className="text-sm font-semibold text-foreground">{achievement.name}</p>
                    <p className="text-xs text-muted-2">
                      {achievement.category} · {achievement.rarity} · {formatDate(achievement.unlocked_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold text-foreground">Auditoria recente</h2>
            {auditLogs.length === 0 ? (
              <p className="text-xs leading-5 text-muted-2">Nenhuma ação administrativa registrada ainda.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {auditLogs.map((log, index) => (
                  <li className="flex items-center justify-between gap-3 text-muted" key={`${log.action}-${index}`}>
                    <span>{log.action}</span>
                    <span className="text-xs text-muted-2">{formatDate(log.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <UserDetailActions
          canChangeRole={canChangeRole}
          currentRole={profile.role}
          currentStatus={profile.status}
          isSelf={isSelf}
          mustChangePassword={profile.must_change_password}
          publishedChallenges={availableChallenges}
          redirectTo={`/admin/usuarios/${profile.id}`}
          userEmail={profile.email}
          userId={profile.id}
        />
      </div>
    </div>
  );
}
