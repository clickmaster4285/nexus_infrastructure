"use client";

import { useMemo, useRef, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowRight, Download, Expand, MoreVertical, Plus, Save, Search, X,
} from "lucide-react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MetricStat } from "@/data/mock/dashboard";
import { cn } from "@/lib/utils";

type ChartMode = "Line" | "Area" | "Stacked";
type MetricRecord = {
  name: string;
  type: string;
  resource: string;
  value: number;
  unit: string;
  change: number;
  color: string;
  direction?: "up" | "down";
  trendTone?: "good" | "bad";
  critical?: boolean;
  improving?: boolean;
};

const stats: MetricStat[] = [
  { label: "Total Metrics", value: "2,458", change: "142 (6.1%)", trend: "up", tone: "blue", icon: "pulse" },
  { label: "Active Metrics", value: "1,856", change: "98 (5.6%)", trend: "up", tone: "green", icon: "activity" },
  { label: "Alerts Triggered", value: "24", change: "8 (33.3%)", trend: "up", tone: "amber", icon: "warning" },
  { label: "Anomalies Detected", value: "7", change: "2 (40.0%)", trend: "down", tone: "red", icon: "offline" },
  { label: "Data Points", value: "12.8M", change: "1.2M (10.3%)", trend: "up", tone: "purple", icon: "database" },
  { label: "Avg. Ingestion Rate", value: "15,230 /min", change: "820 (5.7%)", trend: "up", tone: "blue", icon: "online" },
];

const series = [
  { key: "cpu", name: "CPU", color: "#60A5FA", unit: "%", axis: "percent" },
  { key: "memory", name: "Memory", color: "#34D399", unit: "%", axis: "percent" },
  { key: "networkIn", name: "Network In", color: "#A78BFA", unit: "Mbps", axis: "throughput" },
  { key: "networkOut", name: "Network Out", color: "#C4B5FD", unit: "Mbps", axis: "throughput" },
  { key: "disk", name: "Disk I/O", color: "#FBBF77", unit: "MB/s", axis: "throughput" },
];

const CRITICAL_COLOR = "#F87171";
const CRITICAL_THRESHOLD = 85;


type MetricChartPoint = (typeof metricSeries)[number] & Record<string, number | string>;

const metricSeries = [
  { time: "12:00", cpu: 82, memory: 66, disk: 28, networkIn: 12, networkOut: 54 },
  { time: "13:00", cpu: 77, memory: 63, disk: 22, networkIn: 18, networkOut: 47 },
  { time: "14:00", cpu: 72, memory: 61, disk: 26, networkIn: 12, networkOut: 52 },
  { time: "15:00", cpu: 79, memory: 68, disk: 29, networkIn: 18, networkOut: 49 },
  { time: "16:00", cpu: 70, memory: 65, disk: 24, networkIn: 10, networkOut: 58 },
  { time: "18:00", cpu: 84, memory: 70, disk: 32, networkIn: 15, networkOut: 57 },
  { time: "20:00", cpu: 73, memory: 65, disk: 24, networkIn: 11, networkOut: 50 },
  { time: "22:00", cpu: 81, memory: 68, disk: 39, networkIn: 20, networkOut: 63 },
  { time: "00:00", cpu: 78, memory: 62, disk: 25, networkIn: 13, networkOut: 56 },
  { time: "02:00", cpu: 72, memory: 67, disk: 27, networkIn: 17, networkOut: 49 },
  { time: "04:00", cpu: 86, memory: 72, disk: 35, networkIn: 12, networkOut: 61 },
  { time: "06:00", cpu: 77, memory: 69, disk: 29, networkIn: 19, networkOut: 53 },
  { time: "08:00", cpu: 82, memory: 70, disk: 30, networkIn: 14, networkOut: 58 },
  { time: "10:00", cpu: 74, memory: 65, disk: 24, networkIn: 10, networkOut: 54 },
  { time: "12:00", cpu: 91, memory: 73, disk: 34, networkIn: 17, networkOut: 64 },
];

const rangeSizes: Record<string, number> = { "1h": 2, "6h": 5, "24h": metricSeries.length, "7d": metricSeries.length, "30d": metricSeries.length };

function MetricChartTooltip({ active, payload, label, axis, activeKeys }: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string;
  axis?: "percent" | "throughput";
  activeKeys?: string[];
}) {
  if (!active || !payload?.length) return null;
  const values = payload.filter((entry) => {
    const item = series.find((candidate) => candidate.key === entry.dataKey);
    if (!item) return false;
    if (axis && item.axis !== axis) return false;
    if (activeKeys && !activeKeys.includes(entry.dataKey ?? "")) return false;
    return true;
  });
  if (!values.length) return null;
  return <div className="min-w-[168px] rounded-lg border border-border bg-popover px-3 py-2 shadow-lg" style={{ borderRadius: 8 }}>
    <p className="mb-1.5 text-[12px] font-semibold text-foreground">{label}</p>
    <div className="space-y-1">{values.map((entry) => {
      const item = series.find((candidate) => candidate.key === entry.dataKey)!;
      return <div key={item.key} className="flex items-center justify-between gap-5 whitespace-nowrap text-[12px]">
        <span className="flex items-center gap-1.5 text-muted-foreground"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>
        <b className="tabular-nums text-foreground">{typeof entry.value === "number" ? entry.value.toFixed(1) : "—"} {item.unit}</b>
      </div>;
    })}</div>
  </div>;
}

