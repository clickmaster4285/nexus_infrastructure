import { AlertTriangle, CheckCircle2, MoreVertical, ShieldCheck } from "lucide-react";

import { ChartCard } from "@/components/logs/primitives";
import { AlertMenu } from "@/components/alerts/alert-menu";
import type { BackupJob } from "@/mocks/backups";
import { getRestoreHistorySnapshot } from "@/mocks/restoreHistory";
import { cn } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

type ControlState = "met" | "warn";

interface ControlRow {
  label: string;
  detail: string;
  state: ControlState;
}

/** 3-2-1-1-1 backup posture checklist, derived from job pool/immutability counts. */
export function RansomwareProtectionCard({ jobs, onExport }: { jobs: BackupJob[]; onExport: () => void }) {
  const full = jobs.filter((job) => job.type === "full").length;
  const immutable = jobs.filter((job) => job.immutable).length;
  const offsite = jobs.filter((job) => job.poolId === "pool-vault").length;
  const encrypted = jobs.filter((job) => job.encrypted).length;
  const criticalCopies = jobs.filter((job) => job.policyId === "POL-critical").length;
  const notified = jobs.filter((job) => job.notifications.onFailure).length;
  const pausedJobs = jobs.filter((job) => !job.enabled);
  const restoreHistory = getRestoreHistorySnapshot();
  const recentRestores = (Array.isArray(restoreHistory) ? restoreHistory : []).filter((op) => op?.status === "success" && Number.isFinite(op?.epochMs) && Date.now() - op.epochMs <= 30 * DAY);
  const latestRestoreMs = recentRestores.reduce((latest, op) => Math.max(latest, op.epochMs), 0);
  const lastRestoreDays = latestRestoreMs > 0 ? Math.max(0, Math.floor((Date.now() - latestRestoreMs) / DAY)) : null;

  const rows: ControlRow[] = [
    { label: "3 copies of every dataset", detail: `${criticalCopies} jobs hold 3 copies (POL-critical) — Standard tier holds 2`, state: criticalCopies === jobs.length ? "met" : "warn" },
    { label: "2 different storage media", detail: "Local NAS (on-prem) + AWS S3 (cloud) + Offsite Vault", state: "met" },
    { label: "1 offsite copy", detail: `${offsite} jobs replicating to Offsite Vault`, state: offsite >= 1 ? "met" : "warn" },
    { label: "1 immutable / air-gapped copy", detail: `${immutable}/${jobs.length} jobs immutable (WORM) — target ≥ 80%`, state: immutable / jobs.length >= 0.8 ? "met" : "warn" },
    { label: "Encryption at rest", detail: `${encrypted}/${jobs.length} jobs AES-256 (managed)`, state: encrypted === jobs.length ? "met" : "warn" },
    { label: "MFA-delete on the vault", detail: "Privileged delete not enforced — enable MFA-delete on Offsite Vault", state: "warn" },
    { label: "Anomaly / mass-delete alerting", detail: "RUL-212 Backup job failed fires on failure only — no delete anomaly rule", state: "warn" },
    { label: "Failure notifications on all jobs", detail: `${notified}/${jobs.length} jobs alert on failure — Email + Slack`, state: notified === jobs.length ? "met" : "warn" },
    { label: "No paused / disabled jobs", detail: pausedJobs.length === 0 ? "All jobs enabled — no coverage gap" : `${pausedJobs.length} paused (${pausedJobs.map((job) => job.id).join(", ")}) — no new recovery points`, state: pausedJobs.length === 0 ? "met" : "warn" },
    { label: "Restore verified in last 30 days", detail: lastRestoreDays != null ? `${recentRestores.length} successful restores in 30d — latest ${lastRestoreDays}d ago` : "No successful restore in 30d — run a recovery test", state: lastRestoreDays != null ? "met" : "warn" },
  ];
  const metCount = rows.filter((row) => row.state === "met").length;
  const score = Math.round((metCount / rows.length) * 100);
  const tone = score >= 70 ? "text-green-600 dark:text-emerald-400" : score >= 43 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";

  return (
    <ChartCard
      title="Ransomware Protection (3-2-1-1)"
      className="h-fit min-h-[17.5rem] self-start p-4"
      actions={
        <AlertMenu
          label="Posture actions"
          align="end"
          width={220}
          trigger={
            <button type="button" aria-label="Ransomware posture actions" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <MoreVertical size={16} aria-hidden="true" />
            </button>
          }
          items={[
            { key: "export", label: "Export posture report (CSV)", onSelect: onExport },
          ]}
        />
      }
    >
      <ul className="flex flex-col divide-y divide-border/60">
        {rows.map((row) => {
          const ok = row.state === "met";
          return (
            <li key={row.label} className="flex items-center gap-2 py-1.5">
              <span aria-hidden="true" className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full",
                ok ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
              )}>
                {ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.8125rem] font-semibold leading-snug text-foreground">{row.label}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={row.detail}>{row.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto border-t border-border pt-3">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><ShieldCheck size={13} aria-hidden="true" />Overall score</span>
          <b className={cn("tabular-nums", tone)}>{score}% · {metCount}/{rows.length} met</b>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label="Ransomware posture score">
          <div className={cn("h-full rounded-full", score >= 70 ? "bg-green-600" : score >= 43 ? "bg-amber-600" : "bg-red-600")} style={{ width: `${score}%` }} />
        </div>
      </div>
    </ChartCard>
  );
}
