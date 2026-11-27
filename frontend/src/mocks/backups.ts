/**
 * Backups & Recovery mock data - single source of truth for
 * Operations > Backups & Recovery.
 *
 * Domain: Assets (jobs' hosts ∪ unprotected list) / BackupJob (22,
 * BJ-1042..BJ-1063) / BackupRun / RestorePoint / StoragePool (3 pools,
 * 3-2-1-1) / Policy (Critical, Standard) / RestoreDrill (mocks/restoreHistory).
 * Scheduled Tasks backup tasks (TSK-2001/2009/2016/2019) match jobs 1:1.
 * Hosts, groups and owners are consistent with Alerts / Maintenance Windows /
 * Uptime & SLA / Scheduled Tasks mocks.
 *
 * Stored vs derived (deliberate): the store keeps the mutable configuration
 * (enabled, schedule, pool, retention, policy). Everything else - status,
 * lastRun, nextRunAt, RPO, KPIs - derives from the runs array
 * (mocks/backupRuns.ts) via utils/backupStats + utils/rpoCalc, so numbers
 * can never contradict each other. The unprotected-asset list is a store too;
 * "Protect asset" removes an asset from it and appends the first job.
 */

import type { TaskSchedule } from "@/utils/formatSchedule";
import { GROUP_TO_HOSTS } from "@/mocks/maintenanceWindows";

export type BackupStatus = "success" | "failed" | "running" | "skipped" | "paused" | "none";
export type BackupType = "full" | "incremental" | "snapshot" | "differential";
export type PolicyTier = "Critical" | "Standard";
export type BackupEnvironment = "production" | "staging" | "all";

export interface BackupAuditEntry {
  id: string;
  at: string;
  epochMs: number;
  actor: string;
  action: string;
  detail: string;
}

export interface Policy {
  id: "POL-critical" | "POL-standard";
  tier: PolicyTier;
  rpoHours: number;
  rtoMinutes: number;
  retentionDays: number;
  copies: number;
}

export const POLICIES: Policy[] = [
  { id: "POL-critical", tier: "Critical", rpoHours: 4, rtoMinutes: 60, retentionDays: 90, copies: 3 },
  { id: "POL-standard", tier: "Standard", rpoHours: 24, rtoMinutes: 120, retentionDays: 30, copies: 2 },
];
export const policyById = (id: string | null | undefined): Policy | null => POLICIES.find((policy) => policy.id === id) ?? null;

/** Minimal asset descriptor used for coverage/protection accounting (derived from the job store + unprotected list). */
export interface AssetView {
  host: string;
  assetType: string;
  group: string | null;
  environment: BackupEnvironment;
  owner: string;
  tier: PolicyTier;
  protected: boolean;
  policyId: "POL-critical" | "POL-standard" | null;
}

export interface BackupJob {
  id: string;
  name: string;
  host: string;
  group: string | null;
  assetType: string;
  environment: BackupEnvironment;
  owner: string;
  type: BackupType;
  schedule: TaskSchedule;
  poolId: string;
  retentionDays: number;
  policyId: "POL-critical" | "POL-standard";
  tier: PolicyTier;
  /** RPO target in minutes (job-level override; e.g. cold storage allows 48h). */
  rpoTargetMinutes: number;
  rtoTargetMinutes: number;
  /** false = paused. Paused jobs get no new runs and show "Paused" as next run. */
  enabled: boolean;
  immutable: boolean;
  encrypted: boolean;
  notifications: {
    onFailure: boolean;
    channels: string[];
  };
  /** Linked Scheduled Tasks backup task id, e.g. TSK-2001 (null when none). */
  taskId: string | null;
  tags: string[];
  createdBy: string;
  createdAt: string;
  epochMs: number;
  pausedSince: string | null;
  audit: BackupAuditEntry[];
}

export interface UnprotectedAsset {
  host: string;
  assetType: string;
  group: string | null;
  environment: BackupEnvironment;
  owner: string;
  rpoTargetMinutes: number;
  rtoTargetMinutes: number;
  tier: PolicyTier;
}

