import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { AvailabilityPanel, HealthTrendPanel, NetworkTrafficPanel, StoragePanel, UsagePanel } from "@/components/shared/chart-panels";
import { DonutPanel } from "@/components/shared/donut-panel";
import { MetricCard } from "@/components/shared/metric-card";
import { SummaryServerTable } from "@/components/shared/summary-server-table";
import styles from "./executive-overview.module.css";
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
    <div className={styles.page}>
      <PageMeta breadcrumbs={["Overview", "Executive Overview"]} />
      <PageHeading title="Executive Overview" description="Complete view of your infrastructure health and performance" />

      <section aria-label="Key metrics" className={styles.metrics}>
        {stats.map((item) => (
          <MetricCard key={item.label} item={item} className="h-[96px]" labelClassName="text-[13px]" valueClassName="text-[25px]" />
        ))}
      </section>

      <section aria-label="Trends" className={styles.trendGrid}>
        <HealthTrendPanel className={`h-[270px] ${styles.panel}`} />
        <UsagePanel className={`h-[270px] ${styles.panel}`} />
        <StoragePanel className={`h-[270px] ${styles.panel}`} />
      </section>

      <section aria-label="Status breakdown" className={styles.statusGrid}>
        <NetworkTrafficPanel className={`h-[224px] ${styles.panel}`} />
        <AvailabilityPanel className={`h-[224px] ${styles.panel}`} />
        <DonutPanel title="Alerts by Severity" data={alertSeverity} total={23} className={`h-[224px] ${styles.panel}`} />
        <DonutPanel title="Incidents by Status" data={incidentStatus} total={4} range="7d" className={`h-[224px] ${styles.panel}`} />
      </section>

      <section aria-label="Top offenders" className={styles.tableGrid}>
        <SummaryServerTable title="Top CPU Consuming Servers" rows={cpuServers} kind="metric" className={`${styles.panel} h-[280px]`} />
        <SummaryServerTable title="Top Memory Consuming Servers" rows={memoryServers} kind="metric" className={`${styles.panel} h-[280px]`} />
        <SummaryServerTable title="Lowest Backup Capacity" rows={backupServers} kind="backup" className={`${styles.panel} h-[280px]`} />
        <SummaryServerTable title="Highest Response Latency" rows={latency} kind="latency" className={`${styles.panel} h-[280px]`} />
      </section>
    </div>
  );
}
