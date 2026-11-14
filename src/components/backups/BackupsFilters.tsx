"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ChevronDown, ChevronsRight, ListFilter, RotateCcw, Search, X } from "lucide-react";

import { MultiSelect } from "@/components/alert-rules/multi-select";
import { AlertMenu, type AlertMenuItem } from "@/components/alerts/alert-menu";
import { Chip, SegmentedControl } from "@/components/logs/primitives";
import { BACKUP_ASSET_TYPES, BACKUP_TYPE_LABELS, type BackupType } from "@/mocks/backups";
import { STORAGE_POOLS } from "@/mocks/storageLocations";
import { POOL_LABELS } from "@/components/backups/location-meta";
import type { BackupsFilters as Filters, BackupsRange, BackupsTab } from "@/hooks/useBackups";
import type { BackupStatusKey } from "@/utils/backupStats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = ["Today", "7D", "30D", "Custom"] as const;
const SAVED_VIEWS_KEY = "backupsSavedViews";

const STATUS_OPTIONS: Array<{ value: BackupStatusKey; label: string; dot: string }> = [
  { value: "success", label: "Success", dot: "#16A34A" },
  { value: "failed", label: "Failed", dot: "#DC2626" },
  { value: "running", label: "Running", dot: "#3B82F6" },
  { value: "skipped", label: "Skipped (maintenance)", dot: "#94A3B8" },
  { value: "paused", label: "Paused", dot: "#94A3B8" },
  { value: "none", label: "No backup", dot: "#94A3B8" },
];

const TYPE_OPTIONS = (Object.keys(BACKUP_TYPE_LABELS) as BackupType[]).map((value) => ({ value, label: BACKUP_TYPE_LABELS[value] }));
const LOCATION_OPTIONS = STORAGE_POOLS.map((pool) => ({ value: pool.id, label: pool.name }));
const ASSET_TYPE_OPTIONS = BACKUP_ASSET_TYPES.map((value) => ({ value, label: value }));

interface SavedView {
  id: string;
  name: string;
  filter: Partial<Filters>;
}

const PRESET_VIEWS: SavedView[] = [
  { id: "preset-failed-7d", name: "Failed (7d)", filter: { statuses: ["failed"], ranWithin: "7D" } },
  { id: "preset-running", name: "Running now", filter: { statuses: ["running"] } },
  { id: "preset-unprotected", name: "No backup", filter: { statuses: ["none"] } },
  { id: "preset-offsite", name: "Cold storage only", filter: { locations: ["offsite-vault"] } },
];

interface BackupsFiltersProps {
  filters: Filters;
  onPatch: (patch: Partial<Filters>) => void;
  onReset: () => void;
  jobsTabCount: number;
  pointsTabCount: number;
  coverageTabCount: number;
  policiesTabCount: number;
  statusCounts: Record<BackupStatusKey, number>;
  /** Right-aligned total, e.g. "24 backups". */
  totalLabel: string;
  density: "default" | "compact";
  onToggleDensity: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
}

const nf = new Intl.NumberFormat();

