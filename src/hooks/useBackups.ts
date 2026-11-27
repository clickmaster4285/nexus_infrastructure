"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  appendBackupJob, createBackupJob, deleteBackupsFromStore, getBackupsSnapshot, getUnprotectedSnapshot, makeAuditEntry, mutateBackups, protectAsset as protectAssetInStore,
  subscribeBackups, type BackupJob, type CreateBackupJobInput, type UnprotectedAsset,
} from "@/mocks/backups";
import { createRunningBackupRun, getBackupRunsSnapshot, mutateBackupRuns, subscribeBackupRuns, type BackupRun } from "@/mocks/backupRuns";
import { appendDrill, appendRestoreOperation, getDrillsSnapshot, nextDrillId, nextRestoreId, subscribeDrills, type DrDrill } from "@/mocks/restoreHistory";
import { latestBackupRunByJob } from "@/mocks/backupRuns";
import { nextRunAfter } from "@/utils/nextRun";
import type { TaskSchedule } from "@/utils/formatSchedule";
import type { BackupType } from "@/mocks/backups";
import type { BackupStatusKey } from "@/utils/backupStats";

export type BackupsStatus = "loading" | "error" | "success";
export type BackupsTab = "jobs" | "points" | "coverage" | "policies";
export type BackupsRange = "Today" | "7D" | "30D" | "Custom";

export interface BackupsFilters {
  tab: BackupsTab;
  /** Status multi-select inside the Backup Jobs table. Empty = all. */
  statuses: BackupStatusKey[];
  query: string;
  assetTypes: string[];
  types: BackupType[];
  locations: string[];
  ranWithin: BackupsRange;
  customFrom: string;
  customTo: string;
  /** Restrict rows to runs that started on this calendar date (yyyy-mm-dd, local), used by chart bar clicks. */
  date: string;
}

export const DEFAULT_BACKUPS_FILTERS: BackupsFilters = {
  tab: "jobs", statuses: [], query: "", assetTypes: [], types: [], locations: [], ranWithin: "30D", customFrom: "", customTo: "", date: "",
};

export interface PolicyInput {
  name: string;
  type: BackupType;
  schedule: TaskSchedule;
  retentionDays: number;
  poolId: string;
  immutability: boolean;
  notificationsOnFailure: boolean;
  notificationChannels: string[];
}

export interface UseBackupsResult {
  /** Filtered jobs (table). Never includes unprotected pseudo-rows. */
  jobs: BackupJob[];
  /** Unfiltered store view - KPIs/status counts derive from this. */
  allJobs: BackupJob[];
  /** All runs - KPIs/trend derive from this. */
  runs: BackupRun[];
  unprotectedAssets: UnprotectedAsset[];
  drills: DrDrill[];
  status: BackupsStatus;
  reload: () => void;
  runNow: (id: string) => void;
  pauseMany: (ids: string[]) => void;
  resumeMany: (ids: string[]) => void;
  deleteJobs: (ids: string[]) => void;
  updatePolicy: (id: string, input: PolicyInput, saveAndEnable: boolean) => void;
  /** Creates a brand-new backup job in the store. Returns the new job id. */
  createJob: (input: CreateBackupJobInput) => string;
  /** "Protect now" (Coverage tab): removes an unprotected asset from the list and appends its first job. Returns the new job id. */
  protectAsset: (host: string, policyId: "POL-critical" | "POL-standard", poolId: string, schedule: TaskSchedule, owner: string) => string;
  /** Records a completed restore operation (drill or recovery) into the history store. */
  recordRestore: (args: { operation: string; host: string; jobName: string | null; pointId: string; requestedBy: string; durationMs: number }) => string;
  /** Records a completed Test Restore rehearsal: appends to DR history AND the drills log. Returns the drill id. */
  recordDrill: (args: { host: string; assetName: string | null; durationMin: number; rtoTargetMin: number; result: "Passed" | "Failed"; executedBy: string }) => string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** [startMs, endMs] window for the active range filter; null = unbounded. */
function rangeWindow(filters: BackupsFilters): { minMs: number; maxMs: number } {
  const now = Date.now();
  switch (filters.ranWithin) {
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
    const unsubscribeJobs = subscribeBackups(bump);
    const unsubscribeRuns = subscribeBackupRuns(bump);
    const unsubscribeDrills = subscribeDrills(bump);
    return () => {
      unsubscribeJobs();
      unsubscribeRuns();
      unsubscribeDrills();
    };
  }, []);
  return version;
}

