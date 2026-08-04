"use client";

import type { ReactNode } from "react";

import { recordProfileDashboardEventAction } from "@/features/member/profile-dashboard.actions";

/**
 * profile_achievement_shared (Parte 21) - context-attribution de que o
 * compartilhamento começou a partir do dashboard do Perfil, distinto dos
 * eventos share_achievement_started/completed que os próprios botões já
 * registram (esses continuam existindo sem alteração, nunca duplicados -
 * este evento novo só marca a ORIGEM do clique). Usa event bubbling: o
 * clique real no botão de compartilhar dentro deste wrapper sobe até aqui.
 */
export function ProfileAchievementShareTracker({ children }: { children: ReactNode }) {
  return (
    <div
      className="contents"
      onClick={() => {
        void recordProfileDashboardEventAction("profile_achievement_shared");
      }}
    >
      {children}
    </div>
  );
}
