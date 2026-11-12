import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
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
      <PageMeta breadcrumbs={["Overview", "Executive Overview"]} />
      <PageHeading title="Executive Overview" description="Complete view of your infrastructure health and performance" />

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