function CriticalThresholdLabel({ viewBox }: { viewBox?: { x?: number; y?: number; width?: number } }) {
  if (typeof viewBox?.x !== "number" || typeof viewBox.y !== "number" || typeof viewBox.width !== "number") return null;
  const width = 52;
  const x = viewBox.x + viewBox.width - width - 4;
  return <g aria-label="Critical threshold">
    <rect x={x} y={viewBox.y - 9} width={width} height={18} rx={9} fill="#F87171" fillOpacity={0.16} stroke="#F87171" strokeOpacity={0.5} />
    <text x={x + width / 2} y={viewBox.y + 3.5} fill="#F87171" fontSize={10} fontWeight={600} textAnchor="middle">Critical</text>
  </g>;
}

const metrics: MetricRecord[] = [
  { name: "CPU Usage", type: "System", resource: "web-01", value: 92.3, unit: "%", change: 6.2, color: "#2878ed" },
  { name: "Memory Usage", type: "System", resource: "db-01", value: 78.6, unit: "%", change: 3.8, color: "#35b879" },
  { name: "Disk I/O", type: "Storage", resource: "storage-01", value: 245.7, unit: "MB/s", change: 12.4, color: "#f39a12" },
  { name: "Network In", type: "Network", resource: "edge-router-01", value: 312.5, unit: "Mbps", change: 8.7, color: "#8a45df" },
  { name: "Network Out", type: "Network", resource: "edge-router-01", value: 198.3, unit: "Mbps", change: 5.5, color: "#20b9d1", improving: true },
  { name: "Request Rate", type: "Application", resource: "api-gateway", value: 1542, unit: "req/s", change: 7.1, color: "#ed6b83" },
  { name: "Database Connections", type: "Database", resource: "db-01", value: 83, unit: "connections", change: 2.4, color: "#7952dc" },
  { name: "CPU Usage", type: "System", resource: "app-02", value: 64.8, unit: "%", change: 4.1, color: "#2878ed" },
  { name: "Memory Usage", type: "System", resource: "cache-01", value: 72.1, unit: "%", change: 1.8, color: "#35b879" },
  { name: "Disk I/O", type: "Storage", resource: "storage-02", value: 198.6, unit: "MB/s", change: 9.2, color: "#f39a12" },
  { name: "Disk Usage", type: "Storage", resource: "db-01", value: 84.1, unit: "%", change: 2.3, color: "#ef4444" },
  { name: "Response Time", type: "Application", resource: "api-gateway", value: 218, unit: "ms", change: 9.1, color: "#14b8a6" },
  { name: "Error Rate", type: "Application", resource: "api-gateway", value: 1.7, unit: "%", change: 0.6, color: "#ef4444" },
  { name: "Cache Hit Ratio", type: "Database", resource: "cache-01", value: 96.4, unit: "%", change: 1.2, color: "#7952dc" },
  { name: "Disk I/O", type: "Storage", resource: "storage-03", value: 164.2, unit: "MB/s", change: 5.9, color: "#f39a12" },
  { name: "Network In", type: "Network", resource: "gw-02", value: 274.1, unit: "Mbps", change: 6.4, color: "#8a45df" },
  { name: "CPU Usage", type: "System", resource: "worker-03", value: 58.7, unit: "%", change: 2.9, color: "#2878ed" },
  { name: "Memory Usage", type: "System", resource: "worker-03", value: 69.3, unit: "%", change: 3.4, color: "#35b879" },
  { name: "Network Out", type: "Network", resource: "gw-02", value: 143.8, unit: "Mbps", change: 4.7, color: "#20b9d1" },
  { name: "Request Rate", type: "Application", resource: "payment-svc", value: 968, unit: "req/s", change: 5.2, color: "#ed6b83" },
];

const recentAlerts = [
  { text: "High CPU usage on web-01", ago: "2m ago", severity: "critical" },
  { text: "Disk I/O high on storage-01", ago: "7m ago", severity: "warning" },
  { text: "Memory usage high on db-01", ago: "12m ago", severity: "critical" },
  { text: "High latency on api-gateway", ago: "18m ago", severity: "warning" },
  { text: "Anomaly detected in network traffic", ago: "25m ago", severity: "info" },
  { text: "Disk usage critical on db-01", ago: "32m ago", severity: "critical" },
  { text: "Packet loss detected on edge-router-01", ago: "41m ago", severity: "warning" },
  { text: "New metric source added: payment-svc", ago: "1h ago", severity: "info" },
  { text: "Error rate rising on payment-svc", ago: "1h ago", severity: "warning" },
  { text: "Metric threshold updated for app-02", ago: "2h ago", severity: "info" },
];

