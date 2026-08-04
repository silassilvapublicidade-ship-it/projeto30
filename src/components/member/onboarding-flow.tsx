"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

import { RhythmRail } from "@/components/brand/rhythm-rail";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/field";
import { StatusCard } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/progress";
import {
  completeOnboardingAction,
  type MemberActionResult,
} from "@/features/member/member.actions";

const initialActionState: MemberActionResult = {
  ok: false,
  message: "",
};

const steps = ["Boas-vindas", "Identificacao", "Objetivo", "Preferencias", "Confirmacao"];

// Os 4 pilares do Projeto 30 (documento institucional). "routine" segue
// aceito no schema/valores existentes para nao quebrar quem ja escolheu
// esse objetivo no onboarding, mas deixa de ser oferecido como opcao nova.
const goalOptions = [
  {
    label: "Corpo",
    description: "Quero cuidar melhor da saude, energia e rotina fisica.",
    value: "health",
  },
  {
    label: "Mente",
    description: "Quero desenvolver foco, leitura, presenca e organizacao.",
    value: "mind",
  },
  {
    label: "Carater",
    description: "Quero fortalecer disciplina, constancia, gratidao e responsabilidade.",
    value: "discipline",
  },
  {
    label: "Espirito",
    description: "Quero cultivar oracao, fe, proposito e aproximacao de Deus.",
    value: "faith",
  },
  {
    label: "Evolucao completa",
    description: "Quero trabalhar diferentes areas da minha vida.",
    value: "complete",
  },
];

const timezones = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Fortaleza",
  "America/Cuiaba",
  "America/New_York",
  "Europe/Lisbon",
];

type OnboardingData = {
  avatarUrl: string;
  communicationOptIn: boolean;
  displayName: string;
  name: string;
  primaryGoal: string;
  reminderTime: string;
  timezone: string;
};

function SubmitJourneyButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      className="w-full sm:w-auto"
      loading={pending}
      trailingIcon={<CheckCircle2 aria-hidden="true" size={17} />}
      type="submit"
    >
      {pending ? "Salvando" : "Comecar minha jornada"}
    </Button>
  );
}

function getServerFieldError(state: MemberActionResult, field: string) {
  if (state.ok) {
    return undefined;
  }

  return state.fieldErrors?.[field]?.[0];
}

