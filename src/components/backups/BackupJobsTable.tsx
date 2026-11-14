"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, FilterX, Link2, MoreVertical } from "lucide-react";

import { AlertMenu } from "@/components/alerts/alert-menu";
import { ToggleSwitch } from "@/components/alert-rules/toggle-switch";
import { Pagination } from "@/components/shared/pagination";
import { AssetTypeBadge, BackupStatusBadge, BackupTypeBadge, SkippedMaintenanceBadge } from "@/components/backups/backup-badges";
import { LocationCell } from "@/components/backups/location-meta";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/mocks/logs";
import type { BackupDisplayRow } from "@/components/backups/display-rows";
import { formatSchedule } from "@/utils/formatSchedule";
import { formatCountdown, formatDuration } from "@/utils/backupStats";
import { formatLag, formatRpoCell } from "@/utils/rpoCalc";
import { formatBytes } from "@/utils/storageForecast";
import { firstCoveringMaintenanceWindow } from "@/mocks/backupRuns";
import { cn } from "@/lib/utils";

type SortKey = "asset" | "last" | "next" | "rpo";

interface BackupJobsTableProps {
  rows: BackupDisplayRow[];
  density: "default" | "compact";
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRunNow: (jobId: string) => void;
  onRestore: (jobId: string) => void;
  onViewPoints: (jobId: string) => void;
  onEditPolicy: (jobId: string) => void;
  onToggleJob: (jobId: string, enabled: boolean) => void;
  onDeleteJob: (jobId: string) => void;
  onEnableBackup: (host: string) => void;
  onClearFilters: () => void;
  /** Row key focused via J/K keyboard navigation (dashboard-owned). */
  focusedKey?: string | null;
}

const EXACT_TIME = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

