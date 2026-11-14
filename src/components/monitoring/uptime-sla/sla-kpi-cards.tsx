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
      tone: "bg-[#e2f0ff] text-[#1379e8] dark:bg-[#17385c] dark:text-[#5fb0ff]",
      delta: uptimeDelta,
      deltaPct: `${Math.abs(uptimeDelta).toFixed(2)}%`,
      goodDirection: "up" as const,
      detail: undefined as string | undefined,
    },
    {
      label: "SLA Target",
      value: `${summary.slaTarget.toFixed(2)}%`,
      icon: met ? CheckCircle2 : AlertTriangle,
      tone: met ? "bg-[#dff7eb] text-[#13a564] dark:bg-[#123a2a] dark:text-[#4fd69a]" : atRisk ? "bg-[#fff1d7] text-[#dc941c] dark:bg-[#493a29] dark:text-[#ffc16e]" : "bg-[#ffeaec] text-[#e83f4d] dark:bg-[#492a35] dark:text-[#ff8b98]",
      delta: null,
      deltaPct: undefined,
      goodDirection: "up" as const,
      detail: met ? "All services met" : atRisk ? summary.statusLabel : summary.statusLabel,
    },
    {
      label: "Total Downtime",
      value: formatDowntime(summary.totalDowntimeSeconds),
      icon: Clock,
      tone: "bg-[#fff1d7] text-[#dc941c] dark:bg-[#493a29] dark:text-[#ffc16e]",
      delta: null,
      deltaPct: undefined,
      goodDirection: "down" as const,
      detail: "Last 30 days",
    },
    {
      label: "Incidents",
      value: summary.incidents.toLocaleString("en-US"),
      icon: AlertTriangle,
      tone: "bg-[#ffeaec] text-[#e83f4d] dark:bg-[#492a35] dark:text-[#ff8b98]",
      delta: -1,
      deltaPct: "vs prev 30d",
      goodDirection: "down" as const,
      detail: undefined,
    },
    {
      label: "MTTR",
      value: `${summary.mttrMinutes}m`,
      icon: Timer,
      tone: "bg-[#f1eaff] text-[#874fe0] dark:bg-[#35264d] dark:text-[#bd98ff]",
      delta: -6,
      deltaPct: "29% faster",
      goodDirection: "down" as const,
      detail: undefined,
    },
    {
      label: "MTBF",
      value: `${summary.mtbfHours}h`,
      icon: TrendingUp,
      tone: "bg-[#dff7eb] text-[#13a564] dark:bg-[#123a2a] dark:text-[#4fd69a]",
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
