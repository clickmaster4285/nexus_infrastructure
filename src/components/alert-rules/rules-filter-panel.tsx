"use client";

import { Search, X } from "lucide-react";

import { MultiSelect, type MultiSelectOption } from "@/components/alert-rules/multi-select";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RULE_SEVERITIES, RULE_STATUSES, TARGET_TYPES, type RuleSeverity, type RuleStatus, type TargetType } from "@/mocks/alertRules";
import type { RuleTabKey } from "@/utils/ruleStats";
import { cn } from "@/lib/utils";

export type Density = "comfortable" | "compact";

export interface VisibleColumns {
  type: boolean;
  notifications: boolean;
  activity: boolean;
}

interface RulesFilterPanelProps {
  tab: RuleTabKey;
  onTabChange: (tab: RuleTabKey) => void;
  /** Count badges shown in the tabs. */
  tabCounts: Record<RuleTabKey, number>;
  query: string;
  onQueryChange: (query: string) => void;
  severity: RuleSeverity[];
  onSeverityChange: (severity: RuleSeverity[]) => void;
  statusSelection: RuleStatus[];
  onStatusChange: (status: RuleStatus[]) => void;
  targetTypes: TargetType[];
  onTargetTypeChange: (targetTypes: TargetType[]) => void;
  firedOnly: boolean;
  onFiredOnlyChange: (firedOnly: boolean) => void;
  columns: VisibleColumns;
  onColumnsChange: (columns: VisibleColumns) => void;
  density: Density;
  onDensityChange: (density: Density) => void;
  onClearAll: () => void;
}

const SEVERITY_OPTIONS: MultiSelectOption[] = RULE_SEVERITIES.map((severity) => ({
  value: severity,
  label: severity,
  dot: severity === "Critical" ? "#DC2626" : severity === "Warning" ? "#D97706" : "#3B82F6",
}));

const STATUS_OPTIONS: MultiSelectOption[] = RULE_STATUSES.map((status) => ({
  value: status,
  label: status,
  dot: status === "Enabled" ? "#16A34A" : status === "Muted" ? "#94A3B8" : "#64748B",
}));

const TARGET_OPTIONS: MultiSelectOption[] = TARGET_TYPES.map((type) => ({ value: type, label: type }));

const COLUMN_OPTIONS: MultiSelectOption[] = [
  { value: "type", label: "Type" },
  { value: "notifications", label: "Notifications" },
  { value: "activity", label: "Activity" },
];

const TAB_LABELS: Record<RuleTabKey, string> = { all: "All", threshold: "Threshold", anomaly: "Anomaly", composite: "Composite" };
const TAB_ORDER: RuleTabKey[] = ["all", "threshold", "anomaly", "composite"];

/** Tabs + filter bar merged into a single card (search left, controls right). */
export function RulesFilterPanel(props: RulesFilterPanelProps) {
  const { tab, onTabChange, tabCounts, query, onQueryChange, severity, onSeverityChange, statusSelection, onStatusChange, targetTypes, onTargetTypeChange, firedOnly, onFiredOnlyChange, columns, onColumnsChange, density, onDensityChange, onClearAll } = props;

  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [
    ...(query ? [{ key: "q", label: `"${query}"`, onRemove: () => onQueryChange("") }] : []),
    ...severity.map((value) => ({ key: `sev-${value}`, label: value, onRemove: () => onSeverityChange(severity.filter((item) => item !== value)) })),
    ...statusSelection.map((value) => ({ key: `st-${value}`, label: value, onRemove: () => onStatusChange(statusSelection.filter((item) => item !== value)) })),
    ...targetTypes.map((value) => ({ key: `tt-${value}`, label: value, onRemove: () => onTargetTypeChange(targetTypes.filter((item) => item !== value)) })),
    ...(firedOnly ? [{ key: "fired", label: "Fired in 24h", onRemove: () => onFiredOnlyChange(false) }] : []),
  ];

  return (
    <Card className="rounded-xl p-5">
      <Tabs value={tab} onValueChange={(value) => onTabChange(value as RuleTabKey)}>
        <TabsList className="flex-wrap gap-x-4" aria-label="Filter rules by status">
          {TAB_ORDER.map((key) => (
            <TabsTrigger key={key} value={key} className="gap-1.5 text-[0.8125rem]">
              {TAB_LABELS[key]}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold tabular-nums", tab === key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                {tabCounts[key]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-[11.25rem] sm:w-auto sm:max-w-[22.5rem] sm:flex-1 lg:min-w-[13.75rem]">
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search rules, metrics, targets…"
            aria-label="Search rules"
            className="h-9 w-full rounded-lg border border-input bg-card pl-8 pr-3 text-[0.8125rem] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <MultiSelect label="Severity" options={SEVERITY_OPTIONS} selected={severity} onChange={(values) => onSeverityChange(values as RuleSeverity[])} />
        <MultiSelect label="Status" options={STATUS_OPTIONS} selected={statusSelection} onChange={(values) => onStatusChange(values as RuleStatus[])} />
        <MultiSelect label="Target type" options={TARGET_OPTIONS} selected={targetTypes} onChange={(values) => onTargetTypeChange(values as TargetType[])} />

        <div className="ml-auto flex items-center gap-2">
          <MultiSelect
            label="Columns"
            options={COLUMN_OPTIONS}
            selected={COLUMN_OPTIONS.filter((option) => columns[option.value as keyof VisibleColumns]).map((option) => option.value)}
            onChange={(values) => onColumnsChange({ type: values.includes("type"), notifications: values.includes("notifications"), activity: values.includes("activity") })}
            width={150}
          />
          <div className="flex h-9 items-center rounded-lg border border-border p-0.5" role="group" aria-label="Table density">
            {(["comfortable", "compact"] as Density[]).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={density === mode}
                onClick={() => onDensityChange(mode)}
                className={cn(
                  "h-8 rounded-md px-2.5 text-[0.75rem] font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  density === mode ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-3" aria-label="Active filters">
          {chips.map((chip) => (
            <span key={chip.key} className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-muted px-2 text-[0.75rem] font-medium text-foreground">
              {chip.label}
              <button type="button" onClick={chip.onRemove} aria-label={`Remove filter ${chip.label}`} className="rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          ))}
          <button type="button" onClick={onClearAll} className="ml-1 text-[0.75rem] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
            Clear all
          </button>
        </div>
      )}
    </Card>
  );
}
