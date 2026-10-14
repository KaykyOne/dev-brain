import { Badge } from "@/components/ui/badge";
import type { Project } from "@/db/schema";

const STATUS = {
  never: { label: "Nunca sincronizado", variant: "outline" },
  synced: { label: "Sincronizado", variant: "secondary" },
  failed: { label: "Falha na sincronização", variant: "destructive" },
} as const;

export function SyncStatusBadge({ status }: { status: Project["syncStatus"] }) {
  const { label, variant } = STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}
