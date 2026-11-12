/**
 * Logs Explorer mock data — single source of truth.
 *
 * Everything derives from the constants in LOG_TOTALS and the seeded sample
 * generator: trend buckets sum to the range totals, LEVEL_COUNTS sums to the
 * grand total, Top Services / Top Patterns are scaled so their counts add up
 * to the errors total. To swap in a real API later, replace the fetch layer
 * in `useLogs` — the types and derived shapes stay the same.
 */

export type LogLevel = "ERROR" | "WARNING" | "INFO" | "DEBUG";

export interface LogEntry {
  id: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Epoch milliseconds, used for sorting and range math. */
  epochMs: number;
  level: LogLevel;
  service: string;
  host: string;
  environment: string;
  message: string;
  tags: string[];
  traceId: string;
  source: string;
  raw: Record<string, unknown>;
}

/* ------------------------------------------------------------------ *
 * Canonical totals — every stat, chip, trend and chart derives from these.
 * ------------------------------------------------------------------ */
export const LOG_TOTALS = {
  total: 48_742_893,
  parsed: 48_100_000,
  parseFailures: 600_000,
  errors: 124_500,
  warnings: 268_700,
  logRate: 564,
} as const;

/** Info/Debug split ratio derived once from the sample; keeps LEVEL_COUNTS summing exactly to TOTAL. */
const SAMPLE_INFO_SHARE = 0.66;
const REST = LOG_TOTALS.total - LOG_TOTALS.errors - LOG_TOTALS.warnings;
const INFO_COUNT = Math.round(REST * SAMPLE_INFO_SHARE);
export const LEVEL_COUNTS: Record<LogLevel, number> = {
  ERROR: LOG_TOTALS.errors,
  WARNING: LOG_TOTALS.warnings,
  INFO: INFO_COUNT,
  DEBUG: REST - INFO_COUNT,
};

export const TREND_RANGE_ORDER = ["1H", "6H", "12H", "24H", "7D"] as const;
export type TrendRangeKey = (typeof TREND_RANGE_ORDER)[number];

export interface TrendBucket {
  /** Short axis label, e.g. "13:55" (hourly ranges) or "12 Nov" (7D). */
  label: string;
  /** Full bucket start, ISO — used by the tooltip title. */
  time: string;
  epochMs: number;
  error: number;
  warning: number;
  info: number;
  debug: number;
  total: number;
}

const RANGE_TOTAL: Record<TrendRangeKey, number> = {
  "1H": Math.floor(LOG_TOTALS.total / 168),
  "6H": Math.floor(LOG_TOTALS.total / 28),
  "12H": Math.floor(LOG_TOTALS.total / 14),
  "24H": Math.floor(LOG_TOTALS.total / 7),
  "7D": LOG_TOTALS.total,
};

export const RANGE_TEXT: Record<TrendRangeKey, string> = {
  "1H": "Last 1 hour",
  "6H": "Last 6 hours",
  "12H": "Last 12 hours",
  "24H": "Last 24 hours",
  "7D": "Last 7 days",
};

const RANGE_CONFIG: Record<TrendRangeKey, { buckets: number; spanMs: number; seed: number }> = {
  "1H": { buckets: 30, spanMs: 60 * 60 * 1000, seed: 101 },
  "6H": { buckets: 36, spanMs: 6 * 60 * 60 * 1000, seed: 202 },
  "12H": { buckets: 36, spanMs: 12 * 60 * 60 * 1000, seed: 303 },
  "24H": { buckets: 48, spanMs: 24 * 60 * 60 * 1000, seed: 404 },
  "7D": { buckets: 56, spanMs: 7 * 24 * 60 * 60 * 1000, seed: 505 },
};

/* ------------------------------------------------------------------ *
 * Seeded RNG (mulberry32) — deterministic output on every load.
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

/** Distributes `total` integer units across `weights` using largest remainder rounding. Sum is exactly `total`. */
function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  const raw = weights.map((w) => (w / sum) * total);
  const floors = raw.map((value) => Math.floor(value));
  let remainder = total - floors.reduce((acc, value) => acc + value, 0);
  const byFraction = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);
  const out = [...floors];
  for (let k = 0; k < byFraction.length && remainder > 0; k += 1, remainder -= 1) {
    out[byFraction[k].index] += 1;
  }
  return out;
}

