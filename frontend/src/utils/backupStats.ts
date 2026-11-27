/**
 * Derived statistics for Backups & Recovery. Every KPI card, tab count, trend
 * bucket, chart and banner derives from the same jobs + runs arrays, so the
 * numbers never contradict each other. Pure functions - no store access.
 */

import type { BackupJob } from "@/mocks/backups";
import type { BackupRun } from "@/mocks/backupRuns";
import type { DrDrill } from "@/mocks/restoreHistory";
import { nextRunAfter } from "@/utils/nextRun";
import { assessRpo } from "@/utils/rpoCalc";

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface BackupJobDerived {
  lastRun: BackupRun | null;
  runningRun: BackupRun | null;
  /** null when the job is paused. */
  nextRunMs: number | null;
  lastSuccessMs: number | null;
  /** Minutes since last successful run; null when never succeeded or paused-exempt handled by met/lag null. */
  rpoLagMinutes: number | null;
  rpoMet: boolean | null;
  successRate7d: number | null;
  avgDurationMs: number | null;
  failed24h: number;
}

const byJob = (runs: BackupRun[]): Map<string, BackupRun[]> => {
  const map = new Map<string, BackupRun[]>();
  for (const run of runs) {
    const list = map.get(run.jobId);
    if (list) list.push(run);
    else map.set(run.jobId, [run]);
  }
  return map;
};

function rateIn(runs: BackupRun[], fromMs: number, toMs: number): number | null {
  let success = 0;
  let failed = 0;
  for (const run of runs) {
    if (run.epochMs < fromMs || run.epochMs >= toMs) continue;
    if (run.status === "success") success += 1;
    else if (run.status === "failed") failed += 1;
  }
  const total = success + failed;
  return total === 0 ? null : Math.round((success / total) * 100);
}

export function deriveBackupViews(jobs: BackupJob[], runs: BackupRun[], nowMs = Date.now()): Map<string, BackupJobDerived> {
  const grouped = byJob(runs);
  const map = new Map<string, BackupJobDerived>();
  for (const job of jobs) {
    const jobRuns = (grouped.get(job.id) ?? []).slice().sort((a, b) => a.epochMs - b.epochMs);
    const runningRun = [...jobRuns].reverse().find((run) => run.status === "running") ?? null;
    const completed = jobRuns.filter((run) => run.status !== "running");
    const lastRun = completed.length > 0 ? completed[completed.length - 1] : null;
    const lastSuccess = [...completed].reverse().find((run) => run.status === "success") ?? null;
    const lastSuccessMs = lastSuccess ? lastSuccess.epochMs : null;
    const assessment = job.enabled ? assessRpo(lastSuccessMs, job.rpoTargetMinutes, nowMs) : { lagMinutes: null, met: null };
    const nextRunMs = job.enabled ? nextRunAfter(job.schedule, nowMs) : null;
    const durations = completed.slice(-20).map((run) => run.durationMs).filter((value): value is number => value != null);
    const avgDurationMs = durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
    const failed24h = jobRuns.filter((run) => run.status === "failed" && run.epochMs >= nowMs - DAY).length;
    map.set(job.id, {
      lastRun,
      runningRun,
      nextRunMs,
      lastSuccessMs,
      rpoLagMinutes: assessment.lagMinutes,
      rpoMet: assessment.met,
      successRate7d: rateIn(jobRuns, nowMs - 7 * DAY, nowMs),
      avgDurationMs,
      failed24h,
    });
  }
  return map;
}

export interface TrendBucket {
  label: string;
  /** yyyy-mm-dd, used by chart bar-click -> Jobs tab filter. */
  dateKey: string;
  success: number;
  failed: number;
  skipped: number;
  /** Total bytes written by successful runs that day. */
  sizeBytes: number;
}

