"use client";

import dynamic from "next/dynamic";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Area, AreaChart, CartesianGrid,
  ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, Check, CheckCircle2, Download, Expand, FileText, Hourglass, MoreVertical, Plus, ShieldCheck, X } from "lucide-react";
import * as echarts from "echarts/core";
import { LineChart as ELineChart } from "echarts/charts";
import { GridComponent, MarkLineComponent, MarkPointComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([ELineChart, GridComponent, MarkLineComponent, MarkPointComponent, TooltipComponent, CanvasRenderer]);

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { TechLogo } from "@/components/shared/icon";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MetricStat } from "@/data/mock/dashboard";
import { databaseMonitoringData, databasePerfSeries, type DbPerfPoint, type DatabaseRecord } from "@/data/mock/database-monitoring";
import type { NocMapSite, NocMapStatus } from "@/data/mock/noc-map";

const NocOsmMap = dynamic(
  () => import("@/components/live-operations/noc-osm-map").then((module) => module.NocOsmMap),
  { ssr: false, loading: () => <div className="grid h-full min-h-[260px] animate-pulse place-items-center rounded-lg bg-slate-100 text-[12px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">Loading map…</div> },
);

/** Islamabad (NEXUS DC-2) — map opens here at street level, like Global Health. */
const ISLAMABAD_SITE: NocMapSite = {
  id: "islamabad",
  code: "ISL",
  city: "Islamabad",
  country: "Pakistan",
  region: "South Asia",
  provider: "—",
  facility: "NEXUS DC-2",
  lat: 33.69,
  lng: 73.06,
  status: "online",
  health: 99.7,
  throughput: "—",
  alerts: 0,
  uptime: "99.99%",
  lastCheck: "just now",
  servers: [],
};

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

interface TooltipParam {
  marker: string;
  seriesName: string;
  value: number;
  axisValue?: string;
}

export interface PerformanceChartApi {
  exportPng: () => void;
  exportCsv: () => void;
}

interface PerformanceChartProps {
  /** Range key: "1h" | "6h" | "12h" | "24h" | "7d" */
  period: string;
  database: string;
  onSelectDatabase: (database: string) => void;
}

const chartTimes = ["12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00"];

