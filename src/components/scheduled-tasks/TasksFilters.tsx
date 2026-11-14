"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ListFilter, RotateCcw, Save, Search, Trash2, X } from "lucide-react";

import { Chip, SegmentedControl } from "@/components/logs/primitives";
import { MultiSelect } from "@/components/alert-rules/multi-select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SCOPE_GROUPS } from "@/mocks/maintenanceWindows";
import { TASK_OWNERS, TASK_TYPE_LABELS, type TaskType } from "@/mocks/scheduledTasks";
import type { ScheduledTasksFilters, TasksRange, TasksTab } from "@/hooks/useScheduledTasks";
import type { TaskTabCounts } from "@/utils/taskStats";
import { cn } from "@/lib/utils";

export interface SavedView {
  name: string;
  filter: Partial<ScheduledTasksFilters>;
}

interface TasksFiltersProps {
  filters: ScheduledTasksFilters;
  onChange: (patch: Partial<ScheduledTasksFilters>) => void;
  onReset: () => void;
  tabCounts: TaskTabCounts;
  totalCount: number;
  resultCount: number;
  compact: boolean;
  onCompactChange: (value: boolean) => void;
  savedViews: SavedView[];
  onSaveView: (name: string) => void;
  onApplyView: (view: SavedView) => void;
  onDeleteView: (name: string) => void;
}

const TYPE_OPTIONS = (Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((value) => ({ value, label: TASK_TYPE_LABELS[value] }));
const GROUP_OPTIONS = SCOPE_GROUPS.map((group) => ({ value: group.id, label: group.name }));
const OWNER_OPTIONS = TASK_OWNERS.map((owner) => ({ value: owner, label: owner }));

const PRESET_VIEWS: SavedView[] = [
  { name: "Failed runs", filter: { tab: "failed" } },
  { name: "Backups", filter: { types: ["backup"] } },
  { name: "Patching", filter: { types: ["patch"] } },
  { name: "Databases", filter: { groups: ["database-cluster"] } },
  { name: "Monitoring", filter: { types: ["monitoring"] } },
];

const TABS: Array<{ key: TasksTab; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "failed", label: "Failed" },
  { key: "running", label: "Running" },
];

const RANGE_OPTIONS: readonly TasksRange[] = ["Today", "7D", "30D", "Custom"];
const RANGE_LABEL: Record<TasksRange, string> = {
  Today: "Today",
  "7D": "7D",
  "30D": "30D",
  Custom: "Custom",
};

