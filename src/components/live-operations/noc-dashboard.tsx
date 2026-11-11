"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts";
import {
  Activity, AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Check, CircleAlert, Clock3,
  Cpu, CreditCard, Database, Expand, Gauge, HardDrive, HeartPulse, Info, ListOrdered, MapPin, Network, Pause, Play, RefreshCw,
  Search,
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
  nocActiveAlerts, nocAlertMetrics, nocCollectorSummary, nocCollectors, nocFeedBufferedCount, nocFleet, nocHealth, nocHealthSegments,
  nocHealthRangeData, nocHealthTrendData, nocOnCall, nocOperationsFeed, nocOverallAvailability, nocRecentEvents, nocResourceUsage,
  nocServerGroups, nocServerGroupsSla, nocServiceAvailability, nocServiceAvailabilitySla, nocStats, nocTopIssues,
  type AlertSeverity, type FeedTone, type NocHealthChangeStatus, type NocHealthRange, type NocHealthTrendPoint,
  type NocResourceRange, type NocResourceTab, type TopIssueTab,
} from "@/data/mock/live-operations";
import { NOC_MAP_STATUS_COLOR, nocMapSites } from "@/data/mock/noc-map";

const NocOsmMap = dynamic(
  () => import("@/components/live-operations/noc-osm-map").then((mod) => mod.NocOsmMap),
  { ssr: false, loading: () => <div className="grid h-full min-h-[220px] animate-pulse place-items-center rounded-lg bg-muted text-[12px] text-muted-foreground">Loading OpenStreetMap…</div> },
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
const HEALTH_CHANGE_LABEL: Record<NocHealthChangeStatus, string> = {
  offline: "went offline",
  degraded: "degraded",
  recovered: "recovered",
};
const HEALTH_CHANGE_COLOR: Record<NocHealthChangeStatus, string> = {
  offline: "#ef4444",
  degraded: "#f59e0b",
  recovered: "#22c55e",
};
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

function EChart({ option, className = "", ariaLabel = "Interactive monitoring chart" }: { option: echarts.EChartsOption; className?: string; ariaLabel?: string }) {
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
  return <div ref={host} className={cn("h-full min-h-[220px] min-w-0 flex-1", className)} aria-label={ariaLabel} role="img" />;
}

function Donut({ data, total, label, size = 132, centerValue, centerLabel, centerValueClassName, cutout = 71 }: { data: Array<{ name: string; value: number; color: string }>; total: number; label: string; size?: number; centerValue?: string; centerLabel?: string; centerValueClassName?: string; cutout?: number }) {
  let start = 0;
  const stops = data.map((item) => {
    const end = start + (total ? item.value / total : 0) * 100;
    const segment = `${item.color} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${total}`}>
    <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${stops.join(",")})`, mask: `radial-gradient(farthest-side, transparent ${cutout}%, #000 ${cutout + 1}%)`, WebkitMask: `radial-gradient(farthest-side, transparent ${cutout}%, #000 ${cutout + 1}%)` }} />
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className={cn("font-display text-[24px] font-bold leading-none tabular-nums text-foreground", centerValueClassName)}>{centerValue ?? total}</b><span className="mt-1 text-[12px] text-muted-foreground">{centerLabel ?? label}</span></div>
  </div>;
}

function HealthSegmentsLegend({ data, total, onStatusSelect }: {
  data: Array<{ name: string; status: string; value: number; color: string; servers: string[] }>;
  total: number;
  onStatusSelect: (status: string, servers: string[]) => void;
}) {
  const StatusIcon = ({ status }: { status: string }) =>
    status === "Healthy" ? <Check size={13} aria-hidden="true" /> : status === "Degraded" ? <Info size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />;
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-[12px] text-muted-foreground">{total} Servers</p>
      <div className="flex flex-col" aria-label="Server health breakdown">
        {data.map((segment) => {
          const names = segment.servers;
          const visibleNames = names.slice(0, 2).join(", ");
          const extraCount = Math.max(0, names.length - 2);
          const description = segment.status === "Healthy"
            ? `${segment.value} servers up`
            : `${visibleNames}${extraCount ? ` +${extraCount} more` : ""}`;
          return (
            <div key={segment.name} className="relative group">
              <button
                type="button"
                onClick={() => onStatusSelect(segment.status, names)}
                aria-describedby={`health-segment-${segment.status.toLowerCase()}-tooltip`}
                aria-label={`Filter ${segment.value} ${segment.status} servers: ${names.join(", ")}`}
                className="grid h-9 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md text-left text-[12px] hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex min-w-0 flex-col justify-center">
                  <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap font-medium text-slate-500 dark:text-slate-400">
                    <span style={{ color: segment.color }}><StatusIcon status={segment.status} /></span>
                    <span className="truncate">{segment.name}</span>
                  </span>
                  <span className="truncate text-[12px] leading-4 text-slate-500 dark:text-slate-400">{description}</span>
                </span>
                <b className="text-right font-bold tabular-nums text-foreground">{segment.value}</b>
                <span className="min-w-10 text-right tabular-nums text-slate-500 dark:text-slate-400">{total ? Math.round(segment.value / total * 100) : 0}%</span>
              </button>
              <span id={`health-segment-${segment.status.toLowerCase()}-tooltip`} role="tooltip" className="pointer-events-none absolute left-0 top-full z-10 hidden max-w-full rounded-md bg-slate-900 px-2 py-1 text-[12px] text-white shadow-md group-hover:block group-focus-within:block">
                {segment.status} servers: {names.join(", ")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-[12px] text-muted-foreground">{children}</div>;
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <span className="block whitespace-nowrap text-[16px] font-semibold leading-6 text-foreground">{children}</span>;
}

function statusForAvailability(value: number, sla: number) {
  if (value >= sla) return { color: "#34d399", label: "Healthy" };
  if (value >= sla - 0.3) return { color: "#fbbf24", label: "Warning" };
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

function buildHealthTrendOption(data: NocHealthTrendPoint[], isDark: boolean): echarts.EChartsOption {
  const axisColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const markerColor = isDark ? "#e2e8f0" : "#1e293b";
  return {
    animationDuration: 300,
    grid: { left: 34, right: 12, top: 26, bottom: 22 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross", lineStyle: { color: axisColor, type: "dashed" } },
      backgroundColor: isDark ? "#0f172a" : "#fff",
      borderColor: gridColor,
      textStyle: { color: isDark ? "#e2e8f0" : "#1e293b", fontSize: 12 },
      extraCssText: "border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14);",
      formatter: (items: unknown) => {
        const points = items as Array<{ axisValue?: string }>;
        const point = data.find((item) => item.time === points[0]?.axisValue);
        if (!point) return "";
        return `<b>${point.time}</b><br/>Health: <b>${point.health}%</b><br/>Healthy ${point.healthy} · Degraded ${point.degraded} · Offline ${point.offline}`;
      },
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: data.map((point) => point.time),
      axisLabel: { color: axisColor, fontSize: 12, interval: 1, margin: 8, hideOverlap: true },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      min: 80,
      max: 100,
      interval: 10,
      axisLabel: { color: axisColor, fontSize: 12, formatter: (value: number) => `${value}%` },
      splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
      axisLine: { show: false },
    },
    series: [{
      name: "Health",
      type: "line",
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2, color: "#3b82f6" },
      itemStyle: { color: "#3b82f6" },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(59,130,246,0.28)" }, { offset: 1, color: "rgba(59,130,246,0.02)" }]) },
      data: data.map((point) => point.health),
      markPoint: {
        symbol: "circle",
        symbolSize: 8,
        label: { show: true, position: "top", formatter: "{b}", fontSize: 12, color: markerColor, backgroundColor: isDark ? "#1e293b" : "#fff", borderRadius: 4, padding: [2, 4] },
        data: data.filter((point) => point.eventLabel).map((point) => ({
          name: point.eventLabel,
          coord: [point.time, point.health],
          itemStyle: { color: point.eventTone === "amber" ? "#f59e0b" : "#ef4444" },
        })),
      },
    }],
  };
}

export function LiveOperationsNoc() {
  const dark = useDarkMode();
  const [resourceTab, setResourceTab] = useState<NocResourceTab>("cpu");
  const [resourceRange, setResourceRange] = useState<NocResourceRange>("15m");
  const [topIssueTab, setTopIssueTab] = useState<TopIssueTab>("cpu");
  const [healthRange, setHealthRange] = useState<NocHealthRange>("24h");
  const [autoRefresh, setAutoRefresh] = useState("30s");
  const [paused, setPaused] = useState(false);
  const [feedPaused, setFeedPaused] = useState(false);
  const [feedFilter, setFeedFilter] = useState<"all" | "critical" | "warning" | "info" | "success">("all");
  const [alertFilter, setAlertFilter] = useState<"all" | AlertSeverity>("all");
  const [alertGroupFilter, setAlertGroupFilter] = useState<string | null>(null);
  const [healthStatusFilter, setHealthStatusFilter] = useState<{ status: string; servers: string[] } | null>(null);
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
  const serverGroupStats = useMemo(() => nocServerGroups.map((group) => ({
    ...group,
    alerts: activeAlerts.filter((alert) => alert.groupId === group.id),
  })), [activeAlerts]);
  const serverGroupTotal = nocServerGroups.reduce((sum, group) => sum + group.value, 0);
  const serverGroupAlertCount = serverGroupStats.reduce((sum, group) => sum + group.alerts.length, 0);
  const healthiestGroup = serverGroupStats.reduce((best, group) => group.health > best.health ? group : best, serverGroupStats[0]);
  const attentionGroup = serverGroupStats.reduce((worst, group) => group.health < worst.health ? group : worst, serverGroupStats[0]);
  const averageGroupHealth = serverGroupStats.length
    ? Number((serverGroupStats.reduce((sum, group) => sum + group.health, 0) / serverGroupStats.length).toFixed(1))
    : 0;
  const healthMetrics = nocHealthRangeData[healthRange];
  const healthTrendData = nocHealthTrendData[healthRange];
  const healthTrendOption = useMemo(() => buildHealthTrendOption(healthTrendData, dark), [healthTrendData, dark]);
  const recentHealthChanges = useMemo(() => {
    const alertChanges = activeAlerts.flatMap((alert) => alert.healthChange ? [{
      id: alert.id,
      server: alert.detail,
      status: alert.healthChange,
      ageMinutes: alert.ageMinutes,
      time: `${alert.ageMinutes}m ago`,
    }] : []);
    const eventChanges = nocRecentEvents.flatMap((event) => event.healthChange && event.ageMinutes != null ? [{
      id: `${event.detail}-${event.time}`,
      server: event.detail,
      status: event.healthChange,
      ageMinutes: event.ageMinutes,
      time: event.time,
    }] : []);
    return [...alertChanges, ...eventChanges].sort((a, b) => a.ageMinutes - b.ageMinutes).slice(0, 3);
  }, [activeAlerts]);
  const statData = nocStats.map((stat) => {
    if (stat.label === "Critical Alerts") return { ...stat, value: `${criticalCount}` };
    if (stat.label === "Active Incidents") return { ...stat, value: `${healthMetrics.openIncidents}`, change: `${healthMetrics.newIncidents} new` };
    return stat;
  });
  const visibleAlerts = activeAlerts.filter((alert) =>
    (alertFilter === "all" || alert.severity === alertFilter) &&
    (!alertGroupFilter || alert.groupId === alertGroupFilter) &&
    (!healthStatusFilter || healthStatusFilter.servers.includes(alert.detail)),
  );
  const unacknowledgedAlerts = activeAlerts.filter((alert) => !acknowledged[alert.id]);
  const oldestAlertMinutes = Math.max(0, ...unacknowledgedAlerts.map((alert) => alert.ageMinutes));
  const resourceData = useMemo(() => nocResourceUsage[resourceTab].slice(-RANGE_COUNT[resourceRange]), [resourceTab, resourceRange]);
  const chartOption = useMemo(() => buildResourceOption(resourceData, resourceTab, dark), [resourceData, resourceTab, dark]);
  const chartSummary = (chartOption as echarts.EChartsOption & { __nocSummary: { now: number; average: number; peak: number; loadAverage: number } }).__nocSummary;
  const mapSites = nocMapSites;
  const mapServerCount = mapSites.reduce((total, site) => total + site.servers.length, 0);
  const mapIssueCount = mapSites.filter((site) => site.status !== "online").length;
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const handleSelectSite = useCallback((site: (typeof mapSites)[number]) => {
    setSelectedSiteId((current) => (current === site.id ? null : site.id));
  }, []);
  const worstSites = useMemo(() => {
    const ranked = mapSites.slice().sort((a, b) => a.health - b.health);
    const selected = selectedSiteId ? ranked.find((site) => site.id === selectedSiteId) : undefined;
    // Keep the selected site visible in the list even when it is not among the worst.
    if (!selected) return ranked.slice(0, 3);
    return [selected, ...ranked.filter((site) => site.id !== selected.id)].slice(0, 3);
  }, [mapSites, selectedSiteId]);
  const healthLegend = nocHealthSegments;
  const healthServerTotal = healthLegend.reduce((sum, segment) => sum + segment.value, 0);
  const UptimeTrendIcon = healthMetrics.uptimeTrend >= 0 ? ArrowUpRight : ArrowDownRight;
  const PeriodTrendIcon = healthMetrics.trendDirection === "up" ? ArrowUpRight : ArrowDownRight;
  const updatedSecondsAgo = Math.max(0, Math.floor((clock.getTime() - lastUpdated.getTime()) / 1000));
  const serviceHealthRows = nocServiceAvailability;
  const filterAlertsByStatus = (status: string, servers: string[]) => {
    setAlertFilter("all");
    setHealthStatusFilter({ status, servers });
    document.getElementById("noc-active-alerts")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
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
        <span suppressHydrationWarning className="hidden items-center gap-1.5 whitespace-nowrap text-[12px] tabular-nums text-muted-foreground lg:flex"><Clock3 size={14} />{localeClock} PKT</span>
        <Button variant="outline" className="h-9 gap-1.5 px-3 text-[12px]" onClick={() => setTvMode((value) => !value)} aria-label={tvMode ? "Exit full-screen TV mode" : "Enter full-screen TV mode"}><Expand size={14} />{tvMode ? "Exit TV" : "Full screen"}</Button>
      </div>}
    />

    {healthMetrics.openIncidents > 0 || criticalCount > 0 ? <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200" role="status">
      <div className="flex items-center gap-2"><Siren size={17} /><b>{healthMetrics.openIncidents} active incidents</b><span className="text-red-700/80 dark:text-red-200/80">· {criticalCount} critical alerts</span></div>
      <Button variant="outline" className="h-8 border-red-200 bg-white px-3 text-[12px] text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-transparent dark:text-red-200" asChild><a href="/alerts">View incidents <ArrowRight className="ml-1" size={13} /></a></Button>
    </div> : null}

    {refreshing ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6" aria-label="Loading metrics">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[108px] animate-pulse rounded-xl border bg-card" />)}</div> : <section aria-label="Key metrics" className="grid grid-cols-2 items-stretch gap-4 sm:grid-cols-3 xl:grid-cols-6">
      {statData.map((item) => <StatCard key={item.label} icon={<Icon name={item.icon} size={21} />} label={item.label} value={item.value} trend={item.change} iconTone={item.tone === "green" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300" : item.tone === "amber" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300" : item.tone === "red" ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300" : "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"} className="h-[108px]" />)}
    </section>}

    <section aria-label="NOC overview" className="grid items-stretch gap-4 xl:grid-cols-3">
      <Panel title={<PanelTitle>Infrastructure Health</PanelTitle>} className="min-h-[390px] p-4" headerClassName="h-10" action={<Segmented value={healthRange} options={[{ value: "24h", label: "24h" }, { value: "7d", label: "7d" }, { value: "30d", label: "30d" }]} onChange={setHealthRange} label="Health time range" />}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 items-start gap-3 pt-1">
            <div className="flex w-[150px] shrink-0 flex-col items-center gap-1">
              <Donut data={healthLegend} total={healthServerTotal} label={`Current infrastructure health ${nocHealth.score}%`} size={130} cutout={72} centerValue={`${nocHealth.score}%`} centerLabel="Health" />
              <div className="inline-flex items-center gap-1 whitespace-nowrap text-[12px]" aria-label={`Now, ${healthMetrics.trend}% ${healthMetrics.trendDirection} ${healthMetrics.comparison}`}>
                <span className="text-muted-foreground">Now ·</span>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold", healthMetrics.trendDirection === "up" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300")}>
                  <PeriodTrendIcon size={13} aria-hidden="true" />{healthMetrics.trend}% {healthMetrics.comparison}
                </span>
              </div>
            </div>
            <HealthSegmentsLegend data={healthLegend} total={healthServerTotal} onStatusSelect={filterAlertsByStatus} />
          </div>
          <section className="my-2 flex min-h-[185px] min-w-0 flex-1 flex-col border-y border-border py-2" aria-label={`Health trend and recent changes for ${healthRange}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[12px] font-semibold text-foreground">Health trend ({healthRange})</h3>
              <span className="text-[12px] text-muted-foreground">Zoomed axis</span>
            </div>
            <EChart option={healthTrendOption} className="!min-h-[70px] !max-h-[80px] w-full" ariaLabel={`Infrastructure health trend for ${healthRange}, from 80 to 100 percent`} />
            <div className="mt-1 flex min-h-0 flex-1 flex-col" aria-label="Recent health changes">
              <h3 className="mb-1 text-[12px] font-semibold text-foreground">Recent changes</h3>
              <ul className="flex flex-1 flex-col justify-between" aria-label="Recent server health changes">
                {recentHealthChanges.length ? recentHealthChanges.map((change) => (
                  <li key={change.id} className="min-h-6">
                    <button
                      type="button"
                      onClick={() => filterAlertsByStatus(change.status, [change.server])}
                      aria-label={`Show alerts for ${change.server}, ${HEALTH_CHANGE_LABEL[change.status]}, ${change.time}`}
                      className="flex h-6 w-full min-w-0 items-center gap-2 rounded-md text-left text-[12px] hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <time className="w-12 shrink-0 text-[12px] tabular-nums text-muted-foreground">{change.time}</time>
                      <span className="h-2 w-2 shrink-0 rounded-full" aria-hidden="true" style={{ backgroundColor: HEALTH_CHANGE_COLOR[change.status] }} />
                      <span className="min-w-0 truncate text-foreground">{change.server} {HEALTH_CHANGE_LABEL[change.status]}</span>
                    </button>
                  </li>
                )) : <li className="text-[12px] text-muted-foreground">No recent health changes</li>}
              </ul>
            </div>
          </section>
          <div className="mt-auto grid grid-cols-3 gap-2 pt-2" aria-label={`${healthRange} infrastructure metrics`}>
            <div className="min-w-0 rounded-lg bg-[#F8F9FB] p-2.5 dark:bg-slate-800/60">
              <span className="block text-[12px] text-muted-foreground">Avg Uptime</span>
              <b className="mt-1 block text-[16px] font-bold leading-tight tabular-nums text-foreground">{healthMetrics.averageUptime.toFixed(1)}%</b>
              <span className={cn("mt-1 inline-flex items-center gap-1 text-[12px]", healthMetrics.uptimeTrend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                <UptimeTrendIcon size={12} aria-hidden="true" />{Math.abs(healthMetrics.uptimeTrend).toFixed(1)}%
              </span>
            </div>
            <div className="min-w-0 rounded-lg bg-[#F8F9FB] p-2.5 dark:bg-slate-800/60">
              <span className="block text-[12px] text-muted-foreground">Open Incidents</span>
              <b className="mt-1 block text-[16px] font-bold leading-tight tabular-nums text-foreground">{healthMetrics.openIncidents}</b>
              <span className="mt-1 block text-[12px] text-muted-foreground">{healthMetrics.newIncidents} new</span>
            </div>
            <div className="min-w-0 rounded-lg bg-[#F8F9FB] p-2.5 dark:bg-slate-800/60">
              <span className="block text-[12px] text-muted-foreground">MTTR</span>
              <b className="mt-1 block text-[16px] font-bold leading-tight tabular-nums text-foreground">{healthMetrics.mttrMinutes}m</b>
            </div>
          </div>
          <CardFooter>
            <span>Updated {updatedSecondsAgo}s ago</span>
            <a href="/all-servers" className="group inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-semibold text-[#2563EB] hover:underline">
              View servers
              <ArrowRight size={16} strokeWidth={2} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
            </a>
          </CardFooter>
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

      <Panel
        title={<PanelTitle>Infrastructure Map</PanelTitle>}
        className="min-h-[470px] p-4"
        headerClassName="h-10"
        showOptions={false}
        action={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[12px]">{mapSites.length} sites · {mapServerCount} servers</Badge>
            <button
              type="button"
              onClick={() => setIssuesOnly((value) => !value)}
              aria-pressed={issuesOnly}
              title={issuesOnly ? "Showing only sites with issues - click to show all" : "Show only sites with issues"}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                issuesOnly
                  ? "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
                  : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
              )}
            >
              <CircleAlert size={12} aria-hidden="true" />
              {mapIssueCount} Issue{mapIssueCount === 1 ? "" : "s"}
            </button>
          </div>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="min-h-[360px] flex-1 overflow-hidden rounded-lg"><NocOsmMap sites={mapSites} filterStatuses={issuesOnly ? ["warning", "critical"] : null} selectedSiteId={selectedSiteId} onSelectSite={handleSelectSite} /></div>
          <div className="flex items-center justify-between gap-2 text-[12px]"><b className="text-foreground">Worst locations</b><span className="text-muted-foreground">Status by site</span></div>
          <div className="grid grid-cols-3 gap-2">{worstSites.map((site) => {
            const selected = site.id === selectedSiteId;
            return (
              <button
                key={site.id}
                type="button"
                onClick={() => handleSelectSite(site)}
                aria-pressed={selected}
                title={`${site.code} — ${site.city}: ${site.health}%`}
                className={cn(
                  "min-w-0 rounded-lg px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected ? "bg-primary/10 ring-1 ring-primary/50" : "bg-muted/60 hover:bg-muted",
                )}
              >
                <span className="block truncate text-[12px] font-medium text-foreground">{site.code} — {site.city}</span>
                <span className="flex items-center gap-1 text-[12px] tabular-nums text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: NOC_MAP_STATUS_COLOR[site.status] }} />
                  {site.health}%
                </span>
              </button>
            );
          })}</div>
        </div>
      </Panel>
    </section>

    <section aria-label="Alerts and availability" className="grid items-stretch gap-4 xl:grid-cols-3">
      <Panel title={<PanelTitle>Active Alerts</PanelTitle>} className="min-h-[370px] p-4" headerClassName="h-10" action={<a href="/alerts" className="text-[12px] font-medium text-primary hover:underline">View all <ArrowRight className="ml-1 inline" size={13} /></a>}>
        <div id="noc-active-alerts" className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex flex-wrap items-center gap-1.5 pb-2 text-[12px] text-muted-foreground" aria-label="Active alert summary"><span>Unacknowledged <b className="text-foreground">{unacknowledgedAlerts.length}</b></span><span>·</span><span>Oldest <b className="text-foreground">{oldestAlertMinutes}m</b></span><span>·</span><span>MTTA <b className="text-foreground">{nocAlertMetrics.mttaMinutes}m</b></span></div>
          {(healthStatusFilter || alertGroupFilter) && <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
            {healthStatusFilter && <span>Server status: {healthStatusFilter.status}</span>}
            {alertGroupFilter && <span>Group: {nocServerGroups.find((group) => group.id === alertGroupFilter)?.name}</span>}
            <button type="button" onClick={() => { setHealthStatusFilter(null); setAlertGroupFilter(null); }} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-primary hover:bg-primary/10" aria-label="Clear alert filters"><X size={12} aria-hidden="true" />Clear</button>
          </div>}
          <ul className="flex flex-1 flex-col divide-y divide-border/70" aria-label="Active alerts">{visibleAlerts.length ? visibleAlerts.map((alert) => { const tone = STATUS[alert.severity]; const StatusIcon = tone.Icon; const ackedBy = acknowledged[alert.id]; return <li key={alert.id} className={cn("flex min-h-[58px] items-center gap-2 py-2", ackedBy && "rounded-md bg-muted/50 px-2 text-muted-foreground")}><span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[12px] font-semibold", tone.badge)}><StatusIcon size={12} />{tone.label}</span><span className="min-w-0 flex-1"><b className={cn("block truncate text-[13px] font-medium", ackedBy ? "text-muted-foreground" : "text-foreground")} title={alert.title}>{alert.title}</b><span className="block truncate text-[12px] text-muted-foreground">{ackedBy ? `Acknowledged by ${ackedBy} · ${nocAlertMetrics.acknowledgedAgo}` : alert.detail}</span></span><span className="flex shrink-0 flex-col items-end gap-1"><time className="text-[12px] tabular-nums text-muted-foreground">{alert.time}</time><span className="flex gap-1"><button type="button" disabled={Boolean(ackedBy)} onClick={() => setAcknowledged((items) => ({ ...items, [alert.id]: nocAlertMetrics.acknowledgedBy }))} className="h-[26px] cursor-pointer rounded-md border border-border bg-background px-2 text-[12px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-default disabled:opacity-50" aria-label={`Acknowledge ${alert.title}`}>Ack</button><button type="button" onClick={() => setSnoozed((items) => items.includes(alert.id) ? items : [...items, alert.id])} className="h-[26px] cursor-pointer rounded-md border border-border bg-background px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:border-amber-400/50 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30" aria-label={`Snooze ${alert.title}`}>Snooze</button></span></span></li>; }) : <li className="grid flex-1 place-items-center py-8 text-center text-[13px] text-muted-foreground"><span>{alertGroupFilter ? `No active alerts for ${nocServerGroups.find((group) => group.id === alertGroupFilter)?.name ?? "this group"}` : "All clear, no active alerts"}</span></li>}</ul>
          <CardFooter><span>Showing {visibleAlerts.length} of {activeAlerts.length} alerts</span><span className="flex items-center gap-1"><b className="text-red-600">{criticalCount} critical</b><span>·</span><b className="text-amber-600">{activeAlerts.filter((a) => a.severity === "high").length} warning</b></span></CardFooter>
        </div>
      </Panel>

      <Panel title={<PanelTitle>Service Availability</PanelTitle>} className="min-h-[370px] p-4" headerClassName="h-10" action={<div className="flex items-center gap-2 whitespace-nowrap text-[12px] text-muted-foreground"><span>Scale 99–100%</span><span className="rounded-full bg-muted px-2 py-0.5 text-[12px] text-muted-foreground">SLA {nocServiceAvailabilitySla}%</span></div>}>
        <div className="flex min-h-0 flex-1 flex-col">
          <ul className="flex flex-1 flex-col justify-between divide-y divide-border/60">{serviceHealthRows.map((service) => { const status = statusForAvailability(service.value, nocServiceAvailabilitySla); const width = Math.max(0, Math.min(100, (service.value - 99) * 100)); const markerPosition = Math.max(0, Math.min(100, (nocServiceAvailabilitySla - 99) * 100)); return <li key={service.name} className="grid h-[44px] shrink-0 grid-cols-[minmax(0,1fr)_minmax(70px,1.5fr)_auto] items-center gap-3"><span className="flex min-w-0 items-center gap-2 text-[13px] text-foreground"><ServiceGlyph name={service.name} /><span className="truncate">{service.name}</span></span><div className="relative h-2 rounded-full bg-muted" role="progressbar" aria-label={`${service.name} availability`} aria-valuenow={service.value} aria-valuemin={99} aria-valuemax={100}><span className="absolute inset-y-[-2px] z-[1] w-[1.5px] rounded-full bg-[#94A3B8] opacity-90 dark:bg-[#64748B]" style={{ left: `${markerPosition}%` }} title={`SLA target ${nocServiceAvailabilitySla}%`} /><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${width}%`, backgroundColor: status.color }} /></div><b className="min-w-[50px] text-right text-[13px] tabular-nums text-foreground">{service.value}%</b></li>; })}</ul>
          <CardFooter><span>Overall availability</span><b className="text-foreground">{nocOverallAvailability}%</b></CardFooter>
        </div>
      </Panel>

      <Panel title={<PanelTitle>Server Groups</PanelTitle>} className="min-h-[370px] p-4" headerClassName="h-10">
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-between gap-3">
            <Donut
              data={nocServerGroups}
              total={serverGroupTotal}
              label="Servers"
              size={160}
              cutout={72}
              centerValue={`${serverGroupTotal}`}
              centerLabel="Servers"
              centerValueClassName="text-[28px]"
            />
            <div className="min-w-0 w-full overflow-x-auto" role="region" aria-label="Server groups breakdown">
              <div className="min-w-[324px]">
              <div className="grid grid-cols-[minmax(0,1fr)_64px_56px_84px_56px] gap-x-2 border-b border-border/70 pb-1 text-[12px] font-medium text-muted-foreground" aria-hidden="true">
                <span className="whitespace-nowrap">Group</span><span className="whitespace-nowrap text-right">Servers</span><span className="whitespace-nowrap text-right">Share</span><span className="whitespace-nowrap text-right">Health</span><span className="whitespace-nowrap text-right">Alerts</span>
              </div>
              <div className="divide-y divide-border/60">
                {[...serverGroupStats].sort((a, b) => a.health - b.health).map((group) => {
                  const healthTone = group.health >= 99
                    ? { color: "text-emerald-600 dark:text-emerald-400", Icon: Check, label: "Healthy" }
                    : group.health >= 98
                      ? { color: "text-amber-600 dark:text-amber-400", Icon: Info, label: "Needs attention" }
                      : { color: "text-red-600 dark:text-red-400", Icon: X, label: "Critical health" };
                  const HealthIcon = healthTone.Icon;
                  const share = serverGroupTotal
                    ? (group.value / serverGroupTotal) * 100
                    : 0;
                  const alertTone = group.alerts.some((alert) => alert.severity === "critical")
                    ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300";
                  return (
                    <div key={group.id} className="group relative">
                      <button
                        type="button"
                        aria-describedby={`server-group-tooltip-${group.id}`}
                        onClick={() => {
                          setAlertGroupFilter(group.id);
                          setHealthStatusFilter(null);
                          document.getElementById("noc-active-alerts")?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        aria-label={`${group.name}, ${group.value} servers, ${share.toFixed(0)}% share, ${group.health}% health, ${group.alerts.length} alerts. Average CPU ${group.avgCpu}%, memory ${group.avgMemory}%, last incident ${group.lastIncident}. Show this group's alerts.`}
                        className="grid h-10 w-full grid-cols-[minmax(0,1fr)_64px_56px_84px_56px] items-center gap-x-2 text-left text-[12px] hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                          <span className="truncate text-foreground">{group.name}</span>
                        </span>
                        <b className="text-right font-bold tabular-nums text-foreground">{group.value}</b>
                        <span className="text-right tabular-nums text-muted-foreground">{share.toFixed(0)}%</span>
                        <span className={cn("flex items-center justify-end gap-1 font-semibold tabular-nums", healthTone.color)} aria-label={`${healthTone.label} health`}>
                          <HealthIcon size={14} strokeWidth={2.5} aria-hidden="true" />{group.health}%
                        </span>
                        <span className="flex justify-end">
                          {group.alerts.length === 0
                            ? <span className="text-muted-foreground" aria-label="No alerts">—</span>
                            : <span className={cn("rounded px-1.5 py-0.5 font-semibold tabular-nums", alertTone)} aria-label={`${group.alerts.length} active alerts`}>{group.alerts.length}</span>}
                        </span>
                      </button>
                      <div className="h-[3px] bg-muted" role="progressbar" aria-label={`${group.name} server share`} aria-valuenow={Math.round(share)} aria-valuemin={0} aria-valuemax={100}>
                        <div className="h-full" style={{ width: `${share}%`, backgroundColor: group.color }} />
                      </div>
                      <span id={`server-group-tooltip-${group.id}`} role="tooltip" className="pointer-events-none absolute left-0 top-full z-10 hidden rounded-md bg-slate-900 px-2 py-1 text-[12px] text-white shadow-md group-hover:block group-focus-within:block">
                        Avg CPU {group.avgCpu}% · Memory {group.avgMemory}% · Last incident {group.lastIncident}
                      </span>
                    </div>
                  );
                })}
              </div>
              </div>
            </div>
          </div>
          <div className="mt-auto grid grid-cols-3 gap-2">
            <div className="min-w-0 rounded-lg bg-[#f8f9fb] p-2.5 dark:bg-[#1c2b40]">
              <span className="block text-[12px] text-muted-foreground">Healthiest group</span>
              <b className="mt-1 block truncate whitespace-nowrap text-[15px] font-bold leading-tight text-foreground" title={`${healthiestGroup.name} ${healthiestGroup.health}%`}>{healthiestGroup.name} {healthiestGroup.health}%</b>
              <span className="mt-1 block truncate text-[12px] text-muted-foreground">
                {healthiestGroup.alerts.length} alerts · {healthiestGroup.alerts.filter((alert) => alert.severity === "critical").length === 0 ? "none critical" : `${healthiestGroup.alerts.filter((alert) => alert.severity === "critical").length} critical`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAlertGroupFilter(attentionGroup.id);
                setHealthStatusFilter(null);
                document.getElementById("noc-active-alerts")?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              aria-label={`Show ${attentionGroup.name} alerts`}
              className="min-w-0 rounded-lg bg-[#f8f9fb] p-2.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-[#1c2b40] dark:hover:bg-muted"
            >
              <span className="block text-[12px] text-muted-foreground">Needs attention</span>
              <b className="mt-1 block truncate whitespace-nowrap text-[15px] font-bold leading-tight text-foreground" title={`${attentionGroup.name} ${attentionGroup.health}%`}>{attentionGroup.name} {attentionGroup.health}%</b>
              <span className="mt-1 block truncate text-[12px] text-muted-foreground">
                {attentionGroup.alerts.length
                  ? `${attentionGroup.alerts.length} alert${attentionGroup.alerts.length === 1 ? "" : "s"} · since ${Math.max(...attentionGroup.alerts.map((alert) => alert.ageMinutes))}m`
                  : "No active alerts"}
              </span>
            </button>
            <div className="min-w-0 rounded-lg bg-[#f8f9fb] p-2.5 dark:bg-[#1c2b40]">
              <span className="block text-[12px] text-muted-foreground">Open alerts</span>
              <b className="mt-1 block truncate whitespace-nowrap text-[15px] font-bold leading-tight text-foreground">{serverGroupAlertCount}</b>
            </div>
          </div>
          <CardFooter>
            <span>Avg group health {averageGroupHealth}% · SLA {nocServerGroupsSla}%</span>
            <b className="shrink-0 text-foreground">{nocServerGroups.length} groups · {serverGroupTotal} servers</b>
          </CardFooter>
        </div>
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
  const Entry = name === "Databases" ? Database : name === "Web Servers" ? Server : name === "APIs" ? WorkflowGlyph : name === "Cache" ? HardDrive : name === "CDN" ? GlobeGlyph : name === "Load Balancers" ? Network : name === "Payment Gateway" ? CreditCard : name === "Message Queue" ? ListOrdered : name === "Search" ? Search : SettingsGlyph;
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
