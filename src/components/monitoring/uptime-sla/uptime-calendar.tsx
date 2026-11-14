import { useMemo } from "react";

import { cn } from "@/lib/utils";
import type { DailyUptime } from "@/mocks/uptimeSla";

interface UptimeCalendarProps {
  daily: DailyUptime[];
  target: number;
  /** Optional day filter — called on cell click. */
  onSelectDay?: (day: DailyUptime) => void;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** GitHub-style contribution heatmap: columns = weeks, rows = Mon..Sun. */
export function UptimeCalendar({ daily, target, onSelectDay }: UptimeCalendarProps) {
  // Group into weeks — rows = Mon..Sun, leading/trailing cells are grey.
  const weeks = useMemo(() => {
    if (daily.length === 0) return [];
    const first = new Date(daily[0].iso);
    // Monday-based weekday index (Mon=0 … Sun=6).
    const lead = (first.getDay() + 6) % 7;
    const cells: Array<DailyUptime | null> = Array.from({ length: lead }, () => null);
    cells.push(...daily);
    while (cells.length % 7 !== 0) cells.push(null);
    const buckets: Array<Array<DailyUptime | null>> = [];
    for (let index = 0; index < cells.length; index += 7) buckets.push(cells.slice(index, index + 7));
    return buckets;
  }, [daily]);

  const monthLabels = useMemo(() => {
    if (weeks.length === 0) return [];
    const labels: Array<{ index: number; label: string }> = [];
    let lastMonth = -1;
    for (let week = 0; week < weeks.length; week += 1) {
      const first = weeks[week].find((cell) => cell !== null);
      if (!first) continue;
      const month = new Date(first.iso).getMonth();
      if (month !== lastMonth) { labels.push({ index: week, label: new Date(first.iso).toLocaleDateString("en-GB", { month: "short" }) }); lastMonth = month; }
    }
    return labels;
  }, [weeks]);

  const toneFor = (uptime: number | null) => {
    if (uptime == null) return "bg-gray-200 dark:bg-slate-700";
    if (uptime >= target) return "bg-emerald-500 dark:bg-emerald-500";
    if (uptime >= target - 0.05) return "bg-amber-400 dark:bg-amber-400";
    return "bg-rose-500 dark:bg-rose-500";
  };

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="flex gap-[0.1875rem]">
        <div className="flex w-7 flex-col justify-between pt-4 text-[0.625rem] font-medium text-muted-foreground">
          {WEEKDAY_LABELS.map((label, index) => (
            <span key={label} className={cn(index % 2 === 0 ? "opacity-100" : "opacity-0")}>{label}</span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-4">
            {monthLabels.map(({ index, label }) => (
              <span key={`${label}-${index}`} className="absolute text-[0.625rem] font-medium text-muted-foreground" style={{ left: `calc(${index * (17 / Math.max(weeks.length, 1))}% + 0.125rem)` }}>{label}</span>
            ))}
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-[0.1875rem]" role="img" aria-label="Daily uptime heatmap, Monday to Sunday, last 120 days">
            {weeks.flat().map((day, index) => (
              <button
                key={day?.iso ?? `empty-${index}`}
                type="button"
                disabled={!day}
                onClick={() => day && onSelectDay?.(day)}
                title={day ? `${day.label} — ${day.uptime.toFixed(2)}% uptime · ${day.downtimeMinutes}m downtime · ${day.incidents} incident${day.incidents === 1 ? "" : "s"}` : "No data"}
                aria-label={day ? `${day.label}, ${day.uptime.toFixed(2)} percent uptime, ${day.downtimeMinutes} minutes downtime, ${day.incidents} incidents` : "No data"}
                className={cn("h-3.5 w-3.5 rounded-[0.1875rem] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", toneFor(day?.uptime ?? null))}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-muted-foreground">
        <span className="flex items-center gap-1.5"><i aria-hidden="true" className="h-3 w-3 rounded-[0.1875rem] bg-emerald-500" />&ge; {target}%</span>
        <span className="flex items-center gap-1.5"><i aria-hidden="true" className="h-3 w-3 rounded-[0.1875rem] bg-amber-400" />&lt; target</span>
        <span className="flex items-center gap-1.5"><i aria-hidden="true" className="h-3 w-3 rounded-[0.1875rem] bg-rose-500" />Breach</span>
        <span className="flex items-center gap-1.5"><i aria-hidden="true" className="h-3 w-3 rounded-[0.1875rem] bg-gray-200 dark:bg-slate-700" />No data</span>
      </div>
    </div>
  );
}
