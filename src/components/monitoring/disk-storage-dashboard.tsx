"use client";

import { useMemo, useRef, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowDown, ArrowRight, ArrowUp, ChevronLeft, ChevronRight, Download, MoreVertical, Plus, Server } from "lucide-react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import type { MetricStat } from "@/data/mock/dashboard";
import { cn } from "@/lib/utils";

const stats: MetricStat[] = [
  { label: "Total Disk Usage", value: "61.3%", change: "7.2%", trend: "down", tone: "blue", icon: "storage", detail: "vs last 24 hours" },
  { label: "Used Storage", value: "12.45 TB", change: "1.8 TB", trend: "up", tone: "green", icon: "storage", detail: "of 20.30 TB" },
  { label: "Available Storage", value: "7.85 TB", change: "1.2 TB", trend: "up", tone: "purple", icon: "hard-drive-download", detail: "of 20.30 TB" },
  { label: "Avg IOPS", value: "8,512", change: "9.6%", trend: "up", tone: "amber", icon: "activity", detail: "vs last 24 hours" },
  { label: "Avg Throughput", value: "245 MB/s", change: "12.3%", trend: "up", tone: "red", icon: "network", detail: "vs last 24 hours" },
  { label: "Disks Monitored", value: "56", change: "3", trend: "up", tone: "blue", icon: "server", detail: "Across 24 servers" },
];

