import { Suspense } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-[calc(100svh-2rem)] flex-1" />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
