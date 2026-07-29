export type AdminSearchParams = Record<string, string | string[] | undefined>;

/**
 * Builds a query string from the current search params, applying overrides
 * and dropping any key set to null/undefined/empty. Used by pagination and
 * sort links so they preserve the other active filters.
 */
export function buildAdminQuery(
  searchParams: AdminSearchParams,
  overrides: Record<string, string | null | undefined>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key in overrides) {
      continue;
    }

    const resolved = Array.isArray(value) ? value[0] : value;

    if (resolved) {
      params.set(key, resolved);
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}
