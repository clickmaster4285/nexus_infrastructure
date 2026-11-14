import { CalendarClock, CheckCircle2, CircleAlert, Clock3, Ban, Zap, CalendarDays, RefreshCw, ShieldCheck, ShieldQuestion, ShieldX, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MaintenanceApprovalStatus, MaintenanceWindowStatus, MaintenanceWindowType } from "@/mocks/maintenanceWindows";

export const WINDOW_STATUS_META: Record<MaintenanceWindowStatus, { icon: LucideIcon; badge: string; stripe: string; dot: string }> = {
  "Scheduled": { icon: CalendarClock, badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400", stripe: "shadow-[inset_3px_0_0_0_oklch(0.6231_0.188_259.81)]", dot: "oklch(0.6231 0.188 259.81)" },
  "In Progress": { icon: Clock3, badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", stripe: "shadow-[inset_3px_0_0_0_oklch(0.6056_0.2189_292.72)]", dot: "oklch(0.6056 0.2189 292.72)" },
  "Completed": { icon: CheckCircle2, badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", stripe: "shadow-[inset_3px_0_0_0_oklch(0.6271_0.1699_149.21)]", dot: "oklch(0.6271 0.1699 149.21)" },
  "Cancelled": { icon: Ban, badge: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300", stripe: "shadow-[inset_3px_0_0_0_oklch(0.5544_0.0407_257.42)]", dot: "oklch(0.5544 0.0407 257.42)" },
};

export const WINDOW_TYPE_META: Record<MaintenanceWindowType, { icon: LucideIcon; badge: string }> = {
  Planned: { icon: CalendarDays, badge: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" },
  Emergency: { icon: Zap, badge: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300" },
  Recurring: { icon: RefreshCw, badge: "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300" },
};

export const APPROVAL_META: Record<MaintenanceApprovalStatus, { icon: LucideIcon; badge: string }> = {
  Pending: { icon: ShieldQuestion, badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  Approved: { icon: ShieldCheck, badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  Rejected: { icon: ShieldX, badge: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" },
};

export function WindowStatusBadge({ status, live, endsIn, className }: { status: MaintenanceWindowStatus; live?: boolean; endsIn?: string | null; className?: string }) {
  const meta = WINDOW_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap border-transparent px-2 py-0.5 text-xs font-semibold", meta.badge, className)}>
      <span className="relative inline-flex h-3 w-3 items-center justify-center" aria-hidden="true">
        {status === "In Progress" && <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full opacity-60" style={{ background: meta.dot }} />}
        <Icon size={12} className="relative" />
      </span>
      {status}
      {live && endsIn && <span className="font-normal tabular-nums opacity-80">· {endsIn}</span>}
    </Badge>
  );
}

export function WindowTypeBadge({ type, className }: { type: MaintenanceWindowType; className?: string }) {
  const meta = WINDOW_TYPE_META[type];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap border-transparent px-2 py-0.5 text-xs font-semibold", meta.badge, className)}>
      <Icon size={12} aria-hidden="true" />
      {type}
    </Badge>
  );
}

export function ApprovalBadge({ status, className }: { status: MaintenanceApprovalStatus; className?: string }) {
  const meta = APPROVAL_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap border-transparent px-2 py-0.5 text-xs font-semibold", meta.badge, className)}>
      <Icon size={12} aria-hidden="true" />
      {status}
    </Badge>
  );
}

/** Red conflict marker used on rows/pills/bars that overlap another window on the same scope. */
export function ConflictBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap border-transparent bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-400", className)}>
      <CircleAlert size={12} aria-hidden="true" />
      Conflict
    </Badge>
  );
}

export const MAINTENANCE_CONFLICT_STRIPE = "shadow-[inset_3px_0_0_0_oklch(0.5771_0.2152_27.33)]";
