/**
 * Schedule helpers for Scheduled Tasks.
 * Schedule is stored as an object (see `TaskSchedule` in mocks/scheduledTasks.ts);
 * the 5-field cron string is *derived* via `cronForSchedule`, never hand-written.
 * `formatSchedule` renders it in plain English.
 */

export type ScheduleKind = "daily" | "weekly" | "monthly" | "cron";

export interface TaskSchedule {
  kind: ScheduleKind;
  /** Hour (0-23) and minute (0-59) in `timeZone`. */
  hour: number;
  minute: number;
  /** weekly: 0-6 (Sun..Sat). */
  daysOfWeek?: number[];
  /** monthly: day of month (1-31). */
  dayOfMonth?: number;
  /** Raw 5-field cron entry, only when kind === "cron" (validated by ScheduleBuilder). */
  cron?: string;
  /** IANA time zone the schedule is anchored to, e.g. "Asia/Karachi". */
  timeZone: string;
}

export const SCHEDULE_TIME_ZONES = [
  "Asia/Karachi", "UTC", "Europe/London", "Europe/Helsinki",
  "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Singapore", "Australia/Sydney",
] as const;

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const pad2 = (value: number) => String(value).padStart(2, "0");

export function formatTime(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** Derive the 5-field cron expression for a schedule object. */
export function cronForSchedule(schedule: TaskSchedule): string {
  switch (schedule.kind) {
    case "daily":
      return `${schedule.minute} ${schedule.hour} * * *`;
    case "weekly": {
      const days = (schedule.daysOfWeek?.length ? [...schedule.daysOfWeek].sort((a, b) => a - b) : [1]).join(",");
      return `${schedule.minute} ${schedule.hour} * * ${days}`;
    }
    case "monthly":
      return `${schedule.minute} ${schedule.hour} ${schedule.dayOfMonth ?? 1} * *`;
    case "cron":
      return (schedule.cron ?? "* * * * *").trim();
  }
}

/** Validate a 5-field cron expression. Returns an error message or null when valid. */
export function validateCron(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "Cron expression is required.";
  const fields = text.split(/\s+/);
  if (fields.length !== 5) return "Expected 5 fields: minute hour day-of-month month day-of-week.";
  const ranges: Array<[number, number, string]> = [
    [0, 59, "minute"], [0, 23, "hour"], [1, 31, "day-of-month"], [1, 12, "month"], [0, 7, "day-of-week"],
  ];
  for (let index = 0; index < 5; index += 1) {
    const field = fields[index];
    const [min, max, label] = ranges[index];
    for (const part of field.split(",")) {
      const stepSplit = part.split("/");
      if (stepSplit.length > 2) return `Invalid step in ${label}: "${part}".`;
      const [base, stepRaw] = stepSplit;
      if (stepRaw !== undefined) {
        const step = Number(stepRaw);
        if (!Number.isInteger(step) || step < 1 || step > max) return `Invalid step in ${label}: "${part}".`;
      }
      if (base === "*") continue;
      const rangeMatch = base.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const lo = Number(rangeMatch[1]);
        const hi = Number(rangeMatch[2]);
        if (lo < min || hi > max || lo > hi) return `Range "${base}" is out of bounds for ${label} (${min}-${max}).`;
        continue;
      }
      if (!/^\d+$/.test(base)) return `Invalid value "${base}" in ${label}.`;
      const value = Number(base);
      if (value < min || value > max) return `Value ${value} is out of bounds for ${label} (${min}-${max}).`;
    }
  }
  return null;
}

/** Humanize low-level cron fields when we can't map back to a structured kind. */
function humanizeCron(raw: string): string {
  const fields = raw.trim().split(/\s+/);
  if (fields.length !== 5) return `Cron: ${raw.trim()}`;
  const [minute, hour, dom, month, dow] = fields;
  if (dom === "*" && month === "*" && dow === "*" && /^\d+$/.test(hour) && /^\d+$/.test(minute)) {
    return `Every day at ${formatTime(Number(hour), Number(minute))}`;
  }
  if (dom === "*" && month === "*" && dow !== "*" && /^\d+$/.test(hour) && /^\d+$/.test(minute)) {
    const names = dow.split(",").map((token) => {
      const value = Number(token) % 7;
      return WEEKDAY_LABELS[value] ?? token;
    });
    return `Weekly on ${names.join(", ")} at ${formatTime(Number(hour), Number(minute))}`;
  }
  if (dom !== "*" && month === "*" && dow === "*" && /^\d+$/.test(hour) && /^\d+$/.test(minute) && /^\d+$/.test(dom)) {
    return `Monthly on day ${Number(dom)} at ${formatTime(Number(hour), Number(minute))}`;
  }
  if (dom === "*" && month === "*" && dow === "*" && /^\d+$/.test(minute) && /^\*\/(\d+)$/.test(hour)) {
    return `Every ${hour.slice(2)} hours`;
  }
  if (dom === "*" && month === "*" && dow === "*" && /^\d+(,\d+)+$/.test(hour) && /^\d+$/.test(minute)) {
    const times = hour.split(",").map((token) => formatTime(Number(token), Number(minute))).join(", ");
    return `Daily at ${times}`;
  }
  if (dom === "*" && month === "*" && dow === "*" && minute.startsWith("*/") && hour === "*") {
    return `Every ${minute.slice(2)} minutes`;
  }
  return `Cron: ${raw.trim()}`;
}

/** Readable, human-facing schedule text, e.g. "Every day at 02:00". */
export function formatSchedule(schedule: TaskSchedule): string {
  const time = formatTime(schedule.hour, schedule.minute);
  switch (schedule.kind) {
    case "daily":
      return `Every day at ${time}`;
    case "weekly": {
      const days = (schedule.daysOfWeek?.length ? [...schedule.daysOfWeek].sort((a, b) => a - b) : [1])
        .map((day) => WEEKDAY_LABELS[((day % 7) + 7) % 7]);
      return `Weekly on ${days.join(", ")} at ${time}`;
    }
    case "monthly":
      return `Monthly on day ${schedule.dayOfMonth ?? 1} at ${time}`;
    case "cron":
      return humanizeCron(schedule.cron ?? "* * * * *");
  }
}

/** Secondary line under the readable text: derived cron + timezone. */
export function formatScheduleDetail(schedule: TaskSchedule): string {
  return `${cronForSchedule(schedule)} · ${schedule.timeZone}`;
}

/** Long-form description used in the editor's preview, e.g. "every Monday at 02:00 (Asia/Karachi)". */
export function formatScheduleLong(schedule: TaskSchedule): string {
  const time = formatTime(schedule.hour, schedule.minute);
  switch (schedule.kind) {
    case "daily":
      return `every day at ${time} (${schedule.timeZone})`;
    case "weekly": {
      const names = (schedule.daysOfWeek?.length ? [...schedule.daysOfWeek].sort((a, b) => a - b) : [1])
        .map((day) => WEEKDAY_FULL[((day % 7) + 7) % 7]);
      return `every ${names.join(" and ")} at ${time} (${schedule.timeZone})`;
    }
    case "monthly":
      return `on day ${schedule.dayOfMonth ?? 1} of every month at ${time} (${schedule.timeZone})`;
    case "cron":
      return `${formatSchedule(schedule)} (${schedule.timeZone})`;
  }
}
