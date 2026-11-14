"use client";

import { RotateCcw, Search } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AlertSeverity } from "@/mocks/alerts";
import type { AlertRangeKey } from "@/mocks/useAlerts";

interface AlertsFiltersProps {
  query: string;
  onQueryChange: (query: string) => void;
  severity: AlertSeverity[];
  onSeverityChange: (severity: AlertSeverity[]) => void;
  host: string;
  hosts: string[];
  onHostChange: (host: string) => void;
  range: AlertRangeKey;
  onRangeChange: (range: AlertRangeKey) => void;
  resultCount: number;
}

const RANGE_TEXT: Record<AlertRangeKey, string> = { "1h": "Last 1 hour", "6h": "Last 6 hours", "24h": "Last 24 hours", "7d": "Last 7 days" };

const SEVERITY_CHIPS: Array<{ key: AlertSeverity; label: string; className: string }> = [
  { key: "critical", label: "Critical", className: "bg-red-600/10 text-red-600 border-red-600/30 dark:bg-red-500/15 dark:text-red-400" },
  { key: "warning", label: "Warning", className: "bg-amber-600/10 text-amber-600 border-amber-600/30 dark:bg-amber-500/15 dark:text-amber-400" },
  { key: "info", label: "Info", className: "bg-blue-500/10 text-blue-500 border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-400" },
];

const RANGE_ORDER: AlertRangeKey[] = ["1h", "6h", "24h", "7d"];

function hasActiveFilters({ query, severity, host, range }: AlertsFiltersProps): boolean {
  return query !== "" || severity.length > 0 || host !== "all" || range !== "7d";
}

/** Search + severity multi-select chips + host + time range + clear. */
export function AlertsFilters(props: AlertsFiltersProps) {
  const { query, onQueryChange, severity, onSeverityChange, host, hosts, onHostChange, range, onRangeChange, resultCount } = props;

  const toggleSeverity = (key: AlertSeverity) => {
    onSeverityChange(severity.includes(key) ? severity.filter((value) => value !== key) : [...severity, key]);
  };

  return (
    <section aria-label="Alert filters" className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
      <div className="relative min-w-[11.25rem] flex-1 sm:max-w-[16.25rem]">
        <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search alerts, hosts, rules…"
          aria-label="Search alerts"
          className="h-9 w-full rounded-lg border border-input bg-card pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex items-center gap-1.5" role="group" aria-label="Filter by severity">
        {SEVERITY_CHIPS.map((chip) => {
          const active = severity.includes(chip.key);
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={active}
              onClick={() => toggleSeverity(chip.key)}
              className={cn(
                "h-9 rounded-lg border px-3 text-[0.8125rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? chip.className : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <Select value={host} onValueChange={onHostChange}>
        <SelectTrigger aria-label="Filter by host" className="h-9 min-w-[9.375rem] rounded-lg text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All hosts</SelectItem>
          {hosts.map((name) => (
            <SelectItem key={name} value={name}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={range} onValueChange={(value) => onRangeChange(value as AlertRangeKey)}>
        <SelectTrigger aria-label="Time range" className="h-9 min-w-[8.75rem] rounded-lg text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGE_ORDER.map((option) => (
            <SelectItem key={option} value={option}>{RANGE_TEXT[option]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="ml-auto hidden text-[0.75rem] text-muted-foreground lg:inline" aria-live="polite">
        {resultCount} {resultCount === 1 ? "alert" : "alerts"}
      </span>

      <button
        type="button"
        onClick={() => {
          onQueryChange("");
          onSeverityChange([]);
          onHostChange("all");
          onRangeChange("7d");
        }}
        disabled={!hasActiveFilters(props)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[0.8125rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          hasActiveFilters(props) ? "text-muted-foreground hover:bg-accent hover:text-foreground" : "cursor-not-allowed opacity-40",
        )}
      >
        <RotateCcw size={13} aria-hidden="true" />
        Clear filters
      </button>
    </section>
  );
}
