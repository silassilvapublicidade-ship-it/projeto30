const supportMessages = [
  "Um dia difícil não apaga sua evolução.",
  "Voltar também é uma forma de vencer.",
  "A meta não é perfeição. É constância.",
];

export function ConstancyOverPerfection() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-display text-[clamp(1.9rem,4vw,3rem)] leading-[1.12] text-foreground">
          Você não precisa ser perfeito para continuar.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-muted sm:text-lg">
          Haverá dias em que tudo dará certo. E haverá dias em que apenas continuar já
          será uma vitória. O Projeto 30 não existe para cobrar perfeição. Existe para
          ajudar você a permanecer.
        </p>

        <ul className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
          {supportMessages.map((message) => (
            <li
              className="rounded-[var(--radius-pill)] border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-medium text-muted shadow-[var(--shadow-hairline)]"
              key={message}
            >
              {message}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
