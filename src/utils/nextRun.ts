/**
 * Next-run calculator for Scheduled Tasks.
 * Interprets the schedule object in its IANA timeZone (via Intl) and returns
 * absolute UTC millisecond timestamps. Used for the table's Next Run column,
 * the Upcoming Runs card, the editor's "Next 5 runs" preview and stats.
 */

import type { TaskSchedule } from "./formatSchedule";
import { validateCron } from "./formatSchedule";

interface ZonedParts { year: number; month: number; day: number; hour: number; minute: number; second: number }

function tzParts(tz: string, utcMs: number): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const map: Record<string, string> = {};
  for (const part of parts) if (part.type !== "literal") map[part.type] = part.value;
  const hour = Number(map.hour) % 24;
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day), hour, minute: Number(map.minute), second: Number(map.second) };
}

/** Offset (ms) of `tz` ahead of UTC at `utcMs` — positive for east of Greenwich. */
function tzOffsetMs(tz: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const map: Record<string, string> = {};
  for (const part of parts) if (part.type !== "literal") map[part.type] = part.value;
  const hour = Number(map.hour) % 24;
  const asUtc = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), hour, Number(map.minute), Number(map.second));
  return asUtc - utcMs;
}

/** UTC ms for a wall-clock time in `tz` (two-pass to settle DST offsets). */
function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = guess - tzOffsetMs(tz, guess);
  const refined = guess - tzOffsetMs(tz, utc);
  if (refined !== utc) utc = refined;
  return utc;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function* cronFieldValues(field: string, min: number, max: number): Generator<number> {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [base, stepRaw] = part.split("/");
    const step = stepRaw ? Number(stepRaw) : 1;
    if (base === "*") {
      for (let value = min; value <= max; value += step) values.add(value);
      continue;
    }
    const range = base.match(/^(\d+)-(\d+)$/);
    if (range) {
      const lo = Number(range[1]);
      const hi = Number(range[2]);
      for (let value = lo; value <= hi; value += step) values.add(value);
      continue;
    }
    values.add(Number(base));
  }
  yield* [...values].filter((value) => value >= min && value <= max).sort((a, b) => a - b);
}

function cronMatches(field: string, value: number, min: number, max: number): boolean {
  for (const candidate of cronFieldValues(field, min, max)) if (candidate === value) return true;
  return false;
}

const MAX_SCAN_DAYS = 400;

/** Next occurrence strictly after `fromMs`. Returns null when none found within the scan horizon. */
export function nextRunAfter(schedule: TaskSchedule, fromMs: number): number | null {
  const tz = schedule.timeZone || "UTC";
  const nowParts = tzParts(tz, fromMs);
  const startOfToday = zonedTimeToUtc(nowParts.year, nowParts.month, nowParts.day, 0, 0, tz);

  if (schedule.kind === "cron") {
    if (validateCron(schedule.cron ?? "")) return null;
    const [minuteField, hourField, domField, monthField, dowField] = (schedule.cron ?? "* * * * *").trim().split(/\s+/);
    const domRestricted = domField !== "*";
    const dowRestricted = dowField !== "*";
    for (let dayOffset = 0; dayOffset <= MAX_SCAN_DAYS; dayOffset += 1) {
      const dayUtc = startOfToday + dayOffset * 86_400_000;
      const parts = tzParts(tz, dayUtc + 12 * 3_600_000);
      const month = parts.month;
      const day = parts.day;
      const weekday = new Date(Date.UTC(parts.year, month - 1, day)).getUTCDay();
      if (!cronMatches(monthField, month, 1, 12)) continue;
      const domOk = cronMatches(domField, day, 1, 31);
      const dowOk = cronMatches(dowField, weekday, 0, 7) || (dowField.split(",").includes("7") && weekday === 0);
      // Standard cron semantics: restricted dom OR dow matches.
      const dayOk = domRestricted && dowRestricted ? domOk || dowOk : domRestricted ? domOk : dowRestricted ? dowOk : true;
      if (!dayOk) continue;
      const hours = [...cronFieldValues(hourField, 0, 23)];
      const minutes = [...cronFieldValues(minuteField, 0, 59)];
      for (const hour of hours) {
        for (const minute of minutes) {
          const candidate = zonedTimeToUtc(parts.year, parts.month, parts.day, hour, minute, tz);
          if (candidate > fromMs) return candidate;
        }
      }
    }
    return null;
  }

  for (let dayOffset = 0; dayOffset <= MAX_SCAN_DAYS; dayOffset += 1) {
    const dayUtc = startOfToday + dayOffset * 86_400_000;
    const parts = tzParts(tz, dayUtc + 12 * 3_600_000);
    let include = false;
    if (schedule.kind === "daily") {
      include = true;
    } else if (schedule.kind === "weekly") {
      const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
      include = (schedule.daysOfWeek ?? [1]).includes(weekday);
    } else if (schedule.kind === "monthly") {
      const target = Math.min(schedule.dayOfMonth ?? 1, daysInMonth(parts.year, parts.month));
      include = parts.day === target;
    }
    if (!include) continue;
    const candidate = zonedTimeToUtc(parts.year, parts.month, parts.day, schedule.hour, schedule.minute, tz);
    if (candidate > fromMs) return candidate;
  }
  return null;
}

/** Next `count` occurrences strictly after `fromMs`. */
export function nextRuns(schedule: TaskSchedule, fromMs: number, count: number): number[] {
  const results: number[] = [];
  let cursor = fromMs;
  for (let index = 0; index < count; index += 1) {
    const next = nextRunAfter(schedule, cursor);
    if (next == null) break;
    results.push(next);
    cursor = next;
  }
  return results;
}

/** All occurrences within (fromMs, toMs] — used to seed historical runs. */
export function occurrencesBetween(schedule: TaskSchedule, fromMs: number, toMs: number, limit = 400): number[] {
  const results: number[] = [];
  let cursor = fromMs;
  while (results.length < limit) {
    const next = nextRunAfter(schedule, cursor);
    if (next == null || next > toMs) break;
    results.push(next);
    cursor = next;
  }
  return results;
}
