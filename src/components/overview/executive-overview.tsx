import { PageHeader } from "@/components/layout/page-header";
import { AvailabilityPanel, HealthTrendPanel, NetworkTrafficPanel, StoragePanel, UsagePanel } from "@/components/shared/chart-panels";
import { DonutPanel } from "@/components/shared/donut-panel";
import { MetricCard } from "@/components/shared/metric-card";
import { SummaryServerTable } from "@/components/shared/summary-server-table";
import { cn } from "@/lib/utils";
import {
  alertSeverity,
  backupServers,
  cpuServers,
  incidentStatus,
  latency,
  memoryServers,
  stats,
} from "@/data/mock/dashboard";
import { Wrench, ArrowRight } from "lucide-react";
import { activeMaintenanceWindows, serversInMaintenance } from "@/mocks/maintenanceWindows";

const PANEL = cn(
  "min-w-0 p-4!",
  "[&>div:first-child]:mb-1 [&>div:first-child]:min-h-8",
  "[&>div:last-child]:text-xs",
  "[&_.font-display.text-sm]:text-[16px]! [&_.font-display.text-sm]:font-semibold! [&_.font-display.text-sm]:leading-[1.25]",
  "[&_.recharts-cartesian-axis-tick-value]:text-[12px]!",
  "[&_.executive-overview-donut]:h-[168px] [&_.executive-overview-donut]:min-h-0",
  "[&_.executive-overview-donut-legend]:gap-2.5 [&_.executive-overview-donut-legend]:text-xs",
  "[&_.executive-overview-donut-legend-row]:text-xs",
  "[&_.executive-overview-availability-row]:grid-cols-[minmax(100px,1fr)_42px_minmax(90px,1.2fr)] [&_.executive-overview-availability-row]:min-h-[25px] [&_.executive-overview-availability-row]:text-xs",
  "[&_.executive-overview-trend]:text-[12px]!",
  "[&_table]:table-fixed",
  "[&_th]:px-2 [&_th]:py-2 [&_th]:text-[12px]! [&_th]:leading-[1.2]",
  "[&_td]:px-2 [&_td]:py-2.5 [&_td]:text-[13px]! [&_td]:leading-[1.25]",
);

export function ExecutiveOverview() {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        breadcrumbs={["Overview", "Executive Overview"]}
        title="Executive Overview"
        subtitle="Complete view of your infrastructure health and performance"
      />

      {(() => { const active = activeMaintenanceWindows(); if (active.length === 0) return null; const hosts = serversInMaintenance(); const mutedUntil = active.reduce((min, window) => Math.max(min, Date.parse(window.end)), 0); return (
        <div role="status" className="flex min-h-[44px] flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-[13px] text-violet-900 dark:border-violet-900/70 dark:bg-violet-950/30 dark:text-violet-200">
          <div className="flex items-center gap-2"><Wrench size={16} aria-hidden="true" /><b>{active.length} maintenance window{active.length === 1 ? "" : "s"} active</b><span className="text-violet-800/80 dark:text-violet-200/80">· {hosts.length} servers in maintenance · alerts muted until {new Date(mutedUntil).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span></div>
          <a href="/maintenance-windows" className="inline-flex h-8 items-center gap-1 rounded-lg border border-violet-200 bg-white px-3 text-[12px] font-semibold text-violet-800 transition-colors hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-violet-900 dark:bg-transparent dark:text-violet-200">View windows <ArrowRight size={13} /></a>
        </div>
      ); })()}

      <section aria-label="Key metrics" className="grid min-w-0 grid-cols-2 items-stretch gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((item) => (
          <MetricCard key={item.label} item={item} className="h-[96px]" labelClassName="text-[13px]" valueClassName="text-[25px]" />
        ))}
      </section>

      <section aria-label="Trends" className="grid min-w-0 grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        <HealthTrendPanel className={cn("h-[270px]", PANEL)} />
        <UsagePanel className={cn("h-[270px]", PANEL)} />
        <StoragePanel className={cn("h-[270px]", PANEL)} />
      </section>

      <section aria-label="Status breakdown" className="grid min-w-0 grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <NetworkTrafficPanel className={cn("h-[224px]", PANEL)} />
        <AvailabilityPanel className={cn("h-[224px]", PANEL)} />
        <DonutPanel title="Alerts by Severity" data={alertSeverity} total={23} className={cn("h-[224px]", PANEL)} />
        <DonutPanel title="Incidents by Status" data={incidentStatus} total={4} range="7d" className={cn("h-[224px]", PANEL)} />
      </section>

      <section aria-label="Top offenders" className="grid min-w-0 grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryServerTable title="Top CPU Consuming Servers" rows={cpuServers} kind="metric" className={cn(PANEL, "h-[280px]")} />
        <SummaryServerTable title="Top Memory Consuming Servers" rows={memoryServers} kind="metric" className={cn(PANEL, "h-[280px]")} />
        <SummaryServerTable title="Lowest Backup Capacity" rows={backupServers} kind="backup" className={cn(PANEL, "h-[280px]")} />
        <SummaryServerTable title="Highest Response Latency" rows={latency} kind="latency" className={cn(PANEL, "h-[280px]")} />
      </section>
    </div>
  );
}
