-- Parte G/24 - admin_audit_logs.ip (inet, nullable, sem indice) existe
-- desde 0001_initial_schema.sql e NUNCA foi escrita: busca exaustiva em
-- todas as migrations (9 pontos de "insert into public.admin_audit_logs"
-- em SQL) e em todo o src/ (6 pontos de
-- supabase.from("admin_audit_logs").insert(...) em TypeScript) confirma
-- zero ocorrencias de um campo "ip" sendo passado em qualquer um deles.
-- Sem uso real e sem plano imediato de uso - removida por preferencia
-- explicita do usuario (Parte 24: "remover se nao houver uso real").
alter table public.admin_audit_logs
  drop column if exists ip;
