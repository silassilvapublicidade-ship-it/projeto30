import Image from "next/image";

import { Eyebrow } from "@/components/public/public-sections";

const features = [
  "Hábitos essenciais e opcionais claramente separados.",
  "Progresso e pontos calculados com consistência.",
  "Reflexão e finalização no mesmo fluxo.",
];

export function ProductInUse() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24" id="produto">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <div className="relative aspect-[147/107] w-full">
            <Image
              alt="Homem segurando o celular com a tela naturalmente escura, ao entardecer"
              className="object-cover"
              fill
              loading="lazy"
              sizes="(min-width: 1024px) 75vw, 100vw"
              src="/landing/product-in-use.webp"
              style={{ objectPosition: "50% 50%" }}
            />

            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(190deg,rgba(5,5,5,0.9)_0%,rgba(5,5,5,0.35)_28%,transparent_46%)] lg:bg-[linear-gradient(200deg,rgba(5,5,5,0.92)_0%,rgba(5,5,5,0.35)_24%,transparent_42%)]"
            />

            <div
              aria-hidden="true"
              className="absolute right-0 top-0 h-[60%] w-[70%] sm:w-[52%] lg:w-[38%]"
              style={{
                background:
                  "radial-gradient(ellipse at 75% 20%, rgba(5,5,5,0.45) 0%, rgba(5,5,5,0.16) 55%, transparent 78%)",
              }}
            />

            <div className="absolute right-[5%] top-[4%] w-[64%] text-right sm:w-[46%] lg:w-[30%] lg:text-left">
              <div className="flex justify-end lg:justify-start">
                <Eyebrow>Produto em uso</Eyebrow>
              </div>
              <h2 className="font-display text-[clamp(1.15rem,2.6vw,2.25rem)] leading-[1.12] text-white">
                Seu dia,
                <br />
                sem ruído.
              </h2>
              <p className="ml-auto mt-4 max-w-[22ch] text-[11px] leading-5 text-white/75 sm:mt-5 sm:text-sm sm:leading-6 lg:ml-0 lg:max-w-[24ch]">
                O que precisa ser feito, o que já foi cumprido e o que ainda depende de
                você — de relance, sem abrir menus.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-0 divide-y divide-white/[0.08] border-t border-white/[0.08] sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:border-t-0">
          {features.map((feature, index) => (
            <div className="flex gap-3 py-4 sm:py-0 sm:pl-6 sm:first:pl-0" key={feature}>
              <span className="font-mono text-xs text-action-soft">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="text-sm leading-6 text-muted">{feature}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
