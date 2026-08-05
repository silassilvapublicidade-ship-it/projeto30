import { redirect } from "next/navigation";

/**
 * /app/leitura virou /app/biblioteca (Parte B) - redirect permanente para
 * preservar links antigos, mesmo padrão já usado em /app/perfil ->
 * /app/dashboard.
 */
export default function LeituraRedirectPage() {
  redirect("/app/biblioteca");
}
