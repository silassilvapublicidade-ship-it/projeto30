"use client";

import { useState } from "react";

import { Field, Input } from "@/components/ui/field";
import type { Json } from "@/types/database";

type VisibilityDefaults = {
  betweenFrom?: number | undefined;
  betweenTo?: number | undefined;
  fromDay?: number | undefined;
  specificDays?: string | undefined;
  type: string;
};

function readDefaults(visibilityConfig: Json | undefined): VisibilityDefaults {
  if (!visibilityConfig || typeof visibilityConfig !== "object" || Array.isArray(visibilityConfig)) {
    return { type: "all_days" };
  }

  const config = visibilityConfig as Record<string, Json>;
  const type = typeof config.type === "string" ? config.type : "all_days";

  return {
    betweenFrom: typeof config.from === "number" ? config.from : undefined,
    betweenTo: typeof config.to === "number" ? config.to : undefined,
    fromDay: typeof config.day === "number" ? config.day : undefined,
    specificDays: Array.isArray(config.days) ? config.days.join(", ") : undefined,
    type,
  };
}

function buildPreview(type: string, durationDays: number, fromDay: string, betweenFrom: string, betweenTo: string, specificDays: string) {
  switch (type) {
    case "first_day":
      return "Este item aparecerá no Dia 1.";
    case "last_day":
      return `Este item aparecerá no Dia ${durationDays}.`;
    case "from_day":
      return fromDay ? `Este item aparecerá a partir do Dia ${fromDay}.` : "Informe o dia inicial.";
    case "between_days":
      return betweenFrom && betweenTo
        ? `Este item aparecerá entre os dias ${betweenFrom} e ${betweenTo}.`
        : "Informe o intervalo de dias.";
    case "specific_days":
      return specificDays
        ? `Este item aparecerá nos dias ${specificDays}.`
        : "Informe os dias (ex.: 1, 31).";
    default:
      return "Este item aparecerá todos os dias.";
  }
}

/**
 * Client island only for the "which extra fields show up" + live preview
 * text - the actual values still submit as plain form fields, resolved
 * server-side into visibility_config by habitVisibilityFormSchema (never
 * trusts this preview for anything real).
 */
export function HabitVisibilityFields({
  durationDays,
  initialVisibilityConfig,
}: {
  durationDays: number;
  initialVisibilityConfig?: Json;
}) {
  const defaults = readDefaults(initialVisibilityConfig);
  const [type, setType] = useState(defaults.type);
  const [fromDay, setFromDay] = useState(defaults.fromDay?.toString() ?? "");
  const [betweenFrom, setBetweenFrom] = useState(defaults.betweenFrom?.toString() ?? "");
  const [betweenTo, setBetweenTo] = useState(defaults.betweenTo?.toString() ?? "");
  const [specificDays, setSpecificDays] = useState(defaults.specificDays ?? "");

  return (
    <div className="space-y-3">
      <Field hint="Controla se este item pode ser respondido/pontuar naquele dia - reforçado no servidor." label="Quando este item aparece?">
        <select
          className="min-h-12 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground"
          name="visibilityType"
          onChange={(event) => setType(event.target.value)}
          value={type}
        >
          <option value="all_days">Todos os dias</option>
          <option value="first_day">Somente no primeiro dia</option>
          <option value="last_day">Somente no último dia</option>
          <option value="from_day">A partir de um dia</option>
          <option value="between_days">Entre dois dias</option>
          <option value="specific_days">Dias específicos</option>
        </select>
      </Field>

      {type === "from_day" ? (
        <Field label="A partir do dia">
          <Input
            max={366}
            min={1}
            name="visibilityFromDay"
            onChange={(event) => setFromDay(event.target.value)}
            type="number"
            value={fromDay}
          />
        </Field>
      ) : null}

      {type === "between_days" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Do dia">
            <Input
              max={366}
              min={1}
              name="visibilityBetweenFrom"
              onChange={(event) => setBetweenFrom(event.target.value)}
              type="number"
              value={betweenFrom}
            />
          </Field>
          <Field label="Até o dia">
            <Input
              max={366}
              min={1}
              name="visibilityBetweenTo"
              onChange={(event) => setBetweenTo(event.target.value)}
              type="number"
              value={betweenTo}
            />
          </Field>
        </div>
      ) : null}

      {type === "specific_days" ? (
        <Field hint="Números separados por vírgula." label="Dias específicos">
          <Input
            name="visibilitySpecificDays"
            onChange={(event) => setSpecificDays(event.target.value)}
            placeholder="1, 31"
            value={specificDays}
          />
        </Field>
      ) : null}

      <p className="text-xs leading-5 text-muted-2">
        {buildPreview(type, durationDays, fromDay, betweenFrom, betweenTo, specificDays)}
      </p>
    </div>
  );
}
