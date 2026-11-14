"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check, ChevronDown, FileDown, HardDriveDownload, RotateCcw, ArchiveRestore, X,
} from "lucide-react";
import { nextRunAfter } from "@/utils/nextRun";

function nextRunForJob(job: { enabled: boolean; schedule: import("@/utils/formatSchedule").TaskSchedule }): number | null {
  return job.enabled ? nextRunAfter(job.schedule, Date.now()) : null;
}

import { PageHeader } from "@/components/layout/page-header";
import { CoverageBanner } from "@/components/backups/CoverageBanner";
import { BackupsKpiRow, type BackupKpiKey } from "@/components/backups/BackupsKpiRow";
import { BackupTrendCard } from "@/components/backups/BackupTrendCard";
import { StorageUsageCard } from "@/components/backups/StorageUsageCard";
import { RpoRtoComplianceCard, type TierCompliance } from "@/components/backups/RpoRtoComplianceCard";
import { DrillsCard } from "@/components/backups/DrillsCard";
import { RansomwareProtectionCard } from "@/components/backups/RansomwareProtectionCard";
import { FailureReasonsCard } from "@/components/backups/FailureReasonsCard";
import { UpcomingBackupsCard } from "@/components/backups/UpcomingBackupsCard";
import { ActivityTimelineCard } from "@/components/backups/ActivityTimelineCard";
import { BackupsFilters } from "@/components/backups/BackupsFilters";
import { BackupJobsTable } from "@/components/backups/BackupJobsTable";
import { RestorePointsTable } from "@/components/backups/RestorePointsTable";
import { BackupBulkBar } from "@/components/backups/BackupBulkBar";
import { BackupPolicyDrawer } from "@/components/backups/BackupPolicyDrawer";
import { TestRestoreWizard } from "@/components/backups/TestRestoreWizard";
import { CoverageTab, type ProtectAssetPayload } from "@/components/backups/CoverageTab";
import { PoliciesTab } from "@/components/backups/PoliciesTab";
import { buildBackupRows } from "@/components/backups/display-rows";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { timeAgo } from "@/mocks/logs";
import type { BackupJob, CreateBackupJobInput } from "@/mocks/backups";
import { listAssetViews } from "@/mocks/backups";
import { BACKUP_TYPE_LABELS } from "@/mocks/backups";
import { useBackups, DEFAULT_BACKUPS_FILTERS, type BackupsFilters as Filters } from "@/hooks/useBackups";
import { useRestoreOperations, useRestorePoints } from "@/hooks/useRestorePoints";
import { useStorage } from "@/hooks/useStorage";
import { deriveBackupStats, deriveBackupViews } from "@/utils/backupStats";
import type { BackupStatusKey } from "@/utils/backupStats";
import type { BackupType } from "@/mocks/backups";
import { cn } from "@/lib/utils";

const RANGE_MS: Record<"7D" | "30D", number> = {
  "7D": 7 * 24 * 60 * 60 * 1000,
  "30D": 30 * 24 * 60 * 60 * 1000,
};

