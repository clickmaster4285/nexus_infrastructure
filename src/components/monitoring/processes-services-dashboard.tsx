"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { ArrowRight, Download, MoreVertical, Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { TechLogo } from "@/components/shared/icon";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import type { MetricStat } from "@/data/mock/dashboard";

const PROCESS_COUNTS = { total: 2548, running: 2214, stopped: 334 };
const SERVICE_COUNTS = { total: 398, running: 368, failed: 30, restarted24h: 20 };
const servicePercent = (value: number) => `${(value / SERVICE_COUNTS.total * 100).toFixed(1)}%`;
const stats: MetricStat[] = [
  { label: "Total Processes", value: PROCESS_COUNTS.total.toLocaleString(), change: "5.4%", trend: "up", tone: "blue", icon: "activity", detail: "vs last 24 hours" },
  { label: "Running Processes", value: PROCESS_COUNTS.running.toLocaleString(), change: "4.7%", trend: "up", tone: "green", icon: "online", detail: "vs last 24 hours" },
  { label: "Stopped Processes", value: PROCESS_COUNTS.stopped.toLocaleString(), change: "3.2%", trend: "down", tone: "red", icon: "offline", detail: "vs last 24 hours" },
  { label: "Total Services", value: SERVICE_COUNTS.total.toLocaleString(), change: "3.6%", trend: "up", tone: "purple", icon: "settings-2", detail: "vs last 24 hours" },
  { label: "Running Services", value: SERVICE_COUNTS.running.toLocaleString(), change: "2.9%", trend: "up", tone: "green", icon: "online", detail: "vs last 24 hours" },
  { label: "Failed Services", value: SERVICE_COUNTS.failed.toLocaleString(), change: "6.3%", trend: "down", tone: "red", icon: "offline", detail: "vs last 24 hours" },
];

const times = ["12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00"];
const cpuInput = times.map((time, index) => ({ time, user: [28, 30, 27, 32, 29, 31, 28, 30, 29, 33, 30, 32, 31][index], system: [18, 19, 17, 20, 18, 19, 18, 20, 19, 21, 18, 20, 19][index], ioWait: [8, 16, 10, 18, 12, 14, 9, 17, 11, 19, 13, 16, 12][index], others: [6, 7, 6, 8, 7, 8, 6, 7, 7, 9, 6, 8, 7][index] }));
const cpuHistory = cpuInput.map((point) => {
  const active = point.user + point.system + point.ioWait + point.others;
  const scale = active > 100 ? 100 / active : 1;
  const user = Math.round(point.user * scale * 10) / 10;
  const system = Math.round(point.system * scale * 10) / 10;
  const ioWait = Math.round(point.ioWait * scale * 10) / 10;
  const others = Math.round(point.others * scale * 10) / 10;
  const idle = Math.max(0, Math.round((100 - user - system - ioWait - others) * 10) / 10);
  return { time: point.time, user, system, ioWait, others, idle, cpuUsage: Math.round((100 - idle) * 10) / 10 };
});
const memoryInput = times.map((time, index) => ({ time, used: [72, 74, 76, 73, 78, 75, 77, 74, 76, 79, 75, 77, 74][index], cached: [43, 44, 45, 42, 46, 44, 45, 43, 44, 47, 43, 45, 44][index], buffers: [22, 23, 24, 22, 25, 23, 24, 22, 23, 26, 22, 24, 23][index], free: [17, 16, 15, 18, 14, 16, 15, 17, 16, 13, 17, 15, 16][index] }));
const memoryHistory = memoryInput.map(({ time, used, cached, buffers, free }) => {
  const remaining = 100 - used - free;
  const cachedShare = cached / (cached + buffers);
  const adjustedCached = Math.round(remaining * cachedShare * 10) / 10;
  return { time, used, cached: adjustedCached, buffers: Math.round((remaining - adjustedCached) * 10) / 10, free };
});
const runningRatios = [0.85, 0.86, 0.85, 0.87, 0.86, 0.87, 0.86, 0.88, 0.87, 0.88, 0.87, 0.88, PROCESS_COUNTS.running / PROCESS_COUNTS.total];
const processTotals = [2420, 2480, 2440, 2570, 2490, 2520, 2460, 2550, 2500, 2580, 2510, 2560, PROCESS_COUNTS.total];
const processCountHistory = times.map((time, index) => {
  const total = processTotals[index];
  const running = index === times.length - 1 ? PROCESS_COUNTS.running : Math.round(total * runningRatios[index]);
  return { time, total, running, stopped: total - running };
});

const cpuProcesses = [
  { name: "node", server: "app-server-02", cpu: "32.6%", memory: "8.4%", user: "node", pid: "24567" },
  { name: "java", server: "app-server-01", cpu: "21.8%", memory: "12.6%", user: "java", pid: "18765" },
  { name: "nginx", server: "web-01", cpu: "12.4%", memory: "4.1%", user: "www-data", pid: "1234" },
  { name: "postgres", server: "db-01", cpu: "9.7%", memory: "15.3%", user: "postgres", pid: "2233" },
  { name: "python", server: "worker-01", cpu: "6.3%", memory: "3.8%", user: "ubuntu", pid: "3345" },
  { name: "docker", server: "worker-02", cpu: "5.8%", memory: "6.2%", user: "root", pid: "4182" },
  { name: "mongod", server: "db-02", cpu: "4.9%", memory: "11.4%", user: "mongodb", pid: "5201" },
];

