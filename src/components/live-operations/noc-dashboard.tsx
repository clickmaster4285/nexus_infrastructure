"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts";
import {
  Activity, AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Check, Clock3,
  Cpu, Database, Expand, Gauge, HardDrive, HeartPulse, MapPin, Pause, Play, RefreshCw,
  Server, Shield, Siren, Wifi, X,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Icon, TechLogo } from "@/components/shared/icon";
import { Panel } from "@/components/shared/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  nocActiveAlerts, nocAlertMetrics, nocCollectorSummary, nocCollectors, nocFeedBufferedCount, nocFleet, nocHealth, nocHealthSegments, nocMapCounts, nocMarkers,
  nocOnCall, nocOperationsFeed, nocOverallAvailability, nocRecentEvents, nocResourceUsage,
  nocServerGroups, nocServiceAvailability, nocStats, nocTopIssues,
  type AlertSeverity, type FeedTone, type NocResourceRange, type NocResourceTab, type TopIssueTab,
} from "@/data/mock/live-operations";

const InfrastructureMap = dynamic(
  () => import("@/components/live-operations/infrastructure-map").then((mod) => mod.InfrastructureMap),
  { ssr: false, loading: () => <div className="grid h-full min-h-[220px] animate-pulse place-items-center rounded-lg bg-muted text-[12px] text-muted-foreground">Loading infrastructure map…</div> },
);

const STATUS = {
  critical: { label: "Critical", color: "#ef4444", badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300", Icon: AlertCircle },
  high: { label: "High", color: "#f59e0b", badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300", Icon: AlertCircle },
  medium: { label: "Medium", color: "#60a5fa", badge: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300", Icon: Activity },
} as const;
const FEED_TONE: Record<FeedTone, string> = {
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300",
  red: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300",
};
const RESOURCE = {
  cpu: { label: "CPU", color: "#60a5fa", unit: "%", icon: Cpu },
  memory: { label: "Memory", color: "#34d399", unit: "%", icon: Database },
  network: { label: "Network", color: "#a78bfa", unit: "Mbps", icon: Wifi },
  disk: { label: "Disk", color: "#fbbf24", unit: "%", icon: HardDrive },
} as const;
const RANGE_COUNT: Record<NocResourceRange, number> = { "5m": 5, "15m": 15, "1h": 60 };
const issueTabs: Array<{ value: TopIssueTab; label: string }> = [
  { value: "cpu", label: "CPU" }, { value: "memory", label: "Memory" }, { value: "disk", label: "Disk" }, { value: "network", label: "Network" },
];
const resourceTabs: Array<{ value: NocResourceTab; label: string }> = [
  { value: "cpu", label: "CPU" }, { value: "memory", label: "Memory" }, { value: "network", label: "Network" }, { value: "disk", label: "Disk" },
];

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; label: string }) {
  return <div role="group" aria-label={label} className="inline-flex max-w-full items-center gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5">
    {options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={cn("min-h-7 cursor-pointer rounded-md px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", value === option.value && "bg-background text-primary shadow-sm")}>{option.label}</button>)}
  </div>;
}

function useDarkMode() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function EChart({ option, className = "" }: { option: echarts.EChartsOption; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let frame = 0;
    let chart: echarts.ECharts | null = null;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (node.clientWidth > 0 && node.clientHeight > 0) {
          if (!chart) {
            chart = echarts.init(node, undefined, { renderer: "canvas" });
            instance.current = chart;
          }
          chart.setOption(option, true);
          chart.resize();
        }
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    resize();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); chart?.dispose(); instance.current = null; };
  }, [option]);
  return <div ref={host} className={cn("h-full min-h-[220px] min-w-0 flex-1", className)} aria-label="Interactive monitoring chart" role="img" />;
}

