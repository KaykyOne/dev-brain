"use client";

import { BellIcon, CheckCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Notification } from "@/db/schema";
import { formatRelative } from "@/lib/format";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/notifications-actions";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;

export function NotificationBell({ initial }: { initial: Notification[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);

  // Busca avisos novos periodicamente e quando a aba volta a ficar visível.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") listNotifications().then(setItems, () => undefined);
    };
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const unread = items.filter((item) => !item.readAt);
  const read = items.filter((item) => item.readAt);

  function openItem(item: Notification) {
    if (!item.readAt) {
      setItems((current) => current.map((n) => (n.id === item.id ? { ...n, readAt: new Date() } : n)));
      void markNotificationRead(item.id);
    }
    if (item.href) router.push(item.href);
  }

  function markAll() {
    const now = new Date();
    setItems((current) => current.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    void markAllNotificationsRead();
  }

  const renderItem = (item: Notification) => (
    <li key={item.id}>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          openItem(item);
        }}
        className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted"
      >
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.readAt ? "bg-transparent" : "bg-yellow-400")} />
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className={cn("block text-sm", !item.readAt && "font-medium")}>{item.title}</span>
          {item.body && <span className="line-clamp-2 block text-xs text-muted-foreground">{item.body}</span>}
          <span className="block text-xs text-muted-foreground">{formatRelative(item.createdAt)}</span>
        </span>
      </button>
    </li>
  );

  const section = (title: string, list: Notification[], action?: React.ReactNode) => (
    <section>
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        {action}
      </div>
      <ul className="px-1 pb-1">{list.map(renderItem)}</ul>
    </section>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={unread.length > 0 ? `Notificações (${unread.length} não lidas)` : "Notificações"}
          />
        }
      >
        <BellIcon />
        {unread.length > 0 && (
          <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-yellow-400 ring-2 ring-background" />
        )}
      </PopoverTrigger>
      <PopoverContent>
        <div className="border-b px-3 py-2.5 text-sm font-semibold">Notificações</div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhuma notificação.</p>
          ) : (
            <>
              {unread.length > 0 &&
                section(
                  `Não lidas (${unread.length})`,
                  unread,
                  <Button variant="ghost" size="xs" onClick={markAll}>
                    <CheckCheckIcon /> Marcar todas
                  </Button>,
                )}
              {read.length > 0 && section("Lidas", read)}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