const memoryProcesses = [
  { name: "java", server: "app-server-01", memory: "12.6%", cpu: "21.8%", user: "java", pid: "18765" },
  { name: "postgres", server: "db-01", memory: "15.3%", cpu: "9.7%", user: "postgres", pid: "2233" },
  { name: "node", server: "app-server-02", memory: "8.4%", cpu: "32.6%", user: "node", pid: "24567" },
  { name: "mysqld", server: "db-02", memory: "7.6%", cpu: "7.2%", user: "mysql", pid: "3811" },
  { name: "redis-server", server: "cache-01", memory: "5.9%", cpu: "4.1%", user: "redis", pid: "2904" },
 { name: "rabbitmq", server: "queue-01", memory: "5.3%", cpu: "3.9%", user: "rabbitmq", pid: "7241" },
 { name: "elasticsearch", server: "search-01", memory: "4.8%", cpu: "6.7%", user: "elastic", pid: "8113" },
];

const serviceStates = [
  { name: "Running", value: SERVICE_COUNTS.running, percent: servicePercent(SERVICE_COUNTS.running), color: "oklch(0.6969 0.146 157.59)" },
  { name: "Failed", value: SERVICE_COUNTS.failed, percent: servicePercent(SERVICE_COUNTS.failed), color: "oklch(0.6197 0.2192 21.68)" },
  { name: "Stopped", value: 0, percent: servicePercent(0), color: "oklch(0.7593 0.163 68.27)" },
  { name: "Unknown", value: SERVICE_COUNTS.total - SERVICE_COUNTS.running - SERVICE_COUNTS.failed, percent: servicePercent(SERVICE_COUNTS.total - SERVICE_COUNTS.running - SERVICE_COUNTS.failed), color: "oklch(0.73 0.0349 256.79)" },
];
const serviceTotals = serviceStates.reduce((sum, item) => sum + item.value, 0);
const serviceHealthStats = [
  { label: "Failed", value: serviceStates.find((item) => item.name === "Failed")?.value ?? 0 },
  { label: "Restarted (24h)", value: SERVICE_COUNTS.restarted24h },
];

const startupCounts = [
  { name: "Automatic", value: 276, color: "oklch(0.6969 0.146 157.59)" },
  { name: "Manual", value: 102, color: "oklch(0.7593 0.163 68.27)" },
  { name: "Disabled", value: 20, color: "oklch(0.5906 0.1926 258.69)" },
];
const startupTotal = startupCounts.reduce((sum, item) => sum + item.value, 0);
const startupStates = startupCounts.map((item) => ({
  ...item,
  percent: `${(item.value / startupTotal * 100).toFixed(1)}%`,
}));

const topCpuServices = [
  { name: "nginx", value: "18.7%" }, { name: "Elasticsearch", value: "12.4%" },
  { name: "Prometheus", value: "8.6%" }, { name: "Docker Engine", value: "6.3%" },
  { name: "Redis Server", value: "4.1%" }, { name: "RabbitMQ", value: "3.6%" },
  { name: "Node.js", value: "2.9%" },
];
const topMemoryServices = [
  { name: "PostgreSQL", value: "15.3%" }, { name: "Elasticsearch", value: "11.8%" },
  { name: "MySQL", value: "9.6%" }, { name: "MongoDB", value: "7.8%" },
  { name: "Redis Server", value: "5.9%" }, { name: "Prometheus", value: "4.7%" },
  { name: "Node.js", value: "3.8%" },
];
const servicesByHost = [
  { name: "app-server-01", value: 78, width: "100%", color: "oklch(0.7148 0.1257 215.22)" }, { name: "app-server-02", value: 74, width: "95%", color: "oklch(0.5571 0.2214 299.62)" },
  { name: "web-01", value: 56, width: "72%", color: "oklch(0.7593 0.163 68.27)" }, { name: "db-01", value: 48, width: "62%", color: "oklch(0.6969 0.146 157.59)" },
  { name: "worker-01", value: 42, width: "54%", color: "oklch(0.5906 0.1926 258.69)" },
  { name: "api-gateway", value: 38, width: "49%", color: "oklch(0.7148 0.1257 215.22)" },
  { name: "db-02", value: 36, width: "46%", color: "oklch(0.5571 0.2214 299.62)" },
];

const alerts = [
  { alert: "Service failed", type: "Service", server: "app-server-02", process: "nginx", severity: "Critical", message: "NGINX service has stopped unexpectedly", time: "2m ago" },
  { alert: "High CPU usage", type: "Process", server: "app-server-01", process: "java (PID: 18765)", severity: "Warning", message: "CPU usage is 85% which is above the threshold (80%)", time: "7m ago" },
  { alert: "High memory usage", type: "Process", server: "db-01", process: "postgres (PID: 2233)", severity: "Warning", message: "Memory usage is 90% which is above the threshold (85%)", time: "12m ago" },
  { alert: "Service restarted", type: "Service", server: "web-01", process: "apache2", severity: "Info", message: "Apache2 service restarted successfully", time: "18m ago" },
  { alert: "Process not responding", type: "Process", server: "worker-01", process: "python (PID: 3345)", severity: "Warning", message: "Process is not responding for more than 60 seconds", time: "24m ago" },
];

