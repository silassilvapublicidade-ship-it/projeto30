export type AdminBarListItem = {
  label: string;
  trailingLabel: string;
  value: number;
};

export function AdminBarList({ items }: { items: AdminBarListItem[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li className="flex items-center gap-3" key={item.label}>
          <span className="w-28 shrink-0 truncate font-mono text-xs text-muted-2">
            {item.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--p30-orange),var(--p30-amber))]"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right font-mono text-xs text-foreground">
            {item.trailingLabel}
          </span>
        </li>
      ))}
    </ul>
  );
}
