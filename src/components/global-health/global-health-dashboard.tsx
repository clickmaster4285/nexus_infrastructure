"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { ArrowRight, ArrowUpRight, Check, CircleCheck, CircleX, Clock3, TriangleAlert } from "lucide-react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { Icon, TechLogo } from "@/components/shared/icon";
import { Panel } from "@/components/shared/panel";
import { MetricCard } from "@/components/shared/metric-card";
import { cn } from "@/lib/utils";
import { healthLocations, healthMapSites } from "@/data/mock/health-locations";
import {
  componentHealth, componentHealthHistory, environmentHealth, environmentHealthHistory, globalCollectors, globalHealthRangeIntervalMinutes, globalHealthStats, globalHealthTrendByRange,
  healthScore, recentHealthChanges, resourceHealth, SLA_TARGET, statusColors, statusForHealth,
  topHealthyServices, totalHealthyServices,
} from "@/data/mock/global-health";
import type { GlobalHealthTrendRange } from "@/data/mock/global-health";
import { formatNocIngestionRate } from "@/data/mock/live-operations";

const NocOsmMap = dynamic(
  () => import("@/components/live-operations/noc-osm-map").then((mod) => mod.NocOsmMap),
  { ssr: false, loading: () => <div className="grid h-full min-h-[220px] animate-pulse place-items-center rounded-lg bg-slate-100 text-[12px] text-slate-500 dark:bg-slate-800">Loading map…</div> },
);

function EChart({ option, label, className, apiRef }: { option: EChartsOption; label: string; className?: string; apiRef?: React.RefObject<echarts.ECharts | null> }) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    setReady(false);
    setError(false);
    let disposed = false;
    let instance: echarts.ECharts | null = null;
    const mount = () => {
      if (disposed || instance || node.clientWidth <= 0 || node.clientHeight <= 0) return;
      try {
        instance = echarts.init(node, undefined, { renderer: "canvas" });
        instance.setOption(option, { notMerge: true, lazyUpdate: true });
        chart.current = instance;
        if (apiRef) apiRef.current = instance;
        setReady(true);
      } catch {
        setError(true);
      }
    };
    const resizeObserver = new ResizeObserver(() => {
      mount();
      instance?.resize();
    });
    resizeObserver.observe(node);
    const hideTip = () => chart.current?.dispatchAction({ type: "hideTip" });
    node.addEventListener("mouseleave", hideTip);
    mount();
    return () => {
      disposed = true;
      node.removeEventListener("mouseleave", hideTip);
      resizeObserver.disconnect();
      instance?.dispose();
      if (chart.current === instance) chart.current = null;
      if (apiRef && apiRef.current === instance) apiRef.current = null;
    };
  }, [option, retry]);

  return (
    <div className={cn("relative min-h-[220px] min-w-0 flex-1", className)}>
      <div ref={host} role="img" aria-label={label} className="absolute inset-0 h-full w-full" />
      {!ready && !error && <div className="absolute inset-0 animate-pulse rounded-md bg-slate-100/80 dark:bg-slate-800/60" aria-label="Loading chart" />}
      {error && <div className="absolute inset-0 grid place-items-center rounded-md bg-slate-50 text-center text-[12px] text-slate-600 dark:bg-slate-900 dark:text-slate-300"><div>Chart could not load<button onClick={() => setRetry((n) => n + 1)} className="ml-2 cursor-pointer font-semibold text-primary underline">Retry</button></div></div>}
    </div>
  );
}

const dark = (isDark: boolean) => ({
  text: isDark ? "#cbd5e1" : "#64748B",
  axis: isDark ? "#475569" : "#dbe3ee",
  tooltipBg: isDark ? "#111827" : "#ffffff",
  tooltipText: isDark ? "#e2e8f0" : "#1E293B",
});

function useDarkMode() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

function StatusIcon({ value, size = 14 }: { value: number; size?: number }) {
  const status = statusForHealth(value);
  if (status === "healthy") return <CircleCheck size={size} className="shrink-0 text-emerald-500" aria-label="Healthy" />;
  if (status === "warning") return <TriangleAlert size={size} className="shrink-0 text-amber-500" aria-label="Warning" />;
  return <CircleX size={size} className="shrink-0 text-rose-500" aria-label="Critical" />;
}

function ResourceUsageStatus({ value, size = 14 }: { value: number; size?: number }) {
  if (value < 70) return <Check size={size} className="shrink-0 text-emerald-500" aria-label="Normal usage" />;
  if (value <= 85) return <TriangleAlert size={size} className="shrink-0 text-amber-500" aria-label="Elevated usage" />;
  return <CircleX size={size} className="shrink-0 text-rose-500" aria-label="High usage" />;
}

