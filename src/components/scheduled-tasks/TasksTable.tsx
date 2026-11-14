"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, FilterX, Inbox, MoreVertical,
} from "lucide-react";

import { AlertMenu, type AlertMenuItem } from "@/components/alerts/alert-menu";
import { ToggleSwitch } from "@/components/alert-rules/toggle-switch";
import { TaskTypeBadge, RunStatusBadge, SkippedMaintenanceBadge } from "@/components/scheduled-tasks/task-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/pagination";
import { deriveTaskViews, formatCountdown, formatDuration, targetChips } from "@/utils/taskStats";
import { formatSchedule, cronForSchedule } from "@/utils/formatSchedule";
import { timeAgo } from "@/mocks/logs";
import type { ScheduledTask } from "@/mocks/scheduledTasks";
import type { TaskRun } from "@/mocks/taskRuns";
import { cn } from "@/lib/utils";

interface TasksTableProps {
  tasks: ScheduledTask[];
  runs: TaskRun[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onOpenDrawer: (task: ScheduledTask) => void;
  onToggleTask: (task: ScheduledTask) => void;
  onRunNow: (task: ScheduledTask) => void;
  onEdit: (task: ScheduledTask) => void;
  onDuplicate: (task: ScheduledTask) => void;
  onDelete: (task: ScheduledTask) => void;
  compact: boolean;
  onClearFilters: () => void;
  onCreateTask: () => void;
}

type SortKey = "name" | "lastRun" | "nextRun";
type SortDir = "asc" | "desc";

function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** MW-style compact table. Six effective columns; no horizontal scroll. */
export function TasksTable({
  tasks, runs, selectedIds, onSelectionChange, onOpenDrawer, onToggleTask, onRunNow,
  onEdit, onDuplicate, onDelete, compact, onClearFilters, onCreateTask,
}: TasksTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("nextRun");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [targetPopoverId, setTargetPopoverId] = useState<string | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);
  const now = useNow();

  const views = useMemo(() => deriveTaskViews(tasks, runs, now), [tasks, runs, now]);

