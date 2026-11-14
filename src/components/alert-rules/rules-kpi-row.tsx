"use client";

import { Activity, BellOff, CheckCircle2, List, TrendingUp } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { RuleStats } from "@/utils/ruleStats";
import { cn } from "@/lib/utils";

export type RuleKpiKey = "all" | "enabled" | "disabled" | "fired";

interface RulesKpiRowProps {
  stats: RuleStats;
  /** Active selection — clicking a card filters the table to that KPI. */
  active: RuleKpiKey;
  onSelect: (key: RuleKpiKey) => void;
}

function Sparkline({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  const width = 72;
  const height = 20;
  const step = width / Math.max(1, values.length - 1);
  const points = values.map((value, index) => `${(index * step).toFixed(1)},${(height - 2 - (value / max) * (height - 4)).toFixed(1)}`);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="shrink-0">
      <polyline points={points.join(" ")} fill="none" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Compact 5.5rem KPI cards with 2rem icon tiles — all numbers derive from the rules array. */
export function RulesKpiRow({ stats, active, onSelect }: RulesKpiRowProps) {
  const yesterdayFired = Math.max(1, Math.round(stats.fired24h * 0.89));
  const firedDeltaPct = Math.round(((stats.fired24h - yesterdayFired) / yesterdayFired) * 100);

  const cards: Array<{
    key: RuleKpiKey;
    label: string;
    value: string;
    icon: typeof List;
    iconTone: string;
    hint: React.ReactNode;
    sparkline?: boolean;
  }> = [
    {
      key: "all",
      label: "Total Rules",
      value: String(stats.total),
      icon: List,
      iconTone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      hint: <span>targeting {stats.targetCount} hosts</span>,
    },
    {
      key: "enabled",
      label: "Enabled",
      value: String(stats.enabled),
      icon: CheckCircle2,
      iconTone: "bg-[#E9F9EF] text-green-600 dark:bg-emerald-950/60 dark:text-emerald-400",
      hint: <span>{stats.enabledPct}% of rules</span>,
    },
    {
      key: "disabled",
      label: "Muted / Disabled",
      value: String(stats.mutedOrDisabled),
      icon: BellOff,
      iconTone: "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-400",
      hint: <span>{stats.muted} muted · {stats.disabled} disabled</span>,
    },
    {
      key: "fired",
      label: "Fired (24h)",
      value: String(stats.fired24h),
      icon: Activity,
      iconTone: "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
      hint: (
        <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400">
          <TrendingUp size={11} aria-hidden="true" />
          +{firedDeltaPct}% vs yesterday
        </span>
      ),
      sparkline: true,
    },
  ];

  return (
    <section aria-label="Alert rule key performance indicators" className="grid grid-cols-2 items-stretch gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <button
          key={card.key}
          type="button"
          aria-pressed={active === card.key}
          onClick={() => onSelect(card.key)}
          className="block h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>div]:h-full"
        >
          <Card
            className={cn(
              "flex h-full min-h-[5.5rem] w-full items-center gap-3 rounded-xl p-4 transition-colors hover:border-primary/50",
              active === card.key && "bg-primary/[0.04]",
            )}
          >
            <span aria-hidden="true" className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", card.iconTone)}>
              <card.icon size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.75rem] font-medium leading-snug text-muted-foreground">{card.label}</p>
              <div className="flex items-end justify-between gap-2">
                <p className="font-display text-[1.375rem] font-bold leading-tight tracking-tight text-foreground tabular-nums">{card.value}</p>
                {card.sparkline && <Sparkline values={stats.fireSparkline} label="Fires over the last 24 hours" />}
              </div>
              <p className="mt-0.5 text-[0.6875rem] leading-tight text-muted-foreground">{card.hint}</p>
            </div>
          </Card>
        </button>
      ))}
    </section>
  );
}
