import type { ReactNode } from "react";

import { PublicFooter } from "@/components/public/public-chrome";
import { PublicHeader } from "@/components/public/public-header";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