/** Per-day compliance fraction across assessable (enabled) jobs. null = no assessable data for that day. */
export function deriveComplianceSparkline(jobs: BackupJob[], runs: BackupRun[], days = 30, nowMs = Date.now()): Array<number | null> {
  const enabled = jobs.filter((job) => job.enabled);
  const byJob = new Map<string, BackupRun[]>();
  for (const run of runs) {
    const list = byJob.get(run.jobId);
    if (list) list.push(run);
    else byJob.set(run.jobId, [run]);
  }
  for (const list of byJob.values()) list.sort((a, b) => a.epochMs - b.epochMs);

  const spark: Array<number | null> = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayEnd = nowMs - offset * DAY;
    let met = 0;
    let total = 0;
    for (const job of enabled) {
      const jobRuns = byJob.get(job.id);
      if (!jobRuns || jobRuns.length === 0) continue;
      let lastSuccess: BackupRun | null = null;
      for (let index = jobRuns.length - 1; index >= 0; index -= 1) {
        if (jobRuns[index].epochMs < dayEnd && jobRuns[index].status === "success") {
          lastSuccess = jobRuns[index];
          break;
        }
      }
      total += 1;
      if (lastSuccess && dayEnd - lastSuccess.epochMs <= job.rpoTargetMinutes * 60_000) met += 1;
    }
    spark.push(total > 0 ? (met / total) * 100 : null);
  }
  return spark;
}

/** Per-day stacked run counts for the trailing `days` days (chart + 7d KPI). */
export function deriveTrend(runs: BackupRun[], days: number, nowMs = Date.now()): TrendBucket[] {
  const trend: TrendBucket[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayEnd = nowMs - offset * DAY;
    const dayStart = dayEnd - DAY;
    const anchor = dayStart + 12 * 3_600_000;
    const label = days <= 14
      ? WEEKDAY_SHORT[new Date(anchor).getDay()]
      : new Date(anchor).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const dateKey = new Date(dayStart).toISOString().slice(0, 10);
    const bucket: TrendBucket = { label, dateKey, success: 0, failed: 0, skipped: 0, sizeBytes: 0 };
    for (const run of runs) {
      if (run.epochMs < dayStart || run.epochMs >= dayEnd) continue;
      if (run.status === "success") {
        bucket.success += 1;
        bucket.sizeBytes += run.sizeBytes;
      } else if (run.status === "failed") bucket.failed += 1;
      else if (run.status === "skipped") bucket.skipped += 1;
    }
    trend.push(bucket);
  }
  return trend;
}

export type BackupStatusKey = "success" | "failed" | "running" | "skipped" | "paused" | "none";

export interface BackupStats {
  totalJobs: number;
  /** Distinct hosts with at least one job. */
  protectedAssets: number;
  /** Protected + unprotected assets. */
  totalAssets: number;
  unprotectedCount: number;
  runningNow: number;
  pausedJobs: number;
  failedRuns24h: number;
  failedJobs24h: number;
  failedRunsPrev24h: number;
  failedDelta: number;
  successRate7d: number | null;
  successRatePrev7d: number | null;
  successRateDelta: number | null;
  /** 14 daily success-rate values (days with no assessable runs keep the prior value). */
  successSparkline: number[];
  /** 14 daily failed-run counts. */
  failedSparkline: number[];
  /** Sum of bytes across every seeded run (trailing ~30 days of backups). */
  totalBackupSizeBytes: number;
  rpoCompliancePct: number | null;
  rpoAssessable: number;
  rpoMet: number;
  rpoBreachCount: number;
  /** Latest DR drill summary. */
  lastRestoreTestResult: "Passed" | "Failed" | null;
  lastRestoreTestDaysAgo: number | null;
  /** Distinct jobs whose most recent run is failed (for banner + tab consistency). */
  failedJobIds: string[];
  /** Distinct jobs whose most recent run is skipped (maintenance). */
  skippedJobIds: string[];
  /** Status counts for the filter dropdown (jobs only, excludes unprotected pseudo-rows). */
  statusCounts: Record<BackupStatusKey, number>;
  /** Epoch ms of the most recent successful run across all jobs; null when never. */
  lastSuccessMs: number | null;
  /** Job name/id of the most recent successful run (for KPI hints). */
  lastSuccessJobName: string | null;
  /** Total successful runs in the trailing 7 days. */
  successRuns7d: number;
}

