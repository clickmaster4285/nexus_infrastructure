import type { ComponentType } from "react";
import {
  Archive, BadgeCheck, ChevronDown, ChevronsUp, ChevronUp, CircleCheck, CircleDashed, FileCode2, Minus, OctagonAlert,
  PencilLine, ShieldAlert, TriangleAlert, User, Wrench, Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RunbookSeverity, RunbookStatus, RunbookStepType } from "@/mocks/runbooks";

interface IconProps { size?: number | string; className?: string; "aria-hidden"?: boolean | "true" | "false" }

export const RUNBOOK_STATUS_META: Record<RunbookStatus, { label: string; icon: ComponentType<IconProps>; badgeClass: string }> = {
  Published: { label: "Published", icon: BadgeCheck, badgeClass: "bg-green-600/10 text-green-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
  Draft: { label: "Draft", icon: PencilLine, badgeClass: "bg-slate-200/70 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" },
  "Needs review": { label: "Needs review", icon: ShieldAlert, badgeClass: "bg-amber-600/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
  Archived: { label: "Archived", icon: Archive, badgeClass: "bg-slate-200/60 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400" },
};

export function RunbookStatusBadge({ status, className }: { status: RunbookStatus; className?: string }) {
  const meta = RUNBOOK_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent px-2 py-0 text-xs font-semibold whitespace-nowrap", meta.badgeClass, className)}>
      <Icon size={11} aria-hidden />
      {meta.label}
    </Badge>
  );
}

/** Canonical Critical/High/Medium/Low colours, icon + text (never colour alone). */
export const RUNBOOK_SEVERITY_META: Record<RunbookSeverity, { icon: ComponentType<IconProps>; badgeClass: string; stripe: string; dot: string }> = {
  Critical: { icon: ChevronsUp, badgeClass: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400", stripe: "#DC2626", dot: "#DC2626" },
  High: { icon: ChevronUp, badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400", stripe: "#EA580C", dot: "#EA580C" },
  Medium: { icon: Minus, badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400", stripe: "#D97706", dot: "#D97706" },
  Low: { icon: ChevronDown, badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400", stripe: "#3B82F6", dot: "#3B82F6" },
};

export function RunbookSeverityBadge({ severity, className }: { severity: RunbookSeverity; className?: string }) {
  const meta = RUNBOOK_SEVERITY_META[severity];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent px-2 py-0 text-xs font-semibold whitespace-nowrap", meta.badgeClass, className)}>
      <Icon size={11} aria-hidden />
      {severity}
    </Badge>
  );
}

/** Step type meta shared by detail/runner/editor. */
export const RUNBOOK_STEP_TYPE_META: Record<RunbookStepType, { icon: ComponentType<IconProps>; badgeClass: string; label: string }> = {
  Manual: { icon: User, badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300", label: "Manual" },
  Command: { icon: FileCode2, badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", label: "Command" },
  Check: { icon: CircleCheck, badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", label: "Check" },
  Warning: { icon: TriangleAlert, badgeClass: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", label: "Warning" },
  Automated: { icon: Zap, badgeClass: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", label: "Automated" },
};

export function RunbookStepTypeBadge({ type, className }: { type: RunbookStepType; className?: string }) {
  const meta = RUNBOOK_STEP_TYPE_META[type];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent px-2 py-0 text-[0.6875rem] font-semibold whitespace-nowrap", meta.badgeClass, className)}>
      <Icon size={11} aria-hidden />
      {meta.label}
    </Badge>
  );
}

/** Outcome badge for a recorded execution. */
export function ExecutionResultBadge({ result, className }: { result: "Completed" | "Aborted" | "Failed"; className?: string }) {
  const map = {
    Completed: { icon: CircleCheck, badgeClass: "bg-green-600/10 text-green-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
    Aborted: { icon: CircleDashed, badgeClass: "bg-slate-200/70 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" },
    Failed: { icon: OctagonAlert, badgeClass: "bg-red-600/10 text-red-600 dark:bg-red-500/15 dark:text-red-400" },
  } as const;
  const meta = map[result];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent px-2 py-0 text-xs font-semibold whitespace-nowrap", meta.badgeClass, className)}>
      <Icon size={11} aria-hidden />
      {result}
    </Badge>
  );
}

/** Wrench icon used by the maintenance-ish step actions; re-exported to keep imports in one place. */
export { Wrench as RunbookStepIcon };