export function BackupsFilters({
  filters,
  onPatch,
  onReset,
  jobsTabCount,
  pointsTabCount,
  coverageTabCount,
  policiesTabCount,
  statusCounts,
  totalLabel,
  density,
  onToggleDensity,
  searchRef,
}: BackupsFiltersProps) {
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
      setSavedViews(raw ? (JSON.parse(raw) as SavedView[]) : []);
    } catch {
      setSavedViews([]);
    }
  }, []);

  const persistViews = (views: SavedView[]) => {
    setSavedViews(views);
    try {
      window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
    } catch {
      // storage unavailable - keep in-memory only
    }
  };

  const allViews = [...PRESET_VIEWS, ...savedViews];
  const viewItems: AlertMenuItem[] = [
    ...allViews.map((view) => ({
      key: view.id,
      label: view.name,
      onSelect: () => onPatch({ ...view.filter }),
    })),
    { key: "divider-save", label: "", divider: true },
    {
      key: "save-current",
      label: "Save current view...",
      onSelect: () => {
        const name = window.prompt("Name this view");
        if (!name?.trim()) return;
        const { tab: _tab, query: _query, customFrom: _from, customTo: _to, ...rest } = filters;
        persistViews([...savedViews, { id: `saved-${Date.now()}`, name: name.trim(), filter: { ...rest, query: filters.query } }]);
      },
    },
    ...(savedViews.length > 0 ? [{
      key: "clear-saved",
      label: "Clear saved views",
      onSelect: () => persistViews([]),
    }] : []),
  ];

  const activeChips: Array<{ key: string; label: string; onRemove: () => void }> = [];
  for (const value of filters.assetTypes) activeChips.push({ key: `asset:${value}`, label: value, onRemove: () => onPatch({ assetTypes: filters.assetTypes.filter((item) => item !== value) }) });
  for (const value of filters.types) activeChips.push({ key: `type:${value}`, label: BACKUP_TYPE_LABELS[value as BackupType], onRemove: () => onPatch({ types: filters.types.filter((item) => item !== value) }) });
  for (const value of filters.locations) {
    const label = POOL_LABELS[value] ?? value;
    activeChips.push({ key: `loc:${value}`, label, onRemove: () => onPatch({ locations: filters.locations.filter((item) => item !== value) }) });
  }
  for (const value of filters.statuses) {
    const meta = STATUS_OPTIONS.find((item) => item.value === value);
    activeChips.push({ key: `status:${value}`, label: meta?.label ?? value, onRemove: () => onPatch({ statuses: filters.statuses.filter((item) => item !== value) }) });
  }
  if (filters.ranWithin !== "30D") activeChips.push({ key: "ran", label: `Last: ${filters.ranWithin}`, onRemove: () => onPatch({ ranWithin: "30D", customFrom: "", customTo: "" }) });
  if (filters.query.trim()) activeChips.push({ key: "q", label: `Search: ${filters.query.trim()}`, onRemove: () => onPatch({ query: "" }) });

  const activeFilterCount = filters.assetTypes.length + filters.types.length + filters.locations.length + filters.statuses.length
    + (filters.ranWithin !== "30D" ? 1 : 0) + (filters.query.trim() ? 1 : 0);

  const statusOptionsWithCounts = STATUS_OPTIONS.map((option) => ({ ...option, label: `${option.label} (${nf.format(statusCounts[option.value] ?? 0)})` }));
  const showStatusFilters = filters.tab === "jobs";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      {/* Row 1 - view tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Backups view">
          <Chip active={filters.tab === "jobs"} onClick={() => onPatch({ tab: "jobs" as BackupsTab })}>Backup Jobs<span className="ml-1 tabular-nums opacity-75">({nf.format(jobsTabCount)})</span></Chip>
          <Chip active={filters.tab === "points"} onClick={() => onPatch({ tab: "points" as BackupsTab })}>Restore Points<span className="ml-1 tabular-nums opacity-75">({nf.format(pointsTabCount)})</span></Chip>
          <Chip active={filters.tab === "coverage"} onClick={() => onPatch({ tab: "coverage" as BackupsTab })}>Coverage<span className="ml-1 tabular-nums opacity-75">({nf.format(coverageTabCount)})</span></Chip>
          <Chip active={filters.tab === "policies"} onClick={() => onPatch({ tab: "policies" as BackupsTab })}>Policies<span className="ml-1 tabular-nums opacity-75">({nf.format(policiesTabCount)})</span></Chip>
        </div>
        <span className="text-[12px] tabular-nums text-muted-foreground">{totalLabel}</span>
      </div>

      {/* Row 2 - search + multi-selects + range + view actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-2">
        <div className="relative w-full sm:w-auto sm:min-w-[220px] sm:max-w-xs sm:flex-1">
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={filters.query}
            onChange={(event) => onPatch({ query: event.target.value })}
            placeholder="Search jobs, assets, owners..."
            aria-label="Search backups"
            className="h-9 pl-9 pr-10 text-sm"
          />
          <kbd aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[12px] font-medium text-muted-foreground">/</kbd>
        </div>
        <MultiSelect label="Asset type" options={ASSET_TYPE_OPTIONS} selected={filters.assetTypes} onChange={(v) => onPatch({ assetTypes: v })} width={132} />
        <MultiSelect label="Backup type" options={TYPE_OPTIONS} selected={filters.types} onChange={(v) => onPatch({ types: v as BackupType[] })} width={140} />
        <MultiSelect label="Location" options={LOCATION_OPTIONS} selected={filters.locations} onChange={(v) => onPatch({ locations: v })} width={150} />
        {showStatusFilters && (
          <MultiSelect label="Status" options={statusOptionsWithCounts} selected={filters.statuses} onChange={(v) => onPatch({ statuses: v as BackupStatusKey[] })} width={150} />
        )}
        <SegmentedControl value={filters.ranWithin} options={RANGE_OPTIONS} onChange={(v) => onPatch({ ranWithin: v as BackupsRange })} buttonClassName="h-8 px-2.5 text-[13px]" />
        {filters.ranWithin === "Custom" && (
          <span className="flex items-center gap-1.5">
            <Input type="date" value={filters.customFrom} onChange={(event) => onPatch({ customFrom: event.target.value })} className="h-9 w-[150px] text-sm" aria-label="From date" />
            <span className="text-muted-foreground">-</span>
            <Input type="date" value={filters.customTo} onChange={(event) => onPatch({ customTo: event.target.value })} className="h-9 w-[150px] text-sm" aria-label="To date" />
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <AlertMenu
            label="Saved views"
            align="end"
            width={200}
            trigger={
              <Button variant="outline" className="h-9 gap-1.5 rounded-lg px-3 text-[13px]">
                <ListFilter size={14} aria-hidden="true" />Saved Views<ChevronDown size={13} aria-hidden="true" className="text-muted-foreground" />
              </Button>
            }
            items={viewItems}
          />
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Reset all filters"
            >
              <RotateCcw size={13} aria-hidden="true" />Reset<span className="tabular-nums">({activeFilterCount})</span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleDensity}
            aria-pressed={density === "compact"}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={density === "default" ? "Switch to compact rows" : "Switch to comfortable rows"}
          >
            <ChevronsRight size={13} aria-hidden="true" />Compact
          </button>
        </div>
      </div>

      {/* Row 3 - active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2" aria-label="Active filters">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Active:</span>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              aria-label={`Remove filter ${chip.label}`}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 text-[12px] font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {chip.label}<X size={11} aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            onClick={onReset}
            className="rounded text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
