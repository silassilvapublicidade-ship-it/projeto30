"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Checkbox, Field, Radio, Textarea, Input } from "@/components/ui/field";
import { StatusCard } from "@/components/ui/feedback";
import { submitFeedbackAction, type SubmitFeedbackActionResult } from "@/features/feedback/feedback.actions";
import {
  categoriesForType,
  FEEDBACK_ATTACHMENT_PRIVACY_NOTICE,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_PRIVACY_NOTICE,
  FEEDBACK_SENTIMENTS,
  FEEDBACK_SENTIMENT_LABELS,
  FEEDBACK_SUBMITTED_MESSAGE,
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_TYPES,
  isFeedbackType,
  type FeedbackType,
} from "@/features/feedback/feedback.core";

const initialState: SubmitFeedbackActionResult = { ok: false, message: "" };

function detectBrowserAndOs(userAgent: string): { browser: string; operatingSystem: string } {
  const browserMatch = /(Edg|Chrome|Firefox|Safari)\/[\d.]+/.exec(userAgent);
  const browser = browserMatch ? browserMatch[0].replace("Edg", "Edge") : "Desconhecido";
  let operatingSystem = "Desconhecido";
  if (/Windows/.test(userAgent)) operatingSystem = "Windows";
  else if (/Android/.test(userAgent)) operatingSystem = "Android";
  else if (/iPhone|iPad|iOS/.test(userAgent)) operatingSystem = "iOS";
  else if (/Mac OS X/.test(userAgent)) operatingSystem = "macOS";
  else if (/Linux/.test(userAgent)) operatingSystem = "Linux";
  return { browser, operatingSystem };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button loading={pending} type="submit">
      {pending ? "Enviando…" : "Enviar feedback"}
    </Button>
  );
}

export function FeedbackForm({
  defaultDiagnosticCode,
  defaultRoute,
  defaultType,
}: {
  defaultDiagnosticCode?: string | undefined;
  defaultRoute?: string | undefined;
  defaultType?: string | undefined;
}) {
  const [state, formAction] = useActionState(
    async (_previous: SubmitFeedbackActionResult, formData: FormData) => submitFeedbackAction(formData),
    initialState,
  );
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(
    defaultType && isFeedbackType(defaultType) ? defaultType : "problem",
  );
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [clientContext, setClientContext] = useState({ browser: "", operatingSystem: "", viewport: "", isPwa: false });

  useEffect(() => {
    function detectClientContext() {
      const { browser, operatingSystem } = detectBrowserAndOs(navigator.userAgent);
      const isPwa = window.matchMedia("(display-mode: standalone)").matches;
      setClientContext({
        browser,
        operatingSystem,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        isPwa,
      });
    }

    detectClientContext();
  }, []);

  const categories = categoriesForType(feedbackType);

  if (state.ok) {
    return (
      <StatusCard
        description={`Protocolo ${state.protocolCode}. Analisamos os relatos regularmente - a resposta pode levar alguns dias. Acompanhe em "Meus feedbacks".`}
        title={FEEDBACK_SUBMITTED_MESSAGE}
        tone="success"
      />
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.message ? <StatusCard description={state.message} title="Revise os campos" tone="error" /> : null}

      <input name="route" type="hidden" value={defaultRoute ?? ""} />
      <input name="diagnosticCode" type="hidden" value={defaultDiagnosticCode ?? ""} />
      <input name="browser" type="hidden" value={clientContext.browser} />
      <input name="operatingSystem" type="hidden" value={clientContext.operatingSystem} />
      <input name="viewport" type="hidden" value={clientContext.viewport} />
      <input name="isPwa" type="hidden" value={String(clientContext.isPwa)} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">O que você quer fazer?</legend>
        <div className="grid gap-1.5 sm:grid-cols-3">
          {FEEDBACK_TYPES.map((type) => (
            <Radio
              checked={feedbackType === type}
              key={type}
              label={FEEDBACK_TYPE_LABELS[type]}
              name="feedbackType"
              onChange={() => setFeedbackType(type)}
              value={type}
            />
          ))}
        </div>
      </fieldset>

      {categories.length > 0 ? (
        <Field label="Categoria">
          <select
            className="min-h-12 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none"
            name="category"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {FEEDBACK_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {feedbackType === "rating" ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-foreground">Como foi sua experiência?</legend>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {FEEDBACK_SENTIMENTS.map((sentiment) => (
              <Radio key={sentiment} label={FEEDBACK_SENTIMENT_LABELS[sentiment]} name="sentiment" value={sentiment} />
            ))}
          </div>
        </fieldset>
      ) : null}

      <Field label="Título curto">
        <Input maxLength={200} name="title" placeholder="Resuma em poucas palavras" required />
      </Field>

      <Field label="Descrição">
        <Textarea maxLength={4000} name="description" placeholder="Conte com detalhes o que aconteceu" required rows={5} />
      </Field>

      <Field label="Anexar uma imagem (opcional)">
        <input
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm text-muted file:mr-3 file:rounded-[var(--radius-pill)] file:border file:border-white/10 file:bg-white/[0.06] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground"
          name="attachment"
          onChange={(event) => setAttachmentName(event.target.files?.[0]?.name ?? null)}
          type="file"
        />
        {attachmentName ? <p className="text-xs text-muted-2">Selecionado: {attachmentName}</p> : null}
        <p className="text-xs leading-5 text-muted-2">{FEEDBACK_ATTACHMENT_PRIVACY_NOTICE}</p>
      </Field>

      <Checkbox description="Autorizo a equipe do Projeto 30 a entrar em contato sobre este feedback, se necessário." label="Permitir contato" name="allowContact" />

      <Checkbox
        defaultChecked
        description="Rota, versão do app, navegador, sistema, modo PWA e tela. Nunca inclui senha, cookies, diário ou conteúdo privado."
        label="Incluir dados técnicos automáticos"
        name="includeTechnical"
      />

      <p className="text-xs leading-5 text-muted-2">{FEEDBACK_PRIVACY_NOTICE}</p>

      <SubmitButton />
    </form>
  );
}
