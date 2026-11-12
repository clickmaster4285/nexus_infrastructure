import { CheckCircle2, ChevronDown, ChevronUp, ChevronsUp, Eye, Minus, Search, Target, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const SEVERITY_META: Record<"SEV1" | "SEV2" | "SEV3" | "SEV4", { label: string; icon: LucideIcon; badge: string; stripe: string; dot: string }> = {
  SEV1: { label: "SEV1 Critical", icon: ChevronsUp, badge: "bg-[#FEE2E2] text-[#DC2626] dark:bg-red-500/15 dark:text-red-400", stripe: "shadow-[inset_3px_0_0_0_#DC2626]", dot: "#DC2626" },
  SEV2: { label: "SEV2 High", icon: ChevronUp, badge: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400", stripe: "shadow-[inset_3px_0_0_0_#EA580C]", dot: "#EA580C" },
  SEV3: { label: "SEV3 Medium", icon: Minus, badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400", stripe: "shadow-[inset_3px_0_0_0_#D97706]", dot: "#F59E0B" },
  SEV4: { label: "SEV4 Low", icon: ChevronDown, badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400", stripe: "shadow-[inset_3px_0_0_0_#3B82F6]", dot: "#3B82F6" },
};

export const STATUS_META: Record<"Investigating" | "Identified" | "Monitoring" | "Resolved", { icon: LucideIcon; badge: string }> = {
  Investigating: { icon: Search, badge: "bg-[#DC2626]/10 text-[#DC2626] dark:bg-red-500/15 dark:text-red-400" },
  Identified: { icon: Target, badge: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400" },
  Monitoring: { icon: Eye, badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" },
  Resolved: { icon: CheckCircle2, badge: "bg-[#16A34A]/10 text-[#16A34A] dark:bg-emerald-500/15 dark:text-emerald-400" },
};

export function SeverityBadge({ severity, className }: { severity: "SEV1" | "SEV2" | "SEV3" | "SEV4"; className?: string }) {
  const meta = SEVERITY_META[severity];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap border-transparent px-2 py-0.5 text-xs font-semibold", meta.badge, className)}>
      <Icon size={12} aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

export function StatusBadge({ status, className }: { status: "Investigating" | "Identified" | "Monitoring" | "Resolved"; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap border-transparent px-2 py-0.5 text-xs font-semibold", meta.badge, className)}>
      <Icon size={12} aria-hidden="true" />
      {status}
    </Badge>
  );
}
