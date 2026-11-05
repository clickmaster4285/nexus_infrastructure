"use client";

import { useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Check, HeartPulse } from "lucide-react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { Icon } from "@/components/shared/icon";
import { Legend, Panel } from "@/components/shared/panel";
import { MetricCard } from "@/components/shared/metric-card";
import { cn } from "@/lib/utils";
import {
  componentHealth,
  environmentHealth,
  globalCollectors,
  globalHealthStats,
  globalHealthTrend,
  healthScore,
  infrastructureStatus,
  markerCounts,
  quickActions,
  recentGlobalEvents,
  resourceHealth,
  topHealthyServices,
} from "@/data/mock/global-health";

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

const eventToneText: Record<string, string> = {
  info: "text-[#2684f5]",
  warning: "text-[#d97706]",
  critical: "text-[#ef4444]",
};

const quickActionTone: Record<string, string> = {
  blue: "bg-[#e2f0ff] text-[#1379e8] dark:bg-[#17385c] dark:text-[#5fb0ff]",
  red: "bg-[#ffeaec] text-[#e83f4d] dark:bg-[#492a35] dark:text-[#ff8b98]",
  amber: "bg-[#fff1d7] text-[#dc941c] dark:bg-[#493a29] dark:text-[#ffc16e]",
  purple: "bg-[#f1eaff] text-[#9252df] dark:bg-[#2d2340] dark:text-[#c2a4ff]",
};

function HealthRing({ label, value, color }: { label: string; value: number; color: string }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 64 64" className="h-[62px] w-[62px] -rotate-90" role="img" aria-label={`${label} health ${value}%`}>
        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--muted)" strokeWidth="6.5" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <text x="32" y="32" textAnchor="middle" dominantBaseline="central" className="fill-[#15243b] text-[12px] font-bold dark:fill-[#e7edf6]" transform="rotate(90 32 32)">
          {value}%
        </text>
      </svg>
      <span className="text-[10px] font-semibold text-[#15243b] dark:text-[#e7edf6]">{label}</span>
    </div>
  );
}

