import { useMemo } from "react";
import { AlertTriangle, CalendarClock, MoreVertical } from "lucide-react";

import { ChartCard } from "@/components/logs/primitives";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { BackupTypeBadge } from "@/components/backups/backup-badges";
import type { BackupJob } from "@/mocks/backups";
import { nextRunAfter } from "@/utils/nextRun";
import { formatCountdown } from "@/utils/backupStats";
import { firstCoveringMaintenanceWindow } from "@/mocks/backupRuns";

const DAY = 24 * 60 * 60 * 1000;
const EXACT = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });

interface UpcomingRun {
  id: string;
  job: BackupJob;
  atMs: number;
}

/** Next scheduled runs in the next 24h across enabled jobs (max 8). Flags maintenance conflicts with a link. */
export function UpcomingBackupsCard({ jobs, onExport }: { jobs: BackupJob[]; onExport: () => void }) {
  const rows = useMemo<UpcomingRun[]>(() => {
    const nowMs = Date.now();
    const horizon = nowMs + DAY;
    const upcoming: UpcomingRun[] = [];
    for (const job of jobs) {
      if (!job.enabled) continue;
      const next = nextRunAfter(job.schedule, nowMs);
      if (next == null || next > horizon) continue;
      upcoming.push({ id: `${job.id}-${next}`, job, atMs: next });
    }
    upcoming.sort((a, b) => a.atMs - b.atMs);
    return upcoming.slice(0, 8);
  }, [jobs]);

  return (
    <ChartCard
      title="Upcoming Backups (24h)"
      className="h-full min-h-[280px] p-4"
      actions={
        <div className="flex items-center gap-1">
          <span className="text-xs tabular-nums text-muted-foreground">{rows.length} scheduled</span>
          <AlertMenu
            label="Upcoming runs actions"
            align="end"
            width={220}
            trigger={
              <button type="button" aria-label="Upcoming runs actions" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <MoreVertical size={16} aria-hidden="true" />
              </button>
            }
            items={[
              { key: "scheduled", label: "Open Scheduled Tasks", onSelect: () => { window.location.href = "/scheduled-tasks?type=backup"; } },
              { key: "export", label: "Export schedule (CSV)", onSelect: onExport },
            ]}
          />
        </div>
      }
    >
      <ul className="divide-y divide-border/60">
        {rows.map(({ id, job, atMs }) => {
          const conflict = firstCoveringMaintenanceWindow([job.host], atMs, 90 * 60 * 1000);
          return (
            <li key={id} className="flex items-center gap-2 py-1.5">
              <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><CalendarClock size={14} /></span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-foreground" title={job.name}>{job.name}</span>
                <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">{job.host} · {EXACT.format(atMs)}</span>
              </span>
              <span className="ml-auto flex shrink-0 flex-col items-end gap-1">
                <span className="text-xs font-semibold tabular-nums text-foreground">{formatCountdown(atMs)}</span>
                {conflict ? (
                  <a
                    href={`/maintenance-windows/${encodeURIComponent(conflict.id)}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#D97706] hover:underline dark:text-amber-400"
                    title={`Overlaps maintenance window ${conflict.id}`}
                  >
                    <AlertTriangle size={11} aria-hidden="true" />Maintenance
                  </a>
                ) : (
                  <BackupTypeBadge type={job.type} />
                )}
              </span>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="py-6 text-center text-xs text-muted-foreground">No runs scheduled in the next 24h — check whether jobs are paused.</li>
        )}
      </ul>
    </ChartCard>
  );
}