const severityStyles: Record<string, string> = {
  Critical: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  Warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Info: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

type ProcessPoint = { time: string; [key: string]: string | number };
type ProcessSeries = { key: string; name: string; color: string; unit: string };
const processPalette = { blue: "oklch(0.7137 0.1434 254.62)", green: "oklch(0.7729 0.1535 163.22)", purple: "oklch(0.709 0.1592 293.54)", amber: "oklch(0.8369 0.1644 84.43)", red: "oklch(0.7106 0.1661 22.22)" };
const connectedProcessCharts = "nexus-process-service-trends";
const cpuSeries: ProcessSeries[] = [
  { key: "user", name: "User", color: processPalette.blue, unit: "%" },
  { key: "system", name: "System", color: processPalette.green, unit: "%" },
  { key: "ioWait", name: "IO Wait", color: processPalette.amber, unit: "%" },
  { key: "others", name: "Others", color: processPalette.purple, unit: "%" },
  { key: "idle", name: "Idle", color: processPalette.red, unit: "%" },
];
const memorySeries: ProcessSeries[] = [
  { key: "used", name: "Used", color: processPalette.blue, unit: "%" },
  { key: "cached", name: "Cached", color: processPalette.green, unit: "%" },
  { key: "buffers", name: "Buffers", color: processPalette.purple, unit: "%" },
  { key: "free", name: "Free", color: processPalette.amber, unit: "%" },
];
const processCountSeries: ProcessSeries[] = [
  { key: "running", name: "Running", color: processPalette.green, unit: "processes" },
  { key: "stopped", name: "Stopped", color: processPalette.red, unit: "processes" },
];

function chartThemeColors() {
  const style = typeof document === "undefined" ? null : getComputedStyle(document.documentElement);
  return {
    axis: style?.getPropertyValue("--muted-foreground").trim() || "oklch(0.5544 0.0407 257.42)",
    grid: style?.getPropertyValue("--border").trim() || "oklch(0.9288 0.0126 255.51)",
    popover: style?.getPropertyValue("--popover").trim() || "oklch(1 0 89.88)",
  };
}

function EChartCanvas({
  options, group, onReady, className = "",
}: {
  options: echarts.EChartsOption;
  group?: string;
  onReady?: (chart: echarts.EChartsType) => void;
  className?: string;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    let chart: echarts.EChartsType | null = null;
    const resizeOrInit = () => {
      if (element.clientWidth <= 0 || element.clientHeight <= 0) return;
      if (!chart) {
        chart = echarts.init(element, undefined, { renderer: "canvas" });
        chartRef.current = chart;
        if (group) {
          chart.group = group;
          echarts.connect(group);
        }
        chart.setOption(options);
        readyRef.current?.(chart);
      } else {
        chart.resize();
      }
    };
    const observer = new ResizeObserver(resizeOrInit);
    observer.observe(element);
    resizeOrInit();
    return () => {
      observer.disconnect();
      chart?.dispose();
      chartRef.current = null;
    };
    // The chart instance is created once; option updates are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  useEffect(() => {
    chartRef.current?.setOption(options, { notMerge: true, lazyUpdate: true });
  }, [options]);

  return <div ref={elementRef} className={`h-full min-h-[13.75rem] min-w-0 w-full flex-1 ${className}`} style={{ flex: "1 1 0%" }} aria-label="Interactive process monitoring chart" />;
}

