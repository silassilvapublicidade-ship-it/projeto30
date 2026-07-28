import type { ReactNode } from "react";

import { PublicFooter, PublicHeader } from "@/components/public/public-chrome";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
