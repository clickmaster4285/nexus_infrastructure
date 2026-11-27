/**
 * Event Explorer mock data — single source of truth.
 *
 * Everything derives from EVENT_TOTALS and the seeded event generator:
 * trend buckets sum to their range totals, sources/hosts/locations/heatmap
 * allocate the same grand total, the donut reads severity counts directly.
 * Swap this module for an API service later — the exported shapes stay.
 */

export type EventSeverity = "Critical" | "Warning" | "Info" | "Debug";
export type EventStatus = "Open" | "Investigating" | "Acknowledged" | "Resolved";
export type EventInfrastructure = "Kubernetes" | "Virtual Machine" | "Network Device" | "Database" | "CI/CD Pipeline" | "Storage Array";

export interface EventOccurrence {
  at: string;
}

export interface EventRecord {
  id: string;
  /** ISO 8601 timestamp, relative to the current time. */
  at: string;
  epochMs: number;
  severity: EventSeverity;
  status: EventStatus;
  message: string;
  source: string;
  host: string;
  category: string;
  location: string;
  infrastructure: EventInfrastructure;
  /** Database backing the event, when the event is database-related. */
  database?: string;
  /** Number of raw events grouped into this record. */
  count: number;
  /** Mean time to resolution, minutes; null while open. */
  mttrMinutes: number | null;
  /** Assignee or null when unassigned. */
  assignee: string | null;
  /** Individual occurrences (for the expanded count view). */
  occurrences: EventOccurrence[];
  description: string;
  tags: string[];
}

/* ------------------------------------------------------------------ *
 * Canonical totals — every stat, chip, trend, donut and table derives
 * ------------------------------------------------------------------ */
export const EVENT_TOTALS = {
  total: 12_800,
  resolved: 12_488,
  open: 312,
  critical: 124,
  warning: 642,
  info: 872,
  debug: 11_162,
  mttrMinutes: 18,
} as const;

export const EVENT_SEVERITY_COUNTS: Record<EventSeverity, number> = {
  Critical: EVENT_TOTALS.critical,
  Warning: EVENT_TOTALS.warning,
  Info: EVENT_TOTALS.info,
  Debug: EVENT_TOTALS.debug,
};
export const EVENT_SEVERITY_TOTAL = EVENT_TOTALS.critical + EVENT_TOTALS.warning + EVENT_TOTALS.info + EVENT_TOTALS.debug; // 12,800 exactly

/* ------------------------------------------------------------------ *
 * Seeded RNG
 * ------------------------------------------------------------------ */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer partition of `total` across `weights`, largest remainder wins. Sums exactly to `total`. */
function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  const raw = weights.map((w) => (w / sum) * total);
  const floors = raw.map((v) => Math.floor(v));
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < order.length && remainder > 0; k += 1, remainder -= 1) out[order[k].i] += 1;
  return out;
}

const pad2 = (value: number) => String(value).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ------------------------------------------------------------------ *
 * Trend buckets — bucket sums exactly match their range severity totals
 * ------------------------------------------------------------------ */
export const TREND_RANGE_ORDER = ["1H", "6H", "12H", "24H", "7D"] as const;
export type TrendRangeKey = (typeof TREND_RANGE_ORDER)[number];

export const RANGE_TEXT: Record<TrendRangeKey, string> = {
  "1H": "Last 1 hour",
  "6H": "Last 6 hours",
  "12H": "Last 12 hours",
  "24H": "Last 24 hours",
  "7D": "Last 7 days",
};

export interface TrendBucket {
  label: string;
  time: string;
  epochMs: number;
  critical: number;
  warning: number;
  info: number;
  debug: number;
  total: number;
}

const RANGE_CONFIG: Record<TrendRangeKey, { buckets: number; spanMs: number; seed: number; total: number }> = {
  "1H": { buckets: 30, spanMs: 60 * 60 * 1000, seed: 11, total: Math.floor(EVENT_TOTALS.total / 168) },
  "6H": { buckets: 36, spanMs: 6 * 60 * 60 * 1000, seed: 22, total: Math.floor(EVENT_TOTALS.total / 28) },
  "12H": { buckets: 36, spanMs: 12 * 60 * 60 * 1000, seed: 33, total: Math.floor(EVENT_TOTALS.total / 14) },
  "24H": { buckets: 48, spanMs: 24 * 60 * 60 * 1000, seed: 44, total: Math.floor(EVENT_TOTALS.total / 7) },
  "7D": { buckets: 56, spanMs: 7 * 24 * 60 * 60 * 1000, seed: 55, total: EVENT_TOTALS.total },
};