/** Mock async fetch with 200-400ms delay; error reachable via ?backupsError=1 (first attempt fails, Retry succeeds). */
export function useBackups(filters: BackupsFilters): UseBackupsResult {
  const version = useStoreVersion();
  const [status, setStatus] = useState<BackupsStatus>("loading");
  const attemptRef = useRef(0);

  const load = useCallback(() => {
    setStatus("loading");
    const attempt = attemptRef.current;
    attemptRef.current += 1;
    const delay = 200 + Math.random() * 200;
    const timer = window.setTimeout(() => {
      const forcedError = typeof window !== "undefined" && window.location.search.includes("backupsError=1");
      if (forcedError && attempt === 0) {
        setStatus("error");
        return;
      }
      setStatus("success");
    }, delay);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => load(), [load]);

  const allJobs = useMemo(() => getBackupsSnapshot(), [version]);
  const runs = useMemo(() => getBackupRunsSnapshot(), [version]);
  const drills = useMemo(() => getDrillsSnapshot(), [version]);
  const latest = useMemo(() => latestBackupRunByJob(runs), [runs]);

  const jobs = useMemo(() => {
    const tokens = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
    const { minMs, maxMs } = rangeWindow(filters);

    return allJobs.filter((job) => {
      const lastRun = latest.get(job.id) ?? null;
      const lastStatus: BackupStatusKey = !job.enabled ? "paused" : lastRun?.status === "running" ? "running" : lastRun?.status ?? "success";
      if (filters.statuses.length > 0 && !filters.statuses.includes(lastStatus)) return false;
      if (filters.types.length > 0 && !filters.types.includes(job.type)) return false;
      if (filters.locations.length > 0 && !filters.locations.includes(job.poolId)) return false;
      if (filters.assetTypes.length > 0 && !filters.assetTypes.includes(job.assetType)) return false;
      const lastEpoch = lastRun?.epochMs ?? null;
      const next = job.enabled ? (nextRunAfter(job.schedule, Date.now()) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
      const inWindow = lastEpoch == null || (lastEpoch >= minMs && lastEpoch <= maxMs) || next <= maxMs;
      if (!inWindow) return false;
      if (filters.date) {
        if (lastEpoch == null) return false;
        const day = new Date(lastEpoch);
        const yyyy = day.getFullYear();
        const mm = String(day.getMonth() + 1).padStart(2, "0");
        const dd = String(day.getDate()).padStart(2, "0");
        if (`${yyyy}-${mm}-${dd}` !== filters.date) return false;
      }
      if (tokens.length > 0) {
        const haystack = `${job.id} ${job.name} ${job.host} ${job.owner} ${job.assetType} ${job.type} ${job.tags.join(" ")} ${job.group ?? ""} ${job.taskId ?? ""}`.toLowerCase();
        if (!tokens.every((token) => haystack.includes(token))) return false;
      }
      return true;
    });
  }, [allJobs, runs, latest, filters]);

  const auditEntry = useCallback((action: string, detail: string) => makeAuditEntry(CURRENT_ACTOR, action, detail), []);

  const runNow = useCallback((id: string) => {
    createRunningBackupRun(id, "manual");
    mutateBackups([id], () => ({}), () => [auditEntry("Run requested", "Manual backup triggered by operator.")]);
  }, [auditEntry]);

  const pauseMany = useCallback((ids: string[]) => {
    mutateBackups(
      ids,
      () => ({ enabled: false, pausedSince: new Date().toISOString() }),
      () => [auditEntry("Paused", `Backup paused by operator for ${ids.length} job(s).`)],
    );
  }, [auditEntry]);

  const resumeMany = useCallback((ids: string[]) => {
    mutateBackups(
      ids,
      () => ({ enabled: true, pausedSince: null }),
      () => [auditEntry("Enabled", `Backup resumed by operator for ${ids.length} job(s).`)],
    );
  }, [auditEntry]);

  const deleteJobs = useCallback((ids: string[]) => {
    deleteBackupsFromStore(ids);
    const idSet = new Set(ids);
    mutateBackupRuns((current) => current.filter((run) => !idSet.has(run.jobId)));
  }, []);

  const updatePolicy = useCallback((id: string, input: PolicyInput, saveAndEnable: boolean) => {
    mutateBackups(
      [id],
      () => ({
        name: input.name,
        type: input.type,
        schedule: { ...input.schedule, daysOfWeek: input.schedule.daysOfWeek ? [...input.schedule.daysOfWeek] : undefined },
        retentionDays: input.retentionDays,
        poolId: input.poolId,
        immutability: input.immutability,
        notifications: { onFailure: input.notificationsOnFailure, channels: [...input.notificationChannels] },
        ...(saveAndEnable ? { enabled: true, pausedSince: null } : {}),
      }),
      () => [auditEntry(
        saveAndEnable ? "Policy saved & enabled" : "Policy updated",
        `Policy saved (${input.type}, retention ${input.retentionDays}d, pool ${input.poolId}).`,
      )],
    );
  }, [auditEntry]);

  const createJob: UseBackupsResult["createJob"] = useCallback((input) => {
    const job = createBackupJob(input);
    appendBackupJob(job);
    return job.id;
  }, []);

  const protectAsset: UseBackupsResult["protectAsset"] = useCallback((host, policyId, poolId, schedule, owner) => {
    const job = protectAssetInStore(host, policyId, poolId, schedule, owner);
    mutateBackups([job.id], () => ({}), () => [auditEntry("Protect asset", `Default backup policy applied to ${host}.`)]);
    return job.id;
  }, [auditEntry]);

  const recordRestore: UseBackupsResult["recordRestore"] = useCallback((args) => {
    const id = nextRestoreId();
    const epochMs = Date.now();
    appendRestoreOperation({
      id,
      operation: args.operation,
      host: args.host,
      jobName: args.jobName,
      pointId: args.pointId,
      requestedBy: args.requestedBy,
      startedAt: new Date(epochMs).toISOString(),
      epochMs,
      status: "success",
      durationMs: args.durationMs,
      progress: null,
    });
    return id;
  }, []);

  const recordDrill: UseBackupsResult["recordDrill"] = useCallback((args) => {
    const id = nextDrillId();
    const nowMs = Date.now();
    appendDrill({
      id,
      name: `Recovery rehearsal - ${args.host}`,
      executedAt: new Date(nowMs).toISOString(),
      epochMs: nowMs,
      durationMin: args.durationMin,
      rtoTargetMin: args.rtoTargetMin,
      tier: "Standard",
      result: args.result,
      executedBy: args.executedBy,
    });
    recordRestore({
      operation: args.result === "Passed" ? "Recovery test (drill)" : "Recovery test (drill - RTO breached)",
      host: args.host,
      jobName: args.assetName,
      pointId: "-",
      requestedBy: args.executedBy,
      durationMs: args.durationMin * 60_000,
    });
    return id;
  }, [recordRestore]);

  return {
    jobs,
    allJobs,
    runs,
    unprotectedAssets: getUnprotectedSnapshot(),
    drills,
    status,
    reload: load,
    runNow,
    pauseMany,
    resumeMany,
    deleteJobs,
    updatePolicy,
    createJob,
    protectAsset,
    recordRestore,
    recordDrill,
  };
}