  const sorted = useMemo(() => {
    const INF = Number.POSITIVE_INFINITY;
    const value = (task: ScheduledTask): number | string => {
      const derived = views.get(task.id);
      switch (sortKey) {
        case "name": return task.name.toLowerCase();
        case "lastRun": return derived?.lastRun?.epochMs ?? INF;
        case "nextRun": return derived?.nextRunMs ?? INF;
      }
    };
    return [...tasks].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === "number" && typeof bv === "number") {
        if (av === INF && bv === INF) return 0;
        if (av === INF) return 1;
        if (bv === INF) return -1;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [tasks, views, sortKey, sortDir]);

  useEffect(() => { setPage(1); }, [pageSize]);
  useEffect(() => { setPage((value) => Math.min(value, Math.max(1, Math.ceil(sorted.length / pageSize)))); }, [sorted.length, pageSize]);
  useEffect(() => { setFocusedId(null); }, [sorted.length]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const startIndex = (clampedPage - 1) * pageSize;
  const visible = sorted.slice(startIndex, startIndex + pageSize);
  const startLabel = sorted.length === 0 ? 0 : startIndex + 1;
  const endLabel = Math.min(startIndex + pageSize, sorted.length);

  const visibleIds = visible.map((task) => task.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.includes(id));
  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  const toggleAllVisible = () => {
    if (allVisibleSelected) onSelectionChange(selectedIds.filter((id) => !visibleIds.includes(id)));
    else onSelectionChange([...new Set([...selectedIds, ...visibleIds])]);
  };
  const toggleOne = (id: string) => {
    onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  };

  const requestSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
  };

  const sortHeader = (key: SortKey, label: string, className?: string) => {
    const active = sortKey === key;
    return (
      <button
        type="button"
        onClick={() => requestSort(key)}
        aria-label={`Sort by ${label}${active ? ` (${sortDir === "asc" ? "ascending" : "descending"})` : ""}`}
        className={cn("inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded", active && "text-foreground", className)}
      >
        {label}
        {active && (sortDir === "asc" ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" />)}
      </button>
    );
  };

  const onTableKeyDown = (event: React.KeyboardEvent) => {
    if (sorted.length === 0) return;
    const target = event.target as HTMLElement;
    if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)) return;
    const currentIndex = sorted.findIndex((task) => task.id === focusedId);
    if (event.key === "j" || event.key === "J") {
      event.preventDefault();
      const next = currentIndex === -1 ? 0 : Math.min(sorted.length - 1, currentIndex + 1);
      setFocusedId(sorted[next].id);
      document.getElementById(`task-row-${sorted[next].id}`)?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "k" || event.key === "K") {
      event.preventDefault();
      const next = currentIndex === -1 ? sorted.length - 1 : Math.max(0, currentIndex - 1);
      setFocusedId(sorted[next].id);
      document.getElementById(`task-row-${sorted[next].id}`)?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "r" || event.key === "R") {
      const task = sorted.find((entry) => entry.id === focusedId);
      if (task) { event.preventDefault(); onRunNow(task); }
    } else if (event.key === "Enter") {
      const task = sorted.find((entry) => entry.id === focusedId);
      if (task) { event.preventDefault(); onOpenDrawer(task); }
    }
  };

  const kebabItems = (task: ScheduledTask): AlertMenuItem[] => [
    { key: "run", label: "Run now", onSelect: () => onRunNow(task) },
    { key: "toggle", label: task.enabled ? "Pause" : "Resume", onSelect: () => onToggleTask(task) },
    { key: "edit", label: "Edit", onSelect: () => onEdit(task) },
    { key: "duplicate", label: "Duplicate", onSelect: () => onDuplicate(task) },
    { key: "history", label: "View history", onSelect: () => onOpenDrawer(task) },
    { key: "divider", label: "divider", divider: true },
    { key: "delete", label: "Delete", danger: true, onSelect: () => onDelete(task) },
  ];

  const rowHeight = compact ? "h-12" : "h-16";

  return (
    <div className="min-w-0" onKeyDown={onTableKeyDown}>
      <div className="overflow-x-hidden">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: "2.5rem" }} />
            <col style={{ width: "32%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "5rem" }} />
            <col style={{ width: "3rem" }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-card shadow-[0_1px_0_0_var(--border)]">
              <th scope="col" className="px-3 py-2">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  aria-label="Select all tasks on this page"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  className="h-4 w-4 cursor-pointer rounded border-input accent-[oklch(0.5855_0.1885_255.72)]"
                />
              </th>
              <th scope="col" aria-sort={sortKey === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2">{sortHeader("name", "Task")}</th>
              <th scope="col" className="px-3 py-2"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type &amp; Schedule</span></th>
              <th scope="col" className="hidden px-3 py-2 text-left xl:table-cell"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Target</span></th>
              <th scope="col" aria-sort={sortKey === "lastRun" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2">{sortHeader("lastRun", "Last Run")}</th>
              <th scope="col" aria-sort={sortKey === "nextRun" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2">{sortHeader("nextRun", "Next Run")}</th>
              <th scope="col" className="px-2 py-2 text-center"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">On</span></th>
              <th scope="col" className="px-2 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="flex min-h-[13.75rem] flex-col items-center justify-center gap-2 py-10 text-center">
                    <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground"><FilterX size={20} /></span>
                    <p className="font-display text-base font-bold text-foreground">No tasks match your filters</p>
                    <p className="max-w-sm text-sm text-muted-foreground">Try clearing the search or filters to see the full task list.</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Button variant="outline" className="h-9 gap-1.5 rounded-lg px-4 text-[0.8125rem]" onClick={onClearFilters}>Clear filters</Button>
                      <Button className="h-9 gap-1.5 rounded-lg px-4 text-[0.8125rem]" onClick={onCreateTask}><Inbox size={14} aria-hidden="true" />Create Task</Button>
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {visible.map((task) => {
              const derived = views.get(task.id);
              const lastRun = derived?.lastRun ?? null;
              const runningRun = derived?.runningRun ?? null;
              const lastFailed = lastRun?.status === "failed";
              const isRunning = runningRun != null;
              const chips = targetChips(task);
              const shownChips = chips.slice(0, 2);
              const extraChips = chips.slice(2);
              const nextRunMs = derived?.nextRunMs ?? null;
              const selected = selectedIds.includes(task.id);
              const avg = derived?.avgDurationMs ?? 120_000;
              const progress = isRunning && runningRun ? Math.min(0.95, Math.max(0.08, (now - runningRun.epochMs) / Math.max(avg, 1))) : 0;
              const popoverOpen = targetPopoverId === task.id;
              return (
                <tr
                  key={task.id}
                  id={`task-row-${task.id}`}
                  tabIndex={0}
                  aria-label={`Task ${task.name}`}
                  aria-selected={selected}
                  data-focused={focusedId === task.id || undefined}
                  onClick={() => onOpenDrawer(task)}
                  onFocus={() => setFocusedId(task.id)}
                  className={cn(
                    "group cursor-pointer border-b border-border/60 align-middle transition-colors last:border-0 hover:bg-slate-50 focus-visible:outline-none dark:hover:bg-muted/40",
                    rowHeight,
                    focusedId === task.id && "bg-blue-50 dark:bg-blue-500/10",
                    selected && "bg-primary/[0.06] dark:bg-primary/10",
                  )}
                >
                  {/* Checkbox (failed rows carry the 0.1875rem red indicator) */}
                  <td className="relative px-3 py-1.5 align-middle" onClick={(event) => event.stopPropagation()}>
                    {lastFailed && <span aria-hidden="true" className="absolute left-0 top-0 h-full w-[0.1875rem] rounded-r-sm bg-red-600" />}
                    <input
                      type="checkbox"
                      aria-label={`Select ${task.id}`}
                      checked={selected}
                      onChange={() => toggleOne(task.id)}
                      className="h-4 w-4 cursor-pointer rounded border-input accent-[oklch(0.5855_0.1885_255.72)]"
                    />
                  </td>

                  {/* Task: muted ID / title / description / running progress */}
                  <td className="min-w-0 px-3 py-1.5 align-middle">
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-muted-foreground">{task.id}</span>
                      {isRunning && (
                        <span className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full bg-blue-500/10 px-2 text-xs font-semibold tabular-nums text-blue-500 dark:bg-blue-500/15 dark:text-blue-300">
                          Running {Math.round(progress * 100)}%
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[0.8125rem] font-semibold text-foreground group-hover:text-primary" title={task.name}>{task.name}</span>
                    <span className="mt-0.5 block truncate text-xs leading-snug text-muted-foreground" title={task.description}>{task.description}</span>
                    {isRunning && (
                      <span className="mt-1 block h-[0.1875rem] w-full max-w-[17.5rem] overflow-hidden rounded-full bg-blue-500/15" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Run progress">
                        <span className="block h-full rounded-full bg-blue-500 transition-[width] duration-1000 ease-linear" style={{ width: `${Math.round(progress * 100)}%` }} />
                      </span>
                    )}
                  </td>

                  {/* Type & schedule */}
                  <td className="min-w-0 px-3 py-1.5 align-middle">
                    <TaskTypeBadge type={task.type} />
                    <span className="mt-0.5 block truncate text-xs font-medium text-foreground" title={`${cronForSchedule(task.schedule)} · ${task.schedule.timeZone}`}>
                      {formatSchedule(task.schedule)}<span className="ml-1 font-normal text-muted-foreground">· {task.schedule.timeZone.replace("Asia/", "")}</span>
                    </span>
                  </td>

                  {/* Target: max 2 chips + popover */}
                  <td className="hidden px-3 py-1.5 align-middle xl:table-cell" onClick={(event) => event.stopPropagation()}>
                    <div className="relative min-w-0">
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        {chips.length === 0 && <span className="text-xs text-muted-foreground">Global</span>}
                        {shownChips.map((chip) => (
                          <span
                            key={`${chip.kind}-${chip.label}`}
                            title={chip.label}
                            className={cn(
                              "max-w-[5.75rem] truncate rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs",
                              chip.kind === "host" ? "font-mono text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {chip.label}
                          </span>
                        ))}
                        {extraChips.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setTargetPopoverId(popoverOpen ? null : task.id)}
                            aria-expanded={popoverOpen}
                            aria-label={`Show all ${chips.length} targets`}
                            className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            +{extraChips.length}
                          </button>
                        )}
                      </span>
                      {popoverOpen && (
                        <div role="dialog" aria-label="All targets" className="motion-menu-in absolute left-0 top-7 z-30 w-56 rounded-[0.625rem] border border-gray-200 bg-white p-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] dark:border-border dark:bg-popover">
                          {chips.map((chip) => (
                            <div key={`${chip.kind}-${chip.label}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs">
                              <span className={cn("truncate", chip.kind === "host" ? "font-mono text-foreground" : "text-muted-foreground")}>{chip.label}</span>
                              <Badge variant="secondary" className="shrink-0 text-[0.625rem]">{chip.kind}</Badge>
                            </div>
                          ))}
                          <button type="button" onClick={() => setTargetPopoverId(null)} className="mt-1 flex h-7 w-full items-center justify-center rounded-md text-xs font-medium text-muted-foreground hover:bg-accent">Close</button>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Last run */}
                  <td className="min-w-0 px-3 py-1.5 align-middle">
                    {lastRun ? (
                      <>
                        {lastRun.maintenance && lastRun.status === "skipped" ? <SkippedMaintenanceBadge /> : <RunStatusBadge status={lastRun.status} />}
                        <span className="mt-0.5 block truncate text-xs tabular-nums text-muted-foreground" title={new Date(lastRun.startedAt).toLocaleString()}>
                          {timeAgo(lastRun.epochMs)} · {formatDuration(lastRun.durationMs)}
                        </span>
                      </>
                    ) : <span className="text-xs text-muted-foreground">Never run</span>}
                  </td>

                  {/* Next run */}
                  <td className="min-w-0 px-3 py-1.5 align-middle">
                    {!task.enabled ? (
                      <span className="text-[0.8125rem] font-medium text-muted-foreground">Paused</span>
                    ) : nextRunMs != null ? (
                      <>
                        <span className="block truncate text-[0.8125rem] font-semibold tabular-nums text-primary">{formatCountdown(nextRunMs, now)}</span>
                        <span className="mt-0.5 block truncate text-xs tabular-nums text-muted-foreground" title={new Date(nextRunMs).toLocaleString()}>
                          {new Date(nextRunMs).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>

                  {/* Toggle */}
                  <td className="px-2 py-1.5 text-center align-middle" onClick={(event) => event.stopPropagation()}>
                    <ToggleSwitch checked={task.enabled} onChange={() => onToggleTask(task)} label={task.enabled ? `Pause ${task.name}` : `Enable ${task.name}`} size="sm" />
                  </td>

                  {/* Kebab */}
                  <td className="px-1 py-1.5 align-middle" onClick={(event) => event.stopPropagation()}>
                    <AlertMenu
                      label={`Actions for ${task.id}`}
                      align="end"
                      width={180}
                      trigger={
                        <button
                          type="button"
                          aria-label={`Actions for ${task.id}`}
                          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <MoreVertical size={16} aria-hidden="true" />
                        </button>
                      }
                      items={kebabItems(task)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={clampedPage} pageSize={pageSize} totalItems={sorted.length} onPageChange={setPage} onPageSizeChange={setPageSize} noun="tasks" />
    </div>
  );
}

