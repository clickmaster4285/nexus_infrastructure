/**
 * Alerts mock data — single source of truth.
 *
 * 38 seeded alerts relative to Date.now(), covering a 48h window so the
 * "vs previous period" deltas in the KPI row have something to compare
 * against. Hosts, services and event ids stay consistent with the
 * Events Explorer / Database Monitoring / Uptime & SLA mocks. Every KPI,
 * trend bucket, noisy rule and tab count derives from SAMPLE_ALERTS via
 * `utils/alertStats` so the numbers never contradict each other. To swap
 * in a real API later, replace the fetch layer in `useAlerts` — the
 * types and derived shapes stay the same.
 */

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertStatus = "firing" | "acknowledged" | "silenced" | "resolved";

export interface AlertTimelineEntry {
  id: string;
  /** ISO 8601 timestamp. */
  at: string;
  epochMs: number;
  kind: "triggered" | "notified" | "acknowledged" | "assigned" | "silenced" | "resolved" | "note";
  label: string;
  detail?: string;
  /** Actor email, or null for system-generated entries. */
  user?: string | null;
}

export interface AlertMetricPoint {
  epochMs: number;
  /** Short axis label, e.g. "14:05". */
  time: string;
  value: number;
}

export interface Alert {
  id: string;
  name: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  host: string;
  service: string;
  /** Monitoring source that fired the alert, e.g. "prometheus". */
  source: string;
  ruleId: string;
  ruleName: string;
  threshold: number;
  unit: string;
  /** ISO 8601 timestamp, relative to the current time. */
  triggeredAt: string;
  epochMs: number;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  assignee: string | null;
  silencedUntil: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  /** Number of raw occurrences grouped into this alert. */
  occurrences: number;
  /** Linked Event Explorer record. */
  eventId: string;
  /** Runbook slug, linked under /runbooks. */
  runbook: string;
  /** Small metric snapshot for the detail drawer (last ~2h, 5min step). */
  metric: AlertMetricPoint[];
  timeline: AlertTimelineEntry[];
}

export interface AlertRule {
  ruleId: string;
  name: string;
  severity: AlertSeverity;
  metricName: string;
  unit: string;
  threshold: number;
  peak: number;
  source: string;
  runbook: string;
  hosts: string[];
  /** Message template; "{v}" is replaced with the observed value. */
  message: (value: number) => string;
}

const HOST_SERVICE: Record<string, string> = {
  "api-server-01": "api-server",
  "api-server-02": "api-server",
  "web-app-01": "web-app",
  "web-02": "web-app",
  "db-01": "database",
  "app-server-02": "app-server",
  "cache-01": "cache",
  "edge-01": "edge-proxy",
  "worker-01": "scheduler",
  "pay-01": "payment",
  "storage-01": "storage",
};

export const ALERT_ASSIGNEES = ["sre@nexus.io", "ops@nexus.io", "dba@nexus.io", "netops@nexus.io"] as const;

