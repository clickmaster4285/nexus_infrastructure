"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  cloneTask, deleteScheduledTasksFromStore, getScheduledTasksSnapshot, makeAuditEntry, mutateScheduledTasks,
  nextTaskId, appendScheduledTaskToStore, subscribeScheduledTasks,
  type ExecutionConfig, type NotificationConfig, type ScheduledTask, type TaskTarget, type TaskType,
} from "@/mocks/scheduledTasks";
import { createRunningRun, getTaskRunsSnapshot, mutateTaskRuns, subscribeTaskRuns, type TaskRun } from "@/mocks/taskRuns";
import { GROUP_TO_HOSTS } from "@/mocks/maintenanceWindows";
import { latestRunByTask } from "@/mocks/taskRuns";
import { nextRunAfter } from "@/utils/nextRun";
import type { TaskSchedule } from "@/utils/formatSchedule";

export type TasksStatus = "loading" | "error" | "success";
export type TasksTab = "all" | "active" | "paused" | "failed" | "running";
export type TasksRange = "Today" | "7D" | "30D" | "Custom";

export interface ScheduledTasksFilters {
  tab: TasksTab;
  query: string;
  types: TaskType[];
  groups: string[];
  owners: string[];
  /** Last-run date range filter: Today / 7D / 30D / Custom bounds. */
  range: TasksRange;
  /** Custom range bounds (yyyy-mm-dd), only when range === "Custom". */
  customFrom: string;
  customTo: string;
  /** When true, only tasks with a failure in the last 7d (KPI "Success Rate" click). */
  flakyOnly: boolean;
}

export const DEFAULT_TASKS_FILTERS: ScheduledTasksFilters = {
  tab: "all", query: "", types: [], groups: [], owners: [], range: "30D", customFrom: "", customTo: "", flakyOnly: false,
};

export interface CreateTaskInput {
  name: string;
  description: string;
  type: TaskType;
  tags: string[];
  owner: string;
  enabled: boolean;
  schedule: TaskSchedule;
  target: TaskTarget;
  execution: ExecutionConfig;
  notifications: NotificationConfig;
}

export interface UseScheduledTasksResult {
  /** Filtered tasks (table), newest activity first. */
  tasks: ScheduledTask[];
  /** Unfiltered store view - KPIs/tab counts derive from this. */
  allTasks: ScheduledTask[];
  /** All runs - KPIs/trend/upcoming derive from this. */
  runs: TaskRun[];
  status: TasksStatus;
  reload: () => void;
  createTask: (input: CreateTaskInput) => string;
  updateTask: (id: string, input: CreateTaskInput) => void;
  toggleTask: (id: string, enabled: boolean) => void;
  toggleMany: (ids: string[], enabled: boolean) => void;
  runNow: (id: string) => void;
  retryRun: (taskId: string) => void;
  duplicateTask: (id: string) => string | null;
  deleteTasks: (ids: string[]) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** [startMs, endMs] window for the active range filter; null = unbounded. */
function rangeWindow(filters: ScheduledTasksFilters): { minMs: number; maxMs: number } {
  const now = Date.now();
  switch (filters.range) {
    case "Today": {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return { minMs: start.getTime(), maxMs: now };
    }
    case "7D":
      return { minMs: now - 7 * DAY_MS, maxMs: now };
    case "30D":
      return { minMs: now - 30 * DAY_MS, maxMs: now };
    case "Custom": {
      const from = filters.customFrom ? new Date(`${filters.customFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
      const to = filters.customTo ? new Date(`${filters.customTo}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
      return { minMs: from, maxMs: to };
    }
  }
}

const CURRENT_ACTOR = "you@nexus.io";

function useStoreVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((value) => value + 1);
    const unsubscribeTasks = subscribeScheduledTasks(bump);
    const unsubscribeRuns = subscribeTaskRuns(bump);
    return () => { unsubscribeTasks(); unsubscribeRuns(); };
  }, []);
  return version;
}

