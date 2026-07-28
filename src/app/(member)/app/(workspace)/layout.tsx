import type { ReactNode } from "react";

import { MemberShell } from "@/components/member/member-shell";
import { requireOnboardedMember } from "@/server/services/member-area.service";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const context = await requireOnboardedMember();

  return <MemberShell context={context}>{children}</MemberShell>;
}
