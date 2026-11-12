import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SLA_TYPE_BREAKDOWN } from "@/mocks/uptimeSla";

interface SlaByTypeProps {
  entries: typeof SLA_TYPE_BREAKDOWN;
  /** SLA target — types at/below it render as breached or at risk. */
  target: number;
  /** Click a row to filter the Service Uptime table (toggle by clicking again). */
  onSelectType?: (type: string) => void;
}

const STATUS_META = {
  met: { label: "Met", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  at_risk: { label: "At risk", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  breached: { label: "Breached", className: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
} as const;

/** Horizontal bars — flat `#3B82F6` Met / `#D97706` at-risk / `#DC2626` breached, SLA target marker, delta, summary strip and footer. */
export function SlaByType({ entries, target, onSelectType }: SlaByTypeProps) {
  const values = entries.map((entry) => entry.uptime);
  const min = Math.min(...values, target);
  const max = Math.max(...values, target);
  const span = Math.max(0.05, max - min);
  const floor = Math.floor((min - span * 0.15) * 100) / 100;
  const ceil = Math.ceil((max + span * 0.1) * 100) / 100;
  const toPct = (value: number) => ((value - floor) / Math.max(0.01, ceil - floor)) * 100;

  const metCount = entries.filter((entry) => entry.uptime >= target).length;
  const lowest = entries.length ? entries.reduce((worst, entry) => (entry.uptime < worst.uptime ? entry : worst), entries[0]) : null;
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 100;

  return (
    <div className="flex flex-1 flex-col justify-between gap-4">
      <ul className="flex flex-col gap-3 pt-1">
        {entries.map((entry) => {
          const status: "met" | "at_risk" | "breached" = entry.uptime >= target ? "met" : entry.uptime >= target - 0.02 ? "at_risk" : "breached";
          const barColor = status === "met" ? "bg-[#3B82F6]" : status === "at_risk" ? "bg-[#D97706]" : "bg-[#DC2626]";
          const badge = STATUS_META[status];
          const delta = Number((entry.uptime - target).toFixed(3));
          const deltaPrefix = delta >= 0 ? "+" : "";
          const deltaTone = delta >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400";
          const markerPct = toPct(target);
          return (
            <li key={entry.type}>
              <button
                type="button"
                onClick={() => onSelectType?.(entry.type)}
                aria-label={`${entry.type} uptime ${entry.uptime.toFixed(2)}%, ${status === "met" ? "met" : status} against SLA ${target}%. Click to filter Service Uptime table.`}
                title={`${entry.type} · uptime ${entry.uptime.toFixed(2)}% · downtime ${entry.downtimeMinutes}m · ${entry.incidents} incident${entry.incidents === 1 ? "" : "s"} · ${entry.services} service${entry.services === 1 ? "" : "s"}`}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-slate-800/60 sm:flex-nowrap sm:py-1"
              >
                <span className="min-w-[72px] text-[13px] font-medium text-foreground sm:w-[88px]">{entry.type}</span>
                <div className="relative order-5 h-2 w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#EEF0F4] dark:bg-slate-700" aria-hidden="true">
                    <span className={cn("block h-full rounded-full", barColor)} style={{ width: `${toPct(entry.uptime)}%` }} />
                  </div>
                  <span aria-hidden="true" className="absolute -top-0.5 h-3 w-[2px] -translate-x-1/2 bg-[#111827] dark:bg-slate-100" style={{ left: `${markerPct}%` }} />
                </div>
                <b className="w-14 text-right text-[13px] tabular-nums text-foreground sm:w-16">{entry.uptime.toFixed(2)}%</b>
                <span className={cn("w-14 text-right text-[11px] font-semibold tabular-nums sm:w-16", deltaTone)} title={`${deltaPrefix}${delta.toFixed(3)}% vs target ${target}%`}>{deltaPrefix}{delta.toFixed(2)}%</span>
                <span className={cn("justify-self-end rounded-full px-1.5 py-0.5 text-[11px] font-semibold", badge.className)}>{badge.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Summary strip */}
      <div className="mt-1 grid grid-cols-3 divide-x divide-border rounded-lg border border-border/70 bg-muted/30 py-2.5" aria-label="Compliance summary">
        {[
          { label: "Meeting SLA", value: `${metCount} / ${entries.length}` },
          { label: "Lowest", value: lowest ? `${lowest.type} ${lowest.uptime.toFixed(2)}%` : "—" },
          { label: "Average", value: `${average.toFixed(2)}%` },
        ].map((stat) => (
          <div key={stat.label} className="flex min-w-0 flex-col items-center gap-0.5 px-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{stat.label}</span>
            <b className="truncate text-[13px] tabular-nums text-foreground">{stat.value}</b>
          </div>
        ))}
      </div>

      {/* Footer pinned to bottom */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-[12px] text-muted-foreground">
        <span>Based on last 30 days · {entries.length} service types</span>
        <Link href="/database-monitoring" className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View details <ArrowRight size={12} aria-hidden="true" /></Link>
      </div>
    </div>
  );
}