export function deriveBackupStats(
  jobs: BackupJob[],
  runs: BackupRun[],
  unprotectedCount: number,
  drills: DrDrill[],
  nowMs = Date.now(),
): BackupStats {
  const views = deriveBackupViews(jobs, runs, nowMs);
  const totalJobs = jobs.length;
  const protectedAssets = new Set(jobs.map((job) => job.host)).size;
  const totalAssets = protectedAssets + unprotectedCount;
  const runningNow = jobs.filter((job) => views.get(job.id)?.runningRun).length;
  const pausedJobs = jobs.filter((job) => !job.enabled).length;

  const failedRuns24h = runs.filter((run) => run.status === "failed" && run.epochMs >= nowMs - DAY).length;
  const failedPrev24h = runs.filter((run) => run.status === "failed" && run.epochMs >= nowMs - 2 * DAY && run.epochMs < nowMs - DAY).length;
  const failedJobs24h = new Set(runs.filter((run) => run.status === "failed" && run.epochMs >= nowMs - DAY).map((run) => run.jobId)).size;

  const successRate7d = rateIn(runs, nowMs - 7 * DAY, nowMs);
  const successRatePrev7d = rateIn(runs, nowMs - 14 * DAY, nowMs - 7 * DAY);
  const successRateDelta = successRate7d != null && successRatePrev7d != null ? successRate7d - successRatePrev7d : null;

  const successSparkline: number[] = [];
  const failedSparkline: number[] = [];
  let carry = 100;
  for (let offset = 13; offset >= 0; offset -= 1) {
    const dayEnd = nowMs - offset * DAY;
    const dayStart = dayEnd - DAY;
    const rate = rateIn(runs, dayStart, dayEnd);
    if (rate != null) carry = rate;
    successSparkline.push(carry);
    failedSparkline.push(runs.filter((run) => run.status === "failed" && run.epochMs >= dayStart && run.epochMs < dayEnd).length);
  }

  const totalBackupSizeBytes = runs.reduce((sum, run) => sum + run.sizeBytes, 0);

  let rpoAssessable = 0;
  let rpoMet = 0;
  for (const job of jobs) {
    const view = views.get(job.id);
    if (!view || view.rpoMet === null) continue; // paused jobs are not assessable
    rpoAssessable += 1;
    if (view.rpoMet) rpoMet += 1;
  }
  const rpoCompliancePct = rpoAssessable === 0 ? null : Math.round((rpoMet / rpoAssessable) * 100);
  const rpoBreachCount = rpoAssessable - rpoMet;

  const latestDrill = drills.length > 0 ? drills.reduce((latest, drill) => (drill.epochMs > latest.epochMs ? drill : latest)) : null;

  const failedJobIds = jobs.filter((job) => views.get(job.id)?.lastRun?.status === "failed").map((job) => job.id);
  const skippedJobIds = jobs.filter((job) => views.get(job.id)?.lastRun?.status === "skipped").map((job) => job.id);

  const jobNameById = new Map(jobs.map((job) => [job.id, job.name] as const));
  let lastSuccessMs: number | null = null;
  let lastSuccessJobName: string | null = null;
  let successRuns7d = 0;
  for (const run of runs) {
    if (run.status === "success") {
      if (run.epochMs >= nowMs - 7 * DAY) successRuns7d += 1;
      if (lastSuccessMs == null || run.epochMs > lastSuccessMs) {
        lastSuccessMs = run.epochMs;
        lastSuccessJobName = jobNameById.get(run.jobId) ?? null;
      }
    }
  }

  const statusCounts: Record<BackupStatusKey, number> = { success: 0, failed: 0, running: 0, skipped: 0, paused: 0, none: unprotectedCount };
  for (const job of jobs) {
    const view = views.get(job.id);
    if (!job.enabled) statusCounts.paused += 1;
    else if (view?.runningRun) statusCounts.running += 1;
    else if (view?.lastRun?.status === "failed") statusCounts.failed += 1;
    else if (view?.lastRun?.status === "skipped") statusCounts.skipped += 1;
    else statusCounts.success += 1;
  }

  return {
    totalJobs,
    protectedAssets,
    totalAssets,
    unprotectedCount,
    runningNow,
    pausedJobs,
    failedRuns24h,
    failedJobs24h,
    failedRunsPrev24h: failedPrev24h,
    failedDelta: failedRuns24h - failedPrev24h,
    successRate7d,
    successRatePrev7d,
    successRateDelta,
    successSparkline,
    failedSparkline,
    totalBackupSizeBytes,
    rpoCompliancePct,
    rpoAssessable,
    rpoMet,
    rpoBreachCount,
    lastRestoreTestResult: latestDrill ? latestDrill.result : null,
    lastRestoreTestDaysAgo: latestDrill ? Math.floor((nowMs - latestDrill.epochMs) / DAY) : null,
    failedJobIds,
    skippedJobIds,
    statusCounts,
    lastSuccessMs,
    lastSuccessJobName,
    successRuns7d,
  };
}

