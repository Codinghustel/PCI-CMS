import { Badge } from "@/components/ui/badge";
import { CRM_STATUS_LABELS } from "@/lib/content-labels";

const CRM_BADGE: Record<keyof typeof CRM_STATUS_LABELS, string> = {
  PENDING: "bg-sky-100 text-sky-900",
  DELIVERED: "bg-emerald-100 text-emerald-900",
  FAILED: "bg-red-100 text-red-900",
  NOT_CONFIGURED: "bg-amber-100 text-amber-900",
};

export function CrmBadge({ status }: { status: keyof typeof CRM_STATUS_LABELS }) {
  return <Badge variant="secondary" className={CRM_BADGE[status]}>{CRM_STATUS_LABELS[status]}</Badge>;
}
