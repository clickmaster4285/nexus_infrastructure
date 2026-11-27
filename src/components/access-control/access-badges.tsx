import { CheckCircle2, CircleAlert, Clock3, KeyRound, Layers, Mail, ShieldCheck, ShieldX, Users, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { UserStatus, TokenStatus, RoleType } from "@/utils/accessStats";

const userTone: Record<UserStatus, { classes: string; Icon: LucideIcon }> = {
  active: { classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", Icon: CheckCircle2 },
  invited: { classes: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", Icon: Mail },
  suspended: { classes: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", Icon: Clock3 },
  disabled: { classes: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300", Icon: CircleAlert },
};

export function UserStatusBadge({ status, className }: { status: UserStatus; className?: string }) {
  const tone = userTone[status];
  const Icon = tone.Icon;
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold", tone.classes, className)}><Icon size={12} aria-hidden="true" />{status}</span>;
}

const tokenTone: Record<TokenStatus, { classes: string; Icon: LucideIcon }> = {
  active: { classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", Icon: CheckCircle2 },
  expired: { classes: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300", Icon: ShieldX },
  revoked: { classes: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300", Icon: CircleAlert },
};

export function TokenStatusBadge({ status, className }: { status: TokenStatus; className?: string }) {
  const tone = tokenTone[status];
  const Icon = tone.Icon;
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold", tone.classes, className)}><Icon size={12} aria-hidden="true" />{status}</span>;
}

const envTone: Record<"production" | "staging" | "development", string> = {
  production: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  staging: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  development: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300",
};

export function TokenEnvBadge({ environment, className }: { environment: "production" | "staging" | "development"; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold", envTone[environment], className)}>{environment}</span>;
}

export function RoleBadge({ type, className }: { type: RoleType; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold", type === "system" ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300" : "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300", className)}>{type === "system" ? "System" : "Custom"}</span>;
}

export function MfaBadge({ enabled }: { enabled: boolean }) {
  return enabled
    ? <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><ShieldCheck size={12} aria-hidden="true" />Enabled</span>
    : <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"><ShieldX size={12} aria-hidden="true" />Off</span>;
}

export function RiskBadge({ level }: { level: "High" | "Medium" | "Low" }) {
  const classes = { High: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300", Medium: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", Low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" }[level];
  return <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold", classes)}>{level}</span>;
}

export const RESOURCE_LABELS: Record<string, string> = {
  servers: "Servers",
  alerts: "Alerts",
  "alert-rules": "Alert Rules",
  incidents: "Incidents",
  "maintenance-windows": "Maintenance Windows",
  "scheduled-tasks": "Scheduled Tasks",
  backups: "Backups",
  logs: "Logs",
  security: "Security",
  certificates: "Certificates",
  "access-control": "Access Control",
  settings: "Settings",
};

export const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  execute: "Execute",
  approve: "Approve",
};