export const BACKUP_TYPE_LABELS: Record<BackupType, string> = { full: "Full", incremental: "Incremental", differential: "Differential", snapshot: "Snapshot" };
export const BACKUP_OWNERS = ["Sara Iqbal", "Tom Becker", "Marcus Lee", "Priya Nair"] as const;
export const BACKUP_ASSET_TYPES = ["Database", "Replica", "Web", "API", "App", "Cache", "Edge", "Storage", "ETL", "Payments", "Queue", "Search", "Load balancer", "Auth", "Monitoring", "Access", "Network"] as const;
export const BACKUP_ENVIRONMENTS = ["production", "staging", "all"] as const;
/** Canonical hosts an operator can protect with a new backup job. */
export const BACKUP_PROTECTABLE_HOSTS = [
  "api-server-01", "api-server-02", "app-server-02", "auth-01", "bastion-01", "cache-01",
  "db-01", "db-02", "edge-01", "edge-02", "lb-01", "monitor-01",
  "pay-01", "queue-01", "search-01", "storage-01", "vpn-01", "web-app-01", "web-02", "worker-01",
] as const;
export const BACKUP_GROUP_OPTIONS = Object.keys(GROUP_TO_HOSTS);

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

function audit(id: string, daysAgo: number, actor: string, action: string, detail: string): BackupAuditEntry {
  const epochMs = now - daysAgo * DAY;
  return { id: `${id}-audit-${action.toLowerCase().replace(/\s+/g, "-")}-${Math.round(epochMs)}`, at: iso(epochMs), epochMs, actor, action, detail };
}

interface SeedSpec {
  id: string;
  name: string;
  host: string;
  group: string | null;
  assetType: string;
  owner: string;
  type: BackupType;
  schedule: TaskSchedule;
  retentionDays: number;
  poolId: string;
  immutable: boolean;
  rpoTargetMinutes: number;
  rtoTargetMinutes: number;
  tier: PolicyTier;
  failureRate: number;
  avgDurationSec: number;
  /** Average backup size in GB; used to derive per-run sizes. */
  avgSizeGb: number;
  createdDaysAgo: number;
  taskId?: string | null;
  tags?: string[];
  enabled?: boolean;
  pausedDaysAgo?: number;
  environment?: BackupEnvironment;
}

