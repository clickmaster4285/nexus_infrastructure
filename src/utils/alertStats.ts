import type { Alert, AlertSeverity } from "@/mocks/alerts";

export type AlertTabKey = "all" | "firing" | "acknowledged" | "resolved" | "silenced";

export type AlertKpiKey = "active" | "critical" | "warning" | "unacknowledged" | "mtta" | "resolved";

export interface TrendBucket {
  /** Short axis label, e.g. "14:00" (bucket start). */
  label: string;
  epochMs: number;
  critical: number;
  warning: number;
  info: number;
  total: number;
}

export interface NoisyRule {
  ruleId: string;
  name: string;
  severity: AlertSeverity;
  /** Alerts triggered for this rule in the last 24h. */
  count: number;
}

export interface AlertStats {
  /** Active = firing + acknowledged + silenced (not resolved). */
  active: number;
  activePrev: number;
  critical: number;
  criticalPrev: number;
  warning: number;
  warningPrev: number;
  unacknowledged: number;
  unacknowledgedPrev: number;
  /** Mean minutes between triggered and acknowledged (alerts acked in the last 24h). */
  mttaMinutes: number | null;
  mttaPrevMinutes: number | null;
  resolved24h: number;
  resolvedPrev24h: number;
  /** 12 buckets x 2h over the last 24h, stacked by severity. */
  trend: TrendBucket[];
  noisyRules: NoisyRule[];
  tabCounts: Record<AlertTabKey, number>;
  /** 8 buckets x 3h over the last 24h, for the KPI sparklines. */
  sparklines: Record<AlertKpiKey, number[]>;
  hosts: string[];
}

const HOUR_MS = 60 * 60 * 1000;

