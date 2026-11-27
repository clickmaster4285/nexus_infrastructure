/**
 * Derived statistics for Scheduled Tasks. Every KPI card, tab count, trend
 * bucket and the Upcoming Runs list derives from the same tasks + runs
 * arrays, so the numbers never contradict each other. Pure functions - no
 * store access.
 */

import type { ScheduledTask } from "@/mocks/scheduledTasks";
import type { TaskRun } from "@/mocks/taskRuns";
import { nextRunAfter } from "@/utils/nextRun";

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface TaskDerived {
  lastRun: TaskRun | null;
  runningRun: TaskRun | null;
  /** null when the task is paused. */
  nextRunMs: number | null;
  /** null when the task produced no completed runs in the last 7d. */
  successRate7d: number | null;
  successRatePrev7d: number | null;
  avgDurationMs: number | null;
  failed7d: number;
  runs7d: number;
}

const byTask = (runs: TaskRun[]): Map<string, TaskRun[]> => {
  const map = new Map<string, TaskRun[]>();
  for (const run of runs) {
    const list = map.get(run.taskId);
    if (list) list.push(run);
    else map.set(run.taskId, [run]);
  }
  return map;
};

function rateIn(runs: TaskRun[], fromMs: number, toMs: number): number | null {
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

export function deriveTaskViews(tasks: ScheduledTask[], runs: TaskRun[], nowMs = Date.now()): Map<string, TaskDerived> {
  const grouped = byTask(runs);
  const map = new Map<string, TaskDerived>();
  for (const task of tasks) {
    const taskRuns = (grouped.get(task.id) ?? []).slice().sort((a, b) => a.epochMs - b.epochMs);
    const runningRun = [...taskRuns].reverse().find((run) => run.status === "running") ?? null;
    const completed = taskRuns.filter((run) => run.status !== "running");
    const lastRun = completed.length > 0 ? completed[completed.length - 1] : null;
    const nextRunMs = task.enabled ? nextRunAfter(task.schedule, nowMs) : null;
    const durations = completed.slice(-20).map((run) => run.durationMs).filter((value): value is number => value != null);
    const avgDurationMs = durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
    const failed7d = taskRuns.filter((run) => run.status === "failed" && run.epochMs >= nowMs - 7 * DAY).length;
    const runs7d = taskRuns.filter((run) => run.epochMs >= nowMs - 7 * DAY).length;
    map.set(task.id, {
      lastRun,
      runningRun,
      nextRunMs,
      successRate7d: rateIn(taskRuns, nowMs - 7 * DAY, nowMs),
      successRatePrev7d: rateIn(taskRuns, nowMs - 14 * DAY, nowMs - 7 * DAY),
      avgDurationMs,
      failed7d,
      runs7d,
    });
  }
  return map;
}

export interface TrendBucket {
  label: string;
  success: number;
  failed: number;
  skipped: number;
}

/** Per-day stacked run counts for the trailing `days` days (chart + 7-day KPI). */
export function deriveTrend(runs: TaskRun[], days: number, nowMs = Date.now()): TrendBucket[] {
  const trend: TrendBucket[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayEnd = nowMs - offset * DAY;
    const dayStart = dayEnd - DAY;
    const anchor = dayStart + 12 * 3_600_000;
    const label = days <= 14
      ? WEEKDAY_SHORT[new Date(anchor).getDay()]
      : new Date(anchor).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const bucket: TrendBucket = { label, success: 0, failed: 0, skipped: 0 };
    for (const run of runs) {
      if (run.epochMs < dayStart || run.epochMs >= dayEnd) continue;
      if (run.status === "success") bucket.success += 1;
      else if (run.status === "failed") bucket.failed += 1;
      else if (run.status === "skipped") bucket.skipped += 1;
    }
    trend.push(bucket);
  }
  return trend;
}

export interface UpcomingRun {
  taskId: string;
  name: string;
  type: ScheduledTask["type"];
  atMs: number;
  targetLabel: string;
}

export interface TaskTabCounts {
  all: number;
  active: number;
  paused: number;
  failed: number;
  running: number;
}

export interface TaskStats {
  total: number;
  active: number;
  paused: number;
  runningNow: number;
  failed24h: number;
  failedPrev24h: number;
  successRate7d: number | null;
  successRateDelta: number | null;
  totalDelta: number;
  failedDelta: number;
  trend: TrendBucket[];
  /** 14 daily success-rate values (days with no runs keep the prior value, 100 first). */
  successSparkline: number[];
  upcoming: UpcomingRun[];
  tabCounts: TaskTabCounts;
  /** Tasks with >= 1 failed run in the last 7d. */
  flaky: number;
}

export function deriveTaskStats(tasks: ScheduledTask[], runs: TaskRun[], nowMs = Date.now()): TaskStats {
  const views = deriveTaskViews(tasks, runs, nowMs);
  const total = tasks.length;
  const active = tasks.filter((task) => task.enabled).length;
  const paused = total - active;
  const runningNow = tasks.filter((task) => views.get(task.id)?.runningRun).length;
  const failed24h = runs.filter((run) => run.status === "failed" && run.epochMs >= nowMs - DAY).length;
  const failedPrev24h = runs.filter((run) => run.status === "failed" && run.epochMs >= nowMs - 2 * DAY && run.epochMs < nowMs - DAY).length;
  const successRate7d = rateIn(runs, nowMs - 7 * DAY, nowMs);
  const successRatePrev7d = rateIn(runs, nowMs - 14 * DAY, nowMs - 7 * DAY);
  const successRateDelta = successRate7d != null && successRatePrev7d != null ? successRate7d - successRatePrev7d : null;
  const totalDelta = tasks.filter((task) => task.epochMs >= nowMs - 7 * DAY).length;
  const flaky = tasks.filter((task) => (views.get(task.id)?.failed7d ?? 0) > 0).length;

  const trend = deriveTrend(runs, 7, nowMs);

  const successSparkline: number[] = [];
  let carry = 100;
  for (let offset = 13; offset >= 0; offset -= 1) {
    const dayEnd = nowMs - offset * DAY;
    const dayStart = dayEnd - DAY;
    const rate = rateIn(runs, dayStart, dayEnd);
    if (rate != null) carry = rate;
    successSparkline.push(carry);
  }

  const upcoming: UpcomingRun[] = [];
  for (const task of tasks) {
    if (!task.enabled) continue;
    const next = nextRunAfter(task.schedule, nowMs);
    if (next == null) continue;
    upcoming.push({ taskId: task.id, name: task.name, type: task.type, atMs: next, targetLabel: targetLabel(task) });
  }
  upcoming.sort((a, b) => a.atMs - b.atMs);

  const tabCounts: TaskTabCounts = { all: total, active, paused, failed: 0, running: runningNow };
  for (const task of tasks) if (views.get(task.id)?.lastRun?.status === "failed") tabCounts.failed += 1;

  return {
    total,
    active,
    paused,
    runningNow,
    failed24h,
    failedPrev24h,
    successRate7d,
    successRateDelta,
    totalDelta,
    failedDelta: failed24h - failedPrev24h,
    trend,
    successSparkline,
    upcoming: upcoming.slice(0, 6),
    tabCounts,
    flaky,
  };
}

/** "db-01" / "db-01 +2" / "2 groups" - compact target string. */
export function targetLabel(task: ScheduledTask): string {
  const hosts = task.target.hosts.length;
  const groups = task.target.groups.length;
  if (hosts === 0 && groups === 0) return "Global scope";
  if (hosts > 0) return groups > 0 ? `${task.target.hosts[0]} +${hosts - 1 + groups}` : hosts > 1 ? `${task.target.hosts[0]} +${hosts - 1}` : task.target.hosts[0];
  return groups === 1 ? task.target.groups[0] : `${task.target.groups[0]} +${groups - 1}`;
}

export interface TargetChip {
  label: string;
  kind: "host" | "group";
}

/** Host chips first, then group chips. Callers slice to 2 and render "+N". */
export function targetChips(task: ScheduledTask): TargetChip[] {
  return [
    ...task.target.hosts.map((host) => ({ label: host, kind: "host" as const })),
    ...task.target.groups.map((group) => ({ label: group, kind: "group" as const })),
  ];
}

/** 168 → "2m 48s"; 45_000 → "45s"; > 1h → "2h 05m". */
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

/** Countdown label: "in 25m" / "in 3h 40m" / "in 2d 5h"; past → "overdue". */
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