const PerformanceChart = forwardRef<PerformanceChartApi, PerformanceChartProps>(function PerformanceChart({ period, database, onSelectDatabase }, ref) {
  const host1 = useRef<HTMLDivElement>(null);
  const host2 = useRef<HTMLDivElement>(null);
  const chart1Ref = useRef<echarts.ECharts | null>(null);
  const chart2Ref = useRef<echarts.ECharts | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);
  const range = (period.toUpperCase() as "1H" | "6H" | "12H" | "24H" | "7D");
  const series = useMemo(() => databasePerfSeries(database, range), [database, range]);

  const last = series[series.length - 1];
  const avgQuery = Math.round(series.reduce((acc, p) => acc + p.query, 0) / series.length);
  const p95 = Math.max(...series.map((p) => p.p95));
  const peakConnections = Math.max(...series.map((p) => p.connections));
  const connectionsPct = Math.round((peakConnections / 600) * 100);
  const avgQps = Math.round(series.reduce((acc, p) => acc + p.qps, 0) / series.length);
  const peakPoint = series.reduce((peak, p) => (p.query > peak.query ? p : peak), series[0]);

  useEffect(() => {
    const node1 = host1.current;
    const node2 = host2.current;
    if (!node1 || !node2) return undefined;
    const chart1 = echarts.init(node1, undefined, { renderer: "canvas" });
    const chart2 = echarts.init(node2, undefined, { renderer: "canvas" });
    chart1.group = "db-performance";
    chart2.group = "db-performance";
    echarts.connect("db-performance");
    chart1Ref.current = chart1;
    chart2Ref.current = chart2;
    const resize1 = new ResizeObserver(() => chart1.resize());
    const resize2 = new ResizeObserver(() => chart2.resize());
    resize1.observe(node1);
    resize2.observe(node2);
    return () => {
      resize1.disconnect();
      resize2.disconnect();
      chart1.dispose();
      chart2.dispose();
      chart1Ref.current = null;
      chart2Ref.current = null;
    };
  }, []);

  useEffect(() => {
    const chart1 = chart1Ref.current;
    if (!chart1) return;
    const labels = series.map((p) => p.time);
    const visible = (name: string) => !hiddenSeries.includes(name);
    const latencyMax = Math.ceil(Math.max(...series.map((p) => p.p95), 100) / 100) * 100;
    const tooltipBase = {
      trigger: "axis" as const,
      triggerOn: "mousemove",
      confine: true,
      backgroundColor: "var(--popover)",
      borderColor: "var(--border)",
      borderWidth: 1,
      textStyle: { color: "var(--popover-foreground)", fontSize: 12 },
      extraCssText: "border-radius:8px;box-shadow:0 8px 24px rgb(15 23 42 / 0.18);padding:10px 12px;",
      axisPointer: {
        type: "cross" as const,
        lineStyle: { color: "var(--muted-foreground)", type: "dashed" as const },
        label: { show: true, backgroundColor: "var(--popover)", borderColor: "var(--border)", borderWidth: 1, color: "var(--popover-foreground)", fontSize: 12 },
      },
    };

    chart1.setOption({
      grid: { left: 40, right: 16, top: 20, bottom: 16 },
      tooltip: {
        ...tooltipBase,
        formatter: (params: unknown) => {
          const list = (Array.isArray(params) ? params : [params]) as TooltipParam[];
          const title = list[0]?.axisValue ?? "";
          const rows = list.map((item) => `<div style="display:flex;align-items:center;gap:8px;line-height:20px;min-width:150px"><span>${item.marker}</span><span>${item.seriesName}</span><b style="margin-left:auto;font-variant-numeric:tabular-nums">${item.value} ms</b></div>`).join("");
          return `<div style="font-weight:600;margin-bottom:4px;font-variant-numeric:tabular-nums">${title}</div>${rows}`;
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        boundaryGap: false,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisPointer: { label: { show: true, formatter: ({ value }: { value: string }) => value } },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: latencyMax,
        interval: latencyMax / 4,
        splitLine: { lineStyle: { color: "var(--border)", type: "dashed" } },
        axisLabel: { color: "var(--muted-foreground)", fontSize: 12 },
      },
      series: [
        ...(visible("query") ? [{
          name: "Query Time",
          type: "line",
          smooth: 0.3,
          symbol: "none",
          data: series.map((p) => p.query),
          lineStyle: { width: 2, color: "#60A5FA" },
          itemStyle: { color: "#60A5FA" },
          areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(96,165,250,0.32)" }, { offset: 1, color: "rgba(96,165,250,0)" }] } },
          emphasis: { focus: "series" },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { type: "dashed", color: "#FBBF24" },
            label: { formatter: "Slow query threshold", position: "insideEndTop", color: "#b45309", fontSize: 12 },
            data: [{ yAxis: 100 }],
          },
          markPoint: {
            symbol: "circle",
            symbolSize: 7,
            itemStyle: { color: "#f59e0b", borderColor: "#ffffff", borderWidth: 1.5 },
            label: { formatter: `Peak ${peakPoint.query} ms · ${peakPoint.time}`, position: "top", fontSize: 12, color: "#b45309", distance: 4 },
            data: [{ coord: [peakPoint.time, peakPoint.query] }],
          },
        }] : []),
        ...(visible("p95") ? [{
          name: "P95",
          type: "line",
          smooth: 0.3,
          symbol: "none",
          data: series.map((p) => p.p95),
          lineStyle: { width: 1.5, type: "dotted", color: "#A78BFA" },
          itemStyle: { color: "#A78BFA" },
          emphasis: { focus: "series" },
        }] : []),
      ],
    }, { notMerge: true });

    const chart2 = chart2Ref.current;
    chart2?.setOption({
      grid: { left: 40, right: 16, top: 16, bottom: 4 },
      tooltip: {
        ...tooltipBase,
        formatter: (params: unknown) => {
          const list = (Array.isArray(params) ? params : [params]) as TooltipParam[];
          const title = list[0]?.axisValue ?? "";
          const rows = list.map((item) => {
            const unit = item.seriesName === "Connections" ? "" : " QPS";
            return `<div style="display:flex;align-items:center;gap:8px;line-height:20px;min-width:150px"><span>${item.marker}</span><span>${item.seriesName}</span><b style="margin-left:auto;font-variant-numeric:tabular-nums">${item.value}${unit}</b></div>`;
          }).join("");
          return `<div style="font-weight:600;margin-bottom:4px;font-variant-numeric:tabular-nums">${title}</div>${rows}`;
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        boundaryGap: false,
        axisLabel: { color: "var(--muted-foreground)", fontSize: 12, interval: 2, hideOverlap: true, margin: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: "value",
          min: 0,
          max: 600,
          interval: 150,
          splitLine: { lineStyle: { color: "var(--border)", type: "dashed" } },
          axisLabel: { color: "var(--muted-foreground)", fontSize: 12 },
        },
        {
          type: "value",
          position: "right",
          min: 0,
          max: 140,
          interval: 35,
          splitLine: { show: false },
          axisLabel: { color: "var(--muted-foreground)", fontSize: 12 },
        },
      ],
      series: [
        ...(visible("connections") ? [{
          name: "Connections",
          type: "line",
          smooth: 0.3,
          symbol: "none",
          yAxisIndex: 0,
          data: series.map((p) => p.connections),
          lineStyle: { width: 2, color: "#34D399" },
          itemStyle: { color: "#34D399" },
          areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(52,211,153,0.3)" }, { offset: 1, color: "rgba(52,211,153,0)" }] } },
          emphasis: { focus: "series" },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { type: "dashed", color: "#F87171" },
            label: { formatter: "Max 600", position: "insideEndTop", color: "#b91c1c", fontSize: 12 },
            data: [{ yAxis: 600 }],
          },
        }] : []),
        ...(visible("qps") ? [{
          name: "QPS",
          type: "line",
          smooth: 0.3,
          symbol: "none",
          yAxisIndex: 1,
          data: series.map((p) => p.qps),
          lineStyle: { width: 1.5, color: "#A78BFA" },
          itemStyle: { color: "#A78BFA" },
          emphasis: { focus: "series" },
        }] : []),
      ],
    }, { notMerge: true });
  }, [series, hiddenSeries]);

  const toggleSeries = (key: string) => setHiddenSeries((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));

  useImperativeHandle(ref, () => ({
    exportPng: () => {
      const chart = chart1Ref.current;
      if (!chart) return;
      const url = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" });
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "database-latency.png";
      anchor.click();
    },
    exportCsv: () => {
      const header = "time,query_ms,p95_ms,connections,qps";
      const rows = series.map((p) => [p.time, p.query, p.p95, p.connections, p.qps].join(","));
      const url = URL.createObjectURL(new Blob([[header, ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "database-performance.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    },
  }), [series]);

  const chips: Array<{ key: string; label: string; value: string; color: string }> = [
    { key: "query", label: "Query Time", value: `${last.query} ms`, color: "#60A5FA" },
    { key: "connections", label: "Connections", value: `${last.connections}`, color: "#34D399" },
    { key: "qps", label: "Throughput", value: `${last.qps} QPS`, color: "#A78BFA" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mt-1 flex flex-wrap items-center gap-1.5" aria-label="Toggle series">
        {chips.map((chip) => {
          const active = !hiddenSeries.includes(chip.key);
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={active}
              onClick={() => toggleSeries(chip.key)}
              title={`${active ? "Hide" : "Show"} ${chip.label}`}
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-border bg-card text-foreground" : "border-transparent bg-muted text-muted-foreground line-through opacity-70"}`}
            >
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: chip.color }} />
              {chip.label}
              <b className="tabular-nums">{chip.value}</b>
            </button>
          );
        })}
      </div>

      <div className="mt-2 min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Latency (ms)</span><span className="text-[12px] text-muted-foreground">Slow query threshold 100 ms</span></div>
        <div ref={host1} className="h-[112px] min-w-0" role="img" aria-label="Latency chart: average query time and P95 over time" />
      </div>
      <div className="mt-1 min-w-0 flex-1 border-t border-border pt-1">
        <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Load</span><span className="text-[12px] text-muted-foreground">Max 600 connections</span></div>
        <div ref={host2} className="h-[122px] min-w-0" role="img" aria-label="Load chart: connections and throughput (QPS) over time" />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Performance summary">
        {[
          { label: "Avg Query", value: `${avgQuery} ms` },
          { label: "P95", value: `${p95} ms` },
          { label: "Peak Connections", value: `${peakConnections}`, detail: `${connectionsPct}% of max` },
          { label: "Avg QPS", value: `${avgQps}` },
        ].map((tile) => (
          <div key={tile.label} className="min-w-0 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60">
            <span className="block truncate text-[12px] font-medium text-muted-foreground">{tile.label}</span>
            <b className="mt-0.5 block truncate text-[15px] tabular-nums text-foreground">{tile.value}</b>
            {tile.detail && <span className="block truncate text-[12px] text-muted-foreground">{tile.detail}</span>}
          </div>
        ))}
      </div>
    </div>
  );
});

function ViewAllLink({ label = "View all", onClick }: { label?: string; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[13px] font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{label} →</button>;
}

function DatabaseHealth({ databases, onSelectDatabase, selectedDatabase }: { databases: DatabaseRecord[]; onSelectDatabase: (name: string) => void; selectedDatabase: string }) {
  const total = databases.length;
  const counts = {
    Healthy: databases.filter((db) => db.status === "Healthy").length,
    Warning: databases.filter((db) => db.status === "Warning").length,
    Offline: databases.filter((db) => db.status === "Offline").length,
  };
  const percent = total ? (counts.Healthy / total) * 100 : 0;
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const segments: Array<{ name: "Healthy" | "Warning" | "Offline"; count: number; color: string }> = [
    { name: "Healthy", count: counts.Healthy, color: "#34D399" },
    { name: "Warning", count: counts.Warning, color: "#FBBF24" },
    { name: "Offline", count: counts.Offline, color: "#F87171" },
  ];
  let offset = 0;
  const arcs = segments.map((segment) => {
    const fraction = total ? segment.count / total : 0;
    const arc = { ...segment, fraction, dashOffset: -circumference * offset };
    offset += fraction;
    return arc;
  });
  const attention = databases.filter((db) => db.status !== "Healthy");
  const uptime = databaseMonitoringData.uptime;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex min-h-[150px] flex-wrap items-center gap-4">
        <div className="relative h-[130px] w-[130px] shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`Database health ${percent.toFixed(1)}%`}>
            <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--muted)" strokeWidth="9" />
            {arcs.filter((arc) => arc.fraction > 0).map((arc) => (
              <circle key={arc.name} cx="50" cy="50" r={radius} fill="none" stroke={arc.color} strokeWidth="9" strokeDasharray={`${circumference * arc.fraction} ${circumference * (1 - arc.fraction)}`} strokeDashoffset={arc.dashOffset} />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <b className="font-display text-[20px] font-bold leading-none tabular-nums text-foreground">{percent.toFixed(1)}%</b>
            <span className="mt-1 text-[12px] font-medium text-muted-foreground">Healthy</span>
          </div>
        </div>
        <div className="grid min-w-[150px] flex-1 grid-cols-3 gap-1 text-center">
          {segments.map((segment) => {
            const pct = total ? (segment.count / total) * 100 : 0;
            return (
              <div key={segment.name} className="flex min-w-0 flex-col items-center gap-0.5 rounded-lg border border-border/60 px-1 py-2">
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground"><i aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />{segment.name}</span>
                <b className="text-[17px] tabular-nums text-foreground">{segment.count}</b>
                <span className="text-[12px] tabular-nums text-muted-foreground">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {attention.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/40">
          <span className="flex min-w-0 items-center gap-2 text-[12px] font-semibold text-amber-800 dark:text-amber-300"><AlertTriangle size={15} aria-hidden="true" className="shrink-0" />{attention.length} database{attention.length === 1 ? "" : "s"} {attention.length === 1 ? "needs" : "need"} attention</span>
          <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[12px] text-amber-800 dark:text-amber-300"><span className="text-muted-foreground">{total} monitored</span><ViewAllLink onClick={() => onSelectDatabase(attention[0].name)} /></span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"><Check size={15} aria-hidden="true" />All databases healthy<span className="ml-auto font-normal text-muted-foreground">{total} monitored</span></div>
      )}

      {attention.length > 0 && (
        <ul className="flex flex-col divide-y divide-border/60 border-t border-border" aria-label="Databases needing attention">
          {attention.map((db) => {
            const slow = databaseMonitoringData.slowQueries.find((query) => query.database === db.name);
            const detail = db.issue ? `${db.issue}${slow ? ` · ${slow.duration}` : ""}` : slow?.duration ?? "Needs attention";
            return (
              <li key={db.name}>
                <button
                  type="button"
                  onClick={() => onSelectDatabase(db.name)}
                  aria-pressed={selectedDatabase === db.name}
                  title={`Filter performance chart to ${db.name}`}
                  className={`flex h-9 w-full items-center gap-2 rounded-md px-1 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedDatabase === db.name ? "bg-blue-50/70 dark:bg-blue-950/30" : ""}`}
                >
                  <i aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{db.name}<span className="font-normal text-muted-foreground"> · {detail}</span></span>
                  <span className="shrink-0 text-[13px] font-semibold text-primary">→</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto grid grid-cols-3 gap-2" aria-label="Availability summary">
        {[
          { label: "Avg Uptime", value: `${uptime.averagePercent}%`, sub: "last 30 days", icon: ShieldCheck },
          { label: "Replication Lag", value: `${uptime.replicationLagSeconds}s`, sub: "primary → replica", icon: Hourglass },
          { label: "Last Backup", value: uptime.lastBackup, sub: "success", icon: CheckCircle2 },
        ].map((tile) => (
          <div key={tile.label} className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60">
            <span className="truncate text-[12px] font-medium text-muted-foreground">{tile.label}</span>
            <span className="flex items-center gap-1.5 text-[15px] font-bold tabular-nums text-foreground"><tile.icon size={14} aria-hidden="true" className="shrink-0 text-emerald-600 dark:text-emerald-400" />{tile.value}</span>
            <span className="truncate text-[12px] text-muted-foreground">{tile.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
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
  const locationSites: NocMapSite[] = useMemo(() => {
    const sites = locations.map((location): NocMapSite => {
      const status: NocMapStatus = location.status === "Offline" ? "critical" : location.status === "Warning" ? "warning" : "online";
      return {
        id: location.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        code: location.name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3),
        city: location.name,
        country: location.name,
        region: `${location.items.length} database${location.items.length === 1 ? "" : "s"}`,
        provider: "—",
        facility: "—",
        lat: location.items[0].lat,
        lng: location.items[0].lng,
        status,
        health: Math.round(location.health),
        throughput: "—",
        alerts: status === "critical" ? 3 : status === "warning" ? 1 : 0,
        uptime: "—",
        lastCheck: "just now",
        servers: [],
      };
    });
    return [...sites, ISLAMABAD_SITE];
  }, [locations]);
  const selectedSiteId = locationSites.find((site) => site.city === selectedLocation)?.id ?? null;
  const healthTone = (health: number) => health >= 99 ? "text-emerald-600 dark:text-emerald-400" : health >= 98 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
  return <div className="flex flex-1 flex-col gap-3">
    <div className="relative h-[320px] min-h-[320px] flex-1 overflow-hidden rounded-lg" aria-label="Database locations map">
      <NocOsmMap
        sites={locationSites}
        center={[33.69, 73.06]}
        initialZoom={13}
        selectedSiteId={selectedSiteId}
        onSelectSite={(site) => { if (locations.some((location) => location.name === site.city)) onSelect(site.city); }}
      />
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
  const [selectedDatabase, setSelectedDatabase] = useState("all");
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const performanceChartRef = useRef<PerformanceChartApi>(null);
  const performanceCardRef = useRef<HTMLDivElement>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [eventTab, setEventTab] = useState<"events" | "slow">("events");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newDatabaseName, setNewDatabaseName] = useState("");
  const [lastUpdated, setLastUpdated] = useState("Nov 7, 2026 12:09");
  const [selectedLocation, setSelectedLocation] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setStatus("ready"), 450);
    return () => window.clearTimeout(timer);
  }, []);
  const issueCount = databaseRows.filter((database) => database.status !== "Healthy").length;
  const healthyCount = databaseRows.length - issueCount;
  const storageTotal = databaseMonitoringData.storage.usedGb + databaseMonitoringData.storage.freeGb;
  const storagePercent = storageTotal ? databaseMonitoringData.storage.usedGb / storageTotal * 100 : 0;

  const sortedDatabases = useMemo(() => [...databaseRows].sort((a, b) => {
    const delta = Number.parseInt(a.query, 10) - Number.parseInt(b.query, 10);
    return sortDirection === "desc" ? -delta : delta;
  }), [databaseRows, sortDirection]);
  const currentStats: MetricStat[] = [
    { label: "Total Databases", value: String(databaseRows.length), change: "1 new", trend: "up", tone: "blue", icon: "database" },
    { label: "Healthy", value: String(healthyCount), change: `${databaseRows.length ? (healthyCount / databaseRows.length * 100).toFixed(1) : "0.0"}%`, trend: "up", tone: "green", icon: "online" },
    { label: "Warning", value: String(issueCount), change: `${databaseRows.length ? (issueCount / databaseRows.length * 100).toFixed(1) : "0.0"}%`, trend: "up", tone: "amber", icon: "warning" },
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
  const locationMarkerCount = new Set(databaseRows.map((database) => database.location)).size;

  return <div className="space-y-4 pb-3">
    <PageMeta breadcrumbs={["Monitoring", "Database Monitoring"]} lastUpdated={lastUpdated} onRefresh={refreshPage} />
    <PageHeading title="Database Monitoring" description="Monitor your databases performance, health and activity in real-time." actionsAlign="top">
      <div className="flex shrink-0 items-center gap-2"><span className={`hidden items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold sm:flex ${issueCount ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>{issueCount ? <AlertTriangle size={14} /> : <Check size={14} />}{issueCount ? `${issueCount} Database${issueCount === 1 ? "" : "s"} Need Attention` : "All Databases Healthy"}</span><Button variant="outline" size="sm" onClick={exportReport} className="h-10 gap-2 whitespace-nowrap px-4 text-[13px]"><Download size={15} />Export Report</Button><Button size="sm" onClick={() => setAddDialogOpen(true)} className="h-10 gap-2 whitespace-nowrap px-4 text-[13px]"><Plus size={15} />Add Database</Button></div>
    </PageHeading>
    <section aria-label="Database monitoring summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{currentStats.map((item) => <MetricCard key={item.label} item={item} className="h-[108px] gap-3 p-4" labelClassName="text-[13px]" valueClassName="text-[24px]" trendClassName="text-[12px]" />)}</section>

    <section aria-label="Database performance and status" className="grid items-stretch gap-4 xl:grid-cols-[1.7fr_0.85fr_1.05fr]">
      <div ref={performanceCardRef} className="flex min-w-0">
        <Panel
          title="Database Performance Overview"
          className="flex min-h-[380px] min-w-0 flex-1 flex-col rounded-xl p-4"
          titleClassName="text-[16px] font-semibold"
          headerClassName="h-10"
          action={(
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="flex h-8 items-center rounded-lg border border-border p-0.5" role="group" aria-label="Performance chart time range">
                {(["1h", "6h", "12h", "24h", "7d"] as const).map((item) => (
                  <button key={item} type="button" aria-pressed={period === item} onClick={() => setPeriod(item)} className={`h-7 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${period === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{item.toUpperCase()}</button>
                ))}
              </div>
              <Select value={selectedDatabase} onValueChange={setSelectedDatabase}>
                <SelectTrigger aria-label="Select database" className="h-8 w-40 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All databases</SelectItem>
                  {databaseRows.map((database) => <SelectItem key={database.name} value={database.name}>{database.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <details className="relative">
                <summary aria-label="Chart actions" title="Chart actions" className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"><MoreVertical size={16} aria-hidden="true" /></summary>
                <div className="absolute right-0 z-30 mt-2 w-44 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
                  <button type="button" onClick={() => performanceChartRef.current?.exportPng()} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-accent"><Download size={14} className="text-muted-foreground" aria-hidden="true" />Export PNG</button>
                  <button type="button" onClick={() => performanceChartRef.current?.exportCsv()} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-accent"><FileText size={14} className="text-muted-foreground" aria-hidden="true" />Export CSV</button>
                  <button type="button" onClick={() => performanceCardRef.current?.requestFullscreen?.()} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-accent"><Expand size={14} className="text-muted-foreground" aria-hidden="true" />Fullscreen</button>
                </div>
              </details>
            </div>
          )}
        >
          {status === "loading" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 pt-2" aria-busy="true" aria-label="Loading performance chart">
              <div className="h-7 w-48 animate-pulse rounded-full bg-muted" />
              <div className="h-[112px] animate-pulse rounded-lg bg-muted" />
              <div className="h-[122px] animate-pulse rounded-lg bg-muted" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[0, 1, 2, 3].map((index) => <div key={index} className="h-14 animate-pulse rounded-lg bg-muted" />)}</div>
            </div>
          ) : databaseRows.length === 0 ? (
            <div className="grid min-h-[340px] flex-1 place-items-center rounded-lg border border-dashed border-border p-6 text-center">
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-semibold text-foreground">No databases configured</p>
                <p className="max-w-xs text-[12px] text-muted-foreground">Add your first database to see latency, load and uptime trends here.</p>
                <Button size="sm" onClick={() => setAddDialogOpen(true)} className="h-9 gap-1.5 rounded-lg px-3 text-[13px]"><Plus size={14} />Add Database</Button>
              </div>
            </div>
          ) : (
            <PerformanceChart ref={performanceChartRef} period={period} database={selectedDatabase} onSelectDatabase={setSelectedDatabase} />
          )}
        </Panel>
      </div>
      <Panel
        title="Database Status"
        className="flex min-h-[380px] min-w-0 flex-col rounded-xl p-4"
        titleClassName="text-[16px] font-semibold"
        headerClassName="h-10"
      >
        {status === "loading" ? (
          <div className="flex min-h-[280px] flex-1 flex-col items-center gap-4 pt-2" aria-busy="true" aria-label="Loading database status">
            <div className="h-[130px] w-[130px] animate-pulse rounded-full bg-muted" />
            <div className="grid w-full grid-cols-3 gap-2">{[0, 1, 2].map((index) => <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
          </div>
        ) : databaseRows.length === 0 ? (
          <div className="grid min-h-[280px] flex-1 place-items-center rounded-lg border border-dashed border-border p-6 text-center">
            <div>
              <p className="text-sm font-semibold text-foreground">No databases configured</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Add a database to see health, warning and offline status here.</p>
            </div>
          </div>
        ) : (
          <DatabaseHealth databases={databaseRows} onSelectDatabase={setSelectedDatabase} selectedDatabase={selectedDatabase} />
        )}
      </Panel>
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