export const ALERT_RULES: AlertRule[] = [
  {
    ruleId: "RUL-201", name: "High CPU usage > 90%", severity: "critical", metricName: "CPU usage", unit: "%", threshold: 90, peak: 94.6,
    source: "prometheus", runbook: "cpu-saturation", hosts: ["api-server-01", "app-server-02"],
    message: (v) => `CPU usage at ${v.toFixed(1)}%, sustained above threshold for 10 minutes`,
  },
  {
    ruleId: "RUL-202", name: "Database connection lost", severity: "critical", metricName: "Failed connections", unit: "", threshold: 1, peak: 34,
    source: "postgres", runbook: "database-connectivity", hosts: ["db-01"],
    message: () => `PostgreSQL unreachable from the application pool, connection attempts failing`,
  },
  {
    ruleId: "RUL-203", name: "API latency > 2s", severity: "critical", metricName: "p99 latency", unit: "ms", threshold: 2000, peak: 2340,
    source: "prometheus", runbook: "api-latency", hosts: ["api-server-01", "web-app-01"],
    message: (v) => `p99 latency ${Math.round(v)}ms on /api/orders (threshold 2000ms)`,
  },
  {
    ruleId: "RUL-204", name: "Health check failed", severity: "critical", metricName: "Failing checks", unit: "", threshold: 1, peak: 6,
    source: "kubernetes", runbook: "kubernetes-troubleshooting", hosts: ["web-app-01", "web-02"],
    message: (v) => `Readiness probe failing — ${Math.round(v)}/6 endpoint checks down`,
  },
  {
    ruleId: "RUL-215", name: "Service unavailable (HTTP 5xx)", severity: "critical", metricName: "5xx rate", unit: "%", threshold: 5, peak: 12.4,
    source: "nginx", runbook: "http-5xx", hosts: ["web-app-01", "edge-01"],
    message: (v) => `${v.toFixed(1)}% of responses are 5xx over the last 5 minutes`,
  },
  {
    ruleId: "RUL-212", name: "Backup job failed", severity: "critical", metricName: "Failed jobs", unit: "", threshold: 1, peak: 1,
    source: "kubernetes", runbook: "backup-recovery", hosts: ["db-01"],
    message: () => `Nightly backup job nightly_etl failed with exit code 1 after 14m`,
  },
  {
    ruleId: "RUL-205", name: "Memory usage high > 85%", severity: "warning", metricName: "Memory usage", unit: "%", threshold: 85, peak: 89.4,
    source: "prometheus", runbook: "memory-pressure", hosts: ["db-01", "app-server-02", "cache-01"],
    message: (v) => `Memory usage at ${v.toFixed(1)}% (threshold 85%)`,
  },
  {
    ruleId: "RUL-206", name: "Disk space low < 15%", severity: "warning", metricName: "Free disk space", unit: "%", threshold: 15, peak: 9.8,
    source: "prometheus", runbook: "disk-cleanup", hosts: ["app-server-02", "db-01"],
    message: (v) => `Only ${v.toFixed(1)}% free on the primary data volume`,
  },
  {
    ruleId: "RUL-207", name: "API latency elevated > 1s", severity: "warning", metricName: "p99 latency", unit: "ms", threshold: 1000, peak: 1180,
    source: "prometheus", runbook: "api-latency", hosts: ["api-server-01", "edge-01"],
    message: (v) => `p99 latency ${Math.round(v)}ms on the public endpoint`,
  },
  {
    ruleId: "RUL-208", name: "SSL certificate expiring", severity: "warning", metricName: "Days to expiry", unit: "d", threshold: 14, peak: 11,
    source: "ssl-checker", runbook: "tls-rotation", hosts: ["edge-01"],
    message: (v) => `TLS certificate for *.nexus.io expires in ${Math.round(v)} days`,
  },
  {
    ruleId: "RUL-209", name: "Queue depth elevated", severity: "warning", metricName: "Pending jobs", unit: "", threshold: 500, peak: 1240,
    source: "kubernetes", runbook: "queue-backlog", hosts: ["worker-01"],
    message: (v) => `Queue depth elevated — ${Math.round(v).toLocaleString("en-US")} pending jobs`,
  },
  {
    ruleId: "RUL-210", name: "Replication lag > 30s", severity: "warning", metricName: "Replication lag", unit: "s", threshold: 30, peak: 42,
    source: "postgres", runbook: "replication-lag", hosts: ["db-01"],
    message: (v) => `Replica ${Math.round(v)}s behind the primary`,
  },
  {
    ruleId: "RUL-211", name: "Cache eviction storm", severity: "warning", metricName: "Evictions/min", unit: "", threshold: 100, peak: 385,
    source: "redis", runbook: "redis-eviction", hosts: ["cache-01"],
    message: (v) => `${Math.round(v)} evictions/min, keyspace hit rate down to 62%`,
  },
  {
    ruleId: "RUL-213", name: "Rate limit nearing", severity: "info", metricName: "Client rate", unit: "%", threshold: 80, peak: 87,
    source: "nginx", runbook: "rate-limiting", hosts: ["api-server-01"],
    message: (v) => `Client 10.4.2.18 at ${v.toFixed(0)}% of the rate limit`,
  },
  {
    ruleId: "RUL-214", name: "Deployment completed", severity: "info", metricName: "Error rate", unit: "%", threshold: 1, peak: 0.4,
    source: "kubernetes", runbook: "deploy-rollback", hosts: ["web-app-01", "api-server-01"],
    message: () => `Rolling deployment v2.14.3 completed with no canary errors`,
  },
];

/* ------------------------------------------------------------------ *
 * Seeded RNG (mulberry32) — deterministic output on every load.
 * ------------------------------------------------------------------ */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), t ^ (t >>> 14))) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad2 = (value: number) => String(value).padStart(2, "0");
