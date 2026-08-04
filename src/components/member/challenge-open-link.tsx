"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { recordProfileDashboardEventAction } from "@/features/member/profile-dashboard.actions";

/** CTA de um card de "Meus desafios" (Parte 6/21) - dispara profile_challenge_opened antes de navegar. */
export function ChallengeOpenLink({
  challengeId,
  children,
  enrollmentId,
  href,
}: {
  challengeId: string;
  children: ReactNode;
  enrollmentId: string;
  href: string;
}) {
  return (
    <Button
      as="a"
      className="w-full"
      href={href}
      onClick={() => {
        void recordProfileDashboardEventAction("profile_challenge_opened", { challengeId, enrollmentId });
      }}
      size="sm"
      variant="secondary"
    >
      {children}
    </Button>
  );
}