const SEED_SPECS: SeedSpec[] = [
  // --- database tier (1 RPO breach: BJ-1042) ---------------------------------
  { id: "BJ-1042", name: "Nightly database backup", host: "db-01", group: "database-cluster", assetType: "Database", owner: "Sara Iqbal", type: "full", schedule: { kind: "daily", hour: 2, minute: 0, timeZone: "Asia/Karachi" }, retentionDays: 90, poolId: "pool-s3", immutable: true, rpoTargetMinutes: 4 * 60, rtoTargetMinutes: 60, tier: "Critical", failureRate: 0.25, avgDurationSec: 320, avgSizeGb: 4.2, createdDaysAgo: 210, taskId: "TSK-2001", tags: ["backup", "database"] },
  { id: "BJ-1043", name: "Nightly database backup verification", host: "db-01", group: "database-cluster", assetType: "Database", owner: "Sara Iqbal", type: "snapshot", schedule: { kind: "daily", hour: 2, minute: 45, timeZone: "Asia/Karachi" }, retentionDays: 30, poolId: "pool-nas", immutable: false, rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 120, tier: "Standard", failureRate: 0.08, avgDurationSec: 260, avgSizeGb: 1.1, createdDaysAgo: 210, taskId: "TSK-2009", tags: ["backup", "database", "verification"] },
  { id: "BJ-1044", name: "Database replica backup", host: "db-02", group: "database-cluster", assetType: "Replica", owner: "Marcus Lee", type: "incremental", schedule: { kind: "cron", hour: 0, minute: 0, cron: "0 */4 * * *", timeZone: "Asia/Karachi" }, retentionDays: 90, poolId: "pool-s3", immutable: true, rpoTargetMinutes: 4 * 60, rtoTargetMinutes: 60, tier: "Critical", failureRate: 0, avgDurationSec: 180, avgSizeGb: 0.8, createdDaysAgo: 180, tags: ["backup", "database"] },
  // --- web tier --------------------------------------------------------------
  { id: "BJ-1045", name: "Nightly web tier backup", host: "web-app-01", group: "production-web", assetType: "Web", owner: "Marcus Lee", type: "incremental", schedule: { kind: "daily", hour: 1, minute: 30, timeZone: "Asia/Karachi" }, retentionDays: 30, poolId: "pool-nas", immutable: false, rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 120, tier: "Standard", failureRate: 0.04, avgDurationSec: 95, avgSizeGb: 1.4, createdDaysAgo: 320, tags: ["backup", "web"] },
  { id: "BJ-1046", name: "Weekly web full backup", host: "web-app-01", group: "production-web", assetType: "Web", owner: "Marcus Lee", type: "full", schedule: { kind: "weekly", hour: 3, minute: 0, daysOfWeek: [0], timeZone: "Asia/Karachi" }, retentionDays: 30, poolId: "pool-s3", immutable: true, rpoTargetMinutes: 10 * 24 * 60, rtoTargetMinutes: 120, tier: "Standard", failureRate: 0.03, avgDurationSec: 420, avgSizeGb: 6.8, createdDaysAgo: 320, tags: ["backup", "web"] },
  { id: "BJ-1047", name: "Nightly web backup", host: "web-02", group: "production-web", assetType: "Web", owner: "Marcus Lee", type: "incremental", schedule: { kind: "daily", hour: 1, minute: 45, timeZone: "Asia/Karachi" }, retentionDays: 30, poolId: "pool-nas", immutable: false, rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 120, tier: "Standard", failureRate: 0.04, avgDurationSec: 90, avgSizeGb: 1.3, createdDaysAgo: 300, tags: ["backup", "web"] },
  // --- api tier --------------------------------------------------------------
  { id: "BJ-1048", name: "API checkpoint backup", host: "api-server-01", group: "api-services", assetType: "API", owner: "Tom Becker", type: "incremental", schedule: { kind: "cron", hour: 0, minute: 0, cron: "0 */6 * * *", timeZone: "UTC" }, retentionDays: 30, poolId: "pool-nas", immutable: false, rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 60, tier: "Standard", failureRate: 0.06, avgDurationSec: 75, avgSizeGb: 0.9, createdDaysAgo: 250, tags: ["backup", "api"] },
  { id: "BJ-1049", name: "Nightly API backup", host: "api-server-02", group: "api-services", assetType: "API", owner: "Tom Becker", type: "incremental", schedule: { kind: "daily", hour: 1, minute: 15, timeZone: "Asia/Karachi" }, retentionDays: 30, poolId: "pool-nas", immutable: false, rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 60, tier: "Standard", failureRate: 0.05, avgDurationSec: 70, avgSizeGb: 0.9, createdDaysAgo: 250, tags: ["backup", "api"] },
  // --- app / cache -----------------------------------------------------------
  { id: "BJ-1050", name: "Nightly app server backup", host: "app-server-02", group: null, assetType: "App", owner: "Tom Becker", type: "incremental", schedule: { kind: "daily", hour: 0, minute: 30, timeZone: "Asia/Karachi" }, retentionDays: 30, poolId: "pool-nas", immutable: false, rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 120, tier: "Standard", failureRate: 0.07, avgDurationSec: 85, avgSizeGb: 1.6, createdDaysAgo: 260, tags: ["backup", "api"] },
  { id: "BJ-1051", name: "Nightly cache snapshot", host: "cache-01", group: "cache-servers", assetType: "Cache", owner: "Tom Becker", type: "snapshot", schedule: { kind: "daily", hour: 4, minute: 0, timeZone: "Asia/Karachi" }, retentionDays: 30, poolId: "pool-nas", immutable: false, rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 30, tier: "Standard", failureRate: 0.02, avgDurationSec: 40, avgSizeGb: 0.4, createdDaysAgo: 230, tags: ["backup"] },
  // --- edge ------------------------------------------------------------------
  { id: "BJ-1052", name: "Edge config snapshot", host: "edge-01", group: "edge-locations", assetType: "Edge", owner: "Tom Becker", type: "snapshot", schedule: { kind: "cron", hour: 0, minute: 15, cron: "15 */12 * * *", timeZone: "Asia/Karachi" }, retentionDays: 30, poolId: "pool-vault", immutable: true, rpoTargetMinutes: 48 * 60, rtoTargetMinutes: 45, tier: "Standard", failureRate: 0.05, avgDurationSec: 35, avgSizeGb: 0.2, createdDaysAgo: 350, tags: ["backup", "edge", "offsite"] },
  { id: "BJ-1053", name: "Edge config snapshot — secondary", host: "edge-02", group: "edge-locations", assetType: "Edge", owner: "Tom Becker", type: "snapshot", schedule: { kind: "cron", hour: 3, minute: 15, cron: "15 */12 * * *", timeZone: "Asia/Karachi" }, retentionDays: 30, poolId: "pool-vault", immutable: true, rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 45, tier: "Standard", failureRate: 0.05, avgDurationSec: 35, avgSizeGb: 0.2, createdDaysAgo: 350, tags: ["backup", "edge", "offsite"] },
  // --- storage / cold vault ---------------------------------------------------
  { id: "BJ-1054", name: "Nightly offsite snapshot", host: "storage-01", group: "backup-group", assetType: "Storage", owner: "Sara Iqbal", type: "full", schedule: { kind: "daily", hour: 3, minute: 30, timeZone: "Asia/Karachi" }, retentionDays: 90, poolId: "pool-vault", immutable: true, rpoTargetMinutes: 48 * 60, rtoTargetMinutes: 240, tier: "Standard", failureRate: 0.05, avgDurationSec: 540, avgSizeGb: 8.6, createdDaysAgo: 300, taskId: "TSK-2016", tags: ["backup", "storage", "offsite", "cold-storage"] },
  { id: "BJ-1055", name: "Daily backup to cold storage", host: "storage-01", group: "backup-group", assetType: "Storage", owner: "Sara Iqbal", type: "full", schedule: { kind: "daily", hour: 2, minute: 15, timeZone: "Asia/Karachi" }, retentionDays: 180, poolId: "pool-vault", immutable: true, rpoTargetMinutes: 48 * 60, rtoTargetMinutes: 240, tier: "Standard", failureRate: 0.06, avgDurationSec: 500, avgSizeGb: 8.1, createdDaysAgo: 290, taskId: "TSK-2019", tags: ["backup", "storage", "cold-storage"] },
  // --- remaining services ------------------------------------------------------
  { id: "BJ-1056", name: "Nightly ETL backup", host: "worker-01", group: "monitoring-stack", assetType: "ETL", owner: "Priya Nair", type: "incremental", schedule: { kind: "daily", hour: 1, minute: 45, timeZone: "Asia/Karachi" }, retentionDays: 30, poolId: "pool-nas", immutable: false, rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 180, tier: "Standard", failureRate: 0.08, avgDurationSec: 240, avgSizeGb: 2.3, createdDaysAgo: 200, tags: ["backup"] },
  { id: "BJ-1057", name: "Nightly payments backup", host: "pay-01", group: null, assetType: "Payments", owner: "Priya Nair", type: "full", schedule: { kind: "daily", hour: 2, minute: 45, timeZone: "Asia/Karachi" }, retentionDays: 90, poolId: "pool-s3", immutable: true, rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 60, tier: "Standard", failureRate: 0.03, avgDurationSec: 210, avgSizeGb: 1.9, createdDaysAgo: 280, enabled: false, pausedDaysAgo: 3, tags: ["backup"] },
  { id: "BJ-1058", name: "Nightly message queue backup", host: "queue-01", group: null, assetType: "Queue", owner: "Sara Iqbal", type: "incremental", schedule: { kind: "daily", hour: 0, minute: 15, timeZone: "Asia/Karachi" }, retentionDays: 30, poolId: "pool-nas", immutable: false, rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 60, tier: "Standard", failureRate: 0.05, avgDurationSec: 60, avgSizeGb: 0.6, createdDaysAgo: 240, tags: ["backup"] },
  { id: "BJ-1059", name: "Nightly search index backup", host: "search-01", group: null, assetType: "Search", owner: "Marcus Lee", type: "snapshot", schedule: { kind: "daily", hour: 3, minute: 0, timeZone: "Asia/Karachi" }, retentionDays: 30, poolId: "pool-nas", immutable: false, rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 90, tier: "Standard", failureRate: 0.04, avgDurationSec: 150, avgSizeGb: 3.2, createdDaysAgo: 220, tags: ["backup"] },
  { id: "BJ-1060", name: "Nightly load balancer config", host: "lb-01", group: null, assetType: "Load balancer", owner: "Tom Becker", type: "snapshot", schedule: { kind: "daily", hour: 6, minute: 0, timeZone: "Asia/Karachi" }, retentionDays: 30, poolId: "pool-nas", immutable: false, rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 30, tier: "Standard", failureRate: 0.02, avgDurationSec: 25, avgSizeGb: 0.1, createdDaysAgo: 400, tags: ["backup", "edge"] },
  { id: "BJ-1061", name: "Nightly auth backup", host: "auth-01", group: null, assetType: "Auth", owner: "Priya Nair", type: "incremental", schedule: { kind: "daily", hour: 2, minute: 20, timeZone: "Asia/Karachi" }, retentionDays: 90, poolId: "pool-s3", immutable: true, rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 60, tier: "Standard", failureRate: 0.02, avgDurationSec: 65, avgSizeGb: 0.3, createdDaysAgo: 400, tags: ["backup"] },
  { id: "BJ-1062", name: "Nightly monitoring backup", host: "monitor-01", group: "monitoring-stack", assetType: "Monitoring", owner: "Priya Nair", type: "incremental", schedule: { kind: "daily", hour: 0, minute: 45, timeZone: "Asia/Karachi" }, retentionDays: 30, poolId: "pool-nas", immutable: false, rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 120, tier: "Standard", failureRate: 0.05, avgDurationSec: 80, avgSizeGb: 1.1, createdDaysAgo: 190, tags: ["backup"] },
  { id: "BJ-1063", name: "Weekly API full backup", host: "api-server-01", group: "api-services", assetType: "API", owner: "Tom Becker", type: "full", schedule: { kind: "weekly", hour: 4, minute: 30, daysOfWeek: [6], timeZone: "UTC" }, retentionDays: 90, poolId: "pool-s3", immutable: true, rpoTargetMinutes: 10 * 24 * 60, rtoTargetMinutes: 120, tier: "Standard", failureRate: 0.02, avgDurationSec: 300, avgSizeGb: 5.2, createdDaysAgo: 250, tags: ["backup", "api"] },
];