const diskUsagePercent = 61.3;
const diskUsageSamples = [58.2, 57.6, 59.1, 58.4, 60.2, 59.4, 60.1, 58.9, 59.8, 60.5, 60.8, diskUsagePercent];
const chartTimes = ["12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "00:00", "02:00", "04:00", "06:00", "08:00", "10:00"];
const throughputFactors = [0.78, 0.74, 0.83, 1, 0.82, 0.94, 0.86, 0.91, 0.87, 0.96, 0.9, 0.88];
const iopsFactors = [0.98, 0.94, 1.03, 1.08, 0.96, 1.12, 1.04, 1.09, 1.01, 1.1, 1.02, 1.06];

/**
 * Single source of truth for disk volumes. The usage table, the I/O table and
 * the "Top Servers by Disk Usage" / "Top Servers by I/O Throughput" cards all
 * read from this list so their numbers always match.
 */
export interface DiskVolume {
  server: string;
  mount: string;
  device: string;
  filesystem: string;
  /** Capacity in GB. */
  capacityGB: number;
  /** Used space in GB. */
  usedGB: number;
  /** Usage percentage. */
  usage: number;
  /** Read throughput in MB/s. */
  read: number;
  /** Write throughput in MB/s. */
  write: number;
  /** IOPS in thousands. */
  iopsK: number;
  /** Average I/O latency in milliseconds. */
  latency: number;
}

const diskVolumes: DiskVolume[] = [
  { server: "web-01", mount: "/", device: "/dev/sda1", filesystem: "xfs", capacityGB: 200, usedGB: 146.2, usage: 73.1, read: 60.3, write: 40.1, iopsK: 6.2, latency: 18 },
  { server: "db-01", mount: "/var/lib/postgres", device: "/dev/nvme0n1", filesystem: "xfs", capacityGB: 500, usedGB: 321.5, usage: 64.3, read: 152.4, write: 98.7, iopsK: 12.4, latency: 14 },
  { server: "app-server-02", mount: "/", device: "/dev/nvme1n1", filesystem: "ext4", capacityGB: 150, usedGB: 86.7, usage: 57.8, read: 98.7, write: 86.2, iopsK: 10.1, latency: 28 },
  { server: "logs-01", mount: "/var/log", device: "/dev/sdb1", filesystem: "xfs", capacityGB: 300, usedGB: 143.9, usage: 48.0, read: 28.7, write: 22.9, iopsK: 3.1, latency: 54 },
  { server: "backup-01", mount: "/backup", device: "/dev/sdc1", filesystem: "xfs", capacityGB: 2048, usedGB: 812.3, usage: 39.7, read: 25.4, write: 18.6, iopsK: 2.6, latency: 43 },
  { server: "cache-01", mount: "/cache", device: "/dev/nvme0n1", filesystem: "ext4", capacityGB: 250, usedGB: 78.4, usage: 31.4, read: 45.6, write: 35.2, iopsK: 4.8, latency: 11 },
  { server: "archive-01", mount: "/archive", device: "/dev/sdd1", filesystem: "xfs", capacityGB: 1024, usedGB: 286.7, usage: 28.0, read: 19.8, write: 14.2, iopsK: 1.9, latency: 33 },
  { server: "worker-02", mount: "/var/lib/data", device: "/dev/nvme2n1", filesystem: "ext4", capacityGB: 400, usedGB: 92.0, usage: 23.0, read: 16.4, write: 12.8, iopsK: 1.5, latency: 17 },
  { server: "gw-01", mount: "/", device: "/dev/nvme0n1", filesystem: "xfs", capacityGB: 120, usedGB: 44.3, usage: 36.9, read: 88.6, write: 71.2, iopsK: 9.1, latency: 16 },
  { server: "monitor-01", mount: "/var/lib/monitoring", device: "/dev/sdb1", filesystem: "ext4", capacityGB: 180, usedGB: 63.9, usage: 35.5, read: 12.4, write: 8.9, iopsK: 1.8, latency: 7 },
  { server: "api-gateway", mount: "/", device: "/dev/sda1", filesystem: "btrfs", capacityGB: 90, usedGB: 28.8, usage: 32.0, read: 54.2, write: 36.8, iopsK: 6.6, latency: 31 },
  { server: "db-02", mount: "/var/lib/postgres", device: "/dev/nvme0n1", filesystem: "xfs", capacityGB: 800, usedGB: 248.0, usage: 31.0, read: 121.3, write: 79.4, iopsK: 10.2, latency: 15 },
  { server: "app-03", mount: "/opt/app", device: "/dev/sda1", filesystem: "ext4", capacityGB: 220, usedGB: 63.8, usage: 29.0, read: 63.7, write: 52.1, iopsK: 6.2, latency: 22 },
  { server: "web-02", mount: "/", device: "/dev/sda1", filesystem: "xfs", capacityGB: 160, usedGB: 44.8, usage: 28.0, read: 38.4, write: 27.2, iopsK: 4.1, latency: 12 },
  { server: "cache-02", mount: "/cache", device: "/dev/nvme1n1", filesystem: "ext4", capacityGB: 300, usedGB: 78.0, usage: 26.0, read: 35.2, write: 27.9, iopsK: 3.8, latency: 8 },
  { server: "logs-02", mount: "/var/log", device: "/dev/sdb1", filesystem: "xfs", capacityGB: 500, usedGB: 125.0, usage: 25.0, read: 21.4, write: 18.2, iopsK: 2.6, latency: 35 },
];

/** Total number of disks monitored across the fleet. */
const TOTAL_DISKS = 56;
const TOTAL_SERVERS = 56;

/** Formats a capacity in GB as "200 GB" or "2.00 TB". */
function formatCapacity(gb: number): string {
  return gb >= 1024 ? `${(gb / 1024).toFixed(2)} TB` : `${gb} GB`;
}

/** Threshold colours for a usage percentage. */
function usageTone(usage: number): { bar: string } {
  if (usage >= 85) return { bar: "bg-[#F87171]" };
  if (usage >= 70) return { bar: "bg-[#FBBF24]" };
  return { bar: "bg-[#60A5FA]" };
}

/** Soft tint pill tone for a latency value in milliseconds. */
function latencyTone(latency: number): string {
  if (latency > 50) return "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300";
  if (latency >= 20) return "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300";
  return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
}

/** Distinct muted colours so every server gets its own bar colour. */
const serverPalette = [
  "bg-[#60A5FA]",
  "bg-[#34D399]",
  "bg-[#FBBF24]",
  "bg-[#A78BFA]",
  "bg-[#22D3EE]",
  "bg-[#F87171]",
  "bg-[#F472B6]",
  "bg-[#84CC16]",
  "bg-[#FB923C]",
  "bg-[#38BDF8]",
  "bg-[#4ADE80]",
  "bg-[#94A3B8]",
  "bg-[#C084FC]",
  "bg-[#2DD4BF]",
  "bg-[#FDE047]",
  "bg-[#818CF8]",
];

/** Stable server -> colour map so the same server keeps its colour everywhere. */
const serverColors = (() => {
  const map = new Map<string, string>();
  [...new Set(diskVolumes.map((volume) => volume.server))].forEach((server, index) => {
    map.set(server, serverPalette[index % serverPalette.length]);
  });
  return map;
})();

/** Highest usage volume per server, used by the "Top Servers by Disk Usage" card. */
const topDiskUsage = (() => {
  const perServer = new Map<string, number>();
  for (const volume of diskVolumes) {
    perServer.set(volume.server, Math.max(perServer.get(volume.server) ?? 0, volume.usage));
  }
  return [...perServer.entries()]
    .map(([name, usage]) => ({ name, usage, color: serverColors.get(name) ?? serverPalette[0] }))
    .sort((a, b) => b.usage - a.usage)
    .slice(0, 8);
})();

/** Highest total throughput per server, used by the "Top Servers by I/O Throughput" card. */
const topThroughput = (() => {
  const perServer = new Map<string, number>();
  for (const volume of diskVolumes) {
    perServer.set(volume.server, Math.max(perServer.get(volume.server) ?? 0, volume.read + volume.write));
  }
  return [...perServer.entries()]
    .map(([name, value]) => ({ name, value, label: `${Math.round(value)} MB/s`, color: serverColors.get(name) ?? serverPalette[0] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
})();

const storageSlices = [
  { name: "Used", value: 12.45, color: "#2878ed" },
  { name: "Free", value: 7.85, color: "#35b879" },
  { name: "Snapshots", value: 1.25, color: "#8a45df" },
  { name: "Other", value: 0.75, color: "#f39a12" },
];
const totalStorageTB = storageSlices.reduce((total, item) => total + item.value, 0);
const totalPartitions = TOTAL_DISKS * 2;

const usageBands = [
  { name: "0-50%", value: 24, color: "#35b879" },
  { name: "50-75%", value: 18, color: "#2878ed" },
  { name: "75-90%", value: 8, color: "#f39a12" },
  { name: "90-100%", value: 6, color: "#ed3346" },
];

const fileSystems = [
  { name: "xfs", value: 42, color: "#35b879" },
  { name: "ext4", value: 30, color: "#8a45df" },
  { name: "ntfs", value: 12, color: "#f39a12" },
  { name: "btrfs", value: 8, color: "#2878ed" },
  { name: "other", value: 6, color: "#20b9d1" },
];
const totalFileSystems = fileSystems.reduce((total, item) => total + item.value, 0);

const formatDiskAmount = (gigabytes: number) => gigabytes >= 1024
  ? `${(gigabytes / 1024).toFixed(2)} TB`
  : `${Number(gigabytes.toFixed(1))} GB`;
const primaryIoVolume = diskVolumes.find((volume) => volume.server === "db-01") ?? diskVolumes[0];

const diskUsageHistory = chartTimes.map((time, index) => {
  const used = diskUsageSamples[index];
  const other = 3.7;
  return { time, used, other, free: 100 - used - other };
});
const throughputHistory = chartTimes.map((time, index) => ({
  time,
  read: Number((primaryIoVolume.read * throughputFactors[index]).toFixed(1)),
  write: Number((primaryIoVolume.write * throughputFactors[index]).toFixed(1)),
}));
const iopsBase = primaryIoVolume.iopsK * 1000;
const iopsHistory = chartTimes.map((time, index) => ({
  time,
  read: Math.round(iopsBase * 0.62 * iopsFactors[index]),
  write: Math.round(iopsBase * 0.38 * iopsFactors[index]),
}));
const averageOf = (items: number[]) => items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : 0;
const throughputReadValues = throughputHistory.map((point) => point.read);
const throughputWriteValues = throughputHistory.map((point) => point.write);
const iopsValues = iopsHistory.map((point) => point.read + point.write);

const alerts = [
  { text: "Disk usage high on web-01 (/dev/sda1)", ago: "2m ago", tone: "critical", color: "#F87171" },
  { text: "Disk I/O wait time high on db-01", ago: "8m ago", tone: "warning", color: "#FBBF24" },
  { text: "Disk usage high on app-server-02 (/)", ago: "12m ago", tone: "warning", color: "#FBBF24" },
  { text: "Disk space low on logs-01 (/var/log)", ago: "18m ago", tone: "warning", color: "#FBBF24" },
  { text: "Disk temperature high on backup-01", ago: "25m ago", tone: "info", color: "#60A5FA" },
  { text: "Disk I/O latency elevated on db-02", ago: "31m ago", tone: "warning", color: "#FBBF24" },
  { text: "Filesystem check completed on archive-01", ago: "42m ago", tone: "info", color: "#60A5FA" },
];
const TOTAL_ALERTS = 24;

type DiskChartSeries = { key: string; name: string; color: string; unit: string };
type DiskChartPoint = Record<string, string | number> & { time: string };

function DiskChartTooltip({ active, payload, label, lines }: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string;
  lines: DiskChartSeries[];
}) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
    <div className="mb-1.5 text-[12px] font-semibold text-foreground">{label}</div>
    <div className="space-y-1">{payload.map((entry) => {
      const series = lines.find((item) => item.key === entry.dataKey);
      if (!series) return null;
      return <div key={series.key} className="flex items-center justify-between gap-5 whitespace-nowrap text-[12px]">
        <span className="flex items-center gap-1.5 text-muted-foreground"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: series.color }} />{series.name}</span>
        <b className="tabular-nums text-foreground">{Number(entry.value ?? 0).toFixed(series.unit === "%" ? 1 : 0)} {series.unit}</b>
      </div>;
    })}</div>
  </div>;
}

