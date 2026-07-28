# Decisões Técnicas

## ADR-001: Next.js App Router

Decisão: usar Next.js App Router com TypeScript estrito.

Motivo: combina SSR, Server Components, Server Actions, Route Handlers e deploy
natural na Vercel.

## ADR-002: Supabase como backend inicial

Decisão: usar Supabase Auth, PostgreSQL, RLS e Storage preparado.

Motivo: reduz infraestrutura inicial, oferece autenticação segura e permite modelar
regras de acesso no banco desde o começo.

## ADR-003: Escritas sensíveis pelo servidor

Decisão: bloquear escritas diretas do cliente para logs de jornada, diário, pontos,
sequência e conquistas.

Motivo: pontos, sequência e permissões não podem ser manipulados via API pública.
As mutações futuras devem passar por serviços server-only.

## ADR-004: Zod para ambiente e entrada

Decisão: validar variáveis de ambiente e entradas de auth com Zod.

Motivo: falhas de configuração devem aparecer com mensagens explícitas e sem expor
segredos.

## ADR-005: Tailwind v4 com tokens CSS

Decisão: manter tokens visuais em `globals.css` usando `@theme inline`.

Motivo: o scaffold atual usa Tailwind v4; tokens em CSS reduzem configuração
desnecessária e mantêm a identidade preta, grafite, branca e laranja.

## ADR-006: Núcleo puro + services server-only

Decisão: separar funções puras de regra em `src/features` e adaptadores server-only em
`src/server/services`.

Motivo: as regras ficam testáveis sem banco e continuam reservadas ao servidor quando
usadas pela aplicação.

## ADR-007: Google preparado, mas não ativado

Decisão: deixar a arquitetura de callback compatível com OAuth, mas implementar nesta
fase apenas e-mail/senha e magic link.

Motivo: segue a prioridade aprovada e evita configuração externa antes de existir
projeto Supabase.
