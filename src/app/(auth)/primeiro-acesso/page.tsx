import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { AuthLink, AuthShell } from "@/components/auth/auth-shell";
import { FirstAccessForm } from "@/components/auth/first-access-form";
import { requiresPasswordReauth } from "@/features/auth/auth.core";
import { signOutAndRedirectAction } from "@/features/auth/auth.actions";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getMustChangePasswordFlag,
  requireAuthUser,
} from "@/server/services/auth-session.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Primeiro acesso",
  description: "Defina uma nova senha para continuar no Projeto 30.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function PrimeiroAcessoPage() {
  const user = await requireAuthUser("/primeiro-acesso");

  // Not a security boundary (the account gate is what matters), just
  // keeping this screen from being reachable/useful once it's not needed.
  if (!(await getMustChangePasswordFlag(user.id))) {
    redirect("/app");
  }

  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const needsCurrentPassword = requiresPasswordReauth(claimsData?.claims?.amr);

  return (
    <AuthShell
      cardDescription="Por segurança, defina uma nova senha antes de continuar para sua área de membros."
      cardTitle="Primeiro acesso"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AuthLink href="/faq">Precisa de ajuda?</AuthLink>
          <form action={signOutAndRedirectAction}>
            <Button
              leadingIcon={<LogOut aria-hidden="true" size={15} />}
              size="sm"
              type="submit"
              variant="ghost"
            >
              Sair
            </Button>
          </form>
        </div>
      }
    >
      <FirstAccessForm needsCurrentPassword={needsCurrentPassword} />
    </AuthShell>
  );
}
