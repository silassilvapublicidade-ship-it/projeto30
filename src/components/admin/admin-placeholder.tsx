import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminPlaceholder({
  description,
  eyebrow = "Fase A · Fundação administrativa",
  title,
}: {
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <Card tone="glass">
      <CardHeader>
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-action-soft">
          {eyebrow}
        </p>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