function chartTicks(data: DiskChartPoint[]) {
  if (data.length <= 6) return data.map((point) => point.time);
  if (data.length >= 11) return data.filter((_, index) => index % 2 === 0).slice(0, 6).map((point) => point.time);
  return Array.from({ length: 6 }, (_, index) => data[Math.round(index * (data.length - 1) / 5)]?.time).filter((time): time is string => Boolean(time));
}

function TrendChart({
  id, data, lines, kind, range, aggregation, summary, unitTitle, onToast,
}: {
  id: string;
  data: DiskChartPoint[];
  lines: DiskChartSeries[];
  kind: "stacked" | "area" | "bar";
  range: string;
  aggregation: string;
  summary: { label: string; value: string; tone?: string }[];
  unitTitle?: string;
  onToast: (message: string) => void;
}) {
  const [enabled, setEnabled] = useState(lines.map((line) => line.key));
  const chartRef = useRef<HTMLDivElement>(null);
  const visibleData = useMemo(() => {
    const points = { "1H": 1, "6H": 3, "12H": 6, "24H": data.length }[range] ?? data.length;
    return data.slice(-Math.min(points, data.length));
  }, [data, range]);
  const latestTime = visibleData.at(-1)?.time;
  const ticks = chartTicks(visibleData);
  const activeLines = lines.filter((line) => enabled.includes(line.key));
  const peak = kind === "area" && lines.some((line) => line.key === "read")
    ? visibleData.reduce<{ time: string; value: number }>((best, point) => Number(point.read) > best.value ? { time: point.time, value: Number(point.read) } : best, { time: visibleData[0]?.time ?? "", value: 0 })
    : null;
  const exportPng = () => {
    const svg = chartRef.current?.querySelector(".recharts-surface");
    if (!(svg instanceof SVGElement)) return onToast("Chart image is not ready yet.");
    const image = new Image();
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" }));
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || 1000;
      canvas.height = image.naturalHeight || 360;
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--card") || "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `${id}.png`;
        link.click();
      }
      URL.revokeObjectURL(url);
    };
    image.onerror = () => { URL.revokeObjectURL(url); onToast("Could not export chart image."); };
    image.src = url;
  };
  const maxValue = Math.max(1, ...visibleData.flatMap((point) => activeLines.map((line) => Number(point[line.key] ?? 0))));
  const maxY = unitTitle === "MB/s" ? 300 : kind === "stacked" ? 100 : Math.ceil(maxValue * 1.12 / 1000) * 1000;
  const barTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxY * ratio));

  return <div className="flex min-h-0 flex-1 flex-col gap-2">
    <div className="flex h-[54px] min-h-[54px] flex-wrap content-start items-start gap-x-2 gap-y-1.5 overflow-visible">
      {lines.map((line) => {
        const isOn = enabled.includes(line.key);
        const latest = Number(visibleData.at(-1)?.[line.key] ?? 0);
        return <button key={line.key} title={isOn ? `Hide ${line.name}` : "Click to show"} aria-pressed={isOn} onClick={() => setEnabled((current) => isOn ? current.filter((key) => key !== line.key) : [...current, line.key])} className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-[12px] font-medium ${isOn ? "border-border bg-background text-foreground" : "border-transparent bg-muted text-muted-foreground line-through"}`}><i className="h-2 w-2 rounded-full" style={{ backgroundColor: isOn ? line.color : "#94a3b8" }} />{line.name}<b className="tabular-nums">{latest.toFixed(line.unit === "%" ? 1 : 0)} {line.unit}</b></button>;
      })}
    </div>
    <div ref={chartRef} data-chart-id={id} className="relative min-h-[220px] flex-1" aria-label={`${id} chart, latest point ${latestTime ?? ""}`}>
      {unitTitle && <span className="absolute left-10 top-0 z-10 text-[10px] font-medium text-muted-foreground">{unitTitle}</span>}
      {kind === "stacked" && <span className="pointer-events-none absolute right-5 top-[15%] z-10 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">Capacity warning</span>}
      <ResponsiveContainer width="100%" height="100%">
        {kind === "bar" ? <BarChart data={visibleData} syncId="disk-storage-trends" syncMethod="value" barGap={3} barCategoryGap="20%" margin={{ top: 18, right: 16, left: 2, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical /><XAxis dataKey="time" ticks={ticks} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} padding={{ left: 4, right: 16 }} /><YAxis domain={[0, maxY]} ticks={barTicks} tickFormatter={(value) => value === 0 ? "0" : `${(value / 1000).toFixed(value % 1000 ? 1 : 0)}K`} width={36} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }} content={<DiskChartTooltip lines={lines} />} />{activeLines.map((line) => <Bar key={line.key} dataKey={line.key} name={line.name} fill={line.color} radius={[3, 3, 0, 0]} maxBarSize={12} />)}
        </BarChart> : <AreaChart data={visibleData} syncId="disk-storage-trends" syncMethod="value" stackOffset={kind === "stacked" ? "none" : undefined} margin={{ top: 8, right: 16, left: 2, bottom: 0 }}>
          <defs>{lines.map((line) => <linearGradient key={line.key} id={`${id}-${line.key}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={line.color} stopOpacity={line.key === "other" ? 0.25 : 0.35} /><stop offset="100%" stopColor={line.color} stopOpacity={0.05} /></linearGradient>)}</defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical /><XAxis dataKey="time" ticks={ticks} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} padding={{ left: 4, right: 16 }} /><YAxis domain={kind === "stacked" ? [0, 100] : [0, maxY]} ticks={kind === "stacked" ? [0, 25, 50, 75, 100] : [0, 100, 200, 300]} tickFormatter={(value) => unitTitle ? String(value) : `${value}%`} width={40} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }} content={<DiskChartTooltip lines={lines} />} />
          {kind === "stacked" && <ReferenceLine y={85} stroke="#F87171" strokeDasharray="4 4" />}
          {peak && <ReferenceDot x={peak.time} y={peak.value} r={4} fill={lines[0]?.color} stroke="var(--card)" strokeWidth={2} />}
          {activeLines.map((line) => <Area key={line.key} dataKey={line.key} name={line.name} type="monotone" stroke={line.color} strokeWidth={2} fill={`url(#${id}-${line.key}-fill)`} dot={false} activeDot={{ r: 4 }} stackId={kind === "stacked" ? "capacity" : undefined} />)}
        </AreaChart>}
      </ResponsiveContainer>
    </div>
    <div className="flex h-10 min-h-10 flex-wrap content-center items-center justify-center gap-x-2 gap-y-0 text-[12px] leading-5 text-muted-foreground">
      {[...summary, ...(kind === "area" && peak ? [{ label: "Peak", value: `${peak.value.toFixed(1)} MB/s · ${peak.time}` }] : [])].map((item, index) => <span key={item.label} className="whitespace-nowrap">{index > 0 && <span className="mr-2 text-muted-foreground/60">·</span>}{item.label} <b className={item.tone ?? "text-foreground"}>{item.value}</b></span>)}
    </div>
  </div>;
}

