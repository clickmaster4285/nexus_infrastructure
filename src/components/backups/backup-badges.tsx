import type { ComponentType } from "react";
import {
  CheckCircle2, HardDrive, Loader2, MinusCircle, PauseCircle, ShieldQuestion, XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { BackupStatus, BackupType } from "@/mocks/backups";
import { BACKUP_TYPE_LABELS } from "@/mocks/backups";
import { cn } from "@/lib/utils";

interface IconProps { size?: number | string; className?: string; "aria-hidden"?: boolean | "true" | "false" }

export const BACKUP_STATUS_META: Record<BackupStatus, { label: string; icon: ComponentType<IconProps>; badgeClass: string }> = {
  success: { label: "Success", icon: CheckCircle2, badgeClass: "bg-green-600/10 text-green-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
  failed: { label: "Failed", icon: XCircle, badgeClass: "bg-red-600/10 text-red-600 dark:bg-red-500/15 dark:text-red-400" },
  running: { label: "Running", icon: Loader2, badgeClass: "bg-blue-500/10 text-blue-500 dark:bg-blue-500/15 dark:text-blue-400" },
  skipped: { label: "Skipped", icon: MinusCircle, badgeClass: "bg-slate-200/70 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" },
  paused: { label: "Paused", icon: PauseCircle, badgeClass: "bg-slate-200/70 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" },
  none: { label: "No backup", icon: ShieldQuestion, badgeClass: "bg-slate-400/15 text-slate-500 dark:bg-slate-500/20 dark:text-slate-300" },
};

export function BackupStatusBadge({ status, className }: { status: BackupStatus; className?: string }) {
  const meta = BACKUP_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent px-2 py-0 text-xs font-semibold whitespace-nowrap", meta.badgeClass, className)}>
      <Icon size={11} aria-hidden className={status === "running" ? "animate-spin" : undefined} />
      {meta.label}
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

export function BackupTypeBadge({ type, className }: { type: BackupType; className?: string }) {
  return (
    <Badge variant="outline" className={cn("h-6 gap-1 border border-border bg-transparent px-2 py-0 text-xs font-semibold whitespace-nowrap text-muted-foreground", className)}>
      <HardDrive size={11} aria-hidden />
      {BACKUP_TYPE_LABELS[type]}
    </Badge>
  );
}

/** Small neutral asset-type pill (e.g. "Database", "Web"). Always outline/neutral. */
export function AssetTypeBadge({ label, className }: { label: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("h-6 gap-1 border border-border bg-transparent px-2 py-0 text-xs font-semibold whitespace-nowrap text-muted-foreground", className)}>
      {label}
    </Badge>
  );
}

/** "Verified" pill for sealed restore points. Icon + text, never colour alone. */
export function VerifiedBadge({ verified, className }: { verified: boolean; className?: string }) {
  return verified ? (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent bg-green-600/10 px-2 py-0 text-xs font-semibold whitespace-nowrap text-green-600 dark:bg-emerald-500/15 dark:text-emerald-400", className)}>
      <CheckCircle2 size={11} aria-hidden />
      Verified
    </Badge>
  ) : (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent bg-amber-600/10 px-2 py-0 text-xs font-semibold whitespace-nowrap text-amber-600 dark:bg-amber-500/15 dark:text-amber-400", className)}>
      <MinusCircle size={11} aria-hidden />
      Unverified
    </Badge>
  );
}

/** Pass/fail pill used by drill rows and the Last Restore Test KPI. */
export function ResultBadge({ result, className }: { result: "Passed" | "Failed"; className?: string }) {
  return result === "Passed" ? (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent bg-green-600/10 px-2 py-0 text-xs font-semibold whitespace-nowrap text-green-600 dark:bg-emerald-500/15 dark:text-emerald-400", className)}>
      <CheckCircle2 size={11} aria-hidden />
      Passed
    </Badge>
  ) : (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent bg-red-600/10 px-2 py-0 text-xs font-semibold whitespace-nowrap text-red-600 dark:bg-red-500/15 dark:text-red-400", className)}>
      <XCircle size={11} aria-hidden />
      Failed
    </Badge>
  );
}

/** Met/Breached pill for the RPO/RTO compliance card. */
export function MetBadge({ met, className }: { met: boolean; className?: string }) {
  return met ? (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent bg-green-600/10 px-2 py-0 text-xs font-semibold whitespace-nowrap text-green-600 dark:bg-emerald-500/15 dark:text-emerald-400", className)}>
      <CheckCircle2 size={11} aria-hidden />
      Met
    </Badge>
  ) : (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent bg-red-600/10 px-2 py-0 text-xs font-semibold whitespace-nowrap text-red-600 dark:bg-red-500/15 dark:text-red-400", className)}>
      <XCircle size={11} aria-hidden />
      Breached
    </Badge>
  );
}
