import { describe, expect, it } from "vitest";

import { assessRpo, formatLag, formatRpoCell, rpoLagMinutes, tierCompliance } from "@/utils/rpoCalc";

const NOW = Date.UTC(2026, 10, 27, 12, 0, 0);
const minutesAgo = (minutes: number) => NOW - minutes * 60_000;

describe("rpoLagMinutes", () => {
  it("is null when the job never succeeded", () => {
    expect(rpoLagMinutes(null, NOW)).toBeNull();
  });

  it("returns whole minutes since the last success", () => {
    expect(rpoLagMinutes(minutesAgo(90.7), NOW)).toBe(90);
  });

  it("never goes negative for future timestamps", () => {
    expect(rpoLagMinutes(NOW + 60_000, NOW)).toBe(0);
  });
});

describe("assessRpo", () => {
  it("meets the target when lag is within it", () => {
    expect(assessRpo(minutesAgo(240), 240, NOW)).toEqual({ lagMinutes: 240, met: true });
  });

  it("misses the target when lag exceeds it", () => {
    expect(assessRpo(minutesAgo(241), 240, NOW)).toEqual({ lagMinutes: 241, met: false });
  });

  it("treats never-succeeded jobs as not met", () => {
    expect(assessRpo(null, 240, NOW)).toEqual({ lagMinutes: null, met: false });
  });
});

describe("formatLag", () => {
  it.each([
    [null, "—"],
    [45, "45m"],
    [60, "1h"],
    [372, "6h 12m"],
    [3120, "2d 4h"],
  ])("formats %s minutes as %s", (minutes, expected) => {
    expect(formatLag(minutes)).toBe(expected);
  });
});

describe("formatRpoCell", () => {
  it("shows whole-hour targets in hours", () => {
    expect(formatRpoCell(2220, 240)).toBe("1d 13h / 4h");
  });

  it("shows other targets in minutes", () => {
    expect(formatRpoCell(10, 15)).toBe("10m / 15m");
  });
});

describe("tierCompliance", () => {
  it("ignores unassessable jobs", () => {
    expect(tierCompliance([{ met: true }, { met: false }, { met: null }, { met: true }])).toEqual({ met: 2, total: 3, pct: 67 });
  });

  it("returns null pct for an empty tier", () => {
    expect(tierCompliance([{ met: null }])).toEqual({ met: 0, total: 0, pct: null });
  });
});
