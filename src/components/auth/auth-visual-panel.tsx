import { Flame, Footprints, TrendingUp } from "lucide-react";

const indicators = [
  { icon: Flame, label: "Constância diária" },
  { icon: TrendingUp, label: "Evolução visível" },
  { icon: Footprints, label: "Uma jornada de cada vez" },
];

/**
 * Desktop-only (see the hidden lg:flex on the wrapper in AuthShell) - fixed
 * brand/motivational copy shared by every auth screen (login, cadastro,
 * recuperar-senha, nova-senha), not per-page content. The specific action
 * ("Bem-vindo de volta", "Nova senha"...) lives in the card instead.
 */
export function AuthVisualPanel() {
  return (
    <div className="max-w-lg [animation:p30-fade-up_var(--motion-base)_var(--ease-premium)]">
      <p className="font-mono text-xs uppercase tracking-[0.32em] text-action-soft">Projeto 30</p>
      <h1 className="font-display mt-6 text-5xl leading-[1.05] text-foreground xl:text-[3.4rem]">
        30 dias podem mudar a direção da sua vida.
      </h1>
      <p className="mt-6 max-w-md text-base leading-8 text-muted">
        Disciplina, constância e evolução reunidas em uma jornada construída para
        transformar hábitos em resultados.
      </p>
      <p className="mt-8 text-lg leading-8 text-foreground/90">
        Você não precisa mudar tudo hoje.
        <br />
        Precisa apenas continuar.
      </p>

      <ul className="mt-12 flex flex-col gap-4">
        {indicators.map(({ icon: Icon, label }) => (
          <li className="flex items-center gap-3 text-sm font-medium text-muted" key={label}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.04] text-action-soft">
              <Icon aria-hidden="true" size={16} />
            </span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
