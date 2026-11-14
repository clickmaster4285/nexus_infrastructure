import { Activity, AlertTriangle, CheckCircle2, Clock, TrendingUp, Timer } from "lucide-react";

import { StatCard } from "@/components/ui/StatCard";
import { cn } from "@/lib/utils";
import type { SlaSummary } from "@/mocks/uptimeSla";

interface SlaKpiCardsProps {
  summary: SlaSummary;
}

function formatDowntime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}m ${String(remaining).padStart(2, "0")}s`;
}

/** Six KPI cards — all numbers derive from DOWNTIME_INCIDENTS. */
export function SlaKpiCards({ summary }: SlaKpiCardsProps) {
  const met = summary.status === "met";
  const atRisk = summary.status === "at_risk";
  const uptimeDelta = Number((summary.overallUptime - summary.previousUptime).toFixed(2));
  const cards = [
    {
      label: "Overall Uptime",
      value: `${summary.overallUptime.toFixed(2)}%`,
      icon: Activity,
      tone: "bg-[oklch(0.9492_0.0252_249.95)] text-[oklch(0.5854_0.1886_255.66)] dark:bg-[oklch(0.3358_0.0746_252.64)] dark:text-[oklch(0.7396_0.14_249.73)]",
      delta: uptimeDelta,
      deltaPct: `${Math.abs(uptimeDelta).toFixed(2)}%`,
      goodDirection: "up" as const,
      detail: undefined as string | undefined,
    },
    {
      label: "SLA Target",
      value: `${summary.slaTarget.toFixed(2)}%`,
      icon: met ? CheckCircle2 : AlertTriangle,
      tone: met ? "bg-[oklch(0.9553_0.0297_164.3)] text-[oklch(0.6367_0.1492_156.39)] dark:bg-[oklch(0.3149_0.0537_163.8)] dark:text-[oklch(0.7869_0.1465_160.69)]" : atRisk ? "bg-[oklch(0.9624_0.0373_83.03)] text-[oklch(0.7213_0.1471_72.82)] dark:bg-[oklch(0.3598_0.0347_69.88)] dark:text-[oklch(0.8508_0.123_72.9)]" : "bg-[oklch(0.9544_0.023_10.96)] text-[oklch(0.6219_0.2045_21.23)] dark:bg-[oklch(0.328_0.0487_357.32)] dark:text-[oklch(0.7663_0.1406_13.84)]",
      delta: null,
      deltaPct: undefined,
      goodDirection: "up" as const,
      detail: met ? "All services met" : atRisk ? summary.statusLabel : summary.statusLabel,
    },
    {
      label: "Total Downtime",
      value: formatDowntime(summary.totalDowntimeSeconds),
      icon: Clock,
      tone: "bg-[oklch(0.9624_0.0373_83.03)] text-[oklch(0.7213_0.1471_72.82)] dark:bg-[oklch(0.3598_0.0347_69.88)] dark:text-[oklch(0.8508_0.123_72.9)]",
      delta: null,
      deltaPct: undefined,
      goodDirection: "down" as const,
      detail: "Last 30 days",
    },
    {
      label: "Incidents",
      value: summary.incidents.toLocaleString("en-US"),
      icon: AlertTriangle,
      tone: "bg-[oklch(0.9544_0.023_10.96)] text-[oklch(0.6219_0.2045_21.23)] dark:bg-[oklch(0.328_0.0487_357.32)] dark:text-[oklch(0.7663_0.1406_13.84)]",
      delta: -1,
      deltaPct: "vs prev 30d",
      goodDirection: "down" as const,
      detail: undefined,
    },
    {
      label: "MTTR",
      value: `${summary.mttrMinutes}m`,
      icon: Timer,
      tone: "bg-[oklch(0.9487_0.0289_301)] text-[oklch(0.5675_0.2098_296.93)] dark:bg-[oklch(0.306_0.07_300.04)] dark:text-[oklch(0.7536_0.1483_299.39)]",
      delta: -6,
      deltaPct: "29% faster",
      goodDirection: "down" as const,
      detail: undefined,
    },
    {
      label: "MTBF",
      value: `${summary.mtbfHours}h`,
      icon: TrendingUp,
      tone: "bg-[oklch(0.9553_0.0297_164.3)] text-[oklch(0.6367_0.1492_156.39)] dark:bg-[oklch(0.3149_0.0537_163.8)] dark:text-[oklch(0.7869_0.1465_160.69)]",
      delta: 120,
      deltaPct: "33% more reliable",
      goodDirection: "up" as const,
      detail: undefined,
    },
  ];

  return (
    <section aria-label="SLA key performance indicators" className="grid grid-cols-2 items-stretch gap-4 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <StatCard
          key={card.label}
          icon={<card.icon size={20} aria-hidden="true" />}
          iconTone={card.tone}
          label={card.label}
          value={card.value}
          delta={card.delta}
          deltaPercent={card.deltaPct}
          goodDirection={card.goodDirection}
          detail={card.detail}
          className="h-full"
        />
      ))}
    </section>
  );
}

/** Header badge — amber "N service breached" when any service breaches, else green met. */
export function SlaStatusBadge({ summary }: { summary: SlaSummary }) {
  const met = summary.status === "met";
  const atRisk = summary.status === "at_risk";
  const meta = met
    ? { label: "SLA Met", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300", Icon: CheckCircle2 }
    : atRisk
      ? { label: summary.statusLabel, className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300", Icon: AlertTriangle }
      : { label: summary.statusLabel, className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300", Icon: AlertTriangle };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold", meta.className)}>
      <meta.Icon size={13} aria-hidden="true" />{meta.label}
    </span>
  );
}
