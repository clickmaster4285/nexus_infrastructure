import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, CircleAlert, Clock3, ShieldCheck, ShieldX, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CertStatus } from "@/utils/certStats";
import type { CertIssuerType } from "@/mocks/certificates";

const statusTone: Record<CertStatus, { classes: string; Icon: LucideIcon }> = {
  Expired: { classes: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300", Icon: ShieldX },
  Critical: { classes: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300", Icon: AlertTriangle },
  "Expiring soon": { classes: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", Icon: Clock3 },
  Healthy: { classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", Icon: ShieldCheck },
  Revoked: { classes: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300", Icon: CircleAlert },
};

export function CertStatusBadge({ status, className }: { status: CertStatus; className?: string }) {
  const tone = statusTone[status];
  const Icon = tone.Icon;
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold", tone.classes, className)}><Icon size={12} aria-hidden="true" />{status}</span>;
}

const issuerTone: Record<CertIssuerType, string> = {
  "Public CA": "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  "Internal CA": "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  "Self-signed": "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
};

export function IssuerTypeBadge({ type, className }: { type: CertIssuerType; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold", issuerTone[type], className)}>{type}</span>;
}

export function WeakBadge({ weak, className }: { weak: boolean; className?: string }) {
  if (!weak) return null;
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[0.625rem] font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300", className)}><AlertTriangle size={10} aria-hidden="true" />WEAK</span>;
}

export function ChainBadge({ valid, className }: { valid: boolean; className?: string }) {
  if (valid) return null;
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[0.625rem] font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300", className)}><AlertTriangle size={10} aria-hidden="true" />CHAIN</span>;
}

export function HostChips({ hosts, max = 2, className }: { hosts: string[]; max?: number; className?: string }) {
  const shown = hosts.slice(0, max);
  const extra = hosts.length - shown.length;
  return (
    <span className={cn("flex min-w-0 items-center gap-1", className)}>
      {shown.map((host) => (
        <span key={host} className="max-w-[6.875rem] truncate rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground" title={host}>{host}</span>
      ))}
      {extra > 0 && <span className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground" title={hosts.join(", ")}>+{extra}</span>}
    </span>
  );
}

const ALLOWED_BAR_WIDTHS = ["w-0", "w-1/4", "w-2/5", "w-1/2", "w-3/5", "w-2/3", "w-3/4", "w-4/5", "w-full"] as const;

/** Health score bar: green ≥80, amber ≥50, red below. */
export function HealthBar({ score, className }: { score: number; className?: string }) {
  const tone = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-400" : "bg-red-500";
  // snap width to nearest 1/8 step so Tailwind can see the class statically
  const snapped = Math.max(0, Math.min(100, score));
  const index = Math.floor((snapped / 100) * (ALLOWED_BAR_WIDTHS.length - 1) + 0.5);
  return (
    <div className={cn("flex items-center gap-1.5", className)} role="img" aria-label={`Health score ${score} out of 100`}>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", tone, ALLOWED_BAR_WIDTHS[index])} /></div>
      <b className="text-[0.6875rem] tabular-nums text-foreground">{score}</b>
    </div>
  );
}

/** Days-left pill with urgency tone. */
export function DaysLeftBadge({ daysLeft, revoked }: { daysLeft: number; revoked?: boolean }) {
  if (revoked) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500"><CircleAlert size={12} aria-hidden="true" />Revoked</span>;
  if (daysLeft < 0) return <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400"><AlertTriangle size={12} aria-hidden="true" />Expired {Math.abs(daysLeft)}d ago</span>;
  if (daysLeft <= 7) return <span className="inline-flex items-center gap-1 font-semibold text-orange-700 dark:text-orange-400"><AlertTriangle size={12} aria-hidden="true" />{daysLeft}d left</span>;
  if (daysLeft <= 30) return <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400"><Clock3 size={12} aria-hidden="true" />{daysLeft}d left</span>;
  return <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock3 size={12} aria-hidden="true" />{daysLeft}d</span>;
}

/** 0.1875rem red stripe for expired rows. */
export function ExpiryStripe({ expired }: { expired: boolean }) {
  if (!expired) return null;
  return <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[0.1875rem] bg-red-500" />;
}

export function outcomeTone(status: CertStatus): { dot: "red" | "orange" | "amber" | "emerald" | "slate" } {
  switch (status) {
    case "Expired": return { dot: "red" };
    case "Critical": return { dot: "orange" };
    case "Expiring soon": return { dot: "amber" };
    case "Healthy": return { dot: "emerald" };
    case "Revoked": return { dot: "slate" };
  }
}
