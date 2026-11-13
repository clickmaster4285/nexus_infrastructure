/**
 * Scheduled Tasks mock data - single source of truth for Operations > Scheduled Tasks.
 *
 * 28 seeded tasks (TSK-2001..TSK-2028), created relative to module load so the
 * page never goes stale. Hosts, groups and owners are consistent with the
 * Alerts / Maintenance Windows / Uptime & SLA mocks (api-server-01, db-01,
 * web-app-01, app-server-02, cache-01, edge-01; groups database-cluster,
 * edge-locations, production-web; owners Sara Iqbal, Tom Becker, Marcus Lee,
 * Priya Nair). Audit entries are appended in-memory by every action so the
 * detail drawer reflects them immediately.
 *
 * Last run / next run / success rate / avg duration are NOT stored here - they
 * derive from the runs array (mocks/taskRuns.ts) via utils/taskStats. To swap
 * in a real API later, replace the store read/mutate functions - the types
 * stay the same.
 */

import type { TaskSchedule } from "@/utils/formatSchedule";

export type TaskType = "backup" | "patch" | "report" | "cleanup" | "security" | "cache" | "monitoring" | "custom";
export type RunStatus = "success" | "failed" | "running" | "skipped";
export type TaskStatus = "active" | "paused";

export interface TaskTarget {
  /** Ops-style host names, e.g. api-server-01. */
  hosts: string[];
  /** Server group ids, e.g. database-cluster. */
  groups: string[];
  environment: "production" | "staging" | "all";
}

export interface ExecutionConfig {
  mode: "builtin" | "command";
  /** Built-in action key used when mode === "builtin". */
  builtin: string | null;
  command: string;
  retries: number;
  timeoutMinutes: number;
  /** What happens when the previous run is still going. */
  concurrency: "skip" | "queue";
}

export interface NotificationConfig {
  onFailure: boolean;
  onSuccess: boolean;
  /** Subset of ["Email", "Slack", "PagerDuty"]. */
  channels: string[];
  /** Email addresses or Slack channel names. */
  recipients: string[];
}

export interface AuditEntry {
  id: string;
  at: string;
  epochMs: number;
  actor: string;
  action: string;
  detail: string;
}

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  tags: string[];
  owner: string;
  /** false = paused. Paused tasks get no new runs and show "Paused" as next run. */
  enabled: boolean;
  /** Set when the task was paused (runs stop after this). null when enabled. */
  pausedSince: string | null;
  schedule: TaskSchedule;
  target: TaskTarget;
  execution: ExecutionConfig;
  notifications: NotificationConfig;
  createdBy: string;
  createdAt: string;
  epochMs: number;
  audit: AuditEntry[];
}

export const CURRENT_USER_NAME = "you@nexus.io";

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  backup: "Backup",
  patch: "Patching",
  report: "Report",
  cleanup: "Cleanup",
  security: "Security",
  cache: "Cache",
  monitoring: "Monitoring",
  custom: "Custom",
};

export const TASK_OWNERS = ["Sara Iqbal", "Tom Becker", "Marcus Lee", "Priya Nair"] as const;
export const TASK_TAGS = ["backup", "database", "patching", "web", "api", "security", "report", "sla", "cleanup", "cache", "monitoring", "etl", "quarterly", "maintenance"] as const;

export const BUILTIN_ACTIONS = [
  { value: "run-backup", label: "Run backup" },
  { value: "backup-verify", label: "Verify latest backup" },
  { value: "os-patch", label: "Apply OS patches" },
  { value: "report-email", label: "Generate report email" },
  { value: "cert-scan", label: "Scan certificate expiry" },
  { value: "cache-warmup", label: "Warm up cache" },
  { value: "log-rotate", label: "Rotate logs" },
  { value: "metrics-rollup", label: "Roll up metrics" },
] as const;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