const alertSeverityLegend = [
  { name: "Critical", color: "#ef4444" },
  { name: "Warning", color: "#f59e0b" },
  { name: "Info", color: "#3b82f6" },
];

/** Metrics where a rising value is a regression rather than normal growth. */
const higherIsWorseMetrics = new Set(["CPU Usage", "Memory Usage", "Disk Usage", "Response Time", "Error Rate"]);

/** Rows shown in the "Top Metrics by Value" card. */
const topMetricsByValue: MetricRecord[] = [
  ...metrics.slice(0, 5),
  { name: "Disk Usage", type: "Storage", resource: "db-01", value: 84.1, unit: "%", change: 2.3, color: "#ef4444" },
  { name: "Response Time", type: "Application", resource: "api-gateway", value: 218, unit: "ms", change: 9.1, color: "#14b8a6" },
  { name: "Error Rate", type: "Application", resource: "payment-svc", value: 1.8, unit: "%", change: 0.4, color: "#ef4444", trendTone: "bad", critical: true },
  { name: "Request Rate", type: "Application", resource: "api-gateway", value: 1542, unit: "req/s", change: 6.2, color: "#ed6b83", trendTone: "good" },
  { name: "Database Connections", type: "Database", resource: "db-01", value: 83, unit: "conn", change: 1.1, color: "#7952dc", direction: "down", trendTone: "good" },
  { name: "Cache Hit Ratio", type: "Database", resource: "cache-01", value: 94.2, unit: "%", change: 0.8, color: "#34D399", direction: "down", trendTone: "good", improving: true },
  { name: "Queue Depth", type: "Queue", resource: "rabbitmq-01", value: 128, unit: "msgs", change: 14.3, color: "#FBBF77", trendTone: "bad", critical: true },
  { name: "Packet Loss", type: "Network", resource: "edge-router-01", value: 0.4, unit: "%", change: 0.1, color: "#F87171", trendTone: "bad", critical: true },
];

/**
 * Change arrow colour: orange/red when a rise is a regression,
 * green when the metric is expected to grow.
 */
function changeTone(metric: MetricRecord): string {
  if (metric.trendTone) return metric.trendTone === "good" ? "text-success" : "text-rose-600";
  if (!higherIsWorseMetrics.has(metric.name)) return "text-success";
  return metric.change >= 5 ? "text-rose-600" : "text-amber-600";
}

const typeBreakdown = [
  { name: "System", value: 1024, color: "#2878ed", percent: "41.7%" },
  { name: "Network", value: 612, color: "#35b879", percent: "24.9%" },
  { name: "Storage", value: 410, color: "#f39a12", percent: "16.7%" },
  { name: "Application", value: 282, color: "#8a45df", percent: "11.5%" },
  { name: "Database", value: 130, color: "#20b9d1", percent: "5.3%" },
];

const typeMiniStats = [
  { label: "Top Type", value: "System" },
  { label: "Resources", value: "24" },
  { label: "Metrics/min", value: "1.2k" },
];

const resources = ["All", "web-01", "db-01", "storage-01", "edge-router-01", "api-gateway"];
const metricTypes = ["All", "System", "Network", "Storage", "Application", "Database"];

const TOTAL_METRICS = "2,458";
const TOTAL_ALERTS = 31;
const ROWS_PER_PAGE_OPTIONS = [10, 20, 50];

