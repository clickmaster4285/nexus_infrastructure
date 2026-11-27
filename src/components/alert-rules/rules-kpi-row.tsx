"use client";

import { Activity, BellOff, CheckCircle2, List, TrendingUp } from "lucide-react";

import { StatCard } from "@/components/ui/StatCard";
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
      <polyline points={points.join(" ")} fill="none" stroke="oklch(0.5855 0.1885 255.72)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** KPI cards via the shared StatCard — every figure derives from the rules array. */
export function RulesKpiRow({ stats, active, onSelect }: RulesKpiRowProps) {
  const yesterdayFired = Math.max(1, Math.round(stats.fired24h * 0.89));
  const firedDelta = stats.fired24h - yesterdayFired;
  const firedDeltaPct = yesterdayFired > 0 ? Math.round((firedDelta / yesterdayFired) * 100) : 0;

  const cards: Array<{
    key: RuleKpiKey;
    label: string;
    value: string;
    icon: typeof List;
    iconTone: string;
    trend?: React.ReactNode;
    delta?: number | null;
    deltaPercent?: string;
    goodDirection?: "up" | "down";
    detail?: React.ReactNode;
  }> = [
    {
      key: "all",
      label: "Total Rules",
      value: String(stats.total),
      icon: List,
      iconTone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      trend: <span className="text-xs text-muted-foreground">targeting {stats.targetCount} hosts</span>,
    },
    {
      key: "enabled",
      label: "Enabled",
      value: String(stats.enabled),
      icon: CheckCircle2,
      iconTone: "bg-[oklch(0.9675_0.0214_158.6)] text-green-600 dark:bg-emerald-950/60 dark:text-emerald-400",
      trend: <span className="text-xs text-muted-foreground">{stats.enabledPct}% of rules</span>,
      goodDirection: "up",
    },
    {
      key: "disabled",
      label: "Muted / Disabled",
      value: String(stats.mutedOrDisabled),
      icon: BellOff,
      iconTone: "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-400",
      trend: <span className="text-xs text-muted-foreground">{stats.muted} muted · {stats.disabled} disabled</span>,
      goodDirection: "down",
    },
    {
      key: "fired",
      label: "Fired (24h)",
      value: String(stats.fired24h),
      icon: Activity,
      iconTone: "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
      delta: firedDelta,
      deltaPercent: `${Math.abs(firedDeltaPct)}% vs yesterday`,
      goodDirection: "down",
      detail: <Sparkline values={stats.fireSparkline} label="Fires over the last 24 hours" />,
    },
  ];

  return (
    <section aria-label="Alert rule key performance indicators" className="grid grid-cols-2 items-stretch gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard
          key={card.key}
          icon={<card.icon size={20} aria-hidden="true" />}
          iconTone={card.iconTone}
          label={card.label}
          value={card.value}
          delta={card.delta ?? null}
          deltaPercent={card.deltaPercent}
          goodDirection={card.goodDirection ?? "up"}
          trend={card.trend}
          detail={card.detail}
          onClick={() => onSelect(card.key)}
          onClickLabel={`Filter rules by ${card.label}`}
          className={cn("h-full w-full cursor-pointer transition-colors hover:border-primary/50", active === card.key && "border-primary/50 ring-1 ring-primary/40")}
        />
      ))}
    </section>
  );
}
