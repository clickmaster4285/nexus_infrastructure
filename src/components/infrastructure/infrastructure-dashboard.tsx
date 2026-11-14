"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { DonutPanel } from "@/components/shared/donut-panel";
import { MetricCard } from "@/components/shared/metric-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssetsEnvironmentPanel } from "@/components/infrastructure/panels/assets-environment-panel";
import { InfrastructureEventsPanel } from "@/components/infrastructure/panels/infrastructure-events-panel";
import { InfrastructureHealthPanel } from "@/components/infrastructure/panels/infrastructure-health-panel";
import { TopologyPanel } from "@/components/infrastructure/panels/topology-panel";
import { UnmonitoredAssetsPanel } from "@/components/infrastructure/panels/unmonitored-assets-panel";
import { infrastructureStats, providerDistribution } from "@/data/mock/infrastructure";

const ENVIRONMENT_OPTIONS = ["All Environments", "Production", "Staging", "Development", "Testing"] as const;
const PROVIDER_OPTIONS = ["All Providers", "AWS", "DigitalOcean", "Hetzner", "On-Prem"] as const;
const GROUP_BY_OPTIONS = ["Location", "Environment", "Provider", "Type"] as const;

export function InfrastructureDashboard() {
  const router = useRouter();
  const [environment, setEnvironment] = useState<string>("All Environments");
  const [provider, setProvider] = useState<string>("All Providers");
  const [groupBy, setGroupBy] = useState<string>("Location");

  return (
    <>
      <PageHeader breadcrumbs={["Infrastructure", "Infrastructure Dashboard"]} title="Infrastructure Dashboard" subtitle="Global infrastructure topology and resource health">
        <Select value={environment} onValueChange={setEnvironment}>
          <SelectTrigger className="h-9 min-w-[9.0625rem] text-[0.75rem]" aria-label="Filter by environment">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENVIRONMENT_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger className="h-9 min-w-[9.0625rem] text-[0.75rem]" aria-label="Filter by provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={setGroupBy}>
          <SelectTrigger className="h-9 min-w-[10rem] text-[0.75rem]" aria-label="Group assets by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUP_BY_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {`Group by: ${option}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>


      <section aria-label="Infrastructure summary" className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {infrastructureStats.map((item) => (
          <MetricCard
            key={item.label}
            item={item}
            className="h-[7rem] items-center gap-2.5 p-4"
            labelClassName="text-[0.8125rem] leading-[1.125rem]"
            valueClassName="text-[1.625rem] leading-[1.875rem]"
            trendClassName="text-[0.75rem] leading-4"
            detailClassName="mt-0.5 text-[0.75rem] leading-4"
          />
        ))}
      </section>

      <section aria-label="Topology and health" className="mt-4 grid items-stretch gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(18.125rem,0.82fr)]">
        <TopologyPanel />
        <InfrastructureHealthPanel
          className="h-[29.5rem]"
          onAlertSelect={(severity) => router.push(severity ? `/alerts?severity=${severity}` : "/alerts")}
        />
      </section>

      <section aria-label="Breakdown" className="mt-4 grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AssetsEnvironmentPanel className="h-[14.875rem]" />
        <DonutPanel title="Provider Distribution" data={providerDistribution} total={48} totalLabel="Total Assets" className="h-[14.875rem]" />
        <InfrastructureEventsPanel className="h-[14.875rem]" />
        <UnmonitoredAssetsPanel className="h-[14.875rem]" />
      </section>
    </>
  );
}
