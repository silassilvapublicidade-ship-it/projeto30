import { ArrowRight, UserRound } from "lucide-react";

import { Eyebrow } from "@/components/public/public-sections";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function OriginStory() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <Card tone="glass" className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:p-10">
          <div>
            <span className="flex size-11 items-center justify-center rounded-full bg-action/10 text-action-soft">
              <UserRound aria-hidden="true" size={19} />
            </span>
            <div className="mt-5">
              <Eyebrow>A origem</Eyebrow>
            </div>
            <h2 className="font-display text-3xl leading-tight text-foreground sm:text-4xl">
              Nasceu de uma transformação real.
            </h2>
          </div>

          <div>
            <p className="text-base leading-8 text-muted">
              O Projeto 30 nasceu da experiência de Silas: uma mudança de hábitos que
              resultou em mais de 30 quilos a menos — e, mais do que isso, em mais
              disciplina, mais leitura e mais fé no dia a dia. Dessa virada pessoal nasceu
              o convite para outras pessoas caminharem o mesmo caminho, um dia de cada vez.
            </p>
            <Button
              as="a"
              className="mt-6"
              href="/sobre"
              trailingIcon={<ArrowRight aria-hidden="true" size={16} />}
              variant="secondary"
            >
              Conhecer a história
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
