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

## ADR-008: Analytics administrativo via funções SQL security definer

Decisão: implementar toda a agregação do painel administrativo (Fase 2) como funções
`security definer` em `supabase/migrations/0006_admin_analytics.sql`
(`admin_dashboard_overview`, `admin_list_challenges`, `admin_challenge_detail`,
`admin_list_participants`, `admin_participant_detail`), cada uma validando
`public.is_admin()` explicitamente no corpo da função antes de devolver qualquer
dado, e não como views ou queries agregadas montadas no cliente.

Motivo: as RLS existentes ("Admins can manage X") já liberam leitura ampla para
`admin`/`super_admin`, mas uma `view` com `security_invoker` herdaria a RLS de cada
tabela isoladamente — um usuário comum que consultasse a view receberia agregados
calculados só sobre as linhas que ele mesmo pode ver (ex.: a própria inscrição),
não um erro de acesso negado. Isso vazaria números incorretos em vez de bloquear.
Funções `security definer` com checagem explícita de `is_admin()` seguem o mesmo
padrão já usado pelas RPCs de jornada (`0002_daily_journey_core.sql`) e garantem que
sem o papel correto a função sempre lança `42501`, nunca devolve dado parcial.
Ver `docs/admin-analytics.md` para as fórmulas e o contrato de cada função.

## ADR-009: Bucket de avatars público para leitura

Decisão: em `supabase/migrations/0007_profile_avatars.sql`, o bucket `avatars`
é criado com `public = true` (leitura). Escrita, atualização e remoção
continuam restritas ao próprio dono via RLS em `storage.objects`.

Motivo: não havia bucket nem política anterior para reutilizar (auditado antes
de criar). Fotos de perfil não são dado sensível como o diário — exibir um
avatar não deveria depender de gerar e renovar URLs assinadas só para um
`<img>`. A escrita continua real e estritamente restrita por RLS
(`(storage.foldername(name))[1] = auth.uid()::text`), então tornar a leitura
pública não abre brecha para um usuário alterar ou remover o avatar de outro.

## ADR-010: Troca de senha com reautenticação real, não checagem simulada

Decisão: a "senha atual" no formulário de segurança do perfil é validada
chamando `supabase.auth.signInWithPassword({ email, password })` antes de
`updateUser({ password })`, em vez de qualquer verificação client-side ou
simulada.

Motivo: o Supabase Auth (GoTrue) não expõe um endpoint dedicado para só
verificar a senha atual sem afetar sessão/rate limit. Reautenticar com
`signInWithPassword` é a única forma real de confirmar a senha atual contra o
GoTrue antes de trocá-la — uma falha nessa chamada significa senha incorreta,
nunca um "sim" fabricado no código da aplicação.