const pad2 = (value: number) => String(value).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatBucketTime(epochMs: number, range: TrendRangeKey): string {
  const date = new Date(epochMs);
  if (range === "7D") return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function buildTrend(range: TrendRangeKey): TrendBucket[] {
  const { buckets, spanMs, seed } = RANGE_CONFIG[range];
  const rand = mulberry32(seed);
  const now = Date.now();
  const start = now - spanMs;
  const step = spanMs / buckets;

  // Two sine waves + noise produce a realistic load shape.
  const weights = Array.from({ length: buckets }, (_, index) => {
    const wave = 1 + 0.42 * Math.sin((index / buckets) * Math.PI * 4 + 0.7) + 0.18 * Math.sin((index / buckets) * Math.PI * 9 + 2.1);
    return Math.max(0.18, wave * (0.74 + rand() * 0.52));
  });
  const bucketTotals = allocate(RANGE_TOTAL[range], weights);

  // Level split with per-bucket jitter; debug absorbs the rounding so buckets stay exact.
  return bucketTotals.map((bucketTotal, index) => {
    const epochStart = start + index * step;
    const jitter = 0.78 + rand() * 0.44;
    const error = Math.max(0, Math.round(bucketTotal * 0.0026 * jitter));
    const warning = Math.max(0, Math.round(bucketTotal * 0.0055 * (0.8 + rand() * 0.4)));
    const info = Math.max(0, Math.round(bucketTotal * 0.662 * (0.85 + rand() * 0.3)));
    const debug = Math.max(0, bucketTotal - error - warning - info);
    return {
      label: formatBucketTime(epochStart, range),
      time: new Date(epochStart).toISOString(),
      epochMs: epochStart,
      error,
      warning,
      info,
      debug,
      total: bucketTotal,
    };
  });
}

/** Stacked-bar histogram input. Bucket totals for a range sum exactly to that range's grand total. */
export const LOG_TRENDS: Record<TrendRangeKey, TrendBucket[]> = {
  "1H": buildTrend("1H"),
  "6H": buildTrend("6H"),
  "12H": buildTrend("12H"),
  "24H": buildTrend("24H"),
  "7D": buildTrend("7D"),
};

/* ------------------------------------------------------------------ *
 * 500 seeded sample logs, relative to Date.now().
 * ------------------------------------------------------------------ */
interface ServiceSpec {
  service: string;
  hostPrefix: string;
  source: string;
  messages: Record<LogLevel, string[]>;
}

const SERVICES: ServiceSpec[] = [
  {
    service: "api-server", hostPrefix: "api", source: "kubernetes",
    messages: {
      ERROR: ["Database connection lost. Retrying (attempt 2/5)", "Unhandled exception in /api/orders: TypeError: req.body is undefined", "Connection pool exhausted for database primary"],
      WARNING: ["Payment API response delayed: 2.3s", "Slow query took 1840ms on orders_items", "Rate limit nearing threshold for client 10.4.2.18"],
      INFO: ["Request completed 200 in 42ms", "User login successful", "Health check passed"],
      DEBUG: ["Cache hit for key product_123", "Feature flag evaluated checkout_v2=true", "GC pause 12ms"],
    },
  },
  {
    service: "web-app", hostPrefix: "web", source: "nginx",
    messages: {
      ERROR: ["Upstream timed out while reading from 10.2.8.14", "Template render failed: missing partial header"],
      WARNING: ["High memory usage: 89%", "Slow client connection (12s) from 192.168.1.24"],
      INFO: ["Page rendered in 128ms", "Static asset served from cache", "Request completed 200 in 31ms"],
      DEBUG: ["SSR cache lookup for /pricing", "Asset fingerprint resolved bundle.8f3a.js"],
    },
  },
  {
    service: "auth-service", hostPrefix: "auth", source: "kubernetes",
    messages: {
      ERROR: ["Auth token validation failed: signature mismatch", "Failed to send email: SMTP connection refused"],
      WARNING: ["Certificate expires in 12 days", "Retrying failed login attempt (attempt 3/5)"],
      INFO: ["User login successful", "Token refreshed for session 88f1a2", "Password reset email queued"],
      DEBUG: ["JWT verified for subject user_4821", "Session cookie rotated"],
    },
  },
  {
    service: "database", hostPrefix: "db", source: "postgres",
    messages: {
      ERROR: ["Database connection lost. Retrying (attempt 2/5)", "Deadlock detected on table orders", "Connection pool exhausted for database primary"],
      WARNING: ["Slow query took 2410ms on analytics_events", "Table bloat above 30% on events_2026_11"],
      INFO: ["Query executed in 42ms", "Checkpoint completed in 120ms", "Replication lag 0.2s"],
      DEBUG: ["Shared buffers hit ratio 99.1%", "Autovacuum ran on public.sessions"],
    },
  },
  {
    service: "payment", hostPrefix: "pay", source: "kubernetes",
    messages: {
      ERROR: ["Payment API timeout after 3000ms", "stripe webhook signature verification failed"],
      WARNING: ["Payment API response delayed: 2.3s", "Retry budget 70% consumed for gateway stripe_us"],
      INFO: ["Charge succeeded ch_3N2 (amount 2499)", "Refund issued re_91HA", "Webhook received payment_intent.succeeded"],
      DEBUG: ["Idempotency key resolved idem_5521", "Gateway latency sampled 210ms"],
    },
  },
  {
    service: "cache", hostPrefix: "cache", source: "syslog",
    messages: {
      ERROR: ["Eviction storm detected: 82% of keys expired in 30s"],
      WARNING: ["High memory usage: 91%", "Keyspace hit rate dropped below 70%"],
      INFO: ["Cache warm-up completed in 2.1s", "Snapshot saved to /var/lib/redis/dump.rdb"],
      DEBUG: ["Cache hit for key session_5521", "LRU eviction candidate scan ran in 3ms"],
    },
  },
  {
    service: "scheduler", hostPrefix: "worker", source: "kubernetes",
    messages: {
      ERROR: ["Job nightly_etl failed: exit code 1 after 14m", "Failed to send email: SMTP connection refused"],
      WARNING: ["Scheduled job retrying (attempt 2/3): nightly_report", "Queue depth elevated: 1,240 pending jobs"],
      INFO: ["Scheduled job completed: nightly_report", "Cron job billing_sync finished in 38s"],
      DEBUG: ["Lock acquired for job invoice_gen (ttl 60s)", "Heartbeat emitted for worker_03"],
    },
  },
  {
    service: "notification", hostPrefix: "noti", source: "kubernetes",
    messages: {
      ERROR: ["Failed to send email: SMTP connection refused", "Push notification failed: device token invalid"],
      WARNING: ["Provider latency elevated for sns_ap_south_1 (4.1s)", "Retry budget 60% consumed for channel email"],
      INFO: ["Email delivered to user_8821", "SMS sent to +1•••0142", "Template render OK: invoice_paid"],
      DEBUG: ["Batch flush: 240 notifications in 120ms", "Suppression list hit for user_1120"],
    },
  },
];

const TAG_POOL = ["prod", "staging", "db", "retry", "memory", "latency", "auth", "payment", "cache", "scheduler", "smtp", "web"];
const LEVEL_WEIGHTS: Array<{ level: LogLevel; weight: number }> = [
  { level: "ERROR", weight: 0.032 },
  { level: "WARNING", weight: 0.065 },
  { level: "INFO", weight: 0.55 },
  { level: "DEBUG", weight: 0.353 },
];

function pickLevel(rand: number): LogLevel {
  let cursor = 0;
  for (const entry of LEVEL_WEIGHTS) {
    cursor += entry.weight;
    if (rand <= cursor) return entry.level;
  }
  return "DEBUG";
}

const hex = (rand: () => number, length: number) => {
  const alphabet = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[Math.floor(rand() * 16)];
  return out;
};

function buildSampleLogs(): LogEntry[] {
  const rand = mulberry32(20261111);
  const now = Date.now();
  const spanMs = 12 * 60 * 60 * 1000; // last 12 hours
  const logs: LogEntry[] = [];
  for (let index = 0; index < 500; index += 1) {
    const spec = SERVICES[Math.floor(rand() * SERVICES.length)];
    const level = pickLevel(rand());
    const messages = spec.messages[level];
    const message = messages[Math.floor(rand() * messages.length)];
    const epochMs = now - Math.floor(rand() * spanMs);
    const environment = rand() < 0.86 ? "prod" : rand() < 0.7 ? "staging" : "dev";
    const hostSuffix = pad2(1 + Math.floor(rand() * 3));
    const host = `${spec.hostPrefix}-${hostSuffix}`;
    const tagCount = 1 + Math.floor(rand() * 2);
    const tags = Array.from(new Set([environment, ...Array.from({ length: tagCount }, () => TAG_POOL[Math.floor(rand() * TAG_POOL.length)])])).slice(0, 3);
    const traceId = hex(rand, 32);
    const raw: Record<string, unknown> = {
      ts: new Date(epochMs).toISOString(),
      level,
      service: spec.service,
      host,
      env: environment,
      msg: message,
      trace_id: traceId,
      source: spec.source,
      tags,
    };
    logs.push({
      id: `log-${String(index + 1).padStart(4, "0")}`,
      timestamp: new Date(epochMs).toISOString(),
      epochMs,
      level,
      service: spec.service,
      host,
      environment,
      message,
      tags,
      traceId,
      source: spec.source,
      raw,
    });
  }
  return logs.sort((a, b) => b.epochMs - a.epochMs);
}

export const SAMPLE_LOGS: LogEntry[] = buildSampleLogs();

/** The service list filter/dropdowns should offer (derived from the sample). */
export const LOG_SERVICES: string[] = [...new Set(SAMPLE_LOGS.map((log) => log.service))].sort();
export const LOG_HOSTS: string[] = [...new Set(SAMPLE_LOGS.map((log) => log.host))].sort();
export const LOG_SOURCES: string[] = [...new Set(SAMPLE_LOGS.map((log) => log.source))].sort();
export const LOG_ENVIRONMENTS = ["prod", "staging", "dev"] as const;

/** Deterministic live-tail entry used by the 2s ticker. */
export function createLiveLog(sequence: number): LogEntry {
  const rand = mulberry32(9000 + sequence * 7919);
  const spec = SERVICES[Math.floor(rand() * SERVICES.length)];
  const level = pickLevel(rand());
  const message = spec.messages[level][Math.floor(rand() * spec.messages[level].length)];
  const now = Date.now();
  const environment = "prod";
  const hostSuffix = pad2(1 + Math.floor(rand() * 3));
  const host = `${spec.hostPrefix}-${hostSuffix}`;
  const traceId = hex(rand, 32);
  const raw: Record<string, unknown> = {
    ts: new Date(now).toISOString(),
    level,
    service: spec.service,
    host,
    env: environment,
    msg: message,
    trace_id: traceId,
    source: spec.source,
    tags: [environment],
  };
  return {
    id: `live-${sequence}`,
    timestamp: new Date(now).toISOString(),
    epochMs: now,
    level,
    service: spec.service,
    host,
    environment,
    message,
    tags: [environment],
    traceId,
    source: spec.source,
    raw,
  };
}

/* ------------------------------------------------------------------ *
 * Insights derived from the same sample + LOG_TOTALS.
 * ------------------------------------------------------------------ */
const sampleErrorCount = SAMPLE_LOGS.filter((log) => log.level === "ERROR").length;
const errorScale = sampleErrorCount > 0 ? LOG_TOTALS.errors / sampleErrorCount : 1;

export interface ServiceErrorRow {
  service: string;
  count: number;
}

/** Top services ranked by scaled error count; counts sum exactly to LOG_TOTALS.errors. */
export const TOP_SERVICES_BY_ERRORS: ServiceErrorRow[] = (() => {
  const counts = new Map<string, number>();
  for (const log of SAMPLE_LOGS) {
    if (log.level === "ERROR") counts.set(log.service, (counts.get(log.service) ?? 0) + 1);
  }
  const entries = [...counts.entries()].map(([service, count]) => ({ service, count }));
  // Ensure at least 7 rows by drawing from all known services.
  for (const spec of SERVICES) {
    if (entries.length >= 7) break;
    if (!counts.has(spec.service)) entries.push({ service: spec.service, count: 0 });
  }
  entries.sort((a, b) => b.count - a.count);
  const top = entries.slice(0, 7);
  const scaled = top.map((row) => ({ service: row.service, count: Math.round(row.count * errorScale) }));
  const drift = LOG_TOTALS.errors - scaled.reduce((acc, row) => acc + row.count, 0);
  if (scaled.length > 0) scaled[0] = { ...scaled[0], count: Math.max(0, scaled[0].count + drift) };
  return scaled;
})();

/** Normalizes a message into a stable pattern key (numbers, hex ids and quoted strings become placeholders). */
function normalizePattern(message: string): string {
  return message
    .toLowerCase()
    .replace(/0x[0-9a-f]+/g, "#")
    .replace(/\b[0-9a-f]{16,}\b/g, "#")
    .replace(/\d+(\.\d+)?/g, "#")
    .replace(/"[^"]*"/g, '"?"')
    .replace(/'[^']*'/g, "'?'")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ErrorPatternRow {
  pattern: string;
  count: number;
  /** Percentage change vs the older half of the window (positive = worsening). */
  trendPct: number;
  lastSeenMs: number;
  exemplar: string;
}

/** Top error patterns grouped from the sample, scaled to LOG_TOTALS.errors. Counts of listed patterns sum to the errors total. */
export const TOP_ERROR_PATTERNS: ErrorPatternRow[] = (() => {
  const errors = SAMPLE_LOGS.filter((log) => log.level === "ERROR");
  const groups = new Map<string, { count: number; exemplar: string; lastSeenMs: number; recent: number; older: number }>();
  const mid = Date.now() - 6 * 60 * 60 * 1000; // first half = older than 6h ago
  for (const log of errors) {
    const key = normalizePattern(log.message);
    const group = groups.get(key) ?? { count: 0, exemplar: log.message, lastSeenMs: 0, recent: 0, older: 0 };
    group.count += 1;
    if (log.epochMs > group.lastSeenMs) {
      group.lastSeenMs = log.epochMs;
      group.exemplar = log.message;
    }
    if (log.epochMs >= mid) group.recent += 1;
    else group.older += 1;
    groups.set(key, group);
  }
  const scaled = [...groups.entries()]
    .map(([pattern, group]) => ({
      pattern,
      exemplar: group.exemplar,
      count: Math.round(group.count * errorScale),
      lastSeenMs: group.lastSeenMs,
      trendPct: group.older === 0 ? (group.recent > 0 ? 100 : 0) : ((group.recent - group.older) / group.older) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const drift = LOG_TOTALS.errors - scaled.reduce((acc, row) => acc + row.count, 0);
  // Only adjust when the sample produced at least 6 distinct patterns; otherwise the remainder stays unattributed.
  if (scaled.length === 6 && drift !== 0) scaled[0] = { ...scaled[0], count: Math.max(0, scaled[0].count + drift) };
  return scaled;
})();

/* ------------------------------------------------------------------ *
 * Formatting helpers — shared by stats, chips, tooltips and the table.
 * ------------------------------------------------------------------ */
export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export const formatFull = (value: number): string => value.toLocaleString("en-US");

export function formatClock(epochMs: number, utc: boolean): string {
  const date = new Date(epochMs);
  if (utc) {
    return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}.${String(date.getUTCMilliseconds()).padStart(3, "0")}`;
  }
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

export function fullTimestamp(epochMs: number, utc: boolean): string {
  const date = new Date(epochMs);
  const hhmmss = formatClock(epochMs, utc).slice(0, -4);
  const base = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${hhmmss}`;
  return utc ? `${base} UTC` : `${base} local`;
}

export function timeAgo(epochMs: number): string {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
  if (diffSeconds < 60) return "just now";
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Normalized query tokens: `key:value` or free text. */
export function parseLogQuery(query: string): Array<{ key?: string; value: string }> {
  return query
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const match = /^([a-z_]+):(.+)$/i.exec(token);
      return match ? { key: match[1].toLowerCase(), value: match[2].toLowerCase() } : { value: token.toLowerCase() };
    });
}
