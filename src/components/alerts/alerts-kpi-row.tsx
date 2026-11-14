"use client";

import { AlertTriangle, Bell, CheckCircle2, Clock3, Zap } from "lucide-react";

import { StatCard } from "@/components/ui/StatCard";
import { cn } from "@/lib/utils";
import type { AlertKpiKey, AlertStats } from "@/utils/alertStats";

const SEVERITY_COLORS = { critical: "oklch(0.5771 0.2152 27.33)", warning: "oklch(0.6658 0.1574 58.32)", info: "oklch(0.6231 0.188 259.81)", resolved: "oklch(0.6271 0.1699 149.21)" } as const;

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
      tone: "bg-[oklch(0.9492_0.0252_249.95)] text-[oklch(0.5854_0.1886_255.66)] dark:bg-[oklch(0.3358_0.0746_252.64)] dark:text-[oklch(0.7396_0.14_249.73)]",
      delta: stats.active - stats.activePrev, deltaPercent: deltaPercent(stats.active, stats.activePrev), goodDirection: "down", sparkColor: "oklch(0.5854 0.1886 255.66)",
    },
    {
      key: "critical", label: "Critical", value: String(stats.critical), icon: AlertTriangle,
      tone: "bg-[oklch(0.9544_0.023_10.96)] text-red-600 dark:bg-[oklch(0.328_0.0487_357.32)] dark:text-[oklch(0.7663_0.1406_13.84)]",
      delta: stats.critical - stats.criticalPrev, deltaPercent: deltaPercent(stats.critical, stats.criticalPrev), goodDirection: "down", sparkColor: SEVERITY_COLORS.critical,
    },
    {
      key: "warning", label: "Warning", value: String(stats.warning), icon: AlertTriangle,
      tone: "bg-[oklch(0.9624_0.0373_83.03)] text-amber-600 dark:bg-[oklch(0.3598_0.0347_69.88)] dark:text-[oklch(0.8508_0.123_72.9)]",
      delta: stats.warning - stats.warningPrev, deltaPercent: deltaPercent(stats.warning, stats.warningPrev), goodDirection: "down", sparkColor: SEVERITY_COLORS.warning,
    },
    {
      key: "unacknowledged", label: "Unacknowledged", value: String(stats.unacknowledged), icon: Zap,
      tone: "bg-[oklch(0.9487_0.0289_301)] text-[oklch(0.5675_0.2098_296.93)] dark:bg-[oklch(0.306_0.07_300.04)] dark:text-[oklch(0.7536_0.1483_299.39)]",
      delta: stats.unacknowledged - stats.unacknowledgedPrev, deltaPercent: deltaPercent(stats.unacknowledged, stats.unacknowledgedPrev), goodDirection: "down", sparkColor: "oklch(0.5675 0.2098 296.93)",
    },
    {
      key: "mtta", label: "MTTA", value: stats.mttaMinutes == null ? "—" : `${stats.mttaMinutes}m`, icon: Clock3,
      tone: "bg-[oklch(0.9492_0.0252_249.95)] text-[oklch(0.5854_0.1886_255.66)] dark:bg-[oklch(0.3358_0.0746_252.64)] dark:text-[oklch(0.7396_0.14_249.73)]",
      delta: mttaDelta, deltaPercent: stats.mttaPrevMinutes && mttaDelta != null ? deltaPercent(stats.mttaMinutes ?? 0, stats.mttaPrevMinutes) : "", goodDirection: "down", sparkColor: "oklch(0.5854 0.1886 255.66)",
    },
    {
      key: "resolved", label: "Resolved (24h)", value: String(stats.resolved24h), icon: CheckCircle2,
      tone: "bg-[oklch(0.9553_0.0297_164.3)] text-green-600 dark:bg-[oklch(0.3149_0.0537_163.8)] dark:text-[oklch(0.7869_0.1465_160.69)]",
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
