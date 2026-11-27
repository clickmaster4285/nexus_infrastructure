/**
 * Display row model for the Backup Jobs table: merges real jobs with the two
 * unprotected pseudo-rows (bastion-01, vpn-01) into one uniform list. Pure
 * builder - components receive ready-made rows and never derive this shape.
 */

import type { BackupJob, UnprotectedAsset } from "@/mocks/backups";
import type { BackupRun } from "@/mocks/backupRuns";
import type { BackupJobDerived, BackupStatusKey } from "@/utils/backupStats";

export interface BackupDisplayRow {
  /** Stable key: job id, or `asset:<host>` for unprotected rows. */
  key: string;
  isUnprotected: boolean;
  /** Present for job rows. */
  job: BackupJob | null;
  /** Present for unprotected rows. */
  unprotected: UnprotectedAsset | null;
  lastRun: BackupRun | null;
  runningRun: BackupRun | null;
  nextRunMs: number | null;
  rpoLagMinutes: number | null;
  rpoTargetMinutes: number;
  rpoMet: boolean | null;
  status: BackupStatusKey;
  /** True when the latest run was skipped because of an active maintenance window. */
  skippedMaintenance: boolean;
}

export function buildBackupRows(
  jobs: BackupJob[],
  unprotected: UnprotectedAsset[],
  views: Map<string, BackupJobDerived>,
): BackupDisplayRow[] {
  const rows: BackupDisplayRow[] = jobs.map((job) => {
    const view = views.get(job.id);
    const lastRun = view?.lastRun ?? null;
    const runningRun = view?.runningRun ?? null;
    const status: BackupStatusKey = !job.enabled
      ? "paused"
      : runningRun
        ? "running"
        : lastRun?.status === "failed"
          ? "failed"
          : lastRun?.status === "skipped"
            ? "skipped"
            : "success";
    return {
      key: job.id,
      isUnprotected: false,
      job,
      unprotected: null,
      lastRun,
      runningRun,
      nextRunMs: view?.nextRunMs ?? null,
      rpoLagMinutes: view?.rpoLagMinutes ?? null,
      rpoTargetMinutes: job.rpoTargetMinutes,
      rpoMet: view?.rpoMet ?? null,
      status,
      skippedMaintenance: status === "skipped",
    };
  });

  for (const asset of unprotected) {
    rows.push({
      key: `asset:${asset.host}`,
      isUnprotected: true,
      job: null,
      unprotected: asset,
      lastRun: null,
      runningRun: null,
      nextRunMs: null,
      rpoLagMinutes: null,
      rpoTargetMinutes: asset.rpoTargetMinutes,
      rpoMet: null,
      status: "none",
      skippedMaintenance: false,
    });
  }

  return rows;
}
