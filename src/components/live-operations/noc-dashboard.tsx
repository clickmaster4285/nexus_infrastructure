"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Database,
  Globe,
  MoreVertical,
  Workflow,
  Settings2,
} from "lucide-react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { DonutPanel } from "@/components/shared/donut-panel";
import { Icon } from "@/components/shared/icon";
import { MetricCard } from "@/components/shared/metric-card";
import { Legend, Panel } from "@/components/shared/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  nocActiveAlerts,
  nocCollectors,
  nocHealth,
  nocHealthSegments,
  nocOperationsFeed,
  nocRecentEvents,
  nocResourceUsage,
  nocServerGroups,
  nocServiceAvailability,
  nocStats,
  nocTopIssues,
  type NocResourceTab,
  type TopIssueTab,
} from "@/data/mock/live-operations";

// Leaflet cannot render on the server, so the map is loaded client-side only.
const InfrastructureMap = dynamic(
  () => import("@/components/live-operations/infrastructure-map").then((mod) => mod.InfrastructureMap),
  {
    ssr: false,
    loading: () => <div className="grid h-full min-h-[210px] place-items-center rounded-md bg-[#0b1220] text-[10px] text-slate-400">Loading map…</div>,
  },
);

const tooltipStyle = {
  contentStyle: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    boxShadow: "0 4px 14px rgba(20,40,71,0.07)",
  },
  labelStyle: { color: "var(--muted-foreground)", marginBottom: 4 },
};

const axisStyle = {
  tick: { fill: "var(--muted-foreground)", fontSize: 10 },
  axisLine: { stroke: "var(--border)" },
  tickLine: false,
} as const;

const severityStyles = {
  critical: { dot: "#ef4444", text: "text-[#ef4444]", label: "Critical" },
  high: { dot: "#f59e0b", text: "text-[#f59e0b]", label: "High" },
  medium: { dot: "#eab308", text: "text-[#eab308]", label: "Medium" },
} as const;

const availabilityIcons = [
  { name: "Web Servers", icon: Globe },
  { name: "APIs", icon: Workflow },
  { name: "Databases", icon: Database },
  { name: "Services", icon: Settings2 },
] as const;

const topIssueBar = {
  red: "bg-[#ef4444]",
  amber: "bg-[#f59e0b]",
  yellow: "bg-[#eab308]",
} as const;

const feedTone = {
  green: "bg-[#e6f8ef] text-[#20ad71]",
  blue: "bg-[#e9f5ff] text-[#3286d5]",
  amber: "bg-[#fff3df] text-[#e89b2d]",
  red: "bg-[#ffebed] text-[#dd3f4b]",
} as const;

const eventTone = {
  green: "bg-[#e6f8ef] text-[#20ad71]",
  blue: "bg-[#e9f5ff] text-[#3286d5]",
  amber: "bg-[#fff3df] text-[#e89b2d]",
} as const;

const resourceTabs: Array<{ value: NocResourceTab; label: string }> = [
  { value: "cpu", label: "CPU" },
  { value: "memory", label: "Memory" },
  { value: "network", label: "Network" },
  { value: "disk", label: "Disk" },
];

const topIssueTabs: Array<{ value: TopIssueTab; label: string }> = [
  { value: "cpu", label: "CPU" },
  { value: "memory", label: "Memory" },
  { value: "disk", label: "Disk" },
  { value: "network", label: "Network" },
];