function audit(id: string, daysAgo: number, actor: string, action: string, detail: string): AuditEntry {
  const epochMs = now - daysAgo * DAY;
  return { id: `${id}-audit-${action.toLowerCase().replace(/\s+/g, "-")}-${Math.round(epochMs)}`, at: iso(epochMs), epochMs, actor, action, detail };
}

interface SeedSpec {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  tags: string[];
  owner: string;
  schedule: TaskSchedule;
  hosts: string[];
  groups: string[];
  environment: TaskTarget["environment"];
  builtin: string | null;
  command: string;
  retries: number;
  timeoutMinutes: number;
  concurrency: ExecutionConfig["concurrency"];
  failureRate: number;
  avgDurationSec: number;
  createdDaysAgo: number;
  enabled?: boolean;
  pausedDaysAgo?: number;
}

const SEED_SPECS: SeedSpec[] = [
  { id: "TSK-2001", name: "Nightly database backup", description: "Full pg_dump of the primary cluster, encrypted and shipped to cold storage.", type: "backup", tags: ["backup", "database"], owner: "Sara Iqbal", schedule: { kind: "daily", hour: 2, minute: 0, timeZone: "Asia/Karachi" }, hosts: ["db-01"], groups: ["database-cluster"], environment: "production", builtin: "run-backup", command: "", retries: 2, timeoutMinutes: 90, concurrency: "skip", failureRate: 0.08, avgDurationSec: 220, createdDaysAgo: 210 },
  { id: "TSK-2002", name: "Weekly OS patching - web tier", description: "Rolling apt upgrade across production-web nodes with health-check gate.", type: "patch", tags: ["patching", "web"], owner: "Marcus Lee", schedule: { kind: "weekly", hour: 3, minute: 0, daysOfWeek: [0], timeZone: "Asia/Karachi" }, hosts: ["web-app-01", "web-02"], groups: ["production-web"], environment: "production", builtin: "os-patch", command: "", retries: 1, timeoutMinutes: 120, concurrency: "skip", failureRate: 0.14, avgDurationSec: 1500, createdDaysAgo: 320 },
  { id: "TSK-2003", name: "Monthly SLA report email", description: "SLA attainment summary for the month, emailed to stakeholders on day 1.", type: "report", tags: ["report", "sla"], owner: "Priya Nair", schedule: { kind: "monthly", hour: 8, minute: 0, dayOfMonth: 1, timeZone: "Europe/London" }, hosts: [], groups: [], environment: "all", builtin: "report-email", command: "", retries: 2, timeoutMinutes: 15, concurrency: "skip", failureRate: 0.05, avgDurationSec: 45, createdDaysAgo: 400 },
  { id: "TSK-2004", name: "Log rotation and cleanup", description: "Rotate nginx/app logs, compress and prune archives older than 30 days.", type: "cleanup", tags: ["cleanup"], owner: "Tom Becker", schedule: { kind: "daily", hour: 1, minute: 30, timeZone: "Asia/Karachi" }, hosts: ["app-server-02", "web-app-01"], groups: [], environment: "production", builtin: "log-rotate", command: "", retries: 1, timeoutMinutes: 20, concurrency: "skip", failureRate: 0.18, avgDurationSec: 180, createdDaysAgo: 260 },
  { id: "TSK-2005", name: "SSL certificate expiry scan", description: "Scan all edge certificates; page when expiry is inside 21 days.", type: "security", tags: ["security"], owner: "Sara Iqbal", schedule: { kind: "daily", hour: 6, minute: 0, timeZone: "UTC" }, hosts: ["edge-01"], groups: ["edge-locations"], environment: "production", builtin: "cert-scan", command: "", retries: 2, timeoutMinutes: 10, concurrency: "skip", failureRate: 0.06, avgDurationSec: 30, createdDaysAgo: 350 },
  { id: "TSK-2006", name: "Disk usage report", description: "Daily disk utilisation summary for app and storage volumes.", type: "report", tags: ["report"], owner: "Priya Nair", schedule: { kind: "daily", hour: 9, minute: 0, timeZone: "Asia/Karachi" }, hosts: ["app-server-02"], groups: [], environment: "production", builtin: "report-email", command: "", retries: 1, timeoutMinutes: 10, concurrency: "skip", failureRate: 0.04, avgDurationSec: 25, createdDaysAgo: 190 },
  { id: "TSK-2007", name: "Cache warm-up", description: "Pre-populate Redis hot keys after the nightly flush.", type: "cache", tags: ["cache"], owner: "Tom Becker", schedule: { kind: "daily", hour: 4, minute: 30, timeZone: "Asia/Karachi" }, hosts: ["cache-01"], groups: ["cache-servers"], environment: "production", builtin: "cache-warmup", command: "", retries: 3, timeoutMinutes: 15, concurrency: "skip", failureRate: 0.05, avgDurationSec: 240, createdDaysAgo: 230 },
  { id: "TSK-2008", name: "Quarterly DR drill reminder", description: "Email the DR checklist and owner rotation ahead of each quarterly drill.", type: "report", tags: ["report", "quarterly"], owner: "Marcus Lee", schedule: { kind: "cron", hour: 10, minute: 0, cron: "0 10 1 */3 *", timeZone: "Asia/Karachi" }, hosts: [], groups: [], environment: "all", builtin: "report-email", command: "", retries: 1, timeoutMinutes: 5, concurrency: "skip", failureRate: 0.02, avgDurationSec: 8, createdDaysAgo: 500 },
  { id: "TSK-2009", name: "Nightly database backup verification", description: "Restore the latest backup into a scratch instance and run integrity checks.", type: "backup", tags: ["backup", "database"], owner: "Sara Iqbal", schedule: { kind: "daily", hour: 2, minute: 45, timeZone: "Asia/Karachi" }, hosts: ["db-01"], groups: ["database-cluster"], environment: "production", builtin: "backup-verify", command: "", retries: 1, timeoutMinutes: 120, concurrency: "queue", failureRate: 0.1, avgDurationSec: 480, createdDaysAgo: 210 },
  { id: "TSK-2010", name: "Weekly OS patching - api tier", description: "Rolling patch of api-server-01/02 with connection-draining.", type: "patch", tags: ["patching", "api"], owner: "Marcus Lee", schedule: { kind: "weekly", hour: 2, minute: 0, daysOfWeek: [6], timeZone: "Asia/Karachi" }, hosts: ["api-server-01", "api-server-02"], groups: ["api-services"], environment: "production", builtin: "os-patch", command: "", retries: 1, timeoutMinutes: 120, concurrency: "skip", failureRate: 0.15, avgDurationSec: 1700, createdDaysAgo: 320 },
  { id: "TSK-2011", name: "Nightly ETL pipeline", description: "Extract from primary OLTP, transform and load into the analytics warehouse.", type: "custom", tags: ["etl"], owner: "Priya Nair", schedule: { kind: "daily", hour: 1, minute: 0, timeZone: "Asia/Karachi" }, hosts: ["worker-01"], groups: ["monitoring-stack"], environment: "production", builtin: null, command: "etl-runner --config /etc/etl/nightly.yaml", retries: 2, timeoutMinutes: 150, concurrency: "skip", failureRate: 0.16, avgDurationSec: 2100, createdDaysAgo: 4 },
  { id: "TSK-2012", name: "API health probe", description: "Synthetic health check every 6h against the public API gateway endpoints.", type: "monitoring", tags: ["monitoring", "api"], owner: "Sara Iqbal", schedule: { kind: "cron", hour: 0, minute: 0, cron: "0 */6 * * *", timeZone: "UTC" }, hosts: ["api-server-01"], groups: ["api-services"], environment: "production", builtin: null, command: "/opt/probe/health-probe.sh --suite edge --json", retries: 0, timeoutMinutes: 5, concurrency: "skip", failureRate: 0.03, avgDurationSec: 18, createdDaysAgo: 365 },
  { id: "TSK-2013", name: "Weekly vulnerability scan", description: "Authenticated OpenVAS scan of the production web tier. Paused - PKI migration is replacing OpenVAS.", type: "security", tags: ["security", "web"], owner: "Tom Becker", schedule: { kind: "weekly", hour: 1, minute: 0, daysOfWeek: [3], timeZone: "Asia/Karachi" }, hosts: ["web-app-01", "web-02"], groups: ["production-web"], environment: "production", builtin: null, command: "openvas-launch --target prod-web --report /var/reports/vuln", retries: 1, timeoutMinutes: 180, concurrency: "skip", failureRate: 0.09, avgDurationSec: 3300, createdDaysAgo: 340, enabled: false, pausedDaysAgo: 5 },
  { id: "TSK-2014", name: "Monthly capacity forecast report", description: "Projected CPU/memory/storage growth for the next two quarters.", type: "report", tags: ["report"], owner: "Priya Nair", schedule: { kind: "monthly", hour: 7, minute: 0, dayOfMonth: 15, timeZone: "Europe/London" }, hosts: ["storage-01"], groups: ["backup-group"], environment: "production", builtin: "report-email", command: "", retries: 2, timeoutMinutes: 20, concurrency: "skip", failureRate: 0.04, avgDurationSec: 95, createdDaysAgo: 380 },
  { id: "TSK-2015", name: "Weekly log aggregation", description: "Merge structured logs into object storage and rebuild the index. Paused - moved to the vector.dev pipeline.", type: "custom", tags: ["cleanup"], owner: "Tom Becker", schedule: { kind: "weekly", hour: 5, minute: 0, daysOfWeek: [1], timeZone: "Asia/Karachi" }, hosts: ["app-server-02"], groups: [], environment: "production", builtin: null, command: "log-aggregate --all --dest s3://nexus-logs/weekly", retries: 1, timeoutMinutes: 60, concurrency: "queue", failureRate: 0.08, avgDurationSec: 900, createdDaysAgo: 250, enabled: false, pausedDaysAgo: 7 },
  { id: "TSK-2016", name: "Nightly offsite snapshot", description: "Incremental ZFS snapshot replicated to the offsite backup vault.", type: "backup", tags: ["backup"], owner: "Sara Iqbal", schedule: { kind: "daily", hour: 3, minute: 30, timeZone: "Asia/Karachi" }, hosts: ["storage-01"], groups: ["backup-group"], environment: "production", builtin: "run-backup", command: "", retries: 2, timeoutMinutes: 90, concurrency: "skip", failureRate: 0.22, avgDurationSec: 600, createdDaysAgo: 300 },
  { id: "TSK-2017", name: "SSL certificate auto-renewal", description: "ACME renewal for edge certificates. Paused - certificates now managed by the new PKI pipeline.", type: "security", tags: ["security"], owner: "Sara Iqbal", schedule: { kind: "weekly", hour: 4, minute: 0, daysOfWeek: [5], timeZone: "UTC" }, hosts: ["edge-01"], groups: ["edge-locations"], environment: "production", builtin: null, command: "/opt/acme/renew.sh --all --reload-nginx", retries: 2, timeoutMinutes: 30, concurrency: "skip", failureRate: 0.1, avgDurationSec: 150, createdDaysAgo: 400, enabled: false, pausedDaysAgo: 6 },
  { id: "TSK-2018", name: "Cache flush (staging)", description: "Flush and re-warm the staging Redis instance before the daily seed. Paused - staging rebuilt weekly now.", type: "cache", tags: ["cache"], owner: "Tom Becker", schedule: { kind: "daily", hour: 5, minute: 0, timeZone: "Asia/Karachi" }, hosts: [], groups: ["staging-servers"], environment: "staging", builtin: "cache-warmup", command: "", retries: 1, timeoutMinutes: 10, concurrency: "skip", failureRate: 0.04, avgDurationSec: 120, createdDaysAgo: 150, enabled: false, pausedDaysAgo: 10 },
  { id: "TSK-2019", name: "Daily backup to cold storage", description: "Ship encrypted backup artifacts from storage-01 to the cold vault.", type: "backup", tags: ["backup"], owner: "Sara Iqbal", schedule: { kind: "daily", hour: 2, minute: 15, timeZone: "Asia/Karachi" }, hosts: ["storage-01"], groups: ["backup-group"], environment: "production", builtin: "run-backup", command: "", retries: 2, timeoutMinutes: 120, concurrency: "skip", failureRate: 0.07, avgDurationSec: 540, createdDaysAgo: 290 },
  { id: "TSK-2020", name: "Weekly database vacuum", description: "VACUUM ANALYZE on the largest tables. Paused - deferred to the pg_repack migration.", type: "cleanup", tags: ["database", "cleanup"], owner: "Marcus Lee", schedule: { kind: "weekly", hour: 2, minute: 30, daysOfWeek: [2], timeZone: "Asia/Karachi" }, hosts: ["db-01"], groups: ["database-cluster"], environment: "production", builtin: null, command: "psql -d app -f /opt/db/vacuum.sql", retries: 1, timeoutMinutes: 90, concurrency: "skip", failureRate: 0.12, avgDurationSec: 1200, createdDaysAgo: 420, enabled: false, pausedDaysAgo: 12 },
  { id: "TSK-2021", name: "Monthly invoice reconciliation report", description: "Reconcile issued invoices vs payments; email exceptions to finance.", type: "report", tags: ["report"], owner: "Priya Nair", schedule: { kind: "monthly", hour: 6, minute: 30, dayOfMonth: 5, timeZone: "Europe/London" }, hosts: ["pay-01"], groups: [], environment: "production", builtin: "report-email", command: "", retries: 2, timeoutMinutes: 30, concurrency: "skip", failureRate: 0.05, avgDurationSec: 140, createdDaysAgo: 380 },
  { id: "TSK-2022", name: "Nightly config drift detection", description: "Compare live config to the desired state in Git; alert on drift. Paused - re-baselined against new GitOps state.", type: "monitoring", tags: ["monitoring"], owner: "Tom Becker", schedule: { kind: "daily", hour: 0, minute: 30, timeZone: "Asia/Karachi" }, hosts: ["api-server-01", "app-server-02"], groups: [], environment: "production", builtin: null, command: "config-drift --desired git@nexus.io:platform/infra.git --report", retries: 1, timeoutMinutes: 20, concurrency: "skip", failureRate: 0.07, avgDurationSec: 200, createdDaysAgo: 310, enabled: false, pausedDaysAgo: 4 },
  { id: "TSK-2023", name: "Quarterly access review reminder", description: "Ping team leads to review LDAP/IAM role membership for the quarter.", type: "report", tags: ["report", "quarterly"], owner: "Marcus Lee", schedule: { kind: "cron", hour: 9, minute: 0, cron: "0 9 15 */3 *", timeZone: "Asia/Karachi" }, hosts: [], groups: [], environment: "all", builtin: "report-email", command: "", retries: 1, timeoutMinutes: 5, concurrency: "skip", failureRate: 0.02, avgDurationSec: 6, createdDaysAgo: 500 },
  { id: "TSK-2024", name: "Weekly uptime report", description: "Uptime and error-budget summary for all external endpoints. Paused - superseded by the SLA dashboard.", type: "report", tags: ["report", "sla"], owner: "Priya Nair", schedule: { kind: "weekly", hour: 8, minute: 30, daysOfWeek: [1], timeZone: "Europe/London" }, hosts: ["edge-01"], groups: ["edge-locations"], environment: "production", builtin: "report-email", command: "", retries: 2, timeoutMinutes: 15, concurrency: "skip", failureRate: 0.04, avgDurationSec: 60, createdDaysAgo: 330, enabled: false, pausedDaysAgo: 8 },
  { id: "TSK-2025", name: "Nightly index optimization", description: "Rebuild fragmented indexes concurrently (REINDEX CONCURRENTLY).", type: "custom", tags: ["database"], owner: "Marcus Lee", schedule: { kind: "daily", hour: 4, minute: 0, timeZone: "Asia/Karachi" }, hosts: ["db-01"], groups: ["database-cluster"], environment: "production", builtin: null, command: "psql -d app -f /opt/db/reindex.sql", retries: 1, timeoutMinutes: 60, concurrency: "skip", failureRate: 0.3, avgDurationSec: 780, createdDaysAgo: 270 },
  { id: "TSK-2026", name: "Disk space check", description: "Alert every 6h when any monitored volume drops below the free-space threshold.", type: "monitoring", tags: ["monitoring"], owner: "Tom Becker", schedule: { kind: "cron", hour: 0, minute: 0, cron: "0 */6 * * *", timeZone: "Asia/Karachi" }, hosts: ["app-server-02"], groups: [], environment: "production", builtin: null, command: "check-disk --threshold 12% --alert ops@nexus.io", retries: 0, timeoutMinutes: 2, concurrency: "skip", failureRate: 0.02, avgDurationSec: 4, createdDaysAgo: 360 },
  { id: "TSK-2027", name: "Monthly patching - database tier", description: "Patch db-01 with failover to the replica. Paused - pending change window approval.", type: "patch", tags: ["patching", "database"], owner: "Marcus Lee", schedule: { kind: "monthly", hour: 2, minute: 0, dayOfMonth: 8, timeZone: "Asia/Karachi" }, hosts: ["db-01"], groups: ["database-cluster"], environment: "production", builtin: "os-patch", command: "", retries: 1, timeoutMinutes: 180, concurrency: "skip", failureRate: 0.18, avgDurationSec: 2400, createdDaysAgo: 450, enabled: false, pausedDaysAgo: 9 },
  { id: "TSK-2028", name: "Daily metrics rollup", description: "Downsample raw metrics into 5-minute rollups for long-term storage.", type: "monitoring", tags: ["monitoring"], owner: "Sara Iqbal", schedule: { kind: "daily", hour: 0, minute: 45, timeZone: "UTC" }, hosts: ["worker-01"], groups: ["monitoring-stack"], environment: "production", builtin: "metrics-rollup", command: "", retries: 2, timeoutMinutes: 30, concurrency: "queue", failureRate: 0.05, avgDurationSec: 300, createdDaysAgo: 6 },
];

