export const colorTokens = [
  { name: "Black", value: "#050505", role: "Base fosca do produto" },
  { name: "Matte", value: "#090A0B", role: "Fundos profundos" },
  { name: "Graphite", value: "#111418", role: "Superficie primaria" },
  { name: "Surface", value: "#1D2228", role: "Camadas e containers" },
  { name: "White", value: "#F8F6F1", role: "Texto principal" },
  { name: "Muted", value: "#B7B4AC", role: "Texto secundario" },
  { name: "Muted 2", value: "#7C838B", role: "Texto discreto" },
  { name: "Orange", value: "#FF6A00", role: "Accent principal (acao e progresso)" },
  { name: "Orange Soft", value: "#FF9A3D", role: "Foco, realce e focus ring" },
  {
    name: "Amber",
    value: "#F2A93B",
    role: "Accent secundario (dourado - profundidade, progresso, conquista)",
  },
  { name: "Amber Soft", value: "#FFCB73", role: "Realce dourado sobre fundo escuro" },
  { name: "Silver", value: "#C9CDD3", role: "Neutro metalico, uso discreto" },
  { name: "Success", value: "#83D9A3", role: "Estado de sucesso" },
  { name: "Warning", value: "#FFD166", role: "Estado de aviso" },
  { name: "Danger / Error", value: "#FF7A70", role: "Estado de erro" },
  { name: "Info", value: "#6BB8E0", role: "Estado informativo" },
] as const;

export const semanticSurfaceTokens = [
  { name: "surface-base", value: "var(--p30-black)", role: "Background principal" },
  {
    name: "surface-elevated",
    value: "var(--p30-graphite)",
    role: "Background elevado (paineis, cards soft)",
  },
  {
    name: "surface-subtle",
    value: "rgba(255,255,255,0.04)",
    role: "Background sutil (blocos discretos)",
  },
  {
    name: "surface-translucent",
    value: "rgba(255,255,255,0.055)",
    role: "Superficie translucida (glass, com backdrop-blur)",
  },
  { name: "border-subtle", value: "rgba(255,255,255,0.08)", role: "Borda sutil padrao" },
  {
    name: "border-active",
    value: "rgba(255,255,255,0.18)",
    role: "Borda em estado ativo/hover",
  },
  {
    name: "focus-ring",
    value: "var(--p30-orange-soft)",
    role: "Cor do anel de foco (:focus-visible)",
  },
  {
    name: "overlay-scrim",
    value: "rgba(5,5,5,0.64)",
    role: "Overlay padrao para modais/sheets",
  },
  {
    name: "overlay-scrim-strong",
    value: "rgba(5,5,5,0.82)",
    role: "Overlay reforcado (conteudo critico)",
  },
] as const;

export const gradientTokens = [
  {
    name: "gradient-accent",
    value: "linear-gradient(90deg, var(--p30-orange), var(--p30-amber))",
    role: "Destaque principal (progress fill, CTAs de celebracao)",
  },
  {
    name: "gradient-accent-soft",
    value:
      "linear-gradient(135deg, rgba(255,106,0,0.16), rgba(242,169,59,0.10))",
    role: "Fundo suave de blocos de destaque",
  },
  {
    name: "glow-amber",
    value: "radial-gradient(circle, rgba(242,169,59,0.35), transparent 70%)",
    role: "Halo radial - hero, conquistas, celebracao",
  },
  {
    name: "shadow-glow-accent",
    value: "0 0 60px rgba(242,169,59,0.30)",
    role: "Glow reservado para hero, progresso, estados ativos e conquistas",
  },
] as const;

export const typeScaleTokens = [
  { name: "display-hero", value: "4.5rem / 1.02", role: "Hero da landing" },
  { name: "display-day", value: "3.5rem / 1.05", role: "Numero do dia em destaque" },
  { name: "headline", value: "2.25rem / 1.15", role: "Titulos de secao" },
  { name: "title", value: "1.5rem / 1.3", role: "Titulos de card/bloco" },
  { name: "subtitle", value: "1.125rem / 1.5", role: "Subtitulos" },
  { name: "body", value: "1rem / 1.7", role: "Texto corrido" },
  { name: "small", value: "0.875rem / 1.6", role: "Texto secundario" },
  { name: "caption", value: "0.75rem / 1.5", role: "Legendas" },
  { name: "label", value: "0.68rem / 1.4", role: "Rotulos mono uppercase" },
  { name: "numeric-display", value: "3rem / 1", role: "Numeros grandes (streak, pontos)" },
  { name: "mono-data", value: "0.875rem / 1.4", role: "Dados tabulares/mono" },
] as const;

export const spacingTokens = [
  { name: "2", value: "8px", role: "Agrupamentos compactos" },
  { name: "3", value: "12px", role: "Controles internos" },
  { name: "4", value: "16px", role: "Ritmo base mobile" },
  { name: "6", value: "24px", role: "Blocos de formulario" },
  { name: "8", value: "32px", role: "Secoes pequenas" },
  { name: "12", value: "48px", role: "Respiro entre secoes" },
] as const;

export const layoutTokens = [
  { name: "container-content", value: "72rem", role: "Largura maxima de conteudo padrao" },
  { name: "container-narrow", value: "48rem", role: "Formularios e blocos focados" },
  { name: "container-reading", value: "42rem", role: "Largura ideal de leitura longa" },
  { name: "space-mobile-margin", value: "16px", role: "Margem lateral mobile" },
  { name: "space-desktop-margin", value: "32px", role: "Margem lateral desktop" },
  { name: "nav-bottom-height", value: "76px", role: "Altura da navegacao inferior" },
] as const;

export const radiusTokens = [
  { name: "Control", value: "16px", role: "Inputs e campos" },
  { name: "Card", value: "8px", role: "Superficies de conteudo" },
  { name: "Panel", value: "28px", role: "Paineis e sheets grandes (fundacao futura)" },
  { name: "Pill", value: "999px", role: "Acoes e badges" },
  { name: "Circle", value: "rounded-full (Tailwind)", role: "Avatares e icones circulares" },
] as const;

export const elevationTokens = [
  { name: "Hairline", value: "inset 0 0 0 1px", role: "Separacao sutil" },
  { name: "Soft", value: "0 20px 80px", role: "Glass leve" },
  { name: "Lift", value: "0 24px 90px", role: "Dialogos e sheets" },
  {
    name: "Glow accent",
    value: "0 0 60px rgba(242,169,59,0.30)",
    role: "Reservado para hero/progresso/conquistas",
  },
] as const;

export const motionTokens = [
  { name: "Fast", value: "140ms", role: "Feedback imediato / press" },
  { name: "Base", value: "220ms", role: "Hover, focus e controles" },
  { name: "Slow", value: "420ms", role: "Progresso, entrance e surfaces" },
  { name: "Reveal", value: "560ms", role: "Revelacao de conteudo (scroll futuro)" },
  { name: "Celebration", value: "900ms", role: "Celebracao (token preparado, nao aplicado ainda)" },
  { name: "Ease premium", value: "cubic-bezier(0.2, 0.8, 0.2, 1)", role: "Movimento premium (hero/emphasis)" },
  { name: "Ease standard", value: "cubic-bezier(0.4, 0, 0.2, 1)", role: "Transicoes utilitarias simples" },
] as const;
