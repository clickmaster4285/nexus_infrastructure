"use client";

import { useMemo } from "react";
import { AlertCircle, CalendarCheck2 } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl } from "@/components/logs/primitives";
import { SCHEDULE_TIME_ZONES, WEEKDAY_LABELS, cronForSchedule, formatTime, validateCron, type ScheduleKind, type TaskSchedule } from "@/utils/formatSchedule";
import { nextRuns } from "@/utils/nextRun";
import { cn } from "@/lib/utils";

interface ScheduleBuilderProps {
  value: TaskSchedule;
  onChange: (schedule: TaskSchedule) => void;
}

const KIND_OPTIONS = ["Daily", "Weekly", "Monthly", "Cron"] as const;
const KIND_TO_KEY: Record<(typeof KIND_OPTIONS)[number], ScheduleKind> = {
  Daily: "daily", Weekly: "weekly", Monthly: "monthly", Cron: "cron",
};
const KEY_TO_KIND: Record<ScheduleKind, (typeof KIND_OPTIONS)[number]> = {
  daily: "Daily", weekly: "Weekly", monthly: "Monthly", cron: "Cron",
};

const TIME_INPUT = "h-9 rounded-lg border border-input bg-card px-2 text-[13px] tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Step 2 control: structured schedule editor with cron validation and a "Next 5 runs" preview. */
export function ScheduleBuilder({ value, onChange }: ScheduleBuilderProps) {
  const cronError = value.kind === "cron" ? validateCron(value.cron ?? "") : null;

  const setKind = (label: (typeof KIND_OPTIONS)[number]) => {
    const kind = KIND_TO_KEY[label];
    if (kind === value.kind) return;
    if (kind === "cron") onChange({ ...value, kind, cron: cronForSchedule(value) });
    else onChange({ ...value, kind, daysOfWeek: value.daysOfWeek ?? [1], dayOfMonth: value.dayOfMonth ?? 1 });
  };

  const setTime = (timeText: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(timeText);
    if (!match) return;
    onChange({ ...value, hour: Math.min(23, Number(match[1])), minute: Math.min(59, Number(match[2])) });
  };

  const preview = useMemo(() => {
    if (value.kind === "cron" && cronError) return [];
    return nextRuns(value, Date.now(), 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, cronError]);

  const toggleWeekday = (day: number) => {
    const current = value.daysOfWeek ?? [];
    const next = current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day].sort((a, b) => a - b);
    onChange({ ...value, daysOfWeek: next });
  };

  const fieldLabel = "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <div className="space-y-4">
      <div>
        <span className={fieldLabel}>Frequency</span>
        <SegmentedControl value={KEY_TO_KIND[value.kind]} options={KIND_OPTIONS} onChange={(label) => setKind(label as (typeof KIND_OPTIONS)[number])} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {value.kind !== "cron" && (
          <div>
            <label htmlFor="schedule-time" className={fieldLabel}>Time</label>
            <input
              id="schedule-time"
              type="time"
              value={formatTime(value.hour, value.minute)}
              onChange={(event) => setTime(event.target.value)}
              className={TIME_INPUT}
            />
          </div>
        )}

        {value.kind === "weekly" && (
          <div className="min-w-0">
            <span className={fieldLabel}>Days</span>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Days of week">
              {WEEKDAY_LABELS.map((label, day) => {
                const active = (value.daysOfWeek ?? []).includes(day);
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleWeekday(day)}
                    className={cn(
                      "h-8 w-9 rounded-md border text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {value.kind === "monthly" && (
          <div>
            <label htmlFor="schedule-dom" className={fieldLabel}>Day of month</label>
            <Select value={String(value.dayOfMonth ?? 1)} onValueChange={(day) => onChange({ ...value, dayOfMonth: Number(day) })}>
              <SelectTrigger id="schedule-dom" className="h-9 w-[92px] text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                  <SelectItem key={day} value={String(day)}>{day}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <label htmlFor="schedule-tz" className={fieldLabel}>Timezone</label>
          <Select value={value.timeZone} onValueChange={(timeZone) => onChange({ ...value, timeZone })}>
            <SelectTrigger id="schedule-tz" className="h-9 w-[180px] text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SCHEDULE_TIME_ZONES.map((timeZone) => <SelectItem key={timeZone} value={timeZone}>{timeZone}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {value.kind === "cron" && (
        <div>
          <label htmlFor="schedule-cron" className={fieldLabel}>Cron expression</label>
          <textarea
            id="schedule-cron"
            value={value.cron ?? ""}
            onChange={(event) => onChange({ ...value, cron: event.target.value })}
            rows={2}
            spellCheck={false}
            placeholder="0 2 * * *"
            aria-invalid={cronError ? true : undefined}
            aria-describedby={cronError ? "schedule-cron-error" : undefined}
            className={cn(
              "w-full resize-none rounded-lg border bg-card px-3 py-2 font-mono text-[12px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              cronError ? "border-[#DC2626] focus-visible:ring-[#DC2626]/40" : "border-input",
            )}
          />
          {cronError
            ? (
              <p id="schedule-cron-error" role="alert" className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#DC2626]">
                <AlertCircle size={11} aria-hidden />{cronError}
              </p>
            )
            : <p className="mt-1 text-[10px] text-muted-foreground">minute hour day-of-month month day-of-week</p>}
        </div>
      )}

      <div>
        <span className={fieldLabel}>Next 5 runs</span>
        {preview.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
            {value.kind === "cron" ? "Fix the cron expression to see upcoming runs." : "Select at least one day."}
          </p>
        ) : (
          <ol className="overflow-hidden rounded-lg border border-border">
            {preview.map((atMs, index) => (
              <li key={atMs} className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-1.5 text-[11px] first:border-t-0">
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <CalendarCheck2 size={12} aria-hidden className="text-[#16A34A]" />
                  {new Date(atMs).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                </span>
                <span className="tabular-nums text-muted-foreground">{new Date(atMs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} <span className="text-muted-foreground/70">· {value.timeZone}</span></span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
