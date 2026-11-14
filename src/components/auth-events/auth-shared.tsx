import { CheckCircle2, KeyRound, ShieldX, XCircle, MoreVertical } from "lucide-react";

import { AlertMenu, type AlertMenuItem } from "@/components/alerts/alert-menu";
import { cn } from "@/lib/utils";
import { OPS_TO_CANONICAL_SERVER, AUTH_RISK_FLAG_LABEL, type AuthEvent, type AuthResult, type AuthRiskFlag, type SecuritySeverity } from "@/mocks/security";

/* ------------------------------- time helpers ------------------------------ */

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - Date.parse(iso);
  const minutes = Math.floor(Math.abs(diffMs) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function fullTime(iso: string, utc = false): string {
  const formatOptions: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "medium", ...(utc ? { timeZone: "UTC" } : {}) };
  return new Date(iso).toLocaleString(undefined, formatOptions);
}

export function dateTimeShort(iso: string, utc = false): string {
  const formatOptions: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", ...(utc ? { timeZone: "UTC" } : {}) };
  return new Date(iso).toLocaleString(undefined, formatOptions);
}

/** "Asia/Karachi (UTC+5)" style label for the header/footer. */
export function timeZoneLabel(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time";
    const offset = -new Date().getTimezoneOffset() / 60;
    const sign = offset >= 0 ? "+" : "−";
    return `${zone} (UTC${sign}${Math.abs(offset)})`;
  } catch {
    return "Local time";
  }
}

/* ------------------------------ navigation ------------------------------- */

/** /server-details link when the ops-style target maps to a canonical server; otherwise null. */
export function targetHref(event: Pick<AuthEvent, "target" | "targetKind">): string | null {
  if (event.targetKind !== "server") return null;
  const canonical = OPS_TO_CANONICAL_SERVER[event.target];
  return canonical ? `/server-details/${encodeURIComponent(canonical)}` : null;
}

/* --------------------------------- badges --------------------------------- */

const resultTone: Record<AuthResult, { label: string; classes: string; Icon: typeof CheckCircle2 }> = {
  Success: { label: "Success", classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", Icon: CheckCircle2 },
  Failed: { label: "Failed", classes: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300", Icon: XCircle },
  Blocked: { label: "Blocked", classes: "bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-200", Icon: ShieldX },
  Challenged: { label: "Challenged", classes: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", Icon: KeyRound },
};

export function ResultBadge({ result, className }: { result: AuthResult; className?: string }) {
  const { label, classes, Icon } = resultTone[result];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold", classes, className)}>
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

const severityTone: Record<SecuritySeverity, string> = {
  Critical: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  Medium: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  Low: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  Info: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
};

export function SeverityBadge({ severity, className }: { severity: SecuritySeverity; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold", severityTone[severity], className)}>{severity}</span>;
}

export function DetectionStatusBadge({ status }: { status: "Open" | "Investigating" | "Resolved" | "False positive" }) {
  const classes = {
    Open: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    Investigating: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    Resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    "False positive": "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300",
  }[status];
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold", classes)}>{status}</span>;
}

/* ------------------------------- risk widgets ---------------------------- */

export function riskTone(score: number): { bar: string; text: string; stripe: string } {
  if (score >= 70) return { bar: "bg-red-500", text: "text-red-600 dark:text-red-400", stripe: "bg-red-500" };
  if (score >= 40) return { bar: "bg-amber-400", text: "text-amber-700 dark:text-amber-400", stripe: "bg-amber-400" };
  return { bar: "bg-emerald-400", text: "text-emerald-700 dark:text-emerald-400", stripe: "bg-emerald-400" };
}

/** 0.1875rem risk stripe for the left edge of a table row. */
export function RiskStripe({ score }: { score: number }) {
  return <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-[0.1875rem]", riskTone(score).stripe)} />;
}

export function RiskScoreBar({ score, className }: { score: number; className?: string }) {
  const tone = riskTone(score);
  return (
    <div className={cn("flex items-center gap-1.5", className)} aria-label={`Risk score ${score} out of 100`} role="img">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${score}%` }} />
      </div>
      <b className={cn("text-xs tabular-nums", tone.text)}>{score}</b>
    </div>
  );
}

export function FlagChips({ flags, max = 2 }: { flags: AuthRiskFlag[]; max?: number }) {
  if (flags.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const shown = flags.slice(0, max);
  const extra = flags.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((flag) => (
        <span key={flag} className="inline-flex items-center whitespace-nowrap rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-xs font-medium text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
          {AUTH_RISK_FLAG_LABEL[flag]}
        </span>
      ))}
      {extra > 0 && <span className="text-xs font-semibold text-muted-foreground" title={flags.slice(max).map((flag) => AUTH_RISK_FLAG_LABEL[flag]).join(", ")}>+{extra}</span>}
    </span>
  );
}

/* ------------------------------ card ⋮ menu ------------------------------- */

/** Standard ⋮ card menu used by every card on the page. */
export function AuthCardMenu({ label, onExport, items }: { label: string; onExport?: () => void; items?: AlertMenuItem[] }) {
  const entries = items ?? [
    { key: "table", label: "View as table", onSelect: onExport ?? (() => undefined) },
    { key: "export", label: "Export CSV", onSelect: onExport ?? (() => undefined) },
  ];
  return (
    <AlertMenu
      label={`${label} actions`}
      align="end"
      trigger={(
        <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${label} actions`}>
          <MoreVertical size={16} />
        </button>
      )}
      items={entries}
    />
  );
}

/** Small hint used for disabled admin-only actions. */
export const ADMIN_PERMISSION_HINT = "admin permission required";
