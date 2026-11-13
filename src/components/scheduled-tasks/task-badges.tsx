import type { ComponentType } from "react";
import {
  Activity, CheckCircle2, DatabaseBackup, Eraser, FileText, Loader2, MinusCircle, ScanLine, Terminal, Wrench, XCircle, Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { TASK_TYPE_LABELS, type RunStatus, type TaskType } from "@/mocks/scheduledTasks";
import { cn } from "@/lib/utils";

interface IconProps { size?: number | string; className?: string; "aria-hidden"?: boolean | "true" | "false" }

export const TASK_TYPE_META: Record<TaskType, { label: string; icon: ComponentType<IconProps>; chipClass: string; iconClass: string }> = {
  backup: { label: TASK_TYPE_LABELS.backup, icon: DatabaseBackup, chipClass: "border border-border bg-transparent text-muted-foreground", iconClass: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300" },
  patch: { label: TASK_TYPE_LABELS.patch, icon: Wrench, chipClass: "border border-border bg-transparent text-muted-foreground", iconClass: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300" },
  report: { label: TASK_TYPE_LABELS.report, icon: FileText, chipClass: "border border-border bg-transparent text-muted-foreground", iconClass: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300" },
  cleanup: { label: TASK_TYPE_LABELS.cleanup, icon: Eraser, chipClass: "border border-border bg-transparent text-muted-foreground", iconClass: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300" },
  security: { label: TASK_TYPE_LABELS.security, icon: ScanLine, chipClass: "border border-border bg-transparent text-muted-foreground", iconClass: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300" },
  cache: { label: TASK_TYPE_LABELS.cache, icon: Zap, chipClass: "border border-border bg-transparent text-muted-foreground", iconClass: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300" },
  monitoring: { label: TASK_TYPE_LABELS.monitoring, icon: Activity, chipClass: "border border-border bg-transparent text-muted-foreground", iconClass: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300" },
  custom: { label: TASK_TYPE_LABELS.custom, icon: Terminal, chipClass: "border border-border bg-transparent text-muted-foreground", iconClass: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300" },
};

export function TaskTypeBadge({ type, className }: { type: TaskType; className?: string }) {
  const meta = TASK_TYPE_META[type];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent px-2 py-0 text-xs font-semibold whitespace-nowrap", meta.chipClass, className)}>
      <Icon size={11} aria-hidden />
      {meta.label}
    </Badge>
  );
}

export const RUN_STATUS_META: Record<RunStatus, { label: string; icon: ComponentType<IconProps & { spin?: boolean }>; badgeClass: string }> = {
  success: { label: "Success", icon: CheckCircle2, badgeClass: "bg-[#16A34A]/10 text-[#16A34A] dark:bg-emerald-500/15 dark:text-emerald-400" },
  failed: { label: "Failed", icon: XCircle, badgeClass: "bg-[#DC2626]/10 text-[#DC2626] dark:bg-red-500/15 dark:text-red-400" },
  running: { label: "Running", icon: Loader2, badgeClass: "bg-[#3B82F6]/10 text-[#3B82F6] dark:bg-blue-500/15 dark:text-blue-400" },
  skipped: { label: "Skipped", icon: MinusCircle, badgeClass: "bg-slate-200/70 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" },
};

export function RunStatusBadge({ status, className }: { status: RunStatus; className?: string }) {
  const meta = RUN_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 border-transparent px-2 py-0.5 text-[10px] font-semibold", meta.badgeClass, className)}>
      <Icon size={11} aria-hidden className={status === "running" ? "animate-spin" : undefined} />
      {status === "skipped" ? "Skipped" : meta.label}
    </Badge>
  );
}

export function SkippedMaintenanceBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent bg-slate-200/70 px-2 py-0 text-xs font-semibold whitespace-nowrap text-slate-600 dark:bg-slate-500/20 dark:text-slate-300", className)}>
      <MinusCircle size={11} aria-hidden />
      Skipped (maintenance)
    </Badge>
  );
}

export function EnabledBadge({ enabled, className }: { enabled: boolean; className?: string }) {
  return enabled ? (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent bg-[#16A34A]/10 px-2 py-0 text-xs font-semibold whitespace-nowrap text-[#16A34A] dark:bg-emerald-500/15 dark:text-emerald-400", className)}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#16A34A] dark:bg-emerald-400" />
      Active
    </Badge>
  ) : (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent bg-slate-200/70 px-2 py-0 text-xs font-semibold whitespace-nowrap text-slate-600 dark:bg-slate-500/20 dark:text-slate-300", className)}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
      Paused
    </Badge>
  );
}

export function EnvironmentBadge({ environment, className }: { environment: "production" | "staging" | "all"; className?: string }) {
  const meta = {
    production: { label: "production", className: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300" },
    staging: { label: "staging", className: "bg-lime-50 text-lime-700 dark:bg-lime-500/10 dark:text-lime-300" },
    all: { label: "all envs", className: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300" },
  }[environment];
  return (
    <Badge variant="outline" className={cn("h-6 border-transparent px-2 py-0 text-xs font-semibold whitespace-nowrap", meta.className, className)}>
      {meta.label}
    </Badge>
  );
}