export function BackupJobsTable({
  rows,
  density,
  selectedIds,
  onSelectionChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onRunNow,
  onRestore,
  onViewPoints,
  onEditPolicy,
  onToggleJob,
  onDeleteJob,
  onEnableBackup,
  onClearFilters,
  focusedKey = null,
}: BackupJobsTableProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("last");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortBy = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "asset" ? "asc" : "desc");
  };

  const sorted = useMemo(() => {
    const valueOf = (row: BackupDisplayRow): string | number => {
      switch (sortKey) {
        case "asset": return (row.job?.name ?? row.unprotected?.host ?? "").toLowerCase();
        case "last": return row.lastRun?.epochMs ?? 0;
        case "next": return row.nextRunMs ?? Number.POSITIVE_INFINITY;
        case "rpo": return row.rpoLagMinutes ?? Number.POSITIVE_INFINITY;
      }
    };
    const sign = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = valueOf(a);
      const right = valueOf(b);
      if (typeof left === "number" && typeof right === "number") return (left - right) * sign;
      return String(left).localeCompare(String(right)) * sign;
    });
  }, [rows, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageStart = (clampedPage - 1) * pageSize;
  const pageItems = sorted.slice(pageStart, pageStart + pageSize);

  const jobPageIds = pageItems.filter((row) => !row.isUnprotected).map((row) => row.job!.id);
  const allVisibleSelected = jobPageIds.length > 0 && jobPageIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected = jobPageIds.some((id) => selectedIds.includes(id));

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      onSelectionChange(selectedIds.filter((id) => !jobPageIds.includes(id)));
      return;
    }
    onSelectionChange([...new Set([...selectedIds, ...jobPageIds])]);
  };
  const toggleOne = (id: string) => {
    onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  };

  const rowHeight = density === "compact" ? "h-12" : "h-14";

  const sortHeader = (key: SortKey, label: string) => {
    const active = sortKey === key;
    return (
      <button
        type="button"
        onClick={() => sortBy(key)}
        aria-label={`Sort by ${label}${active ? (sortDir === "asc" ? ", currently ascending" : ", currently descending") : ""}`}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active && "text-foreground",
        )}
      >
        {label}
        {active && (sortDir === "asc" ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" />)}
      </button>
    );
  };

  const selectAllRef = (el: HTMLInputElement | null) => {
    if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
  };

  const openJob = (jobId: string) => router.push(`/backups-and-recovery/jobs/${encodeURIComponent(jobId)}`);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: "2.5rem" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-card">
              <th scope="col" className="px-3 py-2">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="Select all backups on this page"
                  className="h-4 w-4 cursor-pointer rounded border-input accent-[oklch(0.5855_0.1885_255.72)]"
                />
              </th>
              <th scope="col" aria-sort={sortKey === "asset" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2">{sortHeader("asset", "Job")}</th>
              <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type &amp; Schedule</th>
              <th scope="col" aria-sort={sortKey === "last" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2">{sortHeader("last", "Last Run")}</th>
              <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
              <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Duration</th>
              <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Size</th>
              <th scope="col" aria-sort={sortKey === "next" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2">{sortHeader("next", "Next Run")}</th>
              <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destination</th>
              <th scope="col" aria-sort={sortKey === "rpo" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2">{sortHeader("rpo", "RPO")}</th>
              <th scope="col" className="px-2 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((row) => {
              const job = row.job;
              const name = job?.name ?? row.unprotected!.host;
              const failed = row.status === "failed";
              const running = row.status === "running";
              const skipped = row.status === "skipped";
              const selected = job ? selectedIds.includes(job.id) : false;
              const progress = row.runningRun?.progress ?? 0;
              const nextRunMs = row.nextRunMs;
              const coveringWindow = job && nextRunMs != null ? firstCoveringMaintenanceWindow([job.host], nextRunMs, 90 * 60 * 1000) : null;
              return (
                <tr
                  key={row.key}
                  id={`backup-row-${row.key}`}
                  onClick={job ? () => openJob(job.id) : undefined}
                  onKeyDown={job ? (event) => { if (event.key === "Enter") { event.preventDefault(); openJob(job.id); } } : undefined}
                  tabIndex={job ? 0 : undefined}
                  aria-label={job ? `Open backup ${job.name}` : undefined}
                  className={cn(
                    "group border-b border-border/60 align-middle transition-colors hover:bg-slate-50 dark:hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                    rowHeight,
                    job && "cursor-pointer",
                    failed && "bg-red-50/40 dark:bg-red-500/5",
                    selected && "bg-primary/[0.06] dark:bg-primary/10",
                    focusedKey === row.key && "ring-2 ring-inset ring-primary",
                  )}
                >
                  {/* Select + status stripe */}
                  <td className="relative px-3 py-1.5 align-middle" onClick={(event) => event.stopPropagation()}>
                    {failed && <span aria-hidden="true" className="absolute left-0 top-1/2 h-[calc(100%-0.875rem)] w-[0.1875rem] -translate-y-1/2 rounded-full bg-red-600" />}
                    {running && <span aria-hidden="true" className="absolute left-0 top-1/2 h-[calc(100%-0.875rem)] w-[0.1875rem] -translate-y-1/2 rounded-full bg-blue-500" />}
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={!job}
                      onChange={() => job && toggleOne(job.id)}
                      aria-label={job ? `Select ${name}` : `${name} is not backed up`}
                      className="h-4 w-4 cursor-pointer rounded border-input accent-[oklch(0.5855_0.1885_255.72)] disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </td>
                  {/* Job */}
                  <td className="min-w-0 px-3 py-1.5 align-middle">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-muted-foreground">{job?.id ?? "—"}</span>
                      {job?.taskId && <span title={`Linked Scheduled Task ${job.taskId}`}><Link2 size={11} aria-hidden="true" className="text-muted-foreground" /></span>}
                      {job && <AssetTypeBadge label={job.assetType} className="ml-auto" />}
                    </div>
                    <span className={cn("mt-0.5 block truncate text-[0.8125rem] font-semibold text-foreground", job && "group-hover:text-primary")} title={name}>{name}</span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">{job ? `${job.host}${job.group ? ` · ${job.group}` : ""}` : `${row.unprotected!.host} · unprotected`}</span>
                    {running && (
                      <span className="mt-1 flex max-w-[11.25rem] items-center gap-1.5" aria-label={`Backup running, ${progress}% complete`}>
                        <span className="h-[0.1875rem] flex-1 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-blue-500 transition-[width] duration-500" style={{ width: `${progress}%` }} />
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-blue-500 dark:text-blue-400">Running {progress}%</span>
                      </span>
                    )}
                  </td>
                  {/* Type & schedule */}
                  <td className="min-w-0 px-3 py-1.5 align-middle">
                    {job ? (
                      <>
                        <BackupTypeBadge type={job.type} />
                        <p className="mt-1 truncate text-xs font-medium text-foreground" title={formatSchedule(job.schedule)}>{formatSchedule(job.schedule)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Keep {job.retentionDays} days</p>
                      </>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  {/* Last run */}
                  <td className="min-w-0 px-3 py-1.5 align-middle">
                    {job ? (
                      row.lastRun || row.runningRun ? (
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {row.runningRun ? `started ${timeAgo(row.runningRun.epochMs)}` : row.lastRun ? timeAgo(row.lastRun.epochMs) : ""}
                        </p>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never ran</span>
                      )
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  {/* Status */}
                  <td className="px-3 py-1.5 align-middle">
                    {!job ? <BackupStatusBadge status="none" /> : skipped ? <SkippedMaintenanceBadge /> : <BackupStatusBadge status={row.status} />}
                  </td>
                  {/* Duration */}
                  <td className="px-3 py-1.5 align-middle text-xs tabular-nums text-muted-foreground">
                    {row.lastRun ? (row.lastRun.status === "running" ? "—" : formatDuration(row.lastRun.durationMs)) : "—"}
                  </td>
                  {/* Size */}
                  <td className="px-3 py-1.5 align-middle text-xs tabular-nums text-muted-foreground">
                    {row.lastRun ? (row.lastRun.sizeBytes > 0 ? formatBytes(row.lastRun.sizeBytes) : "—") : "—"}
                  </td>
                  {/* Next run */}
                  <td className="min-w-0 px-3 py-1.5 align-middle">
                    {job ? (
                      !job.enabled ? (
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Paused</p>
                      ) : nextRunMs ? (
                        coveringWindow ? (
                          <a
                            href={`/maintenance-windows/${encodeURIComponent(coveringWindow.id)}`}
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-amber-600 hover:underline dark:text-amber-400"
                            title={`Runs during maintenance window ${coveringWindow.id}`}
                          >
                            <AlertTriangle size={11} aria-hidden="true" className="shrink-0" />
                            Skipped (maintenance)
                          </a>
                        ) : (
                          <>
                            <p className="text-xs font-medium tabular-nums text-foreground">{formatCountdown(nextRunMs)}</p>
                            <p className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">{EXACT_TIME.format(nextRunMs)}</p>
                          </>
                        )
                      ) : <p className="text-xs text-muted-foreground">—</p>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  {/* Destination */}
                  <td className="min-w-0 px-3 py-1.5 align-middle">
                    {job ? <LocationCell poolId={job.poolId} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  {/* RPO */}
                  <td className="min-w-0 px-3 py-1.5 align-middle">
                    {job ? (
                      !job.enabled ? (
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Paused</span>
                      ) : (
                        <span className={cn("inline-flex items-center gap-1 text-xs tabular-nums", row.rpoMet === false ? "font-semibold text-red-600 dark:text-red-400" : "text-foreground")}>
                          {row.rpoMet === false && <AlertTriangle size={11} aria-hidden="true" />}
                          {formatRpoCell(row.rpoLagMinutes, row.rpoTargetMinutes)}
                        </span>
                      )
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  {/* Actions */}
                  <td className="px-2 py-1.5 align-middle" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {job && (
                        <Button variant="outline" className="h-8 rounded-md px-2.5 text-xs font-semibold" onClick={() => onRunNow(job.id)} title="Run backup now">
                          Run
                        </Button>
                      )}
                      {job ? (
                        <AlertMenu
                          label={`Actions for ${job.name}`}
                          align="end"
                          width={190}
                          trigger={
                            <button type="button" aria-label={`Actions for ${job.name}`} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              <MoreVertical size={16} aria-hidden="true" />
                            </button>
                          }
                          items={[
                            { key: "run", label: row.status === "failed" ? "Retry backup" : "Run now", onSelect: () => onRunNow(job.id) },
                            { key: "restore", label: "Restore...", onSelect: () => onRestore(job.id) },
                            { key: "points", label: "View restore points", onSelect: () => onViewPoints(job.id) },
                            { key: "policy", label: "Edit policy", onSelect: () => onEditPolicy(job.id) },
                            { key: "pause", label: job.enabled ? "Pause" : "Resume", onSelect: () => onToggleJob(job.id, !job.enabled) },
                            { key: "divider", label: "", divider: true },
                            { key: "delete", label: "Delete", danger: true, onSelect: () => onDeleteJob(job.id) },
                          ]}
                        />
                      ) : (
                        <Button variant="outline" className="h-8 whitespace-nowrap rounded-md px-2.5 text-xs font-semibold" onClick={() => onEnableBackup(row.unprotected!.host)}>Enable</Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={11}>
                  <div className="flex min-h-[13.75rem] flex-col items-center justify-center gap-2 py-10 text-center">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
                      <FilterX size={20} aria-hidden="true" />
                    </span>
                    <p className="font-display text-base font-bold text-foreground">No backups match your filters</p>
                    <p className="max-w-sm text-sm text-muted-foreground">Try a different search, or clear the active filters to see all backup jobs.</p>
                    <Button variant="outline" className="mt-1 h-9 rounded-lg px-4 text-[0.8125rem]" onClick={onClearFilters}>Clear filters</Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-border/60 lg:hidden">
        {pageItems.map((row) => {
          const job = row.job;
          const name = job?.name ?? row.unprotected!.host;
          return (
            <div
              key={row.key}
              role={job ? "button" : undefined}
              tabIndex={job ? 0 : undefined}
              onClick={job ? () => openJob(job.id) : undefined}
              onKeyDown={job ? (event) => { if (event.key === "Enter") { event.preventDefault(); openJob(job.id); } } : undefined}
              className={cn("flex items-start gap-2 p-3 transition-colors hover:bg-slate-50 dark:hover:bg-muted/40", job && "cursor-pointer")}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{job?.id ?? "—"}</span>
                  {row.skippedMaintenance ? <SkippedMaintenanceBadge /> : <BackupStatusBadge status={job ? row.status : "none"} />}
                </div>
                <p className="mt-0.5 truncate text-[0.8125rem] font-semibold text-foreground">{name}</p>
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{job ? `${job.host}${job.group ? ` · ${job.group}` : ""}` : `${row.unprotected!.host} · unprotected`}</p>
                {job && (
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                    {row.runningRun ? `Running ${row.runningRun.progress ?? 0}%` : row.lastRun ? `Last ${timeAgo(row.lastRun.epochMs)} · ${formatBytes(row.lastRun.sizeBytes)}` : "Never ran"}
                    {" · RPO "}{formatLag(row.rpoLagMinutes)}{" / "}{formatLag(row.rpoTargetMinutes)}
                  </p>
                )}
              </div>
              {job ? (
                <ToggleSwitch size="sm" checked={job.enabled} onChange={(checked) => onToggleJob(job.id, checked)} label={`${job.enabled ? "Pause" : "Resume"} backup ${job.name}`} />
              ) : (
                <Button variant="outline" className="h-8 shrink-0 rounded-lg px-2 text-xs" onClick={(event) => { event.stopPropagation(); onEnableBackup(row.unprotected!.host); }}>Enable</Button>
              )}
            </div>
          );
        })}
        {pageItems.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-foreground">No backups match your filters</p>
            <Button variant="outline" className="h-9 rounded-lg px-4 text-[0.8125rem]" onClick={onClearFilters}>Clear filters</Button>
          </div>
        )}
      </div>

      <Pagination page={clampedPage} pageSize={pageSize} totalItems={sorted.length} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} noun="backups" />
    </div>
  );
}
