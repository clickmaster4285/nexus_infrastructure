"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";

import { ChartCard } from "@/components/logs/primitives";
import { ViewAllLink } from "@/components/shared/view-all-link";
import { TASK_TYPE_META } from "@/components/scheduled-tasks/task-badges";
import { cn } from "@/lib/utils";
import { formatCountdown, type UpcomingRun } from "@/utils/taskStats";

interface UpcomingRunsCardProps {
  upcoming: UpcomingRun[];
  onViewAll: () => void;
}

function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function exactTime(atMs: number): string {
  const date = new Date(atMs);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  return `${date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}, ${time}`;
}

/** Next 6 scheduled runs, compact rows. Footer pinned via mt-auto. */
export function UpcomingRunsCard({ upcoming, onViewAll }: UpcomingRunsCardProps) {
  const now = useNow();

  return (
    <ChartCard className="flex h-full min-w-0 flex-col rounded-xl p-5" title="Upcoming Runs (24h)">
      {upcoming.length === 0 ? (
        <div className="grid flex-1 place-items-center py-6 text-center">
          <div>
            <CalendarClock size={22} aria-hidden="true" className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-[0.8125rem] font-semibold text-foreground">Nothing scheduled</p>
            <p className="mt-0.5 text-xs text-muted-foreground">All tasks are paused or complete.</p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col divide-y divide-border/60">
          {upcoming.map((run) => {
            const meta = TASK_TYPE_META[run.type];
            const Icon = meta.icon;
            return (
              <li key={`${run.taskId}-${run.atMs}`} className="flex items-center gap-2 py-2">
                <span aria-hidden="true" className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", meta.iconClass)}>
                  <Icon size={14} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-semibold leading-tight text-foreground" title={run.name}>{run.name}</p>
                  <p className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">{meta.label} · {run.targetLabel}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full bg-blue-500/10 px-2 text-xs font-semibold tabular-nums text-blue-500 dark:bg-blue-500/15 dark:text-blue-300">
                    {formatCountdown(run.atMs, now)}
                  </span>
                  <p className="mt-0.5 whitespace-nowrap text-xs tabular-nums text-muted-foreground">{exactTime(run.atMs)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto border-t border-border pt-2">
        <ViewAllLink label="View all" onClick={onViewAll} />
      </div>
    </ChartCard>
  );
}