export function LiveOperationsNoc() {
  const [resourceTab, setResourceTab] = useState<NocResourceTab>("cpu");
  const [topIssueTab, setTopIssueTab] = useState<TopIssueTab>("cpu");
  const [autoRefresh, setAutoRefresh] = useState("30s");
  const [overall, setOverall] = useState("Healthy");

  const livePill = (
    <Badge variant="success" className="gap-1.5 border-transparent bg-[#e6f8ef] px-2.5 py-1 text-[9px] text-[#256b4c] dark:bg-[#123a2a] dark:text-[#4fd69a]">
      <span aria-hidden="true" className="h-[6px] w-[6px] rounded-full bg-[#27c785]" />
      Live
    </Badge>
  );

  const autoRefreshSelect = (
    <Select value={autoRefresh} onValueChange={setAutoRefresh}>
      <SelectTrigger className="h-[26px] w-[132px] text-[9px]" aria-label="Auto refresh interval">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {["10s", "30s", "1m", "5m"].map((option) => (
          <SelectItem key={option} value={option}>{`Auto Refresh: ${option}`}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const viewAll = (href: string, label: string) => (
    <Link href={href} className="flex cursor-pointer items-center gap-1 whitespace-nowrap text-[9px] font-medium text-primary transition-colors hover:text-primary/80">
      {label} <ArrowRight size={11} aria-hidden="true" />
    </Link>
  );

  return (
    <>
      <PageMeta breadcrumbs={["Overview", "Live Operations / NOC"]} actions={<>{livePill}{autoRefreshSelect}</>} />
      <PageHeading
        title="Live Operations / NOC"
        description="Real-time infrastructure monitoring and operations center"
      />

      {/* KPI row */}
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 xl:grid-cols-6">
        {nocStats.map((item) => (
          <MetricCard key={item.label} item={item} className="h-[76px]" />
        ))}
      </section>

      {/* Row 1: Health · Chart · Map · Alerts */}
      <section aria-label="Live overview" className="mt-2.5 grid gap-2.5 md:grid-cols-2 xl:grid-cols-[250px_minmax(0,1.15fr)_minmax(0,1.35fr)_280px]">
        <DonutPanel
          title="Infrastructure Health"
          data={nocHealthSegments}
          total={nocHealth.score}
          totalLabel="Health Score"
          className="h-full"
          action={
            <Select value={overall} onValueChange={setOverall}>
              <SelectTrigger className="h-[23px] w-[104px] text-[9px]" aria-label="Overall health status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Healthy", "Degraded", "Offline"].map((option) => (
                  <SelectItem key={option} value={option}>{`Overall: ${option}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <Panel
          title="Real-Time Resource Usage"
          className="h-full"
          action={
            <Select defaultValue="1h">
              <SelectTrigger className="h-[23px] w-[52px] text-[9px]" aria-label="Time range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["15m", "1h", "24h"].map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        >
          <div className="mt-1 flex items-center gap-1.5" role="tablist" aria-label="Resource">
            {resourceTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={resourceTab === tab.value}
                onClick={() => setResourceTab(tab.value)}
                className={cn(
                  "cursor-pointer rounded px-2.5 py-1 text-[9px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  resourceTab === tab.value && "bg-primary/10 font-semibold text-primary",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-1 min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={nocResourceUsage[resourceTab]} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="noc-value" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#288af0" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#288af0" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="time" {...axisStyle} ticks={["13:00", "13:15", "13:30", "13:45", "14:00", "14:15", "14:30"]} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value: number) => `${value}%`} {...axisStyle} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="value" name="CPU Usage" stroke="#288af0" strokeWidth={2} fill="url(#noc-value)" dot={false} />
                <Area type="monotone" dataKey="load" name="Load Average" stroke="#a647e8" strokeWidth={2} fill="none" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <Legend items={[{ name: "CPU Usage", color: "#288af0" }, { name: "Load Average", color: "#a647e8" }]} />
        </Panel>

        <Panel title="Infrastructure Map" className="h-full min-h-[230px]" showOptions={false}>
          <div className="min-h-0 flex-1 pt-1.5">
            <InfrastructureMap />
          </div>
        </Panel>

        <Panel title="Active Alerts" className="h-full" action={viewAll("/alerts", "View All")}>
          <ul className="mt-1 flex min-h-0 flex-1 flex-col divide-y divide-border/70">
            {nocActiveAlerts.map((alert) => {
              const style = severityStyles[alert.severity];
              return (
                <li key={`${alert.title}-${alert.time}`} className="flex items-start gap-2 py-2">
                  <span aria-hidden="true" className="mt-1 h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: style.dot }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-[8px] font-bold uppercase tracking-wide", style.text)}>{style.label}</span>
                      <span className="text-[9px] font-semibold text-muted-foreground">{alert.time}</span>
                    </div>
                    <b className="mt-0.5 block truncate text-[10px] font-semibold text-foreground">{alert.title}</b>
                    <small className="mt-0.5 block truncate text-[8px] text-muted-foreground">{alert.detail}</small>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </section>

      {/* Row 2: Availability · Groups · Top Issues · Events */}
      <section aria-label="Availability and issues" className="mt-2.5 grid gap-2.5 md:grid-cols-2 xl:grid-cols-[1.05fr_0.9fr_1.15fr_1.15fr]">
        <Panel title="Service Availability" range="24h" className="h-full">
          <div className="mt-2 flex flex-1 flex-col gap-3">
            {nocServiceAvailability.map((service) => {
              const IconComponent = availabilityIcons.find((entry) => entry.name === service.name)?.icon ?? Globe;
              return (
                <div key={service.name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
                  <span aria-hidden="true" className="grid h-[24px] w-[24px] place-items-center rounded-full bg-primary/10 text-primary">
                    <IconComponent size={13} />
                  </span>
                  <div className="min-w-0">
                    <div className="mb-1 truncate text-[11px] font-semibold text-[#15243b] dark:text-[#e7edf6]">{service.name}</div>
                    <div className="h-[6px] overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#34d399] to-[#10b981]" style={{ width: `${service.value}%` }} />
                    </div>
                  </div>
                  <b className="whitespace-nowrap text-[11px] font-bold text-[#256b4c] dark:text-[#4fd69a]">{service.value}%</b>
                </div>
              );
            })}
          </div>
        </Panel>

        <DonutPanel title="Server Groups" data={nocServerGroups} total={12} totalLabel="Total" className="h-full" />

        <Panel
          title="Top Issues"
          className="h-full"
          action={
            <div className="flex items-center gap-1" role="tablist" aria-label="Issue metric">
              {topIssueTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={topIssueTab === tab.value}
                  onClick={() => setTopIssueTab(tab.value)}
                  className={cn(
                    "cursor-pointer rounded px-2 py-1 text-[9px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                    topIssueTab === tab.value && "bg-primary/10 font-semibold text-primary",
                  )}
                >
                  {tab.label}
                </button>
              ))}
              <Button variant="ghost" size="icon-sm" className="h-6 w-6 text-muted-foreground" aria-label="Top issues options">
                <MoreVertical size={14} />
              </Button>
            </div>
          }
        >
          <ol className="mt-2 flex flex-1 flex-col justify-center gap-3">
            {nocTopIssues[topIssueTab].map((issue, index) => (
              <li key={issue.name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
                <span aria-hidden="true" className="grid h-[20px] w-[20px] place-items-center rounded-full bg-muted text-[10px] font-bold text-[#15243b] dark:text-[#e7edf6]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <b className="mb-1 block truncate text-[11px] font-semibold text-[#15243b] dark:text-[#e7edf6]">{issue.name}</b>
                  <div className="h-[6px] overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className={cn("h-full rounded-full", topIssueBar[issue.tone])} style={{ width: `${issue.percent}%` }} />
                  </div>
                </div>
                <b className="whitespace-nowrap text-[10px] font-bold text-[#15243b] dark:text-[#e7edf6]">{issue.percent}%</b>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Recent Events" className="h-full" action={viewAll("/events-explorer", "View All")}>
          <ul className="mt-1 flex flex-1 flex-col divide-y divide-border/70">
            {nocRecentEvents.map((event) => (
              <li key={`${event.title}-${event.detail}`} className="flex items-center gap-2.5 py-1.5">
                <span aria-hidden="true" className={cn("grid h-[23px] w-[23px] shrink-0 place-items-center rounded-full", eventTone[event.tone])}>
                  <Icon name={event.icon} size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-medium text-[#15243b] dark:text-[#e7edf6]">
                    {event.title} <span className="font-normal text-[#3a4a63] dark:text-[#a9bcd2]">· {event.detail}</span>
                  </p>
                </div>
                <small className="shrink-0 text-[9px] font-semibold text-[#3a4a63] dark:text-[#a9bcd2]">{event.time}</small>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      {/* Row 3: Live feed · Collectors */}
      <section aria-label="Live operations" className="mt-2.5 grid gap-2.5 xl:grid-cols-[1fr_1.3fr]">
        <Panel
          title="Live Operations Feed"
          className="h-full"
          action={
            <Badge variant="success" className="gap-1 border-transparent bg-[#e6f8ef] px-2 py-0.5 text-[8px] text-[#256b4c] dark:bg-[#123a2a] dark:text-[#4fd69a]">
              <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-[#27c785]" />
              Live Stream
            </Badge>
          }
        >
          <ul className="mt-1.5 max-h-[212px] min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#b8c7d9_transparent]">
            {nocOperationsFeed.map((item) => (
              <li key={`${item.time}-${item.message}`} className="flex items-center gap-2.5 py-2">
                <span className="w-8 shrink-0 text-[10px] font-bold tabular-nums text-[#3a4a63] dark:text-[#a9bcd2]">{item.time}</span>
                <span aria-hidden="true" className={cn("grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full", feedTone[item.tone])}>
                  <Icon name={item.icon} size={12} />
                </span>
                <span className="min-w-0 truncate text-[10px] font-medium text-[#15243b] dark:text-[#e7edf6]">{item.message}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Monitoring Collectors" className="h-full" action={viewAll("/metrics-explorer", "View Details")}>
          <div className="mt-1.5 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr>
                  {["Collector", "Status", "Last Heartbeat", "Metrics Ingestion"].map((header) => (
                    <th key={header} scope="col" className="border-b border-border px-2 py-2 text-left text-[9px] font-bold uppercase tracking-wide text-[#3a4a63] dark:text-[#a9bcd2]">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nocCollectors.map((collector) => (
                  <tr key={collector.name} className="border-b border-border/60 last:border-b-0">
                    <td className="whitespace-nowrap px-2 py-2.5 text-[11px] font-bold text-[#15243b] dark:text-[#e7edf6]">{collector.name}</td>
                    <td className="px-2 py-2.5 text-[10px] font-semibold text-[#256b4c] dark:text-[#4fd69a]">
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-[#27c785]" />
                        {collector.status}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-[10px] font-medium tabular-nums text-[#3a4a63] dark:text-[#a9bcd2]">{collector.heartbeat}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-bold tabular-nums text-[#15243b] dark:text-[#e7edf6]">{collector.rate}</span>
                        <CollectorSpark values={collector.spark} name={collector.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
    </>
  );
}

function CollectorSpark({ values, name }: { values: number[]; name: string }) {
  const width = 74;
  const height = 16;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (width - 4) / (values.length - 1);
  const points = values.map((value, index) => {
    const x = 2 + index * step;
    const y = height - 2 - ((value - min) / range) * (height - 4);
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${(2 + (values.length - 1) * step).toFixed(1)},${height} L2,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[18px] w-[78px]" role="img" aria-label={`${name} ingestion trend`}>
      <defs>
        <linearGradient id="collector-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5ba4ed" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#5ba4ed" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#collector-spark-fill)" />
      <path d={line} fill="none" stroke="#5ba4ed" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}