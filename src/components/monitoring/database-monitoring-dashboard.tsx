"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type FormEvent } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, Check, Database, Download, Plus, X } from "lucide-react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { TechLogo } from "@/components/shared/icon";
import { Button } from "@/components/ui/button";
import type { MetricStat } from "@/data/mock/dashboard";
import { databaseMonitoringData, type DatabaseRecord } from "@/data/mock/database-monitoring";
import type { InfrastructureMapMarker } from "@/components/live-operations/infrastructure-map";

const InfrastructureMap = dynamic(
  () => import("@/components/live-operations/infrastructure-map").then((module) => module.InfrastructureMap),
  { ssr: false, loading: () => <div className="grid h-full min-h-[260px] place-items-center rounded-lg bg-muted text-[13px] text-muted-foreground">Loading location map…</div> },
);

const initialDatabases: DatabaseRecord[] = [...databaseMonitoringData.databases];
const history = databaseMonitoringData.history;
const statusClass: Record<string, string> = {
  Warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Info: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  Healthy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Offline: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

function Donut({ value, color, label, size = 110 }: { value: number; color: string; label: string; size?: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  return <div className="relative shrink-0" style={{ width: size, height: size }}>
    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${label}: ${clamped.toFixed(1)}%`}>
      <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--muted)" strokeWidth="9" />
      <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped / 100)} />
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><b className="font-display text-[20px] font-bold tabular-nums text-foreground">{clamped.toFixed(0)}%</b><span className="text-[12px] text-muted-foreground">{label}</span></div>
  </div>;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg border border-border bg-popover px-3 py-2 text-[12px] text-popover-foreground shadow-lg"><p className="mb-1 font-semibold">{label}</p>{payload.map((item) => <div key={item.name} className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}<b className="ml-auto tabular-nums">{item.value}</b></div>)}</div>;
}

function PerformanceChart({ period }: { period: string }) {
  const pointCount = period === "1h" ? 4 : period === "6h" ? 7 : period === "12h" ? 10 : history.length;
  const chartData = history.slice(-pointCount);
  return <div className="flex min-h-[200px] flex-1 flex-col gap-2">
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">{[["Query Time (ms)", "#2878ed"], ["Connections", "#20b77a"], ["Throughput (QPS)", "#8b5cf6"]].map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>
    <div className="min-h-[220px] min-w-0 flex-1" aria-label="Database query time, connections and throughput chart">
      <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 8, right: 18, left: 4, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="time" interval={3} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 400]} ticks={[0, 100, 200, 300, 400]} tickFormatter={(v) => `${v}`} width={34} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Line dataKey="query" name="Query time (ms)" type="monotone" stroke="#2878ed" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line dataKey="connections" name="Connections" type="monotone" stroke="#20b77a" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line dataKey="throughput" name="Throughput (QPS)" type="monotone" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart></ResponsiveContainer>
    </div>
  </div>;
}

function DatabaseHealth({ healthy, issues, total }: { healthy: number; issues: number; total: number }) {
  const circumference = 2 * Math.PI * 43;
  const percent = total ? healthy / total * 100 : 0;
  const healthLegend: { name: string; count: number; color: string }[] = [
    { name: "Healthy", count: healthy, color: "#20b77a" },
    { name: "Issues", count: issues, color: "#f59e0b" },
    { name: "Offline", count: 0, color: "#94a3b8" },
  ];
  return <div className="flex flex-1 flex-col justify-between gap-3">
    <div className="flex min-h-[180px] items-center justify-center gap-4">
      <div className="relative h-[140px] w-[140px] shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`Database health ${percent.toFixed(1)}%`}><circle cx="50" cy="50" r="43" fill="none" stroke="var(--muted)" strokeWidth="9" /><circle cx="50" cy="50" r="43" fill="none" stroke="#20b77a" strokeWidth="9" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - (total ? healthy / total : 0))} /></svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><Check size={17} className="mb-1 rounded-full bg-emerald-500 p-1 text-white" /><b className="font-display text-[20px] font-bold text-foreground">{percent.toFixed(1)}%</b><span className="text-[12px] text-muted-foreground">Healthy</span></div>
      </div>
      <div className="min-w-[94px] space-y-3 text-[13px]">{healthLegend.map(({ name, count, color }) => <div key={name} className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /><span className="flex-1 text-foreground">{name}</span><b className="tabular-nums">{count}</b></div>)}</div>
    </div>
    <div className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-[12px] ${issues ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40" : "border-emerald-100 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"}`}>
      <span className={`flex items-center gap-1.5 font-semibold ${issues ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>{issues ? <AlertTriangle size={14} /> : <Check size={14} />}{issues ? `${issues} database${issues === 1 ? "" : "s"} need attention` : "All databases are healthy"}</span>
      <span className="whitespace-nowrap text-muted-foreground">{total} monitored</span>
    </div>
  </div>;
}

function StorageUsage({ storage }: { storage: typeof databaseMonitoringData.storage }) {
  const total = storage.usedGb + storage.freeGb;
  const usage = total ? storage.usedGb / total * 100 : 0;
  const fill = usage >= 85 ? "#ef4444" : usage >= 70 ? "#f59e0b" : "#3182f6";
  const fullDays = storage.dailyGrowthGb > 0 ? Math.floor(storage.freeGb / storage.dailyGrowthGb) : 0;
  const growthData = storage.growthHistory.map((value, index) => ({ day: `Day ${index + 1}`, value }));
  const topDatabases = databaseMonitoringData.topDatabasesBySize;
  const largestDatabase = Math.max(...topDatabases.map((item) => item.sizeGb));
  return <div className="flex min-h-0 flex-1 flex-col gap-2">
    <div className="flex items-center justify-center gap-4 sm:justify-start"><Donut value={usage} color={fill} label="Used" size={110} /><div className="min-w-0 flex-1 text-[13px]">
      {[{ label: "Used", value: storage.usedGb, color: fill }, { label: "Free", value: storage.freeGb, color: "#34d399" }, { label: "Total", value: total, color: "#94a3b8" }].map((item) => <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border/60 py-2 last:border-0"><span className="flex min-w-0 items-center gap-2 whitespace-nowrap text-muted-foreground"><i className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />{item.label}</span><b className="whitespace-nowrap tabular-nums text-foreground">{item.value}</b><span className="text-muted-foreground">GB</span></div>)}
    </div></div>
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(120px,40%)] items-center gap-3 border-t border-border pt-2"><div><div className="flex items-center justify-between gap-2 text-[12px]"><span className="text-muted-foreground">Growth (7d)</span><b className="whitespace-nowrap text-foreground">+{storage.dailyGrowthGb.toFixed(1)} GB/day</b></div><p className="mt-1 text-[12px] text-muted-foreground">Estimated full in <b className="text-foreground">~{fullDays} days</b></p></div><div className="h-[54px] min-w-0" aria-label="Seven day storage growth"><ResponsiveContainer width="100%" height="100%"><AreaChart data={growthData}><Tooltip content={<ChartTooltip />} /><Area dataKey="value" name="Storage used (GB)" type="monotone" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.16} strokeWidth={2} dot={false} activeDot={{ r: 4 }} /></AreaChart></ResponsiveContainer></div></div>
    <div id="database-size" className="flex min-h-0 flex-1 flex-col border-t border-border pt-2" aria-label="Top databases by storage size">
      <div className="mb-1 flex items-center justify-between text-[12px]"><span className="font-semibold text-muted-foreground">Top Databases by Size</span><a href="#database-size" className="whitespace-nowrap font-semibold text-primary hover:underline">View all →</a></div>
      <div className="flex min-h-0 flex-1 flex-col justify-between">{topDatabases.map((item) => <div key={item.name} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(60px,1.2fr)_56px] items-center gap-2 text-[12px] leading-5"><span className="truncate text-foreground" title={item.name}>{item.name}</span><span className="h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-blue-500" style={{ width: `${item.sizeGb / largestDatabase * 100}%` }} /></span><b className="whitespace-nowrap text-right tabular-nums text-foreground">{item.sizeGb} GB</b></div>)}</div>
    </div>
  </div>;
}

function ConnectionsOverview({ data }: { data: typeof databaseMonitoringData.connections }) {
  const total = data.active + data.idle;
  const percent = total / data.max * 100;
  const chartData = history.map((point, index) => ({ time: point.time, active: data.history[index] ?? point.active, idle: point.idle }));
  return <div className="flex flex-1 flex-col gap-2">
    <div className="flex items-end justify-between gap-3"><div><b className="font-display text-[26px] font-bold leading-none tabular-nums text-foreground">{total}</b><span className="ml-2 text-[13px] text-muted-foreground">/ {data.max} max connections</span></div><b className="text-[13px] tabular-nums text-foreground">{percent.toFixed(0)}%</b></div>
    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-label={`${percent.toFixed(0)} percent of maximum connections`}><div className="h-full rounded-full bg-blue-500 transition-[width]" style={{ width: `${Math.min(percent, 100)}%` }} /></div>
    <div className="flex items-center gap-4 text-[12px] text-muted-foreground"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-blue-500" />Active <b className="text-foreground">{data.active}</b></span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-slate-400" />Idle <b className="text-foreground">{data.idle}</b></span></div>
    <div className="min-h-[130px] min-w-0 flex-1" aria-label="Connection count history"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="time" interval={3} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis domain={[0, data.max]} ticks={[0, 150, 300, 450, 600]} width={34} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} /><ReferenceLine y={data.max} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `Max ${data.max}`, position: "insideTopRight", fill: "#ef4444", fontSize: 12 }} /><Tooltip content={<ChartTooltip />} /><Area dataKey="active" name="Active" type="monotone" stroke="#3182f6" fill="#3182f6" fillOpacity={0.16} strokeWidth={2} dot={false} /><Area dataKey="idle" name="Idle" type="monotone" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.12} strokeWidth={1.5} dot={false} /></AreaChart></ResponsiveContainer></div>
  </div>;
}

function QueryPerformance({ data }: { data: typeof databaseMonitoringData.query }) {
  const total = data.breakdown.reduce((sum, item) => sum + item.count, 0);
  const breakdown = data.breakdown.map((item) => ({ ...item, percent: total ? item.count / total * 100 : 0 }));
  const peakPoint = history.reduce((best, point) => point.latency > best.latency ? point : best, history[0]);
  const peak = peakPoint.latency;
  const queryTicks = [0, Math.round(peak / 20) * 10, Math.ceil(peak / 80) * 80];
  const queryTimeTicks = history.filter((_, index) => index % Math.ceil(history.length / 4) === 0).map((point) => point.time);
  return <div className="flex flex-1 flex-col gap-3">
    <div className="flex flex-wrap items-end justify-between gap-2"><div><b className="font-display text-[24px] font-bold tabular-nums text-foreground">{data.averageMs} ms</b><p className="text-[12px] text-muted-foreground">Average query time <span className={`font-semibold ${data.averageTrendPercent <= 0 ? "text-emerald-600" : "text-rose-600"}`}>{data.averageTrendPercent <= 0 ? "↓" : "↑"} {Math.abs(data.averageTrendPercent).toFixed(1)}%</span></p></div><div className="flex gap-2 text-[12px]">{[{ label: "QPS", value: data.qps }, { label: "P95", value: `${data.p95Ms} ms` }, { label: "P99", value: `${data.p99Ms} ms` }].map((item) => <div key={item.label} className="rounded-md bg-muted/60 px-2.5 py-1.5"><span className="mr-1.5 text-muted-foreground">{item.label}</span><b className="whitespace-nowrap tabular-nums text-foreground">{item.value}</b></div>)}</div></div>
    <div className="space-y-1.5" aria-label="Query speed distribution"><div className="flex h-3 overflow-hidden rounded-full bg-muted">{breakdown.map((item) => <span key={item.name} title={`${item.name}: ${item.count} (${item.percent.toFixed(1)}%)`} style={{ width: `${item.percent}%`, backgroundColor: item.color }} />)}</div><div className="grid grid-cols-3 gap-2 text-[12px]">{breakdown.map((item) => <div key={item.name} className="flex min-w-0 items-center gap-1.5"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-muted-foreground">{item.name}</span><b className="ml-auto tabular-nums text-foreground">{item.count} · {item.percent.toFixed(1)}%</b></div>)}</div></div>
    <div className="min-h-[110px] min-w-0 flex-1 border-t border-border pt-2" aria-label="Average response time over the last 24 hours"><div className="mb-1 text-[12px] text-muted-foreground">Average response time · peak {peak} ms</div><div className="h-[calc(100%-22px)] min-h-[82px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={history} margin={{ top: 10, right: 14, left: 0, bottom: 0 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="time" ticks={queryTimeTicks} interval={0} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis domain={[0, queryTicks[2]]} ticks={queryTicks} width={34} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><ReferenceDot x={peakPoint.time} y={peak} r={4} fill="#f59e0b" stroke="white" strokeWidth={2} label={{ value: `Peak ${peak} ms`, position: "top", fill: "#b45309", fontSize: 12 }} /><Area dataKey="latency" name="Response time (ms)" type="monotone" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.13} strokeWidth={2} dot={false} activeDot={{ r: 4 }} /></AreaChart></ResponsiveContainer></div></div>
  </div>;
}

function LocationPanel({ databases, onSelect, selectedLocation }: { databases: DatabaseRecord[]; onSelect: (location: string) => void; selectedLocation: string }) {
  const locations = useMemo(() => {
    const grouped = new Map<string, DatabaseRecord[]>();
    databases.forEach((db) => grouped.set(db.location, [...(grouped.get(db.location) ?? []), db]));
    return [...grouped.entries()].map(([name, items]) => ({ name, items, health: items.reduce((sum, db) => sum + db.health, 0) / items.length, status: (items.some((db) => db.status === "Offline") ? "Offline" : items.some((db) => db.status === "Warning") ? "Warning" : "Healthy") as DatabaseRecord["status"] })).sort((a, b) => a.health - b.health);
  }, [databases]);
  const markers: InfrastructureMapMarker[] = useMemo(() => locations.map((location) => ({
    name: location.name,
    lat: location.items[0].lat,
    lng: location.items[0].lng,
    role: "Database location",
    status: location.status === "Offline" ? "critical" : location.status === "Warning" ? "warning" : "healthy",
    servers: location.items.length,
    count: location.items.length,
    health: Number(location.health.toFixed(1)),
    content: <div className="w-[236px] max-w-[calc(100vw-48px)] whitespace-normal break-words text-[12px] leading-snug" aria-label={`${location.name} databases`}>
      <b className="mb-1 block text-[13px] text-slate-900">{location.name}</b>
      <div className="space-y-1">{location.items.map((db) => <span key={db.name} className="flex min-w-0 items-center gap-1.5">
        <TechLogo name={db.engine} className="h-5 w-5 shrink-0 rounded-[4px] [&_svg]:h-3.5 [&_svg]:w-3.5" />
        <span className="min-w-0 flex-1 truncate text-slate-700" title={`${db.engine} · ${db.name}`}>{db.name}</span>
        {db.status === "Healthy" ? <Check size={13} aria-hidden="true" className="shrink-0 text-emerald-600" /> : db.status === "Warning" ? <AlertTriangle size={13} aria-hidden="true" className="shrink-0 text-amber-600" /> : <X size={13} aria-hidden="true" className="shrink-0 text-rose-600" />}
        <span className={`shrink-0 text-[12px] ${statusClass[db.status]}`}>{db.status}</span>
      </span>)}</div>
    </div>,
  })), [locations]);
  const databaseCounts = databases.reduce((result, item) => { result[item.status] += 1; return result; }, { Healthy: 0, Warning: 0, Offline: 0 });
  const healthTone = (health: number) => health >= 99 ? "text-emerald-600 dark:text-emerald-400" : health >= 98 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
  return <div className="flex flex-1 flex-col gap-3">
    <div className="h-[320px] min-h-[320px] flex-1 overflow-hidden rounded-lg [&_.leaflet-control-attribution]:!bottom-1 [&_.leaflet-control-attribution]:!right-1 [&_.leaflet-control-attribution]:!left-auto" aria-label="Database locations map">
      <InfrastructureMap variant="light" markers={markers} center={[30, 18]} zoom={2} minZoom={2} fitMarkers fitPadding={50} legendPosition="overlay-left" legendLabels={{ healthy: "Healthy", warning: "Issues", critical: "Offline" }} legendCounts={{ healthy: databaseCounts.Healthy, warning: databaseCounts.Warning, critical: databaseCounts.Offline }} fallbackOnTileError title="Database health by location" description={`${databases.length} databases · ${locations.length} locations`} onMarkerClick={(marker) => onSelect(marker.name)} />
    </div>
    <div className="divide-y divide-border/70 border-t border-border" aria-label="Database locations, worst health first">{locations.slice(0, 5).map((location) => <button type="button" key={location.name} onClick={() => onSelect(location.name)} aria-pressed={selectedLocation === location.name} className={`grid h-8 w-full grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 px-1 text-left text-[13px] transition hover:bg-muted/50 ${selectedLocation === location.name ? "bg-blue-50/70 dark:bg-blue-950/30" : ""}`} title={location.items.map((db) => `${db.name} · ${db.engine} · ${db.status}`).join("\n")}><span className="flex min-w-0 items-center gap-2"><i className={`h-2 w-2 shrink-0 rounded-full ${location.status === "Healthy" ? "bg-emerald-500" : location.status === "Warning" ? "bg-amber-500" : "bg-rose-500"}`} aria-label={location.status} /><span className="truncate font-medium text-foreground">{location.name}</span></span><span className={`flex items-center gap-1 whitespace-nowrap text-[12px] ${location.status === "Healthy" ? "text-emerald-700 dark:text-emerald-300" : location.status === "Warning" ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300"}`}>{location.status === "Healthy" ? <Check size={13} /> : location.status === "Warning" ? <AlertTriangle size={13} /> : <X size={13} />}{location.status}</span><span className="whitespace-nowrap text-[12px] text-muted-foreground">{location.items.length} DB</span><b className={`whitespace-nowrap tabular-nums ${healthTone(location.health)}`}>{location.health.toFixed(1)}%</b></button>)}</div>
    {databases.some((database) => database.status !== "Healthy") ? <div className="max-h-[62px] overflow-auto border-t border-border pt-1.5" aria-label="Databases needing attention"><p className="mb-0.5 text-[12px] font-semibold text-foreground">Needs attention</p>{databases.filter((database) => database.status !== "Healthy").slice(0, 2).map((database) => <button type="button" key={database.name} onClick={() => onSelect(database.location)} className={`flex h-6 w-full items-center justify-between gap-2 rounded-md px-1 text-left text-[12px] hover:bg-muted/50 ${selectedLocation === database.location ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}><span className="min-w-0 truncate"><b className="text-foreground">{database.name}</b><span className="text-muted-foreground"> · {database.issue ?? database.status}</span></span><span className={`flex shrink-0 items-center gap-1 font-medium ${database.status === "Warning" ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300"}`}>{database.status === "Warning" ? <AlertTriangle size={13} /> : <X size={13} />}{database.status}</span></button>)}</div> : <p className="border-t border-border pt-2 text-[12px] text-emerald-700 dark:text-emerald-300">All databases healthy</p>}
    {locations.length === 0 && <div className="rounded-md bg-muted/50 p-4 text-[13px] text-muted-foreground">No database locations are available.</div>}
  </div>;
}

export function DatabaseMonitoringDashboard() {
  const [notice, setNotice] = useState("");
  const [period, setPeriod] = useState("24h");
  const [databaseRows, setDatabaseRows] = useState<DatabaseRecord[]>(initialDatabases);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [eventTab, setEventTab] = useState<"events" | "slow">("events");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newDatabaseName, setNewDatabaseName] = useState("");
  const [lastUpdated, setLastUpdated] = useState("Nov 7, 2026 12:09");
  const [selectedLocation, setSelectedLocation] = useState("");
  const issueCount = databaseRows.filter((database) => database.status !== "Healthy").length;
  const healthyCount = databaseRows.length - issueCount;
  const storageTotal = databaseMonitoringData.storage.usedGb + databaseMonitoringData.storage.freeGb;
  const storagePercent = storageTotal ? databaseMonitoringData.storage.usedGb / storageTotal * 100 : 0;
  const connectionTotal = databaseMonitoringData.connections.active + databaseMonitoringData.connections.idle;
  const sortedDatabases = useMemo(() => [...databaseRows].sort((a, b) => {
    const delta = Number.parseInt(a.query, 10) - Number.parseInt(b.query, 10);
    return sortDirection === "desc" ? -delta : delta;
  }), [databaseRows, sortDirection]);
  const currentStats: MetricStat[] = [
    { label: "Total Databases", value: String(databaseRows.length), change: "1 new", trend: "up", tone: "blue", icon: "database" },
    { label: "Healthy", value: String(healthyCount), change: `${databaseRows.length ? (healthyCount / databaseRows.length * 100).toFixed(1) : "0.0"}%`, trend: "up", tone: "green", icon: "online" },
    { label: "Issues", value: String(issueCount), change: `${databaseRows.length ? (issueCount / databaseRows.length * 100).toFixed(1) : "0.0"}%`, trend: "down", tone: "red", icon: "octagon-alert" },
    { label: "Avg Query Time", value: `${databaseMonitoringData.query.averageMs} ms`, change: `${Math.abs(databaseMonitoringData.query.averageTrendPercent).toFixed(1)}%`, trend: databaseMonitoringData.query.averageTrendPercent <= 0 ? "down" : "up", tone: "blue", icon: "activity" },
    { label: "Total Size", value: `${storageTotal} GB`, change: "5.2%", trend: "up", tone: "green", icon: "storage" },
    { label: "Uptime", value: "99.95%", change: "0.05%", trend: "up", tone: "green", icon: "shield-check" },
  ];
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  const refreshPage = () => {
    setLastUpdated(new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date()));
    notify("Database monitoring data refreshed.");
  };
  const addDatabase = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newDatabaseName.trim();
    if (!name) return;
    if (databaseRows.some((database) => database.name.toLowerCase() === name.toLowerCase())) { notify("A database with that name already exists."); return; }
    setDatabaseRows((current) => [{ name, engine: "postgresql", location: "Virginia, USA", lat: 37.4316, lng: -78.6569, query: "0 ms", throughput: "0 QPS", status: "Healthy", health: 100, sizeGb: 0 }, ...current]);
    setNewDatabaseName(""); setAddDialogOpen(false); notify(`${name} added to monitoring.`);
  };
  const exportReport = () => {
    const rows = databaseMonitoringData.events.map(({ time, database, event, message, status }) => [time, database, event, message, status]);
    const csv = [["Time", "Database", "Event", "Message", "Status"], ...rows].map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "database-monitoring-report.csv"; link.click(); URL.revokeObjectURL(url); notify("Database monitoring report exported.");
  };
  const periodControl = <div className="flex items-center gap-0.5" role="group" aria-label="Performance chart time range">{["1h", "6h", "12h", "24h"].map((item) => <button type="button" key={item} onClick={() => setPeriod(item)} aria-pressed={period === item} className={`rounded px-1.5 py-1 text-[12px] font-semibold ${period === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{item}</button>)}</div>;
  const locationMarkerCount = new Set(databaseRows.map((database) => database.location)).size;

  return <div className="space-y-4 pb-3">
    <PageMeta breadcrumbs={["Monitoring", "Database Monitoring"]} lastUpdated={lastUpdated} onRefresh={refreshPage} />
    <PageHeading title="Database Monitoring" description="Monitor your databases performance, health and activity in real-time." icon={<Database size={19} />} actionsAlign="top">
      <div className="flex shrink-0 items-center gap-2"><span className={`hidden items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold sm:flex ${issueCount ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>{issueCount ? <AlertTriangle size={14} /> : <Check size={14} />}{issueCount ? `${issueCount} Database${issueCount === 1 ? "" : "s"} Need Attention` : "All Databases Healthy"}</span><Button variant="outline" size="sm" onClick={exportReport} className="h-10 gap-2 whitespace-nowrap px-4 text-[13px]"><Download size={15} />Export Report</Button><Button size="sm" onClick={() => setAddDialogOpen(true)} className="h-10 gap-2 whitespace-nowrap px-4 text-[13px]"><Plus size={15} />Add Database</Button></div>
    </PageHeading>
    <section aria-label="Database monitoring summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{currentStats.map((item) => <MetricCard key={item.label} item={item} className="h-[108px] gap-3 p-4" labelClassName="text-[13px]" valueClassName="text-[24px]" trendClassName="text-[12px]" />)}</section>

    <section aria-label="Database performance and status" className="grid items-stretch gap-4 xl:grid-cols-[1.7fr_0.85fr_1.05fr]">
      <Panel title="Database Performance Overview" className="min-w-0 p-4" titleClassName="text-[16px] font-semibold" headerClassName="h-10" action={periodControl}><PerformanceChart period={period} /></Panel>
      <Panel title="Database Status" className="flex min-w-0 flex-col p-4" titleClassName="text-[16px] font-semibold" headerClassName="h-10"><DatabaseHealth healthy={healthyCount} issues={issueCount} total={databaseRows.length} /></Panel>
      <Panel title="Top Databases by Load" className="min-w-0 p-4" titleClassName="text-[16px] font-semibold" headerClassName="h-10"><div className="min-h-[200px] flex-1 overflow-x-auto pt-1"><table className="w-full min-w-[360px] text-left text-[12px]"><thead><tr className="border-b border-border text-[12px] text-muted-foreground"><th className="whitespace-nowrap px-2 pb-2 font-medium">Database</th><th><button type="button" className="whitespace-nowrap px-2 pb-2 font-medium hover:text-foreground" onClick={() => setSortDirection((direction) => direction === "desc" ? "asc" : "desc")} aria-label={`Sort query time ${sortDirection === "desc" ? "ascending" : "descending"}`}>Query Time {sortDirection === "desc" ? "↓" : "↑"}</button></th><th className="whitespace-nowrap px-2 pb-2 font-medium">Throughput</th><th className="whitespace-nowrap px-2 pb-2 font-medium">Status</th></tr></thead><tbody>{sortedDatabases.slice(0, 6).map((database) => <tr key={database.name} className="h-10 border-b border-border/70 transition-colors hover:bg-muted/40 last:border-0"><td className="whitespace-nowrap px-2 py-2 font-medium text-foreground"><TechLogo name={database.engine} className="mr-2 inline-grid h-6 w-6 align-middle [&_svg]:h-4 [&_svg]:w-4" />{database.name}</td><td className="whitespace-nowrap px-2 py-2 tabular-nums text-foreground">{database.query}</td><td className="whitespace-nowrap px-2 py-2 tabular-nums text-foreground">{database.throughput}</td><td className="px-2 py-2"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-[12px] font-medium ${statusClass[database.status]}`}>{database.status}</span></td></tr>)}</tbody></table></div></Panel>
    </section>

    <section aria-label="Database storage, connections and query performance" className="grid items-stretch gap-4 xl:grid-cols-3">
      <Panel title="Storage Usage" className="flex min-h-[340px] min-w-0 flex-col p-4" titleClassName="text-[16px] font-semibold" headerClassName="h-10"><StorageUsage storage={databaseMonitoringData.storage} /></Panel>
      <Panel title="Connections Overview" className="flex min-h-[340px] min-w-0 flex-col p-4" titleClassName="text-[16px] font-semibold" headerClassName="h-10"><ConnectionsOverview data={databaseMonitoringData.connections} /></Panel>
      <Panel title="Query Performance" className="flex min-h-[340px] min-w-0 flex-col p-4" titleClassName="text-[16px] font-semibold" headerClassName="h-10"><QueryPerformance data={databaseMonitoringData.query} /></Panel>
    </section>

    <section aria-label="Database events and locations" className="grid items-stretch gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Panel title="Recent Database Events" className="flex min-h-[640px] min-w-0 flex-col p-4" titleClassName="text-[16px] font-semibold" headerClassName="h-10" action={<div className="flex items-center gap-1 rounded-md bg-muted p-0.5" role="tablist" aria-label="Database activity"><button type="button" role="tab" aria-selected={eventTab === "events"} onClick={() => setEventTab("events")} className={`rounded px-2 py-1 text-[12px] ${eventTab === "events" ? "bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground"}`}>Events</button><button type="button" role="tab" aria-selected={eventTab === "slow"} onClick={() => setEventTab("slow")} className={`rounded px-2 py-1 text-[12px] ${eventTab === "slow" ? "bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground"}`}>Slow Queries</button></div>}>
        {eventTab === "events" ? <div className="flex min-h-0 flex-1 flex-col"><div id="database-events" className="flex-1 overflow-x-auto pt-1"><table className="w-full min-w-[540px] text-left text-[13px]"><thead><tr className="border-b border-border text-[12px] text-muted-foreground">{["Time", "Database", "Event", "Message", "Status"].map((heading) => <th key={heading} className="whitespace-nowrap px-2 pb-2 font-medium">{heading}</th>)}</tr></thead><tbody>{databaseMonitoringData.events.slice(0, 10).map((item) => <tr key={`${item.time}-${item.database}-${item.event}`} className="h-11 border-b border-border/70 transition-colors hover:bg-muted/40 last:border-0"><td className="whitespace-nowrap px-2 py-2 text-foreground">{item.time}</td><td className="whitespace-nowrap px-2 py-2"><span className="inline-flex items-center gap-2 font-medium text-foreground"><TechLogo name={item.engine} className="h-6 w-6 rounded-[5px] [&_svg]:h-4 [&_svg]:w-4" />{item.database}</span></td><td className="whitespace-nowrap px-2 py-2 text-foreground">{item.event}</td><td className="max-w-[180px] truncate px-2 py-2 text-muted-foreground" title={item.message}>{item.message}</td><td className="px-2 py-2"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-[12px] font-medium ${statusClass[item.status]}`}>{item.status}</span></td></tr>)}</tbody></table></div><div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-[12px] text-muted-foreground"><span>Showing 1-{Math.min(10, databaseMonitoringData.events.length)} of {databaseMonitoringData.eventsTotal} events</span><a href="#database-events" className="font-semibold text-primary hover:underline">View all →</a></div></div> : <div className="flex min-h-0 flex-1 flex-col"><div className="flex-1 overflow-auto pt-1"><table className="w-full min-w-[520px] text-left text-[13px]"><thead><tr className="border-b border-border text-[12px] text-muted-foreground">{["Time", "Database", "Query", "Duration", "Calls"].map((heading) => <th key={heading} className="whitespace-nowrap px-2 pb-2 font-medium">{heading}</th>)}</tr></thead><tbody>{databaseMonitoringData.slowQueries.map((item) => <tr key={`${item.time}-${item.database}-${item.query}`} className="h-11 border-b border-border/70 hover:bg-muted/40"><td className="whitespace-nowrap px-2 text-foreground">{item.time}</td><td className="whitespace-nowrap px-2"><span className="inline-flex items-center gap-2 font-medium"><TechLogo name={item.engine} className="h-6 w-6 rounded-[5px] [&_svg]:h-4 [&_svg]:w-4" />{item.database}</span></td><td className="max-w-[190px] truncate px-2 text-foreground" title={item.query}>{item.query}</td><td className="whitespace-nowrap px-2 font-semibold tabular-nums text-amber-700">{item.duration}</td><td className="px-2 tabular-nums text-muted-foreground">{item.calls}</td></tr>)}</tbody></table></div><p className="mt-auto border-t border-border pt-3 text-[12px] text-muted-foreground">Showing {databaseMonitoringData.slowQueries.length} slow-query samples · sorted by duration</p></div>}
      </Panel>
      <Panel title="Database Health by Location" className="flex min-h-[640px] min-w-0 flex-col p-4" titleClassName="text-[16px] font-semibold" headerClassName="h-10" action={<span className="whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{databaseRows.length} DB · {locationMarkerCount} locations</span>}>
        <LocationPanel databases={databaseRows} onSelect={setSelectedLocation} selectedLocation={selectedLocation} />
      </Panel>
    </section>

    {addDialogOpen && <div className="fixed inset-0 z-[1200] grid place-items-center bg-slate-950/35 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddDialogOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="add-database-title" className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><div><h2 id="add-database-title" className="text-lg font-semibold text-foreground">Add database</h2><p className="mt-1 text-[13px] text-muted-foreground">Add a database to the demo monitoring list.</p></div><button type="button" onClick={() => setAddDialogOpen(false)} aria-label="Close dialog" className="rounded-md p-2 text-muted-foreground hover:bg-muted"><X size={18} /></button></div><form onSubmit={addDatabase} className="space-y-4"><label className="block text-[13px] font-medium text-foreground" htmlFor="database-name">Database name<input id="database-name" autoFocus value={newDatabaseName} onChange={(event) => setNewDatabaseName(event.target.value)} placeholder="e.g. billing_db" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" required /></label><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)} className="h-10 px-4 text-[13px]">Cancel</Button><Button type="submit" className="h-10 gap-2 px-4 text-[13px]"><Plus size={15} />Add database</Button></div></form></section></div>}
    {notice && <div role="status" className="fixed bottom-4 right-4 z-[1300] rounded-lg border border-border bg-card px-4 py-3 text-[13px] text-foreground shadow-lg">{notice}</div>}
  </div>;
}
