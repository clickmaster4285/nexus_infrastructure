/**
 * Backup runs mock data - companion to mocks/backups.ts.
 *
 * Every job gets up to 30 historical runs, generated from its *schedule object*
 * via utils/nextRun (never hand-written timestamps). Runs that overlap a
 * maintenance window covering the job's host are recorded as "skipped" so the
 * history matches the Maintenance Windows page. Failures are pinned by the
 * FORCED_FAILURES table (12 failed runs in 7d, 3 within 24h, category-aligned
 * so the Failure Reasons and Top Failing Jobs cards match). One job seeds an
 * in-progress run and one job's latest run is forced to be skipped by a
 * maintenance window. The run store is module-level; actions push new running
 * runs into it so the table and drawer update immediately.
 */

import { readMaintenanceWindowStore, scopeHosts } from "@/mocks/maintenanceWindows";
import { MAINTENANCE_SKIP_JOB_ID, RUNNING_JOB_ID, getBackupsSnapshot, backupSeedMeta, type BackupJob, type BackupStatus } from "@/mocks/backups";
import { occurrencesBetween } from "@/utils/nextRun";

export type BackupRunStatus = BackupStatus;

export interface BackupRun {
  id: string;
  jobId: string;
  status: BackupRunStatus;
  startedAt: string;
  epochMs: number;
  /** null while the run is in progress. */
  durationMs: number | null;
  /** Size of the backup artifact in bytes. 0 for skipped runs. */
  sizeBytes: number;
  triggeredBy: "schedule" | "manual";
  /** Present when status === "failed". */
  error: string | null;
  /** True when the run was skipped because a maintenance window covered its host. */
  maintenance: boolean;
  /** 0-100, only present while status === "running". */
  progress: number | null;
  log: string;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const SECOND = 1000;
const GB = 1024 * 1024 * 1024;

/** Deterministic per-job RNG so the seed is stable across reloads. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Deterministic failure schedule - exactly 12 failed runs in the trailing 7 days,
 * 3 within 24h, with categories for the Failure Reasons card and top-failing-jobs:
 *   Auth failed 5 (db-01 3 + app-server-02 2)  ·  Snapshot error 3 (storage-01 2 + edge-01 1)
 *   Agent offline 2 (app-server-02 1 + edge-02 1)  ·  Other 1 (db-01)  ·  Timeout 1 (storage-01)
 */
const FORCED_FAILURES: ReadonlyArray<{ jobId: string; offsetFromLatest: number; error: string }> = [
  { jobId: "BJ-1042", offsetFromLatest: 0, error: "connection refused by db-01:5432 (after 3 attempts)" },
  { jobId: "BJ-1042", offsetFromLatest: 1, error: "connection refused by db-01:5432 (after 3 attempts)" },
  { jobId: "BJ-1042", offsetFromLatest: 2, error: "connection refused by db-01:5432 (after 3 attempts)" },
  { jobId: "BJ-1042", offsetFromLatest: 4, error: "exit code 1 after 320s" },
  { jobId: "BJ-1054", offsetFromLatest: 1, error: "backup target read-only: snapshot locked by offsite vault policy" },
  { jobId: "BJ-1054", offsetFromLatest: 2, error: "backup target read-only: snapshot locked by offsite vault policy" },
  { jobId: "BJ-1054", offsetFromLatest: 3, error: "command timed out after 90m" },
  { jobId: "BJ-1050", offsetFromLatest: 1, error: "connection refused by app-server-02:5432 (after 3 attempts)" },
  { jobId: "BJ-1050", offsetFromLatest: 2, error: "connection refused by app-server-02:5432 (after 3 attempts)" },
  { jobId: "BJ-1050", offsetFromLatest: 3, error: "agent heartbeat missed 3 times on app-server-02" },
  { jobId: "BJ-1048", offsetFromLatest: 1, error: "agent heartbeat missed 3 times on api-server-01" },
  { jobId: "BJ-1052", offsetFromLatest: 1, error: "backup target read-only: snapshot locked by offsite vault policy" },
];

/** Failure seeding is deterministic: see the FORCED_FAILURES table near the top of this file. */

function logFor(job: BackupJob, status: BackupRunStatus, startedMs: number, durationMs: number, host: string): string {
  const t = (offsetMs: number) => new Date(startedMs + offsetMs).toLocaleTimeString("en-GB", { hour12: false });
  const durationSec = Math.max(1, Math.round(durationMs / SECOND));
  const header = [
    `[${t(0)}] runner starting job=${job.id} type=${job.type} target=${job.poolId}`,
    `[${t(1100)}] resolved asset: ${host}${job.group ? ` (group ${job.group})` : ""} owner=${job.owner}`,
    `[${t(2400)}] encryption=${job.encrypted ? "AES-256" : "none"} immutability=${job.immutable ? "enabled" : "disabled"} retention=${job.retentionDays}d`,
  ];
  if (status === "skipped") {
    return [...header, `[${t(2800)}] skipped: maintenance window active on target scope`, `[${t(3000)}] exit code 75 (EX_TEMPFAIL) - will run on next schedule`].join("\n");
  }
  if (status === "running") {
    return [...header, `[${t(4200)}] connected to ${host} (ssl)`, `[${t(5600)}] streaming blocks 0x0000-0x1F40...`, `[${t(9000)}] progress steady at ~42%`].join("\n");
  }
  if (status === "failed") {
    return [
      ...header,
      `[${t(4000)}] connected to ${host} (ssl)`,
      `[${t(7000)}] executing ${job.type} backup...`,
      `[${t(durationMs - 3000)}] ERROR: integrity check failed: checksum mismatch on segment 7`,
      `[${t(durationMs)}] backup failed after ${durationSec}s (attempt 1/2)`,
      `[${t(durationMs + 250)}] alert dispatched: ops@nexus.io, slack:#ops-alerts`,
    ].join("\n");
  }
  return [
    ...header,
    `[${t(4000)}] connected to ${host} (ssl)`,
    `[${t(6500)}] executing ${job.type} backup...`,
    `[${t(durationMs - 2200)}] verification ok (checksum)`,
    `[${t(durationMs)}] exit code 0 (duration ${Math.floor(durationSec / 60)}m ${durationSec % 60}s, ${(Math.round(durationMs / 97) / 100).toFixed(2)} ratio)`,
    `[${t(durationMs + 150)}] restore point sealed`,
  ].join("\n");
}

/** True when a maintenance window covers `hosts` during [startMs, startMs + durationMs). */
export function maintenanceCoversRun(hosts: string[], startMs: number, durationMs: number): boolean {
  return firstCoveringMaintenanceWindow(hosts, startMs, durationMs) != null;
}

/** First window covering the host/time window, if any. Used for "skipped (maintenance)" warnings + links. */
export function firstCoveringMaintenanceWindow(hosts: string[], startMs: number, durationMs: number) {
  if (hosts.length === 0) return null;
  const endMs = startMs + Math.max(durationMs, 10 * MIN);
  const hostSet = new Set(hosts);
  return readMaintenanceWindowStore().find((window) => {
    if (window.status === "Cancelled") return false;
    const start = Date.parse(window.start);
    const end = Date.parse(window.end);
    if (!(start < endMs && end > startMs)) return false;
    return scopeHosts(window.scope).some((host) => hostSet.has(host));
  }) ?? null;
}

function buildRunsForJob(job: BackupJob): BackupRun[] {
  const meta = backupSeedMeta(job.id);
  const avgDurationMs = meta.avgDurationSec * SECOND;
  const avgSizeBytes = meta.avgSizeGb * GB;
  const rand = mulberry32(hashString(job.id));
  const pausedSinceMs = job.pausedSince ? Date.parse(job.pausedSince) : null;
  const cron = job.schedule.cron ?? "";
  const horizonDays = job.schedule.kind === "weekly" ? 400
    : cron.includes("*/4") ? 6
    : cron.includes("*/6") ? 8
    : cron.includes("*/12") ? 16
    : 45;
  const horizonStart = Date.now() - horizonDays * DAY;
  const occurrences = occurrencesBetween(job.schedule, horizonStart, Date.now(), 80)
    .filter((epochMs) => pausedSinceMs == null || epochMs < pausedSinceMs)
    .slice(-30);
  const hosts = [job.host];

  const runs: BackupRun[] = occurrences.map((epochMs, index) => {
    const jitter = 0.72 + rand() * 0.55;
    const durationMs = Math.round(avgDurationMs * jitter);
    const sizeJitter = 0.68 + rand() * 0.7;
    const sizeBytes = Math.round(avgSizeBytes * sizeJitter);
    // Maintenance-driven skip is seeded for the designated edge-01 job; every other job shows organic status.
    const inMaintenance = job.id === MAINTENANCE_SKIP_JOB_ID && (index === occurrences.length - 1 || maintenanceCoversRun(hosts, epochMs, durationMs));
    const fromLatest = occurrences.length - 1 - index;
    const forcedFailure = FORCED_FAILURES.find((failure) => failure.jobId === job.id && failure.offsetFromLatest === fromLatest);
    let status: BackupRunStatus;
    if (inMaintenance) status = "skipped";
    else if (forcedFailure) status = "failed";
    else status = "success";
    const triggeredBy = rand() < 0.08 ? "manual" : "schedule";
    const error = status === "failed" ? (forcedFailure?.error ?? "exit code 1") : null;
    return {
      id: `${job.id}-R${String(index + 1).padStart(3, "0")}`,
      jobId: job.id,
      status,
      startedAt: new Date(epochMs).toISOString(),
      epochMs,
      durationMs,
      sizeBytes: status === "skipped" ? 0 : sizeBytes,
      triggeredBy,
      error,
      maintenance: inMaintenance,
      progress: null,
      log: logFor(job, status, epochMs, durationMs, job.host),
    };
  });

  // The seeded "running now" job: append an in-progress run at 42%.
  if (job.id === RUNNING_JOB_ID && job.enabled) {
    const startedMs = Date.now() - 9 * MIN;
    runs.push({
      id: `${job.id}-R${String(runs.length + 1).padStart(3, "0")}`,
      jobId: job.id,
      status: "running",
      startedAt: new Date(startedMs).toISOString(),
      epochMs: startedMs,
      durationMs: null,
      sizeBytes: Math.round(avgSizeBytes * 0.42),
      triggeredBy: "schedule",
      error: null,
      maintenance: false,
      progress: 42,
      log: logFor(job, "running", startedMs, 9 * MIN, job.host),
    });
  }

  return runs.sort((a, b) => a.epochMs - b.epochMs);
}

function seed(): BackupRun[] {
  const all: BackupRun[] = [];
  for (const job of getBackupsSnapshot()) all.push(...buildRunsForJob(job));
  return all;
}

let RUNS: BackupRun[] = seed();

const listeners = new Set<() => void>();
function emit() { for (const listener of [...listeners]) listener(); }
export function subscribeBackupRuns(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function getBackupRunsSnapshot(): BackupRun[] { return RUNS; }
export function mutateBackupRuns(mutate: (runs: BackupRun[]) => BackupRun[]): void {
  RUNS = mutate(RUNS);
  emit();
}
/** Append a fresh in-progress run for a manual trigger. */
export function createRunningBackupRun(jobId: string, triggeredBy: "manual" | "schedule"): BackupRun {
  const epochMs = Date.now();
  const job = getBackupsSnapshot().find((entry) => entry.id === jobId);
  const host = job?.host ?? "worker-01";
  const run: BackupRun = {
    id: `${jobId}-R${String(RUNS.filter((run) => run.jobId === jobId).length + 1).padStart(3, "0")}`,
    jobId,
    status: "running",
    startedAt: new Date(epochMs).toISOString(),
    epochMs,
    durationMs: null,
    sizeBytes: 0,
    triggeredBy,
    error: null,
    maintenance: false,
    progress: 8,
    log: job ? logFor(job, "running", epochMs, 30_000, host) : `[${new Date(epochMs).toLocaleTimeString("en-GB", { hour12: false })}] run requested\n[run started]`,
  };
  mutateBackupRuns((runs) => [...runs, run]);
  return run;
}
/** Latest run per job, keyed by jobId. */
export function latestBackupRunByJob(runs: BackupRun[]): Map<string, BackupRun> {
  const map = new Map<string, BackupRun>();
  for (const run of runs) {
    const current = map.get(run.jobId);
    if (!current || run.epochMs > current.epochMs) map.set(run.jobId, run);
  }
  return map;
}
