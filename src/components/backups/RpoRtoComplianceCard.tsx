import { CalendarClock, MoreVertical, ShieldCheck, PlayCircle } from "lucide-react";

import { ChartCard } from "@/components/logs/primitives";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { MetBadge } from "@/components/backups/backup-badges";
import type { BackupJob } from "@/mocks/backups";
import type { BackupRun } from "@/mocks/backupRuns";
import type { BackupJobDerived } from "@/utils/backupStats";
import { deriveComplianceSparkline } from "@/utils/backupStats";
import { cn } from "@/lib/utils";

export interface TierCompliance {
  label: string;
  /** Assessable (enabled) jobs in the tier. */
  total: number;
  /** Jobs within their own RPO target. */
  met: number;
  /** Age since last success of the worst-positioned job in the tier (minutes). Null when no job has completed a run. */
  worstLagMinutes: number | null;
  /** RPO target of the worst job (minutes). */
  worstLagTargetMinutes: number;
  rpoTargetLabel: string;
  rtoTargetLabel: string;
  rtoTargetMinutes: number;
  /** Duration of the latest drill in this tier (minutes). Null when no drill recorded for the tier. */
  rtoActualMinutes: number | null;
  /** RTO target of that drill (minutes) - used for the bar ratio. */
  rtoActualTargetMinutes: number | null;
}

const DAY = 24 * 60 * 60 * 1000;

