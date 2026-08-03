"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOutAndRedirectAction } from "@/features/auth/auth.actions";
import { unsubscribePushAction } from "@/features/notifications/push-subscription.actions";

/**
 * Same sign-out action as before, just no longer a bare `<form
 * action={signOutAndRedirectAction}>` - first revokes THIS device's push
 * subscription link (if any) while the session is still valid, so a
 * different account signing in on the same browser never inherits it (see
 * migration 0041's revoke_push_subscription). Never touches the browser's
 * actual Notification permission or calls pushManager.unsubscribe() - only
 * the DB-side ownership link is severed.
 */
export function SignOutForm({ compact = false }: { compact?: boolean }) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);

    try {
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await unsubscribePushAction(subscription.endpoint);
        }
      }
    } catch {
      // Best-effort only - sign-out must never be blocked by this.
    }

    await signOutAndRedirectAction();
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit}>
        <Button
          aria-label="Sair"
          leadingIcon={<LogOut aria-hidden="true" size={15} />}
          loading={pending}
          size="sm"
          type="submit"
          variant="secondary"
        >
          Sair
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Button
        className="w-full"
        leadingIcon={<LogOut aria-hidden="true" size={15} />}
        loading={pending}
        type="submit"
        variant="ghost"
      >
        Sair
      </Button>
    </form>
  );
}