const fmtClock = (epochMs: number) => {
  const date = new Date(epochMs);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

/** Metric snapshot for the drawer: last ~2h in 5min steps ending at `endMs`. */
function buildMetric(spec: AlertRule, resolved: boolean, rand: () => number, endMs: number): AlertMetricPoint[] {
  const points: AlertMetricPoint[] = [];
  const start = endMs - 23 * 5 * 60 * 1000;
  for (let index = 0; index < 24; index += 1) {
    const epochMs = start + index * 5 * 60 * 1000;
    const progress = index / 23;
    let value: number;
    if (resolved) {
      // Breach in the first half, recovery below the threshold by the end.
      value = progress < 0.55
        ? spec.peak * (0.96 + rand() * 0.08)
        : spec.threshold * (1.25 - progress) * (0.85 + rand() * 0.3);
    } else {
      value = spec.peak * (0.9 + 0.12 * Math.sin(progress * Math.PI * 3) + rand() * 0.08);
    }
    points.push({ epochMs, time: fmtClock(epochMs), value: Number(Math.max(0, value).toFixed(1)) });
  }
  return points;
}

const NOTE_POOL = [
  "Paged the primary on-call, investigating now.",
  "Linked to change #CHG-8841 (deploy window).",
  "Customer impact confirmed for two tenants.",
  "Root cause ticket INC-4821 opened, syncing updates.",
];

function buildAlerts(): Alert[] {
  const rand = mulberry32(20261112);
  const now = Date.now();
  const alerts: Alert[] = [];
  for (let index = 0; index < 38; index += 1) {
    const spec = ALERT_RULES[Math.floor(rand() ** 1.4 * ALERT_RULES.length)];
    const statusRoll = rand();
    const status: AlertStatus = statusRoll < 0.3 ? "firing" : statusRoll < 0.48 ? "acknowledged" : statusRoll < 0.59 ? "silenced" : "resolved";
    const minutesAgo = Math.floor(rand() * 60 * 47) + 2; // 48h window
    const epochMs = now - minutesAgo * 60 * 1000;
    const host = spec.hosts[Math.floor(rand() * spec.hosts.length)];
    const service = HOST_SERVICE[host] ?? host;
    const value = spec.peak * (0.92 + rand() * 0.16);
    const occurrences = status === "resolved" ? Math.floor(rand() * 10) + 2 : Math.floor(rand() * 34) + 4;

    const timeline: AlertTimelineEntry[] = [];
    const pushEntry = (offsetMs: number, kind: AlertTimelineEntry["kind"], label: string, detail?: string, user?: string | null) => {
      const at = epochMs + offsetMs;
      timeline.push({ id: `tl${timeline.length + 1}`, at: new Date(at).toISOString(), epochMs: at, kind, label, detail, user: user ?? null });
      return at;
    };

    pushEntry(0, "triggered", "Alert triggered", spec.message(value));
    pushEntry(45 * 1000 + Math.floor(rand() * 75) * 1000, "notified", "Notified", "Email · Slack #alerts");

    let acknowledgedAt: string | null = null;
    let acknowledgedBy: string | null = null;
    let assignee: string | null = null;
    let silencedUntil: string | null = null;
    let resolvedAt: string | null = null;
    let resolvedBy: string | null = null;

    const mttaMs = (2 + Math.floor(rand() * 16)) * 60 * 1000;
    if (status === "acknowledged" || status === "resolved") {
      acknowledgedAt = new Date(epochMs + mttaMs).toISOString();
      acknowledgedBy = ALERT_ASSIGNEES[Math.floor(rand() * ALERT_ASSIGNEES.length)];
      pushEntry(mttaMs, "acknowledged", "Acknowledged", undefined, acknowledgedBy);
      if (rand() < 0.75) {
        assignee = acknowledgedBy;
        pushEntry(mttaMs + 60 * 1000, "assigned", "Assigned", `Owner ${assignee}`, acknowledgedBy);
      }
    }
    if (status === "silenced") {
      const hours = [1, 4, 24][Math.floor(rand() * 3)];
      silencedUntil = new Date(epochMs + hours * 60 * 60 * 1000).toISOString();
      pushEntry(90 * 1000, "silenced", `Silenced for ${hours}h`, undefined, ALERT_ASSIGNEES[Math.floor(rand() * ALERT_ASSIGNEES.length)]);
    }
    if (status === "resolved") {
      const durationMs = (25 + Math.floor(rand() * 330)) * 60 * 1000;
      resolvedAt = new Date(epochMs + durationMs).toISOString();
      resolvedBy = acknowledgedBy ?? ALERT_ASSIGNEES[Math.floor(rand() * ALERT_ASSIGNEES.length)];
      pushEntry(durationMs, "resolved", "Resolved", `${Math.round(durationMs / 60000)}m to resolve`, resolvedBy);
    }
    if ((status === "acknowledged" || status === "resolved") && rand() < 0.5) {
      const note = NOTE_POOL[Math.floor(rand() * NOTE_POOL.length)];
      pushEntry(mttaMs + 5 * 60 * 1000, "note", "Note added", note, acknowledgedBy ?? ALERT_ASSIGNEES[0]);
    }

    alerts.push({
      id: `ALT-${String(1001 + index)}`,
      name: spec.name,
      message: spec.message(value),
      severity: spec.severity,
      status,
      host,
      service,
      source: spec.source,
      ruleId: spec.ruleId,
      ruleName: spec.name,
      threshold: spec.threshold,
      unit: spec.unit,
      triggeredAt: new Date(epochMs).toISOString(),
      epochMs,
      acknowledgedAt,
      acknowledgedBy,
      assignee,
      silencedUntil,
      resolvedAt,
      resolvedBy,
      occurrences,
      eventId: `EVT-2026-${String(48000 + index)}`,
      runbook: spec.runbook,
      metric: buildMetric(spec, status === "resolved", rand, resolvedAt ? new Date(resolvedAt).getTime() : now),
      timeline,
    });
  }
  return alerts.sort((a, b) => b.epochMs - a.epochMs);
}

export const SAMPLE_ALERTS: Alert[] = buildAlerts();

/** Host list for the host filter dropdown (derived from the sample). */
export const ALERT_HOSTS: string[] = [...new Set(SAMPLE_ALERTS.map((alert) => alert.host))].sort();