function rangeWindowMs(filters: Filters): { minMs: number; maxMs: number } {
  const now = Date.now();
  if (filters.ranWithin === "Today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { minMs: start.getTime(), maxMs: now };
  }
  if (filters.ranWithin === "Custom") {
    const from = filters.customFrom ? new Date(`${filters.customFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const to = filters.customTo ? new Date(`${filters.customTo}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    return { minMs: from, maxMs: to };
  }
  return { minMs: now - RANGE_MS[filters.ranWithin], maxMs: now };
}

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadBlob(name: string, mime: string, body: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || target.isContentEditable;
}

export function BackupsDashboard() {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(DEFAULT_BACKUPS_FILTERS);
  const [density, setDensity] = useState<"default" | "compact">("default");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [policyJobId, setPolicyJobId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runDialogJobId, setRunDialogJobId] = useState<string>("");
  const [runDialogType, setRunDialogType] = useState<BackupType>("full");
  const [testRestoreOpen, setTestRestoreOpen] = useState(false);
  const [testRestoreHost, setTestRestoreHost] = useState<string | null>(null);
  const [testRestorePointId, setTestRestorePointId] = useState<string | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string; undo?: { ids: string[]; enabled: boolean } } | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => Date.now());

  const searchRef = useRef<HTMLInputElement | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const drillsRef = useRef<HTMLElement | null>(null);
  const didInitURL = useRef(false);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((message: string, undo?: { ids: string[]; enabled: boolean }) => {
    setToast({ id: Date.now(), message, undo });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);
  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);

  const {
    jobs, allJobs, runs, unprotectedAssets, drills, status, reload,
    runNow, pauseMany, resumeMany, deleteJobs, updatePolicy, createJob, protectAsset, recordRestore, recordDrill,
  } = useBackups(filters);
  const storage = useStorage();
  const points = useRestorePoints();
  const operations = useRestoreOperations();

  const patchFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }, []);
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_BACKUPS_FILTERS);
    setSelectedIds([]);
    setPage(1);
  }, []);

  // Read initial state from the URL once (?tab=&status=&q=&ran=&date=&assetTypes=&types=&locations=).
  useEffect(() => {
    if (didInitURL.current) return;
    didInitURL.current = true;
    const params = new URLSearchParams(window.location.search);
    const next: Partial<Filters> = {};
    const tab = params.get("tab");
    if (tab === "jobs" || tab === "points" || tab === "coverage" || tab === "policies") next.tab = tab;
    const statusParam = params.get("status");
    if (statusParam) {
      const list = statusParam.split(",") ?? [];
      if (list.length > 0) next.statuses = list as BackupStatusKey[];
    }
    const query = params.get("q");
    if (query) next.query = query;
    const ran = params.get("ran");
    if (ran === "Today" || ran === "7D" || ran === "30D" || ran === "Custom") next.ranWithin = ran;
    const date = params.get("date");
    if (date) next.date = date;
    const assetTypes = params.get("assetTypes");
    if (assetTypes) next.assetTypes = assetTypes.split(",").filter(Boolean);
    const types = params.get("types");
    if (types) next.types = types.split(",").filter(Boolean) as Filters["types"];
    const locations = params.get("locations");
    if (locations) next.locations = locations.split(",").filter(Boolean);
    if (Object.keys(next).length > 0) setFilters({ ...DEFAULT_BACKUPS_FILTERS, ...next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist filter state to the URL (shareable links).
  useEffect(() => {
    if (!didInitURL.current) return;
    const params = new URLSearchParams();
    if (filters.tab !== "jobs") params.set("tab", filters.tab);
    if (filters.statuses.length > 0) params.set("status", filters.statuses.join(","));
    if (filters.query.trim()) params.set("q", filters.query.trim());
    if (filters.ranWithin !== "30D") params.set("ran", filters.ranWithin);
    if (filters.date) params.set("date", filters.date);
    if (filters.assetTypes.length > 0) params.set("assetTypes", filters.assetTypes.join(","));
    if (filters.types.length > 0) params.set("types", filters.types.join(","));
    if (filters.locations.length > 0) params.set("locations", filters.locations.join(","));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }, [filters]);

  const jobsById = useMemo(() => new Map(allJobs.map((job) => [job.id, job])), [allJobs]);
  const views = useMemo(() => deriveBackupViews(allJobs, runs), [allJobs, runs]);
  const stats = useMemo(
    () => deriveBackupStats(allJobs, runs, unprotectedAssets.length, drills),
    [allJobs, runs, unprotectedAssets.length, drills],
  );
  const assetViews = useMemo(() => listAssetViews(allJobs), [allJobs]);

  // Tier compliance for the RPO/RTO card.
  const tiers = useMemo(() => {
    const build = (tier: "Critical" | "Standard", rpoTargetLabel: string, rtoTargetLabel: string, rtoTargetMinutes: number): TierCompliance => {
      const tierJobs = allJobs.filter((job) => job.tier === tier && job.enabled);
      let met = 0;
      let worst: { lagMinutes: number; targetMinutes: number } | null = null;
      for (const job of tierJobs) {
        const view = views.get(job.id);
        if (!view) continue;
        if (view.rpoMet) met += 1;
        if (view.rpoLagMinutes != null) {
          const targetMinutes = job.rpoTargetMinutes;
          const ratio = view.rpoLagMinutes / targetMinutes;
          const worstRatio = worst == null ? 0 : worst.lagMinutes / worst.targetMinutes;
          if (worst == null || ratio > worstRatio) worst = { lagMinutes: view.rpoLagMinutes, targetMinutes };
        }
      }
      const tierDrills = drills.filter((drill) => drill.tier === tier).sort((a, b) => b.epochMs - a.epochMs);
      const latestTierDrill = tierDrills[0] ?? null;
      return {
        label: tier,
        total: tierJobs.length,
        met,
        worstLagMinutes: worst?.lagMinutes ?? null,
        worstLagTargetMinutes: worst?.targetMinutes ?? 1,
        rpoTargetLabel,
        rtoTargetLabel,
        rtoTargetMinutes,
        rtoActualMinutes: latestTierDrill?.durationMin ?? null,
        rtoActualTargetMinutes: latestTierDrill?.rtoTargetMin ?? rtoTargetMinutes,
      };
    };
    return { critical: build("Critical", "4h", "1h", 60), standard: build("Standard", "24h", "2h", 120) };
  }, [allJobs, views, drills]);

  const lastRestoreTest = useMemo(() => {
    if (drills.length === 0) return null;
    const latest = drills.reduce((acc, drill) => (drill.epochMs > acc.epochMs ? drill : acc));
    return { result: latest.result, daysAgo: Math.floor((Date.now() - latest.epochMs) / (24 * 60 * 60 * 1000)) };
  }, [drills]);

  // Pseudo-rows: unprotected assets with their own "none" status.
  const rows = useMemo(() => {
    const visibleUnprotected = unprotectedAssets.filter((asset) => {
      if (filters.statuses.length > 0 && !filters.statuses.includes("none")) return false;
      if (filters.types.length > 0 || filters.locations.length > 0) return false;
      if (filters.assetTypes.length > 0 && !filters.assetTypes.includes(asset.assetType)) return false;
      if (filters.query.trim()) {
        const haystack = `${asset.host} ${asset.assetType} ${asset.owner}`.toLowerCase();
        if (!filters.query.toLowerCase().trim().split(/\s+/).every((token) => haystack.includes(token))) return false;
      }
      return true;
    });
    return buildBackupRows(jobs, visibleUnprotected, views);
  }, [unprotectedAssets, jobs, filters.statuses, filters.types, filters.locations, filters.assetTypes, filters.query, views]);

  const filteredPoints = useMemo(() => {
    const { minMs, maxMs } = rangeWindowMs(filters);
    const tokens = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
    return points.filter((point) => {
      if (point.epochMs < minMs || point.epochMs > maxMs) return false;
      if (filters.assetTypes.length > 0 && !filters.assetTypes.includes(point.assetType)) return false;
      if (filters.types.length > 0 && !filters.types.includes(point.type)) return false;
      if (filters.locations.length > 0 && !filters.locations.includes(point.poolId)) return false;
      if (filters.date && new Date(point.epochMs).toISOString().slice(0, 10) !== filters.date) return false;
      if (tokens.length > 0) {
        const haystack = `${point.id} ${point.jobName} ${point.host} ${point.assetType}`.toLowerCase();
        if (!tokens.every((token) => haystack.includes(token))) return false;
      }
      return true;
    });
  }, [points, filters]);

  // Selection housekeeping when rows disappear.
  useEffect(() => {
    const jobIds = new Set(rows.filter((row) => row.job).map((row) => row.job!.id));
    setSelectedIds((current) => {
      const next = current.filter((id) => jobIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [rows]);

  const selectedJobs = useMemo(() => allJobs.filter((job) => selectedIds.includes(job.id)), [allJobs, selectedIds]);

  const openTestRestore = useCallback((host: string | null, pointId: string | null) => {
    setTestRestoreHost(host);
    setTestRestorePointId(pointId);
    setTestRestoreOpen(true);
  }, []);

  const handleRunNow = useCallback((jobId: string) => {
    const job = allJobs.find((entry) => entry.id === jobId);
    runNow(jobId);
    showToast(`Manual backup started for "${job?.name ?? jobId}"`);
  }, [allJobs, runNow, showToast]);

  const bulkRunNow = useCallback(() => {
    for (const job of selectedJobs) if (job.enabled) runNow(job.id);
    showToast(`Manual backups started for ${selectedJobs.length} job(s)`);
    setSelectedIds([]);
  }, [selectedJobs, runNow, showToast]);
  const bulkPause = useCallback(() => {
    const ids = selectedJobs.map((job) => job.id);
    pauseMany(ids);
    setSelectedIds([]);
    showToast(`Paused ${ids.length} job(s)`, { ids, enabled: true });
  }, [selectedJobs, pauseMany, showToast]);
  const bulkRunFailed = useCallback(() => {
    for (const jobId of stats.failedJobIds) {
      const job = allJobs.find((entry) => entry.id === jobId);
      if (job?.enabled) runNow(jobId);
    }
    showToast(`Retries started for ${stats.failedJobIds.length} failed job(s)`);
  }, [allJobs, stats.failedJobIds, runNow, showToast]);
  const confirmDelete = useCallback(() => {
    if (!deleteIds) return;
    deleteJobs(deleteIds);
    setSelectedIds((current) => current.filter((id) => !deleteIds.includes(id)));
    setDeleteIds(null);
    showToast(`Deleted ${deleteIds.length} backup job(s)`);
  }, [deleteIds, deleteJobs, showToast]);

  const handlePauseResume = useCallback((jobId: string, enabled: boolean) => {
    if (enabled) {
      resumeMany([jobId]);
      showToast("Backup resumed", { ids: [jobId], enabled: false });
    } else {
      pauseMany([jobId]);
      showToast("Backup paused", { ids: [jobId], enabled: true });
    }
  }, [pauseMany, resumeMany, showToast]);

  const handleProtectAsset = useCallback((host: string, payload: ProtectAssetPayload) => {
    protectAsset(host, payload.policyId, payload.poolId, payload.schedule, "you@nexus.io");
    showToast(`Backup enabled for ${host} (${payload.policyId === "POL-critical" ? "POL-critical" : "POL-standard"})`);
  }, [protectAsset, showToast]);

  const handleCreateJob = useCallback((input: CreateBackupJobInput, enable: boolean) => {
    const id = createJob(input);
    setCreateOpen(false);
    showToast(enable ? `Backup job ${id} created and enabled` : `Backup job ${id} created (paused)`);
  }, [createJob, showToast]);

  const handleDrillComplete = useCallback((result: { host: string; assetName: string | null; durationMin: number; rtoTargetMin: number; result: "Passed" | "Failed" }) => {
    recordDrill({ ...result, executedBy: "you@nexus.io" });
    showToast(result.result === "Passed" ? `Recovery test passed (${result.durationMin}m vs ${result.rtoTargetMin}m RTO)` : `Recovery test failed (${result.durationMin}m vs ${result.rtoTargetMin}m RTO)`);
  }, [recordDrill, showToast]);

  const exportData = useCallback((format: "csv" | "json") => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") {
      downloadBlob(`backups-${stamp}.json`, "application/json", JSON.stringify(jobs, null, 2));
      return;
    }
    const header = ["id", "name", "host", "owner", "type", "schedule", "retentionDays", "poolId", "enabled"];
    const lines = jobs.map((job) => [
      job.id, job.name, job.host, job.owner, job.type,
      `${job.schedule.kind}@${job.schedule.hour}:${String(job.schedule.minute).padStart(2, "0")}`,
      job.retentionDays, job.poolId, job.enabled ? "yes" : "no",
    ].map(csvCell).join(","));
    downloadBlob(`backups-${stamp}.csv`, "text/csv", [header.join(","), ...lines].join("\n"));
  }, [jobs]);

  // Chart exports (small, self-contained CSVs).
  const csvOf = useCallback((name: string, header: string[], rows: Array<Array<string | number>>) => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(`backups-${name}-${stamp}.csv`, "text/csv", [header.join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n"));
  }, []);
  const exportTrend = useCallback(() => {
    const buckets = Array.from({ length: 30 }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (29 - index));
      return day.toISOString().slice(0, 10);
    });
    csvOf("trend", ["date", "success", "failed", "skipped", "writtenBytes"], buckets.map((day) => {
      const dayRuns = runs.filter((run) => new Date(run.epochMs).toISOString().slice(0, 10) === day);
      const success = dayRuns.filter((run) => run.status === "success").length;
      const failed = dayRuns.filter((run) => run.status === "failed").length;
      const skipped = dayRuns.filter((run) => run.status === "skipped").length;
      const bytes = dayRuns.reduce((sum, run) => sum + run.sizeBytes, 0);
      return [day, success, failed, skipped, bytes];
    }));
  }, [csvOf, runs]);
  const exportPools = useCallback(() => {
    csvOf("pools", ["pool", "tier", "capacityTB", "usedTB", "utilizationPct", "growthGBPerWeek", "immutable"], storage.locations.map((pool) => [pool.name, pool.tier, pool.capacityTB, pool.usedTB, pool.pctUsed, pool.growthGBPerWeek, pool.immutable ? "yes" : "no"]));
  }, [csvOf, storage.locations]);
  const exportCompliance = useCallback(() => {
    csvOf("rpo-rto", ["tier", "jobs", "withinRPO", "rpoWorstMinutes", "rpoWorstTargetMinutes", "rtoTargetMinutes", "rtoActualMinutes"], [
      ["Critical", tiers.critical.total, tiers.critical.met, tiers.critical.worstLagMinutes ?? "", tiers.critical.worstLagTargetMinutes, tiers.critical.rtoTargetMinutes, tiers.critical.rtoActualMinutes ?? ""],
      ["Standard", tiers.standard.total, tiers.standard.met, tiers.standard.worstLagMinutes ?? "", tiers.standard.worstLagTargetMinutes, tiers.standard.rtoTargetMinutes, tiers.standard.rtoActualMinutes ?? ""],
    ]);
  }, [csvOf, tiers]);
  const exportDrills = useCallback(() => {
    csvOf("drills", ["id", "name", "executedAt", "durationMin", "rtoTargetMin", "result", "executedBy"], drills.map((drill) => [drill.id, drill.name, drill.executedAt, drill.durationMin, drill.rtoTargetMin, drill.result, drill.executedBy]));
  }, [csvOf, drills]);
  const exportFailures = useCallback(() => {
    csvOf("failures-7d", ["jobId", "name", "host", "startedAt", "error"], runs.filter((run) => run.status === "failed" && run.epochMs >= Date.now() - 7 * 86400000).map((run) => [run.jobId, allJobs.find((job) => job.id === run.jobId)?.name ?? run.jobId, allJobs.find((job) => job.id === run.jobId)?.host ?? "", new Date(run.epochMs).toISOString(), run.error ?? ""]));
  }, [csvOf, runs, allJobs]);
  const exportUpcoming = useCallback(() => {
    const nowMs = Date.now();
    const horizon = nowMs + 24 * 60 * 60 * 1000;
    csvOf("upcoming-24h", ["jobId", "name", "host", "scheduledAt"], allJobs.filter((job) => job.enabled).map((job) => {
      const next = job.enabled ? nextRunForJob(job) : null;
      return next != null && next <= horizon ? [job.id, job.name, job.host, new Date(next).toISOString()] : null;
    }).filter((row): row is [string, string, string, string] => row != null));
  }, [csvOf, allJobs]);
  const exportPosture = useCallback(() => {
    csvOf("ransomware-posture", ["control", "state", "detail"], [["3 copies", "warn", "1 tier holds 3 copies"], ["2 media", "met", "NAS + S3 + vault"], ["offsite", "met", ">=1 job to Offsite Vault"], ["immutable", "warn", "22 jobs, 10 immutable"], ["encryption", "met", "AES-256 managed"], ["mfa-delete", "warn", "not enforced"], ["anomaly", "warn", "not configured"]]);
  }, [csvOf]);
  const exportActivity = useCallback(() => {
    csvOf("activity", ["epochMs", "type", "detail"], operations.slice(0, 20).map((op) => [op.epochMs, op.status, `${op.operation} - ${op.host} ${op.pointId}`]));
  }, [csvOf, operations]);

  const handleKpiClick = useCallback((key: BackupKpiKey) => {
    switch (key) {
      case "success-rate": patchFilters({ tab: "jobs", statuses: ["success"], date: "" }); break;
      case "protected": patchFilters({ tab: "coverage", date: "" }); break;
      case "failed": patchFilters({ tab: "jobs", statuses: ["failed"], date: "" }); break;
      case "size-30d": patchFilters({ tab: "jobs", statuses: [], date: "", ranWithin: "30D" }); break;
      case "rpo": patchFilters({ tab: "policies", date: "" }); break;
      case "last-restore-test": drillsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); break;
    }
  }, [patchFilters]);

  // Keyboard: J/K move row focus, R runs focused job, Esc closes overlays (handled by them).
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (isTypingTarget(event.target)) return;
    if (policyJobId || createOpen || runDialogOpen || testRestoreOpen || deleteIds != null) return;
    const keys = rows.map((row) => row.key);
    if (keys.length === 0) return;
    const currentIndex = focusedKey ? keys.indexOf(focusedKey) : -1;
    if (event.key === "j" || event.key === "J") {
      event.preventDefault();
      setFocusedKey(keys[Math.min(keys.length - 1, currentIndex + 1)] ?? keys[0]);
    } else if (event.key === "k" || event.key === "K") {
      event.preventDefault();
      setFocusedKey(keys[Math.max(0, currentIndex - 1)] ?? keys[0]);
    } else if (event.key === "r" || event.key === "R") {
      const row = rows[currentIndex];
      if (row?.job) {
        event.preventDefault();
        handleRunNow(row.job.id);
      }
    } else if (event.key === "Enter") {
      const row = rows[currentIndex];
      if (row?.job) {
        event.preventDefault();
        router.push(`/backups-and-recovery/jobs/${encodeURIComponent(row.job.id)}`);
      }
    }
  }, [rows, focusedKey, policyJobId, createOpen, runDialogOpen, testRestoreOpen, deleteIds, handleRunNow, router]);

  useEffect(() => {
    if (!focusedKey) return;
    document.getElementById(`backup-row-${focusedKey}`)?.scrollIntoView({ block: "nearest" });
  }, [focusedKey]);

  useEffect(() => {
    if (filters.tab !== "jobs") setFocusedKey(null);
  }, [filters.tab]);

  const exportItems = [
    { key: "csv", label: "Export CSV", onSelect: () => exportData("csv") },
    { key: "json", label: "Export JSON", onSelect: () => exportData("json") },
  ];
  const runBackupItems = [
    { key: "all-failed", label: `Run all failed (${stats.failedJobIds.length})`, onSelect: bulkRunFailed },
    { key: "selected", label: `Run selected (${selectedIds.length})`, ...(selectedIds.length === 0 ? { disabled: true } : {}), onSelect: () => { void bulkRunNow(); } },
    { key: "d1", label: "", divider: true },
    { key: "choose", label: "Choose job...", onSelect: () => { setRunDialogJobId(allJobs.find((job) => stats.failedJobIds.includes(job.id))?.id ?? allJobs[0]?.id ?? ""); setRunDialogType("full"); setRunDialogOpen(true); } },
  ];

  const policyJob = policyJobId ? jobsById.get(policyJobId) ?? null : null;
  const isLoading = status === "loading";
  const isError = status === "error";

  return (
    <div className="min-w-0 overflow-x-hidden space-y-4 pb-4" onKeyDown={handleKeyDown}>
      <PageHeader
        breadcrumbs={["Operations", "Backups & Recovery"]}
        title="Backups & Recovery"
        subtitle="Monitor backup operations, protect critical infrastructure data, and manage recovery readiness across your environment."
        lastUpdated={timeAgo(lastRefreshedAt)}
        onRefresh={() => { reload(); setLastRefreshedAt(Date.now()); }}
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline"  onClick={() => openTestRestore(null, null)}>
              <ArchiveRestore size={15} aria-hidden="true" />Test Restore
            </Button>
            <AlertMenu
              label="Export backups"
              align="end"
              width={160}
              trigger={
                <Button variant="outline" >
                  <FileDown size={15} aria-hidden="true" />Export<ChevronDown size={13} aria-hidden="true" className="text-muted-foreground" />
                </Button>
              }
              items={exportItems}
            />
            <AlertMenu
              label="Run backup"
              align="end"
              width={220}
              trigger={
                <Button className="bg-primary text-primary-foreground shadow transition-colors hover:bg-primary/90">
                  <ArchiveRestore size={15} aria-hidden="true" />Run Backup<ChevronDown size={13} aria-hidden="true" className="text-primary-foreground/80" />
                </Button>
              }
              items={runBackupItems}
            />
          </div>
        }
      />

      {isError && (
        <section role="alert" className="grid min-h-[20rem] place-items-center rounded-xl border border-border bg-card p-6 text-center">
          <div className="flex max-w-md flex-col items-center gap-2">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10"><HardDriveDownload size={20} aria-hidden="true" /></span>
            <h2 className="font-display text-base font-bold text-foreground">Couldn&rsquo;t load backups</h2>
            <p className="text-sm text-muted-foreground">The backup store did not respond. Check the pipeline and try again.</p>
            <Button variant="outline"  onClick={reload}>
              <RotateCcw size={15} aria-hidden="true" />Retry
            </Button>
          </div>
        </section>
      )}

      {isLoading && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[5.5rem] animate-pulse rounded-xl bg-muted" />)}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="h-[17.5rem] animate-pulse rounded-xl bg-muted xl:col-span-8" />
            <div className="h-[17.5rem] animate-pulse rounded-xl bg-muted xl:col-span-4" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-[17.5rem] animate-pulse rounded-xl bg-muted" />)}
          </div>
          <div className="h-[32.5rem] animate-pulse rounded-xl bg-muted" />
        </>
      )}

      {!isLoading && !isError && (
        <>
          <CoverageBanner
            unprotectedCount={stats.unprotectedCount}
            rpoBreachCount={stats.rpoBreachCount}
            onView={() => {
              patchFilters({ tab: "coverage" });
              tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />

          <BackupsKpiRow stats={stats} lastRestoreTest={lastRestoreTest} onKpiClick={handleKpiClick} />

          {/* Row 1 - trend + storage */}
          <section aria-label="Backup trend and storage" className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
            <div className="h-full min-w-0 xl:col-span-8"><BackupTrendCard runs={runs} onBarClick={(date) => patchFilters({ tab: "jobs", date })} onExport={exportTrend} /></div>
            <div className="h-full min-w-0 xl:col-span-4"><StorageUsageCard locations={storage.locations} totals={storage.totals} onExport={exportPools} /></div>
          </section>

          {/* Row 2 - RPO/RTO + drills + ransomware */}
          <section ref={drillsRef} aria-label="Recovery readiness, drills and ransomware posture" className="grid grid-cols-1 items-stretch scroll-mt-4 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <RpoRtoComplianceCard critical={tiers.critical} standard={tiers.standard} jobs={allJobs} views={views} runs={runs} onRunJob={handleRunNow} onExport={exportCompliance} />
            <DrillsCard drills={drills} onScheduleDrill={() => openTestRestore(null, null)} onExport={exportDrills} />
            <RansomwareProtectionCard jobs={allJobs} onExport={exportPosture} />
          </section>

          {/* Row 3 - failure reasons + upcoming backups */}
          <section aria-label="Failure reasons and upcoming backups" className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
            <FailureReasonsCard runs={runs} onViewFailed={() => patchFilters({ tab: "jobs", statuses: ["failed"] })} onExport={exportFailures} />
            <UpcomingBackupsCard jobs={allJobs} onExport={exportUpcoming} />
          </section>

          <BackupsFilters
            filters={filters}
            onPatch={patchFilters}
            onReset={resetFilters}
            jobsTabCount={allJobs.length + unprotectedAssets.length}
            pointsTabCount={filteredPoints.length}
            coverageTabCount={assetViews.length}
            policiesTabCount={2}
            statusCounts={stats.statusCounts}
            totalLabel={`${filters.tab === "jobs" ? rows.length : filters.tab === "points" ? filteredPoints.length : filters.tab === "coverage" ? assetViews.length : 2} ${filters.tab === "jobs" ? "backups" : filters.tab === "points" ? "points" : filters.tab === "coverage" ? "assets" : "policies"}`}
            density={density}
            onToggleDensity={() => setDensity((current) => (current === "default" ? "compact" : "default"))}
            searchRef={searchRef}
          />

          {filters.tab === "jobs" && (
            <div ref={tableRef} className="scroll-mt-4">
              <BackupBulkBar
                count={selectedIds.length}
                onRunNow={bulkRunNow}
                onPause={bulkPause}
                onDelete={() => setDeleteIds([...selectedIds])}
                onClear={() => setSelectedIds([])}
              />
              <BackupJobsTable
                rows={rows}
                density={density}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                onRunNow={handleRunNow}
                onRestore={(jobId) => {
                  const job = jobsById.get(jobId);
                  openTestRestore(job?.host ?? null, null);
                }}
                onViewPoints={(jobId) => {
                  const job = jobsById.get(jobId);
                  setFilters((current) => ({ ...current, tab: "points", query: job?.host ?? "" }));
                  setPage(1);
                }}
                onEditPolicy={(jobId) => setPolicyJobId(jobId)}
                onToggleJob={handlePauseResume}
                onDeleteJob={(jobId) => setDeleteIds([jobId])}
                onEnableBackup={(host) => {
                  // Quick enable via the Coverage flow — jump to the tab with the asset highlighted by name.
                  setFilters((current) => ({ ...current, tab: "coverage", query: host }));
                  setPage(1);
                }}
                onClearFilters={resetFilters}
                focusedKey={focusedKey}
              />
            </div>
          )}
          {filters.tab === "points" && (
            <RestorePointsTable points={filteredPoints} density={density} onRestore={(pointId) => openTestRestore(null, pointId)} />
          )}
          {filters.tab === "coverage" && (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <CoverageTab assetViews={assetViews} onProtect={handleProtectAsset} />
            </div>
          )}
          {filters.tab === "policies" && (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <PoliciesTab jobs={allJobs} views={views} onEdit={(jobId) => { if (jobId) setPolicyJobId(jobId); }} />
            </div>
          )}
        </>
      )}

      {/* Run Backup dialog - choose job + type, confirm */}
      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Backup</DialogTitle>
            <DialogDescription>Start a manual backup for a specific job. The run is queued immediately and logged with your identity.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="block text-xs font-medium text-muted-foreground" htmlFor="run-job">
              Job
              <Select value={runDialogJobId} onValueChange={setRunDialogJobId}>
                <SelectTrigger id="run-job" className="mt-1 h-9 w-full text-[0.8125rem]" aria-label="Job"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allJobs.map((job) => <SelectItem key={job.id} value={job.id}>{job.name} · {job.host}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="block text-xs font-medium text-muted-foreground" htmlFor="run-type">
              Type
              <Select value={runDialogType} onValueChange={(value) => setRunDialogType(value as BackupType)}>
                <SelectTrigger id="run-type" className="mt-1 h-9 w-full text-[0.8125rem]" aria-label="Backup type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["full", "incremental", "differential", "snapshot"] as BackupType[]).map((value) => <SelectItem key={value} value={value}>{BACKUP_TYPE_LABELS[value]} backup</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline"  onClick={() => setRunDialogOpen(false)}>Cancel</Button>
            <Button  onClick={() => {
              if (runDialogJobId) {
                handleRunNow(runDialogJobId);
                setRunDialogOpen(false);
              }
            }}>
              Start backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Restore wizard */}
      <TestRestoreWizard
        open={testRestoreOpen}
        onOpenChange={setTestRestoreOpen}
        defaultHost={testRestoreHost}
        initialPointId={testRestorePointId}
        points={points}
        jobsById={jobsById}
        onComplete={handleDrillComplete}
      />

      {/* Policy editor (edit mode, opened from kebab/policies) */}
      <BackupPolicyDrawer
        job={policyJob}
        onClose={() => setPolicyJobId(null)}
        onSave={(jobId, input, saveAndEnable) => {
          updatePolicy(jobId, input, saveAndEnable);
          setPolicyJobId(null);
          showToast(saveAndEnable ? "Policy saved and backup enabled" : "Policy saved");
        }}
      />

      {/* Create Backup (create mode) */}
      {createOpen && (
        <BackupPolicyDrawer
          job={null}
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSave={() => { /* create mode uses onCreate */ }}
          onCreate={handleCreateJob}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={deleteIds != null} onOpenChange={(open) => { if (!open) setDeleteIds(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteIds?.length} backup job{(deleteIds?.length ?? 0) === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>
              The jobs and their run history will be removed. Existing restore points remain sealed until their retention expires. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline"  onClick={() => setDeleteIds(null)}>Keep jobs</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          key={toast.id}
          className="fixed bottom-4 left-1/2 z-[1500] flex w-[min(32.5rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-popover px-4 py-2.5 text-sm text-popover-foreground shadow-lg"
        >
          <Check size={15} aria-hidden="true" className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="min-w-0 flex-1">{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                const undo = toast.undo!;
                if (undo.enabled) resumeMany(undo.ids);
                else pauseMany(undo.ids);
                setToast(null);
                showToast("Restored.");
              }}
              className="shrink-0 rounded font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Undo
            </button>
          )}
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
