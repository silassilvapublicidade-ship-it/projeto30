import Link from "next/link";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Works identically whether or not push was ever granted - it links to the
 * in-app inbox (unreadCount comes from public.notifications, independent of
 * any push subscription), so a user who never enables push still sees new
 * notifications here.
 */
export function NotificationBellLink({
  compact = false,
  unreadCount,
}: {
  compact?: boolean;
  unreadCount: number;
}) {
  const hasUnread = unreadCount > 0;
  const label = hasUnread
    ? `Notificações, ${unreadCount} não lida${unreadCount === 1 ? "" : "s"}`
    : "Notificações";

  return (
    <Link
      aria-label={label}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-muted-2 transition-colors hover:border-white/14 hover:bg-white/[0.05] hover:text-foreground focus-visible:outline-action-soft",
        compact ? "size-8" : "size-9",
      )}
      href="/app/notificacoes"
    >
      <Bell aria-hidden="true" size={compact ? 15 : 16} />
      {hasUnread ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex min-w-[1.05rem] items-center justify-center rounded-full border border-background bg-action px-1 font-mono text-[0.58rem] font-semibold leading-[1.05rem] text-white"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
