"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

/** O Recharts é pesado: carrega em um chunk separado, sem atrasar o resto do dashboard. */
export const CommitChart = dynamic(() => import("./commit-chart").then((mod) => mod.CommitChart), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});