/** 168 -> "2m 48s"; 45_000 -> "45s"; > 1h -> "2h 05m". */
export function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes < 60) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** Countdown label: "in 25m" / "in 3h 40m" / "in 2d 5h"; past -> "overdue". */
export function formatCountdown(targetMs: number, nowMs = Date.now()): string {
  const diff = targetMs - nowMs;
  if (diff <= 0) return "overdue";
  const totalMin = Math.floor(diff / 60_000);
  if (totalMin < 1) return "in <1m";
  if (totalMin < 60) return `in ${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours < 24) return minutes > 0 ? `in ${hours}h ${minutes}m` : `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d ${hours % 24}h`;
}

export type FailureCategory = "timeout" | "disk-full" | "auth" | "agent-offline" | "snapshot" | "other";
export const FAILURE_CATEGORY_LABELS: Record<FailureCategory, string> = {
  timeout: "Timeout",
  "disk-full": "Disk full",
  auth: "Auth failed",
  "agent-offline": "Agent offline",
  snapshot: "Snapshot error",
  other: "Other",
};

function categorizeError(error: string | null): FailureCategory {
  if (!error) return "other";
  const text = error.toLowerCase();
  if (/timed out|timeout/.test(text)) return "timeout";
  if (/no space|disk full|space left|device/.test(text)) return "disk-full";
  if (/refused|denied|authentic|credential|auth/.test(text)) return "auth";
  if (/agent|heartbeat|unreachable/.test(text)) return "agent-offline";
  if (/snapshot|read-only|checksum|integrity|locked/.test(text)) return "snapshot";
  return "other";
}

export interface FailureReason {
  category: FailureCategory;
  label: string;
  count: number;
  /** 0-100, scaled to the largest bucket. */
  pct: number;
}

/** Top 5 failure categories over the trailing `days` days, sorted desc. */
export function deriveFailureReasons(runs: BackupRun[], days = 7, nowMs = Date.now()): FailureReason[] {
  const counts = new Map<FailureCategory, number>();
  for (const run of runs) {
    if (run.status !== "failed" || run.epochMs < nowMs - days * DAY) continue;
    const category = categorizeError(run.error);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const entries = [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  const top = entries.slice(0, 5);
  const max = top[0]?.count ?? 0;
  return top.map((entry) => ({
    category: entry.category,
    count: entry.count,
    label: FAILURE_CATEGORY_LABELS[entry.category],
    pct: max > 0 ? Math.round((entry.count / max) * 100) : 0,
  }));
}
