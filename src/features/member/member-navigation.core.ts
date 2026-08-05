import {
  Bell,
  Download,
  Flag,
  Home,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  MessageCircle,
  MessagesSquare,
  Medal,
  NotebookPen,
  Route,
  Settings,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/**
 * Definição central da navegação da área de membros (Parte I). Desktop e
 * mobile usam ARQUITETURAS diferentes de propósito (sidebar completa vs.
 * barra de 5 itens + hub), mas ambas leem dos MESMOS itens abaixo - nunca
 * dois arrays divergentes descrevendo a mesma rota com labels/hrefs que
 * podem sair de sincronia. `adminOnly` e `special` centralizam também a
 * regra de permissão e os dois casos que não são um link simples
 * (instalar app é um widget condicional, sair é uma ação de formulário).
 */
export type MemberNavItem = {
  adminOnly?: boolean;
  description?: string;
  href?: string;
  icon: LucideIcon;
  label: string;
  special?: "install-app" | "sign-out";
};

export type MemberNavGroup = {
  items: MemberNavItem[];
  title: string;
};

export const DASHBOARD_ITEM: MemberNavItem = { href: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard" };
export const HOJE_ITEM: MemberNavItem = { href: "/app/hoje", icon: Home, label: "Hoje" };
export const JORNADA_ITEM: MemberNavItem = { href: "/app/jornada", icon: Route, label: "Jornada" };
export const DESAFIOS_ITEM: MemberNavItem = { href: "/app/desafios", icon: Flag, label: "Desafios" };
export const DICAS_ITEM: MemberNavItem = { href: "/app/dicas", icon: Lightbulb, label: "Dicas" };
export const CONQUISTAS_ITEM: MemberNavItem = { href: "/app/conquistas", icon: Medal, label: "Conquistas" };
export const DIARIO_ITEM: MemberNavItem = { href: "/app/diario", icon: NotebookPen, label: "Diário" };
export const ENVIAR_FEEDBACK_ITEM: MemberNavItem = {
  href: "/app/feedback",
  icon: MessageCircle,
  label: "Enviar feedback",
};
export const MEUS_FEEDBACKS_ITEM: MemberNavItem = {
  href: "/app/feedback/meus",
  icon: MessagesSquare,
  label: "Meus feedbacks",
};
export const NOTIFICACOES_ITEM: MemberNavItem = { href: "/app/notificacoes", icon: Bell, label: "Notificações" };
export const CONFIGURACOES_ITEM: MemberNavItem = { href: "/app/configuracoes", icon: Settings, label: "Configurações" };
export const EDITAR_PERFIL_ITEM: MemberNavItem = { href: "/app/perfil/editar", icon: UserRound, label: "Editar perfil" };
export const INSTALAR_APP_ITEM: MemberNavItem = {
  icon: Download,
  label: "Instalar Projeto 30",
  special: "install-app",
};
export const ADMIN_ITEM: MemberNavItem = {
  adminOnly: true,
  href: "/admin",
  icon: ShieldCheck,
  label: "Área administrativa",
};
export const SAIR_ITEM: MemberNavItem = { icon: LogOut, label: "Sair", special: "sign-out" };

/** Barra inferior mobile - exatamente 4 itens de uso diário; "Mais" é
 * tratado à parte pelos componentes (sua ativação depende de um conjunto
 * de rotas, não de um único href). */
export const PRIMARY_MOBILE_ITEMS: MemberNavItem[] = [DASHBOARD_ITEM, HOJE_ITEM, JORNADA_ITEM, DESAFIOS_ITEM];

/** Sidebar desktop completa (Parte B) - aproveita o espaço disponível
 * para dar acesso direto a tudo, sem depender do hub Mais para uso
 * frequente. */
export const DESKTOP_SIDEBAR_GROUPS: MemberNavGroup[] = [
  { items: [DASHBOARD_ITEM, HOJE_ITEM, DESAFIOS_ITEM, JORNADA_ITEM, DICAS_ITEM], title: "Principal" },
  { items: [CONQUISTAS_ITEM, DIARIO_ITEM], title: "Minha evolução" },
  {
    items: [ENVIAR_FEEDBACK_ITEM, MEUS_FEEDBACKS_ITEM, NOTIFICACOES_ITEM, CONFIGURACOES_ITEM],
    title: "Suporte e conta",
  },
  { items: [EDITAR_PERFIL_ITEM, INSTALAR_APP_ITEM, ADMIN_ITEM, SAIR_ITEM], title: "Conta" },
];

/** Hub /app/mais (Parte D) - tudo que a barra mobile não mostra direto,
 * com a cópia exata pedida por item importante. */
export const MORE_HUB_GROUPS: MemberNavGroup[] = [
  {
    items: [
      { ...DICAS_ITEM, description: "Conteúdos para apoiar sua jornada." },
      { ...CONQUISTAS_ITEM, description: "Veja seus marcos e compartilhamentos." },
      { ...DIARIO_ITEM, description: "Relembre suas reflexões e registros." },
    ],
    title: "Minha evolução",
  },
  {
    items: [
      { ...ENVIAR_FEEDBACK_ITEM, description: "Encontrou um problema ou teve uma ideia?" },
      { ...MEUS_FEEDBACKS_ITEM, description: "Acompanhe seus relatos e respostas." },
    ],
    title: "Suporte",
  },
  {
    items: [
      { ...EDITAR_PERFIL_ITEM, description: "Atualize sua foto e informações pessoais." },
      { ...CONFIGURACOES_ITEM, description: "Gerencie sua conta e preferências." },
      { ...NOTIFICACOES_ITEM, description: "Escolha quais lembretes deseja receber." },
    ],
    title: "Conta e preferências",
  },
  { items: [INSTALAR_APP_ITEM], title: "Aplicativo" },
  { items: [ADMIN_ITEM], title: "Área administrativa" },
  { items: [SAIR_ITEM], title: "Sessão" },
];

/** Toda rota que só é alcançável a partir do hub /app/mais no mobile -
 * usada para acender o item "Mais" quando o usuário está em qualquer
 * uma delas, em vez da barra parecer "sem seleção" nessas telas. */
export const MAIS_ACTIVE_PREFIXES = [
  "/app/mais",
  "/app/conquistas",
  "/app/diario",
  "/app/dicas",
  "/app/configuracoes",
  "/app/feedback",
  "/app/perfil",
  "/app/notificacoes",
];

/** Route matching centralizado (Parte I): exato ou prefixo de segmento
 * (nunca prefixo de string solto - "/app/hoje" não deve casar com um
 * futuro "/app/hojexyz"). Query strings nunca entram aqui porque
 * usePathname() do Next.js já não as inclui. */
export function isMemberRouteActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isMaisActive(pathname: string): boolean {
  return MAIS_ACTIVE_PREFIXES.some((prefix) => isMemberRouteActive(pathname, prefix));
}

/** Regra de permissão centralizada (Parte J): remove itens adminOnly para
 * quem não é admin/super_admin - nunca escondido só via CSS, o item nem
 * é renderizado. */
export function filterNavItemsByRole(items: MemberNavItem[], isAdmin: boolean): MemberNavItem[] {
  return items.filter((item) => !item.adminOnly || isAdmin);
}

export function filterNavGroupsByRole(groups: MemberNavGroup[], isAdmin: boolean): MemberNavGroup[] {
  return groups
    .map((group) => ({ ...group, items: filterNavItemsByRole(group.items, isAdmin) }))
    .filter((group) => group.items.length > 0);
}
