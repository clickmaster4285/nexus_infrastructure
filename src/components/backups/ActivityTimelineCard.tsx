import { useMemo } from "react";
import { ArchiveRestore, CheckCircle2, FlaskConical, MinusCircle, MoreVertical, Settings2, XCircle } from "lucide-react";

import { ChartCard } from "@/components/logs/primitives";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { timeAgo } from "@/mocks/logs";
import type { BackupJob } from "@/mocks/backups";
import type { BackupRun } from "@/mocks/backupRuns";
import type { DrDrill, RestoreOperation } from "@/mocks/restoreHistory";
import { formatDuration } from "@/utils/backupStats";
import { formatBytes } from "@/utils/storageForecast";
import { cn } from "@/lib/utils";

type ActivityType = "backup" | "backup-failed" | "backup-skipped" | "restore" | "drill" | "policy";

interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  epochMs: number;
}

const TYPE_META: Record<ActivityType, { icon: typeof CheckCircle2; discClass: string; titleClass?: string }> = {
  backup: { icon: CheckCircle2, discClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  "backup-failed": { icon: XCircle, discClass: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" },
  "backup-skipped": { icon: MinusCircle, discClass: "bg-slate-200/70 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" },
  restore: { icon: ArchiveRestore, discClass: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" },
  drill: { icon: FlaskConical, discClass: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400" },
  policy: { icon: Settings2, discClass: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
};

/** Chronological feed of backup, restore, recovery-test and policy events across the estate. Derived, never hand-written. */
export function ActivityTimelineCard({ jobs, runs, operations, drills, onExport }: {
  jobs: BackupJob[];
  runs: BackupRun[];
  operations: RestoreOperation[];
  drills: DrDrill[];
  onExport: () => void;
}) {
  const events = useMemo(() => {
    const jobName = new Map(jobs.map((job) => [job.id, job.name] as const));
    const feed: ActivityEvent[] = [];

    const recentRuns = [...runs].sort((a, b) => b.epochMs - a.epochMs).slice(0, 14);
    for (const run of recentRuns) {
      const name = jobName.get(run.jobId) ?? run.jobId;
      const duration = run.status === "running" ? `running ${run.progress ?? 0}%` : formatDuration(run.durationMs);
      if (run.status === "success") {
        feed.push({ id: `run:${run.id}`, type: "backup", title: "Backup completed", detail: `${name} · ${formatBytes(run.sizeBytes)} · ${duration}`, epochMs: run.epochMs });
      } else if (run.status === "failed") {
        feed.push({ id: `run:${run.id}`, type: "backup-failed", title: "Backup failed", detail: `${name} · ${run.error ?? "run failed"}`, epochMs: run.epochMs });
      } else if (run.status === "skipped") {
        feed.push({ id: `run:${run.id}`, type: "backup-skipped", title: "Backup skipped (maintenance)", detail: `${name} · maintenance window active`, epochMs: run.epochMs });
      }
    }

    for (const op of operations.slice(0, 6)) {
      feed.push({
        id: `op:${op.id}`,
        type: "restore",
        title: op.status === "failed" ? "Restore failed" : "Restore completed",
        detail: `${op.operation} · ${op.host} · from ${op.pointId} · by ${op.requestedBy}`,
        epochMs: op.epochMs,
      });
    }

    for (const drill of drills.slice(0, 4)) {
      feed.push({
        id: `drill:${drill.id}`,
        type: "drill",
        title: drill.result === "Passed" ? "Recovery test completed" : "Recovery test failed",
        detail: `${drill.name} · ${drill.durationMin}m vs ${drill.rtoTargetMin}m RTO · ${drill.executedBy}`,
        epochMs: drill.epochMs,
      });
    }

    const audits: ActivityEvent[] = [];
    for (const job of jobs) {
      for (const entry of job.audit) {
        if (/^(Policy updated|Schedule updated|Retention updated|Location updated|Paused|Enabled|Created)/.test(entry.action)) {
          const target = entry.action === "Created" ? "Backup job created" : entry.action;
          audits.push({ id: `audit:${entry.id}`, type: "policy", title: target, detail: `${job.name} · ${entry.actor}`, epochMs: entry.epochMs });
        }
      }
    }
    feed.push(...audits);

    return feed.sort((a, b) => b.epochMs - a.epochMs).slice(0, 9);
  }, [jobs, runs, operations, drills]);

  return (
    <ChartCard
      title="Recent Backup Activity"
      className="p-5"
      actions={
        <div className="flex items-center gap-1">
          <span className="text-xs tabular-nums text-muted-foreground">Last {events.length} events</span>
          <AlertMenu
            label="Activity actions"
            align="end"
            width={210}
            trigger={
              <button type="button" aria-label="Activity actions" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <MoreVertical size={16} aria-hidden="true" />
              </button>
            }
            items={[{ key: "export", label: "Export activity (CSV)", onSelect: onExport }]}
          />
        </div>
      }
    >
      <ul className="divide-y divide-border/60">
        {events.map((event) => {
          const meta = TYPE_META[event.type];
          const Icon = meta.icon;
          return (
            <li key={event.id} className="flex items-center gap-2.5 py-2">
              <span aria-hidden="true" className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", meta.discClass)}>
                <Icon size={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.8125rem] font-semibold leading-snug text-foreground">{event.title}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={event.detail}>{event.detail}</span>
              </span>
              <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{timeAgo(event.epochMs)}</span>
            </li>
          );
        })}
        {events.length === 0 && (
          <li className="py-8 text-center">
            <p className="text-sm font-semibold text-foreground">No recent activity</p>
            <p className="mt-1 text-[0.75rem] text-muted-foreground">Backup, restore and recovery events will appear here as they happen.</p>
          </li>
        )}
      </ul>
    </ChartCard>
  );
}
