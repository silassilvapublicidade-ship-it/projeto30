# Projeto 30

Fundação técnica da plataforma de desafios de 30 dias para evolução integral:
corpo, mente, espírito, hábitos e propósito.

## Stack

- Next.js App Router
- React
- TypeScript estrito
- Tailwind CSS
- Supabase Auth, PostgreSQL, RLS e Storage preparado
- Zod para validação
- Vitest para regras de negócio
- Prettier e ESLint

## Executar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

A aplicação abre em `http://localhost:3000`.

Sem Supabase conectado, a tela de fundação carrega normalmente. Recursos de auth e
banco exigem preencher as variáveis em `.env.local`.

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run build
npm run verify
```

## Supabase

A estrutura inicial está em:

- `supabase/migrations/0001_initial_schema.sql`
- `supabase/seed.sql`

Quando o projeto Supabase existir, aplique a migration e depois rode o seed apenas em
ambiente de desenvolvimento.

## Documentação

- `docs/architecture.md`
- `docs/database.md`
- `docs/decisions.md`
- `docs/phase-1-acceptance.md`
