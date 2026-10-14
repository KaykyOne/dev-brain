import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardGroupLoading() {
  return (
    <>
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-72" />
    </>
  );
}
