import type { Metadata } from "next";
import type { ReactNode } from "react";

import { requireAuthUser } from "@/server/services/auth-session.service";

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
  await requireAuthUser("/app");

  return children;
}
