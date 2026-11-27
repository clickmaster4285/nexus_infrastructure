/**
 * Alert Rules mock data - single source of truth for Operations > Alert Rules.
 *
 * 25 rules, hosts/target types consistent with the Alerts, Events and
 * Uptime mocks (api-server-01 = API, web-app-01 = Web, db-01 = Database,
 * app-server-02 = VM, cache-01 = Cache, edge-01 = Network). Conditions are
 * typed (RuleCondition) and rendered via `utils/formatCondition` - never
 * hand-written strings. Every rule carries a 24-bucket hourly fire history
 * whose sum equals `fired24h`, plus a metric series for the drawer chart.
 * Swap this module for a real API later - the exported shapes stay.
 */

export type RuleType = "Threshold" | "Anomaly" | "Composite";
export type RuleStatus = "Enabled" | "Muted" | "Disabled";
export type RuleSeverity = "Critical" | "Warning" | "Info";
export type NotificationChannel = "Email" | "Slack" | "PagerDuty" | "Webhook";
export type TargetType = "API" | "Web" | "Database" | "VM" | "Cache" | "Network";

export interface RuleCondition {
  metric: string;
  operator: ">" | "<" | "=";
  value: number;
  unit: string;
  /** e.g. "5m"; omit for point-in-time conditions like certificate expiry. */
  duration?: string;
  /** How often the condition is evaluated, e.g. "30s". */
  evaluationInterval?: string;
  /** Composite: how `conditions` are joined. */
  op?: "AND" | "OR";
  /** Composite: child conditions. When present, `metric` mirrors the first child. */
  conditions?: RuleCondition[];
}

export interface NotificationPolicy {
  channels: NotificationChannel[];
  recipients: string[];
  escalationMinutes: number;
  repeatInterval: string;
  respectQuietHours: boolean;
}

export interface RackPoint {
  epochMs: number;
  /** Short axis label, e.g. "14:05". */
  time: string;
  value: number;
}

export interface RuleAuditEntry {
  id: string;
  at: string;
  epochMs: number;
  actor: string;
  action: string;
}

export interface RuleFire {
  id: string;
  at: string;
  epochMs: number;
  detail: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: RuleType;
  severity: RuleSeverity;
  status: RuleStatus;
  target: string;
  targetType: TargetType;
  condition: RuleCondition;
  notifications: NotificationPolicy;
  /** Disabled/muted rules have a stale or null value and fired24h === 0. */
  lastFiredAt: string | null;
  /** Fires in the last 24h; equals the sum of fireHistory. */
  fired24h: number;
  /** 24 hourly buckets (index 23 = current hour). All-zero for disabled/muted rules. */
  fireHistory: number[];
  /** Metric snapshot for the drawer chart (last 24h, 30min step). */
  metric: RackPoint[];
  /** Up to 3 most recent fires; empty for rules that never fired. */
  recentFires: RuleFire[];
  audit: RuleAuditEntry[];
  updatedBy: string;
  updatedAt: string;
  /** Muted rules record when the mute expires. */
  mutedUntil: string | null;
  tags: string[];
  /** Optional environment scope (editor, Target step); display-only. */
  environment?: string;
  /** Hosts/groups excluded from the rule; display-only. */
  exclude?: string[];
}

export const HOST_TYPE: Record<string, TargetType> = {
  "api-server-01": "API",
  "api-server-02": "API",
  "web-app-01": "Web",
  "web-02": "Web",
  "db-01": "Database",
  "app-server-02": "VM",
  "worker-01": "VM",
  "cache-01": "Cache",
  "edge-01": "Network",
  "pay-01": "API",
  "storage-01": "VM",
};

export const TARGET_HOSTS = Object.keys(HOST_TYPE);
export const TARGET_GROUPS = ["prod-api", "prod-web", "prod-db", "prod-cache", "prod-edge"] as const;

export const GROUP_TYPE: Record<string, TargetType> = {
  "prod-api": "API",
  "prod-web": "Web",
  "prod-db": "Database",
  "prod-cache": "Cache",
  "prod-edge": "Network",
};

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

