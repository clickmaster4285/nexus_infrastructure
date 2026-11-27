import { describe, expect, it } from "vitest";

import { errorBudgetStats, fleetStatusForServices, formatBudget, statusForUptime, uptimeFromDowntime } from "@/lib/slaCalculations";

describe("uptimeFromDowntime", () => {
  it("is 100% with no downtime", () => {
    expect(uptimeFromDowntime(0, 30)).toBe(100);
  });

  it("computes uptime over a 30-day window", () => {
    // 30 days = 43,200 min; 43.2 min down = 0.1% -> 99.9%
    expect(uptimeFromDowntime(43.2, 30)).toBeCloseTo(99.9, 5);
  });

  it("clamps to the 0-100 range", () => {
    expect(uptimeFromDowntime(1_000_000, 1)).toBe(0);
    expect(uptimeFromDowntime(-10, 30)).toBe(100);
  });

  it("treats an empty window as fully up", () => {
    expect(uptimeFromDowntime(5, 0)).toBe(100);
  });
});

describe("statusForUptime", () => {
  it("is met at or above target", () => {
    expect(statusForUptime(99.9, 99.9)).toBe("met");
    expect(statusForUptime(99.95, 99.9)).toBe("met");
  });

  it("is at risk within 0.05 points below target", () => {
    expect(statusForUptime(99.86, 99.9)).toBe("at_risk");
  });

  it("is breached further below target", () => {
    expect(statusForUptime(99.8, 99.9)).toBe("breached");
  });
});

describe("errorBudgetStats", () => {
  it("reports a full budget when there is no downtime", () => {
    const stats = errorBudgetStats(0, 99.9, 30);
    expect(stats.totalMinutes).toBe(43.2);
    expect(stats.remainingPct).toBe(100);
    expect(stats.burnRate).toBe(0);
  });

  it("reports half the budget used", () => {
    const stats = errorBudgetStats(21.6, 99.9, 30);
    expect(stats.remainingPct).toBe(50);
    expect(stats.burnRate).toBe(0.5);
  });

  it("never reports negative remaining budget", () => {
    expect(errorBudgetStats(500, 99.9, 30).remainingPct).toBe(0);
  });
});

describe("formatBudget", () => {
  it("formats sub-hour values as minutes and seconds", () => {
    expect(formatBudget(43.2)).toBe("43m 12s");
  });

  it("formats hour+ values as hours and minutes", () => {
    expect(formatBudget(126 * 60 + 3)).toBe("126h 03m");
  });
});

describe("fleetStatusForServices", () => {
  it("is met when every service meets its target", () => {
    expect(fleetStatusForServices([{ currentUptime: 99.99, slaTarget: 99.9 }])).toEqual({ status: "met", breached: 0, label: "All services met" });
  });

  it("prioritises breaches over at-risk services", () => {
    const result = fleetStatusForServices([
      { currentUptime: 99.0, slaTarget: 99.9 },
      { currentUptime: 98.0, slaTarget: 99.9 },
      { currentUptime: 99.87, slaTarget: 99.9 },
    ]);
    expect(result).toEqual({ status: "breached", breached: 2, label: "2 services breached" });
  });

  it("reports at-risk services with singular wording", () => {
    expect(fleetStatusForServices([{ currentUptime: 99.87, slaTarget: 99.9 }]).label).toBe("1 service at risk");
  });
});
