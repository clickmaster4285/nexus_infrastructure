"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, Download, Minus, MoreVertical, Plus, type LucideIcon } from "lucide-react";
import * as echarts from "echarts/core";
import {
  BarChart as EBarChart,
  HeatmapChart as EHeatmapChart,
  LineChart as ELineChart,
  PieChart as EPieChart,
} from "echarts/charts";
import {
  AxisPointerComponent,
  GridComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import type { MetricStat } from "@/data/mock/dashboard";
import { cn } from "@/lib/utils";

echarts.use([
  ELineChart,
  EBarChart,
  EPieChart,
  EHeatmapChart,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  AxisPointerComponent,
  VisualMapComponent,
  LabelLayout,
  CanvasRenderer,
]);

/** Group id used to sync the crosshair between the three trend charts. */
const CHART_GROUP = "network-monitor";

/** Muted palette shared by every chart on the page. */
const COLORS = {
  inbound: "oklch(0.7137 0.1434 254.62)",
  outbound: "oklch(0.7729 0.1535 163.22)",
  errors: "oklch(0.7106 0.1661 22.22)",
  capacity: "oklch(0.8369 0.1644 84.43)",
  neutral: "oklch(0.5544 0.0407 257.42)",
};

const stats: MetricStat[] = [
  { label: "Total Interfaces", value: "128", change: "4 new", trend: "up", tone: "blue", icon: "network" },
  { label: "Up Interfaces", value: "112", change: "87.5%", trend: "flat", tone: "green", icon: "online" },
  { label: "Down Interfaces", value: "6", change: "4.7%", trend: "down", tone: "red", icon: "offline" },
  { label: "Avg Bandwidth Usage", value: "42.6%", change: "6.3%", trend: "up", tone: "purple", icon: "activity" },
  { label: "Total Traffic In", value: "2.45 TB", change: "12.4%", trend: "up", tone: "blue", icon: "download" },
  { label: "Total Traffic Out", value: "1.92 TB", change: "9.1%", trend: "up", tone: "green", icon: "network" },
  { label: "Network Alerts", value: "18", change: "2", trend: "down", tone: "amber", icon: "bell" },
];

/** Link capacity in Mbps, used to derive bandwidth utilisation from traffic. */
const LINK_CAPACITY_MBPS = 600;

export interface NetworkSample {
  time: string;
  /** Inbound traffic in Mbps. */
  trafficIn: number;
  /** Outbound traffic in Mbps. */
  trafficOut: number;
  /** Inbound packets per second. */
  packetsIn: number;
  /** Outbound packets per second. */
  packetsOut: number;
  /** Errored packets per second. */
  errors: number;
  /** Dropped packets per second. */
  drops: number;
}

/**
 * Single source of truth for the three trend charts. Bandwidth utilisation is
 * derived from the traffic figures so every card stays consistent.
 */
export const networkSamples: NetworkSample[] = [
  { time: "12:00", trafficIn: 390, trafficOut: 235, packetsIn: 14000, packetsOut: 8200, errors: 120, drops: 40 },
  { time: "14:00", trafficIn: 345, trafficOut: 250, packetsIn: 13200, packetsOut: 8600, errors: 95, drops: 35 },
  { time: "16:00", trafficIn: 410, trafficOut: 280, packetsIn: 15100, packetsOut: 9400, errors: 160, drops: 60 },
  { time: "18:00", trafficIn: 475, trafficOut: 265, packetsIn: 16000, packetsOut: 9100, errors: 240, drops: 95 },
  { time: "20:00", trafficIn: 390, trafficOut: 290, packetsIn: 14100, packetsOut: 9600, errors: 135, drops: 50 },
  { time: "22:00", trafficIn: 450, trafficOut: 235, packetsIn: 15200, packetsOut: 8300, errors: 110, drops: 45 },
  { time: "00:00", trafficIn: 365, trafficOut: 245, packetsIn: 13900, packetsOut: 8700, errors: 85, drops: 30 },
  { time: "02:00", trafficIn: 430, trafficOut: 295, packetsIn: 16100, packetsOut: 9900, errors: 175, drops: 70 },
  { time: "04:00", trafficIn: 385, trafficOut: 250, packetsIn: 14800, packetsOut: 8800, errors: 105, drops: 38 },
  { time: "06:00", trafficIn: 455, trafficOut: 275, packetsIn: 15900, packetsOut: 9300, errors: 145, drops: 55 },
  { time: "08:00", trafficIn: 420, trafficOut: 300, packetsIn: 15200, packetsOut: 9700, errors: 125, drops: 48 },
  { time: "10:00", trafficIn: 375, trafficOut: 240, packetsIn: 14000, packetsOut: 8400, errors: 98, drops: 33 },
  { time: "12:00", trafficIn: 445, trafficOut: 270, packetsIn: 15500, packetsOut: 9000, errors: 155, drops: 58 },
];

const interfaces = [
  { name: "eth0", device: "core-switch-01", bandwidth: 92.3, inbound: 862.5, outbound: 745.3 },
  { name: "ge-0/0/1", device: "edge-router-01", bandwidth: 78.6, inbound: 612.4, outbound: 498.7 },
  { name: "eth1", device: "db-server-01", bandwidth: 65.1, inbound: 452.1, outbound: 321.3 },
  { name: "ge-0/0/2", device: "edge-router-02", bandwidth: 54.7, inbound: 312.6, outbound: 287.9 },
  { name: "eth0", device: "cache-server-01", bandwidth: 41.3, inbound: 210.3, outbound: 167.2 },
  { name: "eth2", device: "app-server-02", bandwidth: 38.8, inbound: 198.2, outbound: 143.5 },
  { name: "ge-0/0/3", device: "core-switch-02", bandwidth: 34.2, inbound: 178.4, outbound: 134.2 },
  { name: "eth1", device: "worker-01", bandwidth: 29.6, inbound: 142.6, outbound: 108.5 },
  { name: "ge-0/0/4", device: "edge-router-01", bandwidth: 24.7, inbound: 124.3, outbound: 96.2 },
  { name: "eth0", device: "backup-01", bandwidth: 19.2, inbound: 98.4, outbound: 75.6 },
];

const errorInterfaces = [
  { name: "eth3", device: "app-server-01", errorsIn: 12345, errorsOut: 8765, discards: 2341 },
  { name: "ge-0/0/3", device: "edge-router-01", errorsIn: 9876, errorsOut: 6543, discards: 1234 },
  { name: "eth1", device: "cache-server-01", errorsIn: 6432, errorsOut: 2987, discards: 987 },
  { name: "ge-0/0/1", device: "edge-router-02", errorsIn: 4321, errorsOut: 2123, discards: 643 },
  { name: "eth0", device: "backup-server-01", errorsIn: 3210, errorsOut: 1876, discards: 521 },
  { name: "eth2", device: "core-switch-02", errorsIn: 2145, errorsOut: 1258, discards: 312 },
];

const interfaceStates = [
  { name: "Up", status: "up", value: 112, color: "oklch(0.6969 0.146 157.59)", percent: "87.5%" },
  { name: "Warning", status: "warning", value: 10, color: "oklch(0.7593 0.163 68.27)", percent: "7.8%" },
  { name: "Down", status: "down", value: 6, color: "oklch(0.6197 0.2192 21.68)", percent: "4.7%" },
  { name: "Disabled", status: "disabled", value: 0, color: "oklch(0.7819 0.0246 256.12)", percent: "0%" },
];

/** Traffic split by category, in TB. Single source for the traffic totals. */
const trafficDistribution = [
  { name: "Web Traffic", value: 1.62, percent: "37.1%", color: "oklch(0.5906 0.1926 258.69)" },
  { name: "DB Traffic", value: 1.15, percent: "26.3%", color: "oklch(0.6969 0.146 157.59)" },
  { name: "Streaming", value: 0.85, percent: "19.5%", color: "oklch(0.5571 0.2214 299.62)" },
  { name: "Other", value: 0.75, percent: "17.1%", color: "oklch(0.7593 0.163 68.27)" },
];

/** Total traffic across the fleet, in TB (In + Out). */
const TOTAL_TRAFFIC_TB = Number(trafficDistribution.reduce((sum, item) => sum + item.value, 0).toFixed(2));

/** Protocol split, derived from the same total so both donuts always agree. */
const protocols = [
  { name: "TCP", share: 0.592, percent: "59.2%", color: "oklch(0.5906 0.1926 258.69)" },
  { name: "UDP", share: 0.278, percent: "27.8%", color: "oklch(0.6969 0.146 157.59)" },
  { name: "ICMP", share: 0.073, percent: "7.3%", color: "oklch(0.5571 0.2214 299.62)" },
  { name: "Other", share: 0.057, percent: "5.7%", color: "oklch(0.7593 0.163 68.27)" },
].map((item) => ({
  name: item.name,
  value: Number((TOTAL_TRAFFIC_TB * item.share).toFixed(2)),
  percent: item.percent,
  label: `${(TOTAL_TRAFFIC_TB * item.share).toFixed(2)} TB (${item.percent})`,
  color: item.color,
}));

const talkersByTraffic = [
  { address: "10.10.10.25", value: "652.4 GB", width: "100%", color: "bg-blue-500" },
  { address: "10.10.20.18", value: "521.7 GB", width: "80%", color: "bg-emerald-500" },
  { address: "192.168.1.45", value: "412.9 GB", width: "63%", color: "bg-violet-500" },
  { address: "172.16.5.22", value: "312.6 GB", width: "48%", color: "bg-amber-500" },
  { address: "10.10.30.11", value: "286.3 GB", width: "44%", color: "bg-cyan-500" },
];

const talkersByConnections = [
  { address: "10.10.10.25", value: "12,543", width: "100%", color: "bg-blue-500" },
  { address: "10.10.20.18", value: "9,876", width: "79%", color: "bg-emerald-500" },
  { address: "192.168.1.45", value: "7,854", width: "63%", color: "bg-violet-500" },
  { address: "172.16.5.22", value: "6,321", width: "50%", color: "bg-amber-500" },
  { address: "10.10.30.11", value: "5,432", width: "43%", color: "bg-cyan-500" },
];

const networkAlerts = [
  { alert: "High bandwidth usage", device: "core-switch-01", iface: "eth0", severity: "Critical", message: "Inbound bandwidth usage is 92% which is above the threshold (90%)", time: "2m ago" },
  { alert: "Interface down", device: "edge-router-02", iface: "ge-0/0/4", severity: "Warning", message: "Interface is down", time: "7m ago" },
  { alert: "High packet errors", device: "app-server-01", iface: "eth3", severity: "Warning", message: "High packet error rate detected (1.25%)", time: "12m ago" },
  { alert: "Interface up", device: "db-server-01", iface: "eth2", severity: "Info", message: "Interface is back up", time: "18m ago" },
  { alert: "High latency", device: "edge-router-01", iface: "ge-0/0/1", severity: "Warning", message: "Average latency is 125ms which is above the threshold (100ms)", time: "25m ago" },
];

type Aggregation = "Average" | "Max" | "Min";
type RangeKey = "1H" | "6H" | "12H" | "24H";

const RANGE_POINTS: Record<RangeKey, number> = { "1H": 2, "6H": 5, "12H": 9, "24H": networkSamples.length };

/** Interface names used by the utilisation heatmap. */
const heatmapInterfaces = ["eth0", "eth1", "wan1", "wan2", "lo"];

/** Hours of the day shown on the heatmap x-axis. */
const heatmapHours = ["00", "02", "04", "06", "08", "10", "12", "14", "16", "18", "20", "22"];

/**
 * Deterministic interface utilisation per hour, derived from the interface
 * bandwidth figures so the heatmap and the tables never disagree.
 */
const heatmapData = heatmapInterfaces.flatMap((name, rowIndex) => {
  const base = interfaces.find((item) => item.name === name)?.bandwidth ?? 40;
  return heatmapHours.map((hour, columnIndex) => {
    const wave = Math.sin((columnIndex + rowIndex * 2) / 2.1) * 14;
    const value = Math.max(4, Math.min(99, base * 0.72 + wave + ((rowIndex * 7 + columnIndex * 5) % 11)));
    return [columnIndex, rowIndex, Math.round(value)];
  });
});

/** Latency (ms) and packet loss (%) per sample, derived from the same source. */
const latencyAndLoss = networkSamples.map((sample) => {
  const totalPackets = sample.packetsIn + sample.packetsOut;
  const loss = ((sample.errors + sample.drops) / Math.max(totalPackets, 1)) * 100;
  return {
    time: sample.time,
    latency: Math.round(18 + (sample.trafficIn / LINK_CAPACITY_MBPS) * 26 + loss * 40),
    loss: Number(loss.toFixed(2)),
  };
});

/**
 * Applies the selected aggregation to a series without flattening it:
 * Average becomes a centred moving average, Max / Min become running peaks.
 */
function aggregateSeries(values: number[], mode: Aggregation): number[] {
  if (mode === "Max") {
    let peak = Number.NEGATIVE_INFINITY;
    return values.map((value) => (peak = Math.max(peak, value)));
  }
  if (mode === "Min") {
    let low = Number.POSITIVE_INFINITY;
    return values.map((value) => (low = Math.min(low, value)));
  }
  return values.map((value, index) => {
    const window = values.slice(Math.max(0, index - 1), index + 2);
    return window.reduce((sum, item) => sum + item, 0) / window.length;
  });
}

/** Theme colours resolved from the CSS variables (ECharts canvas cannot read them). */
interface ChartTheme {
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  card: string;
  popover: string;
  popoverForeground: string;
  dark: boolean;
}

const FALLBACK_THEME: ChartTheme = {
  foreground: "oklch(0.2595 0.0482 258.68)",
  muted: "oklch(0.9598 0.0091 258.34)",
  mutedForeground: "oklch(0.6001 0.0389 260.33)",
  border: "oklch(0.9318 0.0126 255.51)",
  card: "oklch(1 0 89.88)",
  popover: "oklch(1 0 89.88)",
  popoverForeground: "oklch(0.2595 0.0482 258.68)",
  dark: false,
};

/** Reads the current theme values from the DOM. */
function readChartTheme(scope: Element | null): ChartTheme {
  if (!scope) return FALLBACK_THEME;
  const styles = getComputedStyle(scope);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    foreground: read("--foreground", FALLBACK_THEME.foreground),
    muted: read("--muted", FALLBACK_THEME.muted),
    mutedForeground: read("--muted-foreground", FALLBACK_THEME.mutedForeground),
    border: read("--border", FALLBACK_THEME.border),
    card: read("--card", FALLBACK_THEME.card),
    popover: read("--popover", FALLBACK_THEME.popover),
    popoverForeground: read("--popover-foreground", FALLBACK_THEME.popoverForeground),
    dark: scope.classList.contains("dark"),
  };
}