const RANGE_SEVERITY_TOTALS: Record<TrendRangeKey, Record<EventSeverity, number>> = {
  "1H": { Critical: Math.floor(EVENT_TOTALS.critical / 168), Warning: Math.floor(EVENT_TOTALS.warning / 168), Info: Math.floor(EVENT_TOTALS.info / 168), Debug: Math.floor(EVENT_TOTALS.debug / 168) },
  "6H": { Critical: Math.floor(EVENT_TOTALS.critical / 28), Warning: Math.floor(EVENT_TOTALS.warning / 28), Info: Math.floor(EVENT_TOTALS.info / 28), Debug: Math.floor(EVENT_TOTALS.debug / 28) },
  "12H": { Critical: Math.floor(EVENT_TOTALS.critical / 14), Warning: Math.floor(EVENT_TOTALS.warning / 14), Info: Math.floor(EVENT_TOTALS.info / 14), Debug: Math.floor(EVENT_TOTALS.debug / 14) },
  "24H": { Critical: Math.floor(EVENT_TOTALS.critical / 7), Warning: Math.floor(EVENT_TOTALS.warning / 7), Info: Math.floor(EVENT_TOTALS.info / 7), Debug: Math.floor(EVENT_TOTALS.debug / 7) },
  "7D": { Critical: EVENT_TOTALS.critical, Warning: EVENT_TOTALS.warning, Info: EVENT_TOTALS.info, Debug: EVENT_TOTALS.debug },
};

