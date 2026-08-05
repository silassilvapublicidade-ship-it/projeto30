import Link from "next/link";
import type { Metadata } from "next";

import { StorageAuditPanel } from "@/components/admin/storage-audit-panel";
import { StatusCard } from "@/components/ui/feedback";
import { requireAdminUser } from "@/server/services/admin-session.service";

export const metadata: Metadata = {
  title: "Auditoria de Storage · Administração",
};

export default async function StorageAuditPage() {
  const admin = await requireAdminUser();
  const isSuperAdmin = admin.role === "super_admin";

  return (
    <div className="space-y-5">
      <div>
        <Link className="text-xs text-muted-2 hover:text-foreground" href="/admin/observabilidade">
          ← Central Operacional
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Auditoria de Storage</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Leitura sob demanda dos 5 buckets reais do projeto. Nada é excluído automaticamente.
        </p>
      </div>

      {!isSuperAdmin ? (
        <StatusCard
          description="Qualquer admin pode executar a auditoria (somente leitura). A limpeza de arquivos órfãos é exclusiva de super administradores."
          title="Visão limitada"
          tone="warning"
        />
      ) : null}

      <StorageAuditPanel canCleanup={isSuperAdmin} />
    </div>
  );
}