function buildAreaOption({
  data, series, enabledKeys, kind, summaryKey,
}: {
  data: ProcessPoint[];
  series: ProcessSeries[];
  enabledKeys: string[];
  kind: "cpu" | "memory" | "count";
  summaryKey: string;
}): echarts.EChartsOption {
  const colors = chartThemeColors();
  const axisColor = colors.axis;
  const gridColor = colors.grid;
  const selectedSeries = series.filter((item) => enabledKeys.includes(item.key));
  const ticks = new Set([0, Math.round((data.length - 1) / 5), Math.round((data.length - 1) * 2 / 5), Math.round((data.length - 1) * 3 / 5), Math.round((data.length - 1) * 4 / 5), data.length - 1]);
  const summaryValues = data.map((point) => Number(point[summaryKey] ?? 0));
  const maxValue = kind === "count" ? 3000 : 100;
  const stack = kind === "count" ? "process-total" : "percent-total";
  const tooltipValue = (value: number, unit: string) => kind === "count" ? `${Math.round(value).toLocaleString()} ${unit}` : `${value.toFixed(1)} ${unit}`;
  const markArea = kind === "cpu" ? (() => {
    const regions: Array<[{ xAxis: string }, { xAxis: string }]> = [];
    let start = -1;
    data.forEach((point, index) => {
      const over = Number(point.ioWait) > 15;
      if (over && start < 0) start = index;
      if ((!over || index === data.length - 1) && start >= 0) {
        const end = over ? index : index - 1;
        regions.push([{ xAxis: data[start].time }, { xAxis: data[end].time }]);
        start = -1;
      }
    });
    return regions;
  })() : [];

  return {
    animation: true,
    animationDuration: 650,
    animationEasing: "cubicOut",
    backgroundColor: "transparent",
    grid: { left: 48, right: 18, top: 14, bottom: 32, containLabel: false },
    xAxis: {
      type: "category", boundaryGap: false, data: data.map((point) => point.time),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: axisColor, fontSize: 10, hideOverlap: true, formatter: (value: string, index: number) => ticks.has(index) ? value : "" },
      axisPointer: { show: true, type: "line", lineStyle: { color: "oklch(0.7107 0.0351 256.79)", width: 1, type: "dashed" } },
    },
    yAxis: {
      type: "value", min: 0, max: maxValue,
      ...(kind === "count" ? { interval: 1000 } : { interval: 25 }),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: axisColor, fontSize: 10, formatter: (value: number) => kind === "count" ? (value === 0 ? "0" : `${value / 1000}K`) : `${value}%` },
      splitLine: { show: true, lineStyle: { color: gridColor, type: "dashed", opacity: 0.72 } },
    },
    tooltip: {
      trigger: "axis", confine: true, appendToBody: true,
      backgroundColor: colors.popover,
      borderColor: gridColor, borderWidth: 1, borderRadius: 8, padding: [10, 12],
      extraCssText: "box-shadow:0 0.5rem 1.5rem oklch(0.2077 0.0398 265.75 / 0.14);min-width:9.25rem;",
      axisPointer: { type: "line", lineStyle: { color: "oklch(0.7107 0.0351 256.79)", type: "dashed", width: 1 } },
      position: (point, _params, _dom, _rect, size) => {
        const x = Number(point[0]); const y = Number(point[1]);
        const width = Number(size.viewSize[0]); const tipWidth = Number(size.contentSize[0]);
        return [x + tipWidth + 18 < width ? x + 14 : Math.max(4, x - tipWidth - 14), Math.max(8, y - 18)];
      },
      formatter: (raw: unknown) => {
        const rows = (Array.isArray(raw) ? raw : [raw]) as Array<{ axisValue?: string; seriesName?: string; value?: number; color?: string }>;
        const heading = rows[0]?.axisValue ?? "";
        const lines = rows.filter((row) => row.seriesName && row.value != null).map((row) => {
          const spec = series.find((item) => item.name === row.seriesName);
          return `<div style="display:flex;align-items:center;justify-content:space-between;gap:0.875rem;margin-top:0.375rem"><span style="white-space:nowrap"><i style="display:inline-block;width:0.4375rem;height:0.4375rem;border-radius:50%;background:${row.color ?? spec?.color};margin-right:0.4375rem"></i>${row.seriesName}</span><b style="white-space:nowrap">${tooltipValue(Number(row.value), spec?.unit ?? "")}</b></div>`;
        }).join("");
        return `<div style="font-size:0.75rem;color:${axisColor};font-weight:600">${heading}</div>${lines}`;
      },
    },
    series: selectedSeries.map((item) => ({
      name: item.name, type: "line", data: data.map((point) => Number(point[item.key] ?? 0)),
      stack, smooth: 0.32, showSymbol: false, symbol: "circle", symbolSize: 6,
      lineStyle: { color: item.color, width: 2 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `${item.color}55` }, { offset: 1, color: `${item.color}08` }]) },
      emphasis: { focus: "series", scale: 1.08, itemStyle: { borderWidth: 2, borderColor: "oklch(1 0 89.88)" } },
      ...(kind === "cpu" && item.key === "ioWait" && markArea.length ? { markArea: { silent: true, itemStyle: { color: "oklch(0.8369 0.1644 84.43 / 0.1)" }, data: markArea } } : {}),
      ...(kind === "memory" && item.key === "used" ? { markLine: { silent: true, symbol: "none", lineStyle: { color: processPalette.red, type: "dashed", width: 1 }, label: { show: true, formatter: "85%", position: "insideEndTop", color: processPalette.red, fontSize: 10 }, data: [{ yAxis: 85 }] } } : {}),
      ...(kind === "count" && item.key === "stopped" ? { markPoint: { symbol: "pin", symbolSize: 38, itemStyle: { color: processPalette.red }, label: { show: true, formatter: "!", color: "oklch(1 0 89.88)", fontWeight: 700 }, data: [{ type: "max", name: "Stopped spike" }] } } : {}),
    })),
  };
}

