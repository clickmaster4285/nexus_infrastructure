import { describe, expect, it } from "vitest";

import { cronForSchedule, formatSchedule, formatScheduleLong, validateCron, type TaskSchedule } from "@/utils/formatSchedule";
import { nextRunAfter, nextRuns } from "@/utils/nextRun";

const schedule = (overrides: Partial<TaskSchedule>): TaskSchedule => ({ kind: "daily", hour: 2, minute: 0, timeZone: "UTC", ...overrides });

describe("cronForSchedule", () => {
  it("derives cron for each schedule kind", () => {
    expect(cronForSchedule(schedule({ kind: "daily", hour: 2, minute: 30 }))).toBe("30 2 * * *");
    expect(cronForSchedule(schedule({ kind: "weekly", daysOfWeek: [5, 1, 3] }))).toBe("0 2 * * 1,3,5");
    expect(cronForSchedule(schedule({ kind: "monthly", dayOfMonth: 15 }))).toBe("0 2 15 * *");
    expect(cronForSchedule(schedule({ kind: "cron", cron: "  */5 * * * *  " }))).toBe("*/5 * * * *");
  });
});

describe("validateCron", () => {
  it.each(["* * * * *", "*/15 * * * *", "0 2 * * 1-5", "0 0,12 1 * *", "0 0 * * 7"])("accepts %s", (expr) => {
    expect(validateCron(expr)).toBeNull();
  });

  it.each([
    ["", "required"],
    ["* * * *", "Expected 5 fields"],
    ["60 * * * *", "out of bounds for minute"],
    ["0 24 * * *", "out of bounds for hour"],
    ["0 0 0 * *", "out of bounds for day-of-month"],
    ["0 0 * * 5-1", "out of bounds for day-of-week"],
    ["*/0 * * * *", "Invalid step"],
    ["a * * * *", "Invalid value"],
  ])("rejects %j", (expr, message) => {
    expect(validateCron(expr)).toContain(message);
  });
});

describe("formatSchedule", () => {
  it("describes structured schedules", () => {
    expect(formatSchedule(schedule({ kind: "daily" }))).toBe("Every day at 02:00");
    expect(formatSchedule(schedule({ kind: "weekly", daysOfWeek: [3, 1] }))).toBe("Weekly on Mon, Wed at 02:00");
    expect(formatSchedule(schedule({ kind: "monthly", dayOfMonth: 1 }))).toBe("Monthly on day 1 at 02:00");
  });

  it.each([
    ["*/10 * * * *", "Every 10 minutes"],
    ["0 */6 * * *", "Every 6 hours"],
    ["30 8,20 * * *", "Daily at 08:30, 20:30"],
    ["15 3 1 * *", "Monthly on day 1 at 03:15"],
    ["0 9 1 1 *", "Cron: 0 9 1 1 *"],
  ])("humanises cron %s", (cron, expected) => {
    expect(formatSchedule(schedule({ kind: "cron", cron }))).toBe(expected);
  });

  it("includes the time zone in the long form", () => {
    expect(formatScheduleLong(schedule({ kind: "weekly", daysOfWeek: [1], timeZone: "Asia/Karachi" }))).toBe("every Monday at 02:00 (Asia/Karachi)");
  });
});

describe("nextRunAfter", () => {
  // Fri 27 Nov 2026, 12:00 UTC
  const FROM = Date.UTC(2026, 10, 27, 12, 0);

  it("returns the next daily run later the same day", () => {
    expect(nextRunAfter(schedule({ hour: 18 }), FROM)).toBe(Date.UTC(2026, 10, 27, 18, 0));
  });

  it("rolls over to tomorrow once today's run has passed", () => {
    expect(nextRunAfter(schedule({ hour: 2 }), FROM)).toBe(Date.UTC(2026, 10, 28, 2, 0));
  });

  it("is strictly after the reference time", () => {
    expect(nextRunAfter(schedule({ hour: 12 }), FROM)).toBe(Date.UTC(2026, 10, 28, 12, 0));
  });

  it("anchors the wall-clock time to the schedule's time zone", () => {
    // 02:00 in Karachi (UTC+5) = 21:00 UTC the previous day
    expect(nextRunAfter(schedule({ hour: 2, timeZone: "Asia/Karachi" }), FROM)).toBe(Date.UTC(2026, 10, 27, 21, 0));
  });

  it("handles DST: 09:00 New York is 14:00 UTC in winter and 13:00 UTC in summer", () => {
    expect(nextRunAfter(schedule({ hour: 9, timeZone: "America/New_York" }), FROM)).toBe(Date.UTC(2026, 10, 27, 14, 0));
    expect(nextRunAfter(schedule({ hour: 9, timeZone: "America/New_York" }), Date.UTC(2026, 6, 1, 0, 0))).toBe(Date.UTC(2026, 6, 1, 13, 0));
  });

  it("finds the next matching weekday", () => {
    // From Friday, next Monday run is 30 Nov
    expect(nextRunAfter(schedule({ kind: "weekly", daysOfWeek: [1] }), FROM)).toBe(Date.UTC(2026, 10, 30, 2, 0));
  });

  it("clamps monthly day 31 to the last day of short months", () => {
    expect(nextRunAfter(schedule({ kind: "monthly", dayOfMonth: 31 }), FROM)).toBe(Date.UTC(2026, 10, 30, 2, 0));
  });

  it("follows cron expressions", () => {
    expect(nextRunAfter(schedule({ kind: "cron", cron: "*/15 * * * *" }), FROM)).toBe(Date.UTC(2026, 10, 27, 12, 15));
  });

  it("returns null for an invalid cron", () => {
    expect(nextRunAfter(schedule({ kind: "cron", cron: "nope" }), FROM)).toBeNull();
  });
});

describe("nextRuns", () => {
  it("returns consecutive occurrences", () => {
    const runs = nextRuns(schedule({ kind: "cron", cron: "0 */6 * * *" }), Date.UTC(2026, 10, 27, 12, 0), 3);
    expect(runs).toEqual([Date.UTC(2026, 10, 27, 18, 0), Date.UTC(2026, 10, 28, 0, 0), Date.UTC(2026, 10, 28, 6, 0)]);
  });
});
