"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { recordProfileDashboardEventAction } from "@/features/member/profile-dashboard.actions";

/** CTA principal do bloco "Sua missão de hoje" (Parte A/F) - dispara dashboard_continue_day_clicked antes de navegar. */
export function DashboardMissionCtaLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Button
      as="a"
      className="w-full sm:w-auto"
      href={href}
      onClick={() => {
        void recordProfileDashboardEventAction("dashboard_continue_day_clicked");
      }}
      variant="primary"
    >
      {children}
    </Button>
  );
}
