"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2, ChevronDown, FileDown, FileUp, Plus, RotateCcw, Trash2,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { TasksKpiRow, type KpiKey } from "@/components/scheduled-tasks/TasksKpiRow";
import { ExecutionTrendCard, type TrendRange } from "@/components/scheduled-tasks/ExecutionTrendCard";
import { TopFailingTasksCard } from "@/components/scheduled-tasks/TopFailingTasksCard";
import { TasksFilters, type SavedView } from "@/components/scheduled-tasks/TasksFilters";
import { TasksTable } from "@/components/scheduled-tasks/TasksTable";
import { TaskBulkBar } from "@/components/scheduled-tasks/TaskBulkBar";
import { TaskDetailDrawer } from "@/components/scheduled-tasks/TaskDetailDrawer";
import { TaskEditorDrawer } from "@/components/scheduled-tasks/TaskEditorDrawer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useScheduledTasks, DEFAULT_TASKS_FILTERS, type ScheduledTasksFilters } from "@/hooks/useScheduledTasks";
import { deriveTaskStats, deriveTrend } from "@/utils/taskStats";
import { cronForSchedule } from "@/utils/formatSchedule";
import type { ScheduledTask } from "@/mocks/scheduledTasks";

const SAVED_VIEWS_KEY = "scheduledTasksSavedViews";

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Operations > Scheduled Tasks - KPIs, trend, upcoming runs, filterable table, detail drawer, editor. */
export function TasksDashboard() {
  const [filters, setFilters] = useState<ScheduledTasksFilters>(DEFAULT_TASKS_FILTERS);
  const [compact, setCompact] = useState(false);
  const [trendRange, setTrendRange] = useState<TrendRange>("7D");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [kpiActive, setKpiActive] = useState<KpiKey | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<string[] | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => Date.now());
  const didInitURL = useRef(false);
  const toastTimer = useRef<number | null>(null);

  const {
    tasks, allTasks, runs, status, reload,
    createTask, updateTask, toggleTask, toggleMany, runNow, retryRun, duplicateTask, deleteTasks,
  } = useScheduledTasks(filters);

  const stats = useMemo(() => deriveTaskStats(allTasks, runs), [allTasks, runs]);
  const trend = useMemo(() => deriveTrend(runs, trendRange === "7D" ? 7 : trendRange === "30D" ? 30 : 90), [runs, trendRange]);
  const drawerTask = drawerTaskId ? allTasks.find((task) => task.id === drawerTaskId) ?? null : null;

  /* Saved views in localStorage */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
      if (raw) setSavedViews(JSON.parse(raw) as SavedView[]);
    } catch {
      setSavedViews([]);
    }
  }, []);

  /* URL params: read once on mount */
  useEffect(() => {
    if (didInitURL.current) return;
    didInitURL.current = true;
    const params = new URLSearchParams(window.location.search);
    const split = (value: string | null): string[] => (value ? value.split(",").map((item) => item.trim()).filter(Boolean) : []);
    const tabParam = params.get("tab");
    const tab: ScheduledTasksFilters["tab"] = tabParam === "active" || tabParam === "paused" || tabParam === "failed" || tabParam === "running" ? tabParam : "all";
    const rangeParam = params.get("range");
    const range: ScheduledTasksFilters["range"] = rangeParam === "Today" || rangeParam === "7D" || rangeParam === "30D" || rangeParam === "Custom" ? rangeParam : "30D";
    setFilters({
      tab,
      query: params.get("q") ?? "",
      types: split(params.get("type")) as ScheduledTasksFilters["types"],
      groups: split(params.get("group")),
      owners: split(params.get("owner")),
      range,
      customFrom: params.get("from") ?? "",
      customTo: params.get("to") ?? "",
      flakyOnly: params.get("flaky") === "1",
    });
    if (params.get("flaky") === "1") setKpiActive("success");
    const taskParam = params.get("task");
    if (taskParam) setDrawerTaskId(taskParam);
  }, []);

  /* URL params: write on change (no navigation, keeps scroll position) */
  useEffect(() => {
    if (!didInitURL.current) return;
    const params = new URLSearchParams();
    if (filters.query.trim()) params.set("q", filters.query.trim());
    if (filters.tab !== "all") params.set("tab", filters.tab);
    if (filters.types.length > 0) params.set("type", filters.types.join(","));
    if (filters.groups.length > 0) params.set("group", filters.groups.join(","));
    if (filters.owners.length > 0) params.set("owner", filters.owners.join(","));
    if (filters.range !== "30D") params.set("range", filters.range);
    if (filters.range === "Custom" && filters.customFrom) params.set("from", filters.customFrom);
    if (filters.range === "Custom" && filters.customTo) params.set("to", filters.customTo);
    if (filters.flakyOnly) params.set("flaky", "1");
    if (drawerTaskId) params.set("task", drawerTaskId);
    const query = params.toString();
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [filters, drawerTaskId]);

  /* Close the drawer when its task disappears (deleted) */
  useEffect(() => {
    if (drawerTaskId && status === "success" && !drawerTask) setDrawerTaskId(null);
  }, [drawerTaskId, drawerTask, status]);

  const showToast = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);
  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);

  const applyFilters = useCallback((patch: Partial<ScheduledTasksFilters>) => {
    setKpiActive(null);
    setFilters((current) => ({ ...current, ...patch }));
  }, []);
  const resetFilters = useCallback(() => { setKpiActive(null); setFilters(DEFAULT_TASKS_FILTERS); }, []);

  const handleKpiClick = useCallback((key: KpiKey) => {
    setKpiActive((current) => (current === key ? null : key));
    setFilters((current) => {
      const isSame = (key === "success" && current.flakyOnly) || (key !== "success" && !current.flakyOnly && current.tab === key);
      if (isSame) return { ...current, tab: "all", flakyOnly: false };
      switch (key) {
        case "total": return { ...current, tab: "all", flakyOnly: false };
        case "active": return { ...current, tab: "active", flakyOnly: false };
        case "paused": return { ...current, tab: "paused", flakyOnly: false };
        case "running": return { ...current, tab: "running", flakyOnly: false };
        case "failed": return { ...current, tab: "failed", flakyOnly: false };
        case "success": return { ...current, tab: "all", flakyOnly: true };
      }
    });
  }, []);

  const handleToggleTask = useCallback((task: ScheduledTask) => {
    toggleTask(task.id, !task.enabled);
    showToast(task.enabled ? `Paused “${task.name}”` : `Enabled “${task.name}”`);
  }, [toggleTask, showToast]);

  const handleRunNow = useCallback((task: ScheduledTask) => {
    runNow(task.id);
    showToast(`Run queued for “${task.name}”`);
  }, [runNow, showToast]);

  const handleDuplicate = useCallback((task: ScheduledTask) => {
    const id = duplicateTask(task.id);
    showToast(id ? `Duplicated as ${id}` : "Task not found");
  }, [duplicateTask, showToast]);

  const openCreateEditor = useCallback(() => { setEditingTask(null); setEditorOpen(true); }, []);
  const openEditEditor = useCallback((task: ScheduledTask) => { setEditingTask(task); setEditorOpen(true); }, []);
  const openEditorForDrawer = useCallback(() => { if (drawerTask) openEditEditor(drawerTask); }, [drawerTask, openEditEditor]);

  const handleEditorSubmit = useCallback((input: Parameters<typeof createTask>[0], mode: "save" | "saveAndEnable") => {
    if (editingTask) {
      updateTask(editingTask.id, input);
      showToast(`Updated “${input.name.trim()}”`);
    } else {
      const id = createTask({ ...input, enabled: mode === "saveAndEnable" });
      showToast(mode === "saveAndEnable" ? `Created and enabled ${id}` : `Saved paused as ${id}`);
    }
    setEditorOpen(false);
  }, [editingTask, createTask, updateTask, showToast]);

  const confirmDelete = useCallback(() => {
    if (!deleteTargets || deleteTargets.length === 0) return;
    deleteTasks(deleteTargets);
    showToast(`Deleted ${deleteTargets.length} task${deleteTargets.length === 1 ? "" : "s"}`);
    setSelectedIds((current) => current.filter((id) => !deleteTargets.includes(id)));
    setDeleteTargets(null);
  }, [deleteTargets, deleteTasks, showToast]);

  const handleBulkRunNow = useCallback(() => {
    for (const id of selectedIds) runNow(id);
    showToast(`Queued ${selectedIds.length} run${selectedIds.length === 1 ? "" : "s"}`);
    setSelectedIds([]);
  }, [selectedIds, runNow, showToast]);
  const handleBulkPause = useCallback(() => {
    toggleMany(selectedIds, false);
    showToast(`Paused ${selectedIds.length} task${selectedIds.length === 1 ? "" : "s"}`);
    setSelectedIds([]);
  }, [selectedIds, toggleMany, showToast]);
  const handleBulkResume = useCallback(() => {
    toggleMany(selectedIds, true);
    showToast(`Resumed ${selectedIds.length} task${selectedIds.length === 1 ? "" : "s"}`);
    setSelectedIds([]);
  }, [selectedIds, toggleMany, showToast]);

  const exportCsv = useCallback(() => {
    const header = ["id", "name", "type", "owner", "enabled", "schedule", "timezone", "hosts", "groups", "retries", "timeout_min"];
    const rows = tasks.map((task) => [
      task.id, csvCell(task.name), task.type, csvCell(task.owner), String(task.enabled),
      csvCell(cronForSchedule(task.schedule)), task.schedule.timeZone,
      csvCell(task.target.hosts.join(" ")), csvCell(task.target.groups.join(" ")),
      String(task.execution.retries), String(task.execution.timeoutMinutes),
    ].join(","));
    download("scheduled-tasks.csv", [header.join(","), ...rows].join("\n"), "text/csv");
    showToast(`Exported ${rows.length} task(s) as CSV`);
  }, [tasks, showToast]);

  const exportJson = useCallback(() => {
    download("scheduled-tasks.json", JSON.stringify(tasks, null, 2), "application/json");
    showToast(`Exported ${tasks.length} task(s) as JSON`);
  }, [tasks, showToast]);

  const exportTrendCsv = useCallback(() => {
    const header = "day,success,failed,skipped";
    const rows = trend.map((bucket) => `${bucket.label},${bucket.success},${bucket.failed},${bucket.skipped}`);
    download("execution-trend.csv", [header, ...rows].join("\n"), "text/csv");
    showToast("Execution trend exported");
  }, [trend, showToast]);

  const handleSaveView = useCallback((name: string) => {
    const view: SavedView = { name, filter: { ...filters } };
    setSavedViews((current) => {
      const next = [...current.filter((saved) => saved.name !== name), view];
      try { window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
    showToast(`View “${name}” saved`);
  }, [filters, showToast]);
  const handleApplyView = useCallback((view: SavedView) => {
    setKpiActive(null);
    setFilters({ ...DEFAULT_TASKS_FILTERS, ...view.filter });
  }, []);
  const handleDeleteView = useCallback((name: string) => {
    setSavedViews((current) => {
      const next = current.filter((saved) => saved.name !== name);
      try { window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setLastRefreshedAt(Date.now());
    reload();
  }, [reload]);

  const deleteNames = useMemo(() => {
    if (!deleteTargets) return [];
    return allTasks.filter((task) => deleteTargets.includes(task.id)).slice(0, 5).map((task) => task.name);
  }, [deleteTargets, allTasks]);

  return (
    <div className="min-w-0 overflow-x-hidden space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Operations", "Scheduled Tasks"]}
        title="Scheduled Tasks"
        subtitle="Backups, patching, reports and recurring jobs with run history"
        demo
        lastUpdated={new Date(lastRefreshedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        onRefresh={handleRefresh}
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <AlertMenu
              label="Export scheduled tasks"
              width={200}
              trigger={
                <Button variant="outline" className="h-10 gap-1.5 rounded-lg px-3 text-sm" aria-label="Export scheduled tasks">
                  <FileDown size={15} aria-hidden />Export
                  <ChevronDown size={13} aria-hidden />
                </Button>
              }
              items={[
                { key: "csv", label: "Export CSV (filtered)", onSelect: exportCsv },
                { key: "json", label: "Export JSON (filtered)", onSelect: exportJson },
                { key: "trend", label: "Export trend CSV", onSelect: exportTrendCsv },
              ]}
            />
            <Button variant="outline" className="h-10 gap-1.5 rounded-lg px-3 text-sm" onClick={() => showToast("Import is a mockup action.")}>
              <FileUp size={15} aria-hidden />Import
            </Button>
            <Button className="h-10 gap-1.5 rounded-lg px-3.5 text-sm" onClick={openCreateEditor}>
              <Plus size={15} aria-hidden />Create Task
            </Button>
          </div>
        }
      />

      {status === "loading" && (
        <>
          <section aria-busy="true" aria-label="Loading KPIs" className="grid grid-cols-2 items-stretch gap-2 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[5.5rem] animate-pulse rounded-xl bg-muted" />)}
          </section>
          <section className="grid items-stretch gap-4 xl:grid-cols-3">
            <div className="h-[18.75rem] animate-pulse rounded-xl bg-muted xl:col-span-2" />
            <div className="h-[18.75rem] animate-pulse rounded-xl bg-muted" />
          </section>
          <div className="h-[32.5rem] animate-pulse rounded-xl bg-muted" />
        </>
      )}

      {status === "error" && (
        <section role="alert" className="grid min-h-[20rem] place-items-center rounded-xl border border-border bg-card p-6 text-center">
          <div className="flex max-w-md flex-col items-center gap-2">
            <p className="font-display text-base font-bold text-foreground">Scheduled tasks could not be loaded</p>
            <p className="text-sm text-muted-foreground">The task service failed to respond. Retry to reload it.</p>
            <Button onClick={reload} className="h-10 gap-1.5 rounded-lg px-4 text-sm"><RotateCcw size={15} aria-hidden />Retry</Button>
          </div>
        </section>
      )}

      {status === "success" && (
        <>
          <TasksKpiRow stats={stats} activeKpi={kpiActive} onKpiClick={handleKpiClick} />

          <section className="grid items-stretch gap-4 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-8">
              <ExecutionTrendCard data={trend} range={trendRange} onRangeChange={setTrendRange} onExport={exportTrendCsv} />
            </div>
            <div className="min-w-0 xl:col-span-4">
              <TopFailingTasksCard tasks={allTasks} runs={runs} />
            </div>
          </section>


          <TasksFilters
            filters={filters}
            onChange={applyFilters}
            onReset={resetFilters}
            tabCounts={stats.tabCounts}
            totalCount={allTasks.length}
            resultCount={tasks.length}
            compact={compact}
            onCompactChange={setCompact}
            savedViews={savedViews}
            onSaveView={handleSaveView}
            onApplyView={handleApplyView}
            onDeleteView={handleDeleteView}
          />

          <Card className="overflow-hidden rounded-xl">
            <TaskBulkBar
              count={selectedIds.length}
              onRunNow={handleBulkRunNow}
              onPause={handleBulkPause}
              onResume={handleBulkResume}
              onDelete={() => setDeleteTargets(selectedIds)}
              onClear={() => setSelectedIds([])}
            />
            <TasksTable
              tasks={tasks}
              runs={runs}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onOpenDrawer={(task) => setDrawerTaskId(task.id)}
              onToggleTask={handleToggleTask}
              onRunNow={handleRunNow}
              onEdit={openEditEditor}
              onDuplicate={handleDuplicate}
              onDelete={(task) => setDeleteTargets([task.id])}
              compact={compact}
              onClearFilters={resetFilters}
              onCreateTask={openCreateEditor}
            />
          </Card>
        </>
      )}

      <TaskDetailDrawer
        task={drawerTask}
        onClose={() => setDrawerTaskId(null)}
        onRunNow={handleRunNow}
        onToggle={handleToggleTask}
        onEdit={openEditEditor}
        onRetry={(taskId) => { retryRun(taskId); showToast("Retry queued"); }}
      />

      <TaskEditorDrawer
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        task={editingTask}
        allTasks={allTasks}
        onSubmit={handleEditorSubmit}
      />

      {/* Delete confirm */}
      <Dialog open={deleteTargets != null} onOpenChange={(open) => { if (!open) setDeleteTargets(null); }}>
        <DialogContent className="w-[min(27.5rem,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm"><Trash2 size={16} aria-hidden className="text-red-600" />Delete {deleteTargets?.length ?? 0} task{(deleteTargets?.length ?? 0) === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>
              {deleteNames.length > 0 && <span className="mb-1 block font-medium text-foreground">{deleteNames.join(", ")}{(deleteTargets?.length ?? 0) > 5 ? "…" : ""}</span>}
              This removes the task{(deleteTargets?.length ?? 0) === 1 ? "" : "s"} and all recorded runs. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTargets(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div role="status" key={toast.id} className="fixed bottom-5 right-5 z-[1400] flex max-w-sm items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-[0.8125rem] font-medium text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
          <CheckCircle2 size={15} aria-hidden className="shrink-0 text-green-400 dark:text-green-600" />
          <span className="min-w-0">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