function barWidth(value: number | null, target: number): number {
  if (value == null || target <= 0) return 0;
  return Math.min(1, value / target) * 100;
}
function barColor(value: number | null, target: number): string {
  if (value == null || target <= 0) return "bg-muted";
  const ratio = value / target;
  if (ratio <= 0.8) return "bg-green-600";
  if (ratio <= 1) return "bg-amber-600";
  return "bg-red-600";
}
function formatShortDuration(minutes: number | null): string {
  if (minutes == null) return "—";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (minutes < 60) return `${minutes}m`;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${String(mins).padStart(2, "0")}m`;
}

interface SparklineProps { values: Array<number | null>; target: number }

function ComplianceSparkline({ values, target }: SparklineProps) {
  const width = 100;
  const height = 48;
  const pad = 2;
  const numeric = values.filter((value): value is number => value != null);
  const maxY = Math.max(100, ...numeric, target);
  const minY = 0;
  const step = numeric.length > 1 ? (width - pad * 2) / (numeric.length - 1) : 0;
  const points = numeric.map((value, index) => {
    const x = pad + index * step;
    const y = height - pad - ((value - minY) / (maxY - minY)) * (height - pad * 2);
    return { x, y, value };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const targetY = height - pad - ((target - minY) / (maxY - minY)) * (height - pad * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block h-12 w-full" role="img" aria-label="Compliance sparkline - last 30 days">
      <line x1={pad} y1={targetY} x2={width - pad} y2={targetY} stroke="oklch(0.7107 0.0351 256.79)" strokeWidth={0.7} strokeDasharray="2 2" />
      {points.length > 0 && <path d={path} fill="none" stroke="oklch(0.6271 0.1699 149.21)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />}
      {points.length > 0 && <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={1.4} fill="oklch(0.6271 0.1699 149.21)" />}
    </svg>
  );
}

function TierRow({ tier, index }: { tier: TierCompliance; index: number }) {
  const rpoExceeded = tier.worstLagMinutes != null && tier.worstLagMinutes > tier.worstLagTargetMinutes;
  const rpoOk = !rpoExceeded;
  const rtoRatio = tier.rtoActualTargetMinutes && tier.rtoActualMinutes != null ? tier.rtoActualMinutes / tier.rtoActualTargetMinutes : null;
  const rtoOk = rtoRatio == null || rtoRatio <= 1;

  return (
    <div className={cn(index === 0 ? "pb-3" : "pt-3")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.8125rem] font-semibold text-foreground">{tier.label}<span className="ml-1.5 text-xs font-normal tabular-nums text-muted-foreground">{tier.total} jobs</span></p>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1"><span className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">RPO</span><MetBadge met={rpoOk} /></span>
          <span className="flex items-center gap-1"><span className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">RTO</span><MetBadge met={rtoOk} /></span>
        </span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="min-w-0 rounded-lg bg-muted/50 p-2.5">
          <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">RPO</p>
          <p className="mt-1 text-[0.8125rem] font-semibold tabular-nums text-foreground">worst {formatShortDuration(tier.worstLagMinutes)} <span className="text-muted-foreground">/ {tier.rpoTargetLabel}</span></p>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(barWidth(tier.worstLagMinutes, tier.worstLagTargetMinutes))} aria-valuemin={0} aria-valuemax={100} aria-label={`${tier.label} tier RPO vs target`}>
            <div className={cn("h-full rounded-full", barColor(tier.worstLagMinutes, tier.worstLagTargetMinutes))} style={{ width: `${barWidth(tier.worstLagMinutes, tier.worstLagTargetMinutes)}%` }} />
          </div>
          <p className="mt-1.5 text-[0.6875rem] tabular-nums text-muted-foreground">{tier.met}/{tier.total} within RPO</p>
        </div>
        <div className="min-w-0 rounded-lg bg-muted/50 p-2.5">
          <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">RTO</p>
          <p className="mt-1 text-[0.8125rem] font-semibold tabular-nums text-foreground">last {formatShortDuration(tier.rtoActualMinutes)} <span className="text-muted-foreground">/ {tier.rtoTargetLabel}</span></p>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(barWidth(tier.rtoActualMinutes, tier.rtoActualTargetMinutes ?? tier.rtoTargetMinutes))} aria-valuemin={0} aria-valuemax={100} aria-label={`${tier.label} tier RTO vs target`}>
            <div className={cn("h-full rounded-full", barColor(tier.rtoActualMinutes, tier.rtoActualTargetMinutes ?? tier.rtoTargetMinutes))} style={{ width: `${barWidth(tier.rtoActualMinutes, tier.rtoActualTargetMinutes ?? tier.rtoTargetMinutes)}%` }} />
          </div>
          <p className="mt-1.5 text-[0.6875rem] tabular-nums text-muted-foreground">from last recovery test</p>
        </div>
      </div>
    </div>
  );
}

/** RPO / RTO compliance by criticality tier, with breaching-jobs list, 30-day sparkline and next drill due. */
export function RpoRtoComplianceCard({ critical, standard, jobs, views, runs, onRunJob, onExport }: {
  critical: TierCompliance;
  standard: TierCompliance;
  jobs: BackupJob[];
  views: Map<string, BackupJobDerived>;
  runs: BackupRun[];
  onRunJob: (jobId: string) => void;
  onExport: () => void;
}) {
  // Breaching jobs (excluding disabled/paused), worst first - at most 3 shown.
  const breaching = jobs
    .filter((job) => job.enabled)
    .map((job) => ({ job, view: views.get(job.id) }))
    .filter((entry) => entry.view?.rpoMet === false)
    .sort((a, b) => (b.view?.rpoLagMinutes ?? 0) - (a.view?.rpoLagMinutes ?? 0))
    .slice(0, 3);

  const sparkValues = deriveComplianceSparkline(jobs, runs, 30);

  return (
    <ChartCard
      title="RPO / RTO Compliance"
      className="h-full min-h-[21.25rem] p-4"
      actions={
        <AlertMenu
          label="Compliance actions"
          align="end"
          width={210}
          trigger={
            <button type="button" aria-label="Compliance actions" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <MoreVertical size={16} aria-hidden="true" />
            </button>
          }
          items={[{ key: "export", label: "Export compliance report (CSV)", onSelect: onExport }]}
        />
      }
    >
      <div className="flex min-h-0 flex-col divide-y divide-border/70">
        <TierRow tier={critical} index={0} />
        <TierRow tier={standard} index={1} />
      </div>

      {/* Breaching now (or all-clear callout) */}
      {breaching.length > 0 ? (
        <div className="mt-3">
          <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">Breaching now</p>
          <ul className="mt-1 divide-y divide-border/60">
            {breaching.map(({ job, view }) => (
              <li key={job.id} className="flex items-center gap-2 py-1.5">
                <span className="h-full w-[0.1875rem] shrink-0 rounded-full bg-red-600" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-[0.8125rem] font-semibold text-foreground" title={job.name}>{job.name}</span>
                  <span className="mt-0.5 block text-[0.6875rem] tabular-nums text-muted-foreground">age {formatShortDuration(view?.rpoLagMinutes ?? null)} / target {formatShortDuration(job.rpoTargetMinutes)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onRunJob(job.id)}
                  className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <PlayCircle size={12} aria-hidden="true" />Run backup
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
          <ShieldCheck size={13} aria-hidden="true" />All jobs within RPO
        </p>
      )}

      {/* 30-day compliance sparkline + next drill due */}
      <div className="mt-3 border-t border-border/70 pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">Compliance - 30d</p>
          <span className="text-[0.625rem] tabular-nums text-muted-foreground">target 95%</span>
        </div>
        <div className="mt-1"><ComplianceSparkline values={sparkValues} target={95} /></div>
        <p className="mt-2 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
          <CalendarClock size={12} aria-hidden="true" />
          <span className="truncate">Next drill due {new Date(Date.now() + 11 * DAY).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · Full DR failover · app-server-01</span>
        </p>
      </div>

      <p className="mt-auto border-t border-border pt-3 text-xs text-muted-foreground">
        RPO measured from last successful backup to now; RTO from the most recent recovery test (47m db-01 drill vs 60m target). Disabled/paused jobs and unprotected assets are excluded from the calc.
      </p>
    </ChartCard>
  );
}