function buildTrend(range: TrendRangeKey): TrendBucket[] {
  const config = RANGE_CONFIG[range];
  const rand = mulberry32(config.seed);
  const now = Date.now();
  const start = now - config.spanMs;
  const step = config.spanMs / config.buckets;
  const weights = Array.from({ length: config.buckets }, (_, index) => {
    const wave = 1 + 0.42 * Math.sin((index / config.buckets) * Math.PI * 4 + 0.6) + 0.18 * Math.sin((index / config.buckets) * Math.PI * 9 + 2.3);
    return Math.max(0.18, wave * (0.74 + rand() * 0.52));
  });
  const bucketTotals = allocate(config.total, weights);
  const severityTotals = RANGE_SEVERITY_TOTALS[range];
  const severityWeights = [
    Array.from({ length: config.buckets }, () => 0.72 + rand() * 0.56),
    Array.from({ length: config.buckets }, () => 0.78 + rand() * 0.44),
    Array.from({ length: config.buckets }, () => 0.85 + rand() * 0.3),
    Array.from({ length: config.buckets }, () => 0.9 + rand() * 0.2),
  ];
  const criticalBuckets = allocate(severityTotals.Critical, weights.map((w, i) => w * severityWeights[0][i]));
  const warningBuckets = allocate(severityTotals.Warning, weights.map((w, i) => w * severityWeights[1][i]));
  const infoBuckets = allocate(severityTotals.Info, weights.map((w, i) => w * severityWeights[2][i]));
  const debugBuckets = bucketTotals.map((total, i) => Math.max(0, total - criticalBuckets[i] - warningBuckets[i] - infoBuckets[i]));
  return bucketTotals.map((total, index) => {
    const epoch = start + index * step;
    const date = new Date(epoch);
    const label = range === "7D" ? `${date.getDate()} ${MONTHS[date.getMonth()]}` : `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    return { label, time: new Date(epoch).toISOString(), epochMs: epoch, critical: criticalBuckets[index], warning: warningBuckets[index], info: infoBuckets[index], debug: debugBuckets[index], total };
  });
}

export const EVENT_TRENDS: Record<TrendRangeKey, TrendBucket[]> = {
  "1H": buildTrend("1H"),
  "6H": buildTrend("6H"),
  "12H": buildTrend("12H"),
  "24H": buildTrend("24H"),
  "7D": buildTrend("7D"),
};

/* ------------------------------------------------------------------ *
 * Sources / hosts / locations — allocate the same grand total
 * ------------------------------------------------------------------ */
function allocateSources(weights: Array<{ name: string; weight: number; icon?: string }>, total = EVENT_TOTALS.total) {
  const allocated = allocate(total, weights.map((w) => w.weight));
  return weights.map((w, i) => ({ name: w.name, count: allocated[i], pct: (allocated[i] / total) * 100 }));
}

export const EVENT_SOURCES = allocateSources([
  { name: "System", weight: 28.4 },
  { name: "Application", weight: 23.4 },
  { name: "Database", weight: 18.7 },
  { name: "Network", weight: 13.9 },
  { name: "Security", weight: 8.6 },
  { name: "Storage", weight: 7.0 },
]).sort((a, b) => b.count - a.count);

export const EVENT_HOSTS = allocateSources([
  { name: "api-server-01", weight: 24 },
  { name: "web-app-01", weight: 21 },
  { name: "db-01", weight: 18 },
  { name: "app-server-02", weight: 15 },
  { name: "web-02", weight: 12 },
  { name: "storage-01", weight: 10 },
]).sort((a, b) => b.count - a.count);

export const EVENT_LOCATIONS = [
  { name: "US-East · Virginia", count: 3430 },
  { name: "EU-West · Frankfurt", count: 2760 },
  { name: "AP-South · Singapore", count: 2190 },
  { name: "EU-Central · Ireland", count: 1860 },
  { name: "US-West · Oregon", count: 1360 },
  { name: "AP-Southeast · Sydney", count: 1100 },
];

/* Heatmap: 7 days x 24 hours, cell counts sum exactly to EVENT_TOTALS.total */
export const EVENT_HEATMAP: number[][] = (() => {
  const rand = mulberry32(20261111);
  const weights = Array.from({ length: 7 * 24 }, (_, index) => {
    const hour = index % 24;
    const day = Math.floor(index / 24);
    const hourWeight = hour >= 8 && hour <= 19 ? 1.35 : hour <= 6 ? 0.45 : 1;
    const dayWeight = day === 6 ? 0.72 : day === 5 ? 0.85 : 1;
    return hourWeight * dayWeight * (0.6 + rand() * 0.8);
  });
  const cells = allocate(EVENT_TOTALS.total, weights);
  const rows: number[][] = [];
  for (let day = 0; day < 7; day += 1) rows.push(cells.slice(day * 24, day * 24 + 24));
  return rows;
})();

/* ------------------------------------------------------------------ *
 * 120 seeded visible events (table/detail rows)
 * ------------------------------------------------------------------ */
const EVENT_SPECS: Array<{ severity: EventSeverity; status: EventStatus; category: string; source: string; message: string }> = [
  { severity: "Critical", status: "Open", category: "Availability", source: "System", message: "Primary node health check failed" },
  { severity: "Critical", status: "Open", category: "Database", source: "Database", message: "Database connection lost. Retrying..." },
  { severity: "Critical", status: "Investigating", category: "Storage", source: "Storage", message: "Storage volume almost full: 94%" },
  { severity: "Critical", status: "Acknowledged", category: "Availability", source: "System", message: "API latency SLO breach: p99 above 2s" },
  { severity: "Warning", status: "Open", category: "Performance", source: "Application", message: "Payment API response delayed: 2.3s" },
  { severity: "Warning", status: "Investigating", category: "Performance", source: "Application", message: "High memory usage: 89%" },
  { severity: "Warning", status: "Open", category: "Storage", source: "System", message: "Disk utilization reached 82%" },
  { severity: "Warning", status: "Resolved", category: "SSL", source: "Security", message: "Certificate expires in 12 days" },
  { severity: "Warning", status: "Acknowledged", category: "Queue", source: "Application", message: "Queue depth elevated: 1,240 pending jobs" },
  { severity: "Info", status: "Resolved", category: "Authentication", source: "Auth", message: "User login successful" },
  { severity: "Info", status: "Resolved", category: "Backup", source: "Database", message: "Scheduled backup completed" },
  { severity: "Info", status: "Resolved", category: "Deployment", source: "Deployment", message: "New deployment completed v2.14.2" },
  { severity: "Info", status: "Resolved", category: "Maintenance", source: "System", message: "Scheduled maintenance window started" },
  { severity: "Info", status: "Resolved", category: "Configuration", source: "System", message: "Config change applied: rate_limit=800" },
  { severity: "Debug", status: "Resolved", category: "Cache", source: "Cache", message: "Cache refreshed successfully" },
  { severity: "Debug", status: "Resolved", category: "Network", source: "Network", message: "Connection pool stats: 412 of 600 used" },
  { severity: "Debug", status: "Resolved", category: "Network", source: "Network", message: "GC pause: 12ms" },
  { severity: "Debug", status: "Resolved", category: "Cache", source: "Cache", message: "Feature flag evaluated checkout_v2=true" },
];

const HOSTNAMES = ["api-server-01", "web-app-01", "db-01", "app-server-02", "web-02", "storage-01", "edge-01", "cache-01", "worker-01", "pay-01"];
const HOST_LOCATION: Record<string, string> = {
  "api-server-01": "US-East · Virginia",
  "web-app-01": "US-East · Virginia",
  "db-01": "EU-West · Frankfurt",
  "app-server-02": "EU-West · Frankfurt",
  "web-02": "US-West · Oregon",
  "storage-01": "AP-South · Singapore",
  "edge-01": "EU-Central · Ireland",
  "cache-01": "AP-South · Singapore",
  "worker-01": "US-West · Oregon",
  "pay-01": "AP-Southeast · Sydney",
};
const INFRASTRUCTURE: EventInfrastructure[] = ["Kubernetes", "Virtual Machine", "Network Device", "Database", "CI/CD Pipeline", "Storage Array"];
const INFRA_WEIGHTS = [0.3, 0.24, 0.1, 0.16, 0.1, 0.1];
const ASSIGNEES = ["sre@nexus.io", "ops@nexus.io", null] as const;

const DB_POOL = ["my_app_db", "my_app_db", "analytics_db", "ecommerce_db", "my_app_db", "hr_db"];

function buildEvents(): EventRecord[] {
  const rand = mulberry32(20261111);
  const now = Date.now();
  const events: EventRecord[] = [];
  let dbCursor = 0;
  for (let index = 0; index < 120; index += 1) {
    const spec = EVENT_SPECS[Math.floor(rand() ** 1.6 * EVENT_SPECS.length)];
    const minutesAgo = Math.floor(rand() * 60 * 18); // within the last 18 hours
    const epochMs = now - minutesAgo * 60 * 1000 - Math.floor(rand() * 60 * 1000);
    const count = spec.severity === "Debug" ? Math.max(1, Math.floor(rand() ** 3 * 240)) : spec.severity === "Critical" ? Math.floor(rand() * 12) + 1 : Math.floor(rand() ** 2 * 48) + 1;
    const occurrences: EventOccurrence[] = Array.from({ length: Math.min(count, 25) }, () => ({
      at: new Date(epochMs + Math.floor(rand() * 60 * 60 * 1000)).toISOString(),
    }));
    const host = HOSTNAMES[Math.floor(rand() * HOSTNAMES.length)];
    const infraRand = rand();
    let infraCursor = 0;
    let infrastructure: EventInfrastructure = "Kubernetes";
    for (let i = 0; i < INFRASTRUCTURE.length; i += 1) {
      infraCursor += INFRA_WEIGHTS[i];
      if (infraRand <= infraCursor) { infrastructure = INFRASTRUCTURE[i]; break; }
    }
    const isDatabaseRelated = spec.category === "Database" || spec.source === "Database";
    const database = isDatabaseRelated ? DB_POOL[dbCursor++ % DB_POOL.length] : undefined;
    events.push({
      id: `EVT-2026-${String(48000 + index).padStart(5, "0")}`,
      at: new Date(epochMs).toISOString(),
      epochMs,
      severity: spec.severity,
      status: spec.status,
      message: spec.message,
      source: spec.source,
      host,
      category: spec.category,
      location: HOST_LOCATION[host] ?? "US-East · Virginia",
      infrastructure,
      database,
      count,
      mttrMinutes: spec.status === "Resolved" ? Math.floor(rand() * 60) + 3 : null,
      assignee: ASSIGNEES[index % ASSIGNEES.length],
      occurrences,
      description: `${spec.message} on ${host}. Detected by the NEXUS collector and correlated across ${infrastructure} telemetry.${count > 1 ? ` Grouped from ${count} raw events.` : ""}`,
      tags: [spec.category.toLowerCase(), spec.source.toLowerCase(), spec.severity === "Debug" ? "noise" : "actionable"],
    });
  }
  return events.sort((a, b) => b.epochMs - a.epochMs);
}

export const EVENT_RECORDS: EventRecord[] = buildEvents();

/* Derived views over the record set */
export function relativeTime(epochMs: number): string {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
  if (diffSeconds < 60) return "just now";
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function fullTimestamp(epochMs: number, utc: boolean): string {
  const date = new Date(epochMs);
  const pad = (value: number) => String(value).padStart(2, "0");
  const h = utc ? date.getUTCHours() : date.getHours();
  const m = utc ? date.getUTCMinutes() : date.getMinutes();
  const s = utc ? date.getUTCSeconds() : date.getSeconds();
  const stamp = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  return utc ? `${stamp} UTC` : `${stamp} local`;
}

/* ------------------------------------------------------------------ *
 * Weekly per-day severity aggregates — buckets grouped from 7D range,
 * so each day sums exactly to the range severity totals.
 * ------------------------------------------------------------------ */
export interface WeekDayBucket {
  label: string;
  date: string;
  critical: number;
  warning: number;
  info: number;
  debug: number;
  total: number;
}

export const EVENT_WEEK_DAYS: WeekDayBucket[] = (() => {
  const trend = EVENT_TRENDS["7D"];
  const bucketsPerDay = trend.length / 7;
  const result: WeekDayBucket[] = [];
  for (let day = 0; day < 7; day += 1) {
    const slice = trend.slice(Math.round(day * bucketsPerDay), Math.round((day + 1) * bucketsPerDay));
    const sum = (key: "critical" | "warning" | "info" | "debug" | "total") => slice.reduce((acc, bucket) => acc + bucket[key], 0);
    const date = new Date(slice[0].epochMs);
    result.push({
      label: date.toLocaleDateString("en-GB", { weekday: "short" }),
      date: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      critical: sum("critical"),
      warning: sum("warning"),
      info: sum("info"),
      debug: sum("debug"),
      total: sum("total"),
    });
  }
  return result;
})();

/* ------------------------------------------------------------------ *
 * Top database-backed event sources (canonical counts, click filters table)
 * ------------------------------------------------------------------ */
export const EVENT_DB_SOURCES = [
  { name: "my_app_db", count: 412 },
  { name: "analytics_db", count: 305 },
  { name: "ecommerce_db", count: 268 },
  { name: "hr_db", count: 190 },
];

/** Week-over-week severity deltas (mock), positive good/bad follows response-time logic: down is good for severity volume. */
export const EVENT_WEEKLY_DELTAS = [
  { severity: "Critical" as const, changePct: 8, good: "down" as const, tone: "rose" as const },
  { severity: "Warning" as const, changePct: -3, good: "down" as const, tone: "amber" as const },
  { severity: "Info" as const, changePct: 1, good: "up" as const, tone: "blue" as const },
];

/** Critical/Warning split per source — sums to the canonical totals (124 / 642). */
export const EVENT_SOURCE_SEVERITY: Record<string, { critical: number; warning: number }> = {
  System: { critical: 42, warning: 210 },
  Application: { critical: 26, warning: 165 },
  Database: { critical: 34, warning: 138 },
  Network: { critical: 8, warning: 56 },
  Security: { critical: 8, warning: 38 },
  Storage: { critical: 6, warning: 35 },
};

/** Critical/Warning split per host — sums to the canonical totals (124 / 642). */
export const EVENT_HOST_SEVERITY: Record<string, { critical: number; warning: number }> = {
  "api-server-01": { critical: 34, warning: 158 },
  "web-app-01": { critical: 28, warning: 142 },
  "db-01": { critical: 30, warning: 136 },
  "app-server-02": { critical: 14, warning: 84 },
  "web-02": { critical: 10, warning: 68 },
  "storage-01": { critical: 8, warning: 54 },
};

/** Resolution split over the non-debug window (1,638 events) — matches the donut total. */
export const EVENT_RESOLUTION_STATUS = [
  { label: "Resolved", count: 1204, tone: "emerald" as const },
  { label: "Acknowledged", count: 312, tone: "amber" as const },
  { label: "Open", count: 122, tone: "rose" as const },
];
export const EVENT_RESOLUTION_TOTAL = EVENT_RESOLUTION_STATUS.reduce((sum, item) => sum + item.count, 0);

/** Peak hour derived from the heatmap — the busiest hour across the week. */
export const EVENT_PEAK_HOUR = (() => {
  const perHour = Array.from({ length: 24 }, (_, hour) => EVENT_HEATMAP.reduce((sum, row) => sum + row[hour], 0));
  const max = Math.max(...perHour);
  const hour = perHour.indexOf(max);
  return { hour, count: max };
})();
