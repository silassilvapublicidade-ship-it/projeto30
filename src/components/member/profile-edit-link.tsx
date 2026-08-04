"use client";

import { Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { recordProfileDashboardEventAction } from "@/features/member/profile-dashboard.actions";

/**
 * "Editar perfil" nunca fica escondido (Parte 14) - botão sempre visível no
 * cabeçalho do dashboard. Analytics best-effort, nunca bloqueia a
 * navegação (o Link/Button navega imediatamente; o evento é disparado em
 * paralelo, não aguardado).
 */
export function ProfileEditLink() {
  return (
    <Button
      as="a"
      className="shrink-0"
      href="/app/perfil/editar"
      leadingIcon={<Settings aria-hidden="true" size={14} />}
      onClick={() => {
        void recordProfileDashboardEventAction("profile_edit_clicked");
      }}
      size="sm"
      variant="secondary"
    >
      Editar perfil
    </Button>
  );
}