function Sparkline({ color, seed }: { color: string; seed: number }) {
  const points = Array.from({ length: 10 }, (_, index) => {
    const value = 10 + ((index * 17 + seed * 13 + index * seed) % 25);
    return `${index * 10},${34 - value}`;
  }).join(" ");
  return <svg viewBox="0 0 90 36" className="h-9 w-[72px] shrink-0" aria-label="Recent metric trend"><polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

function MetricTypeDonut() {
  return (
    <div className="flex w-full max-w-full flex-1 flex-col">
      <div className="flex w-full flex-1 items-center justify-center gap-4">
        <div className="relative h-[160px] w-[160px] shrink-0 min-[1600px]:h-[184px] min-[1600px]:w-[184px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={typeBreakdown} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={1} stroke="none">
                {typeBreakdown.map((item) => <Cell key={item.name} fill={item.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <b className="font-display text-[22px] font-extrabold leading-tight text-foreground">2,458</b>
            <span className="text-[12px] text-muted-foreground">Total</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="space-y-2.5">
            {typeBreakdown.map((item) => (
              <div key={item.name} className="grid grid-cols-[8px_minmax(0,max-content)_auto_auto] items-center gap-x-2 whitespace-nowrap text-[12px]">
                <i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-foreground">{item.name}</span>
                <span className="tabular-nums text-foreground">{item.value.toLocaleString()}</span>
                <span className="tabular-nums text-muted-foreground">({item.percent})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4">
        {typeMiniStats.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-[#f8f9fb] px-2.5 py-2.5 text-center dark:bg-[#1c2b40]">
            <div className="font-display text-[16px] font-bold leading-tight text-foreground">{stat.value}</div>
            <div className="mt-0.5 whitespace-nowrap text-[11px] text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MetricsExplorerDashboard() {
  const chartPanelRef = useRef<HTMLDivElement>(null);
  const chartPlotRef = useRef<HTMLDivElement>(null);
  const chartDragStart = useRef<number | null>(null);
  const [notice, setNotice] = useState("");
  const [metricSearch, setMetricSearch] = useState("");
  const [metricType, setMetricType] = useState("All");
  const [resource, setResource] = useState("All");
  const [group, setGroup] = useState("All");
  const [tag, setTag] = useState("All");
  const [aggregation, setAggregation] = useState("Auto");
  const [interval, setInterval] = useState("Auto (1m)");
  const [appliedFilters, setAppliedFilters] = useState({ search: "", type: "All", resource: "All" });
  const [mode, setMode] = useState<ChartMode>("Area");
  const [activeSeries, setActiveSeries] = useState<string[]>(["cpu", "memory", "networkIn", "networkOut", "disk"]);
  const [chartRange, setChartRange] = useState("24h");
  const [brushRange, setBrushRange] = useState({ startIndex: 0, endIndex: metricSeries.length - 1 });
  const [dragSelection, setDragSelection] = useState<{ left: number; width: number } | null>(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const visibleMetrics = useMemo(() => metrics.filter((metric) => {
    const matchesText = `${metric.name} ${metric.type} ${metric.resource}`.toLowerCase().includes(appliedFilters.search.toLowerCase());
    const matchesType = appliedFilters.type === "All" || metric.type === appliedFilters.type;
    const matchesResource = appliedFilters.resource === "All" || metric.resource === appliedFilters.resource;
    return matchesText && matchesType && matchesResource;
  }), [appliedFilters]);

  const chartData = useMemo(() => metricSeries.map((point) => {
    const result: Record<string, number | string> = { time: point.time };
    for (const item of series) {
      const raw = point[item.key as keyof typeof point] as number;
      result[item.key] = raw;
      if ((item.key === "cpu" || item.key === "memory") && raw >= CRITICAL_THRESHOLD) result[`${item.key}Alert`] = `${item.name} critical threshold exceeded`;
    }
    return result as MetricChartPoint;
  }), []);
  const rangedChartData = useMemo(() => {
    const count = rangeSizes[chartRange] ?? chartData.length;
    return chartData.slice(Math.max(0, chartData.length - count));
  }, [chartData, chartRange]);
  const displayedChartData = useMemo(() => {
    const start = Math.min(brushRange.startIndex, Math.max(0, rangedChartData.length - 1));
    const end = Math.min(brushRange.endIndex, rangedChartData.length - 1);
    return rangedChartData.slice(start, Math.max(start + 1, end + 1));
  }, [brushRange, rangedChartData]);
  const throughputPeak = useMemo(() => {
    const values = displayedChartData.flatMap((point) => series.filter((item) => item.axis === "throughput").map((item) => point[item.key] as number));
    return Math.max(1, ...values);
  }, [displayedChartData]);
  const throughputTicks = useMemo(() => {
    const step = Math.ceil(throughputPeak / 2);
    return [0, step, step * 2].filter((value) => value <= throughputPeak);
  }, [throughputPeak]);

  const exportCsv = () => {
    const header = ["Metric Name", "Type", "Resource", "Value", "Unit", "Change"];
    const rows = visibleMetrics.map((item) => [item.name, item.type, item.resource, String(item.value), item.unit, `${item.change}%`]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "metrics.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast("Metrics exported.");
  };
  const exportChartPng = async () => {
    const svg = chartPanelRef.current?.querySelector(".recharts-surface");
    if (!(svg instanceof SVGElement)) return toast("Chart image is not ready yet.");
    const serialized = new XMLSerializer().serializeToString(svg);
    const image = new Image();
    const objectUrl = URL.createObjectURL(new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }));
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || 1200;
      canvas.height = image.naturalHeight || 600;
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--card") || "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "metrics-explorer.png";
        link.click();
      }
      URL.revokeObjectURL(objectUrl);
      toast("Chart exported as PNG.");
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); toast("Could not export chart image."); };
    image.src = objectUrl;
  };
  const setQuickRange = (range: string) => {
    setChartRange(range);
    const count = rangeSizes[range] ?? metricSeries.length;
    const length = Math.min(metricSeries.length, count);
    setBrushRange({ startIndex: 0, endIndex: length - 1 });
    setDragSelection(null);
  };
  const chartIndexFromPointer = (clientX: number) => {
    const rect = chartPlotRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const plotStart = rect.left + 52;
    const plotEnd = rect.right - 36;
    const ratio = Math.max(0, Math.min(1, (clientX - plotStart) / Math.max(1, plotEnd - plotStart)));
    return Math.round(ratio * Math.max(0, rangedChartData.length - 1));
  };
  const beginChartSelection = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || rangedChartData.length < 2) return;
    chartDragStart.current = chartIndexFromPointer(event.clientX);
    const rect = chartPlotRef.current?.getBoundingClientRect();
    if (rect) setDragSelection({ left: event.clientX - rect.left, width: 0 });
  };
  const updateChartSelection = (event: React.PointerEvent<HTMLDivElement>) => {
    if (chartDragStart.current === null) return;
    const rect = chartPlotRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = rect.left + 52 + (chartDragStart.current / Math.max(1, rangedChartData.length - 1)) * (rect.width - 88);
    const currentX = event.clientX;
    setDragSelection({ left: Math.min(startX, currentX) - rect.left, width: Math.abs(currentX - startX) });
  };
  const finishChartSelection = (event: React.PointerEvent<HTMLDivElement>) => {
    if (chartDragStart.current === null) return;
    const from = chartDragStart.current;
    const to = chartIndexFromPointer(event.clientX);
    if (Math.abs(to - from) >= 1) setBrushRange({ startIndex: Math.min(from, to), endIndex: Math.max(from, to) });
    chartDragStart.current = null;
    setDragSelection(null);
  };
  const applyFilters = () => {
    setAppliedFilters({ search: metricSearch, type: metricType, resource });
    setPage(1);
    toast("Metric filters applied.");
  };
  const clearFilters = () => {
    setMetricSearch("");
    setMetricType("All");
    setResource("All");
    setGroup("All");
    setTag("All");
    setAggregation("Auto");
    setInterval("Auto (1m)");
    setAppliedFilters({ search: "", type: "All", resource: "All" });
    setPage(1);
  };
  const toggleSeries = (key: string) => {
    setActiveSeries((current) => current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]);
  };

  return (
    <div className="space-y-2.5 pb-3">
      <PageMeta breadcrumbs={["Monitoring", "Metrics Explorer"]} showRefresh={false} variant="detail" />
      <PageHeading title="Metrics Explorer" description="Explore, visualize, and analyze metrics from across your infrastructure in real-time." actionsAlign="top" variant="detail">
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast("View saved.")} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Save size={15} />Save View</Button>
          <Button variant="outline" size="sm" onClick={exportCsv} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Download size={15} />Export CSV</Button>
          <Button size="sm" onClick={() => toast("Create Metric is a mockup action.")} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Plus size={15} />Create Metric</Button>
        </div>
      </PageHeading>

      <section aria-label="Metric summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {stats.map((item) => <MetricCard key={item.label} item={item} className="h-[82px]" labelClassName="text-[12px]" valueClassName={item.label === "Avg. Ingestion Rate" ? "text-[18px]" : "text-[24px]"} trendClassName="text-[11px]" />)}
      </section>

      <section aria-label="Metric filters" className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-2.5 shadow-card sm:grid-cols-3 lg:grid-cols-[minmax(130px,1.3fr)_repeat(6,minmax(90px,1fr))_auto_auto]">
        <div className="relative min-w-0">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={metricSearch} onChange={(event) => setMetricSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }} placeholder="Search metrics..." className="h-9 pl-8 text-[12px]" />
        </div>
        <Select value={metricType} onValueChange={setMetricType}><SelectTrigger aria-label="Metric type" className="h-9 min-w-0 text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{metricTypes.map((item) => <SelectItem key={item} value={item}>Type: {item}</SelectItem>)}</SelectContent></Select>
        <Select value={resource} onValueChange={setResource}><SelectTrigger aria-label="Resource" className="h-9 min-w-0 text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{resources.map((item) => <SelectItem key={item} value={item}>Resource: {item}</SelectItem>)}</SelectContent></Select>
        <Select value={group} onValueChange={setGroup}><SelectTrigger aria-label="Group" className="h-9 min-w-0 text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{["All", "Production", "Staging", "Development"].map((item) => <SelectItem key={item} value={item}>Group: {item}</SelectItem>)}</SelectContent></Select>
        <Select value={tag} onValueChange={setTag}><SelectTrigger aria-label="Tag" className="h-9 min-w-0 text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{["All", "Environment", "Team", "Region"].map((item) => <SelectItem key={item} value={item}>Tag: {item}</SelectItem>)}</SelectContent></Select>
        <Select value={aggregation} onValueChange={setAggregation}><SelectTrigger aria-label="Aggregation" className="h-9 min-w-0 text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{["Auto", "Average", "Sum", "Min", "Max", "Count"].map((item) => <SelectItem key={item} value={item}>Agg: {item}</SelectItem>)}</SelectContent></Select>
        <Select value={interval} onValueChange={setInterval}><SelectTrigger aria-label="Interval" className="h-9 min-w-0 text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{["Auto (1m)", "10 seconds", "1 minute", "5 minutes", "15 minutes", "1 hour"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" size="sm" onClick={clearFilters} className="h-9 whitespace-nowrap px-2 text-[12px]"><X size={11} />Clear</Button>
        <Button size="sm" onClick={applyFilters} className="h-9 px-3 text-[12px]">Apply</Button>
      </section>

      <section aria-label="Metric visualization" className="grid items-stretch gap-3 lg:grid-cols-[1.85fr_1fr]">
        <Panel title="Metric Explorer" className="min-h-[700px] min-w-0 p-4" showOptions={false} action={<div className="flex flex-wrap items-center justify-end gap-1">
          <div className="flex items-center rounded-md border border-border p-0.5">{(["Line", "Area", "Stacked"] as const).map((chartMode) => <button key={chartMode} onClick={() => setMode(chartMode)} aria-pressed={mode === chartMode} className={cn("rounded px-2 py-1 text-[11px] font-semibold transition-colors", mode === chartMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>{chartMode}</button>)}</div>
          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5" aria-label="Chart time range">{["1h", "6h", "24h", "7d", "30d"].map((range) => <button key={range} onClick={() => setQuickRange(range)} aria-pressed={chartRange === range} className={cn("rounded px-1.5 py-1 text-[10px] font-semibold", chartRange === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>{range}</button>)}</div>
          <details className="relative"><summary aria-label="Metric chart actions" className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-md text-muted-foreground hover:bg-accent"><MoreVertical size={16} /></summary><div className="absolute right-0 top-8 z-30 w-40 rounded-lg border border-border bg-popover p-1 shadow-lg"><button onClick={exportChartPng} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[12px] text-foreground hover:bg-accent"><Download size={14} />Export PNG</button><button onClick={exportCsv} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[12px] text-foreground hover:bg-accent"><Download size={14} />Export CSV</button><button onClick={() => chartPanelRef.current?.requestFullscreen?.()} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[12px] text-foreground hover:bg-accent"><Expand size={14} />Fullscreen</button></div></details>
        </div>}>
          <div ref={chartPanelRef} className="flex min-h-0 flex-1 flex-col gap-0 bg-card">
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {series.map((item) => {
                const enabled = activeSeries.includes(item.key);
                const latest = metricSeries.at(-1)?.[item.key as keyof (typeof metricSeries)[number]] as number;
                return <button key={item.key} title={enabled ? `Hide ${item.name}` : "Click to show"} onClick={() => toggleSeries(item.key)} aria-pressed={enabled} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors", enabled ? "border-border bg-background text-foreground" : "border-transparent bg-muted text-muted-foreground line-through")}><i className="h-2 w-2 rounded-full" style={{ backgroundColor: enabled ? item.color : "#94a3b8" }} />{item.name}<b className="tabular-nums">{latest} {item.unit}</b></button>;
              })}
            </div>
            <div ref={chartPlotRef} className="relative flex min-h-[340px] flex-1 touch-pan-y select-none flex-col gap-1" onPointerDown={beginChartSelection} onPointerMove={updateChartSelection} onPointerUp={finishChartSelection} onPointerCancel={finishChartSelection}>
              <div className="flex min-h-[190px] flex-[1.6] flex-col">
                <div className="px-1 text-[12px] font-medium text-muted-foreground">Utilization (%)</div>
                <div className="min-h-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    {mode === "Line" ? <LineChart data={displayedChartData} syncId="metrics-time" syncMethod="value" margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="time" hide /><YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} width={44} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }} content={<MetricChartTooltip axis="percent" activeKeys={activeSeries} />} />
                      {(activeSeries.includes("cpu") || activeSeries.includes("memory")) && <ReferenceLine y={85} stroke="#F87171" strokeDasharray="4 4" label={<CriticalThresholdLabel />} />}
                      {series.filter((item) => item.axis === "percent" && activeSeries.includes(item.key)).map((item) => <Line key={item.key} dataKey={item.key} name={item.name} type="monotone" stroke={item.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />)}
                    </LineChart> : <AreaChart data={displayedChartData} syncId="metrics-time" syncMethod="value" margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
                      <defs>{series.filter((item) => item.axis === "percent").map((item) => <linearGradient key={item.key} id={`metric-fill-${item.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={item.color} stopOpacity={0.2} /><stop offset="100%" stopColor={item.color} stopOpacity={0} /></linearGradient>)}</defs><CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="time" hide /><YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} width={44} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }} content={<MetricChartTooltip axis="percent" activeKeys={activeSeries} />} />{(activeSeries.includes("cpu") || activeSeries.includes("memory")) && <ReferenceLine y={85} stroke="#F87171" strokeDasharray="4 4" label={<CriticalThresholdLabel />} />}{series.filter((item) => item.axis === "percent" && activeSeries.includes(item.key)).map((item) => <Area key={item.key} dataKey={item.key} name={item.name} type="monotone" stroke={item.color} strokeWidth={2} fill={`url(#metric-fill-${item.key})`} activeDot={{ r: 4 }} />)}
                    </AreaChart>}
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="flex min-h-[130px] flex-[1] flex-col border-t border-border/70 pt-2">
                <div className="px-1 text-[12px] font-medium text-muted-foreground">Throughput</div>
                <div className="min-h-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    {mode === "Line" ? <LineChart data={displayedChartData} syncId="metrics-time" syncMethod="value" margin={{ top: 8, right: 20, left: 0, bottom: 0 }}><CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="time" ticks={["12:00", "16:00", "20:00", "00:00", "04:00", "08:00"].filter((time) => displayedChartData.some((point) => point.time === time))} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} padding={{ left: 4, right: 16 }} /><YAxis domain={[0, "auto"]} tickCount={3} tickFormatter={(value) => String(Math.round(value))} width={38} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }} content={<MetricChartTooltip axis="throughput" activeKeys={activeSeries} />} />{series.filter((item) => item.axis === "throughput" && activeSeries.includes(item.key)).map((item) => <Line key={item.key} dataKey={item.key} name={item.name} type="monotone" stroke={item.color} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />)}</LineChart> : <AreaChart data={displayedChartData} syncId="metrics-time" syncMethod="value" margin={{ top: 8, right: 20, left: 0, bottom: 0 }}><defs>{series.filter((item) => item.axis === "throughput").map((item) => <linearGradient key={item.key} id={`metric-fill-${item.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={item.color} stopOpacity={0.2} /><stop offset="100%" stopColor={item.color} stopOpacity={0} /></linearGradient>)}</defs><CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="time" ticks={["12:00", "16:00", "20:00", "00:00", "04:00", "08:00"].filter((time) => displayedChartData.some((point) => point.time === time))} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} padding={{ left: 4, right: 16 }} /><YAxis domain={[0, "auto"]} tickCount={3} tickFormatter={(value) => String(Math.round(value))} width={38} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }} content={<MetricChartTooltip axis="throughput" activeKeys={activeSeries} />} />{series.filter((item) => item.axis === "throughput" && activeSeries.includes(item.key)).map((item) => <Area key={item.key} dataKey={item.key} name={item.name} type="monotone" stroke={item.color} strokeWidth={2} fill={`url(#metric-fill-${item.key})`} activeDot={{ r: 3 }} stackId={mode === "Stacked" ? "throughput" : undefined} />)}</AreaChart>}
                  </ResponsiveContainer>
                </div>
              </div>
              {dragSelection && <div aria-hidden="true" className="pointer-events-none absolute inset-y-3 z-10 border-x border-primary bg-primary/10" style={{ left: dragSelection.left, width: dragSelection.width }} />}
            </div>
          </div>
        </Panel>

        <Panel title="Top Metrics by Value" className="h-full min-h-[700px] min-w-0 p-4" action={<button onClick={() => toast("Showing all metrics by value.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[12px] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
          <div className="flex min-h-0 flex-1 flex-col overflow-x-auto pt-1">
            <table className="w-full min-w-[360px] text-left text-[12px]">
              <thead><tr className="border-b border-border text-muted-foreground"><th className="pb-1.5">Metric</th><th className="pb-1.5">Resource</th><th className="pb-1.5 text-right">Value</th><th className="pb-1.5 text-right">Change</th></tr></thead>
              <tbody>{topMetricsByValue.map((metric) => <tr key={`${metric.name}-${metric.resource}`} className="h-12 border-b border-border/70 last:border-0"><td className="whitespace-nowrap py-2 font-semibold text-foreground"><i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: metric.color }} />{metric.name} {metric.unit === "%" ? "(%)" : `(${metric.unit})`}</td><td className="whitespace-nowrap py-2 text-foreground">{metric.resource}</td><td className="whitespace-nowrap py-2 text-right text-foreground">{metric.value} {metric.unit}</td><td className={cn("whitespace-nowrap py-2 text-right font-semibold", changeTone(metric))}>{metric.direction === "down" ? "↓" : "↑"} {metric.change}%</td></tr>)}</tbody>
            </table>
            <div className="mt-auto flex items-center border-t border-border pt-3 text-[12px] text-muted-foreground"><span>{topMetricsByValue.length} metrics · {topMetricsByValue.filter((metric) => metric.critical).length} critical · {topMetricsByValue.filter((metric) => metric.improving || metric.trendTone === "good").length} improving</span></div>
          </div>
        </Panel>
      </section>

      <section aria-label="Metric details" className="grid items-stretch gap-2.5 lg:grid-cols-[1.65fr_1fr_1.05fr]">
        <Panel title="Recent Metrics" className="min-w-0 p-4" headerClassName="h-10" action={<span className="text-[12px] text-muted-foreground">{visibleMetrics.length} shown</span>}>
          <div className="flex min-h-0 flex-1 flex-col pt-1">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full table-fixed text-left text-[12px]">
                <colgroup><col style={{ width: "28%" }} /><col style={{ width: "15%" }} /><col style={{ width: "22%" }} /><col style={{ width: "17%" }} /><col style={{ width: "18%" }} /></colgroup>
                <thead><tr className="border-b border-border text-muted-foreground">{["Metric Name", "Type", "Resource", "Last Value", "Trend"].map((heading) => <th key={heading} className="overflow-hidden text-ellipsis whitespace-nowrap px-1 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
                <tbody>{visibleMetrics.slice((page - 1) * rowsPerPage, page * rowsPerPage).map((metric, index) => <tr key={`${metric.name}-${metric.resource}-${index}`} className="h-10 border-b border-border/70 transition-colors last:border-0 hover:bg-muted/50"><td title={metric.name} className="overflow-hidden text-ellipsis whitespace-nowrap px-1 font-semibold text-foreground"><i className="mr-1 inline-block h-2 w-2 shrink-0 rounded-full align-[-1px]" style={{ backgroundColor: metric.color }} />{metric.name}</td><td title={metric.type} className="overflow-hidden text-ellipsis whitespace-nowrap px-1 text-foreground">{metric.type}</td><td title={metric.resource} className="overflow-hidden text-ellipsis whitespace-nowrap px-1 text-foreground">{metric.resource}</td><td className="overflow-hidden text-ellipsis whitespace-nowrap px-1 text-foreground">{metric.value} {metric.unit}</td><td className="overflow-hidden px-1"><Sparkline color={metric.color} seed={index + page} /></td></tr>)}</tbody>
              </table>
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5 text-[12px] text-muted-foreground">
              <span>Showing {visibleMetrics.length ? (page - 1) * rowsPerPage + 1 : 0}-{Math.min(page * rowsPerPage, visibleMetrics.length)} of {appliedFilters.search || appliedFilters.type !== "All" || appliedFilters.resource !== "All" ? visibleMetrics.length : TOTAL_METRICS} metrics</span>
              <div className="flex items-center gap-1">
                <label className="mr-1 flex items-center gap-1">Rows per page:
                  <Select value={String(rowsPerPage)} onValueChange={(value) => { setRowsPerPage(Number(value)); setPage(1); }}>
                    <SelectTrigger aria-label="Rows per page" className="h-7 w-[64px] text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROWS_PER_PAGE_OPTIONS.map((option) => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
                {Array.from({ length: Math.min(5, Math.max(1, Math.ceil(visibleMetrics.length / rowsPerPage))) }, (_, index) => index + 1).map((value) => <button key={value} onClick={() => setPage(value)} className={cn("rounded px-1.5 py-1", page === value ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>{value}</button>)}
                <span>…</span><button onClick={() => setPage(Math.max(1, Math.ceil(visibleMetrics.length / rowsPerPage)))} className="rounded px-1.5 py-1 hover:bg-accent">492</button>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Metrics by Type" className="min-w-0 p-4" headerClassName="h-10">
          <MetricTypeDonut />
          <div className="mt-auto pt-3 text-[12px] text-muted-foreground">Updated 1m ago</div>
        </Panel>

        <Panel title="Recent Metric Alerts" className="min-w-0 p-4" headerClassName="h-10" action={<button onClick={() => toast("Showing all metric alerts.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[12px] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
          <div className="flex min-h-0 flex-1 flex-col pt-1">
            <div className="min-h-0 flex-1 space-y-0 overflow-y-auto">
              {recentAlerts.map((alert) => <div key={alert.text} title={alert.text} className="grid h-11 grid-cols-[8px_minmax(0,1fr)_56px] items-center gap-2 text-[12px]"><i className={cn("h-2 w-2 shrink-0 rounded-full", alert.severity === "critical" ? "bg-rose-500" : alert.severity === "warning" ? "bg-amber-500" : "bg-blue-500")} /><span className="truncate font-semibold text-foreground">{alert.text}</span><span className="whitespace-nowrap text-right text-muted-foreground">{alert.ago}</span></div>)}
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5 text-[12px] text-muted-foreground">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {alertSeverityLegend.map((item) => <span key={item.name} className="flex items-center gap-1.5"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>)}
              </span>
              <span className="whitespace-nowrap">Showing {recentAlerts.length} of {TOTAL_ALERTS} alerts</span>
            </div>
          </div>
        </Panel>
      </section>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}