const HOUR_MS = 60 * 60 * 1000;
const pad2 = (value: number) => String(value).padStart(2, "0");
const fmtClock = (epochMs: number) => {
  const date = new Date(epochMs);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

/** Deterministic hourly buckets whose sum is exactly `total`, biased toward recent hours. */
function buildHistory(total: number, seed: number): number[] {
  const rand = mulberry32(seed);
  const buckets = new Array(24).fill(0) as number[];
  for (let i = 0; i < total; i += 1) {
    const index = Math.max(0, Math.floor(23 - rand() * 22));
    buckets[index] += 1;
  }
  return buckets;
}

/** Half-hour metric series for the drawer chart; disabled rules plateau below threshold. */
function buildMetric(spec: { threshold: number; peak: number }, firing: boolean, seed: number, nowMs: number): RackPoint[] {
  const rand = mulberry32(seed);
  const points: RackPoint[] = [];
  const spanMs = 24 * HOUR_MS;
  const step = spanMs / 48;
  for (let i = 0; i < 48; i += 1) {
    const epochMs = nowMs - spanMs + i * step;
    const wave = Math.sin(i * 0.42 + seed) * 0.12 + Math.cos(i * 0.17 + seed * 0.5) * 0.07;
    const noise = (rand() - 0.5) * 0.08;
    const value = firing
      ? spec.peak * (0.9 + wave + noise)
      : spec.threshold * (0.62 + wave * 0.5 + Math.abs(noise));
    points.push({ epochMs, time: fmtClock(epochMs), value: Number(Math.max(0, value).toFixed(1)) });
  }
  return points;
}

/** ISO timestamp of the most recent non-empty bucket, or a stale fixed offset. */
function buildLastFired(history: number[], nowMs: number, staleDays: number | null, seed: number): string | null {
  if (staleDays != null) return new Date(nowMs - staleDays * 24 * HOUR_MS).toISOString();
  const rand = mulberry32(seed + 7);
  for (let i = 23; i >= 0; i -= 1) {
    if (history[i] > 0) {
      const offsetMs = (23 - i) * HOUR_MS + Math.floor(rand() * 3600) * 1000;
      return new Date(nowMs - offsetMs).toISOString();
    }
  }
  return null;
}

function buildRecentFires(history: number[], nowMs: number, detail: (index: number) => string, seed: number): RuleFire[] {
  const rand = mulberry32(seed + 13);
  const fires: RuleFire[] = [];
  for (let i = 23; i >= 0 && fires.length < 3; i -= 1) {
    for (let k = 0; k < history[i] && fires.length < 3; k += 1) {
      const epochMs = nowMs - (23 - i) * HOUR_MS - Math.floor(rand() * 1800) * 1000;
      fires.push({ id: `ALT-${String(1064 - fires.length - Math.floor(rand() * 40))}`, at: new Date(epochMs).toISOString(), epochMs, detail: detail(fires.length) });
    }
  }
  return fires.sort((a, b) => b.epochMs - a.epochMs);
}

function buildAudit(spec: { createdDaysAgo: number; changes: Array<{ daysAgo: number; actor: string; action: string }> }, seed: number, nowMs: number): RuleAuditEntry[] {
  const entries: RuleAuditEntry[] = [
    { id: `au-${seed}-0`, at: new Date(nowMs - spec.createdDaysAgo * 24 * HOUR_MS).toISOString(), epochMs: nowMs - spec.createdDaysAgo * 24 * HOUR_MS, actor: "Alex Morgan (SRE Lead)", action: "Rule created" },
  ];
  spec.changes.forEach((change, index) => {
    entries.push({ id: `au-${seed}-${index + 1}`, at: new Date(nowMs - change.daysAgo * 24 * HOUR_MS).toISOString(), epochMs: nowMs - change.daysAgo * 24 * HOUR_MS, actor: change.actor, action: change.action });
  });
  return entries.sort((a, b) => b.epochMs - a.epochMs);
}

interface RuleSpec {
  id: string;
  name: string;
  description: string;
  type: RuleType;
  severity: RuleSeverity;
  status: RuleStatus;
  target: string;
  condition: RuleCondition;
  channels: NotificationChannel[];
  recipients: string[];
  escalationMinutes: number;
  repeatInterval: string;
  respectQuietHours: boolean;
  fired24h: number;
  /** Set for disabled/muted rules (days since last fire) or null for "never fired". */
  staleDays: number | null;
  /** Muting expiry in hours from now. */
  mutedForHours: number | null;
  createdDaysAgo: number;
  changes: Array<{ daysAgo: number; actor: string; action: string }>;
  metricThreshold: number;
  metricPeak: number;
  fireDetail: (index: number) => string;
  updatedBy: string;
  updatedAt: string;
  tags: string[];
}

const NOW = Date.now();

const SPECS: RuleSpec[] = [
  {
    id: "RUL-201", name: "High CPU usage", description: "API node CPU saturated - scale out or shed load.",
    type: "Threshold", severity: "Critical", status: "Enabled", target: "api-server-01",
    condition: { metric: "CPU usage", operator: ">", value: 90, unit: "%", duration: "5m", evaluationInterval: "30s" },
    channels: ["Email", "Slack", "PagerDuty", "Webhook"], recipients: ["on-call@nexus.io", "#api-critical"], escalationMinutes: 10, repeatInterval: "15m", respectQuietHours: false,
    fired24h: 3, staleDays: null, mutedForHours: null, createdDaysAgo: 214,
    changes: [{ daysAgo: 32, actor: "Alex Morgan (SRE Lead)", action: "Threshold raised 85% -> 90%" }, { daysAgo: 96, actor: "Priya Raman", action: "Notification channel added: PagerDuty" }],
    metricThreshold: 90, metricPeak: 94.6, fireDetail: (i) => `CPU ${(92 + i * 1.4).toFixed(1)}% at fire`, updatedBy: "Alex Morgan (SRE Lead)", updatedAt: "Nov 10, 2026", tags: ["cpu", "capacity"],
  },
  {
    id: "RUL-202", name: "Database connection lost", description: "Primary database unreachable from the application pool.",
    type: "Threshold", severity: "Critical", status: "Enabled", target: "db-01",
    condition: { metric: "DB connections", operator: "=", value: 0, unit: "", duration: "1m", evaluationInterval: "15s" },
    channels: ["Email", "PagerDuty"], recipients: ["dba@nexus.io", "on-call@nexus.io"], escalationMinutes: 5, repeatInterval: "10m", respectQuietHours: false,
    fired24h: 1, staleDays: null, mutedForHours: null, createdDaysAgo: 340,
    changes: [{ daysAgo: 120, actor: "Priya Raman", action: "Repeat interval reduced 30m -> 10m" }],
    metricThreshold: 1, metricPeak: 18, fireDetail: () => "0 live connections detected", updatedBy: "Priya Raman", updatedAt: "Oct 28, 2026", tags: ["postgres", "availability"],
  },
  {
    id: "RUL-203", name: "API latency high (p95)", description: "Checkout API p95 above the 2s SLO boundary.",
    type: "Threshold", severity: "Critical", status: "Enabled", target: "api-server-01",
    condition: { metric: "API latency (p95)", operator: ">", value: 2, unit: "s", duration: "5m", evaluationInterval: "30s" },
    channels: ["Email", "Slack", "PagerDuty", "Webhook"], recipients: ["on-call@nexus.io", "#sre-urgent"], escalationMinutes: 10, repeatInterval: "15m", respectQuietHours: false,
    fired24h: 5, staleDays: null, mutedForHours: null, createdDaysAgo: 180,
    changes: [{ daysAgo: 14, actor: "k.patel", action: "SLO window extended 1m -> 5m" }, { daysAgo: 51, actor: "Alex Morgan (SRE Lead)", action: "Notification channel added: Webhook" }],
    metricThreshold: 2, metricPeak: 2.4, fireDetail: (i) => `p95 ${(2.1 + i * 0.13).toFixed(2)}s at fire`, updatedBy: "k.patel", updatedAt: "Nov 11, 2026", tags: ["slo", "latency", "checkout"],
  },
  {
    id: "RUL-204", name: "Health check failing", description: "Readiness probe failing on the web tier.",
    type: "Threshold", severity: "Critical", status: "Enabled", target: "web-app-01",
    condition: { metric: "Failing checks", operator: ">", value: 1, unit: "", duration: "1m", evaluationInterval: "15s" },
    channels: ["Email", "Slack", "PagerDuty"], recipients: ["on-call@nexus.io", "#web-urgent"], escalationMinutes: 5, repeatInterval: "10m", respectQuietHours: false,
    fired24h: 2, staleDays: null, mutedForHours: null, createdDaysAgo: 265,
    changes: [{ daysAgo: 44, actor: "Alex Morgan (SRE Lead)", action: "Threshold lowered 2 -> 1 failing check" }],
    metricThreshold: 1, metricPeak: 6, fireDetail: (i) => `${6 - i}/6 checks failing`, updatedBy: "Alex Morgan (SRE Lead)", updatedAt: "Nov 6, 2026", tags: ["availability", "k8s"],
  },
  {
    id: "RUL-205", name: "Memory usage high", description: "Memory pressure on app-server-02 - GC thrash risk.",
    type: "Threshold", severity: "Warning", status: "Enabled", target: "app-server-02",
    condition: { metric: "Memory usage", operator: ">", value: 85, unit: "%", duration: "5m", evaluationInterval: "30s" },
    channels: ["Email", "Slack"], recipients: ["#app-warnings", "sre@nexus.io"], escalationMinutes: 30, repeatInterval: "30m", respectQuietHours: true,
    fired24h: 4, staleDays: null, mutedForHours: null, createdDaysAgo: 230,
    changes: [{ daysAgo: 61, actor: "Priya Raman", action: "Repeat interval set to 30m" }],
    metricThreshold: 85, metricPeak: 89.4, fireDetail: (i) => `Memory ${(86 + i * 0.8).toFixed(1)}% at fire`, updatedBy: "Priya Raman", updatedAt: "Sep 12, 2026", tags: ["memory", "app"],
  },
  {
    id: "RUL-206", name: "Disk space low", description: "Free space under 10% on db-01 - writes may fail.",
    type: "Threshold", severity: "Warning", status: "Enabled", target: "db-01",
    condition: { metric: "Disk free", operator: "<", value: 10, unit: "%", duration: "10m", evaluationInterval: "1m" },
    channels: ["Email", "Slack", "PagerDuty"], recipients: ["dba@nexus.io", "on-call@nexus.io"], escalationMinutes: 30, repeatInterval: "1h", respectQuietHours: true,
    fired24h: 2, staleDays: null, mutedForHours: null, createdDaysAgo: 290,
    changes: [{ daysAgo: 88, actor: "dba@nexus.io", action: "Notification channel added: PagerDuty" }],
    metricThreshold: 10, metricPeak: 6.2, fireDetail: (i) => `${(9.1 - i * 1.3).toFixed(1)}% free at fire`, updatedBy: "dba@nexus.io", updatedAt: "Aug 20, 2026", tags: ["disk", "postgres"],
  },
  {
    id: "RUL-207", name: "API latency elevated (p95)", description: "Edge proxy p95 drifting above 1s.",
    type: "Threshold", severity: "Warning", status: "Enabled", target: "edge-01",
    condition: { metric: "API latency (p95)", operator: ">", value: 1, unit: "s", duration: "5m", evaluationInterval: "30s" },
    channels: ["Slack"], recipients: ["#edge-warnings"], escalationMinutes: 45, repeatInterval: "1h", respectQuietHours: true,
    fired24h: 3, staleDays: null, mutedForHours: null, createdDaysAgo: 150,
    changes: [{ daysAgo: 19, actor: "k.patel", action: "SLO window extended 2m -> 5m" }],
    metricThreshold: 1, metricPeak: 1.18, fireDetail: (i) => `p95 ${(1.02 + i * 0.07).toFixed(2)}s at fire`, updatedBy: "k.patel", updatedAt: "Nov 3, 2026", tags: ["slo", "edge"],
  },
  {
    id: "RUL-208", name: "SSL certificate expiring", description: "Edge certificate within 14 days of expiry.",
    type: "Threshold", severity: "Warning", status: "Enabled", target: "edge-01",
    condition: { metric: "SSL certificate expires in", operator: "<", value: 14, unit: " days", evaluationInterval: "1h" },
    channels: ["Email"], recipients: ["security@nexus.io"], escalationMinutes: 240, repeatInterval: "24h", respectQuietHours: true,
    fired24h: 1, staleDays: null, mutedForHours: null, createdDaysAgo: 400,
    changes: [{ daysAgo: 140, actor: "security@nexus.io", action: "Recipients updated: renewal@vendor.io added" }],
    metricThreshold: 14, metricPeak: 9.5, fireDetail: () => "Cert expires in 9 days", updatedBy: "security@nexus.io", updatedAt: "Jul 30, 2026", tags: ["tls", "compliance"],
  },
  {
    id: "RUL-209", name: "Queue depth elevated", description: "Worker queue backlog - jobs draining slowly. Currently disabled after tuning.",
    type: "Threshold", severity: "Warning", status: "Disabled", target: "app-server-02",
    condition: { metric: "Queue depth", operator: ">", value: 500, unit: "", duration: "10m", evaluationInterval: "1m" },
    channels: ["Email", "Slack"], recipients: ["#app-warnings", "ops@nexus.io"], escalationMinutes: 60, repeatInterval: "1h", respectQuietHours: true,
    fired24h: 0, staleDays: 12, mutedForHours: null, createdDaysAgo: 260,
    changes: [{ daysAgo: 12, actor: "ops@nexus.io", action: "Rule disabled - threshold being re-tuned" }, { daysAgo: 78, actor: "Priya Raman", action: "Threshold raised 250 -> 500" }],
    metricThreshold: 500, metricPeak: 1180, fireDetail: () => "queue 612 pending", updatedBy: "ops@nexus.io", updatedAt: "Nov 1, 2026", tags: ["queue", "worker"],
  },
  {
    id: "RUL-210", name: "Replication lag high", description: "Read replica falling behind the primary.",
    type: "Threshold", severity: "Warning", status: "Enabled", target: "db-01",
    condition: { metric: "Replication lag", operator: ">", value: 30, unit: "s", duration: "5m", evaluationInterval: "30s" },
    channels: ["Slack", "PagerDuty"], recipients: ["dba@nexus.io", "#db-warnings"], escalationMinutes: 15, repeatInterval: "15m", respectQuietHours: false,
    fired24h: 3, staleDays: null, mutedForHours: null, createdDaysAgo: 320,
    changes: [{ daysAgo: 92, actor: "dba@nexus.io", action: "Notification channel added: PagerDuty" }],
    metricThreshold: 30, metricPeak: 41.7, fireDetail: (i) => `lag ${(31 + i * 4.3).toFixed(1)}s at fire`, updatedBy: "dba@nexus.io", updatedAt: "Sep 2, 2026", tags: ["postgres", "replication"],
  },
  {
    id: "RUL-211", name: "Cache eviction storm", description: "Keyspace evicting faster than 100 ops/min.",
    type: "Threshold", severity: "Warning", status: "Enabled", target: "cache-01",
    condition: { metric: "Evictions", operator: ">", value: 100, unit: "/min", duration: "5m", evaluationInterval: "30s" },
    channels: ["Slack"], recipients: ["#cache-warnings"], escalationMinutes: 30, repeatInterval: "30m", respectQuietHours: true,
    fired24h: 2, staleDays: null, mutedForHours: null, createdDaysAgo: 210,
    changes: [{ daysAgo: 40, actor: "k.patel", action: "Unit corrected: evictions/sec -> evictions/min" }],
    metricThreshold: 100, metricPeak: 384, fireDetail: (i) => `${Math.round(320 + i * 22)} evictions/min at fire`, updatedBy: "k.patel", updatedAt: "Nov 7, 2026", tags: ["redis", "memory"],
  },
  {
    id: "RUL-212", name: "Backup job failed", description: "Nightly backup exited non-zero - restore point at risk.",
    type: "Threshold", severity: "Critical", status: "Enabled", target: "db-01",
    condition: { metric: "Job failures", operator: ">", value: 0, unit: "", duration: "1m", evaluationInterval: "1m" },
    channels: ["Email", "PagerDuty", "Webhook"], recipients: ["dba@nexus.io", "on-call@nexus.io"], escalationMinutes: 30, repeatInterval: "1h", respectQuietHours: false,
    fired24h: 1, staleDays: null, mutedForHours: null, createdDaysAgo: 380,
    changes: [{ daysAgo: 130, actor: "dba@nexus.io", action: "Webhook added for the backup controller" }],
    metricThreshold: 1, metricPeak: 1, fireDetail: () => "nightly_etl exit code 1", updatedBy: "dba@nexus.io", updatedAt: "Aug 11, 2026", tags: ["backup", "postgres"],
  },
  {
    id: "RUL-213", name: "Rate limit nearing", description: "A client is consuming > 80% of its rate budget - anomaly-grade drift.",
    type: "Anomaly", severity: "Info", status: "Enabled", target: "api-server-01",
    condition: { metric: "Client rate", operator: ">", value: 80, unit: "%", duration: "15m", evaluationInterval: "1m" },
    channels: ["Slack"], recipients: ["#api-info"], escalationMinutes: 0, repeatInterval: "4h", respectQuietHours: true,
    fired24h: 6, staleDays: null, mutedForHours: null, createdDaysAgo: 170,
    changes: [{ daysAgo: 25, actor: "Alex Morgan (SRE Lead)", action: "Duration extended 5m -> 15m to cut noise" }],
    metricThreshold: 80, metricPeak: 87, fireDetail: (i) => `client 10.4.2.18 at ${86 - i}% of limit`, updatedBy: "Alex Morgan (SRE Lead)", updatedAt: "Nov 9, 2026", tags: ["ratelimit", "edge", "anomaly"],
  },
  {
    id: "RUL-214", name: "Deployment error rate low", description: "Canary error rate under budget after a deploy.",
    type: "Threshold", severity: "Info", status: "Enabled", target: "web-app-01",
    condition: { metric: "Error rate", operator: "<", value: 1, unit: "%", duration: "5m", evaluationInterval: "30s" },
    channels: ["Slack"], recipients: ["#deploys"], escalationMinutes: 0, repeatInterval: "6h", respectQuietHours: true,
    fired24h: 2, staleDays: null, mutedForHours: null, createdDaysAgo: 130,
    changes: [{ daysAgo: 9, actor: "k.patel", action: "Threshold tightened 2% -> 1%" }],
    metricThreshold: 1, metricPeak: 0.42, fireDetail: () => "canary err 0.4%", updatedBy: "k.patel", updatedAt: "Nov 10, 2026", tags: ["deploy", "slo"],
  },
  {
    id: "RUL-215", name: "Service unavailable (HTTP 5xx)", description: "5xx share above budget on web-app-01.",
    type: "Threshold", severity: "Critical", status: "Enabled", target: "edge-01",
    condition: { metric: "5xx rate", operator: ">", value: 5, unit: "%", duration: "5m", evaluationInterval: "30s" },
    channels: ["Email", "Slack", "Webhook"], recipients: ["on-call@nexus.io", "#edge-urgent"], escalationMinutes: 10, repeatInterval: "15m", respectQuietHours: false,
    fired24h: 1, staleDays: null, mutedForHours: null, createdDaysAgo: 285,
    changes: [{ daysAgo: 15, actor: "on-call@nexus.io", action: "Target moved web-app-01 -> edge-01" }],
    metricThreshold: 5, metricPeak: 12.4, fireDetail: (i) => `5xx ${(5.4 + i * 3.5).toFixed(1)}% of traffic`, updatedBy: "on-call@nexus.io", updatedAt: "Nov 5, 2026", tags: ["availability", "edge"],
  },
  {
    id: "RUL-216", name: "Error rate high", description: "Application error rate above the 5% SLO budget.",
    type: "Threshold", severity: "Warning", status: "Enabled", target: "web-app-01",
    condition: { metric: "Error rate", operator: ">", value: 5, unit: "%", duration: "5m", evaluationInterval: "30s" },
    channels: ["Email", "Slack"], recipients: ["#web-app", "sre@nexus.io"], escalationMinutes: 20, repeatInterval: "30m", respectQuietHours: true,
    fired24h: 4, staleDays: null, mutedForHours: null, createdDaysAgo: 240,
    changes: [{ daysAgo: 47, actor: "Priya Raman", action: "Threshold tightened 8% -> 5%" }],
    metricThreshold: 5, metricPeak: 7.8, fireDetail: (i) => `err ${(5.2 + i * 0.7).toFixed(1)}% at fire`, updatedBy: "Priya Raman", updatedAt: "Oct 9, 2026", tags: ["slo", "errors"],
  },
  {
    id: "RUL-217", name: "Node not ready", description: "Kubelet reporting NotReady on app-server-02.",
    type: "Threshold", severity: "Critical", status: "Disabled", target: "app-server-02",
    condition: { metric: "NotReady nodes", operator: ">", value: 0, unit: "", duration: "2m", evaluationInterval: "30s" },
    channels: ["PagerDuty", "Email"], recipients: ["on-call@nexus.io"], escalationMinutes: 5, repeatInterval: "10m", respectQuietHours: false,
    fired24h: 0, staleDays: 21, mutedForHours: null, createdDaysAgo: 300,
    changes: [{ daysAgo: 21, actor: "ops@nexus.io", action: "Rule disabled - node drained for maintenance" }],
    metricThreshold: 0, metricPeak: 1, fireDetail: () => "1 node NotReady", updatedBy: "ops@nexus.io", updatedAt: "Oct 22, 2026", tags: ["k8s", "availability"],
  },
  {
    id: "RUL-218", name: "Disk I/O wait high", description: "iowait above 25% - storage saturated.",
    type: "Threshold", severity: "Warning", status: "Enabled", target: "app-server-02",
    condition: { metric: "IO wait", operator: ">", value: 25, unit: "%", duration: "10m", evaluationInterval: "1m" },
    channels: ["Slack"], recipients: ["#app-warnings"], escalationMinutes: 45, repeatInterval: "1h", respectQuietHours: true,
    fired24h: 1, staleDays: null, mutedForHours: null, createdDaysAgo: 160,
    changes: [{ daysAgo: 66, actor: "k.patel", action: "Target moved storage-01 -> app-server-02" }],
    metricThreshold: 25, metricPeak: 28.6, fireDetail: () => "iowait 27.9%", updatedBy: "k.patel", updatedAt: "Sep 19, 2026", tags: ["storage", "io"],
  },
  {
    id: "RUL-219", name: "HTTP 5xx on edge", description: "Edge 5xx share above the 3% warning budget.",
    type: "Threshold", severity: "Warning", status: "Enabled", target: "edge-01",
    condition: { metric: "5xx rate", operator: ">", value: 3, unit: "%", duration: "5m", evaluationInterval: "30s" },
    channels: ["Email", "Slack", "Webhook"], recipients: ["#edge-warnings", "on-call@nexus.io"], escalationMinutes: 20, repeatInterval: "30m", respectQuietHours: true,
    fired24h: 2, staleDays: null, mutedForHours: null, createdDaysAgo: 145,
    changes: [{ daysAgo: 33, actor: "on-call@nexus.io", action: "Notification channel added: Webhook" }],
    metricThreshold: 3, metricPeak: 4.1, fireDetail: (i) => `5xx ${(3.2 + i * 0.6).toFixed(1)}% of traffic`, updatedBy: "on-call@nexus.io", updatedAt: "Oct 13, 2026", tags: ["edge", "availability"],
  },
  {
    id: "RUL-220", name: "Postgres table bloat", description: "Autovacuum falling behind - bloat over 30%.",
    type: "Threshold", severity: "Info", status: "Disabled", target: "db-01",
    condition: { metric: "Table bloat", operator: ">", value: 30, unit: "%", duration: "60m", evaluationInterval: "5m" },
    channels: ["Email"], recipients: ["dba@nexus.io"], escalationMinutes: 0, repeatInterval: "7d", respectQuietHours: true,
    fired24h: 0, staleDays: null, mutedForHours: null, createdDaysAgo: 365,
    changes: [{ daysAgo: 74, actor: "dba@nexus.io", action: "Rule disabled - vacuum tuning in progress" }],
    metricThreshold: 30, metricPeak: 34.2, fireDetail: () => "bloat 33.6%", updatedBy: "dba@nexus.io", updatedAt: "Sep 1, 2026", tags: ["postgres", "maintenance"],
  },
  {
    id: "RUL-221", name: "SSL certificate expires < 7 days", description: "Final pre-expiry escalation for the edge certificate.",
    type: "Threshold", severity: "Critical", status: "Muted", target: "edge-01",
    condition: { metric: "SSL certificate expires in", operator: "<", value: 7, unit: " days", evaluationInterval: "1h" },
    channels: ["PagerDuty", "Email"], recipients: ["security@nexus.io", "on-call@nexus.io"], escalationMinutes: 60, repeatInterval: "6h", respectQuietHours: false,
    fired24h: 0, staleDays: 6, mutedForHours: 6, createdDaysAgo: 400,
    changes: [{ daysAgo: 6, actor: "security@nexus.io", action: "Muted for 7 days - renewal approved in CR-2291" }],
    metricThreshold: 7, metricPeak: 5.4, fireDetail: () => "Cert expires in 5 days", updatedBy: "security@nexus.io", updatedAt: "Nov 10, 2026", tags: ["tls", "compliance"],
  },
  {
    id: "RUL-222", name: "Cache hit ratio low", description: "Hit ratio under 70% - cache smaller than working set.",
    type: "Threshold", severity: "Info", status: "Enabled", target: "cache-01",
    condition: { metric: "Cache hit ratio", operator: "<", value: 70, unit: "%", duration: "10m", evaluationInterval: "1m" },
    channels: ["Slack"], recipients: ["#cache-warnings"], escalationMinutes: 0, repeatInterval: "4h", respectQuietHours: true,
    fired24h: 3, staleDays: null, mutedForHours: null, createdDaysAgo: 190,
    changes: [{ daysAgo: 28, actor: "k.patel", action: "Threshold lowered 75% -> 70%" }],
    metricThreshold: 70, metricPeak: 62.3, fireDetail: (i) => `hit ratio ${(66 - i * 1.4).toFixed(1)}%`, updatedBy: "k.patel", updatedAt: "Nov 8, 2026", tags: ["redis", "performance"],
  },
  {
    id: "RUL-223", name: "Kubelet disk pressure", description: "Node entering disk pressure - pods may be evicted.",
    type: "Threshold", severity: "Critical", status: "Disabled", target: "app-server-02",
    condition: { metric: "Disk pressure", operator: ">", value: 0, unit: "", duration: "1m", evaluationInterval: "15s" },
    channels: ["PagerDuty", "Email"], recipients: ["on-call@nexus.io"], escalationMinutes: 5, repeatInterval: "10m", respectQuietHours: false,
    fired24h: 0, staleDays: 34, mutedForHours: null, createdDaysAgo: 350,
    changes: [{ daysAgo: 34, actor: "ops@nexus.io", action: "Rule disabled - node resized, capacity fixed" }],
    metricThreshold: 0, metricPeak: 1, fireDetail: () => "disk pressure=1", updatedBy: "ops@nexus.io", updatedAt: "Oct 9, 2026", tags: ["k8s", "storage"],
  },
  {
    id: "RUL-224", name: "Anomaly: request spike", description: "Edge request rate deviating more than 4 sigma from the rolling baseline.",
    type: "Anomaly", severity: "Warning", status: "Enabled", target: "edge-01",
    condition: { metric: "Request rate", operator: ">", value: 4, unit: "σ", duration: "5m", evaluationInterval: "30s" },
    channels: ["Slack", "Email"], recipients: ["#edge-warnings", "netops@nexus.io"], escalationMinutes: 30, repeatInterval: "1h", respectQuietHours: true,
    fired24h: 2, staleDays: null, mutedForHours: null, createdDaysAgo: 120,
    changes: [{ daysAgo: 41, actor: "k.patel", action: "Sensitivity reduced 3σ -> 4σ to cut noise" }],
    metricThreshold: 4, metricPeak: 5.6, fireDetail: (i) => `request rate ${(4.4 + i * 0.5).toFixed(1)}σ at fire`, updatedBy: "k.patel", updatedAt: "Nov 6, 2026", tags: ["anomaly", "traffic"],
  },
  {
    id: "RUL-225", name: "Composite: latency + 5xx spike", description: "5xx budget and p95 latency breached together on the edge - page immediately.",
    type: "Composite", severity: "Critical", status: "Enabled", target: "edge-01",
    condition: {
      metric: "5xx rate", operator: ">", value: 5, unit: "%", duration: "5m", evaluationInterval: "15s",
      op: "AND",
      conditions: [
        { metric: "5xx rate", operator: ">", value: 5, unit: "%", duration: "5m" },
        { metric: "API latency (p95)", operator: ">", value: 2, unit: "s" },
      ],
    },
    channels: ["Email", "Slack", "PagerDuty"], recipients: ["on-call@nexus.io", "#edge-urgent"], escalationMinutes: 10, repeatInterval: "15m", respectQuietHours: false,
    fired24h: 1, staleDays: null, mutedForHours: null, createdDaysAgo: 90,
    changes: [{ daysAgo: 30, actor: "Alex Morgan (SRE Lead)", action: "Composite tightened: latency leg added" }],
    metricThreshold: 5, metricPeak: 11.8, fireDetail: () => "5xx 6.1% + p95 2.3s at fire", updatedBy: "Alex Morgan (SRE Lead)", updatedAt: "Nov 11, 2026", tags: ["edge", "composite", "availability"],
  },
];

function buildRule(spec: RuleSpec, index: number): AlertRule {
  const seed = 881 + index * 97;
  const fireHistory = spec.status === "Enabled" ? buildHistory(spec.fired24h, seed) : new Array(24).fill(0);
  const metric = buildMetric({ threshold: spec.metricThreshold, peak: spec.metricPeak }, spec.status === "Enabled", seed, NOW);
  const lastFiredAt = spec.status !== "Enabled" && spec.staleDays === null ? null : buildLastFired(fireHistory, NOW, spec.staleDays, seed);
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    type: spec.type,
    severity: spec.severity,
    status: spec.status,
    target: spec.target,
    targetType: HOST_TYPE[spec.target] ?? "VM",
    condition: spec.condition,
    notifications: {
      channels: spec.channels,
      recipients: spec.recipients,
      escalationMinutes: spec.escalationMinutes,
      repeatInterval: spec.repeatInterval,
      respectQuietHours: spec.respectQuietHours,
    },
    lastFiredAt,
    fired24h: spec.fired24h,
    fireHistory,
    metric,
    recentFires: buildRecentFires(fireHistory, NOW, spec.fireDetail, seed),
    audit: buildAudit({ createdDaysAgo: spec.createdDaysAgo, changes: spec.changes }, seed, NOW),
    mutedUntil: spec.mutedForHours != null ? new Date(NOW + spec.mutedForHours * HOUR_MS).toISOString() : null,
    updatedBy: spec.updatedBy,
    updatedAt: spec.updatedAt,
    tags: spec.tags,
  };
}

export const ALERT_RULE_LIST: AlertRule[] = SPECS.map(buildRule);

/** Kept for the older import style; prefer ALERT_RULE_LIST for new code. */
export const ALERT_RULES = ALERT_RULE_LIST;

export const RULE_SEVERITIES: RuleSeverity[] = ["Critical", "Warning", "Info"];
export const RULE_TYPES: RuleType[] = ["Threshold", "Anomaly", "Composite"];
export const TARGET_TYPES: TargetType[] = ["API", "Web", "Database", "VM", "Cache", "Network"];
export const RULE_STATUSES: RuleStatus[] = ["Enabled", "Muted", "Disabled"];
export const NOTIFICATION_CHANNELS: NotificationChannel[] = ["Email", "Slack", "PagerDuty", "Webhook"];
