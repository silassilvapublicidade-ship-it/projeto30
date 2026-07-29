import Image from "next/image";

/**
 * Static continuity prototype (Fase A.6, round 3): image + text, visible
 * immediately, no parallax/reveal, height driven by content.
 */
export function ContinuityProblem() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[63fr_37fr] lg:items-center lg:gap-12">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl sm:aspect-[16/10]">
            <Image
              alt="Estrada vazia se estendendo ao amanhecer entre colinas, representando o percurso de um ciclo de 30 dias"
              className="object-cover"
              fill
              loading="lazy"
              sizes="(min-width: 1024px) 63vw, 100vw"
              src="/landing/continuity.webp"
              style={{ objectPosition: "50% 48%" }}
            />
          </div>

          <div>
            <h2 className="font-display text-[clamp(2rem,1.4vw+1.6rem,3.25rem)] leading-[1.1] text-foreground">
              Começar cria expectativa.
              <span className="mt-2 block">Continuar cria resultado.</span>
            </h2>
            <p className="mt-4 max-w-md text-base leading-7 text-foreground/75">
              A mudança não acontece no primeiro impulso. Ela aparece quando você volta no
              dia seguinte.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
