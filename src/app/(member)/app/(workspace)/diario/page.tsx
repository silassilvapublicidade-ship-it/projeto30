import Link from "next/link";
import { Lock, NotebookPen } from "lucide-react";

import { MemberEmptyPage } from "@/components/member/member-empty-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { describeDailyLogStatus } from "@/features/admin/admin-metrics.core";
import { journalEntryHasContent, listJournalChallenges, listJournalEntries } from "@/server/services/journal.service";

const PAGE_SIZE = 10;
const PERIOD_OPTIONS = [
  { label: "Todo o período", value: "" },
  { label: "Últimos 7 dias", value: "7" },
  { label: "Últimos 30 dias", value: "30" },
  { label: "Últimos 90 dias", value: "90" },
];

function formatEntryDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

type DiarioPageProps = {
  searchParams: Promise<{
    busca?: string;
    desafio?: string;
    pagina?: string;
    periodo?: string;
    somenteComReflexao?: string;
  }>;
};

/**
 * Diário dedicado (correção da auditoria - a rota antiga afirmava que a
 * funcionalidade não existia, mas journal_entries já é gravada de verdade
 * dentro de Hoje). Esta página é só leitura/histórico - edição continua
 * exclusivamente em /app/hoje via save_journal_entry, nunca duplicada
 * aqui (Parte A.3).
 */
export default async function DiarioPage({ searchParams }: DiarioPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.pagina) || 1);
  const periodDays = params.periodo ? Number(params.periodo) : undefined;
  const onlyWithContent = params.somenteComReflexao === "on";
  const search = params.busca?.trim() || undefined;
  const challengeId = params.desafio || undefined;

  const [{ rows, total }, challenges] = await Promise.all([
    listJournalEntries({
      challengeId,
      periodDays,
      onlyWithContent,
      search,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    listJournalChallenges(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasAnyFilter = Boolean(challengeId || periodDays || onlyWithContent || search);
  const hasAnyHistory = total > 0 || hasAnyFilter;

  function buildPageHref(targetPage: number) {
    const query = new URLSearchParams();
    if (challengeId) query.set("desafio", challengeId);
    if (params.periodo) query.set("periodo", params.periodo);
    if (onlyWithContent) query.set("somenteComReflexao", "on");
    if (search) query.set("busca", search);
    query.set("pagina", String(targetPage));
    return `/app/diario?${query.toString()}`;
  }

  return (
    <MemberEmptyPage
      description="Sua história pessoal de reflexões, sempre privada - só você tem acesso ao que escreve aqui."
      icon={NotebookPen}
      title="Diário"
    >
      <div className="space-y-4">
        {!hasAnyHistory ? (
          <Card className="p-4 sm:p-6">
            <EmptyState
              action={
                <Button as="a" href="/app/hoje">
                  Registrar meu dia
                </Button>
              }
              description="Suas reflexões aparecerão aqui conforme você registrar sua jornada."
              title="Nada por aqui ainda"
            />
          </Card>
        ) : (
          <>
            <form
              className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:flex-row sm:flex-wrap sm:items-center"
              method="get"
            >
              {challenges.length > 1 ? (
                <select
                  aria-label="Filtrar por desafio"
                  className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-56"
                  defaultValue={challengeId ?? ""}
                  name="desafio"
                >
                  <option value="">Todos os desafios</option>
                  {challenges.map((c) => (
                    <option key={c.challenge_id} value={c.challenge_id}>
                      {c.challenge_name}
                    </option>
                  ))}
                </select>
              ) : null}
              <select
                aria-label="Filtrar por período"
                className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-44"
                defaultValue={params.periodo ?? ""}
                name="periodo"
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                aria-label="Buscar no diário"
                className="min-h-12 flex-1 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:min-w-40"
                defaultValue={search ?? ""}
                name="busca"
                placeholder="Buscar nas reflexões"
                type="text"
              />
              <label className="flex items-center gap-2 text-sm text-muted">
                <input defaultChecked={onlyWithContent} name="somenteComReflexao" type="checkbox" />
                Só dias com reflexão
              </label>
              <Button size="md" type="submit">
                Filtrar
              </Button>
              <Button as="a" href="/app/diario" size="md" variant="ghost">
                Limpar
              </Button>
            </form>

            {rows.length === 0 ? (
              <EmptyState description="Nenhum registro corresponde aos filtros atuais." title="Nada encontrado" />
            ) : (
              <ul className="space-y-3">
                {rows.map((entry) => {
                  const hasContent = journalEntryHasContent(entry);
                  const isOpen = entry.finalized_at === null;

                  return (
                    <li key={entry.daily_log_id}>
                      <Card className="p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-xs uppercase tracking-[0.14em] text-action-soft">
                              {formatEntryDate(entry.log_date)}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {entry.challenge_name}
                              {entry.day_number ? ` · Dia ${entry.day_number}` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-2">
                            {describeDailyLogStatus(entry.daily_log_status as never)}
                          </span>
                        </div>

                        {entry.challenge_day_message ? (
                          <p className="mt-3 text-xs italic leading-5 text-muted-2">“{entry.challenge_day_message}”</p>
                        ) : null}

                        {hasContent ? (
                          <dl className="mt-3 space-y-2 text-sm leading-6 text-muted">
                            {entry.content ? (
                              <div>
                                <dt className="font-semibold text-foreground">Como foi o dia</dt>
                                <dd>{entry.content}</dd>
                              </div>
                            ) : null}
                            {entry.gratitude ? (
                              <div>
                                <dt className="font-semibold text-foreground">Gratidão</dt>
                                <dd>{entry.gratitude}</dd>
                              </div>
                            ) : null}
                            {entry.difficulty ? (
                              <div>
                                <dt className="font-semibold text-foreground">O que pesou</dt>
                                <dd>{entry.difficulty}</dd>
                              </div>
                            ) : null}
                            {entry.victory ? (
                              <div>
                                <dt className="font-semibold text-foreground">O que venceu</dt>
                                <dd>{entry.victory}</dd>
                              </div>
                            ) : null}
                            {entry.tomorrow_focus ? (
                              <div>
                                <dt className="font-semibold text-foreground">Foco de amanhã</dt>
                                <dd>{entry.tomorrow_focus}</dd>
                              </div>
                            ) : null}
                          </dl>
                        ) : (
                          <p className="mt-3 text-sm text-muted-2">Nenhuma reflexão registrada neste dia.</p>
                        )}

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-xs text-muted-2">
                            <Lock aria-hidden="true" size={12} />
                            Só você vê isto
                          </span>
                          {isOpen ? (
                            <Link className="text-xs font-semibold text-action-soft hover:underline" href="/app/hoje">
                              Editar em Hoje →
                            </Link>
                          ) : null}
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}

            {totalPages > 1 ? (
              <nav aria-label="Paginação do diário" className="flex items-center justify-between gap-3 pt-2">
                <Button as="a" disabled={page <= 1} href={buildPageHref(page - 1)} size="sm" variant="ghost">
                  Anterior
                </Button>
                <span className="text-xs text-muted-2">
                  Página {page} de {totalPages}
                </span>
                <Button as="a" disabled={page >= totalPages} href={buildPageHref(page + 1)} size="sm" variant="ghost">
                  Próxima
                </Button>
              </nav>
            ) : null}
          </>
        )}
      </div>
    </MemberEmptyPage>
  );
}
