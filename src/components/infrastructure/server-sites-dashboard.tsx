"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import dynamic from "next/dynamic";
import { Globe2, MoreVertical, Plus, ArrowRight } from "lucide-react";
import * as Flags from "country-flag-icons/react/3x2";
import {
  CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { PageHeader } from "@/components/layout/page-header";
import { healthMapLocations, healthMapSites } from "@/data/mock/health-locations";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import type { MetricStat } from "@/data/mock/dashboard";
import { incidentStoreSnapshot } from "@/mocks/incidents";

const NocOsmMap = dynamic(
  () => import("@/components/live-operations/noc-osm-map").then((module) => module.NocOsmMap),
  { ssr: false, loading: () => <div className="grid h-full min-h-[13.75rem] place-items-center rounded-md bg-card text-[0.75rem] text-muted-foreground">Loading map…</div> },
);

const stats: MetricStat[] = [
  { label: "Total Server Sites", value: "5", change: "+1 new", trend: "up", tone: "blue", icon: "server" },
  { label: "Site Locations", value: "12", change: "Worldwide", trend: "flat", tone: "blue", icon: "map-pin" },
  { label: "Countries", value: "6", change: "Across 4 regions", trend: "flat", tone: "purple", icon: "globe" },
  { label: "Healthy Sites", value: "10", change: "83.3% of total", trend: "up", tone: "green", icon: "online" },
  { label: "Degraded Sites", value: "1", change: "8.3% of total", trend: "down", tone: "amber", icon: "warning" },
  { label: "Offline Sites", value: "1", change: "8.3% of total", trend: "down", tone: "red", icon: "offline" },
];

type SiteStatus = "Healthy" | "Degraded" | "Offline";

const centers: { name: string; location: string; status: SiteStatus; uptime: number; country: string }[] = [
  { name: "DC-1", location: "New York, USA", status: "Healthy", uptime: 99.9, country: "United States" },
  { name: "DC-2", location: "London, UK", status: "Healthy", uptime: 99.6, country: "United Kingdom" },
  { name: "DC-3", location: "Dubai, UAE", status: "Degraded", uptime: 98.7, country: "UAE" },
  { name: "DC-4", location: "Singapore, SG", status: "Healthy", uptime: 99.1, country: "Singapore" },
  { name: "DC-5", location: "Sydney, AU", status: "Offline", uptime: 0, country: "Australia" },
];

const countryLocations = [
  { code: "US", name: "United States", count: 2, status: "healthy" },
  { code: "GB", name: "United Kingdom", count: 2, status: "healthy" },
  { code: "AE", name: "UAE", count: 2, status: "degraded" },
  { code: "DE", name: "Germany", count: 2, status: "healthy" },
  { code: "SG", name: "Singapore", count: 2, status: "healthy" },
  { code: "AU", name: "Australia", count: 2, status: "offline" },
];

const FlagComponents = Flags as unknown as Record<
  string,
  ComponentType<SVGProps<SVGSVGElement> & { title?: string }> | undefined
>;

const regionCount = 4;

const centerStates = [
  { name: "Healthy", value: 3, color: "oklch(0.6907 0.1499 159.66)" },
  { name: "Degraded", value: 1, color: "oklch(0.7686 0.1647 70.08)" },
  { name: "Offline", value: 1, color: "oklch(0.6368 0.2078 25.33)" },
];

const locationStates = [
  { name: "Healthy", value: healthMapLocations.filter((location) => location.status === "healthy").length, color: "oklch(0.6907 0.1499 159.66)" },
  { name: "Degraded", value: healthMapLocations.filter((location) => location.status === "warning").length, color: "oklch(0.7686 0.1647 70.08)" },
  { name: "Offline", value: healthMapLocations.filter((location) => location.status === "critical").length, color: "oklch(0.6368 0.2078 25.33)" },
];

const performanceTimes = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"];
const performance = performanceTimes.map((time, index) => ({
  time,
  nyc: [72, 76, 69, 82, 78, 88, 81][index],
  london: [68, 73, 70, 79, 75, 82, 76][index],
  dubai: [55, 59, 63, 68, 72, 64, 60][index],
}));

const topLocations = [
  { name: "New York (USA)", countryCode: "US", uptime: 99.9, color: "oklch(0.6231 0.188 259.81)" },
  { name: "London (UK)", countryCode: "GB", uptime: 99.6, color: "oklch(0.6056 0.2189 292.72)" },
  { name: "Dubai (UAE)", countryCode: "AE", uptime: 99.2, color: "oklch(0.7686 0.1647 70.08)" },
  { name: "Singapore (SG)", countryCode: "SG", uptime: 98.9, color: "oklch(0.7148 0.1257 215.22)" },
  { name: "Sydney (AU)", countryCode: "AU", uptime: 98.4, color: "oklch(0.645 0.2154 16.44)" },
];
const averageLocationUptime = topLocations.reduce((sum, location) => sum + location.uptime, 0) / topLocations.length;
const lowestUptimeLocation = topLocations.reduce((lowest, location) => location.uptime < lowest.uptime ? location : lowest);

const centerOverviewStats = [
  { label: "Total Capacity", value: "3.2 PB" },
  { label: "Avg Uptime", value: `${averageLocationUptime.toFixed(1)}%` },
  { label: "Active Incidents", value: `${incidentStoreSnapshot().open}` },
];

const locationAvailabilityStats = [
  { label: "Uptime (30d)", value: `${averageLocationUptime.toFixed(1)}%` },
  { label: "Incidents", value: "2" },
  { label: "Avg Recovery (MTTR)", value: "18 min" },
];

const recentEvents = [
  { time: "Apr 23, 14:20", type: "Info", message: "DC-1 maintenance completed", location: "New York", status: "Resolved", tone: "blue" },
  { time: "Apr 23, 12:15", type: "Warning", message: "High latency detected", location: "Singapore", status: "Investigating", tone: "amber" },
  { time: "Apr 23, 10:10", type: "Info", message: "New location added: Tokyo", location: "Tokyo", status: "Resolved", tone: "blue" },
  { time: "Apr 23, 08:45", type: "Critical", message: "DC-5 is offline", location: "Sydney", status: "Open", tone: "red" },
  { time: "Apr 23, 06:30", type: "Info", message: "Backup completed", location: "London", status: "Resolved", tone: "blue" },
];

function StatusDonut({
  data,
  centerValue,
  centerLabel,
  size = "regular",
}: {
  data: { name: string; value: number; color: string }[];
  centerValue: string;
  centerLabel: string;
  size?: "regular" | "large";
}) {
  const large = size === "large";
  return (
    <div className={`flex min-w-0 flex-1 items-center ${large ? "min-h-[10.5rem] gap-3" : "min-h-[9.5rem] gap-2"}`}>
      <div className={`relative shrink-0 ${large ? "h-[9.75rem] w-[52%] max-w-[11.875rem]" : "h-[9rem] w-[52%] max-w-[10.5rem]"}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="91%" paddingAngle={1} stroke="none">
              {data.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip contentStyle={{ border: "0.0625rem solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <b className={`font-display font-extrabold leading-tight text-foreground ${large ? "text-[1.5rem]" : "text-[1.375rem]"}`}>{centerValue}</b>
          <span className="text-center text-[0.6875rem] text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <div className={`min-w-0 flex-1 ${large ? "space-y-3" : "space-y-2.5"}`}>
        {data.map((item) => <div key={item.name} className="grid grid-cols-[9px_minmax(0,1fr)_auto] items-center gap-2 text-[0.75rem]"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} /><span className="truncate text-foreground">{item.name}</span><b className="tabular-nums text-foreground">{item.value}</b></div>)}
      </div>
    </div>
  );
}

function DataCenterPerformance({ range }: { range: string }) {
  return (
    <>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 text-[0.6875rem] text-muted-foreground">
        {[ ["DC-1 (NYC)", "oklch(0.6353 0.1743 252.63)"], ["DC-2 (LON)", "oklch(0.6268 0.2325 303.9)"], ["DC-3 (DUB)", "oklch(0.6907 0.1499 159.66)"] ].map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}
      </div>
      <div className="h-[11.875rem] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={performance} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis width={42} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip labelFormatter={(label) => `${label} · ${range}`} contentStyle={{ border: "0.0625rem solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
            <Line dataKey="nyc" name="DC-1 (NYC)" type="monotone" stroke="oklch(0.6353 0.1743 252.63)" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
            <Line dataKey="london" name="DC-2 (LON)" type="monotone" stroke="oklch(0.6268 0.2325 303.9)" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
            <Line dataKey="dubai" name="DC-3 (DUB)" type="monotone" stroke="oklch(0.6907 0.1499 159.66)" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: SiteStatus }) {
  const style = status === "Healthy"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
    : status === "Degraded"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[0.6875rem] font-semibold ${style}`}><i className={`h-1.5 w-1.5 rounded-full ${status === "Healthy" ? "bg-emerald-500" : status === "Degraded" ? "bg-amber-500" : "bg-rose-500"}`} />{status}</span>;
}

function CountryFlag({ code, name }: { code: string; name: string }) {
  const Flag = FlagComponents[code];

  if (!Flag) {
    return (
      <span
        role="img"
        aria-label={`${name} flag unavailable`}
        className="grid h-[1.125rem] w-6 shrink-0 place-items-center rounded-[0.1875rem] bg-muted text-[0.5625rem] font-semibold text-muted-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
      >
        {code}
      </span>
    );
  }

  return (
    <Flag
      title={`${name} flag`}
      aria-label={`${name} flag`}
      className="h-[1.125rem] w-6 shrink-0 rounded-[0.1875rem] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
    />
  );
}

export function ServerSitesDashboard() {
  const [range, setRange] = useState("24h");
  const [mapScope, setMapScope] = useState("World");
  const [notice, setNotice] = useState("");
  const showNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };

  return (
    <div className="flex flex-col gap-3 pb-3">
      <PageHeader
        breadcrumbs={["Infrastructure", "Server Sites"]}
        title="Server Sites"
        subtitle="Monitor server site health, location availability and infrastructure performance."
        actions={<>
          <Button onClick={() => showNotice("Add Server Site form is a mockup for now.")} ><Plus size={16} />Add Server Site</Button>
          <Button variant="outline" onClick={() => document.getElementById("global-data-centers")?.scrollIntoView({ behavior: "smooth", block: "center" })} ><Globe2 size={16} />View Map</Button>
        </>}
      />

      <section aria-label="Server site summary" className="grid grid-cols-2 items-stretch gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((item) => <MetricCard key={item.label} item={item} />)}
      </section>

      <section aria-label="Global server site status" className="grid items-stretch gap-3 xl:grid-cols-[2.1fr_0.95fr_1.05fr]">
        <Panel title="Global Infrastructure Map" className="min-h-[18.125rem] min-w-0" action={<div className="flex items-center gap-2"><div className="flex rounded-md border border-border p-0.5">{["World", "Regions"].map((scope) => <button key={scope} onClick={() => setMapScope(scope)} className={`rounded-lg px-2 py-1 text-[0.6875rem] ${mapScope === scope ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"}`}>{scope}</button>)}</div><div className="hidden items-center gap-2 xl:flex">{[["Healthy", "oklch(0.6907 0.1499 159.66)"], ["Degraded", "oklch(0.7686 0.1647 70.08)"], ["Offline", "oklch(0.6368 0.2078 25.33)"]].map(([label, color]) => <span key={label} className="flex items-center gap-1 whitespace-nowrap text-[0.6875rem] text-muted-foreground"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div></div>}>
          <div id="global-data-centers" className="relative mt-2 min-h-[15.5rem] flex-1 overflow-hidden rounded-lg">
            <NocOsmMap sites={healthMapSites} center={[-33.9249, 18.4241]} initialZoom={13} />
            {mapScope === "Regions" && <div className="absolute right-2 top-2 z-[500] rounded-md border border-border bg-white/95 p-2 text-[0.6875rem] text-slate-600 shadow-sm"><b>Active regions</b><div className="mt-1">North America · Europe</div><div>Asia Pacific · Middle East</div></div>}
          </div>
        </Panel>

        <Panel title="Server Sites Overview" className="min-w-0 p-4">
          <StatusDonut data={centerStates} centerValue="5" centerLabel="Total centers" />
          <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border pt-3">
            {centerOverviewStats.map((item) => <div key={item.label} className="min-w-0 rounded-lg bg-muted/60 px-1.5 py-2"><div className="min-h-6 whitespace-normal break-words text-[0.625rem] leading-3 text-muted-foreground">{item.label}</div><b className="mt-1 block whitespace-nowrap text-[0.6875rem] text-foreground">{item.value}</b></div>)}
          </div>
        </Panel>

        <Panel title="Server Sites by Country" className="min-w-0 p-4">
          <div className="flex min-h-[12rem] flex-1 flex-col justify-between gap-2 pt-3">
            <div className="flex flex-1 flex-col justify-between gap-2">
              {countryLocations.map((country) => (
                <div
                  key={country.code}
                  className="grid min-h-6 grid-cols-[24px_minmax(0,1fr)_8px_auto] items-center gap-3 text-[0.75rem]"
                >
                  <CountryFlag code={country.code} name={country.name} />
                  <span className="truncate font-medium text-foreground">{country.name}</span>
                  <i
                    aria-label={`${country.status} status`}
                    className={`h-2 w-2 rounded-full ${
                      country.status === "healthy"
                        ? "bg-emerald-500"
                        : country.status === "degraded"
                          ? "bg-amber-500"
                          : "bg-rose-500"
                    }`}
                  />
                  <b className="tabular-nums text-foreground">{country.count}</b>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-[0.6875rem] text-muted-foreground"><span>{countryLocations.length} countries · {regionCount} regions</span><button onClick={() => showNotice("Showing all mock locations by country.")} className="shrink-0 font-semibold text-primary">View all</button></div>
          </div>
        </Panel>
      </section>

      <section aria-label="Performance and location availability" className="grid items-stretch gap-3 xl:grid-cols-[1.1fr_0.9fr_1.1fr]">
        <Panel title="Server Site Performance" className="min-w-0" action={<div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">{["24h", "7d", "30d", "90d"].map((item) => <button key={item} onClick={() => setRange(item)} className={`rounded-lg px-1.5 py-1 text-[0.6875rem] font-medium ${range === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{item}</button>)}</div>}>
          <DataCenterPerformance range={range} />
        </Panel>

        <Panel title="Site Availability" className="min-w-0 p-4">
          <StatusDonut data={locationStates} centerValue="98.7%" centerLabel="Overall" size="large" />
          <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border pt-3">
            {locationAvailabilityStats.map((item) => <div key={item.label} className="min-w-0 rounded-lg bg-muted/60 px-1.5 py-2"><div className="min-h-6 whitespace-normal break-words text-[0.625rem] leading-3 text-muted-foreground">{item.label}</div><b className="mt-1 block whitespace-nowrap text-[0.6875rem] text-foreground">{item.value}</b></div>)}
          </div>
        </Panel>

        <Panel title="Top Server Sites by Uptime" className="min-w-0 p-4">
          <div className="flex flex-1 flex-col justify-between gap-3 pt-3">
            <div className="flex flex-1 flex-col justify-between gap-2.5">
              {topLocations.map((location) => <div key={location.name} className="grid min-h-6 grid-cols-[24px_minmax(0,1.05fr)_minmax(3.75rem,1.4fr)_2.75rem] items-center gap-3 text-[0.75rem]"><CountryFlag code={location.countryCode} name={location.name} /><span className="truncate font-medium text-foreground">{location.name}</span><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${location.uptime}%`, backgroundColor: location.color }} /></div><b className="text-right tabular-nums text-foreground">{location.uptime.toFixed(1)}%</b></div>)}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-2 text-[0.6875rem] text-muted-foreground"><span>Average uptime: <b className="text-foreground">{averageLocationUptime.toFixed(1)}%</b></span><span>Lowest: <b className="text-foreground">{lowestUptimeLocation.name} {lowestUptimeLocation.uptime.toFixed(1)}%</b></span></div>
          </div>
        </Panel>
      </section>

      <section aria-label="Server site details and recent events" className="grid items-stretch gap-3 xl:grid-cols-[1.15fr_1fr]">
        <Panel title="Server Sites" className="min-w-0" action={<button onClick={() => showNotice("Showing all 5 mock server sites.")} className="inline-flex items-center gap-1 rounded-lg text-[0.75rem] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View All <ArrowRight size={14} strokeWidth={2} aria-hidden="true" /></button>}>
          <div className="overflow-x-auto pt-2">
            <table className="w-full min-w-[35rem] text-left text-[0.75rem]">
              <thead><tr className="border-b border-border text-muted-foreground">{["Name", "Location", "Status", "Uptime", "Actions"].map((heading) => <th key={heading} className={`whitespace-nowrap px-2 pb-2 font-semibold ${heading === "Actions" ? "text-center" : ""}`}>{heading}</th>)}</tr></thead>
              <tbody>{centers.map((center) => <tr key={center.name} className="h-[2.75rem] border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-2 font-semibold text-foreground">{center.name}</td><td className="whitespace-nowrap px-2 text-muted-foreground">{center.location}</td><td className="px-2"><StatusBadge status={center.status} /></td><td className="px-2 tabular-nums text-foreground">{center.uptime.toFixed(1)}%</td><td className="w-16 px-2 text-center align-middle"><button type="button" aria-label={`More actions for ${center.name}`} onClick={() => showNotice(`${center.name} actions are a mockup for now.`)} className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-transparent text-muted-foreground shadow-none transition-colors hover:bg-transparent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><MoreVertical size={18} /></button></td></tr>)}</tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Recent Events" className="min-w-0" action={<button onClick={() => showNotice("Showing the latest mock events.")} className="inline-flex items-center gap-1 rounded-lg text-[0.75rem] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View All <ArrowRight size={14} strokeWidth={2} aria-hidden="true" /></button>}>
          <div className="overflow-x-auto pt-2">
            <table className="w-full min-w-[38.125rem] text-left text-[0.75rem]">
              <thead><tr className="border-b border-border text-muted-foreground">{["Time", "Type", "Message", "Location", "Status"].map((heading) => <th key={heading} className="whitespace-nowrap px-2 pb-2 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{recentEvents.map((event) => <tr key={event.time} className="h-[2.5rem] border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-2 text-muted-foreground">{event.time}</td><td className="px-2"><span className={`inline-flex items-center gap-1.5 font-semibold ${event.tone === "red" ? "text-rose-600" : event.tone === "amber" ? "text-amber-600" : "text-blue-600"}`}><i className={`h-2 w-2 rounded-full ${event.tone === "red" ? "bg-rose-500" : event.tone === "amber" ? "bg-amber-500" : "bg-blue-500"}`} />{event.type}</span></td><td className="whitespace-nowrap px-2 text-foreground">{event.message}</td><td className="whitespace-nowrap px-2 text-muted-foreground">{event.location}</td><td className="px-2"><span className={`rounded-full px-2 py-1 text-[0.6875rem] font-medium ${event.status === "Resolved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : event.status === "Open" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>{event.status}</span></td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
      </section>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[0.75rem] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}
