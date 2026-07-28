import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminUser } from "@/server/services/admin-session.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administração",
  description: "Painel administrativo interno do Projeto 30.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdminUser();

  return <AdminShell admin={admin}>{children}</AdminShell>;
}
