import { Suspense } from "react";

import { AssistantWidget } from "@/components/assistant/assistant-widget";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { publicStatus, resolveAiConfig } from "@/lib/assistant/config";
import { getCurrentUser } from "@/lib/auth/dal";
import { env } from "@/lib/env";
import { listNotifications } from "@/lib/notifications-actions";

import { AppSidebar } from "./app-sidebar";

async function Notifications() {
  return <NotificationBell initial={await listNotifications()} />;
}

export async function DashboardShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Só o estado público: a chave de API nunca chega ao navegador.
  const assistant = publicStatus(resolveAiConfig(env));

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset className="min-w-0">
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <div className="ml-auto flex items-center gap-1">
            {/* Notificações em streaming: não seguram a sidebar nem o conteúdo da página. */}
            <Suspense fallback={<NotificationBell initial={[]} />}>
              <Notifications />
            </Suspense>
            <ThemeToggle />
          </div>
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-6">{children}</div>
      </SidebarInset>
      <AssistantWidget status={assistant} />
    </SidebarProvider>
  );
}