function ChartActions({ range, setRange, aggregation, setAggregation, exportPng, exportCsv, toast }: {
  range: string;
  setRange: (range: string) => void;
  aggregation: string;
  setAggregation: (value: string) => void;
  exportPng: () => void;
  exportCsv: () => void;
  toast: (message: string) => void;
}) {
  return <div className="flex shrink-0 items-center gap-1">
    <div className="flex items-center rounded-md border border-border p-0.5" aria-label="Chart time range">{["1H", "6H", "12H", "24H"].map((item) => <button key={item} onClick={() => setRange(item)} aria-pressed={range === item} className={`rounded px-1.5 py-1 text-[10px] font-semibold ${range === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{item}</button>)}</div>
    <details className="relative"><summary aria-label="Chart options" className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-md text-muted-foreground hover:bg-accent"><MoreVertical size={15} /></summary><div className="absolute right-0 top-8 z-30 w-40 rounded-lg border border-border bg-popover p-1 shadow-lg">
      <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Aggregation · {aggregation}</div>
      {["Average", "Max", "Min"].map((option) => <button key={option} onClick={() => { setAggregation(option); toast(`${option} aggregation selected.`); }} className="w-full rounded px-2.5 py-1.5 text-left text-[11px] text-foreground hover:bg-accent">{option}</button>)}
      <div className="my-1 border-t border-border" />
      <button onClick={exportPng} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[11px] text-foreground hover:bg-accent"><Download size={13} />Export PNG</button>
      <button onClick={exportCsv} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[11px] text-foreground hover:bg-accent"><Download size={13} />Export CSV</button>
    </div></details>
  </div>;
}

function StorageDonut() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-between gap-2 py-2">
      <div className="relative h-[150px] w-[150px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={storageSlices} dataKey="value" nameKey="name" innerRadius="72%" outerRadius="94%" paddingAngle={1} stroke="none">
              {storageSlices.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <b className="font-display text-[20px] font-extrabold leading-tight tabular-nums text-foreground">{totalStorageTB.toFixed(2)}</b>
          <span className="text-[12px] text-muted-foreground">TB · Total</span>
        </div>
      </div>
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1.5 text-[12px]">
        {storageSlices.map((item) => <div key={item.name} className="contents">
          <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-foreground"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>
          <span className="whitespace-nowrap text-right tabular-nums text-muted-foreground">{item.value.toFixed(2)} TB</span>
          <b className="whitespace-nowrap text-right tabular-nums text-foreground">{(item.value / totalStorageTB * 100).toFixed(1)}%</b>
        </div>)}
      </div>
    </div>
  );
}

function DistributionDonut({ data, total }: { data: typeof usageBands | typeof fileSystems; total: number }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-3 pt-2">
      <div className="relative h-[150px] w-[150px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={data} dataKey="value" innerRadius="72%" outerRadius="94%" paddingAngle={1} stroke="none">{data.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className="font-display text-[24px] font-extrabold leading-tight tabular-nums text-foreground">{total}</b><span className="text-[12px] text-muted-foreground">Total</span></div>
      </div>
      <div className="grid w-full grid-cols-[minmax(0,1fr)_40px_52px] items-center gap-x-3 gap-y-2 text-[12px]">
        {data.map((item) => <div key={item.name} className="contents">
          <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-foreground"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>
          <b className="whitespace-nowrap text-right tabular-nums text-foreground">{item.value}</b>
          <span className="whitespace-nowrap text-right tabular-nums text-muted-foreground">{Math.round(item.value / total * 100)}%</span>
        </div>)}
      </div>
    </div>
  );
}

/** Sort direction for a table column. */
type SortDirection = "asc" | "desc";

/** Clickable column header that toggles ascending / descending sorting. */
function SortHeader({ label, sortKey, activeKey, direction, onSort, align = "left" }: {
  label: string; sortKey: string; activeKey: string; direction: SortDirection; onSort: (key: string) => void; align?: "left" | "right";
}) {
  const isActive = activeKey === sortKey;
  return (
    <th scope="col" className={cn("whitespace-nowrap px-1 pb-1.5 text-[11px] font-medium text-[#64748B] dark:text-slate-400", align === "right" && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded transition-colors hover:text-[#1E293B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-slate-100",
          isActive && "text-[#1E293B] dark:text-slate-100",
        )}
      >
        {label}
        {isActive && (direction === "asc" ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" />)}
      </button>
    </th>
  );
}

/** Pagination footer shared by both disk tables. */
function TableFooter({ page, pageCount, onPageChange }: {
  page: number; pageCount: number; onPageChange: (page: number) => void;
}) {
  return (
    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[#F1F5F9] pt-2.5 text-[12px] text-[#64748B] dark:border-border dark:text-slate-400">
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Previous page"
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          <span>Previous</span>
        </button>
        {Array.from({ length: Math.min(5, Math.max(1, pageCount)) }, (_, index) => index + 1).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onPageChange(value)}
            aria-current={page === value ? "page" : undefined}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              page === value ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent hover:text-foreground",
            )}
          >
            {value}
          </button>
        ))}
        {pageCount > 5 && <span aria-hidden="true">…</span>}
        {pageCount > 5 && (
          <button type="button" onClick={() => onPageChange(pageCount)} className="grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-accent hover:text-foreground">
            {pageCount}
          </button>
        )}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page === pageCount}
          aria-label="Next page"
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
        >
          <span>Next</span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Usage percentage with a threshold coloured progress bar. */
function UsageCell({ usage }: { usage: number }) {
  const tone = usageTone(usage);
  return (
    <span className="flex items-center justify-end gap-2 whitespace-nowrap">
      <b className="font-medium tabular-nums text-[#1E293B] dark:text-slate-100">{usage.toFixed(1)}%</b>
      <span className="h-[5px] w-[100px] shrink-0 overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-white/10">
        <span className={cn("block h-full rounded-full", tone.bar)} style={{ width: `${Math.min(usage, 100)}%` }} />
      </span>
    </span>
  );
}

/** Thin dual bar showing the read / write split. */
function DualIoBar({ read, write }: { read: number; write: number }) {
  const total = read + write;
  const readShare = total ? (read / total) * 100 : 50;
  return (
    <span className="mt-1 flex h-[4px] w-[100px] shrink-0 overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-white/10">
      <span className="block h-full bg-[#60A5FA]" style={{ width: `${readShare}%` }} />
      <span className="block h-full bg-[#34D399]" style={{ width: `${100 - readShare}%` }} />
    </span>
  );
}

/** Soft tint pill showing the I/O latency. */
function LatencyBadge({ latency }: { latency: number }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums", latencyTone(latency))}>
      {latency} ms
    </span>
  );
}

function TopDiskBars({ items, throughput = false }: { items: { name: string; usage?: number; value?: number; label?: string; color: string }[]; throughput?: boolean }) {
  const max = Math.max(...items.map((item) => item.usage ?? item.value ?? 0));
  return (
    <div className="flex min-h-0 flex-1 flex-col pt-2">
      <div className="flex min-h-0 flex-1 flex-col justify-between">
        {items.map((item) => {
          const value = item.usage ?? item.value ?? 0;
          return <div key={item.name} className="grid h-8 grid-cols-[minmax(88px,110px)_minmax(16px,1fr)_80px] items-center gap-1.5 text-[12px]">
            <span title={item.name} className="min-w-0 truncate whitespace-nowrap text-foreground">{item.name}</span>
            <div className="h-[7px] min-w-0 rounded-full bg-muted"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${max ? value / max * 100 : 0}%` }} /></div>
            <b className="w-[80px] whitespace-nowrap text-right tabular-nums text-foreground">{throughput ? item.label : `${item.usage}%`}</b>
          </div>;
        })}
      </div>
      <div className="mt-2 border-t border-border pt-2 text-[12px] text-muted-foreground">Showing {items.length} of {TOTAL_SERVERS} servers</div>
    </div>
  );
}