export function OnboardingFlow({
  initialData,
}: {
  initialData: Partial<OnboardingData>;
}) {
  const [step, setStep] = useState(0);
  const [localError, setLocalError] = useState("");
  const [state, formAction] = useActionState(
    completeOnboardingAction,
    initialActionState,
  );
  const [data, setData] = useState<OnboardingData>({
    avatarUrl: initialData.avatarUrl ?? "",
    communicationOptIn: initialData.communicationOptIn ?? false,
    displayName: initialData.displayName ?? "",
    name: initialData.name ?? "",
    primaryGoal: initialData.primaryGoal ?? "",
    reminderTime: initialData.reminderTime ?? "07:30",
    timezone: initialData.timezone ?? "America/Sao_Paulo",
  });

  const selectedGoal = useMemo(
    () => goalOptions.find((goal) => goal.value === data.primaryGoal),
    [data.primaryGoal],
  );

  function updateField<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setLocalError("");
    setData((current) => ({ ...current, [key]: value }));
  }

  function canAdvance() {
    if (step === 1 && (!data.name.trim() || !data.displayName.trim())) {
      setLocalError("Informe seu nome e o nome que deseja ver na area de membros.");
      return false;
    }

    if (step === 2 && !data.primaryGoal) {
      setLocalError("Escolha o objetivo que mais representa este ciclo.");
      return false;
    }

    if (step === 3 && (!data.reminderTime || !data.timezone)) {
      setLocalError("Defina um horario e um fuso para continuar.");
      return false;
    }

    return true;
  }

  function nextStep() {
    if (!canAdvance()) {
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  return (
    <form action={formAction} className="mx-auto w-full max-w-4xl">
      <input name="avatarUrl" type="hidden" value={data.avatarUrl} />
      <input name="displayName" type="hidden" value={data.displayName} />
      <input name="name" type="hidden" value={data.name} />
      <input name="primaryGoal" type="hidden" value={data.primaryGoal} />
      <input name="reminderTime" type="hidden" value={data.reminderTime} />
      <input name="timezone" type="hidden" value={data.timezone} />
      {data.communicationOptIn ? (
        <input name="communicationOptIn" type="hidden" value="on" />
      ) : null}

      <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.04] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-action-soft">
              Onboarding
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">{steps[step]}</h1>
          </div>
          <div className="w-full sm:w-64">
            <Progress
              label={`Etapa ${step + 1} de ${steps.length}`}
              value={(step + 1) * 20}
            />
          </div>
        </div>

        <div className="mt-8 min-h-[28rem]">
          {step === 0 ? (
            <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <span className="flex size-12 items-center justify-center rounded-full bg-action/12 text-action-soft">
                  <Sparkles aria-hidden="true" size={22} />
                </span>
                <h2 className="mt-6 font-display text-5xl leading-[1.02] text-foreground sm:text-6xl">
                  Voce nao precisa mudar tudo hoje.
                </h2>
                <p className="mt-5 text-base leading-8 text-muted">
                  So precisa comecar o Dia 1. Vamos preparar sua area de membros sem
                  pressa e sem burocracia.
                </p>
              </div>
              <RhythmRail />
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-5">
              <Field
                error={getServerFieldError(state, "name")}
                hint="Use seu nome real, se fizer sentido para voce."
                label="Nome"
              >
                <Input
                  autoComplete="name"
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Silas Silva"
                  value={data.name}
                />
              </Field>
              <Field
                error={getServerFieldError(state, "displayName")}
                hint="Este e o nome que aparece nas telas internas."
                label="Nome de exibicao"
              >
                <Input
                  onChange={(event) => updateField("displayName", event.target.value)}
                  placeholder="Silas"
                  value={data.displayName}
                />
              </Field>
              <Field
                error={getServerFieldError(state, "avatarUrl")}
                hint="Opcional. Cole uma URL de imagem por enquanto."
                label="Foto"
              >
                <Input
                  onChange={(event) => updateField("avatarUrl", event.target.value)}
                  placeholder="https://..."
                  type="url"
                  value={data.avatarUrl}
                />
              </Field>
            </div>
          ) : null}

          {step === 2 ? (
            <fieldset>
              <legend className="text-lg font-semibold text-foreground">
                Qual objetivo mais representa seu momento?
              </legend>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {goalOptions.map((goal) => {
                  const checked = data.primaryGoal === goal.value;

                  return (
                    <label
                      className={[
                        "flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border p-4 transition-[background,border-color,transform] duration-[var(--motion-base)]",
                        checked
                          ? "border-action/55 bg-action/12 text-foreground"
                          : "border-white/[0.08] bg-white/[0.035] text-muted hover:border-white/14 hover:bg-white/[0.055]",
                      ].join(" ")}
                      key={goal.value}
                    >
                      <input
                        checked={checked}
                        className="mt-0.5 size-5 shrink-0 accent-[var(--p30-orange)]"
                        name="primaryGoalLocal"
                        onChange={() => updateField("primaryGoal", goal.value)}
                        type="radio"
                      />
                      <span>
                        <span className="block text-sm font-semibold">{goal.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-2">
                          {goal.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-5">
              <Field
                error={getServerFieldError(state, "reminderTime")}
                hint="Escolha um horario realista para receber lembretes futuros."
                label="Horario preferido"
              >
                <Input
                  onChange={(event) => updateField("reminderTime", event.target.value)}
                  type="time"
                  value={data.reminderTime}
                />
              </Field>
              <label className="block space-y-2">
                <span className="block text-sm font-semibold text-foreground">
                  Fuso horario
                </span>
                <select
                  className="min-h-12 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none transition-[border-color,background,box-shadow,opacity] duration-[var(--motion-base)] focus:border-action/70 focus:bg-white/[0.07] focus:shadow-[0_0_0_4px_rgba(255,106,0,0.12)]"
                  onChange={(event) => updateField("timezone", event.target.value)}
                  value={data.timezone}
                >
                  {timezones.map((timezone) => (
                    <option className="bg-background" key={timezone} value={timezone}>
                      {timezone}
                    </option>
                  ))}
                </select>
              </label>
              <Switch
                checked={data.communicationOptIn}
                description="Voce pode mudar isso depois nas configuracoes."
                label="Aceito receber comunicacoes importantes sobre minha jornada"
                onChange={(event) =>
                  updateField("communicationOptIn", event.currentTarget.checked)
                }
              />
            </div>
          ) : null}

          {step === 4 ? (
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div>
                <h2 className="font-display text-4xl leading-tight text-foreground">
                  Sua area esta quase pronta.
                </h2>
                <p className="mt-4 text-base leading-8 text-muted">
                  Confira o resumo. Ao continuar, salvaremos seu perfil e suas
                  preferencias no Supabase.
                </p>
              </div>
              <div className="grid gap-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-black/20 p-4">
                {[
                  ["Nome", data.name],
                  ["Exibicao", data.displayName],
                  ["Objetivo", selectedGoal?.label ?? "Nao informado"],
                  ["Lembrete", data.reminderTime],
                  ["Fuso", data.timezone],
                  [
                    "Comunicacoes",
                    data.communicationOptIn ? "Autorizadas" : "Nao autorizadas",
                  ],
                ].map(([label, value]) => (
                  <div
                    className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-2 last:border-b-0"
                    key={label}
                  >
                    <span className="text-xs text-muted">{label}</span>
                    <span className="text-right text-sm font-semibold text-foreground">
                      {value}
                    </span>
                  </div>
                ))}
                <p className="mt-1 text-xs leading-6 text-muted-2">
                  Seu lembrete diário foi configurado para {data.reminderTime}. Para receber
                  notificações no celular, ative o push depois em Configurações →
                  Notificações. No iPhone, isso só funciona após instalar o app na tela de
                  início.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {localError ? (
          <div className="mt-4">
            <StatusCard
              description={localError}
              title="Antes de continuar"
              tone="error"
            />
          </div>
        ) : null}

        {!state.ok && state.message ? (
          <div className="mt-4">
            <StatusCard
              description={state.message}
              title="Nao foi possivel salvar"
              tone="error"
            />
          </div>
        ) : null}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            disabled={step === 0}
            leadingIcon={<ArrowLeft aria-hidden="true" size={16} />}
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            type="button"
            variant="ghost"
          >
            Voltar
          </Button>
          {step < steps.length - 1 ? (
            <Button
              onClick={nextStep}
              trailingIcon={<ArrowRight aria-hidden="true" size={16} />}
              type="button"
            >
              Continuar
            </Button>
          ) : (
            <SubmitJourneyButton />
          )}
        </div>
      </div>
    </form>
  );
}