export function GlobalHealthDashboard() {
  const trendColors = ["#288af0", "#22c55e", "#a647e8"];
  const collectorsOk = globalCollectors.length;

  const ringSegments = useMemo(() => [{ value: 100, color: "#22c55e" }], []);

  return (
    <>
      <PageMeta breadcrumbs={["Overview", "Global Health"]} />
      <PageHeading
        title="Global Health"
        description="Overall health status of your infrastructure and monitoring platform"
        icon={<HeartPulse size={19} strokeWidth={1.9} />}
      />

      {/* KPI row */}
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 xl:grid-cols-6">
        {globalHealthStats.map((item) => (
          <MetricCard key={item.label} item={item} className="h-[76px]" />
        ))}
      </section>

      {/* Row: Health Trend · Health by Component · Health by Location */}
      <section aria-label="Health breakdown" className="mt-2.5 grid gap-2.5 lg:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1.15fr]">
        <Panel title="Health Trend" range="24h" className="h-[262px]">
          <div className="min-h-0 flex-1 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={globalHealthTrend} margin={{ top: 4, right: 6, left: -14, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="time" ticks={["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"]} {...axisStyle} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value: number) => `${value}%`} {...axisStyle} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="infrastructureHealth" name="Infrastructure Health" stroke={trendColors[0]} strokeWidth={1.8} dot={false} />
                <Line type="monotone" dataKey="monitoringCoverage" name="Monitoring Coverage" stroke={trendColors[1]} strokeWidth={1.8} dot={false} />
                <Line type="monotone" dataKey="availability" name="Service Availability" stroke={trendColors[2]} strokeWidth={1.8} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Legend items={[{ name: "Infrastructure Health", color: trendColors[0] }, { name: "Monitoring Coverage", color: trendColors[1] }, { name: "Service Availability", color: trendColors[2] }]} />
        </Panel>

        <Panel title="Health by Component" className="h-[262px]">
          <div className="flex min-h-0 flex-1 items-center gap-3">
            <div className="relative h-[150px] w-[46%] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={componentHealth} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2} stroke="none">
                    {componentHealth.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <b className="font-display text-[22px] font-extrabold leading-none text-[#15243b] dark:text-[#e7edf6]">{healthScore}%</b>
                <span className="mt-1 text-[9px] font-medium text-[#3a4a63] dark:text-[#a9bcd2]">Overall</span>
              </div>
            </div>
            <ul className="flex min-w-0 flex-1 flex-col gap-2.5">
              {componentHealth.map((item) => (
                <li key={item.name} className="flex items-center justify-between gap-2 border-b border-border/50 pb-1.5 text-[10px] last:border-b-0 last:pb-0">
                  <span className="flex min-w-0 items-center gap-1.5 font-medium text-[#15243b] dark:text-[#e7edf6]">
                    <span aria-hidden="true" className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ background: item.color }} />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <b className="whitespace-nowrap tabular-nums text-[10px] text-[#15243b] dark:text-[#e7edf6]">{item.value}%</b>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel title="Health by Location" className="h-[262px]" showOptions={false}>
          <div className="min-h-0 flex-1 pt-1.5">
            <InfrastructureMap legendCounts={markerCounts} />
          </div>
        </Panel>
      </section>

      {/* Row: Resource Health · Top Healthy Services · Health by Environment · Monitoring Collectors */}
      <section aria-label="Resource and service health" className="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <Panel title="Resource Health" className="h-[228px]">
          <div className="flex min-h-0 flex-1 items-center justify-around">
            {resourceHealth.map((resource) => (
              <HealthRing key={resource.label} label={resource.label} value={resource.value} color={resource.color} />
            ))}
          </div>
        </Panel>

        <Panel title="Top Healthy Services" className="h-[228px]">
          <ul className="flex min-h-0 flex-1 flex-col justify-center divide-y divide-border/60">
            {topHealthyServices.map((service) => (
              <li key={service.name} className="flex items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className="grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full bg-success/15 text-success">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <span className="truncate text-[10px] font-medium text-[#15243b] dark:text-[#e7edf6]">{service.name}</span>
                </span>
                <b className="whitespace-nowrap tabular-nums text-[10px] font-bold text-[#15243b] dark:text-[#e7edf6]">{service.percent}%</b>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Health by Environment" className="h-[228px]">
          <div className="flex min-h-0 flex-1 items-end justify-around gap-2 pb-1 pt-2">
            {environmentHealth.map((env) => (
              <div key={env.name} className="flex h-full flex-col items-center justify-end gap-1.5">
                <b className="tabular-nums text-[10px] font-bold text-[#15243b] dark:text-[#e7edf6]">{env.value}%</b>
                <div className="flex h-[110px] w-[32px] items-end overflow-hidden rounded-md bg-muted" aria-hidden="true">
                  <div
                    className="w-full rounded-md"
                    style={{ height: `${env.value}%`, background: `linear-gradient(180deg, ${env.color}, ${env.color}cc)` }}
                  />
                </div>
                <span className="whitespace-nowrap text-[9px] font-semibold text-[#3a4a63] dark:text-[#a9bcd2]">{env.name}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Monitoring Collectors" className="h-[228px]">
          <div className="flex min-h-0 flex-1 items-center gap-4">
            <div className="relative h-[120px] w-[46%] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ringSegments} dataKey="value" innerRadius="68%" outerRadius="92%" stroke="none" startAngle={90} endAngle={450}>
                    <Cell fill="#22c55e" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <b className="font-display text-[19px] font-extrabold leading-none text-[#15243b] dark:text-[#e7edf6]">{collectorsOk}/{collectorsOk}</b>
                <span className="mt-1 text-[9px] font-medium text-[#3a4a63] dark:text-[#a9bcd2]">Healthy</span>
              </div>
            </div>
            <ul className="flex min-w-0 flex-1 flex-col gap-2">
              {globalCollectors.map((collector) => (
                <li key={collector} className="flex items-center gap-1.5 whitespace-nowrap text-[9px] font-medium text-[#15243b] dark:text-[#e7edf6]">
                  <span aria-hidden="true" className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full bg-success/15 text-success">
                    <Check size={10} strokeWidth={3.2} />
                  </span>
                  <span className="truncate">{collector}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </section>

      {/* Row: Recent Events · Infrastructure Status · Quick Actions */}
      <section aria-label="Events, status and actions" className="mt-2.5 grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel
          title="Recent Global Events"
          className="h-[248px]"
          action={
            <Link href="/events-explorer" className="flex cursor-pointer items-center gap-1 whitespace-nowrap text-[9px] font-medium text-primary transition-colors hover:text-primary/80">
              View All <ArrowRight size={11} aria-hidden="true" />
            </Link>
          }
        >
          <div className="mt-1 min-h-0 flex-1 overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Time", "Type", "Message", "Source"].map((header) => (
                    <th key={header} scope="col" className="border-b border-border px-2 py-1.5 text-left text-[9px] font-bold uppercase tracking-wide text-[#3a4a63] dark:text-[#a9bcd2]">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentGlobalEvents.map((event) => (
                  <tr key={`${event.time}-${event.message}`} className="border-b border-border/60 last:border-b-0">
                    <td className="whitespace-nowrap px-2 py-[7px] text-[9px] tabular-nums text-[#3a4a63] dark:text-[#a9bcd2]">{event.time}</td>
                    <td className={cn("whitespace-nowrap px-2 py-[7px] text-[9px] font-bold", eventToneText[event.tone])}>{event.type}</td>
                    <td className="px-2 py-[7px] text-[9px] font-medium text-[#15243b] dark:text-[#e7edf6]">{event.message}</td>
                    <td className="whitespace-nowrap px-2 py-[7px] text-[9px] text-[#3a4a63] dark:text-[#a9bcd2]">{event.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Infrastructure Status" className="h-[248px]">
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5">
            {infrastructureStatus.map((row) => (
              <div key={row.label} className="grid grid-cols-[104px_minmax(0,1fr)_auto] items-center gap-2">
                <span className="truncate text-[10px] font-medium text-[#15243b] dark:text-[#e7edf6]">{row.label}</span>
                <div className="h-[8px] overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#288af0] via-[#38bdf8] to-[#22c55e]" style={{ width: `${row.value}%` }} />
                </div>
                <b className="whitespace-nowrap tabular-nums text-[10px] font-bold text-[#15243b] dark:text-[#e7edf6]">{row.value}%</b>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Quick Actions" className="h-[248px] lg:col-span-2 xl:col-span-1">
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card p-2.5 text-left transition-colors hover:border-[#a9c8eb] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span aria-hidden="true" className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md", quickActionTone[action.tone])}>
                  <Icon name={action.icon} size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-bold text-[#15243b] dark:text-[#e7edf6]">{action.title}</span>
                  <span className="mt-0.5 block truncate text-[8px] text-[#3a4a63] dark:text-[#a9bcd2]">{action.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
}
