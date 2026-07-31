import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { UserCreateForm } from "@/components/admin/user-create-form";
import { listPublishedChallengesForEnrollPicker } from "@/server/services/admin-users.service";

export const metadata: Metadata = {
  title: "Novo usuário · Administração",
};

export default async function NovoUsuarioPage() {
  const challenges = await listPublishedChallengesForEnrollPicker();

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href="/admin/usuarios"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para usuários
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">Novo usuário</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Crie a conta com e-mail e senha. Foto, objetivos, peso, altura e demais informações são
          preenchidos pelo próprio usuário na área de membros.
        </p>
      </div>

      <UserCreateForm challenges={challenges} />
    </div>
  );
}