/** MW-style filter bar: status chips row + controls row (2.25rem controls) + active-filter chips. */
export function TasksFilters({
  filters, onChange, onReset, tabCounts, totalCount, resultCount, compact, onCompactChange,
  savedViews, onSaveView, onApplyView, onDeleteView,
}: TasksFiltersProps) {
  const [viewsOpen, setViewsOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const viewsRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!viewsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!viewsRef.current?.contains(event.target as Node)) setViewsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setViewsOpen(false); };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [viewsOpen]);

  /* "/" focuses the search box, like the Maintenance Windows page. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeChips: Array<{ key: string; label: string; onRemove: () => void }> = [];
  for (const type of filters.types) activeChips.push({ key: `type:${type}`, label: TASK_TYPE_LABELS[type], onRemove: () => onChange({ types: filters.types.filter((value) => value !== type) }) });
  for (const group of filters.groups) activeChips.push({ key: `group:${group}`, label: GROUP_OPTIONS.find((option) => option.value === group)?.label ?? group, onRemove: () => onChange({ groups: filters.groups.filter((value) => value !== group) }) });
  for (const owner of filters.owners) activeChips.push({ key: `owner:${owner}`, label: owner, onRemove: () => onChange({ owners: filters.owners.filter((value) => value !== owner) }) });
  if (filters.range !== "30D") activeChips.push({ key: "range", label: `Range: ${filters.range === "Custom" ? `${filters.customFrom || "…"} → ${filters.customTo || "…"}` : filters.range}`, onRemove: () => onChange({ range: "30D", customFrom: "", customTo: "" }) });
  if (filters.query.trim()) activeChips.push({ key: "q", label: `Search: "${filters.query.trim()}"`, onRemove: () => onChange({ query: "" }) });
  if (filters.tab !== "all") activeChips.push({ key: "tab", label: `Status: ${TABS.find((tab) => tab.key === filters.tab)?.label}`, onRemove: () => onChange({ tab: "all" }) });
  if (filters.flakyOnly) activeChips.push({ key: "flaky", label: "Flaky (failed in 7d)", onRemove: () => onChange({ flakyOnly: false }) });

  const activeCount = activeChips.length;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      {/* Row 1 - status chips + total */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
        {TABS.map((tab) => (
          <Chip key={tab.key} active={filters.tab === tab.key} onClick={() => onChange({ tab: tab.key })}>
            {tab.label}<span className="ml-1 tabular-nums opacity-75">({tabCounts[tab.key]})</span>
          </Chip>
        ))}
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {resultCount === totalCount ? `${totalCount} task${totalCount === 1 ? "" : "s"}` : <>{resultCount} of {totalCount} tasks</>}
        </span>
      </div>

      {/* Row 2 - search, filters, range, saved views, reset, compact */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-2">
        <div className="relative w-full sm:w-auto sm:min-w-[13.75rem] sm:max-w-xs sm:flex-1">
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            placeholder="Search tasks, owners, hosts…"
            aria-label="Search tasks"
            className="h-9 pl-9 pr-10 text-[0.8125rem]"
          />
          <kbd aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[0.75rem] font-medium text-muted-foreground">/</kbd>
        </div>

        <MultiSelect label="Type" options={TYPE_OPTIONS} selected={filters.types} onChange={(types) => onChange({ types: types as TaskType[] })} width={120} />
        <MultiSelect label="Target group" options={GROUP_OPTIONS} selected={filters.groups} onChange={(groups) => onChange({ groups })} width={160} />
        <MultiSelect label="Owner" options={OWNER_OPTIONS} selected={filters.owners} onChange={(owners) => onChange({ owners })} width={130} />

        <SegmentedControl value={filters.range} options={RANGE_OPTIONS} onChange={(value) => onChange({ range: value as TasksRange })} buttonClassName="h-8 px-2.5 text-[0.8125rem]" />
        {filters.range === "Custom" && (
          <span className="flex items-center gap-1.5">
            <Input type="date" value={filters.customFrom} onChange={(event) => onChange({ customFrom: event.target.value })} className="h-9 w-[9.0625rem] text-[0.8125rem]" aria-label="From date" />
            <span className="text-muted-foreground">-</span>
            <Input type="date" value={filters.customTo} onChange={(event) => onChange({ customTo: event.target.value })} className="h-9 w-[9.0625rem] text-[0.8125rem]" aria-label="To date" />
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div ref={viewsRef} className="relative">
            <Button variant="outline"  onClick={() => setViewsOpen((value) => !value)} aria-haspopup="true" aria-expanded={viewsOpen}>
              <ListFilter size={14} aria-hidden="true" />Saved Views<ChevronDown size={13} aria-hidden="true" className="text-muted-foreground" />
            </Button>
            {viewsOpen && (
              <div role="menu" aria-label="Saved views" className="motion-menu-in absolute right-0 top-10 z-40 w-64 rounded-[0.625rem] border border-gray-200 bg-white p-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] outline-none dark:border-border dark:bg-popover">
                <p className="px-2 pb-1 pt-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">Presets</p>
                {PRESET_VIEWS.map((view) => (
                  <button key={view.name} type="button" onClick={() => { onApplyView(view); setViewsOpen(false); }} className="flex h-8 w-full items-center rounded-lg px-2 text-left text-[0.8125rem] text-foreground transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-accent">
                    {view.name}
                  </button>
                ))}
                {savedViews.length > 0 && (
                  <>
                    <div className="mx-2 my-1 border-t border-border/70" />
                    <p className="px-2 pb-1 pt-1 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">My views</p>
                    {savedViews.map((view) => (
                      <div key={view.name} className="group flex h-8 w-full items-center rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-accent">
                        <button type="button" onClick={() => { onApplyView(view); setViewsOpen(false); }} className="h-full min-w-0 flex-1 truncate px-2 text-left text-[0.8125rem] text-foreground focus-visible:outline-none">
                          {view.name}
                        </button>
                        <button type="button" onClick={() => onDeleteView(view.name)} aria-label={`Delete view ${view.name}`} className="mr-1 rounded-lg p-1 text-muted-foreground opacity-0 transition-opacity hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100">
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </>
                )}
                <div className="mx-2 my-1 border-t border-border/70" />
                <form
                  className="flex items-center gap-1.5 px-1 py-1"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const name = saveName.trim();
                    if (!name) return;
                    onSaveView(name);
                    setSaveName("");
                    setViewsOpen(false);
                  }}
                >
                  <input
                    value={saveName}
                    onChange={(event) => setSaveName(event.target.value)}
                    placeholder="Save current view…"
                    aria-label="Save current view as"
                    className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-[0.75rem] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button type="submit" disabled={!saveName.trim()} aria-label="Save view" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors enabled:hover:bg-accent enabled:hover:text-foreground disabled:opacity-40">
                    <Save size={14} aria-hidden="true" />
                  </button>
                </form>
              </div>
            )}
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="rounded text-[0.8125rem] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear all<span className="ml-1 tabular-nums text-muted-foreground">({activeCount})</span>
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[0.8125rem] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Reset all filters"
          >
            <RotateCcw size={13} aria-hidden="true" />Reset
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={compact}
            aria-label="Compact rows"
            onClick={() => onCompactChange(!compact)}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-[0.75rem] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={compact ? "Switch to comfortable rows" : "Switch to compact rows"}
          >
            <ChevronRight size={13} aria-hidden="true" />Compact
          </button>
        </div>
      </div>

      {/* Row 3 - active filter chips */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2" aria-label="Active filters">
          <span className="text-[0.75rem] font-semibold uppercase tracking-wide text-muted-foreground">Active:</span>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              aria-label={`Remove filter ${chip.label}`}
              className="inline-flex h-7 max-w-[16.25rem] items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 text-[0.75rem] font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate">{chip.label}</span><X size={11} aria-hidden="true" />
            </button>
          ))}
          <button type="button" onClick={onReset} className="rounded-lg text-[0.75rem] font-semibold text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Clear all</button>
        </div>
      )}
    </div>
  );
}