/** Mock async fetch with 200-400ms delay; error reachable via ?tasksError=1 (first attempt fails, Retry succeeds). */
export function useScheduledTasks(filters: ScheduledTasksFilters): UseScheduledTasksResult {
  const version = useStoreVersion();
  const [status, setStatus] = useState<TasksStatus>("loading");
  const attemptRef = useRef(0);

  const load = useCallback(() => {
    setStatus("loading");
    const attempt = attemptRef.current;
    attemptRef.current += 1;
    const delay = 200 + Math.random() * 200;
    const timer = window.setTimeout(() => {
      const forcedError = typeof window !== "undefined" && window.location.search.includes("tasksError=1");
      if (forcedError && attempt === 0) {
        setStatus("error");
        return;
      }
      setStatus("success");
    }, delay);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => load(), [load]);

  const allTasks = useMemo(() => getScheduledTasksSnapshot(), [version]);
  const runs = useMemo(() => getTaskRunsSnapshot(), [version]);
  const latest = useMemo(() => latestRunByTask(runs), [runs]);

  const tasks = useMemo(() => {
    const tokens = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
    const { minMs, maxMs } = rangeWindow(filters);
    const expandedGroupHosts = new Set<string>();
    for (const group of filters.groups) for (const host of GROUP_TO_HOSTS[group] ?? []) expandedGroupHosts.add(host);

    return allTasks.filter((task) => {
      const lastRun = latest.get(task.id) ?? null;
      const running = lastRun?.status === "running";
      if (filters.tab === "active" && !task.enabled) return false;
      if (filters.tab === "paused" && task.enabled) return false;
      if (filters.tab === "failed" && lastRun?.status !== "failed") return false;
      if (filters.tab === "running" && !running) return false;
      if (filters.flakyOnly) {
        const failed7d = runs.some((run) => run.taskId === task.id && run.status === "failed" && run.epochMs >= Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (!failed7d) return false;
      }
      if (filters.types.length > 0 && !filters.types.includes(task.type)) return false;
      if (filters.groups.length > 0) {
        const groupMatch = task.target.groups.some((group) => filters.groups.includes(group));
        const hostMatch = task.target.hosts.some((host) => expandedGroupHosts.has(host) || filters.groups.includes(host));
        if (!groupMatch && !hostMatch) return false;
      }
      if (filters.owners.length > 0 && !filters.owners.includes(task.owner)) return false;
      // Keep tasks visible when they ran inside the window, never ran, or are
      // due to run within its end - the view should stay forward-looking too.
      const next = task.enabled ? (nextRunAfter(task.schedule, Date.now()) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
      const inWindow = lastRun == null || (lastRun.epochMs >= minMs && lastRun.epochMs <= maxMs) || next <= maxMs;
      if (!inWindow) return false;
      if (tokens.length > 0) {
        const haystack = `${task.id} ${task.name} ${task.description} ${task.owner} ${task.type} ${task.tags.join(" ")} ${task.target.hosts.join(" ")} ${task.target.groups.join(" ")}`.toLowerCase();
        if (!tokens.every((token) => haystack.includes(token))) return false;
      }
      return true;
    });
  }, [allTasks, runs, latest, filters]);

  const auditEntry = useCallback((action: string, detail: string) => makeAuditEntry(CURRENT_ACTOR, action, detail), []);

  const createTask = useCallback((input: CreateTaskInput): string => {
    const id = nextTaskId();
    const now = Date.now();
    const task: ScheduledTask = {
      ...input,
      id,
      pausedSince: input.enabled ? null : new Date(now).toISOString(),
      createdBy: CURRENT_ACTOR,
      createdAt: new Date(now).toISOString(),
      epochMs: now,
      audit: [makeAuditEntry(CURRENT_ACTOR, "Created", `Task created with schedule ${input.schedule.kind}.`)],
    };
    appendScheduledTaskToStore(task);
    return id;
  }, []);

  const updateTask = useCallback((id: string, input: CreateTaskInput) => {
    const wasEnabled = getScheduledTasksSnapshot().find((task) => task.id === id)?.enabled ?? true;
    mutateScheduledTasks(
      [id],
      () => ({
        ...input,
        pausedSince: input.enabled ? null : wasEnabled ? new Date().toISOString() : undefined,
      }),
      () => [auditEntry("Updated", "Task definition updated.")],
    );
  }, [auditEntry]);

  const toggleTask = useCallback((id: string, enabled: boolean) => {
    mutateScheduledTasks(
      [id],
      (task) => ({ enabled, pausedSince: enabled ? null : new Date().toISOString() }),
      () => [auditEntry(enabled ? "Enabled" : "Paused", enabled ? "Task resumed - schedule is active again." : "Task paused by operator.")],
    );
  }, [auditEntry]);

  const toggleMany = useCallback((ids: string[], enabled: boolean) => {
    mutateScheduledTasks(
      ids,
      () => ({ enabled, pausedSince: enabled ? null : new Date().toISOString() }),
      () => [auditEntry(enabled ? "Enabled" : "Paused", `Bulk ${enabled ? "resume" : "pause"} applied to ${ids.length} task(s).`)],
    );
  }, [auditEntry]);

  const runNow = useCallback((id: string) => {
    createRunningRun(id, "manual", "Manual trigger");
    mutateScheduledTasks([id], () => ({}), () => [auditEntry("Run requested", "Manual run triggered by operator.")]);
  }, [auditEntry]);

  const retryRun = useCallback((taskId: string) => {
    createRunningRun(taskId, "manual", "Retry of failed run");
    mutateScheduledTasks([taskId], () => ({}), () => [auditEntry("Retry requested", "Failed run re-queued by operator.")]);
  }, [auditEntry]);

  const duplicateTask = useCallback((id: string): string | null => {
    const source = getScheduledTasksSnapshot().find((task) => task.id === id);
    if (!source) return null;
    const newId = nextTaskId();
    const now = Date.now();
    const copy = cloneTask(source);
    copy.id = newId;
    copy.name = `Copy of ${source.name}`;
    copy.createdBy = CURRENT_ACTOR;
    copy.createdAt = new Date(now).toISOString();
    copy.epochMs = now;
    copy.audit = [makeAuditEntry(CURRENT_ACTOR, "Duplicated", `Duplicated from ${source.id}.`)];
    appendScheduledTaskToStore(copy);
    return newId;
  }, []);

  const deleteTasks = useCallback((ids: string[]) => {
    deleteScheduledTasksFromStore(ids);
    const idSet = new Set(ids);
    mutateTaskRuns((current) => current.filter((run) => !idSet.has(run.taskId)));
  }, []);

  return { tasks, allTasks, runs, status, reload: load, createTask, updateTask, toggleTask, toggleMany, runNow, retryRun, duplicateTask, deleteTasks };
}