function ProcessTrendCard({
  id, title, data, series, summaryKey, summaryName, kind, period, onPeriodChange, chartRefs,
}: {
  id: string; title: string; data: ProcessPoint[]; series: ProcessSeries[]; summaryKey: string; summaryName: string;
  kind: "cpu" | "memory" | "count"; period: string; onPeriodChange: (value: string) => void;
  chartRefs: React.MutableRefObject<Record<string, echarts.EChartsType | null>>;
}) {
  const [enabledKeys, setEnabledKeys] = useState(series.map((item) => item.key));
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleData = useMemo(() => {
    const rangeSize: Record<string, number> = { "1H": 2, "6H": 4, "12H": 7, "24H": data.length };
    return data.slice(-Math.min(data.length, rangeSize[period] ?? data.length));
  }, [data, period]);
  const options = useMemo(() => buildAreaOption({ data: visibleData, series, enabledKeys, kind, summaryKey }), [visibleData, series, enabledKeys, kind, summaryKey]);
  const values = visibleData.map((point) => Number(point[summaryKey] ?? 0));
  const average = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const peak = Math.max(...values);
  const menuAction = (action: "png" | "csv" | "fullscreen") => {
    const chart = chartRefs.current[id];
    if (action === "png" && chart) {
      const link = document.createElement("a"); link.href = chart.getDataURL({ pixelRatio: 2, backgroundColor: "oklch(1 0 89.88)" }); link.download = `${id}.png`; link.click();
    }
    if (action === "csv") {
      const rows = [["Time", ...series.filter((item) => enabledKeys.includes(item.key)).map((item) => item.name)], ...data.map((point) => [point.time, ...series.filter((item) => enabledKeys.includes(item.key)).map((item) => String(point[item.key] ?? ""))])];
      const blob = new Blob([rows.map((row) => row.join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${id}.csv`; link.click(); URL.revokeObjectURL(link.href);
    }
    if (action === "fullscreen" && chart) {
      const fullscreen = chart.getDom().requestFullscreen?.();
      fullscreen?.then(() => chart.resize()).catch(() => undefined);
    }
    setMenuOpen(false);
  };
  const action = <div className="flex shrink-0 items-center gap-1">
    <div role="group" aria-label={`${title} time range`} className="flex items-center rounded-md border border-border p-0.5">
      {["1H", "6H", "12H", "24H"].map((range) => <button key={range} onClick={() => onPeriodChange(range)} className={`rounded-lg px-1.5 py-1 text-[0.625rem] font-semibold ${period === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{range}</button>)}
    </div>
    <div className="relative">
      <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={`${title} actions`} aria-expanded={menuOpen} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MoreVertical size={16} /></button>
      {menuOpen && <div className="absolute right-0 top-8 z-30 w-36 rounded-md border border-border bg-popover p-1 text-[0.75rem] text-foreground shadow-lg">{[["png", "Export PNG"], ["csv", "Export CSV"], ["fullscreen", "Fullscreen"]].map(([key, label]) => <button key={key} type="button" onClick={() => menuAction(key as "png" | "csv" | "fullscreen")} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-accent">{label}</button>)}</div>}
    </div>
  </div>;
  return <Panel title={title} className="flex min-h-[23.125rem] min-w-0 flex-col p-3" action={action} showOptions={false}>
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${title} series`}>
        {series.map((item) => {
          const active = enabledKeys.includes(item.key); const latest = Number(visibleData[visibleData.length - 1]?.[item.key] ?? 0);
          return <button key={item.key} type="button" aria-pressed={active} onClick={() => setEnabledKeys((keys) => active ? keys.filter((key) => key !== item.key) : [...keys, item.key])} className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2 text-[0.6875rem] ${active ? "border-border bg-card text-foreground" : "border-transparent bg-muted text-muted-foreground line-through"}`}><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: active ? item.color : "oklch(0.7107 0.0351 256.79)" }} />{item.name}<b className="font-semibold tabular-nums no-underline">{kind === "count" ? Math.round(latest).toLocaleString() : `${latest.toFixed(1)} ${item.unit}`}</b></button>;
        })}
      </div>
      <EChartCanvas options={options} group={connectedProcessCharts} onReady={(chart) => { chartRefs.current[id] = chart; }} />
      <div className="flex flex-wrap items-center gap-x-3 border-t border-border/70 pt-1.5 text-[0.6875rem] text-muted-foreground"><span>{summaryName} Avg <b className="text-foreground">{kind === "count" ? Math.round(average).toLocaleString() : `${average.toFixed(1)}%`}</b></span><span>Peak <b className="text-foreground">{kind === "count" ? Math.round(peak).toLocaleString() : `${peak.toFixed(1)}%`}</b></span>{kind === "count" && <span>Total <b className="text-foreground">{PROCESS_COUNTS.total.toLocaleString()}</b> = {PROCESS_COUNTS.running.toLocaleString()} running + {PROCESS_COUNTS.stopped.toLocaleString()} stopped</span>}</div>
    </div>
  </Panel>;
}

function Donut({ data, total, label = "Total", featured = false }: { data: { name: string; value: number; percent: string; color: string }[]; total: number; label?: string; featured?: boolean }) {
  const chartSize = featured ? 150 : 116;
  return <div className={`flex ${featured ? "flex-col items-center gap-2" : "h-[8.125rem] items-center gap-2.5"}`}>
    <div className="relative shrink-0" style={{ width: chartSize, height: chartSize }}>
      <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.filter((item) => item.value > 0)} dataKey="value" innerRadius={featured ? "72%" : "60%"} outerRadius="94%" paddingAngle={featured ? 2 : 1} stroke="none">{data.filter((item) => item.value > 0).map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className={`font-display font-extrabold leading-tight text-foreground ${featured ? "text-[1.5rem]" : "text-[1.25rem]"}`}>{total.toLocaleString()}</b><span className="whitespace-nowrap text-[0.75rem] text-muted-foreground">{featured ? "Total" : label}</span></div>
    </div>
    <div className={`min-w-0 ${featured ? "grid w-full grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-1.5 text-[0.6875rem]" : "flex-1 space-y-2.5"}`}>
      {data.map((item) => <div key={item.name} className={featured ? "contents" : "grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-1.5 text-[0.75rem]"}>
        <span className={featured ? "inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-foreground" : "contents"}><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="truncate">{item.name}</span></span>
        <b className="whitespace-nowrap text-right text-foreground">{item.value}</b><span className="whitespace-nowrap text-right text-muted-foreground">{item.percent}</span>
      </div>)}
    </div>
  </div>;
}

function ServiceBreakdown({ data, total }: { data: { name: string; value: number; percent: string; color: string }[]; total: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setStacked(entry.contentRect.width < 420));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const visibleData = data.filter((item) => item.value > 0);
  return <div ref={containerRef} className={`flex min-h-0 flex-1 items-center gap-4 pt-3 ${stacked ? "flex-col" : ""}`}>
    <div className="relative h-[7.875rem] w-[7.875rem] shrink-0" aria-label={`${total.toLocaleString()} total`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={visibleData} dataKey="value" innerRadius="72%" outerRadius="98%" paddingAngle={1.5} stroke="none">
            {visibleData.map((item) => <Cell key={item.name} fill={item.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <b className="font-display text-[1.375rem] font-extrabold leading-tight tabular-nums text-foreground">{total.toLocaleString()}</b>
        <span className="text-[0.75rem] text-muted-foreground">Total</span>
      </div>
    </div>
    <div className={`min-w-0 flex-1 pr-4 ${stacked ? "w-full" : ""}`}>
      {data.map((item) => <div key={item.name} className="grid h-7 grid-cols-[minmax(0,1fr)_auto_2.75rem] items-center gap-x-3 whitespace-nowrap text-[0.75rem]">
        <span className={`flex min-w-0 items-center gap-2 ${item.value === 0 ? "text-muted-foreground" : "text-foreground"}`}><i aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color, opacity: item.value === 0 ? 0.45 : 1 }} /><span className="truncate">{item.name}</span></span>
        <b className={`min-w-8 text-right font-semibold tabular-nums ${item.value === 0 ? "text-muted-foreground" : "text-foreground"}`}>{item.value.toLocaleString()}</b>
        <span className="min-w-[2.75rem] text-right tabular-nums text-muted-foreground">{item.percent}</span>
      </div>)}
    </div>
  </div>;
}

function SegmentedTabs<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return <div role="tablist" aria-label={label} className="inline-flex shrink-0 items-center rounded-md bg-muted p-0.5">
    {options.map((option, index) => <button key={option} type="button" role="tab" aria-selected={value === option} tabIndex={value === option ? 0 : -1} onClick={() => onChange(option)} onKeyDown={(event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const nextIndex = (index + (event.key === "ArrowRight" ? 1 : options.length - 1)) % options.length;
      const nextOption = options[nextIndex];
      if (nextOption) onChange(nextOption);
      const tablist = event.currentTarget.parentElement;
      requestAnimationFrame(() => tablist?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus());
    }} className={`whitespace-nowrap rounded-lg px-2 py-1 text-[0.75rem] font-semibold transition-colors ${value === option ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{option}</button>)}
  </div>;
}

function FadeTabContent({ tab, children }: { tab: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(false);
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [tab]);
  return <div style={{ opacity: visible ? 1 : 0, transition: "opacity 150ms ease" }} className="flex min-h-0 flex-1 flex-col">{children}</div>;
}

function UsageRows({ items, showLogos = true, footer }: { items: { name: string; value: string; color?: string }[]; showLogos?: boolean; footer?: React.ReactNode }) {
  const max = Math.max(...items.map((item) => Number.parseFloat(item.value)), 1);
  const tones = ["oklch(0.5906 0.1926 258.69)", "oklch(0.6969 0.146 157.59)", "oklch(0.5571 0.2214 299.62)", "oklch(0.7593 0.163 68.27)", "oklch(0.7148 0.1257 215.22)"];
  return <div className="flex min-h-0 flex-1 flex-col pt-2">
    <div className="flex flex-1 flex-col justify-between">
      {items.slice(0, 7).map((item, index) => {
        const amount = Number.parseFloat(item.value);
        return <div key={item.name} className="grid h-9 grid-cols-[minmax(0,1fr)_minmax(2.25rem,8.75rem)_3.5rem] items-center gap-2 text-[0.75rem]">
          <span className="flex min-w-0 items-center gap-2 truncate text-foreground" title={item.name}>{showLogos && <TechLogo name={item.name} className="h-7 w-7 rounded-md [&_svg]:h-[1.125rem] [&_svg]:w-[1.125rem]" />}<span className="truncate">{item.name}</span></span>
          <div className="h-[0.375rem] min-w-0 rounded-full bg-[oklch(0.9595_0.008_253.85)] dark:bg-slate-700"><div className="h-full max-w-[8.75rem] rounded-full" style={{ width: `${Math.min(100, amount / max * 100)}%`, backgroundColor: item.color ?? tones[index % tones.length] }} /></div>
          <b className="whitespace-nowrap text-right font-bold tabular-nums text-foreground">{item.value}</b>
        </div>;
      })}
    </div>
    {footer && <div className="mt-auto border-t border-border/70 pt-2 text-[0.6875rem] text-muted-foreground">{footer}</div>}
  </div>;
}

function ProcessUsageTable({ rows, usageKey, secondaryKey, totalLabel }: {
  rows: Array<{ name: string; server: string; cpu: string; memory: string; user: string; pid: string }>;
  usageKey: "cpu" | "memory"; secondaryKey: "cpu" | "memory"; totalLabel: string;
}) {
  const amountOf = (value: string) => Number.parseFloat(value);
  const colorFor = (value: number) => value >= 85 ? "oklch(0.7106 0.1661 22.22)" : value >= 70 ? "oklch(0.8369 0.1644 84.43)" : "oklch(0.7137 0.1434 254.62)";
  const columns = "grid-cols-[minmax(0,1.05fr)_minmax(8.125rem,1.35fr)_minmax(4.125rem,.55fr)_minmax(5.625rem,.8fr)]";
  return <div className="flex min-h-0 flex-1 flex-col pt-1">
    <div className={`grid ${columns} items-center gap-2 border-b border-border px-1 pb-1.5 text-[0.6875rem] font-semibold text-muted-foreground`}><span>Process</span><span>Usage</span><span className="text-right">Secondary</span><span>Server</span></div>
    <div className="flex-1">{rows.slice(0, 7).map((item) => {
      const amount = amountOf(item[usageKey]);
      return <div key={`${item.name}-${item.server}`} className={`grid h-10 ${columns} items-center gap-2 border-b border-slate-100 px-1 text-[0.75rem] transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50`}>
        <span className="flex min-w-0 items-center gap-1.5" title={`User: ${item.user} · PID: ${item.pid}`}><TechLogo name={item.name} className="h-6 w-6 rounded-[0.3125rem] [&_svg]:h-4 [&_svg]:w-4" /><span className="truncate font-medium text-slate-800 dark:text-slate-200">{item.name}</span></span>
        <span className="flex min-w-0 items-center gap-2"><b className="w-10 shrink-0 text-right tabular-nums text-slate-800 dark:text-slate-200">{item[usageKey]}</b><span className="h-[0.3125rem] min-w-0 flex-1 rounded-full bg-slate-100 dark:bg-slate-700"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, amount)}%`, backgroundColor: colorFor(amount) }} /></span></span>
        <span className="whitespace-nowrap text-right font-normal tabular-nums text-slate-500 dark:text-slate-400">{item[secondaryKey]}</span><span className="truncate font-normal text-slate-500 dark:text-slate-400" title={item.server}>{item.server}</span>
      </div>;
    })}</div>
    <div className="mt-auto flex items-center justify-between border-t border-border/70 pt-2 text-[0.6875rem] text-muted-foreground"><span>Showing 1-{Math.min(rows.length, 7)} of {PROCESS_COUNTS.total.toLocaleString()} {totalLabel}</span><span className="flex items-center gap-1"><button aria-label="Previous page" className="rounded-lg px-1.5 py-0.5 hover:bg-accent">‹</button><span className="rounded bg-primary px-2 py-0.5 text-primary-foreground">1</span><button aria-label="Next page" className="rounded-lg px-1.5 py-0.5 hover:bg-accent">›</button></span></div>
  </div>;
}

