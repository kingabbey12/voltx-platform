"use client";

import Link from "next/link";
import { Bell, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/hooks/use-notifications";
import type { AppNotification } from "@/lib/api/notifications";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationsMenu() {
  const { data: unread } = useUnreadNotificationCount();
  const { data, isLoading } = useNotifications({ limit: 8 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = unread?.count ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-destructive" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <Check className="h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />

        {isLoading && (
          <div className="flex flex-col gap-2 p-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && (data?.items.length ?? 0) === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <Bell className="h-4.5 w-4.5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground">
              No notifications yet — you&apos;ll see updates here as they happen.
            </p>
          </div>
        )}

        {!isLoading && (data?.items.length ?? 0) > 0 && (
          <ScrollArea className="max-h-80">
            <div className="flex flex-col">
              {data!.items.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onRead={() => markRead.mutate(notification.id)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationRow({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: () => void;
}) {
  const content = (
    <div
      className={cn(
        "flex flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left last:border-0",
        !notification.read && "bg-primary/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{notification.title}</p>
        {!notification.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
      </div>
      {notification.body && (
        <p className="text-xs text-muted-foreground">{notification.body}</p>
      )}
      <p className="text-[11px] text-muted-foreground">
        {formatRelativeTime(notification.createdAt)}
      </p>
    </div>
  );

  if (notification.actionUrl) {
    return (
      <Link href={notification.actionUrl} onClick={onRead} className="hover:bg-secondary/60">
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onRead} className="w-full hover:bg-secondary/60">
      {content}
    </button>
  );
}
