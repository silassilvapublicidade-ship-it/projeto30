import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";

import type { AdminSearchParams } from "@/components/admin/admin-query-utils";
import { buildAdminQuery } from "@/components/admin/admin-query-utils";
import { cn } from "@/lib/utils";

export function AdminSortLink({
  basePath,
  currentSortBy,
  currentSortDir,
  label,
  searchParams,
  sortKey,
}: {
  basePath: string;
  currentSortBy: string;
  currentSortDir: "asc" | "desc";
  label: string;
  searchParams: AdminSearchParams;
  sortKey: string;
}) {
  const isActive = currentSortBy === sortKey;
  const nextDir = isActive && currentSortDir === "desc" ? "asc" : "desc";
  const href = `${basePath}${buildAdminQuery(searchParams, {
    page: null,
    sortBy: sortKey,
    sortDir: nextDir,
  })}`;

  return (
    <Link
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-foreground focus-visible:outline-action-soft",
        isActive ? "text-foreground" : "text-muted-2",
      )}
      href={href}
    >
      {label}
      {isActive ? (
        currentSortDir === "desc" ? (
          <ArrowDown aria-hidden="true" size={12} />
        ) : (
          <ArrowUp aria-hidden="true" size={12} />
        )
      ) : null}
    </Link>
  );
}
