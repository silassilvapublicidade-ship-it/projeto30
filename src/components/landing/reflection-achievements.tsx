import Image from "next/image";
import { Flame, Footprints, Trophy } from "lucide-react";

import { Eyebrow } from "@/components/public/public-sections";

const achievements = [
  { name: "Primeiro passo", icon: Footprints },
  { name: "Três dias de constância", icon: Flame },
  { name: "Missão concluída", icon: Trophy },
];

export function ReflectionAchievements() {
  return (
    <section className="relative" id="reflexao">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-t-2xl">
          <div className="relative aspect-[4/3] sm:aspect-[16/9] lg:aspect-[2/1]">
            <Image
              alt="Diário Projeto 30 e coqueteleira sobre uma pedra ao entardecer, com o sol se pondo ao fundo"
              className="object-cover"
              fill
              loading="lazy"
              sizes="100vw"
              src="/landing/reflection.webp"
              style={{ objectPosition: "58% 42%" }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(195deg,rgba(5,5,5,0.22)_0%,rgba(5,5,5,0.06)_30%,transparent_46%)]"
            />
            <div
              aria-hidden="true"
              className="absolute left-[2%] top-[3%] h-[42%] w-[82%] rounded-[2rem] blur-2xl sm:w-[60%] lg:w-[46%]"
              style={{
                background:
                  "radial-gradient(ellipse at 32% 32%, rgba(5,5,5,0.55) 0%, rgba(5,5,5,0.22) 55%, transparent 78%)",
              }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(180deg,transparent_0%,rgba(9,10,11,0.14)_35%,rgba(9,10,11,0.62)_70%,var(--p30-matte)_100%)]"
            />

            <div className="absolute left-[5%] top-[7%] w-[75%] sm:w-[55%] lg:w-[40%]">
              <Eyebrow>Reflexão</Eyebrow>
              <h2 className="font-display text-[clamp(1.5rem,3vw,2.5rem)] leading-[1.15] text-white">
                Não é só sobre o que você fez.
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-6 text-white/75 sm:text-base sm:leading-7">
                É sobre perceber quem você está construindo.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative bg-[linear-gradient(180deg,var(--p30-matte),var(--p30-graphite))] px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8 lg:pb-24 lg:pt-20">
        <div
          aria-hidden="true"
          className="absolute right-[8%] top-0 aspect-square w-28 -translate-y-[68%] overflow-hidden rounded-full shadow-[0_40px_100px_-16px_rgba(0,0,0,0.7)] ring-4 ring-[var(--p30-matte)] sm:right-[10%] sm:w-36 lg:right-[12%] lg:w-[27%] lg:max-w-[270px]"
        >
          <Image
            alt=""
            className="object-cover"
            fill
            loading="lazy"
            sizes="(min-width: 1024px) 27vw, 144px"
            src="/landing/achievement.webp"
            style={{ objectPosition: "58% 52%" }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full mix-blend-overlay"
            style={{
              background:
                "radial-gradient(circle at 30% 24%, rgba(255,255,255,0.55) 0%, transparent 40%)",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_-6px_10px_rgba(0,0,0,0.4)]"
          />
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl pr-24 sm:pr-0">
            <p className="font-display text-2xl italic leading-[1.25] text-foreground sm:text-3xl lg:text-4xl">
              Como foi o meu dia?
            </p>

            <p className="ml-6 mt-7 font-display text-xl italic leading-snug text-foreground/85 sm:ml-10 sm:text-2xl">
              Pelo que sou grato hoje?
            </p>

            <p className="ml-14 mt-4 max-w-xs font-display text-lg italic leading-snug text-foreground/75 sm:ml-24 sm:text-xl">
              O que eu venci?
            </p>

            <p className="ml-3 mt-9 text-sm leading-6 text-muted sm:ml-8">
              O que pesou hoje?
            </p>
            <p className="ml-16 mt-2 text-sm leading-6 text-muted-2 sm:ml-28">
              Amanhã, eu quero...
            </p>
          </div>

          <div className="mt-14 max-w-3xl border-t border-white/[0.08] pt-10 lg:mt-16">
            <Eyebrow>Conquistas</Eyebrow>
            <p className="max-w-lg text-lg font-semibold leading-7 text-foreground sm:text-xl">
              Cada marco confirma que você continuou.
            </p>

            <ul className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
              {achievements.map((achievement) => (
                <li
                  className="inline-flex items-center gap-2 text-sm font-medium text-muted"
                  key={achievement.name}
                >
                  <achievement.icon aria-hidden="true" className="text-action-soft" size={15} />
                  {achievement.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
