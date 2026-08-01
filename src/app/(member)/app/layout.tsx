import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getMustChangePasswordFlag, requireAuthUser } from "@/server/services/auth-session.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Area de membros",
  description: "Ambiente privado do Projeto 30 para acompanhar sua jornada.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireAuthUser("/app");

  // Checked on every request to /app/* (Server Component, no client-side
  // trust): /primeiro-acesso itself lives outside this route tree
  // ((auth) route group), so there's no loop to guard against here.
  if (await getMustChangePasswordFlag(user.id)) {
    redirect("/primeiro-acesso");
  }

  return children;
}
