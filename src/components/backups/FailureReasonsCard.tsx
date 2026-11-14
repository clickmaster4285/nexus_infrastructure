import { useMemo } from "react";
import { AlertOctagon, MoreVertical } from "lucide-react";

import { ChartCard } from "@/components/logs/primitives";
import { AlertMenu } from "@/components/alerts/alert-menu";
import type { BackupRun } from "@/mocks/backupRuns";
import { deriveFailureReasons } from "@/utils/backupStats";
import { cn } from "@/lib/utils";

const MAX_ROWS = 5;

/** Top 5 failure categories in the trailing 7 days. Rows link to the failed-jobs filter. */
export function FailureReasonsCard({ runs, onViewFailed, onExport }: { runs: BackupRun[]; onViewFailed: () => void; onExport: () => void }) {
  const reasons = useMemo(() => deriveFailureReasons(runs, 7), [runs]);
  const total = reasons.reduce((sum, reason) => sum + reason.count, 0);

  return (
    <ChartCard
      title="Failure Reasons (7d)"
      className="h-full min-h-[17.5rem] p-4"
      actions={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onViewFailed}
            className="inline-flex h-8 items-center rounded-md text-xs font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View failed ({total})
          </button>
          <AlertMenu
            label="Failure reasons actions"
            align="end"
            width={210}
            trigger={
              <button type="button" aria-label="Failure reasons actions" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <MoreVertical size={16} aria-hidden="true" />
              </button>
            }
            items={[{ key: "export", label: "Export failures (CSV)", onSelect: onExport }]}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-2 pt-1">
        {reasons.map((reason) => (
          <button
            key={reason.category}
            type="button"
            onClick={onViewFailed}
            className="group flex items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Show jobs that failed with ${reason.label}`}
          >
            <span className="w-24 shrink-0 truncate text-xs text-muted-foreground group-hover:text-foreground">{reason.label}</span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted" role="presentation">
              <div className="h-full rounded-full bg-red-400" style={{ width: `${reason.pct}%` }} />
            </div>
            <span className="w-7 shrink-0 text-right text-xs tabular-nums font-semibold text-foreground">{reason.count}</span>
          </button>
        ))}
        {reasons.length === 0 && (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
            <AlertOctagon size={13} aria-hidden="true" />
            No failures in the last 7 days.
          </p>
        )}
      </div>
      {reasons.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-rose-100 bg-rose-50/60 p-3 dark:border-rose-500/20 dark:bg-rose-500/10">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">Main signal</p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">{reasons[0].label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{reasons[0].pct}% of failures</p>
          </div>
          <div className="min-w-0 border-l border-rose-200 pl-3 dark:border-rose-500/25">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">Next step</p>
            <button type="button" onClick={onViewFailed} className="mt-1 text-left text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Review failed jobs →</button>
            <p className="mt-0.5 text-xs text-muted-foreground">Inspect affected hosts and retry.</p>
          </div>
        </div>
      )}
      {reasons.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recovery checklist</p>
          <div className="mt-2 divide-y divide-border/70">
            {[
              ["Verify credentials", "Check the backup service account and key rotation."],
              ["Inspect snapshot capacity", "Confirm the target storage has enough free space."],
              ["Check agent health", "Review offline agents before the next scheduled run."],
            ].map(([title, detail]) => (
              <button key={title} type="button" onClick={onViewFailed} className="flex w-full items-center justify-between gap-3 py-2 text-left first:pt-0 last:pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="min-w-0"><span className="block text-sm font-medium text-foreground">{title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span></span>
                <span className="shrink-0 text-sm font-semibold text-primary">Review →</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-auto border-t border-border pt-3 text-xs text-muted-foreground">Counting failed runs in the trailing 7 days &middot; click a row to open the failed jobs.</p>
    </ChartCard>
  );
}