function Donut({ data, total, label, size = 132, centerValue, centerLabel }: { data: Array<{ name: string; value: number; color: string }>; total: number; label: string; size?: number; centerValue?: string; centerLabel?: string }) {
  let start = 0;
  const stops = data.map((item) => {
    const end = start + (total ? item.value / total : 0) * 100;
    const segment = `${item.color} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${total}`}>
    <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${stops.join(",")})`, mask: "radial-gradient(farthest-side, transparent 71%, #000 72%)", WebkitMask: "radial-gradient(farthest-side, transparent 71%, #000 72%)" }} />
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className="font-display text-[24px] font-bold leading-none tabular-nums text-foreground">{centerValue ?? total}</b><span className="mt-1 text-[12px] text-muted-foreground">{centerLabel ?? label}</span></div>
  </div>;
}

function DonutLegend({ data, total, compact = false }: { data: Array<{ name: string; value: number; color: string; health?: number }>; total: number; compact?: boolean }) {
  return <div className={cn("grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3", compact ? "gap-y-2" : "gap-y-2.5")}>
    {data.map((item) => <div key={item.name} className="contents text-[12px]">
      <span className="flex min-w-0 items-center gap-2 truncate text-foreground"><i className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />{item.name}{item.health != null && <i title={`${item.name} health ${item.health}%`} aria-label={`${item.health}% health`} className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: item.health >= 99 ? "#34d399" : item.health >= 98 ? "#fbbf24" : "#f87171" }} />}</span>
      <b className="text-right tabular-nums text-foreground">{item.value}</b>
      <span className="min-w-[42px] text-right tabular-nums text-muted-foreground">{total ? Math.round(item.value / total * 100) : 0}%</span>
    </div>)}
  </div>;
}

function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-[12px] text-muted-foreground">{children}</div>;
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <span className="block whitespace-nowrap text-[16px] font-semibold leading-6 text-foreground">{children}</span>;
}

function statusForAvailability(value: number) {
  if (value >= 99.5) return { color: "#34d399", label: "Healthy" };
  if (value >= 99) return { color: "#fbbf24", label: "Warning" };
  return { color: "#f87171", label: "Critical" };
}

function buildResourceOption(data: Array<{ time: string; value: number; load: number }>, tab: NocResourceTab, isDark: boolean): echarts.EChartsOption {
  const config = RESOURCE[tab];
  const values = data.map((point) => point.value);
  const average = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const peak = Math.max(...values);
  const loadAverage = data[data.length - 1]?.load ?? 0;
  const axisColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const loadAxisMax = Math.max(60, Math.ceil(Math.max(...data.map((point) => point.load), 0) / 20) * 20);
  return {
    animationDuration: 400,
    grid: { left: 46, right: 60, top: 24, bottom: 32, containLabel: false },
    legend: { show: false },
    tooltip: { trigger: "axis", axisPointer: { type: "cross", lineStyle: { color: isDark ? "#94a3b8" : "#64748b", type: "dashed" } }, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: gridColor, textStyle: { color: isDark ? "#e2e8f0" : "#1e293b", fontSize: 12 }, extraCssText: "border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14);", formatter: (items: unknown) => {
      const points = items as Array<{ axisValue: string; seriesName: string; value: number; color: string }>;
      return `<b>${points[0]?.axisValue ?? ""}</b><br/>${points.map((point) => `<span style="color:${point.color}">●</span> ${point.seriesName}: <b>${point.value}${point.seriesName === "Load Average" ? "" : ` ${config.unit}`}</b>`).join("<br/>")}`;
    } },
    xAxis: { type: "category", boundaryGap: false, data: data.map((point) => point.time), axisLabel: { color: axisColor, fontSize: 12, hideOverlap: true, interval: Math.max(1, Math.ceil((data.length - 1) / 5)), showMaxLabel: true, margin: 9 }, axisLine: { lineStyle: { color: gridColor } }, axisTick: { show: false } },
    yAxis: [
      { type: "value", min: 0, max: 100, interval: 25, axisLabel: { color: axisColor, fontSize: 12, formatter: (value: number) => `${Math.round(value)}${config.unit === "%" ? "%" : ""}` }, splitLine: { lineStyle: { color: gridColor, type: "dashed" } }, axisLine: { show: false } },
      { type: "value", min: 0, max: loadAxisMax, interval: 20, axisLabel: { color: "#a78bfa", fontSize: 12 }, splitLine: { show: false }, axisLine: { show: false } },
    ],
    series: [
      { name: `${config.label} Usage`, type: "line", smooth: 0.3, showSymbol: false, emphasis: { focus: "series", showSymbol: true, symbolSize: 7 }, lineStyle: { width: 2, color: config.color }, itemStyle: { color: config.color }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `${config.color}44` }, { offset: 1, color: `${config.color}00` }]) }, data: values },
      { name: "Load Average", type: "line", yAxisIndex: 1, smooth: 0.3, showSymbol: false, emphasis: { focus: "series", showSymbol: true, symbolSize: 7 }, lineStyle: { width: 1.5, color: "#a78bfa", type: "dashed" }, itemStyle: { color: "#a78bfa" }, data: data.map((point) => point.load) },
    ],
    __nocSummary: { now: values.at(-1) ?? 0, average, peak, loadAverage },
  } as echarts.EChartsOption & { __nocSummary: { now: number; average: number; peak: number; loadAverage: number } };
}

export function LiveOperationsNoc() {
  const dark = useDarkMode();
  const [resourceTab, setResourceTab] = useState<NocResourceTab>("cpu");
  const [resourceRange, setResourceRange] = useState<NocResourceRange>("15m");
  const [topIssueTab, setTopIssueTab] = useState<TopIssueTab>("cpu");
  const [healthRange, setHealthRange] = useState("24h");
  const [autoRefresh, setAutoRefresh] = useState("30s");
  const [paused, setPaused] = useState(false);
  const [feedPaused, setFeedPaused] = useState(false);
  const [feedFilter, setFeedFilter] = useState<"all" | "critical" | "warning" | "info" | "success">("all");
  const [alertFilter, setAlertFilter] = useState<"all" | AlertSeverity>("all");
  const [alerts, setAlerts] = useState(nocActiveAlerts);
  const [snoozed, setSnoozed] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(30);
  const [clock, setClock] = useState(() => new Date());
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const [onCallPaged, setOnCallPaged] = useState(false);
  const feedRef = useRef<HTMLUListElement>(null);
  const feedWasAtTop = useRef(true);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(new Date());
      if (autoRefresh === "Off" || paused) return;
      setRemaining((current) => {
        if (current <= 1) {
          setLastUpdated(new Date());
          const seconds = autoRefresh === "15s" ? 15 : autoRefresh === "30s" ? 30 : 60;
          return seconds;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, paused]);

  useEffect(() => {
    const node = feedRef.current;
    if (node && feedWasAtTop.current) node.scrollTo({ top: 0, behavior: "smooth" });
  }, [feedPaused, feedFilter]);

  useEffect(() => {
    if (!tvMode) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setTvMode(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tvMode]);

  const runRefresh = useCallback(() => {
    setRefreshing(true);
    setLastUpdated(new Date());
    setRemaining(autoRefresh === "Off" ? 30 : autoRefresh === "15s" ? 15 : autoRefresh === "30s" ? 30 : 60);
    window.setTimeout(() => setRefreshing(false), 450);
  }, [autoRefresh]);

  const activeAlerts = useMemo(() => alerts.filter((alert) => !snoozed.includes(alert.id)), [alerts, snoozed]);
  const criticalCount = activeAlerts.filter((alert) => alert.severity === "critical").length;
  const statData = nocStats.map((stat) => stat.label === "Critical Alerts" ? { ...stat, value: `${criticalCount}` } : stat);
  const visibleAlerts = alertFilter === "all" ? activeAlerts : activeAlerts.filter((alert) => alert.severity === alertFilter);
  const unacknowledgedAlerts = activeAlerts.filter((alert) => !acknowledged[alert.id]);
  const oldestAlertMinutes = Math.max(0, ...unacknowledgedAlerts.map((alert) => alert.ageMinutes));
  const resourceData = useMemo(() => nocResourceUsage[resourceTab].slice(-RANGE_COUNT[resourceRange]), [resourceTab, resourceRange]);
  const chartOption = useMemo(() => buildResourceOption(resourceData, resourceTab, dark), [resourceData, resourceTab, dark]);
  const chartSummary = (chartOption as echarts.EChartsOption & { __nocSummary: { now: number; average: number; peak: number; loadAverage: number } }).__nocSummary;
  const mapMarkers = nocMarkers;
  const healthLegend = nocHealthSegments.map((segment) => ({ ...segment }));
  const serviceHealthRows = nocServiceAvailability;
  const feedItems = nocOperationsFeed.filter((item) => feedFilter === "all" || item.severity === feedFilter).slice(0, 7);
  const localeClock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Karachi" }).format(clock);
  const formattedUpdated = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(lastUpdated);

  const dashboard = <div className={cn("space-y-4", tvMode && "min-h-screen bg-background p-5 md:p-6")}>
    <PageHeader
      breadcrumbs={["Overview", "Live Operations / NOC"]}
      title="Live Operations / NOC"
      subtitle="Real-time infrastructure monitoring and operations center"
      lastUpdated={formattedUpdated}
      onRefresh={runRefresh}
      actions={<div className="flex flex-wrap items-center justify-end gap-2">
        <Badge variant="success" className="gap-1.5 border-transparent bg-emerald-50 px-2.5 py-1 text-[12px] text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Live</Badge>
        <Select value={autoRefresh} onValueChange={(value) => { setAutoRefresh(value); setRemaining(value === "15s" ? 15 : value === "30s" ? 30 : value === "1m" ? 60 : 30); }}>
          <SelectTrigger className="h-9 w-[116px] text-[12px]" aria-label="Auto refresh interval"><SelectValue /></SelectTrigger>
          <SelectContent>{["Off", "15s", "30s", "1m"].map((value) => <SelectItem key={value} value={value}>{value === "Off" ? "Refresh: Off" : `Every ${value}`}</SelectItem>)}</SelectContent>
        </Select>
        {autoRefresh !== "Off" && !paused && <span className="hidden whitespace-nowrap text-[12px] text-muted-foreground lg:inline">Refreshing in {remaining}s</span>}
        <Button variant="outline" className="h-9 gap-1.5 px-3 text-[12px]" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>{paused ? <Play size={14} /> : <Pause size={14} />}{paused ? "Resume" : "Pause"}</Button>
        <span className="hidden items-center gap-1.5 whitespace-nowrap text-[12px] tabular-nums text-muted-foreground lg:flex"><Clock3 size={14} />{localeClock} PKT</span>
        <Button variant="outline" className="h-9 gap-1.5 px-3 text-[12px]" onClick={() => setTvMode((value) => !value)} aria-label={tvMode ? "Exit full-screen TV mode" : "Enter full-screen TV mode"}><Expand size={14} />{tvMode ? "Exit TV" : "Full screen"}</Button>
      </div>}
    />

    {nocFleet.activeIncidents > 0 || criticalCount > 0 ? <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200" role="status">
      <div className="flex items-center gap-2"><Siren size={17} /><b>{nocFleet.activeIncidents} active incidents</b><span className="text-red-700/80 dark:text-red-200/80">· {criticalCount} critical alerts</span></div>
      <Button variant="outline" className="h-8 border-red-200 bg-white px-3 text-[12px] text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-transparent dark:text-red-200" asChild><a href="/alerts">View incidents <ArrowRight className="ml-1" size={13} /></a></Button>
    </div> : null}

    {refreshing ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6" aria-label="Loading metrics">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[108px] animate-pulse rounded-xl border bg-card" />)}</div> : <section aria-label="Key metrics" className="grid grid-cols-2 items-stretch gap-4 sm:grid-cols-3 xl:grid-cols-6">
      {statData.map((item) => <StatCard key={item.label} icon={<Icon name={item.icon} size={21} />} label={item.label} value={item.value} trend={item.change} iconTone={item.tone === "green" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300" : item.tone === "amber" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300" : item.tone === "red" ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300" : "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"} className="h-[108px]" />)}
    </section>}

    <section aria-label="NOC overview" className="grid items-stretch gap-4 xl:grid-cols-3">
      <Panel title={<PanelTitle>Infrastructure Health</PanelTitle>} className="min-h-[350px] p-4" headerClassName="h-10" action={<Segmented value={healthRange} options={[{ value: "24h", label: "24h" }, { value: "7d", label: "7d" }, { value: "30d", label: "30d" }]} onChange={setHealthRange} label="Health time range" />}>
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-1 items-center gap-3">
            <div className="flex shrink-0 flex-col items-center gap-1"><Donut data={healthLegend} total={nocFleet.total} label="Servers" centerValue={`${nocFleet.total}`} centerLabel="Servers" /><b className="text-[16px] font-bold tabular-nums text-foreground">{nocHealth.score}% Health</b></div>
            <DonutLegend data={healthLegend} total={nocFleet.total} compact />
          </div>
          <div className="grid grid-cols-2 gap-2"><MiniStat label="Avg Uptime" value={`${nocOverallAvailability}%`} /><MiniStat label="Open Incidents" value={`${nocFleet.activeIncidents}`} /></div>
          <CardFooter><span>Fleet health score</span><b className="text-foreground">{nocHealth.score}%</b></CardFooter>
        </div>
      </Panel>

      <Panel title={<PanelTitle>Real-Time Resource Usage</PanelTitle>} className="min-h-[350px] p-4" headerClassName="h-10" action={<Segmented value={resourceRange} options={[{ value: "5m", label: "5m" }, { value: "15m", label: "15m" }, { value: "1h", label: "1h" }]} onChange={setResourceRange} label="Resource chart range" />}>
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-1" role="tablist" aria-label="Resource metric">{resourceTabs.map((tab) => <button key={tab.value} role="tab" aria-selected={resourceTab === tab.value} type="button" onClick={() => setResourceTab(tab.value)} className={cn("min-h-8 cursor-pointer rounded-lg px-3 text-[12px] font-medium text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", resourceTab === tab.value && "bg-primary/10 text-primary")}>{tab.label}</button>)}</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted-foreground"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#a78bfa]" />Load avg {chartSummary.loadAverage.toFixed(1)}</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: RESOURCE[resourceTab].color }} />{RESOURCE[resourceTab].label} {chartSummary.now.toFixed(1)}{RESOURCE[resourceTab].unit}</span></div>
          </div>
          <EChart option={chartOption} className="min-h-[220px]" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2 text-[12px] text-muted-foreground"><span>Now <b className="text-foreground">{chartSummary.now.toFixed(1)} {RESOURCE[resourceTab].unit}</b></span><span>Avg <b className="text-foreground">{chartSummary.average.toFixed(1)} {RESOURCE[resourceTab].unit}</b></span><span>Peak <b className="text-foreground">{chartSummary.peak.toFixed(1)} {RESOURCE[resourceTab].unit}</b></span></div>
        </div>
      </Panel>

      <Panel title={<PanelTitle>Infrastructure Map</PanelTitle>} className="min-h-[430px] p-4" headerClassName="h-10" showOptions={false} action={<Badge variant="outline" className="text-[12px]">{mapMarkers.length} locations</Badge>}>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="h-[260px] min-h-[260px] flex-1 overflow-hidden rounded-lg"><InfrastructureMap variant={dark ? "dark" : "light"} fitMarkers fitPadding={40} criticalPulseOnly legendPosition="overlay-left" legendLabels={{ healthy: "Healthy", warning: "Degraded", critical: "Offline" }} fallbackOnTileError markers={mapMarkers} legendCounts={nocMapCounts} title="NOC infrastructure map" description={`${mapMarkers.length} monitored locations · sample data`} /></div>
          <div className="flex items-center justify-between gap-2 text-[12px]"><b className="text-foreground">Worst locations</b><span className="text-muted-foreground">Status by site</span></div>
          <div className="grid grid-cols-3 gap-2">{mapMarkers.slice().sort((a, b) => a.health - b.health).slice(0, 3).map((marker) => <div key={marker.name} title={`${marker.name}: ${marker.health}%`} className="min-w-0 rounded-lg bg-muted/60 px-2 py-1.5"><span className="block truncate text-[12px] font-medium text-foreground">{marker.name.split("—")[0]}</span><span className="flex items-center gap-1 text-[12px] tabular-nums text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: marker.status === "critical" ? "#ef4444" : marker.status === "warning" ? "#f59e0b" : "#22c55e" }} />{marker.health}%</span></div>)}</div>
        </div>
      </Panel>
    </section>

    <section aria-label="Alerts and availability" className="grid items-stretch gap-4 xl:grid-cols-3">
      <Panel title={<PanelTitle>Active Alerts</PanelTitle>} className="min-h-[370px] p-4" headerClassName="h-10" action={<a href="/alerts" className="text-[12px] font-medium text-primary hover:underline">View all <ArrowRight className="ml-1 inline" size={13} /></a>}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex flex-wrap items-center gap-1.5 pb-2 text-[12px] text-muted-foreground" aria-label="Active alert summary"><span>Unacknowledged <b className="text-foreground">{unacknowledgedAlerts.length}</b></span><span>·</span><span>Oldest <b className="text-foreground">{oldestAlertMinutes}m</b></span><span>·</span><span>MTTA <b className="text-foreground">{nocAlertMetrics.mttaMinutes}m</b></span></div>
          <ul className="flex flex-1 flex-col divide-y divide-border/70" aria-label="Active alerts">{visibleAlerts.length ? visibleAlerts.map((alert) => { const tone = STATUS[alert.severity]; const StatusIcon = tone.Icon; const ackedBy = acknowledged[alert.id]; return <li key={alert.id} className={cn("flex min-h-[58px] items-center gap-2 py-2", ackedBy && "rounded-md bg-muted/50 px-2 text-muted-foreground")}><span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[12px] font-semibold", tone.badge)}><StatusIcon size={12} />{tone.label}</span><span className="min-w-0 flex-1"><b className={cn("block truncate text-[13px] font-medium", ackedBy ? "text-muted-foreground" : "text-foreground")} title={alert.title}>{alert.title}</b><span className="block truncate text-[12px] text-muted-foreground">{ackedBy ? `Acknowledged by ${ackedBy} · ${nocAlertMetrics.acknowledgedAgo}` : alert.detail}</span></span><span className="flex shrink-0 flex-col items-end gap-1"><time className="text-[12px] tabular-nums text-muted-foreground">{alert.time}</time><span className="flex gap-1"><button type="button" disabled={Boolean(ackedBy)} onClick={() => setAcknowledged((items) => ({ ...items, [alert.id]: nocAlertMetrics.acknowledgedBy }))} className="h-[26px] cursor-pointer rounded-md border border-border bg-background px-2 text-[12px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-default disabled:opacity-50" aria-label={`Acknowledge ${alert.title}`}>Ack</button><button type="button" onClick={() => setSnoozed((items) => items.includes(alert.id) ? items : [...items, alert.id])} className="h-[26px] cursor-pointer rounded-md border border-border bg-background px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:border-amber-400/50 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30" aria-label={`Snooze ${alert.title}`}>Snooze</button></span></span></li>; }) : <li className="grid flex-1 place-items-center py-8 text-center text-[13px] text-muted-foreground"><span><Check className="mx-auto mb-2 text-emerald-500" />All clear, no active alerts</span></li>}</ul>
          <CardFooter><span>Showing {visibleAlerts.length} of {activeAlerts.length} alerts</span><span className="flex items-center gap-1"><b className="text-red-600">{criticalCount} critical</b><span>·</span><b className="text-amber-600">{activeAlerts.filter((a) => a.severity === "high").length} warning</b></span></CardFooter>
        </div>
      </Panel>

      <Panel title={<PanelTitle>Service Availability</PanelTitle>} className="min-h-[370px] p-4" headerClassName="h-10" action={<span className="whitespace-nowrap text-[12px] text-muted-foreground">Scale 99–100%</span>}>
        <div className="flex flex-1 flex-col">
          <ul className="flex flex-1 flex-col justify-between divide-y divide-border/60">{serviceHealthRows.map((service) => { const status = statusForAvailability(service.value); const width = Math.max(0, Math.min(100, (service.value - 99) * 100)); return <li key={service.name} className="grid min-h-[44px] grid-cols-[minmax(0,1fr)_minmax(70px,1.5fr)_auto] items-center gap-3 py-1"><span className="flex min-w-0 items-center gap-2 text-[13px] text-foreground"><ServiceGlyph name={service.name} /><span className="truncate">{service.name}</span></span><div className="relative h-2 rounded-full bg-muted" role="progressbar" aria-label={`${service.name} availability`} aria-valuenow={service.value} aria-valuemin={99} aria-valuemax={100}><span className="absolute inset-y-[-3px] left-1/2 z-[1] w-px bg-slate-500" title="SLA 99.5%" /><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${width}%`, backgroundColor: status.color }} /></div><b className="min-w-[50px] text-right text-[13px] tabular-nums text-foreground">{service.value}%</b></li>; })}</ul>
          <CardFooter><span>Overall availability</span><b className="text-foreground">{nocOverallAvailability}%</b></CardFooter>
        </div>
      </Panel>

      <Panel title={<PanelTitle>Server Groups</PanelTitle>} className="min-h-[370px] p-4" headerClassName="h-10">
        <div className="flex flex-1 flex-col gap-3"><div className="flex flex-1 items-center justify-center gap-4"><Donut data={nocServerGroups} total={nocServerGroups.reduce((sum, row) => sum + row.value, 0)} label="Servers" size={140} centerValue={`${nocServerGroups.reduce((sum, row) => sum + row.value, 0)}`} centerLabel="Servers" /><DonutLegend data={nocServerGroups} total={nocServerGroups.reduce((sum, row) => sum + row.value, 0)} compact /></div><div className="grid grid-cols-2 gap-2"><MiniStat label="Healthiest group" value={`${[...nocServerGroups].sort((a, b) => b.health - a.health)[0]?.name} · ${Math.max(...nocServerGroups.map((group) => group.health))}%`} /><MiniStat label="Needs attention" value={`${[...nocServerGroups].sort((a, b) => a.health - b.health)[0]?.name} · ${Math.min(...nocServerGroups.map((group) => group.health))}%`} /></div><CardFooter><span>Group health</span><b className="text-foreground">{nocServerGroups.length} groups · {nocServerGroups.reduce((sum, row) => sum + row.value, 0)} servers</b></CardFooter></div>
      </Panel>
    </section>

    <section aria-label="Issues, events and collectors" className="grid items-stretch gap-4 xl:grid-cols-3">
      <Panel title={<PanelTitle>Top Issues</PanelTitle>} className="min-h-[390px] p-4" headerClassName="h-10" action={<Segmented value={topIssueTab} options={issueTabs} onChange={setTopIssueTab} label="Top issue metric" />}>
        <div className="flex flex-1 flex-col"><ul className="flex flex-1 flex-col justify-between divide-y divide-border/60">{nocTopIssues[topIssueTab].map((issue, index) => { const color = issue.percent > 90 ? "#ef4444" : issue.percent >= 75 ? "#f59e0b" : "#60a5fa"; return <li key={issue.name} className="grid min-h-[48px] grid-cols-[minmax(90px,.8fr)_minmax(60px,1fr)_auto] items-center gap-2 py-1"><span className="min-w-0"><b className="block truncate text-[13px] font-medium text-foreground" title={issue.name}>{issue.name}</b><span className="text-[12px] text-muted-foreground">{issue.duration}</span></span><span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${issue.percent}%`, backgroundColor: color }} /></span><b className="w-[48px] text-right text-[13px] tabular-nums text-foreground">{issue.percent}%</b></li>; })}</ul><CardFooter><span>Showing {nocTopIssues[topIssueTab].length} of {nocFleet.total} servers</span><span className="flex gap-2 text-[12px]"><span className="text-red-600">● &gt;90%</span><span className="text-amber-600">● 75–90%</span></span></CardFooter></div>
      </Panel>

      <Panel title={<PanelTitle>Recent Events</PanelTitle>} className="min-h-[390px] p-4" headerClassName="h-10" action={<a href="/events-explorer" className="text-[12px] font-medium text-primary hover:underline">View all <ArrowRight className="ml-1 inline" size={13} /></a>}>
        <ul className="flex flex-1 flex-col divide-y divide-border/70">{nocRecentEvents.map((event) => <li key={`${event.title}-${event.time}`} className="flex h-12 shrink-0 items-center gap-2.5"><span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", FEED_TONE[event.tone])}><Icon name={event.icon} size={15} /></span><span className="min-w-0 flex-1"><b className="block truncate text-[13px] font-medium text-foreground">{event.title}</b><span className="block truncate text-[12px] text-muted-foreground">{event.detail}</span></span><time className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-muted-foreground">{event.time}</time></li>)}</ul>
        <CardFooter><span>Latest operational updates</span><span>{nocRecentEvents.length} recent</span></CardFooter>
      </Panel>

      <Panel title={<PanelTitle>Monitoring Collectors</PanelTitle>} className="min-h-[390px] p-4" headerClassName="h-10" action={<a href="/metrics-explorer" className="text-[12px] font-medium text-primary hover:underline">Details <ArrowRight className="ml-1 inline" size={13} /></a>}>
        <div className="flex flex-1 flex-col"><div className="grid grid-cols-[minmax(0,1fr)_minmax(72px,auto)_minmax(62px,auto)] gap-2 border-b border-border pb-2 text-[12px] font-medium text-muted-foreground"><span>Collector</span><span>Status</span><span className="text-right">Ingest</span></div><ul className="flex flex-1 flex-col divide-y divide-border/60">{nocCollectors.map((collector) => <li key={collector.name} className="grid h-[52px] shrink-0 grid-cols-[minmax(0,1fr)_minmax(72px,auto)_minmax(62px,auto)] items-center gap-2"><span className="flex min-w-0 items-center gap-2"><TechLogo name={collector.name} className="!h-8 !w-8 !rounded-lg [&_svg]:!h-[18px] [&_svg]:!w-[18px]" /><span className="min-w-0"><b className="block truncate text-[13px] font-medium text-foreground">{collector.name}</b><span className="block truncate whitespace-nowrap text-[12px] text-muted-foreground">v{collector.version} · {collector.targetsUp}/{collector.targetsTotal} · {collector.heartbeat}</span></span></span><CollectorStatus status={collector.status} /><span className="flex min-w-[62px] flex-col items-end gap-1"><b className="whitespace-nowrap text-[12px] tabular-nums text-foreground">{collector.rate}</b><CollectorSpark values={collector.spark} name={collector.name} /></span></li>)}</ul><CardFooter><span>{nocCollectorSummary.healthy}/{nocCollectorSummary.total} healthy</span><b className={cn(nocCollectorSummary.offline || nocCollectorSummary.stale ? "text-amber-600" : "text-emerald-600")}>{nocCollectorSummary.offline ? `${nocCollectorSummary.offline} collector${nocCollectorSummary.offline === 1 ? "" : "s"} down` : nocCollectorSummary.stale ? `${nocCollectorSummary.stale} collector${nocCollectorSummary.stale === 1 ? "" : "s"} stale` : "All collectors healthy"}</b></CardFooter></div>
      </Panel>
    </section>

    <section aria-label="Operations and on-call" className="grid items-stretch gap-4 xl:grid-cols-3">
      <Panel title={<PanelTitle>Live Operations Feed</PanelTitle>} className="min-h-[390px] p-4 xl:col-span-2" headerClassName="h-10" action={<div className="flex items-center gap-2"><Badge variant="success" className="gap-1.5 border-transparent bg-emerald-50 text-[12px] text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Live Stream</Badge><Button variant="outline" className="h-8 gap-1.5 px-2.5 text-[12px]" aria-pressed={feedPaused} onClick={() => setFeedPaused((value) => !value)}>{feedPaused ? <Play size={13} /> : <Pause size={13} />}{feedPaused ? "Resume" : "Pause"}</Button></div>}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-1" role="group" aria-label="Filter operations feed">{([{ value: "all", label: "All" }, { value: "critical", label: "Critical" }, { value: "warning", label: "Warning" }, { value: "info", label: "Info" }, { value: "success", label: "Success" }] as const).map(({ value, label }) => <button key={value} type="button" onClick={() => setFeedFilter(value)} aria-pressed={feedFilter === value} className={cn("rounded-full border px-2.5 py-1 text-[12px]", feedFilter === value ? "border-primary/30 bg-primary/10 font-semibold text-primary" : "border-border text-muted-foreground")}>{label}</button>)}</div><span className="text-[12px] text-muted-foreground">{feedPaused ? `${nocFeedBufferedCount} new events` : "Newest first"}</span></div>
        <style>{`@keyframes noc-feed-slide-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.noc-feed-item{animation:none!important}}`}</style>
        <ul ref={feedRef} onScroll={(event) => { feedWasAtTop.current = event.currentTarget.scrollTop < 8; }} className="max-h-[308px] flex-1 divide-y divide-border/60 overflow-y-auto [scrollbar-color:#94a3b8_transparent] [scrollbar-width:thin]" aria-label="Live operations events">{feedItems.length ? feedItems.map((item) => <li key={`${item.time}-${item.message}`} className="noc-feed-item grid h-11 grid-cols-[44px_28px_minmax(0,1fr)_auto_54px] items-center gap-2" style={{ animation: "noc-feed-slide-in 220ms ease-out both" }}><time className="w-11 shrink-0 whitespace-nowrap text-[12px] tabular-nums text-muted-foreground">{item.time}</time><span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", FEED_TONE[item.tone])}><Icon name={item.icon} size={14} /></span><span className="min-w-0 truncate text-[13px] text-foreground" title={item.message}>{item.message}</span><span className="max-w-[118px] truncate rounded-full bg-muted px-2 py-1 text-[12px] text-muted-foreground" title={item.source}>{item.source}</span><span className={cn("text-right text-[12px] font-semibold capitalize", item.severity === "critical" ? "text-red-600 dark:text-red-400" : item.severity === "warning" ? "text-amber-600 dark:text-amber-400" : item.severity === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400")}>{item.severity}<small className="block whitespace-nowrap font-normal text-muted-foreground">{item.relativeTime}</small></span></li>) : <li className="grid h-20 place-items-center text-[13px] text-muted-foreground">No events match this filter.</li>}</ul>
      </Panel>

      <Panel title={<PanelTitle>On-Call &amp; Escalation</PanelTitle>} className="min-h-[330px] p-4" headerClassName="h-10" action={<Badge variant="outline" className="gap-1 text-[12px]"><span className="h-2 w-2 rounded-full bg-emerald-500" />On duty</Badge>}>
        <div className="flex flex-1 flex-col gap-3"><div className="rounded-xl border border-border bg-muted/40 p-3"><div className="flex items-start justify-between gap-2"><span><span className="block text-[12px] text-muted-foreground">Primary on-call</span><b className="mt-1 block text-[15px] text-foreground">{nocOnCall.primary.name}</b><span className="text-[12px] text-muted-foreground">{nocOnCall.primary.role} · since {nocOnCall.primary.since}</span></span><span className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Shield size={18} /></span></div></div>
          <p className="text-[12px] text-muted-foreground">Next shift <b className="ml-1 text-foreground">{nocOnCall.nextShift}</b></p><ul className="flex flex-1 flex-col divide-y divide-border/60">{nocOnCall.escalations.map((contact) => <li key={contact.level} className="flex min-h-[42px] items-center gap-2"><Badge variant="outline" className="text-[12px]">{contact.level}</Badge><span className="min-w-0"><b className="block truncate text-[13px] text-foreground">{contact.name}</b><span className="block truncate text-[12px] text-muted-foreground">{contact.role}</span></span></li>)}</ul>
          <Button className="h-9 w-full gap-2 text-[13px]" onClick={() => setOnCallPaged(true)}><Bell size={15} />{onCallPaged ? "On-call paged" : "Page on-call"}</Button>{onCallPaged && <span role="status" className="text-center text-[12px] text-emerald-600">Demo page sent to {nocOnCall.primary.name}</span>}
        </div>
      </Panel>
    </section>

    {tvMode && <Button variant="outline" size="icon" className="fixed right-5 top-5 z-[10001] h-10 w-10 rounded-full shadow-lg" onClick={() => setTvMode(false)} aria-label="Exit full-screen TV mode"><X size={18} /></Button>}
  </div>;

  return tvMode ? <div className="fixed inset-0 z-[10000] overflow-y-auto bg-background p-5 md:p-6">{dashboard}</div> : dashboard;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/60 p-2.5"><span className="block text-[12px] text-muted-foreground">{label}</span><b className="mt-1 block text-[15px] tabular-nums text-foreground">{value}</b></div>;
}

function ServiceGlyph({ name }: { name: string }) {
  const Entry = name === "Databases" ? Database : name === "Web Servers" ? Server : name === "APIs" ? WorkflowGlyph : name === "Cache" ? HardDrive : name === "CDN" ? GlobeGlyph : SettingsGlyph;
  return <Entry size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />;
}
function WorkflowGlyph(props: React.ComponentProps<typeof Activity>) { return <Activity {...props} />; }
function GlobeGlyph(props: React.ComponentProps<typeof Activity>) { return <Wifi {...props} />; }
function SettingsGlyph(props: React.ComponentProps<typeof Activity>) { return <Gauge {...props} />; }

function CollectorStatus({ status }: { status: "Online" | "Stale" | "Offline" }) {
  const style = status === "Online" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : status === "Stale" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300";
  const StatusIcon = status === "Online" ? Check : status === "Stale" ? Clock3 : X;
  return <span className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-medium", style)}><StatusIcon size={12} />{status}</span>;
}

function CollectorSpark({ values, name }: { values: number[]; name: string }) {
  const width = 56, height = 16, min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const points = values.map((value, index) => [2 + index * ((width - 4) / Math.max(1, values.length - 1)), height - 2 - ((value - min) / range) * (height - 4)] as const);
  const path = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-4 w-14" role="img" aria-label={`${name} ingestion trend`}><path d={path} fill="none" stroke="#60a5fa" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}
