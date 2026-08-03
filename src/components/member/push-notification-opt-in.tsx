"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, Send, Share } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { recordPushConsentEventAction } from "@/features/notifications/notification-analytics.actions";
import { setPushEnabledAction } from "@/features/notifications/notification-preferences.actions";
import { sendTestPushToSelfAction } from "@/features/notifications/push-test.actions";
import { subscribePushAction, unsubscribePushAction } from "@/features/notifications/push-subscription.actions";
import { getClientEnv } from "@/lib/env/client";

// Duplicated on purpose from install-app-prompt.tsx (not extracted to a
// shared module) - existing tests assert these two functions live inline
// in that file's source; two tiny, stable, pure detection helpers aren't
// worth a refactor+test-migration mid-feature.
function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const navigatorWithIosFlag = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches || navigatorWithIosFlag.standalone === true
  );
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const windowWithMsStream = window as Window & { MSStream?: unknown };
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !windowWithMsStream.MSStream;
}

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

// Web Push requires the VAPID public key as a Uint8Array, not the base64url
// string the server hands out - standard conversion boilerplate.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Status =
  | "checking"
  | "denied"
  | "error"
  | "ios-not-installed"
  | "ready"
  | "subscribed"
  | "unsupported";

/**
 * Never requests permission on mount - only inside handleActivate, which
 * only ever runs from the button's onClick. This component only renders
 * on /app/configuracoes/notificacoes, a page the member navigated to on
 * purpose, never auto-shown elsewhere.
 */
export function PushNotificationOptIn({ initialPushEnabled }: { initialPushEnabled: boolean }) {
  const [status, setStatus] = useState<Status>("checking");
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTestSending, setIsTestSending] = useState(false);
  const [testResultMessage, setTestResultMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      if (!isPushSupported()) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      if (isIosDevice() && !isStandaloneDisplay()) {
        if (!cancelled) setStatus("ios-not-installed");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setStatus(subscription && initialPushEnabled ? "subscribed" : "ready");
        }
      } catch {
        if (!cancelled) setStatus("ready");
      }
    }

    void detect();
    return () => {
      cancelled = true;
    };
  }, [initialPushEnabled]);

  async function handleActivate() {
    setIsWorking(true);
    setErrorMessage(null);

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus("denied");
        void recordPushConsentEventAction("push_permission_denied");
        return;
      }

      void recordPushConsentEventAction("push_permission_granted");

      const publicKey = getClientEnv().NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setStatus("error");
        setErrorMessage("Notificações push ainda não foram configuradas neste ambiente.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        userVisibleOnly: true,
      });

      const json = subscription.toJSON();
      if (!json.keys?.p256dh || !json.keys.auth || !json.endpoint) {
        throw new Error("Subscription incompleta.");
      }

      const subscribeResult = await subscribePushAction({
        auth: json.keys.auth,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        platform: isIosDevice() ? "ios" : "web",
        userAgent: navigator.userAgent.slice(0, 400),
      });

      if (!subscribeResult.ok) {
        setStatus("error");
        setErrorMessage(subscribeResult.message ?? "Não foi possível concluir a ativação.");
        return;
      }

      void recordPushConsentEventAction("push_subscription_created");
      await setPushEnabledAction(true);
      setStatus("subscribed");
    } catch {
      setStatus("error");
      setErrorMessage("Não foi possível ativar as notificações agora. Tente novamente.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleSendTest() {
    setIsTestSending(true);
    setTestResultMessage(null);

    try {
      const result = await sendTestPushToSelfAction();
      setTestResultMessage({ ok: result.ok, text: result.message });
    } catch {
      setTestResultMessage({ ok: false, text: "Não foi possível enviar o teste agora." });
    } finally {
      setIsTestSending(false);
    }
  }

  async function handleDeactivate() {
    setIsWorking(true);
    setErrorMessage(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await unsubscribePushAction(subscription.endpoint);
        await subscription.unsubscribe();
        void recordPushConsentEventAction("push_subscription_revoked");
      }

      await setPushEnabledAction(false);
      setStatus("ready");
    } catch {
      setErrorMessage("Não foi possível desativar agora. Tente novamente.");
    } finally {
      setIsWorking(false);
    }
  }

  if (status === "checking") {
    return null;
  }

  if (status === "unsupported") {
    return (
      <StatusCard
        description="Seu navegador atual não é compatível com notificações push. A central interna continua funcionando normalmente."
        title="Push indisponível"
        tone="warning"
      />
    );
  }

  if (status === "ios-not-installed") {
    return (
      <div className="flex items-start gap-3 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.03] p-4">
        <Share aria-hidden="true" className="mt-0.5 shrink-0 text-action-soft" size={18} />
        <p className="text-sm leading-6 text-muted">
          Para receber notificações, instale o Projeto 30 usando{" "}
          <strong className="text-foreground">Adicionar à Tela de Início</strong>.
        </p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <StatusCard
        description="As notificações estão bloqueadas nas configurações do seu navegador. Você pode reativá-las lá a qualquer momento - a central interna continua funcionando enquanto isso."
        title="Permissão negada"
        tone="error"
      />
    );
  }

  if (status === "subscribed") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-action-soft">
          <CheckCircle2 aria-hidden="true" size={16} />
          Notificações push ativadas neste dispositivo.
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            leadingIcon={<Send aria-hidden="true" size={14} />}
            loading={isTestSending}
            onClick={handleSendTest}
            size="sm"
            type="button"
            variant="secondary"
          >
            Enviar notificação de teste
          </Button>
          <Button
            leadingIcon={<BellOff aria-hidden="true" size={14} />}
            loading={isWorking}
            onClick={handleDeactivate}
            size="sm"
            type="button"
            variant="ghost"
          >
            Desativar neste dispositivo
          </Button>
        </div>
        {testResultMessage ? (
          <StatusCard
            description={testResultMessage.text}
            title={testResultMessage.ok ? "Enviado" : "Erro"}
            tone={testResultMessage.ok ? "success" : "error"}
          />
        ) : null}
        {errorMessage ? <StatusCard description={errorMessage} title="Erro" tone="error" /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button leadingIcon={<Bell aria-hidden="true" size={14} />} loading={isWorking} onClick={handleActivate} size="sm" type="button">
        Ativar notificações
      </Button>
      {errorMessage ? <StatusCard description={errorMessage} title="Erro" tone="error" /> : null}
    </div>
  );
}
