import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { AvailabilityPanel, HealthTrendPanel, NetworkTrafficPanel, StoragePanel, UsagePanel } from "@/components/shared/chart-panels";
import { DonutPanel } from "@/components/shared/donut-panel";
import { MetricCard } from "@/components/shared/metric-card";
import { SummaryServerTable } from "@/components/shared/summary-server-table";
import {
  alertSeverity,
  backupServers,
  cpuServers,
  incidentStatus,
  latency,
  memoryServers,
  stats,
} from "@/data/mock/dashboard";

export function ExecutiveOverview() {
  return (
    <>
      <PageMeta breadcrumbs={["Overview", "Executive Overview"]} />
      <PageHeading title="Executive Overview" description="Complete view of your infrastructure health and performance" />

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-2 sm:gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((item) => (
          <MetricCard key={item.label} item={item} className="h-[70px] sm:h-[77px]" />
        ))}
      </section>

      <section aria-label="Trends" className="mt-2.5 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        <HealthTrendPanel className="h-[234px]" />
        <UsagePanel className="h-[234px]" />
        <StoragePanel className="h-[234px]" />
      </section>

      <section aria-label="Status breakdown" className="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <NetworkTrafficPanel className="h-[183px]" />
        <AvailabilityPanel className="h-[183px]" />
        <DonutPanel title="Alerts by Severity" data={alertSeverity} total={23} className="h-[183px]" />
        <DonutPanel title="Incidents by Status" data={incidentStatus} total={4} range="7d" className="h-[183px]" />
      </section>

      <section aria-label="Top offenders" className="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryServerTable title="Top CPU Consuming Servers" rows={cpuServers} kind="metric" />
        <SummaryServerTable title="Top Memory Consuming Servers" rows={memoryServers} kind="metric" />
        <SummaryServerTable title="Lowest Backup Capacity" rows={backupServers} kind="backup" />
        <SummaryServerTable title="Highest Response Latency" rows={latency} kind="latency" />
      </section>
    </>
  );
}
