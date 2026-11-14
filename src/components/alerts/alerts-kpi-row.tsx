"use client";

import { AlertTriangle, Bell, CheckCircle2, Clock3, Zap } from "lucide-react";

import { StatCard } from "@/components/ui/StatCard";
import { cn } from "@/lib/utils";
import type { AlertKpiKey, AlertStats } from "@/utils/alertStats";

const SEVERITY_COLORS = { critical: "#DC2626", warning: "#D97706", info: "#3B82F6", resolved: "#16A34A" } as const;

interface AlertsKpiRowProps {
  stats: AlertStats;
  /** Clicking a card filters the table by that KPI. */
  onKpiClick: (key: AlertKpiKey) => void;
}

function Sparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
  const max = Math.max(1, ...values);
  const width = 64;
  const height = 18;
  const step = width / Math.max(1, values.length - 1);
  const points = values.map((value, index) => `${(index * step).toFixed(1)},${(height - 2 - (value / max) * (height - 4)).toFixed(1)}`);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="mt-1 block">
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function deltaPercent(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "0%" : "new";
  return `${Math.round((Math.abs(current - previous) / previous) * 100)}%`;
}

/** Six KPI cards; every figure comes from deriveAlertStats (single alerts array). */
export function AlertsKpiRow({ stats, onKpiClick }: AlertsKpiRowProps) {
  const mttaDelta = stats.mttaMinutes != null && stats.mttaPrevMinutes != null ? stats.mttaMinutes - stats.mttaPrevMinutes : null;
  const cards: Array<{
    key: AlertKpiKey;
    label: string;
    value: string;
    icon: typeof Bell;
    tone: string;
    delta: number | null;
    deltaPercent: string;
    goodDirection: "up" | "down";
    sparkColor: string;
  }> = [
    {
      key: "active", label: "Active Alerts", value: String(stats.active), icon: Bell,
      tone: "bg-[#e2f0ff] text-[#1379e8] dark:bg-[#17385c] dark:text-[#5fb0ff]",
      delta: stats.active - stats.activePrev, deltaPercent: deltaPercent(stats.active, stats.activePrev), goodDirection: "down", sparkColor: "#1379e8",
    },
    {
      key: "critical", label: "Critical", value: String(stats.critical), icon: AlertTriangle,
      tone: "bg-[#ffeaec] text-red-600 dark:bg-[#492a35] dark:text-[#ff8b98]",
      delta: stats.critical - stats.criticalPrev, deltaPercent: deltaPercent(stats.critical, stats.criticalPrev), goodDirection: "down", sparkColor: SEVERITY_COLORS.critical,
    },
    {
      key: "warning", label: "Warning", value: String(stats.warning), icon: AlertTriangle,
      tone: "bg-[#fff1d7] text-amber-600 dark:bg-[#493a29] dark:text-[#ffc16e]",
      delta: stats.warning - stats.warningPrev, deltaPercent: deltaPercent(stats.warning, stats.warningPrev), goodDirection: "down", sparkColor: SEVERITY_COLORS.warning,
    },
    {
      key: "unacknowledged", label: "Unacknowledged", value: String(stats.unacknowledged), icon: Zap,
      tone: "bg-[#f1eaff] text-[#874fe0] dark:bg-[#35264d] dark:text-[#bd98ff]",
      delta: stats.unacknowledged - stats.unacknowledgedPrev, deltaPercent: deltaPercent(stats.unacknowledged, stats.unacknowledgedPrev), goodDirection: "down", sparkColor: "#874fe0",
    },
    {
      key: "mtta", label: "MTTA", value: stats.mttaMinutes == null ? "—" : `${stats.mttaMinutes}m`, icon: Clock3,
      tone: "bg-[#e2f0ff] text-[#1379e8] dark:bg-[#17385c] dark:text-[#5fb0ff]",
      delta: mttaDelta, deltaPercent: stats.mttaPrevMinutes && mttaDelta != null ? deltaPercent(stats.mttaMinutes ?? 0, stats.mttaPrevMinutes) : "", goodDirection: "down", sparkColor: "#1379e8",
    },
    {
      key: "resolved", label: "Resolved (24h)", value: String(stats.resolved24h), icon: CheckCircle2,
      tone: "bg-[#dff7eb] text-green-600 dark:bg-[#123a2a] dark:text-[#4fd69a]",
      delta: stats.resolved24h - stats.resolvedPrev24h, deltaPercent: deltaPercent(stats.resolved24h, stats.resolvedPrev24h), goodDirection: "up", sparkColor: SEVERITY_COLORS.resolved,
    },
  ];

  return (
    <section aria-label="Alerts key performance indicators" className="grid grid-cols-2 items-stretch gap-4 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <button
          key={card.key}
          type="button"
          onClick={() => onKpiClick(card.key)}
          aria-label={`Filter alerts by ${card.label}`}
          className="block h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>div]:h-full"
        >
          <StatCard
            icon={<card.icon size={20} aria-hidden="true" />}
            iconTone={card.tone}
            label={card.label}
            value={card.value}
            delta={card.deltaPercent ? card.delta : null}
            deltaPercent={card.deltaPercent}
            goodDirection={card.goodDirection}
            detail={<Sparkline values={stats.sparklines[card.key]} color={card.sparkColor} label={`${card.label} trend, last 24 hours`} />}
            className={cn("h-full w-full cursor-pointer transition-colors hover:border-primary/50")}
          />
        </button>
      ))}
    </section>
  );
}

export { SEVERITY_COLORS };