export function ProcessesServicesDashboard() {
  const [notice, setNotice] = useState("");
  const [period, setPeriod] = useState("24H");
  const [servicesOverviewTab, setServicesOverviewTab] = useState<"Status" | "Startup Type">("Status");
  const [topServicesTab, setTopServicesTab] = useState<"CPU" | "Memory">("CPU");
  const chartRefs = useRef<Record<string, echarts.EChartsType | null>>({});
  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const exportCsv = () => {
    const header = ["Alert", "Type", "Server", "Process / Service", "Severity", "Message", "Time"];
    const rows = alerts.map((item) => [item.alert, item.type, item.server, item.process, item.severity, item.message, item.time]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "processes-services-alerts.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast("Processes and services report exported.");
  };
  return (
    <div className="space-y-2.5 pb-3">
      <PageHeader breadcrumbs={["Monitoring", "Processes & Services"]} showRefresh={false} title="Processes & Services" subtitle="Monitor all running processes and services across your infrastructure in real-time.">
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={exportCsv} className="whitespace-nowrap"><Download size={15} />Export CSV</Button>
          <Button onClick={() => toast("Add Widget is a mockup action.")} className="whitespace-nowrap"><Plus size={15} />Add Widget</Button>
        </div>
      </PageHeader>


      <section aria-label="Process and service summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {stats.map((item) => <MetricCard key={item.label} item={item} className="h-[6.25rem]" labelClassName="text-[0.75rem] leading-4" valueClassName="text-[1.5rem] leading-7" trendClassName="text-[0.6875rem] leading-4" />)}
      </section>

      <section aria-label="Process trends" className="grid items-stretch gap-2.5 xl:grid-cols-3">
        <ProcessTrendCard id="process-cpu" title="CPU Usage by Processes" data={cpuHistory} series={cpuSeries} summaryKey="cpuUsage" summaryName="CPU" kind="cpu" period={period} onPeriodChange={setPeriod} chartRefs={chartRefs} />
        <ProcessTrendCard id="process-memory" title="Memory Usage by Processes" data={memoryHistory} series={memorySeries} summaryKey="used" summaryName="Used memory" kind="memory" period={period} onPeriodChange={setPeriod} chartRefs={chartRefs} />
        <ProcessTrendCard id="process-count" title="Processes Count Over Time" data={processCountHistory} series={processCountSeries} summaryKey="total" summaryName="Processes" kind="count" period={period} onPeriodChange={setPeriod} chartRefs={chartRefs} />
      </section>

      <section aria-label="Top processes and service health" className="grid items-stretch gap-2.5 xl:grid-cols-[1.08fr_1.08fr_0.9fr]">
        <Panel title="Top Processes by CPU Usage" className="flex min-h-[20.625rem] min-w-0 flex-col" action={<button onClick={() => toast("Showing all processes by CPU.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}><ProcessUsageTable rows={cpuProcesses} usageKey="cpu" secondaryKey="memory" totalLabel="processes" /></Panel>
        <Panel title="Top Processes by Memory Usage" className="flex min-h-[20.625rem] min-w-0 flex-col" action={<button onClick={() => toast("Showing all processes by memory usage.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}><ProcessUsageTable rows={memoryProcesses} usageKey="memory" secondaryKey="cpu" totalLabel="processes" /></Panel>
        <Panel title="Service Health Overview" className="flex min-h-[20.625rem] min-w-0 flex-col">
          <div className="flex flex-1 flex-col justify-center gap-2 pt-1"><Donut data={serviceStates} total={serviceTotals} featured />
            <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border/70 pt-2">{serviceHealthStats.map((stat) => <div key={stat.label} className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800"><div className="text-[0.6875rem] text-muted-foreground">{stat.label}</div><div className="mt-0.5 text-[1rem] font-bold tabular-nums text-foreground">{stat.value}</div></div>)}</div>
          </div>
        </Panel>
      </section>

      <section aria-label="Service overview" className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Services Overview" className="flex min-h-[22.5rem] min-w-0 flex-col p-4" action={<SegmentedTabs label="Services overview" value={servicesOverviewTab} options={["Status", "Startup Type"] as const} onChange={setServicesOverviewTab} />}>
          <div className="flex min-h-[17.5rem] flex-1 flex-col pt-1">
            <FadeTabContent tab={servicesOverviewTab}>
              <ServiceBreakdown data={servicesOverviewTab === "Status" ? serviceStates : startupStates} total={servicesOverviewTab === "Status" ? serviceTotals : startupTotal} />
            </FadeTabContent>
            <div className="mt-auto border-t border-border/70 pt-2 text-[0.6875rem] text-muted-foreground">{SERVICE_COUNTS.total.toLocaleString()} total services · {servicesOverviewTab === "Status" ? "status breakdown" : "startup type breakdown"}</div>
          </div>
        </Panel>
        <Panel title="Top Services" className="flex min-h-[22.5rem] min-w-0 flex-col p-4" action={<SegmentedTabs label="Top services metric" value={topServicesTab} options={["CPU", "Memory"] as const} onChange={setTopServicesTab} />}>
          <FadeTabContent tab={topServicesTab}>
            <UsageRows items={topServicesTab === "CPU" ? topCpuServices : topMemoryServices} footer={`Showing 1-${Math.min(7, (topServicesTab === "CPU" ? topCpuServices : topMemoryServices).length)} of ${SERVICE_COUNTS.total.toLocaleString()} services`} />
          </FadeTabContent>
        </Panel>
        <Panel title="Services by Host" className="flex min-h-[22.5rem] min-w-0 flex-col p-4" action={<button onClick={() => toast("Showing services on all hosts.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
          <UsageRows showLogos={false} items={servicesByHost.map((item) => ({ name: item.name, value: String(item.value), color: item.color }))} footer={`Showing ${Math.min(7, servicesByHost.length)} of ${servicesByHost.length} hosts`} />
        </Panel>
      </section>

      <Panel title="Recent Process & Service Alerts" className="min-w-0" action={<button onClick={() => toast("Showing all process and service alerts.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
        <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[60rem] text-left text-[0.75rem]">
            <thead><tr className="border-b border-border text-muted-foreground">{["Alert", "Type", "Server", "Process / Service", "Severity", "Message", "Time"].map((heading) => <th key={heading} className="whitespace-nowrap px-1.5 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
            <tbody>{alerts.map((item) => <tr key={item.alert} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1.5 py-[0.375rem] font-semibold text-foreground"><i className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${item.severity === "Critical" ? "bg-rose-500" : item.severity === "Warning" ? "bg-amber-500" : "bg-blue-500"}`} />{item.alert}</td><td className="px-1.5 py-[0.375rem] text-foreground">{item.type}</td><td className="whitespace-nowrap px-1.5 py-[0.375rem] text-foreground">{item.server}</td><td className="whitespace-nowrap px-1.5 py-[0.375rem] text-foreground"><span className="mr-1.5 inline-flex align-middle"><TechLogo name={item.process} /></span>{item.process}</td><td className="px-1.5 py-[0.375rem]"><span className={`rounded-full px-2 py-0.5 text-[0.6875rem] ${severityStyles[item.severity]}`}>{item.severity}</span></td><td className="px-1.5 py-[0.375rem] text-foreground">{item.message}</td><td className="whitespace-nowrap px-1.5 py-[0.375rem] text-muted-foreground">{item.time}</td></tr>)}</tbody>
          </table>
        </div>
      </Panel>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[0.75rem] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}