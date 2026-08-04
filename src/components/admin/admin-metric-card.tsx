export function AdminMetricCard({
  hint,
  label,
  value,
}: {
  hint?: string | undefined;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.035] p-4 shadow-[var(--shadow-hairline)] sm:p-5">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl text-foreground sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-muted-2">{hint}</p> : null}
    </div>
  );
}
