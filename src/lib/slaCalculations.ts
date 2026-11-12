/**
 * Single source of truth for every uptime/SLA number on the page.
 * Pure functions — no React, no mock imports.
 */

export type SlaStatus = "met" | "at_risk" | "breached";

export const minutesInWindow = (days: number) => days * 24 * 60;

/** Uptime % from downtime minutes — the ONLY uptime formula on this page. */
export const uptimeFromDowntime = (downtimeMinutes: number, days: number): number => {
  const total = minutesInWindow(days);
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, (1 - downtimeMinutes / total) * 100));
};

/** Status from uptime vs target: met >= target, at_risk within 0.05%, else breached. */
export const statusForUptime = (uptime: number, target: number): SlaStatus => {
  if (uptime >= target) return "met";
  if (uptime >= target - 0.05) return "at_risk";
  return "breached";
};

export interface BudgetStats {
  totalMinutes: number;
  usedMinutes: number;
  remainingPct: number;
  burnRate: number;
  exhaustionDays: number | null;
}

export const errorBudgetStats = (downtimeMinutes: number, target: number, days: number): BudgetStats => {
  const totalMinutes = minutesInWindow(days) * (1 - target / 100);
  const usedMinutes = Math.max(0, downtimeMinutes);
  const remainingPct = totalMinutes > 0 ? Math.max(0, ((totalMinutes - usedMinutes) / totalMinutes) * 100) : 0;
  // Burn rate vs budget for the elapsed portion (full window here).
  const burnRate = totalMinutes > 0 ? usedMinutes / totalMinutes : 0;
  const remainingMinutes = Math.max(0, totalMinutes - usedMinutes);
  const dailyBurn = days > 0 ? usedMinutes / days : 0;
  const exhaustionDays = dailyBurn > 0 ? Math.ceil(remainingMinutes / dailyBurn) : remainingMinutes <= 0 ? null : days;
  return { totalMinutes: Number(totalMinutes.toFixed(1)), usedMinutes: Number(usedMinutes.toFixed(1)), remainingPct: Number(remainingPct.toFixed(1)), burnRate: Number(burnRate.toFixed(2)), exhaustionDays };
};

/** Format a duration in minutes as a compact human string: "44m 00s" style or "126h 03m". */
export const formatBudget = (minutes: number): string => {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = Math.floor(minutes % 60);
    return `${hours}h ${String(rest).padStart(2, "0")}m`;
  }
  const whole = Math.floor(minutes);
  const seconds = Math.round((minutes - whole) * 60);
  return `${whole}m ${String(seconds).padStart(2, "0")}s`;
};

export interface FleetSlaStatus {
  status: SlaStatus;
  /** Number of services breaching their SLA. */
  breached: number;
  /** Label ready for the KPI card / header badge. */
  label: string;
}

export const fleetStatusForServices = (services: Array<{ currentUptime: number; slaTarget: number }>): FleetSlaStatus => {
  let breached = 0;
  let atRisk = 0;
  for (const service of services) {
    const status = statusForUptime(service.currentUptime, service.slaTarget);
    if (status === "breached") breached += 1;
    else if (status === "at_risk") atRisk += 1;
  }
  if (breached > 0) return { status: "breached", breached, label: `${breached} service${breached > 1 ? "s" : ""} breached` };
  if (atRisk > 0) return { status: "at_risk", breached, label: `${atRisk} service${atRisk > 1 ? "s" : ""} at risk` };
  return { status: "met", breached: 0, label: "All services met" };
};