export const TASK_SEED_META = new Map(SEED_SPECS.map((spec) => [spec.id, { failureRate: spec.failureRate, avgDurationSec: spec.avgDurationSec }]));

function buildTask(spec: SeedSpec): ScheduledTask {
  const createdMs = now - spec.createdDaysAgo * DAY;
  const enabled = spec.enabled ?? true;
  const pausedSinceMs = spec.pausedDaysAgo != null ? now - spec.pausedDaysAgo * DAY : null;
  const createdBy = spec.owner;
  const auditEntries: AuditEntry[] = [
    audit(spec.id, spec.createdDaysAgo, createdBy, "Created", "Task created."),
    audit(spec.id, Math.max(1, spec.createdDaysAgo - 40), spec.owner, "Schedule updated", `Schedule set to ${spec.schedule.kind === "cron" ? spec.schedule.cron : spec.schedule.kind}.`),
    audit(spec.id, Math.max(1, Math.floor(spec.createdDaysAgo / 2)), "Tom Becker", "Timeout updated", `Timeout set to ${spec.timeoutMinutes}m.`),
  ];
  if (pausedSinceMs != null) auditEntries.push(audit(spec.id, spec.pausedDaysAgo ?? 3, CURRENT_USER_NAME, "Paused", "Task paused by operator."));
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    type: spec.type,
    tags: [...spec.tags],
    owner: spec.owner,
    enabled,
    pausedSince: pausedSinceMs != null ? iso(pausedSinceMs) : null,
    schedule: { ...spec.schedule, daysOfWeek: spec.schedule.daysOfWeek ? [...spec.schedule.daysOfWeek] : undefined },
    target: { hosts: [...spec.hosts], groups: [...spec.groups], environment: spec.environment },
    execution: {
      mode: spec.builtin ? "builtin" : "command",
      builtin: spec.builtin,
      command: spec.command,
      retries: spec.retries,
      timeoutMinutes: spec.timeoutMinutes,
      concurrency: spec.concurrency,
    },
    notifications: {
      onFailure: true,
      onSuccess: spec.type === "backup",
      channels: spec.type === "backup" ? ["Email", "Slack"] : ["Email"],
      recipients: spec.owner === "Sara Iqbal" ? ["sara.iqbal@nexus.io", "dba@nexus.io"] : spec.owner === "Priya Nair" ? ["priya.nair@nexus.io"] : ["ops@nexus.io", "sre@nexus.io"],
    },
    createdBy,
    createdAt: iso(createdMs),
    epochMs: createdMs,
    audit: auditEntries.sort((a, b) => a.epochMs - b.epochMs),
  };
}

