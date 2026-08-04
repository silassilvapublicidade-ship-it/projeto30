import Image from "next/image";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Static hero prototype (Fase A.6, round 3): everything visible
 * immediately, no client JS, no reveal/parallax/mockup. Purpose is to
 * validate art direction, grid and typography before building the rest.
 */
export function CampaignHero() {
  return (
    <section className="relative isolate min-h-[85vh] overflow-hidden lg:min-h-[90vh]">
      <div className="absolute inset-0 hidden lg:block">
        <Image
          alt="Homem observando o amanhecer em uma trilha, olhando para o celular após o treino"
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src="/landing/hero-desktop.webp"
          style={{ objectPosition: "78% 38%" }}
        />
      </div>
      <div className="absolute inset-0 lg:hidden">
        <Image
          alt="Homem observando o amanhecer em uma trilha, olhando para o celular após o treino"
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src="/landing/hero-mobile.webp"
          style={{ objectPosition: "62% 30%" }}
        />
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.15)_0%,rgba(5,5,5,0.10)_35%,rgba(5,5,5,0.55)_68%,rgba(5,5,5,0.94)_100%)] lg:bg-[linear-gradient(100deg,rgba(5,5,5,0.92)_0%,rgba(5,5,5,0.60)_32%,rgba(5,5,5,0.05)_58%,transparent_74%)]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[6%] top-[14%] hidden h-[420px] w-[420px] rounded-full opacity-45 blur-3xl lg:block"
        style={{
          background: "radial-gradient(circle, rgba(255,209,138,0.5) 0%, rgba(255,209,138,0) 70%)",
        }}
      />

      <div className="relative flex min-h-[85vh] flex-col justify-end px-4 pb-14 pt-10 sm:px-6 lg:min-h-[90vh] lg:justify-center lg:px-8 lg:pb-0 lg:pt-10">
        <div className="mx-auto w-full max-w-6xl lg:-translate-y-12">
          <div className="max-w-[700px]">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-white/70">
              Projeto 30
            </p>
            <h1 className="mt-3 font-display text-[clamp(2.25rem,3.25vw+2rem,6rem)] leading-[1.05] text-white">
              30 dias para evoluir.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-white/80 sm:text-lg">
              Uma jornada de pequenas escolhas para fortalecer corpo, mente, caráter e
              espírito.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                as="a"
                href="/cadastro"
                size="lg"
                trailingIcon={<ArrowRight aria-hidden="true" size={17} />}
              >
                Começar gratuitamente
              </Button>
              <Button as="a" href="/como-funciona" size="lg" variant="secondary">
                Conhecer o projeto
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
