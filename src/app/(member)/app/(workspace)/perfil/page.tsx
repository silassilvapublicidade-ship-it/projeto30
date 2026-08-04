import { redirect } from "next/navigation";

/**
 * /app/perfil e agora um redirect permanente interno para /app/dashboard
 * (rodada de navegacao: o Dashboard de Evolucao Pessoal virou a rota
 * canonica). Preserva a query string para nao quebrar links/favoritos
 * antigos que ja incluiam filtros (?desafio=, ?periodo=, ?timeline=).
 */
export default async function PerfilRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      query.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    }
  }

  const queryString = query.toString();
  redirect(`/app/dashboard${queryString ? `?${queryString}` : ""}`);
}
