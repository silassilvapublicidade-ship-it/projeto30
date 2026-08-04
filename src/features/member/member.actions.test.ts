import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("completeOnboardingAction - lembrete diário real (Correções obrigatórias pré-lançamento, Parte B)", () => {
  const source = readSource("src", "features", "member", "member.actions.ts");

  it("reminderTime remains a required, validated field - never an invented default reaching the database", () => {
    expect(source).toContain("reminderTime: z\n    .string()\n    .trim()\n    .regex(/^([01]\\d|2[0-3]):[0-5]\\d$/,");
  });

  it("enables daily_reminder_enabled using the exact same key notification-preferences.actions.ts already uses as the source of truth - never a second competing field", () => {
    expect(source).toContain("daily_reminder_enabled: Boolean(parsed.data.reminderTime)");
  });

  it("never touches push_enabled during onboarding - push stays a separate, later, explicit opt-in", () => {
    const objectStart = source.indexOf("const notifications = {");
    const objectBody = source.slice(objectStart, source.indexOf("};", objectStart));
    expect(objectBody).not.toContain("push_enabled");
  });

  it("still persists reminder_time on user_preferences (unchanged - already correct before this fix)", () => {
    expect(source).toContain("reminder_time: parsed.data.reminderTime,");
  });

  it("still marks in_app notifications on, satisfying 'criar notificação interna mesmo sem push'", () => {
    expect(source).toContain("in_app: true,");
  });

  it("never requests browser push permission automatically during onboarding", () => {
    expect(source).not.toMatch(/Notification\.requestPermission|pushManager\.subscribe/);
  });
});

describe("OnboardingFlow - explains the reminder/push relationship before submission", () => {
  const source = readSource("src", "components", "member", "onboarding-flow.tsx");

  it("shows the chosen reminder time and explains push requires a separate later step", () => {
    expect(source).toContain("Seu lembrete diário foi configurado para {data.reminderTime}.");
    expect(source).toContain("Para receber");
    expect(source).toContain("notificações no celular, ative o push depois em Configurações");
  });

  it("never overpromises push on iPhone without PWA installed", () => {
    expect(source).toContain("No iPhone, isso só funciona após instalar o app na tela de");
  });

  it("never calls a browser permission API from onboarding - push opt-in lives elsewhere", () => {
    expect(source).not.toMatch(/Notification\.requestPermission|pushManager\.subscribe/);
  });
});

describe("primaryGoalSchema - alinhamento aos quatro pilares sem quebrar usuários existentes", () => {
  const source = readSource("src", "features", "member", "member.actions.ts");

  it("still accepts every previously valid value, including 'routine' for users who already chose it", () => {
    const schemaStart = source.indexOf("const primaryGoalSchema = z.enum([");
    const schemaBody = source.slice(schemaStart, source.indexOf("]);", schemaStart));
    expect(schemaBody).toContain('"health"');
    expect(schemaBody).toContain('"discipline"');
    expect(schemaBody).toContain('"faith"');
    expect(schemaBody).toContain('"routine"');
    expect(schemaBody).toContain('"mind"');
    expect(schemaBody).toContain('"complete"');
  });
});
