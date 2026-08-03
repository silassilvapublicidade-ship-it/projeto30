"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  Bell,
  CheckCheck,
  Flag,
  Lightbulb,
  ListChecks,
  Megaphone,
  RefreshCcw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, StatusCard } from "@/components/ui/feedback";
import {
  loadMoreNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationClickedAction,
  markNotificationReadAction,
} from "@/features/notifications/notifications.actions";
import {
  getNotificationTypeDisplay,
  type NotificationTypeIconKey,
} from "@/features/notifications/notification-type-display.core";
import { cn } from "@/lib/utils";
import type { MemberNotification } from "@/server/services/notifications.service";

const NOTIFICATION_TYPE_ICONS: Record<NotificationTypeIconKey, LucideIcon> = {
  achievement: Award,
  bell: Bell,
  campaign: Megaphone,
  challenge: Flag,
  habit: ListChecks,
  motivation: Sparkles,
  reminder: Bell,
  tip: Lightbulb,
};

function formatNotificationDate(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(parsed);
}

function NotificationRow({
  notification,
  onMarkRead,
  onOpen,
}: {
  notification: MemberNotification;
  onMarkRead: (id: string) => void;
  onOpen: (notification: MemberNotification) => void;
}) {
  const isUnread = notification.status !== "read";
  const { categoryLabel, icon } = getNotificationTypeDisplay(notification.type);
  const Icon = NOTIFICATION_TYPE_ICONS[icon];

  return (
    <li>
      <div
        className={cn(
          "flex gap-3 rounded-[1.25rem] border p-3.5 transition-colors sm:p-4",
          isUnread
            ? "border-action/26 bg-action/[0.05]"
            : "border-white/[0.08] bg-white/[0.025]",
        )}
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border",
            isUnread ? "border-action/30 bg-action/14 text-action-soft" : "border-white/10 bg-white/[0.05] text-muted-2",
          )}
        >
          <Icon aria-hidden="true" size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0">
              <span className="block font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-2">
                {categoryLabel}
              </span>
              <p className="text-sm font-semibold leading-5 text-foreground">{notification.title}</p>
            </div>
            <span className="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted-2">
              {formatNotificationDate(notification.createdAt)}
            </span>
          </div>
          <p className="mt-1 text-sm leading-5 text-muted">{notification.body}</p>

          {notification.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem enviada pelo admin, tamanho variavel
            <img
              alt=""
              className="mt-2 max-h-40 w-full max-w-xs rounded-[0.85rem] border border-white/[0.08] object-cover"
              src={notification.imageUrl}
            />
          ) : null}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {notification.destinationPath ? (
              <Button onClick={() => onOpen(notification)} size="xs" type="button" variant="secondary">
                {notification.actionLabel || "Abrir"}
              </Button>
            ) : null}
            {isUnread ? (
              <Button
                onClick={() => onMarkRead(notification.id)}
                size="xs"
                type="button"
                variant="ghost"
              >
                Marcar como lida
              </Button>
            ) : (
              <span className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted-2">Lida</span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function NotificationInbox({
  initialHasMore,
  initialNotifications,
}: {
  initialHasMore: boolean;
  initialNotifications: MemberNotification[];
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingMore, startLoadMore] = useTransition();
  const [isMarkingAll, startMarkAll] = useTransition();

  function handleMarkRead(id: string) {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, status: "read", readAt: new Date().toISOString() } : item)),
    );
    void markNotificationReadAction(id);
  }

  function handleMarkAllRead() {
    setNotifications((current) =>
      current.map((item) => ({ ...item, status: "read", readAt: item.readAt ?? new Date().toISOString() })),
    );
    startMarkAll(async () => {
      await markAllNotificationsReadAction();
    });
  }

  function handleOpen(notification: MemberNotification) {
    if (!notification.destinationPath) return;
    handleMarkRead(notification.id);
    void markNotificationClickedAction(notification.id);
    router.push(notification.destinationPath);
  }

  function handleLoadMore() {
    const last = notifications[notifications.length - 1];
    if (!last) return;
    setLoadError(null);

    startLoadMore(async () => {
      try {
        const result = await loadMoreNotificationsAction(last.createdAt);
        setNotifications((current) => [...current, ...result.notifications]);
        setHasMore(result.hasMore);
      } catch {
        setLoadError("Não foi possível carregar mais notificações.");
      }
    });
  }

  const unreadCount = notifications.filter((item) => item.status !== "read").length;

  if (notifications.length === 0) {
    return (
      <EmptyState
        description="Quando o Projeto 30 te avisar de algo - um lembrete, uma conquista, uma novidade - vai aparecer aqui."
        title="Nenhuma notificação ainda"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2">
          {unreadCount > 0 ? `${unreadCount} não lida${unreadCount === 1 ? "" : "s"}` : "Tudo em dia"}
        </p>
        {unreadCount > 0 ? (
          <Button
            leadingIcon={<CheckCheck aria-hidden="true" size={14} />}
            loading={isMarkingAll}
            onClick={handleMarkAllRead}
            size="xs"
            type="button"
            variant="ghost"
          >
            Marcar todas como lidas
          </Button>
        ) : null}
      </div>

      <ul className="space-y-2.5">
        {notifications.map((notification) => (
          <NotificationRow
            key={notification.id}
            notification={notification}
            onMarkRead={handleMarkRead}
            onOpen={handleOpen}
          />
        ))}
      </ul>

      {loadError ? (
        <StatusCard
          description={loadError}
          title="Erro ao carregar"
          tone="error"
        />
      ) : null}

      {hasMore ? (
        <div className="flex justify-center pt-1">
          <Button
            leadingIcon={<RefreshCcw aria-hidden="true" size={14} />}
            loading={isLoadingMore}
            onClick={handleLoadMore}
            size="sm"
            type="button"
            variant="secondary"
          >
            Carregar mais
          </Button>
        </div>
      ) : null}
    </div>
  );
}