/** Jobs whose latest seeded run is forced to fail so the page opens on the documented failure states. */
export const FORCED_FAILURE_JOB_IDS = ["BJ-1042", "BJ-1054"] as const;
/** Job seeding an in-progress run (progress driven by backupRuns). */
export const RUNNING_JOB_ID = "BJ-1048";
/** Job whose latest seeded run is recorded as skipped by a maintenance window (edge-01). */
export const MAINTENANCE_SKIP_JOB_ID = "BJ-1052";

const SEED_META = new Map(SEED_SPECS.map((spec) => [spec.id, { failureRate: spec.failureRate, avgDurationSec: spec.avgDurationSec, avgSizeGb: spec.avgSizeGb }]));
export function backupSeedMeta(id: string) {
  return SEED_META.get(id) ?? { failureRate: 0.05, avgDurationSec: 120, avgSizeGb: 1 };
}

/** Assets with no backup configured yet. Lives in-memory; "Protect now" removes from here and appends the new job. */
let UNPROTECTED_ASSETS: UnprotectedAsset[] = [
  { host: "bastion-01", assetType: "Access", group: null, environment: "production", owner: "Marcus Lee", rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 60, tier: "Standard" },
  { host: "vpn-01", assetType: "Network", group: null, environment: "production", owner: "Tom Becker", rpoTargetMinutes: 24 * 60, rtoTargetMinutes: 60, tier: "Standard" },
];