let TASKS: ScheduledTask[] = SEED_SPECS.map(buildTask);

const listeners = new Set<() => void>();
function emit() { for (const listener of [...listeners]) listener(); }
/** Subscribe to store mutations (used by hooks to re-render on actions). */
export function subscribeScheduledTasks(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getScheduledTasksSnapshot(): ScheduledTask[] { return TASKS; }
/** Clone-and-mutate helper shared by seeds and actions. */
export function cloneTask(task: ScheduledTask): ScheduledTask {
  return {
    ...task,
    tags: [...task.tags],
    schedule: { ...task.schedule, daysOfWeek: task.schedule.daysOfWeek ? [...task.schedule.daysOfWeek] : undefined },
    target: { hosts: [...task.target.hosts], groups: [...task.target.groups], environment: task.target.environment },
    execution: { ...task.execution },
    notifications: { ...task.notifications, channels: [...task.notifications.channels], recipients: [...task.notifications.recipients] },
    audit: task.audit.map((entry) => ({ ...entry })),
  };
}
export function mutateScheduledTasks(ids: string[], patch: (task: ScheduledTask) => Partial<ScheduledTask> | null, auditEntries?: (task: ScheduledTask) => AuditEntry[]): void {
  TASKS = TASKS.map((task) => {
    if (!ids.includes(task.id)) return task;
    const partial = patch(task);
    if (!partial) return task;
    const entries = auditEntries ? auditEntries(task) : [];
    return { ...task, ...partial, audit: [...task.audit, ...entries] };
  });
  emit();
}
export function appendScheduledTaskToStore(task: ScheduledTask): void {
  TASKS = [task, ...TASKS];
  emit();
}
export function deleteScheduledTasksFromStore(ids: string[]): void {
  const idSet = new Set(ids);
  TASKS = TASKS.filter((task) => !idSet.has(task.id));
  emit();
}
/** Highest numeric suffix in use + 1 (TSK-2029, TSK-2030, ...). */
export function nextTaskId(): string {
  let max = 2000;
  for (const task of TASKS) {
    const match = /^TSK-(\d+)$/.exec(task.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `TSK-${max + 1}`;
}
export function makeAuditEntry(actor: string, action: string, detail: string): AuditEntry {
  const epochMs = Date.now();
  return { id: `audit-${epochMs}-${Math.random().toString(36).slice(2, 7)}`, at: iso(epochMs), epochMs, actor, action, detail };
}
