/**
 * Restore points mock data - derived from successful backup runs only.
 * A restore point can only be created by a successful run; failed, skipped
 * and running runs never produce one. Points are rebuilt from the runs
 * store at module load so the two never contradict each other.
 * The store is module-level; a restore action seals the point used and
 * records the operation in mocks/restoreHistory.ts.
 */

import { getBackupsSnapshot } from "@/mocks/backups";
import { getBackupRunsSnapshot, type BackupRun } from "@/mocks/backupRuns";
import type { BackupType } from "@/mocks/backups";

export interface RestorePoint {
  id: string;
  jobId: string;
  runId: string;
  host: string;
  /** Job name, e.g. "Nightly database backup". */
  jobName: string;
  assetType: string;
  type: BackupType;
  createdAt: string;
  epochMs: number;
  sizeBytes: number;
  durationMs: number | null;
  /** Whether post-backup verification passed at seal time. */
  verified: boolean;
  poolId: string;
  /** True for immutable (WORM) copies. */
  immutable: boolean;
}

function build(): RestorePoint[] {
  const jobs = new Map(getBackupsSnapshot().map((job) => [job.id, job]));
  const runs = getBackupRunsSnapshot()
    .filter((run) => run.status === "success")
    .slice()
    .sort((a, b) => b.epochMs - a.epochMs)
    .slice(0, 60);

  const points: RestorePoint[] = [];
  let counter = 0;
  for (const run of runs) {
    const job = jobs.get(run.jobId);
    if (!job) continue;
    counter += 1;
    // Most recent 18 points verified; older ones alternate deterministically.
    const verified = counter <= 18 ? true : counter % 3 !== 0;
    points.push({
      id: `RST-${String(5200 + runs.length - counter).padStart(4, "0")}`,
      jobId: job.id,
      runId: run.id,
      host: job.host,
      jobName: job.name,
      assetType: job.assetType,
      type: job.type,
      createdAt: run.startedAt,
      epochMs: run.epochMs,
      sizeBytes: run.sizeBytes,
      durationMs: run.durationMs,
      verified,
      poolId: job.poolId,
      immutable: job.immutable,
    });
  }
  return points.sort((a, b) => b.epochMs - a.epochMs);
}

const POINTS: RestorePoint[] = build();

export function getRestorePointsSnapshot(): RestorePoint[] { return POINTS; }
export function restorePointsForHost(host: string): RestorePoint[] {
  return POINTS.filter((point) => point.host.toLowerCase() === host.toLowerCase());
}
export function restorePointById(id: string): RestorePoint | null {
  return POINTS.find((point) => point.id === id) ?? null;
}