/** Live view of the unprotected list. */
export function getUnprotectedSnapshot(): UnprotectedAsset[] { return UNPROTECTED_ASSETS; }

/** Combine jobs' hosts + unprotected list into one asset registry view. Protected count derives here so banner/KPIs/tabs never disagree. */
export function listAssetViews(jobs: BackupJob[] = JOBS): AssetView[] {
  const views: AssetView[] = jobs.map((job) => ({
    host: job.host,
    assetType: job.assetType,
    group: job.group,
    environment: job.environment,
    owner: job.owner,
    tier: job.tier,
    protected: true,
    policyId: job.policyId,
  }));
  const seen = new Set(views.map((view) => view.host));
  for (const unprotected of UNPROTECTED_ASSETS) {
    if (seen.has(unprotected.host)) continue;
    views.push({ host: unprotected.host, assetType: unprotected.assetType, group: unprotected.group, environment: unprotected.environment, owner: unprotected.owner, tier: unprotected.tier, protected: false, policyId: null });
  }
  // Distinct hosts only (a host may carry several jobs).
  const unique = new Map<string, AssetView>();
  for (const view of views) if (!unique.has(view.host)) unique.set(view.host, view);
  return [...unique.values()];
}

/** Map from Scheduled Tasks backup task id -> backup job id (same jobs, one-to-one). */
export const TASK_ID_TO_BACKUP_JOB: Record<string, string> = SEED_SPECS.reduce<Record<string, string>>((map, spec) => {
  if (spec.taskId) map[spec.taskId] = spec.id;
  return map;
}, {});

