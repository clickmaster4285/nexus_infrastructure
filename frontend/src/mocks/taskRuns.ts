/**
 * Task runs mock data - companion to mocks/scheduledTasks.ts.
 *
 * Every task gets up to 26 historical runs, generated from its *schedule object*
 * via utils/nextRun (never hand-written timestamps). Runs that overlap a
 * maintenance window covering the task's hosts are recorded as "Skipped
 * (maintenance)" so the Run history matches the Maintenance Windows page.
 * Run store is module-level; actions (run now, retry) push new running runs
 * into it so the open drawer and the table update immediately.
 */

import { readMaintenanceWindowStore, scopeHosts } from "@/mocks/maintenanceWindows";
import { TASK_SEED_META, getScheduledTasksSnapshot, type RunStatus, type ScheduledTask } from "@/mocks/scheduledTasks";
import { occurrencesBetween } from "@/utils/nextRun";

export interface TaskRun {
  id: string;
  taskId: string;
  status: RunStatus;
  startedAt: string;
  epochMs: number;
  /** null while the run is in progress. */
  durationMs: number | null;
  triggeredBy: "schedule" | "manual";
  /** Present when status === "failed". */
  error: string | null;
  /** True when the run was skipped because a maintenance window covered its targets. */
  maintenance: boolean;
  log: string;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const SECOND = 1000;

/** Deterministic per-task RNG so the seed is stable across reloads. */
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

const FAILURE_MESSAGES = [
  "exit code 1 after {dur}",
  "connection refused by {host}:5432 (after {n} attempts)",
  "command timed out after {timeout}m",
  "remote host unreachable: {host} (i/o timeout)",
  "integrity check failed: checksum mismatch on segment 7",
] as const;

function logFor(task: ScheduledTask, status: RunStatus, startedMs: number, durationMs: number, host: string): string {
  const t = (offsetMs: number) => new Date(startedMs + offsetMs).toLocaleTimeString("en-GB", { hour12: false });
  const durationSec = Math.max(1, Math.round(durationMs / SECOND));
  const header = [
    `[${t(0)}] runner starting task=${task.id} action=${task.execution.builtin ?? "custom"}`,
    `[${t(1200)}] resolved targets: ${task.target.hosts.join(", ") || task.target.groups.join(", ") || "global scope"}`,
    `[${t(2500)}] acquiring concurrency policy (${task.execution.concurrency}) timeout=${task.execution.timeoutMinutes}m retries=${task.execution.retries}`,
  ];
  if (status === "skipped") {
    return [...header, `[${t(3000)}] skipped: maintenance window active on target scope`, `[${t(3200)}] exit code 75 (EX_TEMPFAIL) - will retry on next schedule`].join("\n");
  }
  if (status === "running") {
    return [...header, `[${t(4000)}] connected to ${host} (ssl)`, `[${t(5500)}] working...`].join("\n");
  }
  if (status === "failed") {
    return [
      ...header,
      `[${t(4000)}] connected to ${host} (ssl)`,
      `[${t(7000)}] executing...`,
      `[${t(durationMs - 3000)}] ERROR: integrity check failed: checksum mismatch on segment 7`,
      `[${t(durationMs)}] run failed after ${durationSec}s (attempt ${task.execution.retries + 1}/${task.execution.retries + 1})`,
      `[${t(durationMs + 200)}] alert dispatched: ops@nexus.io, slack:#ops-alerts`,
    ].join("\n");
  }
  return [
    ...header,
    `[${t(4000)}] connected to ${host} (ssl)`,
    `[${t(6000)}] executing...`,
    `[${t(durationMs - 2500)}] verification ok`,
    `[${t(durationMs)}] exit code 0 (duration ${Math.floor(durationSec / 60)}m ${durationSec % 60}s)`,
  ].join("\n");
}

/** True when a maintenance window covers `hosts` during [startMs, startMs + durationMs). */
export function maintenanceCoversRun(hosts: string[], startMs: number, durationMs: number): boolean {
  if (hosts.length === 0) return false;
  const endMs = startMs + Math.max(durationMs, 10 * MIN);
  const hostSet = new Set(hosts);
  return readMaintenanceWindowStore().some((window) => {
    if (window.status === "Cancelled") return false;
    const start = Date.parse(window.start);
    const end = Date.parse(window.end);
    if (!(start < endMs && end > startMs)) return false;
    return scopeHosts(window.scope).some((host) => hostSet.has(host));
  });
}

function hostsFor(task: ScheduledTask): string[] {
  if (task.target.hosts.length > 0) return task.target.hosts;
  const resolved: string[] = [];
  for (const group of task.target.groups) {
    // Expand via the shared GROUP_TO_HOSTS mapping (kept consistent with MW/Alerts).
    // scopeHosts needs a scope object; build a synthetic one.
    for (const host of scopeHosts({ servers: [], groups: [group] })) resolved.push(host);
  }
  return [...new Set(resolved)];
}

function buildRunsForTask(task: ScheduledTask): TaskRun[] {
  const meta = TASK_SEED_META.get(task.id);
  const failureRate = meta?.failureRate ?? 0.08;
  const avgDurationMs = (meta?.avgDurationSec ?? 120) * SECOND;
  const rand = mulberry32(hashString(task.id));
  const pausedSinceMs = task.pausedSince ? Date.parse(task.pausedSince) : null;
  const cron = task.schedule.cron ?? "";
  const horizonDays = task.schedule.kind === "weekly" ? 200
    : task.schedule.kind === "monthly" ? 800
    : cron.includes("*/15") ? 0.4
    : cron === "0 * * * *" ? 2
    : cron.includes("*/3") ? 1100
    : 40;
  const horizonStart = Date.now() - horizonDays * DAY;
  const occurrences = occurrencesBetween(task.schedule, horizonStart, Date.now(), 80)
    .filter((epochMs) => pausedSinceMs == null || epochMs < pausedSinceMs)
    .slice(-26);
  const hosts = hostsFor(task);
  const primaryHost = hosts[0] ?? "worker-01";

  const runs: TaskRun[] = occurrences.map((epochMs, index) => {
    const jitter = 0.6 + rand() * 0.9;
    const durationMs = Math.round(avgDurationMs * jitter);
    const forcedFail = (task.id === "TSK-2004" || task.id === "TSK-2016" || task.id === "TSK-2025") && index === occurrences.length - 1;
    const inMaintenance = maintenanceCoversRun(hosts, epochMs, durationMs);
    let status: RunStatus;
    if (inMaintenance) status = "skipped";
    else if (forcedFail || rand() < failureRate) status = "failed";
    else status = "success";
    const triggeredBy = rand() < 0.12 ? "manual" : "schedule";
    const error = status === "failed" ? FAILURE_MESSAGES[Math.floor(rand() * FAILURE_MESSAGES.length)].replace("{dur}", `${Math.round(durationMs / SECOND)}s`).replace("{host}", primaryHost).replace("{n}", "3").replace("{timeout}", String(task.execution.timeoutMinutes)) : null;
    return {
      id: `${task.id}-R${String(index + 1).padStart(3, "0")}`,
      taskId: task.id,
      status,
      startedAt: new Date(epochMs).toISOString(),
      epochMs,
      durationMs,
      triggeredBy,
      error,
      maintenance: inMaintenance,
      log: logFor(task, status, epochMs, durationMs, primaryHost),
    };
  });

  // Tasks flagged as "running now": replace the latest past run with an in-progress one.
  const runningSpec: Record<string, { minutesAgo: number; elapsedSec: number }> = {
    "TSK-2001": { minutesAgo: 9, elapsedSec: 540 },
    "TSK-2010": { minutesAgo: 24, elapsedSec: 1420 },
  };
  const running = runningSpec[task.id];
  if (running && task.enabled) {
    const epochMs = Date.now() - running.minutesAgo * MIN;
    runs.push({
      id: `${task.id}-R${String(runs.length + 1).padStart(3, "0")}`,
      taskId: task.id,
      status: "running",
      startedAt: new Date(epochMs).toISOString(),
      epochMs,
      durationMs: null,
      triggeredBy: "schedule",
      error: null,
      maintenance: false,
      log: logFor(task, "running", epochMs, running.elapsedSec * SECOND, primaryHost),
    });
  }

  return runs.sort((a, b) => a.epochMs - b.epochMs);
}

function seed(): TaskRun[] {
  const all: TaskRun[] = [];
  for (const task of getScheduledTasksSnapshot()) all.push(...buildRunsForTask(task));
  return all;
}

let RUNS: TaskRun[] = seed();

const listeners = new Set<() => void>();
function emit() { for (const listener of [...listeners]) listener(); }
export function subscribeTaskRuns(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getTaskRunsSnapshot(): TaskRun[] { return RUNS; }
/** Replace the runs array (used by actions that add/patch runs). */
export function mutateTaskRuns(mutate: (runs: TaskRun[]) => TaskRun[]): void {
  RUNS = mutate(RUNS);
  emit();
}
/** Append a fresh running run for a manual trigger / retry. */
export function createRunningRun(taskId: string, triggeredBy: "manual" | "schedule", label: string): TaskRun {
  const epochMs = Date.now();
  const task = getScheduledTasksSnapshot().find((entry) => entry.id === taskId);
  const host = task?.target.hosts[0] ?? "worker-01";
  const run: TaskRun = {
    id: `${taskId}-R${String(RUNS.filter((run) => run.taskId === taskId).length + 1).padStart(3, "0")}`,
    taskId,
    status: "running",
    startedAt: new Date(epochMs).toISOString(),
    epochMs,
    durationMs: null,
    triggeredBy,
    error: null,
    maintenance: false,
    log: task ? logFor(task, "running", epochMs, 30_000, host) : `[${new Date(epochMs).toLocaleTimeString("en-GB", { hour12: false })}] ${label}\n[run started]`,
  };
  mutateTaskRuns((runs) => [...runs, run]);
  return run;
}
/** Latest run per task, keyed by taskId. */
export function latestRunByTask(runs: TaskRun[]): Map<string, TaskRun> {
  const map = new Map<string, TaskRun>();
  for (const run of runs) {
    const current = map.get(run.taskId);
    if (!current || run.epochMs > current.epochMs) map.set(run.taskId, run);
  }
  return map;
}
