export function getSafeNextPath(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string") {
    return "/app";
  }

  const nextPath = value.trim();

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/app";
  }

  if (nextPath.startsWith("/login") || nextPath.startsWith("/cadastro")) {
    return "/app";
  }

  return nextPath;
}

export function withNextParam(baseUrl: string, nextPath: string) {
  const url = new URL(baseUrl);
  url.searchParams.set("next", getSafeNextPath(nextPath));
  return url.toString();
}
