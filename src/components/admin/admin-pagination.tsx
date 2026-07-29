import Link from "next/link";

import type { AdminSearchParams } from "@/components/admin/admin-query-utils";
import { buildAdminQuery } from "@/components/admin/admin-query-utils";
import { cn } from "@/lib/utils";

export function AdminPagination({
  basePath,
  page,
  searchParams,
  totalPages,
}: {
  basePath: string;
  page: number;
  searchParams: AdminSearchParams;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const linkClass =
    "rounded-[var(--radius-pill)] border border-white/[0.08] px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/[0.06] focus-visible:outline-action-soft";
  const disabledClass = "cursor-not-allowed opacity-35";

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="font-mono text-xs text-muted-2">
        Página {page} de {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            className={linkClass}
            href={`${basePath}${buildAdminQuery(searchParams, { page: String(page - 1) })}`}
          >
            Anterior
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(linkClass, disabledClass)}>
            Anterior
          </span>
        )}
        {page < totalPages ? (
          <Link
            className={linkClass}
            href={`${basePath}${buildAdminQuery(searchParams, { page: String(page + 1) })}`}
          >
            Próxima
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(linkClass, disabledClass)}>
            Próxima
          </span>
        )}
      </div>
    </nav>
  );
}
