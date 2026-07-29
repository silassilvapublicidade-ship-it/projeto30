import { ArrowRight } from "lucide-react";

import { Eyebrow } from "@/components/public/public-sections";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[var(--p30-graphite)] px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.7)_1px,transparent_0)] [background-size:22px_22px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-40 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(255,106,0,0.35) 0%, rgba(255,106,0,0) 70%)",
        }}
      />

      <div className="relative mx-auto max-w-2xl text-center">
        <div className="flex justify-center">
          <Eyebrow>Comece agora</Eyebrow>
        </div>
        <h2 className="font-display text-[clamp(1.9rem,4vw,3rem)] leading-[1.1] text-foreground">
          O seu Dia 1 pode começar agora.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted">
          Trinta dias não prometem perfeição. Eles criam espaço para você continuar.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button
            as="a"
            href="/cadastro"
            size="lg"
            trailingIcon={<ArrowRight aria-hidden="true" size={17} />}
          >
            Começar meu Dia 1
          </Button>
          <a
            className="text-sm font-semibold text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-action-soft"
            href="/login"
          >
            Já tenho uma conta
          </a>
        </div>
      </div>
    </section>
  );
}
