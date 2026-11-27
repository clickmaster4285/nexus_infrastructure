import { AlertTriangle, CheckCircle2, CircleAlert, CircleHelp, Clock3, FileCog, GitBranch, Monitor, Server, ShieldCheck, ShieldX, Terminal, Wrench, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ConfigApprovalStatus, ConfigChangeStatus, ConfigChangeType, ConfigRisk, ConfigSource } from "@/mocks/security";

const riskTone: Record<ConfigRisk, { classes: string; Icon: LucideIcon }> = {
  Critical: { classes: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300", Icon: ShieldX },
  High: { classes: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300", Icon: AlertTriangle },
  Medium: { classes: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", Icon: CircleAlert },
  Low: { classes: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", Icon: ShieldCheck },
};

export function ConfigRiskBadge({ risk, className }: { risk: ConfigRisk; className?: string }) {
  const tone = riskTone[risk];
  const Icon = tone.Icon;
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold", tone.classes, className)}><Icon size={12} aria-hidden="true" />{risk}</span>;
}

const approvalTone: Record<ConfigApprovalStatus, { classes: string; Icon: LucideIcon }> = {
  Approved: { classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", Icon: CheckCircle2 },
  Unapproved: { classes: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", Icon: ShieldX },
  Pending: { classes: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", Icon: Clock3 },
  Expected: { classes: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300", Icon: CircleHelp },
};

export function ApprovalBadge({ status, className }: { status: ConfigApprovalStatus; className?: string }) {
  const tone = approvalTone[status];
  const Icon = tone.Icon;
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold", tone.classes, className)}><Icon size={12} aria-hidden="true" />{status}</span>;
}

const sourceTone: Record<ConfigSource, { classes: string; Icon: LucideIcon }> = {
  Manual: { classes: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300", Icon: Wrench },
  "Automation/IaC": { classes: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", Icon: GitBranch },
  "Agent-detected": { classes: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", Icon: Monitor },
  Patch: { classes: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300", Icon: FileCog },
};

export function ConfigSourceBadge({ source, className }: { source: ConfigSource; className?: string }) {
  const tone = sourceTone[source];
  const Icon = tone.Icon;
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold", tone.classes, className)}><Icon size={12} aria-hidden="true" />{source}</span>;
}

const statusTone: Record<ConfigChangeStatus, string> = {
  Open: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  Reviewed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  Reverted: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  "Rolled back": "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "Accepted as new baseline": "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
};

export function ConfigStatusBadge({ status, className }: { status: ConfigChangeStatus; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold", statusTone[status], className)}>{status}</span>;
}

const changeTypeTone: Record<ConfigChangeType, string> = {
  Modified: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  Added: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300",
  Removed: "bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300",
};

export function ChangeTypeBadge({ type, className }: { type: ConfigChangeType; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold", changeTypeTone[type], className)}>{type}</span>;
}

/** OS-flavored glyph for the asset column (no brand artwork in the project mocks). */
export function OsIcon({ os, className }: { os: string; className?: string }) {
  const Icon: LucideIcon = /windows/i.test(os) ? Monitor : /debian|ubuntu/i.test(os) ? Terminal : Server;
  return <Icon size={15} aria-hidden="true" className={cn("shrink-0 text-muted-foreground", className)} />;
}
