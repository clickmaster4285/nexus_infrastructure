"use client";

import { ArrowDown, ArrowUp, CheckCircle2, Layers, ListChecks, PauseCircle, Timer, XCircle } from "lucide-react";

import { StatCard } from "@/components/ui/StatCard";
import { Sparkline } from "@/components/shared/sparkline";
import { cn } from "@/lib/utils";
import type { TaskStats } from "@/utils/taskStats";

export type KpiKey = "total" | "active" | "paused" | "running" | "failed" | "success";

interface TasksKpiRowProps {
  stats: TaskStats;
  /** Which KPI card is currently driving the table filter (blue border). */
  activeKpi: KpiKey | null;
  onKpiClick: (key: KpiKey) => void;
}

/** MW-style delta line: arrow + signed number + muted trailing hint. */
function trendNode(delta: number, label: string) {
  const positive = delta >= 0;
  return (
    <>
      {positive ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
      {`${positive ? "+" : ""}${delta} `}<span className="font-normal text-muted-foreground">{label}</span>
    </>
  );
}

const ACTIVE_BORDER = "border-primary ring-1 ring-primary";
const MUTED_HINT = "inline-block text-[12px] font-normal text-muted-foreground";

/** Six KPI cards, MW density: 88px, icon left, label / value / hint stacked. */
export function TasksKpiRow({ stats, activeKpi, onKpiClick }: TasksKpiRowProps) {
  const successRate = stats.successRate7d;
  const failedHint = `${stats.tabCounts.failed} task${stats.tabCounts.failed === 1 ? "" : "s"} · ${stats.failed24h} run${stats.failed24h === 1 ? "" : "s"}`;

  const cards: Array<{
    key: KpiKey;
    label: string;
    value: string;
    icon: typeof Layers;
    tone: string;
    trend?: React.ReactNode;
    trendClassName?: string;
    goodDirection: "up" | "down";
    hint?: string;
    aside?: React.ReactNode;
    clickLabel: string;
  }> = [
    {
      key: "total", label: "Total Tasks", value: String(stats.total), icon: Layers,
      tone: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      trend: trendNode(stats.totalDelta, "vs last week"), trendClassName: "text-emerald-600 dark:text-emerald-400",
      goodDirection: "up", clickLabel: "Show all tasks",
    },
    {
      key: "active", label: "Active", value: String(stats.active), icon: ListChecks,
      tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
      hint: "enabled & scheduled", goodDirection: "up", clickLabel: "Filter table to active tasks",
    },
    {
      key: "paused", label: "Paused", value: String(stats.paused), icon: PauseCircle,
      tone: "bg-slate-200/70 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300",
      hint: "no runs while paused", goodDirection: "down", clickLabel: "Filter table to paused tasks",
    },
    {
      key: "running", label: "Running Now", value: String(stats.runningNow), icon: Timer,
      tone: "bg-[#e2f0ff] text-[#1379e8] dark:bg-[#17385c] dark:text-[#5fb0ff]",
      hint: "in progress right now", goodDirection: "up", clickLabel: "Filter table to running tasks",
    },
    {
      key: "failed", label: "Failed (24h)", value: String(stats.failed24h), icon: XCircle,
      tone: "bg-[#ffeaec] text-[#DC2626] dark:bg-[#492a35] dark:text-[#ff8b98]",
      trend: trendNode(stats.failedDelta, failedHint),
      trendClassName: stats.failedDelta <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
      goodDirection: "down", clickLabel: "Filter table to tasks whose last run failed",
    },
    {
      key: "success", label: "Success Rate (7d)", value: successRate == null ? "—" : `${successRate}%`, icon: CheckCircle2,
      tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
      trend: stats.successRateDelta == null ? <span className={MUTED_HINT}>vs prev 7d</span> : trendNode(stats.successRateDelta, "pts vs prev 7d"),
      trendClassName: (stats.successRateDelta ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
      goodDirection: "up",
      aside: <Sparkline values={stats.successSparkline} color="#16A34A" label="Success rate, last 14 days" />,
      clickLabel: "Show tasks that failed in the last 7 days",
    },
  ];

  return (
    <section aria-label="Scheduled tasks key performance indicators" className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const isActive = activeKpi === card.key;
        return (
          <StatCard
            key={card.key}
            icon={<card.icon size={18} aria-hidden="true" />}
            iconTone={card.tone}
            label={card.label}
            value={card.value}
            trend={card.trend}
            trendClassName={card.trendClassName}
            goodDirection={card.goodDirection}
            valueAside={card.aside}
            detail={card.trend == null && card.hint ? <span className={MUTED_HINT}>{card.hint}</span> : undefined}
            className={cn("h-full min-h-[88px] p-3", isActive && ACTIVE_BORDER)}
            labelClassName="text-xs font-medium text-muted-foreground"
            valueClassName="text-2xl font-semibold"
            onClick={() => onKpiClick(card.key)}
            onClickLabel={card.clickLabel}
          />
        );
      })}
    </section>
  );
}
