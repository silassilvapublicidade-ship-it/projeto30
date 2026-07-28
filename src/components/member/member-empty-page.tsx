import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";

export function MemberEmptyPage({
  children,
  description,
  icon: Icon,
  title,
}: {
  children?: ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="space-y-6">
      <section className="max-w-3xl">
        <span className="flex size-12 items-center justify-center rounded-full bg-action/12 text-action-soft">
          <Icon aria-hidden="true" size={22} />
        </span>
        <h1 className="mt-5 font-display text-5xl leading-[1.02] text-foreground sm:text-6xl">
          {title}
        </h1>
        <p className="mt-5 text-base leading-8 text-muted">{description}</p>
      </section>

      {children ?? (
        <Card className="p-4 sm:p-6">
          <EmptyState
            description="Quando houver algo novo para acompanhar, esta área vai mostrar apenas dados reais da sua jornada."
            title="Ainda sem conteúdo"
          />
        </Card>
      )}
    </div>
  );
}
