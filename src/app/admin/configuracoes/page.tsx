import { redirect } from "next/navigation";

/**
 * Parte F - /admin/configuracoes era um placeholder puro, sem nenhum valor
 * real por trás. Auditado o que faria sentido nele (identidade do app,
 * mensagens padrão, links públicos, limites de geração de IA, versão/
 * ambiente): versão/ambiente já vive em /admin e /admin/observabilidade;
 * limites de geração são uma constante de segurança que deve permanecer em
 * código (nunca editável sem revisão); o resto (nome do app, links
 * institucionais, mensagens padrão) não tem nenhum dado real por trás hoje
 * - criar uma tabela só para guardar esse punhado de textos livres seria
 * "configuração para valores que deveriam ficar em código" ou, pior, JSON
 * livre. Sem necessidade real comprovada, a rota some do menu (ver
 * admin-navigation.tsx) e vira só um redirect - nunca uma tela vazia.
 */
export default function AdminConfiguracoesPage() {
  redirect("/admin");
}
