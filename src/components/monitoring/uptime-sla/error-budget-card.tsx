import { Flame, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BudgetStats } from "@/lib/slaCalculations";
import { formatBudget } from "@/lib/slaCalculations";

interface ErrorBudgetCardProps {
  budget: BudgetStats;
}

/** Donut + burn rate rows. All numbers derived from the same incident-based downtime. */
export function ErrorBudgetCard({ budget }: ErrorBudgetCardProps) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const remaining = Math.max(0, Math.min(100, budget.remainingPct));
  const dashOffset = circumference * (1 - remaining / 100);
  const tone = remaining > 50 ? "#16A34A" : remaining > 15 ? "#D97706" : "#DC2626";
  const burnTone = budget.burnRate <= 1 ? "text-emerald-700 dark:text-emerald-400" : budget.burnRate <= 2 ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300";

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative grid h-[8.125rem] w-[8.125rem] shrink-0 place-items-center">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`Error budget remaining ${remaining.toFixed(1)} percent`}>
            <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--muted)" strokeWidth="9" />
            <circle cx="50" cy="50" r={radius} fill="none" stroke={tone} strokeWidth="9" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <b className="font-display text-[1.25rem] font-extrabold leading-none tabular-nums text-foreground">{remaining.toFixed(1)}%</b>
            <span className="mt-0.5 text-[0.75rem] font-medium text-muted-foreground">Remaining</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 divide-y divide-border/60">
          {[
            { label: "Burn rate", value: `${budget.burnRate.toFixed(1)}x`, valueClass: burnTone },
            { label: "Used", value: `${formatBudget(budget.usedMinutes)} of ${formatBudget(budget.totalMinutes)}`, valueClass: "text-foreground" },
            { label: "Exhaustion", value: budget.exhaustionDays == null || budget.exhaustionDays >= 365 ? "Within budget" : `~${budget.exhaustionDays} days`, valueClass: "text-foreground" },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-[0.8125rem] text-muted-foreground">{row.label}</span>
              <b className={cn("text-[0.8125rem] tabular-nums", row.valueClass)}>{row.value}</b>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-auto flex items-center gap-1.5 border-t border-border/60 pt-2 text-[0.75rem] text-muted-foreground" title="Error budget is the downtime your SLA allows. Burn rate above 1× means budget is being consumed faster than the window allows.">
        <Info size={13} aria-hidden="true" className="shrink-0" />
        <span className="truncate">Burn rate above 1× means budget is being consumed faster than the window allows.</span>
      </div>
    </div>
  );
}

export function SlaTargetBadge({ target }: { target: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[0.75rem] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
      <Flame size={12} aria-hidden="true" />{target.toFixed(2)}% target
    </span>
  );
}