export function DiskStorageDashboard() {
  const [notice, setNotice] = useState("");
  const [chartRange, setChartRange] = useState("24H");
  const [aggregation, setAggregation] = useState("Average");
  const [usageSort, setUsageSort] = useState<{ key: string; direction: SortDirection }>({ key: "usage", direction: "desc" });
  const [ioSort, setIoSort] = useState<{ key: string; direction: SortDirection }>({ key: "read", direction: "desc" });
  const [usagePage, setUsagePage] = useState(1);
  const [ioPage, setIoPage] = useState(1);
  const rowsPerPage = 8;

  const sortedUsageRows = useMemo(() => {
    const direction = usageSort.direction === "asc" ? 1 : -1;
    return [...diskVolumes].sort((a, b) => {
      if (usageSort.key === "server") return a.server.localeCompare(b.server) * direction;
      if (usageSort.key === "filesystem") return a.filesystem.localeCompare(b.filesystem) * direction;
      if (usageSort.key === "used") return (a.usedGB - b.usedGB) * direction;
      if (usageSort.key === "free") return ((a.capacityGB - a.usedGB) - (b.capacityGB - b.usedGB)) * direction;
      return (a.usage - b.usage) * direction;
    });
  }, [usageSort]);

  const sortedIoRows = useMemo(() => {
    const direction = ioSort.direction === "asc" ? 1 : -1;
    return [...diskVolumes].sort((a, b) => {
      if (ioSort.key === "server") return a.server.localeCompare(b.server) * direction;
      if (ioSort.key === "iops") return (a.iopsK - b.iopsK) * direction;
      if (ioSort.key === "latency") return (a.latency - b.latency) * direction;
      return (a.read - b.read) * direction;
    });
  }, [ioSort]);

  const usagePageCount = Math.max(1, Math.ceil(sortedUsageRows.length / rowsPerPage));
  const ioPageCount = Math.max(1, Math.ceil(sortedIoRows.length / rowsPerPage));
  const visibleUsageRows = sortedUsageRows.slice((usagePage - 1) * rowsPerPage, usagePage * rowsPerPage);
  const visibleIoRows = sortedIoRows.slice((ioPage - 1) * rowsPerPage, ioPage * rowsPerPage);

  function sortUsage(key: string) {
    setUsageSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "desc" });
    setUsagePage(1);
  }
  function sortIo(key: string) {
    setIoSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "desc" });
    setIoPage(1);
  }

  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const exportCsv = () => {
    const header = ["Server Name", "Mount Point", "Filesystem", "Capacity", "Used", "Usage", "Free", "Device", "Read (MB/s)", "Write (MB/s)", "IOPS", "Latency (ms)"];
    const rows = diskVolumes.map((disk) => [disk.server, disk.mount, disk.filesystem, formatDiskAmount(disk.capacityGB), formatDiskAmount(disk.usedGB), `${disk.usage}%`, formatDiskAmount(Math.max(0, disk.capacityGB - disk.usedGB)), disk.device, disk.read.toFixed(1), disk.write.toFixed(1), `${disk.iopsK}K`, String(disk.latency)]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "disk-storage.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast("Disk and storage data exported.");
  };
  const exportChartPng = (id: string) => {
    const svg = document.querySelector(`[data-chart-id="${id}"] .recharts-surface`);
    if (!(svg instanceof SVGElement)) return toast("Chart image is not ready yet.");
    const image = new Image();
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" }));
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || 1000;
      canvas.height = image.naturalHeight || 360;
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--card") || "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `${id}.png`;
        link.click();
      }
      URL.revokeObjectURL(url);
    };
    image.onerror = () => { URL.revokeObjectURL(url); toast("Could not export chart image."); };
    image.src = url;
  };
  const exportChartCsv = (id: string, data: DiskChartPoint[], lines: DiskChartSeries[]) => {
    const rows = [["Time", ...lines.map((line) => `${line.name} (${line.unit})`)], ...data.map((point) => [point.time, ...lines.map((line) => String(point[line.key] ?? ""))])];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2.5 pb-3">
      <PageMeta breadcrumbs={["Monitoring", "Disk & Storage"]} showRefresh={false} variant="detail" />
      <PageHeading title="Disk & Storage" description="Monitor disk usage, storage performance, and I/O metrics across your infrastructure in real-time." actionsAlign="top" variant="detail">
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Download size={15} />Export CSV</Button>
          <Button size="sm" onClick={() => toast("Add Widget is a mockup action.")} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Plus size={15} />Add Widget</Button>
        </div>
      </PageHeading>

      <section aria-label="Storage summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {stats.map((item) => <MetricCard key={item.label} item={item} className="h-[100px]" labelClassName="text-[12px] leading-4" valueClassName="text-[24px] leading-7" trendClassName="text-[11px] leading-4" />)}
      </section>

      <section aria-label="Storage trends" className="grid items-stretch gap-2.5 xl:grid-cols-3">
        <Panel title="Disk Usage Over Time" className="h-[360px] min-w-0" showOptions={false} action={<ChartActions range={chartRange} setRange={setChartRange} aggregation={aggregation} setAggregation={setAggregation} exportPng={() => exportChartPng("disk-usage-trend")} exportCsv={() => exportChartCsv("disk-usage-trend", diskUsageHistory, [{ key: "used", name: "Used", color: "#2878ed", unit: "%" }, { key: "other", name: "Other", color: "#f39a12", unit: "%" }, { key: "free", name: "Free", color: "#35b879", unit: "%" }])} toast={toast} />}>
          <TrendChart id="disk-usage-trend" data={diskUsageHistory} lines={[{ key: "used", name: "Used", color: "#2878ed", unit: "%" }, { key: "other", name: "Other", color: "#f39a12", unit: "%" }, { key: "free", name: "Free", color: "#35b879", unit: "%" }]} kind="stacked" range={chartRange} aggregation={aggregation} summary={[{ label: "Used", value: `${diskUsagePercent.toFixed(1)}%` }, { label: "Trend vs yesterday", value: "▲ 0.4%", tone: "text-success" }, { label: "Forecast", value: `Full in ~${Math.round((100 - diskUsagePercent) / 1.02)} days` }]} onToast={toast} />
        </Panel>
        <Panel title="I/O Throughput Over Time" className="h-[360px] min-w-0" showOptions={false} action={<ChartActions range={chartRange} setRange={setChartRange} aggregation={aggregation} setAggregation={setAggregation} exportPng={() => exportChartPng("io-throughput-trend")} exportCsv={() => exportChartCsv("io-throughput-trend", throughputHistory, [{ key: "read", name: "Read", color: "#2878ed", unit: "MB/s" }, { key: "write", name: "Write", color: "#35b879", unit: "MB/s" }])} toast={toast} />}>
          <TrendChart id="io-throughput-trend" data={throughputHistory} lines={[{ key: "read", name: "Read", color: "#2878ed", unit: "MB/s" }, { key: "write", name: "Write", color: "#35b879", unit: "MB/s" }]} kind="area" range={chartRange} aggregation={aggregation} unitTitle="MB/s" summary={[{ label: "Avg Read", value: `${averageOf(throughputReadValues).toFixed(1)} MB/s` }, { label: "Avg Write", value: `${averageOf(throughputWriteValues).toFixed(1)} MB/s` }]} onToast={toast} />
        </Panel>
        <Panel title="IOPS Over Time" className="h-[360px] min-w-0" showOptions={false} action={<ChartActions range={chartRange} setRange={setChartRange} aggregation={aggregation} setAggregation={setAggregation} exportPng={() => exportChartPng("iops-trend")} exportCsv={() => exportChartCsv("iops-trend", iopsHistory, [{ key: "read", name: "Read", color: "#2878ed", unit: "IOPS" }, { key: "write", name: "Write", color: "#35b879", unit: "IOPS" }])} toast={toast} />}>
          <TrendChart id="iops-trend" data={iopsHistory} lines={[{ key: "read", name: "Read", color: "#2878ed", unit: "IOPS" }, { key: "write", name: "Write", color: "#35b879", unit: "IOPS" }]} kind="bar" range={chartRange} aggregation={aggregation} summary={[{ label: "Avg IOPS", value: `${Math.round(averageOf(iopsValues)).toLocaleString()}` }, { label: "Peak IOPS", value: `${Math.max(...iopsValues).toLocaleString()}` }]} onToast={toast} />
        </Panel>
      </section>

      <section aria-label="Disk details" className="grid items-stretch gap-2.5 xl:grid-cols-[1.14fr_1.04fr_0.82fr] 2xl:grid-cols-[1.45fr_1.25fr_0.62fr]">
        <Panel title="Top Disks by Usage" className="flex h-full min-w-0 flex-col" action={<button onClick={() => toast("Showing all disks by usage.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[12px] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
          <div className="flex min-h-0 flex-1 flex-col pt-1">
            <div className="min-h-0 flex-1 overflow-auto 2xl:overflow-visible">
              <table className="w-full min-w-[520px] table-fixed text-left text-[12px]">
                <colgroup><col style={{ width: "30%" }} /><col style={{ width: "14%" }} /><col style={{ width: 130 }} /><col /></colgroup>
                <thead><tr className="border-b border-[#F1F5F9] dark:border-border">
                  <SortHeader label="Server / Mount" sortKey="server" activeKey={usageSort.key} direction={usageSort.direction} onSort={sortUsage} />
                  <SortHeader label="Filesystem" sortKey="filesystem" activeKey={usageSort.key} direction={usageSort.direction} onSort={sortUsage} />
                  <SortHeader label="Used / Capacity" sortKey="used" activeKey={usageSort.key} direction={usageSort.direction} onSort={sortUsage} align="right" />
                  <SortHeader label="Usage" sortKey="usage" activeKey={usageSort.key} direction={usageSort.direction} onSort={sortUsage} />
                </tr></thead>
                <tbody>{visibleUsageRows.map((disk) => (
                  <tr key={`${disk.server}-${disk.mount}`} className="h-10 border-b border-[#F1F5F9] transition-colors hover:bg-[#F8FAFC] dark:border-border dark:hover:bg-white/5">
                    <td className="px-1 py-1">
                      <div className="truncate text-[13px] font-medium text-[#1E293B] transition-colors hover:text-primary hover:underline dark:text-slate-100">{disk.server}</div>
                      <div className="truncate text-[12px] text-[#64748B] dark:text-slate-400">{disk.mount}</div>
                    </td>
                    <td className="px-1 py-1"><span className="rounded bg-[#E2E8F0] px-1.5 py-0.5 text-[10px] font-medium text-[#475569] dark:bg-slate-700 dark:text-slate-200">{disk.filesystem}</span></td>
                    <td className="whitespace-nowrap px-1 py-1 text-right font-medium tabular-nums text-[#1E293B] dark:text-slate-100">{disk.usedGB.toFixed(1)} / {formatCapacity(disk.capacityGB)}</td>
                    <td className="whitespace-nowrap py-1 pl-3 pr-1"><UsageCell usage={disk.usage} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <TableFooter
              page={usagePage}
              pageCount={usagePageCount}
              onPageChange={setUsagePage}
            />
          </div>
        </Panel>

        <Panel title="Top Disks by I/O Activity" className="flex h-full min-w-0 flex-col" optionsButtonClassName="focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1 focus-visible:ring-offset-card" action={<button onClick={() => toast("Showing all disks by I/O activity.")} className="mr-1.5 inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[12px] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
          <div className="flex min-h-0 flex-1 flex-col pt-1">
            <div className="min-h-0 flex-1 overflow-auto 2xl:overflow-visible">
              <table className="w-full min-w-[440px] table-fixed text-left text-[12px]">
                <colgroup><col style={{ width: "30%" }} /><col style={{ width: "34%" }} /><col style={{ width: "18%" }} /><col style={{ width: "18%" }} /></colgroup>
                <thead><tr className="border-b border-[#F1F5F9] dark:border-border">
                  <SortHeader label="Server / Disk" sortKey="server" activeKey={ioSort.key} direction={ioSort.direction} onSort={sortIo} />
                  <SortHeader label="Read / Write" sortKey="read" activeKey={ioSort.key} direction={ioSort.direction} onSort={sortIo} />
                  <SortHeader label="IOPS" sortKey="iops" activeKey={ioSort.key} direction={ioSort.direction} onSort={sortIo} align="right" />
                  <SortHeader label="Latency" sortKey="latency" activeKey={ioSort.key} direction={ioSort.direction} onSort={sortIo} align="right" />
                </tr></thead>
                <tbody>{visibleIoRows.map((disk) => (
                  <tr key={`${disk.server}-${disk.device}`} className="h-10 border-b border-[#F1F5F9] transition-colors hover:bg-[#F8FAFC] dark:border-border dark:hover:bg-white/5">
                    <td className="px-1 py-1">
                      <div className="truncate text-[13px] font-medium text-[#1E293B] transition-colors hover:text-primary hover:underline dark:text-slate-100">{disk.server}</div>
                      <div className="truncate text-[12px] text-[#64748B] dark:text-slate-400">{disk.device}</div>
                    </td>
                    <td className="px-1 py-1">
                      <div className="whitespace-nowrap font-medium tabular-nums text-[#1E293B] dark:text-slate-100">{disk.read.toFixed(1)} / {disk.write.toFixed(1)} MB/s</div>
                      <DualIoBar read={disk.read} write={disk.write} />
                    </td>
                    <td className="whitespace-nowrap px-1 py-1 text-right font-medium tabular-nums text-[#1E293B] dark:text-slate-100">{disk.iopsK}K</td>
                    <td className="px-1 py-1 text-right"><LatencyBadge latency={disk.latency} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <TableFooter
              page={ioPage}
              pageCount={ioPageCount}
              onPageChange={setIoPage}
            />
          </div>
        </Panel>

        <Panel title="Current Storage Summary" className="flex h-full min-w-0 flex-col">
          <StorageDonut />
          <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
            {[
              { label: "Total Disks", value: TOTAL_DISKS.toLocaleString() },
              { label: "Total Partitions", value: totalPartitions.toLocaleString() },
              { label: "Total File Systems", value: totalFileSystems.toLocaleString() },
            ].map(({ label, value }) => <div key={label} className="min-w-0 rounded-lg bg-[#F8F9FB] p-2.5 dark:bg-slate-800/70">
              <div className="text-[12px] leading-tight text-muted-foreground">{label}</div>
              <b className="mt-1 block text-[16px] font-bold tabular-nums text-foreground">{value}</b>
            </div>)}
          </div>
          <div className="mt-auto border-t border-border pt-2 text-[12px] text-muted-foreground">Updated 2m ago</div>
        </Panel>
      </section>

      <section aria-label="Storage breakdown and alerts" className="grid items-stretch gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <Panel title="Disk Usage Distribution" className="flex h-full min-w-0 flex-col p-4"><DistributionDonut data={usageBands} total={TOTAL_DISKS} /></Panel>
        <Panel title="File System Distribution" className="flex h-full min-w-0 flex-col p-4"><DistributionDonut data={fileSystems} total={totalFileSystems} /></Panel>
        <Panel title="Disk Usage by Server" className="flex h-full min-w-0 flex-col p-4" action={<button onClick={() => toast("Showing all servers by disk usage.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[12px] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}><TopDiskBars items={topDiskUsage} /></Panel>
        <Panel title="I/O by Server" className="flex h-full min-w-0 flex-col p-4" action={<button onClick={() => toast("Showing all servers by I/O throughput.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[12px] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}><TopDiskBars items={topThroughput} throughput /></Panel>
        <Panel title="Recent Alerts" className="flex h-full min-w-0 flex-col p-4" action={<button onClick={() => toast("Showing all disk alerts.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[12px] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pt-2">
            {alerts.map((alert) => <div key={alert.text} className="grid min-h-7 grid-cols-[8px_minmax(0,1fr)_56px] items-center gap-1 text-[12px]">
              <i aria-label={`${alert.tone} alert`} className="h-2 w-2 rounded-full" style={{ backgroundColor: alert.color }} />
              <span title={alert.text} className="truncate font-medium text-foreground">{alert.text}</span>
              <span className="w-[56px] whitespace-nowrap text-right tabular-nums text-muted-foreground">{alert.ago}</span>
            </div>)}
          </div>
          <div className="mt-auto border-t border-border pt-2 text-[12px] text-muted-foreground">Showing {alerts.length} of {TOTAL_ALERTS} alerts</div>
        </Panel>
      </section>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}