function CollectorState({ status }: { status: "healthy" | "stale" | "down" }) {
  if (status === "healthy") return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[12px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><Check size={12} aria-hidden="true" />Up</span>;
  if (status === "stale") return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[12px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><Clock3 size={12} aria-hidden="true" />Stale</span>;
  return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[12px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"><CircleX size={12} aria-hidden="true" />Down</span>;
}

function ComponentSparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 50;
    const y = 17 - ((value - min) / range) * 14;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return <svg viewBox="0 0 50 18" className="h-[18px] w-[50px] shrink-0" role="img" aria-label={`${label} health trend over the last 24 hours`}>
    <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function CollectorIngestionSpark({ values, name }: { values: number[]; name: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 50;
    const y = 17 - ((value - min) / range) * 14;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return <svg viewBox="0 0 50 18" className="h-[18px] w-[50px] shrink-0" role="img" aria-label={`${name} ingestion trend`}>
    <polyline points={points} fill="none" stroke="#60A5FA" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

const controlClass = "cursor-pointer rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function GlobalHealthDashboard() {
  const isDark = useDarkMode();
  const palette = dark(isDark);
  const [trendRange, setTrendRange] = useState<GlobalHealthTrendRange>("24H");
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({ "Infrastructure Health": true, "Monitoring Coverage": true, "Service Availability": true });
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const componentRows = [...componentHealth].sort((a, b) => a.value - b.value);
  const componentBelowSlaCount = componentRows.filter((item) => item.value < SLA_TARGET).length;
  const lowestComponent = componentRows[0];
  const sortedEnvironments = [...environmentHealth].sort((a, b) => a.value - b.value);
  const belowSlaEnvironments = sortedEnvironments.filter((item) => item.value < SLA_TARGET);
  const attention = [
    ...componentHealth.filter((item) => item.value < SLA_TARGET).map((item) => ({ ...item, kind: "Component" as const, history: componentHealthHistory.find((series) => series.name === item.name)?.values ?? [item.value] })),
    ...environmentHealth.filter((item) => item.value < SLA_TARGET).map((item) => ({ ...item, kind: "Env" as const, history: environmentHealthHistory.find((series) => series.name === item.name)?.values ?? [item.value] })),
  ].sort((a, b) => a.value - b.value).slice(0, 8);
  const attentionGaps = attention.map((item) => SLA_TARGET - item.value);
  const worstAttentionGap = Math.max(0, ...attentionGaps);
  const averageAttentionGap = attentionGaps.length ? attentionGaps.reduce((sum, gap) => sum + gap, 0) / attentionGaps.length : 0;
  const collectorCount = globalCollectors.length;
  const healthyCollectorCount = globalCollectors.filter((item) => item.status === "healthy").length;
  const staleCollectorCount = globalCollectors.filter((item) => item.status === "warning").length;
  const downCollectorCount = globalCollectors.filter((item) => item.status === "critical").length;
  const collectorTargetsUp = globalCollectors.reduce((total, item) => total + item.targetsUp, 0);
  const collectorTargetsTotal = globalCollectors.reduce((total, item) => total + item.targetsTotal, 0);
  const collectorIngestion = globalCollectors.reduce((total, item) => total + item.ingestionPerSecond, 0);
  const averageCollectorScrape = globalCollectors.length
    ? globalCollectors.reduce((total, item) => total + item.scrapeSeconds, 0) / globalCollectors.length
    : 0;
  const collectorNeedsAttention = collectorTargetsUp < collectorTargetsTotal || downCollectorCount > 0;
  const recent = recentHealthChanges.slice(0, 8);
  const recentDrops = recent.filter((event) => event.kind === "drop").length;
  const recentRecoveries = recent.filter((event) => event.kind === "recovery").length;
  const locationList = [...healthLocations].sort((a, b) => a.health - b.health).slice(0, 7);

  const trendItems = [
    { key: "infrastructureHealth", name: "Infrastructure Health", color: "#60A5FA" },
    { key: "monitoringCoverage", name: "Monitoring Coverage", color: "#34D399" },
    { key: "availability", name: "Service Availability", color: "#A78BFA" },
  ] as const;
  const trendRows = globalHealthTrendByRange[trendRange];
  const trendStats = (key: typeof trendItems[number]["key"]) => {
    const values = trendRows.map((point) => point[key]);
    const lowest = Math.min(...values);
    const lowestAt = trendRows[values.indexOf(lowest)]?.time ?? "—";
    return { now: values.at(-1) ?? 0, avg: values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1), lowest, lowestAt };
  };
  const trendChartApi = useRef<echarts.ECharts | null>(null);
  const trendStepMinutes = globalHealthRangeIntervalMinutes[trendRange];
  const belowSlaMinutes = (key: typeof trendItems[number]["key"]) => trendRows.slice(1).filter((point) => point[key] < SLA_TARGET).length * trendStepMinutes;
  const formatMinutes = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h 0m`;
  };
  const healthTone = (value: number) => (value >= SLA_TARGET ? "text-emerald-600 dark:text-emerald-400" : value >= 98 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400");
  const dips = useMemo(() => {
    const rows = trendRows.flatMap((point, index) =>
      trendItems.map((item, seriesIndex) => ({ seriesIndex, seriesName: item.name, key: item.key, index, time: point.time, value: point[item.key], gap: Number((point[item.key] - SLA_TARGET).toFixed(1)) })),
    );
    const below = rows.filter((row) => row.value < SLA_TARGET).sort((a, b) => b.index - a.index || a.value - b.value);
    return { count: below.length, top: below.slice(0, 3) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendRows]);
  const belowSlaWorst = Math.max(0, ...trendItems.map((item) => belowSlaMinutes(item.key)));
  const belowSlaWorstPct = trendRows.length > 1 ? Math.round((belowSlaWorst / ((trendRows.length - 1) * trendStepMinutes)) * 100) : 0;
  const focusDip = (dip: { seriesIndex: number; index: number }) => {
    const chart = trendChartApi.current;
    if (!chart) return;
    chart.dispatchAction({ type: "downplay" });
    chart.dispatchAction({ type: "highlight", seriesIndex: dip.seriesIndex, dataIndex: dip.index });
  };
  const trendOption = useMemo<EChartsOption>(() => {
    const theme = palette;
    return {
      animationDuration: 650,
      grid: { top: 30, right: 20, bottom: 30, left: 48, containLabel: false },
      tooltip: { trigger: "axis", triggerOn: "mousemove", alwaysShowContent: false, hideDelay: 0, confine: true, transitionDuration: 0, position: (point: [number, number]) => [point[0] + 14, Math.max(8, point[1] - 24)], axisPointer: { type: "cross", lineStyle: { type: "dashed", color: theme.text } }, backgroundColor: theme.tooltipBg, borderColor: theme.axis, textStyle: { color: theme.tooltipText, fontSize: 12 }, extraCssText: "border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14);padding:10px 12px", formatter: (params: unknown) => { const list = Array.isArray(params) ? params as Array<{ axisValue: string; marker: string; seriesName: string; value: number }> : []; return `<b>${list[0]?.axisValue ?? ""}</b><br/>${list.map((p) => `${p.marker}${p.seriesName}: <b>${Number(p.value).toFixed(1)}%</b>`).join("<br/>")}`; } },
      xAxis: { type: "category", boundaryGap: false, data: trendRows.map((point) => point.time), axisLabel: { color: theme.text, fontSize: 11, hideOverlap: true, interval: Math.max(1, Math.floor(trendRows.length / 5)) }, axisLine: { lineStyle: { color: theme.axis } }, axisTick: { show: false } },
      yAxis: { type: "value", min: 97, max: 100, interval: 1, name: "Zoomed axis", nameTextStyle: { color: theme.text, fontSize: 11, align: "left", padding: [0, 0, 0, -4] }, axisLabel: { color: theme.text, fontSize: 11, formatter: "{value}%" }, splitLine: { lineStyle: { color: theme.axis, type: "dashed" } } },
      legend: { show: false, selected: visibleSeries },
      series: trendItems.map((item) => {
        const seriesValues = trendRows.map((point) => point[item.key]);
        const lowestValue = Math.min(...seriesValues);
        const lowestIndex = seriesValues.indexOf(lowestValue);
        const lowestAt = trendRows[lowestIndex]?.time ?? "—";
        return { name: item.name, type: "line", smooth: 0.3, showSymbol: false, symbolSize: 7, emphasis: { focus: "series", showSymbol: true }, lineStyle: { width: 2, color: item.color }, itemStyle: { color: item.color }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `${item.color}35` }, { offset: 1, color: `${item.color}00` }]) }, data: seriesValues, markPoint: { symbol: "circle", symbolSize: 6, label: { show: false }, itemStyle: { color: item.color, borderColor: isDark ? "#0f172a" : "#ffffff", borderWidth: 1.5 }, data: [{ coord: [lowestIndex, lowestValue] }], tooltip: { trigger: "item", formatter: `Lowest ${lowestValue.toFixed(1)}% · ${lowestAt}` } }, markArea: item.key === "infrastructureHealth" ? { silent: true, itemStyle: { color: "rgba(245,158,11,0.06)" }, data: [[{ yAxis: 97 }, { yAxis: SLA_TARGET }]] } : undefined, markLine: item.key === "infrastructureHealth" ? { symbol: "none", lineStyle: { color: "#F87171", type: "dashed", width: 1 }, label: { show: true, formatter: "SLA 99%", position: "insideEndTop", color: "#be123c", fontSize: 11, backgroundColor: isDark ? "#4c1d32" : "#fff1f2", padding: [3, 6], borderRadius: 8 }, data: [{ yAxis: SLA_TARGET }] } : undefined, } as unknown as echarts.SeriesOption;
      }),
    };
  }, [palette, trendRows, isDark, visibleSeries]);

  const donutOption = useMemo<EChartsOption>(() => ({
    animationDuration: 700,
    tooltip: { trigger: "item", backgroundColor: palette.tooltipBg, textStyle: { color: palette.tooltipText }, borderColor: palette.axis, extraCssText: "border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14)" },
    series: [{ type: "pie", radius: ["64.8%", "90%"], center: ["50%", "50%"], startAngle: 90, avoidLabelOverlap: true, itemStyle: { borderColor: isDark ? "#111827" : "#fff", borderWidth: 3, borderRadius: 4 }, label: { show: false }, data: [
      { name: "Up", value: healthyCollectorCount, itemStyle: { color: "#34D399" } },
      { name: "Stale", value: staleCollectorCount, itemStyle: { color: "#FBBF24" } },
      { name: "Down", value: downCollectorCount, itemStyle: { color: "#F87171" } },
    ] }],
  }), [palette, isDark, healthyCollectorCount, staleCollectorCount, downCollectorCount]);

  return <>
    <PageMeta breadcrumbs={["Overview", "Global Health"]} />
    <PageHeading title="Global Health" description="Infrastructure and monitoring health at a glance." />
    <section aria-label="Key metrics" className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {globalHealthStats.map((item) => <MetricCard key={item.label} item={item} className="min-h-[100px]" labelClassName="text-[12px]" valueClassName="text-[24px]" trendClassName="text-[12px]" />)}
    </section>

    <section aria-label="Health trend, components and locations" className="mt-4 grid items-stretch gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      <Panel title="Health Trend" titleClassName="text-[16px] font-semibold" className="flex min-h-[350px] min-w-0 flex-col p-4" action={<div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Trend range">{(["24H", "7D", "30D"] as const).map((range) => <button key={range} type="button" aria-pressed={trendRange === range} onClick={() => { setTrendRange(range); trendChartApi.current?.dispatchAction({ type: "downplay" }); }} className={cn(controlClass, trendRange === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{range}</button>)}</div>}>
        <div className="flex h-full min-h-0 flex-col">
        <div className="mt-3 flex flex-nowrap items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-0.5">{trendItems.map((item) => { const stats = trendStats(item.key); const active = visibleSeries[item.name]; return <button key={item.name} type="button" aria-pressed={active} onClick={() => setVisibleSeries((old) => ({ ...old, [item.name]: !old[item.name] }))} aria-label={`${active ? "Hide" : "Show"} ${item.name}, latest ${stats.now.toFixed(1)}%`} className={cn("inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-1.5 py-0.5 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-border bg-card text-slate-700 dark:text-slate-200" : "border-transparent bg-slate-100 text-slate-400 line-through dark:bg-slate-800")}><i className="h-2 w-2 shrink-0 rounded-full" style={{ background: active ? item.color : "#94a3b8" }} /><span className="truncate">{item.name}</span><b className="shrink-0 tabular-nums">{stats.now.toFixed(1)}%</b></button>; })}</div>
        <div className="mt-2 flex min-h-[170px] min-w-0 flex-1 flex-col"><EChart apiRef={trendChartApi} option={trendOption} label="Infrastructure health, monitoring coverage, and service availability over time" className="!min-h-[170px] h-full" /></div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
          <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">Series summary</span>
          <span role="status" aria-label={`Below SLA for ${formatMinutes(belowSlaWorst)}, ${belowSlaWorstPct}% of the ${trendRange} range`} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[12px] font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"><TriangleAlert size={12} aria-hidden="true" />Below SLA {formatMinutes(belowSlaWorst)} ({belowSlaWorstPct}%)</span>
        </div>
        <div className="mt-1 overflow-x-auto" role="region" aria-label="Series summary table" tabIndex={0}>
          <table className="w-full min-w-[420px] border-collapse text-[12px]">
            <thead>
              <tr className="text-left text-[12px] text-slate-500 dark:text-slate-400">
                <th scope="col" className="py-1 pr-2 font-medium">Series</th>
                <th scope="col" className="py-1 pr-2 font-medium">Now</th>
                <th scope="col" className="py-1 pr-2 font-medium">Avg</th>
                <th scope="col" className="py-1 pr-2 font-medium">Lowest</th>
                <th scope="col" className="py-1 font-medium">Below SLA</th>
              </tr>
            </thead>
            <tbody>
              {trendItems.map((item) => { const stats = trendStats(item.key); const below = belowSlaMinutes(item.key); return (
                <tr key={item.key} className="border-t border-border/60">
                  <td className="py-1.5 pr-2"><span className="flex items-center gap-1.5 whitespace-nowrap text-slate-700 dark:text-slate-200"><i className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />{item.name}</span></td>
                  <td className={cn("py-1.5 pr-2 tabular-nums font-semibold", healthTone(stats.now))}><span className="inline-flex items-center gap-1"><StatusIcon value={stats.now} size={12} /><span aria-hidden="true">{stats.now.toFixed(1)}%</span><span className="sr-only">{statusForHealth(stats.now)}</span></span></td>
                  <td className={cn("py-1.5 pr-2 tabular-nums font-semibold", healthTone(stats.avg))}>{stats.avg.toFixed(1)}%</td>
                  <td className={cn("py-1.5 pr-2 tabular-nums font-semibold", healthTone(stats.lowest))} title={`Lowest at ${stats.lowestAt}`}>{stats.lowest.toFixed(1)}%</td>
                  <td className={cn("py-1.5 tabular-nums font-semibold", below === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>{formatMinutes(below)}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 border-t border-border pt-2" aria-label="Recent SLA dips">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Recent dips</h3>
            <span className="text-[12px] tabular-nums text-muted-foreground">Showing {dips.top.length} of {dips.count} dips</span>
          </div>
          {dips.top.length ? <ul className="mt-1 flex flex-col">
            {dips.top.map((dip) => (
              <li key={`${dip.seriesName}-${dip.index}`}>
                <button type="button" onClick={() => focusDip(dip)} aria-label={`Highlight ${dip.seriesName} dip at ${dip.time}, ${dip.value.toFixed(1)} percent, ${Math.abs(dip.gap).toFixed(1)} percent below SLA`} className="grid min-h-7 w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-2 rounded-md text-left text-[12px] transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <time className="tabular-nums text-muted-foreground">{dip.time}</time>
                  <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">{dip.seriesName} <b className="tabular-nums">{dip.value.toFixed(1)}%</b></span>
                  <b className="tabular-nums text-rose-600 dark:text-rose-400">(−{Math.abs(dip.gap).toFixed(1)}% vs SLA)</b>
                </button>
              </li>
            ))}
          </ul> : <p className="py-1.5 text-[12px] text-muted-foreground">No dips below SLA in this range</p>}
        </div>
        </div>
      </Panel>

      <Panel title="Health by Component" titleClassName="text-[16px] font-semibold" className="flex min-h-[350px] min-w-0 flex-col p-4">
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-[12px] text-slate-500">Overall Health</span>
            <b className="text-[22px] leading-tight tabular-nums text-slate-900 dark:text-white">{healthScore}%</b>
            <span className="hidden items-center gap-1 whitespace-nowrap text-[12px] font-semibold text-emerald-600 sm:inline-flex"><ArrowUpRight size={13} />0.2% vs yesterday</span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[12px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><TriangleAlert size={12} />{componentBelowSlaCount} of {componentRows.length} below SLA</span>
        </div>
        <div className="mt-3 grid grid-cols-[minmax(88px,1.15fr)_minmax(34px,1fr)_50px_43px_43px_16px] items-center gap-1.5 text-[12px] text-slate-500">
          <span />
          <span className="relative h-4"><span className="absolute left-[80%] top-0 -translate-x-1/2 whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 font-medium leading-3 text-slate-600 dark:bg-slate-700 dark:text-slate-200">SLA {SLA_TARGET}%</span></span>
          <span className="col-span-4" />
        </div>
        <div className="mt-3 flex min-h-0 flex-1 flex-col divide-y divide-border/60" aria-label="Components ordered by lowest health">
          {componentRows.map((item) => {
            const status = statusForHealth(item.value);
            const scaled = Math.max(0, Math.min(100, (item.value - 95) * 20));
            const history = componentHealthHistory.find((series) => series.name === item.name);
            const historyValues = history?.values ?? [item.value];
            const delta = Number((item.value - SLA_TARGET).toFixed(1));
            const deltaText = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
            const details = `${item.name} · Last 24 hours: min ${history?.min.toFixed(1) ?? item.value}%, avg ${history?.avg.toFixed(1) ?? item.value}%, max ${history?.max.toFixed(1) ?? item.value}%. Last incident: ${history?.lastIncident ?? item.lastIncident}`;
            const selected = selectedComponent === item.name;

            return <button id={`health-component-${item.name.toLowerCase()}`} key={item.name} type="button" aria-pressed={selected} aria-label={`${details}. Current health ${item.value}%. ${status === "healthy" ? "Meets SLA" : "Below SLA"}. Click to select component.`} title={details} onClick={() => setSelectedComponent(selected ? null : item.name)} className={cn("grid h-[52px] w-full min-w-0 shrink-0 grid-cols-[minmax(88px,1.15fr)_minmax(34px,1fr)_50px_43px_43px_16px] items-center gap-1.5 rounded-md px-1 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-slate-800/60", selected && "bg-blue-50/70 dark:bg-blue-950/30")}>
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium text-slate-700 dark:text-slate-200"><Icon name={item.icon} size={14} className="shrink-0 text-blue-500" /><span className="truncate">{item.name}</span></span>
                <span className={cn("block truncate pl-[21px] text-[12px] leading-4", status === "healthy" ? "text-slate-500" : status === "warning" ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300")}>{status === "healthy" ? "Meets SLA" : "Below SLA"}</span>
              </span>
              <span className="relative h-[6px] min-w-0 rounded-full bg-slate-100 dark:bg-slate-700" aria-label={`${item.name} scaled health bar, SLA marker at ${SLA_TARGET}%`}>
                <span className="absolute inset-y-[-3px] left-[80%] z-10 border-l-[1.5px] border-solid border-slate-400" />
                <span className="block h-full rounded-full" style={{ width: `${scaled}%`, backgroundColor: statusColors[status] }} />
              </span>
              <ComponentSparkline values={historyValues} color={statusColors[status]} label={item.name} />
              <b className="whitespace-nowrap text-right text-[12px] tabular-nums text-slate-800 dark:text-slate-100">{item.value.toFixed(1)}%</b>
              <span className={cn("whitespace-nowrap text-right text-[11px] font-semibold tabular-nums", delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : status === "warning" ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300")}>{deltaText}</span>
              <StatusIcon value={item.value} size={14} />
            </button>;
          })}
        </div>
        {selectedComponent && (() => {
          const selectedHistory = componentHealthHistory.find((series) => series.name === selectedComponent);
          return <div aria-live="polite" className="mt-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
            <b className="text-slate-800 dark:text-slate-100">{selectedComponent}</b>: 24h min {selectedHistory?.min.toFixed(1)}% · avg {selectedHistory?.avg.toFixed(1)}% · max {selectedHistory?.max.toFixed(1)}% · {selectedHistory?.lastIncident}
          </div>;
        })()}
        <footer className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2 text-[12px] text-slate-500">
          <span className="min-w-0 truncate" title={lowestComponent ? `Lowest: ${lowestComponent.name} ${lowestComponent.value.toFixed(1)}%` : undefined}><span className="font-medium">Lowest:</span> <b className="text-slate-700 dark:text-slate-300">{lowestComponent?.name ?? "—"} {lowestComponent?.value.toFixed(1) ?? "—"}%</b></span>
          <span className="shrink-0">Updated <b className="text-slate-700 dark:text-slate-300">2m ago</b></span>
        </footer>
      </Panel>

      <Panel title="Health by Location" titleClassName="text-[16px] font-semibold" className="flex min-h-[350px] min-w-0 flex-col p-4" showOptions={false}>
        <div className="mt-3 h-[230px] min-h-[230px] flex-1 overflow-hidden rounded-lg"><NocOsmMap sites={healthMapSites} center={[33.69, 73.06]} initialZoom={13} /></div>
        <ul className="mt-3 flex min-h-0 flex-1 flex-col justify-between divide-y divide-border/70" aria-label="Locations sorted by lowest health">
          {locationList.map((location) => <li key={location.name} className="grid min-h-[36px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 py-1 text-[12px]"><span className="flex min-w-0 items-center gap-2 truncate text-slate-700 dark:text-slate-200"><i className="h-2 w-2 shrink-0 rounded-full" style={{ background: statusColors[statusForHealth(location.health)] }} />{location.name}</span><b className="tabular-nums text-slate-800 dark:text-slate-100">{location.health}%</b><StatusIcon value={location.health} size={13} /></li>)}
        </ul>
      </Panel>
    </section>

    <section aria-label="Resource, service, and environment health" className="mt-4 grid items-stretch gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      <Panel title="Resource Health" titleClassName="text-[16px] font-semibold" className="flex min-h-[335px] min-w-0 flex-col p-4">
        <div className="mt-3 grid flex-1 grid-cols-2 gap-3">{resourceHealth.map((resource) => { const barColor = resource.value >= 85 ? "#F87171" : resource.value >= 70 ? "#FBBF24" : "#60A5FA"; return <article key={resource.label} className="flex min-w-0 flex-col justify-center rounded-lg border border-border/70 bg-slate-50 p-3 dark:bg-slate-800/60"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-200"><Icon name={resource.icon} size={15} className="text-blue-500" />{resource.label}</span><StatusIcon value={resource.value} size={14} /></div><b className="mt-2 text-[20px] tabular-nums text-slate-900 dark:text-white">{resource.value}%</b><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full" style={{ width: `${resource.value}%`, backgroundColor: barColor }} /></div><span className="mt-1.5 text-[12px] text-slate-500">{resource.kind}</span></article>; })}</div>
      </Panel>

      <Panel title="Top Healthy Services" titleClassName="text-[16px] font-semibold" className="flex min-h-[335px] min-w-0 flex-col p-4" action={<Link href="/processes-and-services" className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-primary hover:underline">View all <ArrowRight size={13} /></Link>}>
        <ul className="mt-2 flex min-h-0 flex-1 flex-col divide-y divide-border/70">{topHealthyServices.map((service) => <li key={service.name} className="flex min-h-[36px] flex-1 items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2"><TechLogo name={service.key} className="!h-6 !w-6 !rounded-md [&_svg]:!h-4 [&_svg]:!w-4" /><span className="truncate text-[13px] font-medium text-slate-700 dark:text-slate-200">{service.name}</span></span><span className="flex shrink-0 items-center gap-1.5"><b className="whitespace-nowrap text-[13px] tabular-nums text-slate-800 dark:text-slate-100">{service.percent}%</b><StatusIcon value={service.percent} size={13} /></span></li>)}</ul>
        <footer className="mt-auto border-t border-border pt-2 text-[12px] text-slate-500">Showing {topHealthyServices.length} of {totalHealthyServices} services</footer>
      </Panel>

      <Panel title="Health by Environment" titleClassName="text-[16px] font-semibold" className="flex min-h-[350px] min-w-0 flex-col p-4">
        <div className="mt-2 flex items-center justify-between text-[12px] text-slate-500"><span>Environment · servers · alerts</span><span className="inline-flex items-center gap-1.5"><i className="h-3 border-l-[1.5px] border-solid border-slate-400" />SLA {SLA_TARGET}%</span></div>
        <div className="mt-1 flex min-h-0 flex-1 flex-col justify-between" aria-label="Environments sorted from lowest to highest health">{sortedEnvironments.map((env) => {
          const status = statusForHealth(env.value);
          const scale = Math.max(0, Math.min(100, (env.value - 95) * 20));
          const history = environmentHealthHistory.find((series) => series.name === env.name)?.values ?? [env.value];
          const gap = Number((env.value - SLA_TARGET).toFixed(1));
          return <div id={`health-environment-${env.name.toLowerCase().replace(/\s+/g, "-")}`} key={env.name} title={`${env.name}: ${env.value}% health; ${env.servers} servers; ${env.alerts} alerts`} className="grid min-h-[48px] grid-cols-[minmax(78px,1.1fr)_minmax(34px,1fr)_50px_43px_42px_16px] items-center gap-1.5 rounded-md px-0.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <span className="min-w-0"><b className="block truncate text-[13px] font-medium text-slate-700 dark:text-slate-200">{env.name}</b><span className="block truncate text-[12px] text-slate-500">{env.servers} servers · {env.alerts} alerts</span></span>
            <span className="relative h-[6px] min-w-0 rounded-full bg-slate-100 dark:bg-slate-700"><i className="absolute inset-y-[-4px] left-[80%] z-10 border-l-[1.5px] border-solid border-slate-400" /><i className="block h-full rounded-full" style={{ width: `${scale}%`, backgroundColor: statusColors[status] }} /></span>
            <ComponentSparkline values={history} color={statusColors[status]} label={`${env.name} environment`} />
            <b className="whitespace-nowrap text-right text-[12px] tabular-nums text-slate-800 dark:text-slate-100">{env.value.toFixed(1)}%</b>
            <span className={cn("whitespace-nowrap text-right text-[12px] font-semibold tabular-nums", gap >= 0 ? "text-emerald-600 dark:text-emerald-400" : status === "warning" ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300")}>{gap > 0 ? "+" : ""}{gap.toFixed(1)}%</span>
            <StatusIcon value={env.value} size={14} />
          </div>;
        })}</div>
        <footer className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[12px] text-slate-500"><span>Environment health · last 24h</span><b className={belowSlaEnvironments.length ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}>{belowSlaEnvironments.length} of {environmentHealth.length} below SLA</b></footer>
      </Panel>
    </section>

    <section aria-label="Collectors, attention items, and health changes" className="mt-4 grid items-stretch gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      <Panel title="Monitoring Collectors" titleClassName="text-[16px] font-semibold" className="flex min-h-[350px] min-w-0 flex-col p-4">
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Targets up", value: `${collectorTargetsUp}/${collectorTargetsTotal}` },
            { label: "Ingestion", value: formatNocIngestionRate(collectorIngestion) },
            { label: "Avg scrape", value: `${averageCollectorScrape.toFixed(1)}s` },
          ].map((tile) => (
            <div key={tile.label} className={cn("min-w-0 rounded-lg bg-[#F8F9FB] p-2.5 dark:bg-slate-800/60", collectorNeedsAttention && "bg-amber-50 dark:bg-amber-950/20")}>
              <span className="block truncate text-[12px] text-slate-500">{tile.label}</span>
              <b className="mt-1 block truncate text-[16px] font-bold tabular-nums text-slate-900 dark:text-white">{tile.value}</b>
            </div>
          ))}
        </div>
        <div className="mt-3 flex min-h-0 flex-1 flex-col items-stretch gap-3 lg:flex-row lg:items-start">
          <div className="flex w-[110px] shrink-0 flex-col items-center self-center">
            <div className="relative h-[110px] w-[110px]" role="img" aria-label={`${healthyCollectorCount} of ${collectorCount} collectors healthy`}>
              <EChart option={donutOption} label={`Collector health: ${healthyCollectorCount} up, ${staleCollectorCount} stale, ${downCollectorCount} down`} className="!absolute !inset-0 !h-full !w-full !min-h-0" />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <b className="text-[21px] font-bold tabular-nums text-slate-900 dark:text-white">{healthyCollectorCount}/{collectorCount}</b>
                <span className="text-[12px] text-slate-500">Healthy</span>
              </div>
            </div>
            <div className="mt-1 flex flex-wrap justify-center gap-x-2 text-[12px] text-slate-600 dark:text-slate-300" aria-label={`Collector status counts: Up ${healthyCollectorCount}, Stale ${staleCollectorCount}, Down ${downCollectorCount}`}>
              <span className="whitespace-nowrap"><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Up {healthyCollectorCount}</span>
              <span className="whitespace-nowrap"><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />Stale {staleCollectorCount}</span>
              <span className="whitespace-nowrap"><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />Down {downCollectorCount}</span>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="grid grid-cols-[minmax(0,1fr)_52px_60px_58px_50px] gap-1 border-b border-border/70 pb-1 text-[12px] font-medium text-slate-500" aria-hidden="true">
              <span className="whitespace-nowrap">Collector</span>
              <span className="whitespace-nowrap text-right">Targets</span>
              <span className="hidden whitespace-nowrap text-right lg:block">Last seen</span>
              <span className="whitespace-nowrap text-center">Status</span>
              <span className="hidden lg:block" />
            </div>
            <ul className="flex min-h-0 flex-1 flex-col justify-between divide-y divide-border/60" aria-label="Collectors sorted by status severity">
              {[...globalCollectors].sort((a, b) => {
                const rank = { critical: 0, warning: 1, healthy: 2 };
                return rank[a.status] - rank[b.status];
              }).map((collector) => {
                const BadgeIcon = collector.status === "healthy" ? Check : collector.status === "warning" ? Clock3 : CircleX;
                const statusLabel = collector.status === "healthy" ? "Up" : collector.status === "warning" ? "Stale" : "Down";
                const statusTone = collector.status === "healthy"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : collector.status === "warning"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
                return (
                  <li key={collector.name} className="grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_52px_60px_58px_50px] items-center gap-1 text-[12px]">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <TechLogo name={collector.name} className="!h-6 !w-6 !rounded-md [&_svg]:!h-4 [&_svg]:!w-4" />
                      <span className="min-w-0">
                        <b className="block truncate font-medium text-slate-700 dark:text-slate-200">{collector.name}</b>
                        <span className="block truncate text-[12px] text-slate-500">v{collector.version}</span>
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-right tabular-nums text-slate-700 dark:text-slate-200">{collector.targetsUp}/{collector.targetsTotal}</span>
                    <span className="hidden whitespace-nowrap text-right tabular-nums text-slate-500 lg:block">{collector.lastSeen}</span>
                    <span className={cn("flex items-center justify-center gap-0.5 rounded-full px-1 py-1 font-semibold", statusTone)} aria-label={`Status ${statusLabel}`}>
                      <BadgeIcon size={12} aria-hidden="true" />{statusLabel}
                    </span>
                    <span className="hidden justify-end lg:flex"><CollectorIngestionSpark values={collector.spark} name={collector.name} /></span>
                  </li>
                );
              })}
            </ul>
            {collectorNeedsAttention ? (() => {
              const staleCollector = globalCollectors.find((collector) => collector.status === "warning" || collector.status === "critical");
              if (!staleCollector) return null;
              const missingTargets = staleCollector.targetsTotal - staleCollector.targetsUp;
              return <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" role="status">
                <span className="min-w-0 truncate"><b>{staleCollector.name}</b> · {missingTargets} target{missingTargets === 1 ? "" : "s"} down · last seen {staleCollector.lastSeen}</span>
                <Link href="/metrics-explorer" className="shrink-0 font-semibold text-amber-800 underline-offset-2 hover:underline dark:text-amber-200">Investigate</Link>
              </div>;
            })() : <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" role="status">All collectors healthy</div>}
          </div>
        </div>
        <footer className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2 text-[12px] text-slate-500">
          <span>Updated 12s ago</span>
          <Link href="/metrics-explorer" className="group inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-medium text-primary hover:underline">View all collectors <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" /></Link>
        </footer>
      </Panel>

      <Panel title="Needs Attention" titleClassName="text-[16px] font-semibold" className="flex min-h-[500px] min-w-0 flex-col p-4" action={<span className="rounded-full bg-amber-50 px-2 py-1 text-[12px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{attention.length} items</span>}>
        {attention.length ? <>
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Attention summary"><span className="rounded-full bg-rose-50 px-2 py-1 text-[12px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">Worst gap <b className="tabular-nums">−{worstAttentionGap.toFixed(2)}%</b></span><span className="rounded-full bg-amber-50 px-2 py-1 text-[12px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Avg gap <b className="tabular-nums">−{averageAttentionGap.toFixed(2)}%</b></span></div>
          <ul className="mt-1 flex min-h-0 flex-1 flex-col justify-between divide-y divide-border/70" aria-label="Items below SLA, worst first">{attention.map((item) => {
            const gap = Number((SLA_TARGET - item.value).toFixed(1));
            const critical = gap > 0.5;
            const severityClass = critical ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300";
            const duration = item.belowMinutes ? `${Math.floor(item.belowMinutes / 60)}h ${String(item.belowMinutes % 60).padStart(2, "0")}m` : "—";
            const targetId = item.kind === "Component" ? `health-component-${item.name.toLowerCase()}` : `health-environment-${item.name.toLowerCase().replace(/\s+/g, "-")}`;
            return <li key={`${item.kind}-${item.name}`} className="flex min-h-[48px] flex-col justify-center gap-1 py-1">
              <span className="flex min-w-0 items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-1.5"><b className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">{item.name}</b><span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[12px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.kind}</span></span><span className="flex shrink-0 items-center gap-1.5"><b className="text-[12px] tabular-nums text-slate-700 dark:text-slate-200">{item.value.toFixed(1)}%</b><b className={cn("text-[12px] tabular-nums", severityClass)}>−{gap.toFixed(1)}%</b><span className={cn("whitespace-nowrap rounded-full px-1.5 py-0.5 text-[12px] font-semibold", critical ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300")}>{critical ? "Critical" : "Warning"}</span><StatusIcon value={item.value} size={14} /></span></span>
              <span className="flex min-w-0 items-center justify-between gap-2 pl-0.5 text-[12px] text-slate-500"><span className="truncate">below SLA for {duration}</span><ComponentSparkline values={item.history} color={critical ? "#F87171" : "#FBBF24"} label={`${item.name} attention trend`} /><Link href={`#${targetId}`} title={`View ${item.name} health details`} aria-label={`View ${item.name} health details`} className="shrink-0 text-[12px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">View</Link></span>
            </li>;
          })}</ul>
        </> : <div className="my-auto flex flex-col items-center gap-2 py-8 text-center"><CircleCheck size={28} className="text-emerald-500" /><b className="text-[14px] text-slate-800 dark:text-slate-100">Everything is within SLA</b></div>}
        <footer className="mt-auto flex items-center justify-between border-t border-border pt-2 text-[12px] text-slate-500"><span>SLA target: <b className="text-slate-700 dark:text-slate-300">{SLA_TARGET}%</b></span><Link href="/global-health" className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-primary hover:underline">View all <ArrowRight size={13} /></Link></footer>
      </Panel>

      <Panel title="Recent Health Changes" titleClassName="text-[16px] font-semibold" className="flex min-h-[500px] min-w-0 flex-col p-4" action={<Clock3 size={15} className="text-slate-400" aria-hidden="true" />}>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]"><span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{recentDrops} drops</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{recentRecoveries} recoveries</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Last 6h</span></div>
        <div className="relative mt-1 min-h-0 flex-1"><i aria-hidden="true" className="absolute bottom-4 left-[61px] top-4 w-px bg-slate-200 dark:bg-slate-700" /><ol className="relative flex h-full flex-col justify-between" aria-label="Health changes in the last six hours">{recent.map((event) => {
          const drop = event.kind === "drop";
          const changeColor = drop ? "#FBBF24" : "#34D399";
          return <li key={`${event.time}-${event.name}`} className="grid min-h-[44px] grid-cols-[42px_12px_minmax(0,1fr)] items-center gap-2 py-1">
            <time className="whitespace-nowrap text-[12px] tabular-nums text-slate-500">{event.time}</time>
            <span className="relative z-10 mx-auto grid h-3 w-3 place-items-center rounded-full bg-card"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: changeColor }} /></span>
            <span className="flex min-w-0 items-center gap-1.5"><span className="min-w-0 truncate text-[13px] text-slate-700 dark:text-slate-200"><b className="font-semibold text-slate-800 dark:text-slate-100">{event.name}</b> {drop ? "dropped" : "recovered"} {event.from.toFixed(1)}% → {event.to.toFixed(1)}%</span><span className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[12px] font-semibold tabular-nums", drop ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300")}>{drop ? "▼" : "▲"} {event.delta > 0 ? "+" : ""}{event.delta.toFixed(1)}%</span></span>
          </li>;
        })}</ol></div>
        <footer className="mt-auto flex items-center justify-between border-t border-border pt-2 text-[12px] text-slate-500"><span>Latest health updates</span><Link href="/global-health" className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-primary hover:underline">View all <ArrowRight size={13} /></Link></footer>
      </Panel>
    </section>
  </>;
}