/**
 * Tracks the active theme. The shell toggles a `dark` class without
 * re-rendering children, so a MutationObserver watches for the change.
 */
function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(FALLBACK_THEME);

  useEffect(() => {
    const scope = document.body.firstElementChild;
    const resolve = () => {
      const next = readChartTheme(scope);
      setTheme((current) => (current.foreground === next.foreground && current.border === next.border && current.dark === next.dark ? current : next));
    };
    resolve();
    if (!scope) return;
    const observer = new MutationObserver(resolve);
    observer.observe(scope, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

/** Vertical gradient used for the area fills. */
function verticalGradient(color: string, from = 0.3, to = 0.05) {
  const alpha = (value: number) => Math.round(value * 255).toString(16).padStart(2, "0");
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: `${color}${alpha(from)}` },
    { offset: 1, color: `${color}${alpha(to)}` },
  ]);
}

/** Builds the shared tooltip card markup. */
function tooltipCard(theme: ChartTheme, title: string, rows: { name: string; value: string; color: string }[]) {
  const body = rows
    .map((row) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:1.25rem;line-height:1.125rem"><span style="display:flex;align-items:center;gap:0.375rem;color:${theme.mutedForeground}"><i style="width:0.5rem;height:0.5rem;border-radius:50%;background:${row.color};display:inline-block"></i>${row.name}</span><b style="font-variant-numeric:tabular-nums;color:${theme.foreground}">${row.value}</b></div>`)
    .join("");
  return `<div style="min-width:10.75rem;border-radius:0.5rem;border:0.0625rem solid ${theme.border};background:${theme.popover};box-shadow:0 0.5rem 1.5rem oklch(0.2447 0.0544 259.66 / 0.16);padding:0.5rem 0.75rem;font-size:0.75rem;color:${theme.popoverForeground}"><div style="font-weight:600;margin-bottom:0.375rem">${title}</div>${body}</div>`;
}

/**
 * ECharts wrapper that only initialises once the container has a size and
 * keeps the chart in sync with its container via a ResizeObserver.
 */
function EChart({ option, className }: { option: EChartsOption; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const optionRef = useRef(option);
  optionRef.current = option;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let chart: echarts.ECharts | null = null;

    const observer = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      if (!chart) {
        chart = echarts.init(container, undefined, { renderer: "canvas" });
        chartRef.current = chart;
        echarts.connect(CHART_GROUP);
        chart.group = CHART_GROUP;
        chart.setOption(optionRef.current, true);
      } else {
        chart.resize();
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={containerRef} className={className} />;
}

/** Legend chip that toggles a series on or off. */
function SeriesChip({ name, color, value, unit, enabled, onToggle }: {
  name: string; color: string; value: number; unit: string; enabled: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      title={enabled ? `Hide ${name}` : `Show ${name}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors",
        enabled ? "border-border bg-background text-foreground" : "border-transparent bg-muted text-muted-foreground line-through",
      )}
    >
      <i aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: enabled ? color : "oklch(0.7107 0.0351 256.79)" }} />
      {name}
      <b className="tabular-nums">{value} {unit}</b>
    </button>
  );
}

/** Compact, color-coded chart summary. */
function SummaryChip({ label, value, tone = "blue" }: { label: string; value: string; tone?: "blue" | "green" | "amber" | "rose" | "violet" }) {
  const toneClasses = {
    blue: "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
    amber: "border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
    rose: "border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300",
    violet: "border-violet-100 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.75rem]", toneClasses[tone])}>
      <span className="opacity-80">{label}</span>
      <b className="tabular-nums">{value}</b>
    </span>
  );
}

/** Interface status shown across the page. */
type InterfaceStatus = "up" | "down" | "warning" | "disabled";

/** Status -> icon, label, colours and tooltip. */
const statusBadges: Record<InterfaceStatus, { icon: LucideIcon; label: string; className: string; tooltip: string }> = {
  up: { icon: ArrowUp, label: "Up", className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-600/15", tooltip: "Interface is up" },
  down: { icon: ArrowDown, label: "Down", className: "bg-red-50 text-red-600 dark:bg-red-600/15", tooltip: "Interface is down" },
  warning: { icon: AlertTriangle, label: "Warning", className: "bg-amber-50 text-amber-600 dark:bg-amber-600/15", tooltip: "Interface is in a warning state" },
  disabled: { icon: Minus, label: "Disabled", className: "bg-slate-100 text-slate-500 dark:bg-slate-500/15", tooltip: "Interface is disabled" },
};

/** Shared status badge so every status chip looks identical. */
function StatusBadge({ status }: { status: InterfaceStatus }) {
  const badge = statusBadges[status] ?? statusBadges.up;
  const Icon = badge.icon;
  return (
    <span
      title={badge.tooltip}
      aria-label={badge.tooltip}
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.75rem] font-medium", badge.className)}
    >
      <Icon size={12} aria-hidden="true" />
      {badge.label}
    </span>
  );
}

function TrafficDonut({ data, total, unit }: { data: { name: string; value: number; label?: string; percent?: string; color: string }[]; total: string; unit?: string }) {
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="flex h-[9.875rem] items-center gap-2.5">
      <div className="relative h-[8.75rem] w-[42%] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="88%" paddingAngle={1} stroke="none">
              {data.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie><Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <b className="font-display text-[1.125rem] font-extrabold leading-tight text-foreground">{total}</b>
          <span className="text-[0.75rem] text-muted-foreground">{unit ?? "Total"}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="grid grid-cols-[minmax(max-content,1fr)_auto_auto] items-center gap-x-2 gap-y-1.5 whitespace-nowrap text-[0.75rem]">
          {data.map((item) => (
            <Fragment key={item.name}>
              <span className="flex min-w-0 items-center gap-1.5 text-foreground">
                <i aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}
              </span>
              <b className="tabular-nums text-foreground">{item.value} TB</b>
              <span className="tabular-nums text-muted-foreground">{item.percent ?? `(${Math.round((item.value / Math.max(totalValue, 1)) * 100)}%)`}</span>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function TalkerList({ title, items, onViewAll }: { title: string; items: { address: string; value: string; width: string; color: string }[]; onViewAll?: () => void }) {
  return (
    <Panel title={title} className="min-w-0" action={onViewAll ? <button onClick={onViewAll} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button> : undefined}>
      <div className="flex flex-1 items-center py-2">
        <div className="w-full space-y-3">
          {items.map((item) => <div key={item.address} className="grid grid-cols-[minmax(0,1fr)_minmax(2.8125rem,1.3fr)_auto] items-center gap-2 text-[0.75rem]"><span className="truncate text-foreground">{item.address}</span><div className="h-[0.4375rem] rounded-full bg-muted"><div className={`h-full rounded-full ${item.color}`} style={{ width: item.width }} /></div><b className="text-right text-foreground">{item.value}</b></div>)}
          <div className="flex justify-between border-t border-border pt-2 text-[0.75rem] font-semibold text-foreground"><span>Total</span><span>{items === talkersByTraffic ? "2.19 TB" : "41,626"}</span></div>
        </div>
      </div>
    </Panel>
  );
}

export function NetworkMonitoringDashboard() {
  const theme = useChartTheme();
  const [notice, setNotice] = useState("");
  const [range, setRange] = useState<RangeKey>("24H");
  const [aggregation, setAggregation] = useState<Aggregation>("Average");
  const [menuOpen, setMenuOpen] = useState(false);
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);

  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const exportCsv = () => {
    const header = ["Time", "Traffic In (Mbps)", "Traffic Out (Mbps)", "Bandwidth In (%)", "Bandwidth Out (%)", "Packets In (pps)", "Packets Out (pps)", "Errors (pps)", "Drops (pps)"];
    const rows = networkSamples.map((sample) => [
      sample.time,
      String(sample.trafficIn),
      String(sample.trafficOut),
      ((sample.trafficIn / LINK_CAPACITY_MBPS) * 100).toFixed(1),
      ((sample.trafficOut / LINK_CAPACITY_MBPS) * 100).toFixed(1),
      String(sample.packetsIn),
      String(sample.packetsOut),
      String(sample.errors),
      String(sample.drops),
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "network-monitoring.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast("Network data exported.");
  };

  const toggleSeries = (key: string) => {
    setHiddenSeries((current) => current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]);
  };
  const visible = (key: string) => !hiddenSeries.includes(key);

  const rangeCount = RANGE_POINTS[range];
  const samples = useMemo(() => networkSamples.slice(Math.max(0, networkSamples.length - rangeCount)), [rangeCount]);
  const times = useMemo(() => samples.map((sample) => sample.time), [samples]);

  const axisBase = {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: theme.mutedForeground, fontSize: 11 },
    splitLine: { lineStyle: { color: theme.border, type: "dashed" as const, width: 1 } },
  };

  const pointerBase = {
    type: "line" as const,
    lineStyle: { color: theme.mutedForeground, type: "dashed" as const, width: 1 },
    label: { show: false },
  };

  const bandwidthOption = useMemo<EChartsOption>(() => {
    const inbound = aggregateSeries(samples.map((sample) => (sample.trafficIn / LINK_CAPACITY_MBPS) * 100), aggregation);
    const outbound = aggregateSeries(samples.map((sample) => (sample.trafficOut / LINK_CAPACITY_MBPS) * 100), aggregation);
    return {
      animationDuration: 600,
      grid: { top: 16, right: 16, bottom: 22, left: 46 },
      tooltip: {
        trigger: "axis",
        axisPointer: pointerBase,
        backgroundColor: theme.popover,
        borderColor: theme.border,
        borderWidth: 1,
        padding: 0,
        textStyle: { color: theme.popoverForeground, fontSize: 12 },
        formatter: (params: unknown) => {
          const items = params as { axisValue: string; seriesName: string; value: number; color: string }[];
          if (!items?.length) return "";
          return tooltipCard(theme, items[0].axisValue, items
            .filter((item) => visible(item.seriesName))
            .map((item) => ({ name: item.seriesName, value: `${Math.abs(item.value).toFixed(1)} %`, color: item.color })));
        },
      },
      xAxis: { type: "category", data: times, ...axisBase, splitLine: { show: false }, axisLabel: { ...axisBase.axisLabel, interval: Math.max(0, Math.ceil(times.length / 6) - 1) } },
      yAxis: {
        type: "value",
        min: -100,
        max: 100,
        interval: 25,
        ...axisBase,
        axisLabel: { ...axisBase.axisLabel, formatter: (value: number) => `${Math.abs(value)}%` },
      },
      series: [
        ...(visible("Inbound Usage") ? [{
          name: "Inbound Usage",
          type: "line" as const,
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          showSymbol: false,
          data: inbound.map((value) => Number(value.toFixed(1))),
          lineStyle: { width: 2, color: COLORS.inbound },
          itemStyle: { color: COLORS.inbound },
          areaStyle: { color: verticalGradient(COLORS.inbound, 0.3, 0.05) },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: COLORS.capacity, type: "dashed" as const, width: 1 },
            label: {
              position: "insideEndTop" as const,
              formatter: "Capacity warning",
              color: COLORS.capacity,
              fontSize: 10,
              padding: [3, 6],
              backgroundColor: `${COLORS.capacity}26`,
              borderRadius: 8,
            },
            data: [{ yAxis: 80 }],
          },
        }] : []),
        ...(visible("Outbound Usage") ? [{
          name: "Outbound Usage",
          type: "line" as const,
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          showSymbol: false,
          data: outbound.map((value) => Number((-value).toFixed(1))),
          lineStyle: { width: 2, color: COLORS.outbound },
          itemStyle: { color: COLORS.outbound },
          areaStyle: { color: verticalGradient(COLORS.outbound, 0.3, 0.05) },
        }] : []),
      ],
    };
  }, [samples, aggregation, hiddenSeries, theme]);

  const trafficOption = useMemo<EChartsOption>(() => {
    const inbound = aggregateSeries(samples.map((sample) => sample.trafficIn), aggregation);
    const outbound = aggregateSeries(samples.map((sample) => sample.trafficOut), aggregation);
    const totals = inbound.map((value, index) => value + outbound[index]);
    const peakIndex = totals.indexOf(Math.max(...totals));
    const peakValue = Math.max(...totals);
    const peakTime = times[peakIndex] ?? "";
    return {
      animationDuration: 600,
      grid: { top: 26, right: 18, bottom: 22, left: 46 },
      tooltip: {
        trigger: "axis",
        axisPointer: pointerBase,
        backgroundColor: theme.popover,
        borderColor: theme.border,
        borderWidth: 1,
        padding: 0,
        textStyle: { color: theme.popoverForeground, fontSize: 12 },
        formatter: (params: unknown) => {
          const items = params as { axisValue: string; seriesName: string; value: number; color: string }[];
          if (!items?.length) return "";
          return tooltipCard(theme, items[0].axisValue, items
            .filter((item) => visible(item.seriesName))
            .map((item) => ({ name: item.seriesName, value: `${item.value} Mbps`, color: item.color })));
        },
      },
      xAxis: { type: "category", data: times, boundaryGap: false, ...axisBase, splitLine: { show: false }, axisLabel: { ...axisBase.axisLabel, interval: Math.max(0, Math.ceil(times.length / 6) - 1) } },
      yAxis: { type: "value", scale: true, splitNumber: 4, ...axisBase, axisLabel: { ...axisBase.axisLabel, formatter: (value: number) => String(value) } },
      series: [
        ...(visible("Traffic In") ? [{
          name: "Traffic In",
          type: "line" as const,
          stack: "total",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          showSymbol: false,
          data: inbound.map((value) => Number(value.toFixed(1))),
          lineStyle: { width: 2, color: COLORS.inbound },
          itemStyle: { color: COLORS.inbound },
          areaStyle: { color: verticalGradient(COLORS.inbound, 0.3, 0.05) },
          markPoint: {
            symbol: "circle",
            symbolSize: 7,
            itemStyle: { color: COLORS.inbound, borderColor: theme.card, borderWidth: 2 },
            label: {
              show: true,
              position: "top" as const,
              distance: 12,
              formatter: `Peak ${Math.round(peakValue)} Mbps · ${peakTime}`,
              color: theme.foreground,
              fontSize: 11,
              backgroundColor: theme.muted,
              padding: [4, 8],
              borderRadius: 8,
            },
            data: [{ name: "Peak", coord: [peakTime, peakValue] }],
          },
        }] : []),
        ...(visible("Traffic Out") ? [{
          name: "Traffic Out",
          type: "line" as const,
          stack: "total",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          showSymbol: false,
          data: outbound.map((value) => Number(value.toFixed(1))),
          lineStyle: { width: 2, color: COLORS.outbound },
          itemStyle: { color: COLORS.outbound },
          areaStyle: { color: verticalGradient(COLORS.outbound, 0.3, 0.05) },
        }] : []),
      ],
    };
  }, [samples, aggregation, hiddenSeries, theme]);

  const packetsOption = useMemo<EChartsOption>(() => {
    const inbound = aggregateSeries(samples.map((sample) => sample.packetsIn), aggregation);
    const outbound = aggregateSeries(samples.map((sample) => sample.packetsOut), aggregation);
    const errors = samples.map((sample) => sample.errors);
    const drops = samples.map((sample) => sample.drops);
    const maxLoss = Math.max(...errors, ...drops, 1);
    return {
      animationDuration: 600,
      grid: [
        { top: 16, right: 18, height: "56%", bottom: "30%" },
        { top: "74%", right: 18, height: "12%", bottom: 22 },
      ],
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      tooltip: {
        trigger: "axis",
        axisPointer: pointerBase,
        backgroundColor: theme.popover,
        borderColor: theme.border,
        borderWidth: 1,
        padding: 0,
        textStyle: { color: theme.popoverForeground, fontSize: 12 },
        formatter: (params: unknown) => {
          const items = params as { axisValue: string; seriesName: string; value: number; color: string }[];
          if (!items?.length) return "";
          return tooltipCard(theme, items[0].axisValue, items.map((item) => ({
            name: item.seriesName,
            value: `${Math.round(item.value).toLocaleString()} pps`,
            color: item.color,
          })));
        },
      },
      xAxis: [
        { type: "category", data: times, gridIndex: 0, boundaryGap: false, ...axisBase, splitLine: { show: false }, axisLabel: { show: false } },
        { type: "category", data: times, gridIndex: 1, boundaryGap: false, ...axisBase, splitLine: { show: false }, axisLabel: { ...axisBase.axisLabel, interval: Math.max(0, Math.ceil(times.length / 6) - 1) } },
      ],
      yAxis: [
        { type: "value", gridIndex: 0, name: "pps", nameTextStyle: { color: theme.mutedForeground, fontSize: 11, align: "left" }, ...axisBase, axisLabel: { ...axisBase.axisLabel, formatter: (value: number) => `${Math.round(value / 1000)}K` } },
        { type: "value", gridIndex: 1, max: maxLoss, ...axisBase, axisLabel: { show: false }, splitLine: { show: false } },
      ],
      series: [
        {
          name: "Packets In",
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          showSymbol: false,
          data: inbound.map((value) => Number(value.toFixed(0))),
          lineStyle: { width: 2, color: COLORS.inbound },
          itemStyle: { color: COLORS.inbound },
        },
        {
          name: "Packets Out",
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          showSymbol: false,
          data: outbound.map((value) => Number(value.toFixed(0))),
          lineStyle: { width: 2, color: COLORS.outbound },
          itemStyle: { color: COLORS.outbound },
        },
        {
          name: "Errors",
          type: "bar",
          xAxisIndex: 1,
          yAxisIndex: 1,
          barMaxWidth: 7,
          data: errors,
          itemStyle: { color: COLORS.errors, opacity: 0.9 },
        },
        {
          name: "Drops",
          type: "bar",
          xAxisIndex: 1,
          yAxisIndex: 1,
          barMaxWidth: 7,
          data: drops,
          itemStyle: { color: COLORS.errors, opacity: 0.45 },
        },
      ],
    };
  }, [samples, aggregation, theme]);

  const latencyOption = useMemo<EChartsOption>(() => {
    const latency = aggregateSeries(latencyAndLoss.map((point) => point.latency), aggregation);
    const loss = latencyAndLoss.map((point) => point.loss);
    return {
      animationDuration: 600,
      grid: { top: 26, right: 18, bottom: 22, left: 44 },
      tooltip: {
        trigger: "axis",
        axisPointer: pointerBase,
        backgroundColor: theme.popover,
        borderColor: theme.border,
        borderWidth: 1,
        padding: 0,
        textStyle: { color: theme.popoverForeground, fontSize: 12 },
        formatter: (params: unknown) => {
          const items = params as { axisValue: string; seriesName: string; value: number; color: string }[];
          if (!items?.length) return "";
          return tooltipCard(theme, items[0].axisValue, items.map((item) => ({
            name: item.seriesName,
            value: `${item.value} ${item.seriesName === "Latency" ? "ms" : "%"}`,
            color: item.color,
          })));
        },
      },
      xAxis: { type: "category", data: latencyAndLoss.map((point) => point.time), boundaryGap: false, ...axisBase, splitLine: { show: false }, axisLabel: { ...axisBase.axisLabel, interval: Math.max(0, Math.ceil(latencyAndLoss.length / 6) - 1) } },
      yAxis: [
        { type: "value", name: "ms", nameTextStyle: { color: theme.mutedForeground, fontSize: 11 }, ...axisBase },
        { type: "value", name: "%", nameTextStyle: { color: theme.mutedForeground, fontSize: 11 }, ...axisBase, splitLine: { show: false } },
      ],
      series: [
        { name: "Latency", type: "line", smooth: true, showSymbol: false, data: latency.map((value) => Number(value.toFixed(0))), yAxisIndex: 0, lineStyle: { width: 2, color: COLORS.inbound }, itemStyle: { color: COLORS.inbound }, areaStyle: { color: verticalGradient(COLORS.inbound, 0.28, 0.03) } },
        { name: "Packet Loss", type: "bar", yAxisIndex: 1, barMaxWidth: 8, data: loss, itemStyle: { color: COLORS.errors, opacity: 0.8 } },
      ],
    };
  }, [aggregation, theme]);

  const heatmapOption = useMemo<EChartsOption>(() => ({
    animationDuration: 600,
    grid: { top: 8, right: 12, bottom: 66, left: 48 },
    tooltip: {
      trigger: "item",
      backgroundColor: theme.popover,
      borderColor: theme.border,
      borderWidth: 1,
      padding: 0,
      textStyle: { color: theme.popoverForeground, fontSize: 12 },
      formatter: (params: unknown) => {
        const item = params as { value: [number, number, number] };
        const [column, row, value] = item.value;
        return tooltipCard(theme, `${heatmapInterfaces[row]} · ${heatmapHours[column]}:00`, [{ name: "Utilisation", value: `${value}%`, color: COLORS.inbound }]);
      },
    },
    xAxis: { type: "category", data: heatmapHours, splitArea: { show: false }, ...axisBase, splitLine: { show: false }, axisLabel: { ...axisBase.axisLabel, fontSize: 10 } },
    yAxis: { type: "category", data: heatmapInterfaces, splitArea: { show: false }, ...axisBase, splitLine: { show: false }, axisLabel: { ...axisBase.axisLabel, fontSize: 10 } },
    visualMap: {
      min: 0,
      max: 100,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 8,
      itemWidth: 12,
      itemHeight: 110,
      textStyle: { color: theme.mutedForeground, fontSize: 10 },
      inRange: { color: ["oklch(0.9552 0.02 257.47)", "oklch(0.7137 0.1434 254.62)", "oklch(0.4882 0.2172 264.38)"] },
    },
    series: [{
      name: "Utilisation",
      type: "heatmap",
      data: heatmapData,
      itemStyle: { borderColor: theme.card, borderWidth: 1 },
      emphasis: { itemStyle: { borderColor: theme.foreground, borderWidth: 1 } },
    }],
  }), [theme]);

  const timeControls = (
    <div className="flex items-center gap-1">
      <div className="flex items-center rounded-md border border-border p-0.5" aria-label="Chart time range">
        {(["1H", "6H", "12H", "24H"] as RangeKey[]).map((item) => (
          <button key={item} type="button" onClick={() => setRange(item)} aria-pressed={range === item} className={cn("rounded-lg px-1.5 py-1 text-[0.6875rem] font-semibold transition-colors", range === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>{item}</button>
        ))}
      </div>
      <details className="relative" open={menuOpen} onToggle={(event) => setMenuOpen((event.currentTarget as HTMLDetailsElement).open)}>
        <summary aria-label="Chart options" className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-md text-muted-foreground hover:bg-accent"><MoreVertical size={16} /></summary>
        <div className="absolute right-0 top-8 z-30 w-44 rounded-lg border border-border bg-popover p-1 shadow-lg">
          {(["Average", "Max", "Min"] as Aggregation[]).map((item) => (
            <button key={item} type="button" onClick={() => { setAggregation(item); setMenuOpen(false); }} className={cn("block w-full rounded-lg px-2.5 py-2 text-left text-[0.75rem] text-foreground hover:bg-accent", aggregation === item && "font-semibold text-primary")}>{item}</button>
          ))}
          <div className="my-1 border-t border-border" />
          <button type="button" onClick={() => { exportCsv(); setMenuOpen(false); }} className="block w-full rounded-lg px-2.5 py-2 text-left text-[0.75rem] text-foreground hover:bg-accent">Export CSV</button>
          <button type="button" onClick={() => { toast("Chart image export is a demo action."); setMenuOpen(false); }} className="block w-full rounded-lg px-2.5 py-2 text-left text-[0.75rem] text-foreground hover:bg-accent">Export PNG</button>
        </div>
      </details>
    </div>
  );

  const latest = samples[samples.length - 1];
  const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const inboundPct = (sample: NetworkSample) => (sample.trafficIn / LINK_CAPACITY_MBPS) * 100;
  const outboundPct = (sample: NetworkSample) => (sample.trafficOut / LINK_CAPACITY_MBPS) * 100;
  const peakTraffic = Math.max(...samples.map((sample) => sample.trafficIn + sample.trafficOut));

  return (
    <div className="space-y-2.5 pb-3">
      <PageHeader breadcrumbs={["Monitoring", "Network Monitoring"]} showRefresh={false} title="Network Monitoring" subtitle="Real-time overview of your network performance, traffic, and connectivity.">
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={exportCsv} className="whitespace-nowrap"><Download size={15} />Export CSV</Button>
          <Button onClick={() => toast("Add Widget is a mockup action.")} className="whitespace-nowrap"><Plus size={15} />Add Widget</Button>
        </div>
      </PageHeader>


      <section aria-label="Network summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-7">
        {stats.map((item) => <MetricCard key={item.label} item={item} className="h-[5.125rem]" labelClassName="text-[0.75rem]" valueClassName="text-[1.5rem]" trendClassName="text-[0.6875rem]" />)}
      </section>

      <section aria-label="Network traffic trends" className="grid items-stretch gap-2.5 xl:grid-cols-3">
        <Panel title="Bandwidth Usage Over Time" className="flex min-w-0 flex-col" showOptions={false} action={timeControls}>
          <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <SeriesChip name="Inbound Usage" color={COLORS.inbound} value={Number(inboundPct(latest).toFixed(1))} unit="%" enabled={visible("Inbound Usage")} onToggle={() => toggleSeries("Inbound Usage")} />
              <SeriesChip name="Outbound Usage" color={COLORS.outbound} value={Number(outboundPct(latest).toFixed(1))} unit="%" enabled={visible("Outbound Usage")} onToggle={() => toggleSeries("Outbound Usage")} />
            </div>
            <div className="relative min-h-[13.75rem] min-w-0 flex-1">
              <EChart option={bandwidthOption} className="absolute inset-0" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <SummaryChip label="Now" value={`${inboundPct(latest).toFixed(1)}%`} tone="blue" />
              <SummaryChip label="Avg" value={`${avg(samples.map(inboundPct)).toFixed(1)}%`} tone="green" />
              <SummaryChip label="Peak" value={`${Math.max(...samples.map(inboundPct)).toFixed(1)}%`} tone="amber" />
              <SummaryChip label="Out Avg" value={`${avg(samples.map(outboundPct)).toFixed(1)}%`} tone="violet" />
            </div>
          </div>
        </Panel>

        <Panel title="Network Traffic (In/Out)" className="flex min-w-0 flex-col" showOptions={false} action={timeControls}>
          <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <SeriesChip name="Traffic In" color={COLORS.inbound} value={latest?.trafficIn ?? 0} unit="Mbps" enabled={visible("Traffic In")} onToggle={() => toggleSeries("Traffic In")} />
              <SeriesChip name="Traffic Out" color={COLORS.outbound} value={latest?.trafficOut ?? 0} unit="Mbps" enabled={visible("Traffic Out")} onToggle={() => toggleSeries("Traffic Out")} />
            </div>
            <div className="relative min-h-[13.75rem] min-w-0 flex-1">
              <EChart option={trafficOption} className="absolute inset-0" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <SummaryChip label="Avg In" value={`${avg(samples.map((sample) => sample.trafficIn)).toFixed(0)} Mbps`} tone="blue" />
              <SummaryChip label="Avg Out" value={`${avg(samples.map((sample) => sample.trafficOut)).toFixed(0)} Mbps`} tone="green" />
              <SummaryChip label="Peak Total" value={`${peakTraffic.toFixed(0)} Mbps`} tone="amber" />
            </div>
          </div>
        </Panel>

        <Panel title="Packets In/Out" className="flex min-w-0 flex-col" showOptions={false} action={timeControls}>
          <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <SeriesChip name="Packets In" color={COLORS.inbound} value={latest?.packetsIn ?? 0} unit="pps" enabled onToggle={() => toast("Packets In is always visible.")} />
              <SeriesChip name="Packets Out" color={COLORS.outbound} value={latest?.packetsOut ?? 0} unit="pps" enabled onToggle={() => toast("Packets Out is always visible.")} />
            </div>
            <div className="relative min-h-[13.75rem] min-w-0 flex-1">
              <EChart option={packetsOption} className="absolute inset-0" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <SummaryChip label="Avg pps" value={avg(samples.map((sample) => sample.packetsIn + sample.packetsOut)).toFixed(0)} tone="blue" />
              <SummaryChip label="Errors" value={samples.reduce((sum, sample) => sum + sample.errors, 0).toLocaleString()} tone="rose" />
              <SummaryChip label="Drops" value={samples.reduce((sum, sample) => sum + sample.drops, 0).toLocaleString()} tone="amber" />
            </div>
          </div>
        </Panel>
      </section>

      <section aria-label="Network analysis" className="grid items-stretch gap-2.5 xl:grid-cols-2">
        <Panel title="Interface Utilization Heatmap" className="flex min-w-0 flex-col" action={<button onClick={() => toast("Showing all interfaces.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
          <div className="relative min-h-[13.75rem] min-w-0 flex-1 pt-1">
            <EChart option={heatmapOption} className="absolute inset-0" />
          </div>
        </Panel>

        <Panel title="Latency & Packet Loss" className="flex min-w-0 flex-col" action={<button onClick={() => toast("Showing all latency samples.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
          <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <SeriesChip name="Latency" color={COLORS.inbound} value={latencyAndLoss[latencyAndLoss.length - 1]?.latency ?? 0} unit="ms" enabled onToggle={() => toast("Latency is always visible.")} />
              <SeriesChip name="Packet Loss" color={COLORS.errors} value={latencyAndLoss[latencyAndLoss.length - 1]?.loss ?? 0} unit="%" enabled onToggle={() => toast("Packet loss is always visible.")} />
            </div>
            <div className="relative min-h-[13.75rem] min-w-0 flex-1">
              <EChart option={latencyOption} className="absolute inset-0" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <SummaryChip label="Avg Latency" value={`${avg(latencyAndLoss.map((point) => point.latency)).toFixed(0)} ms`} tone="blue" />
              <SummaryChip label="Peak Loss" value={`${Math.max(...latencyAndLoss.map((point) => point.loss)).toFixed(2)} %`} tone="rose" />
            </div>
          </div>
        </Panel>
      </section>

      <section aria-label="Interface details" className="grid gap-2.5 xl:grid-cols-[1.14fr_1.04fr_0.82fr]">
        <Panel title="Top Interfaces by Bandwidth Usage" className="min-w-0" action={<button onClick={() => toast("Showing all interfaces by bandwidth.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[27.5rem] table-fixed text-left text-[0.75rem]">
              <colgroup><col style={{ width: "17%" }} /><col style={{ width: "27%" }} /><col style={{ width: "21%" }} /><col style={{ width: "23%" }} /><col style={{ width: "12%" }} /></colgroup>
              <thead><tr className="border-b border-border text-muted-foreground">{["Interface", "Device", "Bandwidth Usage", "In / Out (Mbps)", "Trend"].map((heading) => <th key={heading} className="whitespace-nowrap px-1 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{interfaces.slice(0, 5).map((item, index) => <tr key={`${item.device}-${item.name}`} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1 py-[0.3125rem] font-semibold text-foreground">{item.name}</td><td className="whitespace-nowrap px-1 py-[0.3125rem] text-foreground">{item.device}</td><td className="whitespace-nowrap px-1 py-[0.3125rem] tabular-nums text-foreground">{item.bandwidth.toFixed(1)}%</td><td className="whitespace-nowrap px-1 py-[0.3125rem] tabular-nums text-foreground">{item.inbound.toFixed(1)} / {item.outbound.toFixed(1)}</td><td className="px-1 py-[0.3125rem]"><svg viewBox="0 0 42 14" className="h-3 w-8" aria-label={`Trend for ${item.name}`}><polyline points={`0,11 8,${7 + index % 4} 16,9 24,${4 + index % 5} 32,7 41,3`} fill="none" stroke="oklch(0.6969 0.146 157.59)" strokeWidth="1.2" /></svg></td></tr>)}</tbody>
            </table>
          </div>
          <div className="flex justify-between pt-1 text-[0.6875rem] text-muted-foreground"><span>Showing 1-5 of 128 interfaces</span><span>Rows per page: 5 · 1 · 2 · 3 · 4 · 5 · … · 26</span></div>
        </Panel>

        <Panel title="Top Interfaces by Errors" className="min-w-0" action={<button onClick={() => toast("Showing all interfaces by errors.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[26.25rem] table-fixed text-left text-[0.75rem]">
              <colgroup><col style={{ width: "19%" }} /><col style={{ width: "29%" }} /><col style={{ width: "20%" }} /><col style={{ width: "18%" }} /><col style={{ width: "14%" }} /></colgroup>
              <thead><tr className="border-b border-border text-muted-foreground">{["Interface", "Device", "Errors", "Discards", "Status"].map((heading) => <th key={heading} className="whitespace-nowrap px-1 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{errorInterfaces.slice(0, 5).map((item) => <tr key={`${item.device}-${item.name}`} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1 py-[0.3125rem] text-foreground">{item.name}</td><td className="whitespace-nowrap px-1 py-[0.3125rem] text-foreground">{item.device}</td><td className="whitespace-nowrap px-1 py-[0.3125rem] tabular-nums text-foreground">{(item.errorsIn + item.errorsOut).toLocaleString()}</td><td className="whitespace-nowrap px-1 py-[0.3125rem] tabular-nums text-foreground">{item.discards.toLocaleString()}</td><td className="px-1 py-[0.3125rem]"><StatusBadge status="up" /></td></tr>)}</tbody>
            </table>
          </div>
          <div className="pt-1 text-[0.6875rem] text-muted-foreground">Showing 1-5 of 128 interfaces</div>
        </Panel>

        <Panel title="Interface Summary" className="min-w-0">
          <div className="flex h-[9.375rem] items-center gap-2">
            <div className="relative h-[8.125rem] w-[45%] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={interfaceStates} dataKey="value" innerRadius="62%" outerRadius="88%" paddingAngle={1} stroke="none">{interfaceStates.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className="font-display text-[1.375rem] font-extrabold text-foreground">128</b><span className="text-[0.75rem] text-muted-foreground">Total</span></div>
            </div>
            <div className="min-w-0 flex-1 space-y-2">{interfaceStates.map((item) => <div key={item.name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-[0.75rem]"><StatusBadge status={item.status as InterfaceStatus} /><b className="whitespace-nowrap text-right text-foreground">{item.value} ({item.percent})</b></div>)}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-[0.75rem]"><div><span className="text-muted-foreground">Avg Inbound Utilization</span><b className="mt-1 block text-[1rem] text-foreground">42.6% <span className="text-[0.6875rem] text-success">↑ 6.3%</span></b></div><div><span className="text-muted-foreground">Avg Outbound Utilization</span><b className="mt-1 block text-[1rem] text-foreground">38.2% <span className="text-[0.6875rem] text-success">↑ 5.2%</span></b></div></div>
        </Panel>
      </section>

      <section aria-label="Traffic analysis" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <Panel title="Traffic Distribution" className="min-w-0"><TrafficDonut data={trafficDistribution} total={`${TOTAL_TRAFFIC_TB.toFixed(2)} TB`} /></Panel>
        <TalkerList title="Top Talkers (By Traffic)" items={talkersByTraffic} />
        <TalkerList title="Top Talkers (By Connections)" items={talkersByConnections} />
        <Panel title="Top Protocols" className="min-w-0"><TrafficDonut data={protocols} total={`${TOTAL_TRAFFIC_TB.toFixed(2)} TB`} /></Panel>
      </section>

      <Panel title="Recent Network Alerts" className="min-w-0" action={<button onClick={() => toast("Showing all network alerts.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
        <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[60rem] text-left text-[0.75rem]">
            <thead><tr className="border-b border-border text-muted-foreground">{["Alert", "Device", "Interface", "Severity", "Message", "Time"].map((heading) => <th key={heading} className="whitespace-nowrap px-1.5 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
            <tbody>{networkAlerts.map((item) => <tr key={item.alert} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1.5 py-[0.375rem] font-semibold text-foreground"><i className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${item.severity === "Critical" ? "bg-rose-500" : item.severity === "Warning" ? "bg-amber-500" : "bg-blue-500"}`} />{item.alert}</td><td className="whitespace-nowrap px-1.5 py-[0.375rem] text-foreground">{item.device}</td><td className="whitespace-nowrap px-1.5 py-[0.375rem] text-foreground">{item.iface}</td><td className="px-1.5 py-[0.375rem]"><span className={`rounded-full px-2 py-0.5 text-[0.6875rem] ${item.severity === "Critical" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : item.severity === "Warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"}`}>{item.severity}</span></td><td className="px-1.5 py-[0.375rem] text-foreground">{item.message}</td><td className="whitespace-nowrap px-1.5 py-[0.375rem] text-muted-foreground">{item.time}</td></tr>)}</tbody>
          </table>
        </div>
      </Panel>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[0.75rem] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}