export const CURRENT_USER_NAME = "you@nexus.io";

function buildJob(spec: SeedSpec): BackupJob {
  const createdMs = now - spec.createdDaysAgo * DAY;
  const enabled = spec.enabled ?? true;
  const pausedSinceMs = spec.pausedDaysAgo != null ? now - spec.pausedDaysAgo * DAY : null;
  const createdBy = spec.owner;
  const auditEntries: BackupAuditEntry[] = [
    audit(spec.id, spec.createdDaysAgo, createdBy, "Created", "Backup job created."),
    audit(spec.id, Math.max(1, spec.createdDaysAgo - 40), spec.owner, "Policy updated", `Retention set to ${spec.retentionDays} days.`),
    audit(spec.id, Math.max(1, Math.floor(spec.createdDaysAgo / 2)), "Tom Becker", "Storage updated", `Destination reviewed (${spec.poolId}).`),
  ];
  if (pausedSinceMs != null) auditEntries.push(audit(spec.id, spec.pausedDaysAgo ?? 3, CURRENT_USER_NAME, "Paused", "Backup paused by operator."));
  return {
    id: spec.id,
    name: spec.name,
    host: spec.host,
    group: spec.group,
    assetType: spec.assetType,
    environment: spec.environment ?? "production",
    owner: spec.owner,
    type: spec.type,
    schedule: { ...spec.schedule, daysOfWeek: spec.schedule.daysOfWeek ? [...spec.schedule.daysOfWeek] : undefined },
    poolId: spec.poolId,
    retentionDays: spec.retentionDays,
    policyId: spec.tier === "Critical" ? "POL-critical" : "POL-standard",
    tier: spec.tier,
    rpoTargetMinutes: spec.rpoTargetMinutes,
    rtoTargetMinutes: spec.rtoTargetMinutes,
    enabled,
    immutable: spec.immutable,
    encrypted: true,
    notifications: {
      onFailure: true,
      channels: spec.type === "full" ? ["Email", "Slack"] : ["Email"],
    },
    taskId: spec.taskId ?? null,
    tags: [...(spec.tags ?? ["backup"])],
    createdBy,
    createdAt: iso(createdMs),
    epochMs: createdMs,
    pausedSince: pausedSinceMs != null ? iso(pausedSinceMs) : null,
    audit: auditEntries.sort((a, b) => a.epochMs - b.epochMs),
  };
}

let JOBS: BackupJob[] = SEED_SPECS.map(buildJob);