const pad2 = (value: number) => String(value).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "3h 12m" / "45m" / "2d 4h" style duration between two epochs. */
export function formatDuration(fromMs: number, toMs: number): string {
  const totalMinutes = Math.max(0, Math.round((toMs - fromMs) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${pad2(minutes)}m`;
  return `${minutes}m`;
}

/** "Nov 12, 2026, 14:32" — exact timestamp for tooltips and the drawer. */
export function formatDateTime(epochMs: number): string {
  const date = new Date(epochMs);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}, ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Duration label for a table row: time since trigger, or trigger → resolve. */
export function alertDuration(alert: Alert, nowMs: number): string {
  return formatDuration(alert.epochMs, alert.resolvedAt ? new Date(alert.resolvedAt).getTime() : nowMs);
}

function inWindow(epochMs: number, fromMs: number, toMs: number): boolean {
  return epochMs >= fromMs && epochMs < toMs;
}

function mttaFor(alerts: Alert[], fromMs: number, toMs: number): number | null {
  const samples = alerts
    .filter((alert) => alert.acknowledgedAt && inWindow(new Date(alert.acknowledgedAt).getTime(), fromMs, toMs))
    .map((alert) => (new Date(alert.acknowledgedAt as string).getTime() - alert.epochMs) / 60000);
  if (samples.length === 0) return null;
  return Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length);
}

function bucketize(alerts: Alert[], pick: (alert: Alert) => number | null, buckets: number, spanMs: number, nowMs: number): number[] {
  const out = new Array(buckets).fill(0) as number[];
  const step = spanMs / buckets;
  for (const alert of alerts) {
    const at = pick(alert);
    if (at == null) continue;
    const age = nowMs - at;
    if (age < 0 || age >= spanMs) continue;
    out[Math.min(buckets - 1, Math.floor(age / step))] += 1;
  }
  // Oldest bucket first so sparklines read left → right like a chart.
  return out.reverse();
}

/**
 * Derives every headline number for the Alerts page from a single
 * alerts array: KPIs (+ vs-previous-24h deltas), 24h stacked trend,
 * top noisy rules, tab counts, sparkline series and the host filter list.
 */
export function deriveAlertStats(all: Alert[], nowMs: number = Date.now()): AlertStats {
  const currentFrom = nowMs - 24 * HOUR_MS;
  const prevFrom = nowMs - 48 * HOUR_MS;

  const isActive = (alert: Alert) => alert.status !== "resolved";
  const active = all.filter(isActive);
  const prevActive = all.filter((alert) => isActive(alert) && alert.epochMs < currentFrom);
  const count = (alerts: Alert[], severity: AlertSeverity) => alerts.filter((alert) => alert.severity === severity).length;

  const resolvedCurrent = all.filter((alert) => alert.resolvedAt && inWindow(new Date(alert.resolvedAt).getTime(), currentFrom, nowMs));
  const resolvedPrev = all.filter((alert) => alert.resolvedAt && inWindow(new Date(alert.resolvedAt).getTime(), prevFrom, currentFrom));

  // 24h stacked trend, 2h buckets.
  const trend: TrendBucket[] = Array.from({ length: 12 }, (_, index) => ({
    label: "",
    epochMs: 0,
    critical: 0,
    warning: 0,
    info: 0,
    total: 0,
  }));
  for (const alert of all) {
    if (alert.epochMs < currentFrom) continue;
    const bucketIndex = 11 - Math.floor((nowMs - alert.epochMs) / (2 * HOUR_MS));
    const bucket = trend[Math.max(0, Math.min(11, bucketIndex))];
    bucket[alert.severity] += 1;
    bucket.total += 1;
  }
  const trendStart = nowMs - 24 * HOUR_MS;
  trend.forEach((bucket, index) => {
    bucket.epochMs = trendStart + index * 2 * HOUR_MS;
    const date = new Date(bucket.epochMs);
    bucket.label = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  });

  // Top noisy rules over the last 24h.
  const counts = new Map<string, NoisyRule>();
  for (const alert of all) {
    if (alert.epochMs < currentFrom) continue;
    const existing = counts.get(alert.ruleId);
    if (existing) existing.count += 1;
    else counts.set(alert.ruleId, { ruleId: alert.ruleId, name: alert.ruleName, severity: alert.severity, count: 1 });
  }
  const noisyRules = [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5);

  const tabCounts: Record<AlertTabKey, number> = {
    all: all.length,
    firing: all.filter((alert) => alert.status === "firing").length,
    acknowledged: all.filter((alert) => alert.status === "acknowledged").length,
    resolved: all.filter((alert) => alert.status === "resolved").length,
    silenced: all.filter((alert) => alert.status === "silenced").length,
  };

  const activeAlerts = active;
  const criticalActive = activeAlerts.filter((alert) => alert.severity === "critical");
  const warningActive = activeAlerts.filter((alert) => alert.severity === "warning");
  const firing = all.filter((alert) => alert.status === "firing");

  const sparklines: Record<AlertKpiKey, number[]> = {
    active: bucketize(activeAlerts, (alert) => alert.epochMs, 8, 24 * HOUR_MS, nowMs),
    critical: bucketize(criticalActive, (alert) => alert.epochMs, 8, 24 * HOUR_MS, nowMs),
    warning: bucketize(warningActive, (alert) => alert.epochMs, 8, 24 * HOUR_MS, nowMs),
    unacknowledged: bucketize(firing, (alert) => alert.epochMs, 8, 24 * HOUR_MS, nowMs),
    mtta: bucketize(all.filter((alert) => alert.acknowledgedAt), (alert) => new Date(alert.acknowledgedAt as string).getTime(), 8, 24 * HOUR_MS, nowMs),
    resolved: bucketize(all.filter((alert) => alert.resolvedAt), (alert) => new Date(alert.resolvedAt as string).getTime(), 8, 24 * HOUR_MS, nowMs),
  };

  return {
    active: activeAlerts.length,
    activePrev: prevActive.length,
    critical: criticalActive.length,
    criticalPrev: count(prevActive, "critical"),
    warning: warningActive.length,
    warningPrev: count(prevActive, "warning"),
    unacknowledged: firing.length,
    unacknowledgedPrev: prevActive.filter((alert) => alert.status === "firing").length,
    mttaMinutes: mttaFor(all, currentFrom, nowMs),
    mttaPrevMinutes: mttaFor(all, prevFrom, currentFrom),
    resolved24h: resolvedCurrent.length,
    resolvedPrev24h: resolvedPrev.length,
    trend,
    noisyRules,
    tabCounts,
    sparklines,
    hosts: [...new Set(all.map((alert) => alert.host))].sort(),
  };
}