const listeners = new Set<() => void>();
function emit() { for (const listener of [...listeners]) listener(); }
/** Subscribe to store mutations (used by hooks to re-render on actions). */
export function subscribeBackups(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function getBackupsSnapshot(): BackupJob[] { return JOBS; }
export function cloneJob(job: BackupJob): BackupJob {
  return {
    ...job,
    schedule: { ...job.schedule, daysOfWeek: job.schedule.daysOfWeek ? [...job.schedule.daysOfWeek] : undefined },
    notifications: { ...job.notifications, channels: [...job.notifications.channels] },
    tags: [...job.tags],
    audit: job.audit.map((entry) => ({ ...entry })),
  };
}
export function mutateBackups(ids: string[], patch: (job: BackupJob) => Partial<BackupJob> | null, auditEntries?: (job: BackupJob) => BackupAuditEntry[]): void {
  JOBS = JOBS.map((job) => {
    if (!ids.includes(job.id)) return job;
    const partial = patch(job);
    if (!partial) return job;
    const entries = auditEntries ? auditEntries(job) : [];
    return { ...job, ...partial, audit: [...job.audit, ...entries] };
  });
  emit();
}
export function appendBackupJob(job: BackupJob): void {
  JOBS = [job, ...JOBS];
  emit();
}
export function deleteBackupsFromStore(ids: string[]): void {
  const idSet = new Set(ids);
  JOBS = JOBS.filter((job) => !idSet.has(job.id));
  emit();
}
/** Highest BJ-#### suffix in use + 1. */
export function nextBackupId(): string {
  let max = 1041;
  for (const job of JOBS) {
    const match = /^BJ-(\d+)$/.exec(job.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `BJ-${max + 1}`;
}
export function makeAuditEntry(actor: string, action: string, detail: string): BackupAuditEntry {
  const epochMs = Date.now();
  return { id: `audit-${epochMs}-${Math.random().toString(36).slice(2, 7)}`, at: iso(epochMs), epochMs, actor, action, detail };
}

/** Reverse GROUP_TO_HOSTS lookup: host -> its group, or null when ungrouped. */
export function groupForHost(host: string): string | null {
  for (const [group, hosts] of Object.entries(GROUP_TO_HOSTS)) {
    if (hosts.includes(host)) return group;
  }
  return null;
}

export interface CreateBackupJobInput {
  name: string;
  host: string;
  assetType: string;
  environment: BackupEnvironment;
  owner: string;
  type: BackupType;
  schedule: TaskSchedule;
  retentionDays: number;
  poolId: string;
  immutability: boolean;
  notificationsOnFailure: boolean;
  notificationChannels: string[];
  enabled: boolean;
}

/** Builds a new (unsaved) backup job with sane defaults for a freshly created policy. */
export function createBackupJob(input: CreateBackupJobInput): BackupJob {
  const nowMs = Date.now();
  const id = nextBackupId();
  const retentionDays = Math.min(3650, Math.max(1, Math.round(input.retentionDays) || 1));
  const tier: PolicyTier = "Standard";
  return {
    id,
    name: input.name.trim() || "New backup job",
    host: input.host,
    group: groupForHost(input.host),
    assetType: input.assetType,
    environment: input.environment,
    owner: input.owner,
    type: input.type,
    schedule: { ...input.schedule, daysOfWeek: input.schedule.daysOfWeek ? [...input.schedule.daysOfWeek] : undefined },
    poolId: input.poolId,
    retentionDays,
    policyId: "POL-standard",
    tier,
    rpoTargetMinutes: 24 * 60,
    rtoTargetMinutes: 120,
    enabled: input.enabled,
    immutable: input.immutability,
    encrypted: true,
    notifications: { onFailure: input.notificationsOnFailure, channels: [...input.notificationChannels] },
    taskId: null,
    tags: ["backup"],
    createdBy: CURRENT_USER_NAME,
    createdAt: iso(nowMs),
    epochMs: nowMs,
    pausedSince: input.enabled ? null : new Date(nowMs).toISOString(),
    audit: [makeAuditEntry(CURRENT_USER_NAME, "Created", `Backup job created for ${input.host}.`)],
  };
}

/** "Protect now" from the Coverage tab: removes the asset from the unprotected list and appends its first job. */
export function protectAsset(host: string, policyId: "POL-critical" | "POL-standard", poolId: string, schedule: TaskSchedule, owner: string): BackupJob {
  const spec: SeedSpec = {
    id: nextBackupId(),
    name: `Backup for ${host}`,
    host,
    group: groupForHost(host),
    assetType: UNPROTECTED_ASSETS.find((asset) => asset.host === host)?.assetType ?? "App",
    owner,
    type: "full",
    schedule,
    retentionDays: 30,
    poolId,
    immutable: true,
    rpoTargetMinutes: policyId === "POL-critical" ? 4 * 60 : 24 * 60,
    rtoTargetMinutes: policyId === "POL-critical" ? 60 : 120,
    tier: policyId === "POL-critical" ? "Critical" : "Standard",
    failureRate: 0.03,
    avgDurationSec: 180,
    avgSizeGb: 1.5,
    createdDaysAgo: 0,
    tags: ["backup"],
  };
  const job = buildJob(spec);
  JOBS = [job, ...JOBS];
  UNPROTECTED_ASSETS = UNPROTECTED_ASSETS.filter((asset) => asset.host !== host);
  emit();
  return job;
}
