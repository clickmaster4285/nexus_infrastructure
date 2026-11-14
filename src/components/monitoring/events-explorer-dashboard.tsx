"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, Fragment } from "react";
import { createPortal } from "react-dom";
import * as echarts from "echarts/core";
import { BarChart, PieChart } from "echarts/charts";
import { BrushComponent, GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity, Bell, CheckCircle2, ChevronDown, ChevronLeft, Check,
  ChevronRight, CircleAlert, Clock, Database, Download, FileJson, FileText, Info, Link2, List, ListChecks,
  Loader2, Network, Search, SearchX, Settings2, Shield, ShieldAlert, UserRound, X, Bookmark, Plus, ArrowUpRight, ArrowDownRight, ArrowRight, RefreshCw, HardDrive,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/shared/panel";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  EVENT_HEATMAP, EVENT_HOSTS, EVENT_LOCATIONS, EVENT_RECORDS, EVENT_SEVERITY_COUNTS, EVENT_SOURCES,
  EVENT_SOURCE_SEVERITY, EVENT_HOST_SEVERITY, EVENT_RESOLUTION_STATUS, EVENT_RESOLUTION_TOTAL,
  EVENT_TOTALS, EVENT_TRENDS, EVENT_WEEK_DAYS, EVENT_DB_SOURCES, EVENT_WEEKLY_DELTAS, EVENT_PEAK_HOUR,
  RANGE_TEXT, TREND_RANGE_ORDER, fullTimestamp, relativeTime,
  type EventInfrastructure, type EventRecord, type EventSeverity, type EventStatus, type TrendRangeKey,
} from "@/data/mock/events";

echarts.use([BarChart, PieChart, BrushComponent, GridComponent, TooltipComponent, CanvasRenderer]);

/* ------------------------------------------------------------------ */
/* Severity / status styling (consistent across the app)               */
/* ------------------------------------------------------------------ */
/** Theme palette — resolved from the .dark class on <html>. */
const TREND_THEME = {
  light: {
    gridLine: "#E5E7EB",
    baseline: "#D1D5DB",
    axisLabel: "#6B7280",
    cardGap: "#ffffff",
    tooltipBg: "#ffffff",
    tooltipBorder: "#E5E7EB",
    tooltipShadow: "none",
    tooltipText: "#111827",
    tooltipMuted: "#6B7280",
    pointerLine: "#CBD5E1",
    brushColor: "rgba(59, 130, 246, 0.10)",
    brushBorder: "#3B82F6",
    bar: { Critical: "#DC2626", Warning: "#D97706", Info: "#3B82F6", Debug: "#94A3B8" } as Record<EventSeverity, string>,
  },
  dark: {
    gridLine: "#2A3342",
    baseline: "#3A4658",
    axisLabel: "#94A3B8",
    cardGap: "#152236",
    tooltipBg: "#152236",
    tooltipBorder: "#2A3342",
    tooltipShadow: "none",
    tooltipText: "#E7EDF6",
    tooltipMuted: "#94A3B8",
    pointerLine: "#54617C",
    brushColor: "rgba(59, 130, 246, 0.12)",
    brushBorder: "#60A5FA",
    bar: { Critical: "#EF4444", Warning: "#F59E0B", Info: "#60A5FA", Debug: "#94A3B8" } as Record<EventSeverity, string>,
  },
} as const;

function getTrendTheme() {
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return TREND_THEME[dark ? "dark" : "light"];
}

const SEVERITY_COLORS: Record<EventSeverity, string> = { Critical: "#DC2626", Warning: "#D97706", Info: "#3B82F6", Debug: "#94A3B8" };
const SEVERITY_BADGE: Record<EventSeverity, string> = {
  Critical: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  Warning: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  Info: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  Debug: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};
const SEVERITY_DOT: Record<EventSeverity, string> = { Critical: "bg-rose-400", Warning: "bg-amber-400", Info: "bg-blue-400", Debug: "bg-slate-400" };
const SEVERITY_ICON: Record<EventSeverity, typeof CircleAlert> = { Critical: CircleAlert, Warning: ShieldAlert, Info: Bell, Debug: List };
const SEVERITY_RANK: Record<EventSeverity, number> = { Critical: 3, Warning: 2, Info: 1, Debug: 0 };

const STATUS_META: Record<EventStatus, { icon: typeof Loader2; className: string; label: string }> = {
  Open: { icon: CircleAlert, className: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300", label: "Open" },
  Investigating: { icon: Loader2, className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300", label: "Investigating" },
  Acknowledged: { icon: Clock, className: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300", label: "Acknowledged" },
  Resolved: { icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300", label: "Resolved" },
};

const ALL_SOURCES = "All Sources";
const ALL_HOSTS = "All Hosts";
const ALL_TIME = "Last 24 hours";
const ALL_INFRA = "All infrastructure";
const ALL_LOC = "All locations";
const ALL_CATEGORY = "All categories";
const SAVED_KEY = "nexus.events.savedViews";

type SortKey = "time" | "severity" | "status";
type Density = "comfortable" | "compact";

interface AppliedFilters {
  query: string;
  severities: EventSeverity[];
  statuses: EventStatus[];
  source: string;
  host: string;
  timeRange: string;
  infrastructure: string;
  location: string;
  category: string;
  showDebug: boolean;
  brush: { from: number; to: number } | null;
}

const DEFAULT_FILTERS: AppliedFilters = {
  query: "", severities: [], statuses: [], source: ALL_SOURCES, host: ALL_HOSTS, timeRange: ALL_TIME,
  infrastructure: ALL_INFRA, location: ALL_LOC, category: ALL_CATEGORY, showDebug: false, brush: null,
};
const TIME_RANGES = ["Last 15 minutes", "Last 1 hour", "Last 6 hours", "Last 12 hours", "Last 24 hours", "Last 7 days"] as const;
const TIME_LIMIT_MINUTES: Record<string, number> = {
  "Last 15 minutes": 15, "Last 1 hour": 60, "Last 6 hours": 360, "Last 12 hours": 720, "Last 24 hours": 1440, "Last 7 days": 10080,
};

const SAMPLE_TOTAL = EVENT_RECORDS.length;

function isDefaultFilters(f: AppliedFilters): boolean {
  return !f.query && f.severities.length === 0 && f.statuses.length === 0 && f.source === ALL_SOURCES
    && f.host === ALL_HOSTS && f.timeRange === ALL_TIME && f.infrastructure === ALL_INFRA
    && f.location === ALL_LOC && f.category === ALL_CATEGORY && !f.showDebug && !f.brush;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Highlights the active query terms inside a message. */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const cleaned = terms.filter((term) => term.length >= 2);
  if (cleaned.length === 0) return <>{text}</>;
  const pattern = cleaned.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const parts = text.split(new RegExp(`(${pattern})`, "gi"));
  return (
    <>
      {parts.map((part, index) => cleaned.some((term) => part.toLowerCase() === term.toLowerCase())
        ? <mark key={index} className="rounded-sm bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-500/30">{part}</mark>
        : <span key={index}>{part}</span>)}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Trend chart — stacked bars (Critical/Warning/Info/Debug) + brush    */
/* ------------------------------------------------------------------ */
interface TrendChartProps {
  data: (typeof EVENT_TRENDS)[TrendRangeKey];
  hidden: ReadonlySet<EventSeverity>;
  brush: { start: number; end: number } | null;
  onBrush: (brush: { start: number; end: number } | null) => void;
  /** Dim every bar except the one at this index (used when hovering a spike row). */
  highlightIndex?: number | null;
}

function niceStep(maxValue: number): number {
  const raw = Math.max(maxValue, 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(raw, 0.1)));
  const step = [1, 2, 5, 10].map((multiplier) => multiplier * magnitude).find((candidate) => candidate >= raw) ?? 10 * magnitude;
  return step;
}

function TrendChart({ data, hidden, brush, onBrush, highlightIndex = null }: TrendChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const onBrushRef = useRef(onBrush);
  onBrushRef.current = onBrush;
  const brushRef = useRef(brush);
  brushRef.current = brush;
  const [selectionBox, setSelectionBox] = useState<{ left: number; width: number; label: string } | null>(null);
  const [isDark, setIsDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setIsDark(root.classList.contains("dark")));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const computeSelectionBox = () => {
    const chart = chartRef.current;
    const host = hostRef.current;
    const currentBrush = brushRef.current;
    if (!chart || !host) return;
    if (!currentBrush) { setSelectionBox(null); return; }
    try {
      const first = data[currentBrush.start];
      const last = data[currentBrush.end];
      if (!first || !last) { setSelectionBox(null); return; }
      const probeLeft = chart.convertToPixel({ xAxisIndex: 0 }, currentBrush.start);
      const nextIndex = Math.min(data.length - 1, currentBrush.start + 1);
      const probeRight = chart.convertToPixel({ xAxisIndex: 0 }, nextIndex);
      const band = Math.max(1, Math.abs(probeRight - probeLeft));
      const centerStart = chart.convertToPixel({ xAxisIndex: 0 }, currentBrush.start);
      const centerEnd = chart.convertToPixel({ xAxisIndex: 0 }, currentBrush.end);
      const hostWidth = host.clientWidth;
      const left = Math.max(0, Math.floor(centerStart - band / 2));
      const right = Math.min(hostWidth, Math.ceil(centerEnd + band / 2));
      const visibleTotal = data.slice(currentBrush.start, currentBrush.end + 1).reduce((acc, bucket) => {
        return acc + (["Critical", "Warning", "Info", "Debug"] as EventSeverity[])
          .filter((name) => !hidden.has(name))
          .reduce((sum, name) => sum + bucket[name.toLowerCase() as "critical" | "warning" | "info" | "debug"], 0);
      }, 0);
      const startLabel = new Date(first.epochMs).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const endLabel = new Date(last.epochMs).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      setSelectionBox({ left, width: Math.max(48, right - left), label: `${startLabel} – ${endLabel} · ${visibleTotal.toLocaleString("en-US")} events` });
    } catch {
      setSelectionBox(null);
    }
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const chart = echarts.init(host, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => { chart.resize(); computeSelectionBox(); });
    observer.observe(host);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const visibleNames = (["Info", "Warning", "Critical", "Debug"] as EventSeverity[]).filter((name) => !hidden.has(name));
    const theme = getTrendTheme();
    const visibleMax = Math.max(
      ...data.map((bucket) => visibleNames.reduce((sum, name) => sum + bucket[name.toLowerCase() as "critical" | "warning" | "info" | "debug"], 0)),
      1,
    );
    const step = niceStep(visibleMax);
    const yMax = Math.ceil(visibleMax / step) * step;
    const topName = visibleNames[visibleNames.length - 1];
    const peakVisibleTotal = Math.max(
      ...data.map((bucket) => visibleNames.reduce((sum, name) => sum + bucket[name.toLowerCase() as "critical" | "warning" | "info" | "debug"], 0)),
      1,
    );
    const peakIndex = data.findIndex((bucket) => visibleNames.reduce((sum, name) => sum + bucket[name.toLowerCase() as "critical" | "warning" | "info" | "debug"], 0) === peakVisibleTotal);
    const peakLabel = data[peakIndex]?.label ?? "";
    const series = visibleNames.map((name) => ({
      name,
      type: "bar" as const,
      stack: "events",
      barMaxWidth: 22,
      barCategoryGap: 3,
      itemStyle: {
        color: theme.bar[name],
        borderColor: theme.cardGap,
        borderWidth: 1,
        borderRadius: name === topName ? [2, 2, 0, 0] : 0,
      },
      emphasis: { focus: "self" as const },
      blur: { itemStyle: { opacity: 0.6 } },
      large: true,
      data: data.map((bucket) => bucket[name.toLowerCase() as keyof typeof bucket] as number),
      ...(name === topName && peakIndex >= 0 ? {
        markPoint: {
          symbol: "circle",
          symbolSize: 7,
          itemStyle: { color: "#94A3B8" },
          label: { formatter: `Peak ${peakVisibleTotal.toLocaleString("en-US")}`, position: "top" as const, fontSize: 12, fontWeight: 700, color: "#6B7280", distance: 2 },
          data: [{ name: "Peak", coord: [peakLabel, peakVisibleTotal] }],
        },
      } : {}),
    }));

    const option: EChartsOption = {
      grid: { left: 0, right: 16, top: 12, bottom: 0, containLabel: true },
      tooltip: {
        trigger: "axis",
        triggerOn: "mousemove",
        confine: true,
        axisPointer: { type: "line", lineStyle: { color: theme.pointerLine, type: "solid", width: 1 }, label: { show: true, backgroundColor: theme.tooltipBg, borderColor: theme.tooltipBorder, borderWidth: 1, color: theme.tooltipText, fontSize: 11 } },
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        textStyle: { color: theme.tooltipText, fontSize: 12 },
        extraCssText: `border-radius:0.5rem;box-shadow:${theme.tooltipShadow};padding:0.625rem 0.75rem;`,
        formatter: (params: unknown) => {
          const list = (Array.isArray(params) ? params : [params]) as Array<{ color: string; seriesName: string; value: number; dataIndex?: number }>;
          const index = typeof list[0]?.dataIndex === "number" ? list[0].dataIndex : 0;
          const bucket = data[index];
          if (!bucket) return "";
          const stamp = new Date(bucket.epochMs);
          const title = `${stamp.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${stamp.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
          const lines = list.map((item) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;line-height:1.25rem;min-width:10.625rem"><span style="display:flex;align-items:center;gap:0.375rem"><span style="display:inline-block;width:0.5rem;height:0.5rem;border-radius:50%;background:${item.color}"></span><span style="color:${theme.tooltipMuted}">${item.seriesName}</span></span><b style="font-variant-numeric:tabular-nums;color:${theme.tooltipText}">${item.value.toLocaleString("en-US")}</b></div>`).join("");
          const total = list.reduce((sum, item) => sum + item.value, 0);
          return `<div style="font-weight:600;margin-bottom:0.25rem;font-variant-numeric:tabular-nums;color:${theme.tooltipText}">${title}</div>${lines}<div style="border-top:0.0625rem solid ${theme.tooltipBorder};margin-top:0.25rem;padding-top:0.25rem;display:flex;justify-content:space-between;gap:1rem;line-height:1.25rem;min-width:10.625rem"><span style="color:${theme.tooltipMuted}">Total</span><b style="font-variant-numeric:tabular-nums;color:${theme.tooltipText}">${total.toLocaleString("en-US")}</b></div>`;
        },
      },
      brush: {
        toolbox: ["lineX"],
        xAxisIndex: 0,
        brushStyle: { color: theme.brushColor, borderColor: theme.brushBorder, borderWidth: 1 },
        outOfBrush: { colorAlpha: 0.3 },
        throttleType: "debounce",
        throttleDelay: 120,
      },
      xAxis: {
        type: "category",
        data: data.map((bucket) => bucket.label),
        axisTick: { show: false },
        axisLine: { show: true, lineStyle: { color: theme.baseline, width: 1 } },
        splitLine: { show: false },
        axisLabel: {
          color: theme.axisLabel,
          fontSize: 11,
          interval: Math.max(0, Math.ceil(data.length / 6) - 1),
          hideOverlap: true,
          margin: 12,
        },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: yMax,
        interval: step,
        splitLine: { show: true, lineStyle: { color: theme.gridLine, type: "solid", width: 1 } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: theme.axisLabel,
          fontSize: 11,
          formatter: (value: number) => (value === 0 ? "0" : value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1000 ? `${Math.round(value / 1000)}K` : String(value)),
        },
      },
      series,
    };
    chart.setOption(option, { notMerge: true });
    chart.dispatchAction({ type: "takeGlobalCursor", key: "brush", brushOption: { brushType: "lineX" } });

    chart.off("brushEnd");
    chart.on("brushEnd", (params: unknown) => {
      const areas = (params as { areas?: Array<{ coordRange?: [number, number] }> }).areas;
      const range = areas?.[0]?.coordRange;
      if (!range) {
        onBrushRef.current(null);
        return;
      }
      const start = Math.max(0, Math.round(Math.min(range[0], range[1])));
      const end = Math.min(data.length - 1, Math.round(Math.max(range[0], range[1])));
      onBrushRef.current({ start, end });
    });

    chart.off("click");
    chart.on("click", (params: unknown) => {
      const event = params as { componentType?: string; dataIndex?: number };
      if (event.componentType === "series" && typeof event.dataIndex === "number") {
        onBrushRef.current({ start: event.dataIndex, end: event.dataIndex });
      }
    });

    chart.dispatchAction({ type: "brush", areas: brush ? [{ brushType: "lineX", coordRange: [brush.start, brush.end], xAxisIndex: 0 }] : [] });
    computeSelectionBox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, hidden, brush, isDark]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.dispatchAction({ type: "downplay" });
    if (highlightIndex == null) return;
    const option = chart.getOption() as { series?: Array<{ name?: string }> } | null;
    const count = option?.series?.length ?? 1;
    for (let index = 0; index < count; index += 1) {
      chart.dispatchAction({ type: "highlight", seriesIndex: index, dataIndex: highlightIndex });
    }
  }, [highlightIndex]);

  return (
    <div className="relative">
      <div ref={hostRef} role="img" aria-label="Stacked bar chart of event volume by severity over time. Drag to select a window." className="h-[13.125rem] w-full" />
      {selectionBox && (
        <div className="pointer-events-none absolute top-[0.125rem] z-[5] max-w-[95%] truncate whitespace-nowrap rounded-md border border-blue-500/50 bg-blue-500/10 px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-blue-700 dark:text-blue-300" style={{ left: selectionBox.left, width: selectionBox.width }}>
          {selectionBox.label}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Donut — severity split; debug toggleable                            */
/* ------------------------------------------------------------------ */
function SeverityDonut({ includeDebug, onToggleSeverity, activeSeverities }: { includeDebug: boolean; onToggleSeverity: (severity: EventSeverity) => void; activeSeverities: ReadonlySet<EventSeverity> }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const chart = echarts.init(host, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(host);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const visible: EventSeverity[] = includeDebug ? ["Critical", "Warning", "Info", "Debug"] : ["Critical", "Warning", "Info"];
    const total = visible.reduce((acc, name) => acc + EVENT_SEVERITY_COUNTS[name], 0);
    const option: EChartsOption = {
      series: [{
        type: "pie",
        radius: ["76%", "88%"],
        padAngle: 0,
        label: { show: false },
        itemStyle: { borderRadius: 2, borderWidth: 0, borderColor: "var(--card)" },
        emphasis: { label: { show: false }, scaleSize: 3 },
        data: visible.map((name) => ({ name, value: EVENT_SEVERITY_COUNTS[name], itemStyle: { color: SEVERITY_COLORS[name] } })),
      }],
      tooltip: { trigger: "item", backgroundColor: "var(--popover)", borderColor: "var(--border)", textStyle: { color: "var(--popover-foreground)", fontSize: 12 } },
    };
    chart.setOption(option, { notMerge: true });
  }, [includeDebug]);

  const visibleSeverities: EventSeverity[] = includeDebug ? ["Critical", "Warning", "Info", "Debug"] : ["Critical", "Warning", "Info"];
  const visibleTotal = visibleSeverities.reduce((acc, name) => acc + EVENT_SEVERITY_COUNTS[name], 0);

  return (
    <div className="flex items-center gap-4 pt-1">
      <div className="relative h-[9.375rem] w-[9.375rem] shrink-0">
        <div ref={hostRef} className="absolute inset-0" role="img" aria-label={`Donut chart of event severities. ${visibleTotal.toLocaleString("en-US")} events in view.`} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <b className="font-display text-[1.1875rem] font-extrabold leading-none text-foreground tabular-nums">{visibleTotal.toLocaleString("en-US")}</b>
          <span className="mt-1 text-[0.75rem] font-medium text-muted-foreground">Total</span>
        </div>
      </div>
      <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
        {visibleSeverities.map((severity) => {
          const count = EVENT_SEVERITY_COUNTS[severity];
          const pct = (count / visibleTotal) * 100;
          const active = activeSeverities.has(severity);
          return (
            <button
              key={severity}
              type="button"
              onClick={() => onToggleSeverity(severity)}
              aria-pressed={active}
              title={`${active ? "Remove" : "Add"} ${severity} filter`}
              className={cn(
                "flex min-w-0 flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/50",
              )}
            >
              <span className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-foreground"><i aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[severity] }} />{severity}</span>
              <b className="text-[0.9375rem] tabular-nums text-foreground">{count.toLocaleString("en-US")}</b>
              <span className="text-[0.75rem] tabular-nums text-muted-foreground">{pct.toFixed(1)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Heatmap — 7 days x 24 hours                                         */
/* ------------------------------------------------------------------ */
const HEATMAP_DAYS = Array.from({ length: 7 }, (_, index) => {
  const date = new Date();
  date.setDate(date.getDate() - (6 - index));
  return date.toLocaleDateString("en-GB", { weekday: "short" });
});
const HEATMAP_MAX = Math.max(...EVENT_HEATMAP.flat());

function ActivityHeatmap() {
  const bucket = (count: number) => {
    if (count === 0) return 0;
    const ratio = count / HEATMAP_MAX;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    if (ratio > 0.1) return 1;
    return 0;
  };
  const cellClass = ["bg-blue-100 dark:bg-blue-950/40", "bg-blue-200 dark:bg-blue-900/50", "bg-blue-400 dark:bg-blue-800/70", "bg-blue-600 dark:bg-blue-600/80", "bg-blue-800 dark:bg-blue-500"];
  return (
    <div className="flex flex-1 flex-col justify-center gap-1 pt-1" aria-label="Event activity heatmap by day and hour">
      <div className="grid grid-cols-[40px_repeat(24,minmax(0,1fr))] gap-[0.1875rem]">
        <span aria-hidden="true" />
        {Array.from({ length: 24 }, (_, hour) => (
          <span key={hour} className="text-center text-[0.75rem] tabular-nums text-muted-foreground">{String(hour).padStart(2, "0")}</span>
        ))}
        {HEATMAP_DAYS.map((day, dayIndex) => (
          <Fragment key={day + dayIndex}>
            <span className="flex items-center text-[0.75rem] font-medium text-muted-foreground">{day}</span>
            {EVENT_HEATMAP[dayIndex].map((count, hour) => (
              <div
                key={hour}
                title={`${day} ${String(hour).padStart(2, "0")}:00 — ${count.toLocaleString("en-US")} events`}
                aria-label={`${day} ${String(hour).padStart(2, "0")}:00, ${count.toLocaleString("en-US")} events`}
                className={cn("h-[1.375rem] rounded-[0.1875rem]", cellClass[bucket(count)])}
              />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-2 text-[0.75rem] text-muted-foreground"><span>Less</span><span className="flex gap-1">{cellClass.map((cellClassName, index) => <span key={index} aria-hidden="true" className={cn("h-3 w-3 rounded-[0.125rem]", cellClassName)} />)}</span><span>More</span></div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline — tiny inline SVG trend line (no new library)              */
/* ------------------------------------------------------------------ */
function Sparkline({ values, stroke, className }: { values: number[]; stroke: string; className?: string }) {
  const width = 100;
  const height = 26;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => `${((index * width) / Math.max(1, values.length - 1)).toFixed(2)},${(height - 2 - ((value - min) / range) * (height - 4)).toFixed(2)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn("h-[1.625rem] w-16 shrink-0", className)} role="img" aria-label="Trend sparkline">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* Location / source / host horizontal bars */
const ROW_HUES = [
  { bar: "#38BDF8", icon: "text-sky-500 dark:text-sky-400" },
  { bar: "#34D399", icon: "text-emerald-500 dark:text-emerald-400" },
  { bar: "#A78BFA", icon: "text-violet-500 dark:text-violet-400" },
  { bar: "#FBBF24", icon: "text-amber-500 dark:text-amber-400" },
  { bar: "#FB7185", icon: "text-rose-500 dark:text-rose-400" },
  { bar: "#2DD4BF", icon: "text-teal-500 dark:text-teal-400" },
  { bar: "#F97316", icon: "text-orange-500 dark:text-orange-400" },
] as const;
const SOURCE_TRENDS: Record<string, number> = { System: 12, Application: 8, Database: 15, Network: -5, Security: 3, Storage: 4 };
const HOST_TRENDS: Record<string, number> = { "api-server-01": 12, "web-app-01": 9, "db-01": 15, "app-server-02": -4, "web-02": -7, "storage-01": 6 };

function BreakdownBarList({ rows, iconFor, trends, onSelect, headerLabel, severityBreakdown }: { rows: Array<{ name: string; count: number; pct?: number }>; iconFor?: (name: string, index: number, iconColor?: string) => React.ReactNode; trends?: Record<string, number>; onSelect?: (name: string) => void; headerLabel?: string; severityBreakdown?: Record<string, { critical: number; warning: number }> }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const showTrend = trends !== undefined;
  return (
    <div className="flex flex-1 flex-col justify-start gap-2 pt-3">
      {headerLabel && (
        <div className="hidden grid-cols-[140px_minmax(0,1fr)_56px_4rem] items-center gap-x-3 border-b border-[#EEF0F4] pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] text-muted-foreground dark:border-border sm:grid" aria-hidden="true">
          <span>{headerLabel}</span>
          <span>Volume</span>
          <span aria-hidden="true" />
          <span className="text-right">Change</span>
        </div>
      )}
      <ul className="flex flex-1 flex-col items-start gap-1">
        {rows.map((row, index) => {
          const share = row.pct ?? (total > 0 ? (row.count / total) * 100 : 0);
          const trend = trends?.[row.name];
          const trendUp = (trend ?? 0) >= 0;
          const breakdown = severityBreakdown?.[row.name];
          const hue = ROW_HUES[index % ROW_HUES.length];
          const rowAria = `${row.name}: ${row.count.toLocaleString("en-US")} events (${share.toFixed(1)}%)${breakdown ? `, Critical ${breakdown.critical}, Warning ${breakdown.warning}` : ""}`;
          const content = (
            <>
              <span className="order-1 flex min-w-0 items-center gap-1.5 text-[0.8125rem] font-medium leading-snug text-foreground sm:order-1">
                {iconFor?.(row.name, index, hue.icon)}
                <span>{row.name}</span>
              </span>
              <b className="order-2 justify-self-end text-right text-[0.8125rem] tabular-nums text-foreground sm:order-3 sm:justify-self-auto sm:w-14">{formatCompact(row.count)}</b>
              {showTrend ? (
                <span className={cn("order-3 flex items-center justify-end gap-0.5 whitespace-nowrap text-[0.75rem] font-semibold tabular-nums sm:order-4", trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")} title={`${trendUp ? "+" : ""}${trend ?? 0}% vs last week`}>
                  {trendUp ? <ArrowUpRight size={12} aria-hidden="true" /> : <ArrowDownRight size={12} aria-hidden="true" />}{Math.abs(trend ?? 0)}%
                </span>
              ) : <span className="order-3 sm:order-4" aria-hidden="true" />}
              <span className="order-4 col-span-full h-2 min-w-0 overflow-hidden rounded-full bg-[#EEF0F4] dark:bg-slate-700 sm:order-2 sm:col-span-1">
                <span
                  className="block h-full rounded-full transition-all duration-300"
                  style={{ width: `${(row.count / max) * 100}%`, background: hue.bar }}
                />
              </span>
            </>
          );
          const className = cn(
            "grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2 text-left text-[0.8125rem] transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:h-11 sm:grid-cols-[140px_minmax(0,1fr)_56px_4rem] sm:gap-y-0 sm:px-2 sm:py-0",
            onSelect && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          );
          return (
            <li key={row.name} className="w-full">
              {onSelect ? (
                <button type="button" onClick={() => onSelect(row.name)} title={rowAria} aria-label={rowAria} className={className}>{content}</button>
              ) : (
                <div title={rowAria} aria-label={rowAria} className={className}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Distribution bar — stacked share of every source/host in the list   */
/* ------------------------------------------------------------------ */
const DISTRIBUTION_SHADES = ROW_HUES.map((hue) => hue.bar);

function DistributionBar({ rows }: { rows: Array<{ name: string; count: number; pct?: number }> }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const shareOf = (row: (typeof rows)[number]) => row.pct ?? (total > 0 ? (row.count / total) * 100 : 0);
  return (
    <div>
      <div className="flex h-2 w-full gap-[0.125rem] overflow-hidden rounded-full" role="img" aria-label="Distribution across all rows">
        {rows.map((row, index) => {
          const share = shareOf(row);
          return (
            <span
              key={row.name}
              title={`${row.name} · ${row.count.toLocaleString("en-US")} events · ${share.toFixed(1)}%`}
              aria-label={`${row.name} ${row.count.toLocaleString("en-US")} events, ${share.toFixed(1)} percent`}
              className="h-full cursor-default transition-opacity first:rounded-l-full last:rounded-r-full hover:opacity-70"
              style={{ width: `${(row.count / Math.max(total, 1)) * 100}%`, backgroundColor: DISTRIBUTION_SHADES[index % DISTRIBUTION_SHADES.length] }}
            />
          );
        })}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
        {rows.map((row, index) => (
          <li key={row.name} className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[0.75rem] text-muted-foreground" title={`${row.name} · ${row.count.toLocaleString("en-US")} events · ${shareOf(row).toFixed(1)}%`}>
            <i aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: DISTRIBUTION_SHADES[index % DISTRIBUTION_SHADES.length] }} />
            <span className="truncate">{row.name}</span>
            <span className="tabular-nums">{shareOf(row).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SOURCE_ICONS: Record<string, typeof Settings2> = {
  System: Settings2,
  Application: Activity,
  Database: Database,
  Network: Network,
  Security: Shield,
  Storage: HardDrive,
};

/* ------------------------------------------------------------------ */
/* Severity week trend — stacked CSS bars for Critical/Warning/Info    */
/* ------------------------------------------------------------------ */
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SeverityWeekTrend({ activeSeverities }: { activeSeverities: ReadonlySet<EventSeverity> }) {
  const showCritical = activeSeverities.size === 0 || activeSeverities.has("Critical");
  const showWarning = activeSeverities.size === 0 || activeSeverities.has("Warning");
  const showInfo = activeSeverities.size === 0 || activeSeverities.has("Info");
  const visibleTotal = (day: (typeof EVENT_WEEK_DAYS)[number]) => (showCritical ? day.critical : 0) + (showWarning ? day.warning : 0) + (showInfo ? day.info : 0);
  const maxDay = Math.max(...EVENT_WEEK_DAYS.map(visibleTotal), 1);

  return (
    <div className="border-t border-border/60 pt-2">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-[0.75rem] font-semibold uppercase tracking-wide text-muted-foreground">Last 7 Days</span>
        <ul className="flex flex-wrap items-center gap-2.5" aria-label="Week over week severity change">
          {EVENT_WEEKLY_DELTAS.map((delta) => {
            const up = delta.changePct >= 0;
            const good = delta.good === "down" ? !up : up;
            const Icon = up ? ArrowUpRight : ArrowDownRight;
            return (
              <li key={delta.severity} className={cn("flex items-center gap-1 text-[0.75rem] font-semibold tabular-nums", good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")} title={`${delta.severity}: ${up ? "+" : ""}${delta.changePct}% vs last week`}>
                <Icon size={12} aria-hidden="true" />{Math.abs(delta.changePct)}% {delta.severity}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex h-20 items-end gap-1.5" role="img" aria-label="Daily event counts by severity over the last 7 days">
        {EVENT_WEEK_DAYS.map((day) => {
          const dayTotal = visibleTotal(day);
          const heightPct = (segment: number) => `${Math.max(dayTotal > 0 ? (segment / maxDay) * 100 : 0, segment > 0 ? 1.5 : 0)}%`;
          const tooltip = `${day.date} — Critical ${day.critical.toLocaleString("en-US")} · Warning ${day.warning.toLocaleString("en-US")} · Info ${day.info.toLocaleString("en-US")} · Debug ${day.debug.toLocaleString("en-US")}`;
          return (
            <div key={day.label} className="flex h-full min-w-0 flex-1 flex-col items-stretch gap-1">
              <div className="flex h-full min-h-0 flex-col-reverse items-stretch justify-start gap-[0.125rem]" title={tooltip} aria-label={tooltip}>
                {showInfo && <span className="rounded-[0.125rem] bg-blue-500" style={{ height: heightPct(day.info) }} />}
                {showWarning && <span className="rounded-[0.125rem] bg-amber-600" style={{ height: heightPct(day.warning) }} />}
                {showCritical && <span className="rounded-[0.125rem] bg-red-600" style={{ height: heightPct(day.critical) }} />}
              </div>
              <span className="text-center text-[0.75rem] font-medium text-muted-foreground">{day.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Distinct premium matte hues for the Top Database Sources rows (icons + bars) */
const DB_SOURCE_HUES = [
  { bar: "#38BDF8", icon: "text-sky-500 dark:text-sky-400" },
  { bar: "#34D399", icon: "text-emerald-500 dark:text-emerald-400" },
  { bar: "#A78BFA", icon: "text-violet-500 dark:text-violet-400" },
  { bar: "#FBBF24", icon: "text-amber-500 dark:text-amber-400" },
] as const;

/* Top database-backed sources — counts scale with severity filter */
/* ------------------------------------------------------------------ */
function TopDatabaseSources({ activeSeverities, onSelect }: { activeSeverities: ReadonlySet<EventSeverity>; onSelect: (name: string) => void }) {
  const share = activeSeverities.size === 0
    ? 1
    : [...activeSeverities].reduce((acc, severity) => acc + EVENT_SEVERITY_COUNTS[severity], 0) / EVENT_TOTALS.total;
  const rows = EVENT_DB_SOURCES.map((row) => ({ ...row, visible: Math.round(row.count * share) }));
  const max = Math.max(...rows.map((row) => row.visible), 1);
  return (
    <div className="border-t border-border/60 pt-2">
      <span className="mb-1 block text-[0.75rem] font-semibold uppercase tracking-wide text-muted-foreground">Top Database Sources</span>
      <ul className="flex flex-col gap-0.5">
        {rows.map((row, index) => {
          const hue = DB_SOURCE_HUES[index % DB_SOURCE_HUES.length];
          return (
            <li key={row.name}>
              <button
                type="button"
                onClick={() => onSelect(row.name)}
                title={`Filter events to ${row.name}`}
                aria-label={`Filter events to ${row.name}, ${row.visible} events`}
                className="grid h-7 w-full grid-cols-[minmax(0,1fr)_minmax(4.375rem,1.4fr)_auto] items-center gap-2 rounded-md px-1 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex min-w-0 items-center gap-1.5 truncate font-mono text-[0.75rem] font-medium text-foreground"><Database size={11} className={cn("shrink-0", hue.icon)} aria-hidden="true" />{row.name}</span>
                <span className="h-1.5 min-w-0 overflow-hidden rounded-full bg-[#EEF0F4] dark:bg-slate-700"><span className="block h-full rounded-full transition-all duration-300" style={{ width: `${(row.visible / max) * 100}%`, background: hue.bar }} /></span>
                <b className="w-9 text-right text-[0.75rem] tabular-nums text-foreground">{row.visible}</b>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** One-line insight — peak hour from the heatmap data. */
function QuickInsightStrip() {
  const hour = EVENT_PEAK_HOUR.hour;
  const hour12 = new Date();
  hour12.setHours(hour, 0, 0, 0);
  const timeLabel = hour12.toLocaleTimeString("en-US", { hour: "numeric" });
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[0.75rem] text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300" role="note">
      <Info size={13} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0">Peak hour: <b>{timeLabel}</b> · {EVENT_PEAK_HOUR.count.toLocaleString("en-US")} events</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Resolution status — stacked bar + legend; Open filters the table    */
/* ------------------------------------------------------------------ */
const RESOLUTION_BAR_COLOR: Record<string, string> = { Resolved: "#16A34A", Acknowledged: "#D97706", Open: "#DC2626" };
const RESOLUTION_BADGE: Record<string, string> = {
  Resolved: "text-emerald-700 dark:text-emerald-300",
  Acknowledged: "text-amber-800 dark:text-amber-300",
  Open: "text-rose-700 dark:text-rose-300",
};

function ResolutionStatus({ onOpenFilter }: { onOpenFilter: () => void }) {
  return (
    <div className="border-t border-border/60 pt-2">
      <span className="mb-1 block text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Resolution Status</span>
      <div
        className="flex h-2 w-full gap-[0.125rem] overflow-hidden rounded-full"
        role="img"
        aria-label={`Resolution split: Resolved ${Math.round((EVENT_RESOLUTION_STATUS[0].count / EVENT_RESOLUTION_TOTAL) * 100)} percent, Acknowledged ${Math.round((EVENT_RESOLUTION_STATUS[1].count / EVENT_RESOLUTION_TOTAL) * 100)} percent, Open ${Math.round((EVENT_RESOLUTION_STATUS[2].count / EVENT_RESOLUTION_TOTAL) * 100)} percent`}
      >
        {EVENT_RESOLUTION_STATUS.map((segment) => (
          <span
            key={segment.label}
            title={`${segment.label}: ${segment.count.toLocaleString("en-US")} events (${((segment.count / EVENT_RESOLUTION_TOTAL) * 100).toFixed(1)}%)`}
            aria-label={`${segment.label} ${segment.count.toLocaleString("en-US")} events, ${((segment.count / EVENT_RESOLUTION_TOTAL) * 100).toFixed(1)} percent`}
            className="h-full cursor-default first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(segment.count / EVENT_RESOLUTION_TOTAL) * 100}%`, backgroundColor: RESOLUTION_BAR_COLOR[segment.label] }}
          />
        ))}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {EVENT_RESOLUTION_STATUS.map((segment) => {
          const pct = (segment.count / EVENT_RESOLUTION_TOTAL) * 100;
          const item = (
            <>
              <i aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: RESOLUTION_BAR_COLOR[segment.label] }} />
              <span className="tabular-nums">{segment.label} <b>{segment.count.toLocaleString("en-US")} · {pct.toFixed(0)}%</b></span>
            </>
          );
          if (segment.label === "Open") {
            return (
              <li key={segment.label}>
                <button
                  type="button"
                  onClick={onOpenFilter}
                  title="Filter table to open events only"
                  aria-label={`Open ${segment.count.toLocaleString("en-US")} events, filter table`}
                  className="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[0.75rem] font-medium text-rose-700 transition-colors hover:bg-rose-50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-rose-300 dark:hover:bg-rose-950/40"
                >
                  {item}
                </button>
              </li>
            );
          }
          return <li key={segment.label} className={cn("flex cursor-default items-center gap-1.5 px-1 py-0.5 text-[0.75rem] font-medium", RESOLUTION_BADGE[segment.label])} title={`${segment.label}: ${segment.count.toLocaleString("en-US")} events (${pct.toFixed(1)}%)`}>{item}</li>;
        })}
      </ul>
    </div>
  );
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

/* ------------------------------------------------------------------ */
/* Saved views (localStorage, try/catch)                               */
/* ------------------------------------------------------------------ */
interface SavedView {
  id: string;
  name: string;
  filters: AppliedFilters;
  builtin?: boolean;
}

const BUILTIN_VIEWS: SavedView[] = [
  { id: "view-critical-24h", name: "Critical 24h", builtin: true, filters: { ...DEFAULT_FILTERS, severities: ["Critical"], timeRange: "Last 24 hours" } },
  { id: "view-unresolved", name: "Unresolved", builtin: true, filters: { ...DEFAULT_FILTERS, statuses: ["Open", "Investigating", "Acknowledged"] } },
  { id: "view-my-open", name: "My open", builtin: true, filters: { ...DEFAULT_FILTERS, statuses: ["Open", "Acknowledged"], severities: ["Critical", "Warning"] } },
];

/* ------------------------------------------------------------------ */
/* Row action menu — portal-rendered, smart position, full keyboard     */
/* ------------------------------------------------------------------ */
const MENU_WIDTH = 200;
const MENU_HEIGHT_ESTIMATE = 200;

interface RowActionMenuProps {
  eventId: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAcknowledge: () => void;
  onAssign: () => void;
  onResolve: () => void;
  onCreateAlertRule: () => void;
  onCopyLink: () => void;
}

type MenuItem = { key: string; label: string; icon: typeof Check; run: () => void; dividerBefore?: boolean };

function RowActionMenu({ eventId, open, onToggle, onClose, onAcknowledge, onAssign, onResolve, onCreateAlertRule, onCopyLink }: RowActionMenuProps) {
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; openUp: boolean } | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  const items: MenuItem[] = [
    { key: "acknowledge", label: "Acknowledge", icon: Check, run: onAcknowledge },
    { key: "assign", label: "Assign", icon: UserRound, run: onAssign },
    { key: "resolve", label: "Resolve", icon: CheckCircle2, run: onResolve },
    { key: "alert", label: "Create alert rule", icon: Bell, run: onCreateAlertRule },
    { key: "copy", label: "Copy link", icon: Link2, run: onCopyLink, dividerBefore: true },
  ];

  const focusItem = (index: number) => {
    const target = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')[index];
    target?.focus();
  };

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const openUp = window.innerHeight - rect.bottom < MENU_HEIGHT_ESTIMATE + 8 && rect.top > window.innerHeight - rect.bottom;
    const top = openUp ? rect.top - MENU_HEIGHT_ESTIMATE - 6 : rect.bottom + 6;
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    setPosition({ top, left, openUp });
    setFocusIndex(0);
    onToggle();
  };

  const handleToggle = () => {
    if (open) onClose();
    else openMenu();
  };

  /* Reposition after open (measured) and move focus to the first item */
  useLayoutEffect(() => {
    if (!open || !position) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    const menuEl = menuRef.current;
    const menuHeight = menuEl?.offsetHeight ?? MENU_HEIGHT_ESTIMATE;
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < menuHeight + 8 && rect.top > spaceBelow;
      const top = openUp ? Math.max(8, rect.top - menuHeight - 6) : Math.min(rect.bottom + 6, window.innerHeight - menuHeight - 8);
      setPosition((prev) => (prev && (prev.top !== top || prev.openUp !== openUp) ? { top, left: prev.left, openUp } : prev));
    }
    focusItem(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Document-level close: outside pointer, Escape, scroll, resize */
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        buttonRef.current?.focus();
      }
    };
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    const onResize = () => onClose();
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, onClose]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const menuItems = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (menuItems.length === 0) return;
    const current = menuItems.findIndex((item) => item === document.activeElement);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusItem((current + 1 + menuItems.length) % menuItems.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusItem((current - 1 + menuItems.length) % menuItems.length);
        break;
      case "Home":
        event.preventDefault();
        focusItem(0);
        break;
      case "End":
        event.preventDefault();
        focusItem(menuItems.length - 1);
        break;
      case "Tab":
        onClose();
        break;
      default:
        break;
    }
  };

  const runItem = (item: MenuItem) => {
    item.run();
    onClose();
    buttonRef.current?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(click) => { click.stopPropagation(); handleToggle(); }}
        onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); handleToggle(); } }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Actions for ${eventId}`}
        title="Actions"
        className={cn(
          "grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-accent text-foreground",
        )}
      >
        <ChevronDown size={13} className={cn("rotate-[-90deg] transition-transform duration-150", open && "rotate-0")} aria-hidden="true" />
      </button>
      {open && position && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Actions for ${eventId}`}
          onKeyDown={onMenuKeyDown}
          className="motion-menu-in fixed z-[1400] w-[12.5rem] rounded-[0.625rem] border border-gray-200 bg-white p-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] outline-none dark:border-border dark:bg-popover"
          style={{ top: position.top, left: position.left, transformOrigin: position.openUp ? "bottom right" : "top right", ["--menu-slide" as string]: position.openUp ? "0.25rem" : "-0.25rem" }}
        >
          {items.map((item) => (
            <div key={item.key} role="presentation">
              {item.dividerBefore && <div role="separator" className="mx-1 my-1 h-px border-t border-gray-200 dark:border-border" />}
              <button
                type="button"
                role="menuitem"
                onClick={(click) => { click.stopPropagation(); runItem(item); }}
                className="flex h-9 w-full items-center gap-2.5 rounded-md px-3 text-left text-[0.8125rem] text-foreground transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none dark:hover:bg-accent dark:focus-visible:bg-accent"
              >
                <item.icon size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 truncate">{item.label}</span>
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Stat cards                                                          */
/* ------------------------------------------------------------------ */
const STAT_CARDS = [
  { label: "Total Events", value: formatCompact(EVENT_TOTALS.total), icon: Bell, tone: "bg-[#e2f0ff] text-[#1379e8] dark:bg-[#17385c] dark:text-[#5fb0ff]", delta: 142, pct: "6.1%", dir: "up" as const },
  { label: "Open Events", value: EVENT_TOTALS.open.toLocaleString("en-US"), icon: CircleAlert, tone: "bg-[#ffeaec] text-[#e83f4d] dark:bg-[#492a35] dark:text-[#ff8b98]", delta: 26, pct: "9.1%", dir: "down" as const },
  { label: "Resolved", value: formatCompact(EVENT_TOTALS.resolved), icon: CheckCircle2, tone: "bg-[#dff7eb] text-[#13a564] dark:bg-[#123a2a] dark:text-[#4fd69a]", delta: 118, pct: "7.4%", dir: "up" as const },
  { label: "Critical", value: EVENT_TOTALS.critical.toLocaleString("en-US"), icon: ShieldAlert, tone: "bg-[#ffeaec] text-[#e83f4d] dark:bg-[#492a35] dark:text-[#ff8b98]", delta: 8, pct: "6.9%", dir: "down" as const },
  { label: "Warning", value: EVENT_TOTALS.warning.toLocaleString("en-US"), icon: Shield, tone: "bg-[#fff1d7] text-[#dc941c] dark:bg-[#493a29] dark:text-[#ffc16e]", delta: 21, pct: "6.8%", dir: "down" as const },
  { label: "MTTR", value: `${EVENT_TOTALS.mttrMinutes}m`, icon: Activity, tone: "bg-[#f1eaff] text-[#874fe0] dark:bg-[#35264d] dark:text-[#bd98ff]", delta: -3, pct: "14.3%", dir: "down" as const },
];

const SEVERITY_FILTER_ORDER: Array<"All" | EventSeverity> = ["All", "Critical", "Warning", "Info"];
const STATUS_FILTER_ORDER: Array<"All" | EventStatus> = ["All", "Open", "Investigating", "Acknowledged", "Resolved"];
const SOURCE_OPTIONS = [ALL_SOURCES, "System", "Application", "Database", "Network", "Security", "Auth", "Cache", "Deployment"];
const HOST_OPTIONS = [ALL_HOSTS, ...new Set(EVENT_RECORDS.map((event) => event.host))];
const INFRA_OPTIONS = [ALL_INFRA, "Kubernetes", "Virtual Machine", "Network Device", "Database", "CI/CD Pipeline", "Storage Array"];
const CATEGORY_OPTIONS = [ALL_CATEGORY, ...new Set(EVENT_RECORDS.map((event) => event.category))].sort();
const LOCATION_OPTIONS = [ALL_LOC, ...EVENT_LOCATIONS.map((location) => location.name)];

const SEVERITY_SORT_RANK: Record<EventSeverity, number> = { Critical: 3, Warning: 2, Info: 1, Debug: 0 };
const STATUS_SORT_RANK: Record<EventStatus, number> = { Open: 3, Investigating: 2, Acknowledged: 1, Resolved: 0 };

export function EventsExplorerDashboard() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);
  const didInitURL = useRef(false);

  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [draft, setDraft] = useState<AppliedFilters>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<AppliedFilters>(DEFAULT_FILTERS);
  const [trendRange, setTrendRange] = useState<TrendRangeKey>("24H");
  const [hiddenSeverities, setHiddenSeverities] = useState<ReadonlySet<EventSeverity>>(new Set(["Debug"]));
  const [includeDebug, setIncludeDebug] = useState(false);
  const [brush, setBrush] = useState<{ start: number; end: number } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [statusOverrides, setStatusOverrides] = useState<Record<string, EventStatus>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [utcMode, setUtcMode] = useState(false);
  const [toast, setToast] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => readJSON(SAVED_KEY, [] as SavedView[]));

  useEffect(() => {
    const forced = typeof window !== "undefined" && window.location.search.includes("eventsError=1");
    const timer = window.setTimeout(() => setStatus(forced ? "error" : "ready"), 400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (didInitURL.current || typeof window === "undefined") return;
    didInitURL.current = true;
    const params = new URLSearchParams(window.location.search);
    const severities = (params.get("severities")?.split(",").filter(Boolean) as EventSeverity[] | undefined)?.filter((value) => ["Critical", "Warning", "Info", "Debug"].includes(value)) ?? [];
    const statuses = (params.get("statuses")?.split(",").filter(Boolean) as EventStatus[] | undefined)?.filter((value) => ["Open", "Investigating", "Acknowledged", "Resolved"].includes(value)) ?? [];
    const next: AppliedFilters = {
      ...DEFAULT_FILTERS,
      query: params.get("q") ?? "",
      severities,
      statuses,
      source: params.get("source") ?? ALL_SOURCES,
      host: params.get("host") ?? ALL_HOSTS,
      timeRange: params.get("time") ?? ALL_TIME,
      infrastructure: params.get("infra") ?? ALL_INFRA,
      location: params.get("location") ?? ALL_LOC,
      category: params.get("category") ?? ALL_CATEGORY,
      showDebug: params.get("debug") === "1",
    };
    setDraft(next);
    setApplied(next);
    if (next.showDebug) setIncludeDebug(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3200);
  };

  const syncURL = (f: AppliedFilters) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (f.query) params.set("q", f.query);
    if (f.severities.length) params.set("severities", f.severities.join(","));
    if (f.statuses.length) params.set("statuses", f.statuses.join(","));
    if (f.source !== ALL_SOURCES) params.set("source", f.source);
    if (f.host !== ALL_HOSTS) params.set("host", f.host);
    if (f.timeRange !== ALL_TIME) params.set("time", f.timeRange);
    if (f.infrastructure !== ALL_INFRA) params.set("infra", f.infrastructure);
    if (f.location !== ALL_LOC) params.set("location", f.location);
    if (f.category !== ALL_CATEGORY) params.set("category", f.category);
    if (f.showDebug) params.set("debug", "1");
    if (f.brush) { params.set("from", String(f.brush.from)); params.set("to", String(f.brush.to)); }
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  };

  const commit = (next: AppliedFilters, message?: string) => {
    setApplied(next);
    syncURL(next);
    setPage(1);
    if (message) notify(message);
  };

  const toggleSeverityFilter = (severity: EventSeverity) => {
    const nextLevels = draft.severities.includes(severity) ? draft.severities.filter((item) => item !== severity) : [...draft.severities, severity];
    const next = { ...draft, severities: nextLevels };
    setDraft(next);
    commit(next);
  };
  const toggleStatusFilter = (status: EventStatus) => {
    const nextStatuses = draft.statuses.includes(status) ? draft.statuses.filter((item) => item !== status) : [...draft.statuses, status];
    const next = { ...draft, statuses: nextStatuses };
    setDraft(next);
    commit(next);
  };
  const clearAllFilters = () => {
    setDraft(DEFAULT_FILTERS);
    setBrush(null);
    setSelected(new Set());
    commit(DEFAULT_FILTERS, "Event filters cleared.");
  };

  const resolveStatus = (event: EventRecord): EventStatus => statusOverrides[event.id] ?? event.status;

  const filteredEvents = useMemo(() => {
    const timeLimit = TIME_LIMIT_MINUTES[applied.timeRange] ?? Number.POSITIVE_INFINITY;
    const tokens = applied.query.toLowerCase().split(/\s+/).map((token) => token.trim()).filter(Boolean);
    const now = Date.now();
    return EVENT_RECORDS.filter((event) => {
      if (!applied.showDebug && event.severity === "Debug") return false;
      if (applied.severities.length > 0 && !applied.severities.includes(event.severity)) return false;
      const effectiveStatus = statusOverrides[event.id] ?? event.status;
      if (applied.statuses.length > 0 && !applied.statuses.includes(effectiveStatus)) return false;
      if (applied.source !== ALL_SOURCES && event.source !== applied.source) return false;
      if (applied.host !== ALL_HOSTS && event.host !== applied.host) return false;
      if (applied.infrastructure !== ALL_INFRA && event.infrastructure !== applied.infrastructure) return false;
      if (applied.location !== ALL_LOC && event.location !== applied.location) return false;
      if (applied.category !== ALL_CATEGORY && event.category !== applied.category) return false;
      if (applied.brush) {
        if (event.epochMs < applied.brush.from || event.epochMs > applied.brush.to) return false;
      } else if (timeLimit !== Number.POSITIVE_INFINITY && now - event.epochMs > timeLimit * 60_000) {
        return false;
      }
      if (tokens.length > 0) {
        const haystack = `${event.message} ${event.source} ${event.host} ${event.category} ${event.severity} ${event.location} ${event.infrastructure} ${event.id} ${event.database ?? ""}`.toLowerCase();
        for (const token of tokens) if (!haystack.includes(token)) return false;
      }
      return true;
    });
  }, [applied, statusOverrides]);

  const sortedEvents = useMemo(() => {
    const copy = [...filteredEvents];
    copy.sort((a, b) => {
      const leftStatus = statusOverrides[a.id] ?? a.status;
      const rightStatus = statusOverrides[b.id] ?? b.status;
      const diff = sortKey === "time"
        ? a.epochMs - b.epochMs
        : sortKey === "severity"
          ? SEVERITY_SORT_RANK[a.severity] - SEVERITY_SORT_RANK[b.severity]
          : STATUS_SORT_RANK[leftStatus] - STATUS_SORT_RANK[rightStatus];
      return sortDir === "asc" ? diff : -diff;
    });
    return copy;
  }, [filteredEvents, sortKey, sortDir, statusOverrides]);

  const pageCount = Math.max(1, Math.ceil(sortedEvents.length / perPage));
  const safePage = Math.min(page, pageCount);
  const pageEvents = sortedEvents.slice((safePage - 1) * perPage, safePage * perPage);
  const rangeStart = sortedEvents.length === 0 ? 0 : (safePage - 1) * perPage + 1;
  const rangeEnd = Math.min(safePage * perPage, sortedEvents.length);
  const displayTotal = isDefaultFilters(applied) ? EVENT_TOTALS.total : Math.round((EVENT_TOTALS.total * sortedEvents.length) / SAMPLE_TOTAL);

  const pageItems = useMemo<Array<number | "…">>(() => {
    const items: Array<number | "…"> = [];
    if (pageCount <= 7) {
      for (let index = 1; index <= pageCount; index += 1) items.push(index);
      return items;
    }
    items.push(1);
    if (safePage > 3) items.push("…");
    for (let index = Math.max(2, safePage - 1); index <= Math.min(pageCount - 1, safePage + 1); index += 1) items.push(index);
    if (safePage < pageCount - 2) items.push("…");
    items.push(pageCount);
    return items;
  }, [pageCount, safePage]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((value) => (value === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const highlightTerms = useMemo(() => applied.query.toLowerCase().split(/\s+/).map((token) => token.trim()).filter((term) => term.length >= 2), [applied.query]);
  const highlightQuery = (text: string) => <Highlight text={text} terms={highlightTerms} />;

  const toggleRow = (id: string) => setSelected((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleSelectPage = () => {
    const next = new Set(selected);
    const allSelected = pageEvents.length > 0 && pageEvents.every((event) => next.has(event.id));
    pageEvents.forEach((event) => { if (allSelected) next.delete(event.id); else next.add(event.id); });
    setSelected(next);
  };

  const bulkUpdate = (nextStatus: EventStatus) => {
    setStatusOverrides((previous) => { const next = { ...previous }; selected.forEach((id) => { next[id] = nextStatus; }); return next; });
    notify(`${selected.size} event${selected.size === 1 ? "" : "s"} marked as ${nextStatus.toLowerCase()} (mock).`);
    setSelected(new Set());
  };

  const exportFiltered = (format: "csv" | "json") => {
    if (sortedEvents.length === 0) { notify("Nothing to export with the current filters."); return; }
    const link = document.createElement("a");
    if (format === "json") {
      link.href = URL.createObjectURL(new Blob([JSON.stringify(sortedEvents, null, 2)], { type: "application/json" }));
      link.download = "events-export.json";
    } else {
      const header = "time,id,severity,status,message,source,host,category,location";
      const rows = sortedEvents.map((event) => [new Date(event.at).toISOString(), event.id, event.severity, resolveStatus(event), event.message, event.source, event.host, event.category, event.location]
        .map((field) => `"${String(field).replaceAll('"', '""')}"`).join(","));
      link.href = URL.createObjectURL(new Blob([[header, ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" }));
      link.download = "events-export.csv";
    }
    link.click();
    URL.revokeObjectURL(link.href);
    notify(`${sortedEvents.length} events exported as ${format.toUpperCase()}.`);
  };

  const saveCurrentView = () => {
    const name = draft.query ? (draft.query.length > 32 ? `${draft.query.slice(0, 32)}…` : draft.query) : `View ${savedViews.length + 1}`;
    const view: SavedView = { id: `view-${Date.now()}`, name, filters: { ...draft } };
    const next = [view, ...savedViews].slice(0, 8);
    setSavedViews(next);
    writeJSON(SAVED_KEY, next);
    notify(`Saved view "${name}" locally.`);
  };
  const applyView = (view: SavedView) => {
    setDraft(view.filters);
    commit({ ...view.filters }, `Applied view "${view.name}"`);
  };
  const removeView = (id: string) => setSavedViews((previous) => { const next = previous.filter((view) => view.id !== id); writeJSON(SAVED_KEY, next); return next; });

  const applyTrendBrush = (next: { start: number; end: number } | null) => {
    if (!next) return;
    const trend = EVENT_TRENDS[trendRange];
    const first = trend[next.start];
    const last = trend[next.end];
    if (!first || !last) return;
    const stepMs = trend.length > 1 ? trend[1].epochMs - trend[0].epochMs : 60_000;
    const nextDraft: AppliedFilters = { ...draft, timeRange: "Custom range", brush: { from: first.epochMs, to: last.epochMs + stepMs - 1 } };
    setBrush(next);
    setDraft(nextDraft);
    commit(nextDraft, `Time range set to ${first.label} – ${last.label}`);
  };

  const selectRangeTab = (key: TrendRangeKey) => {
    setTrendRange(key);
    setBrush(null);
    const next: AppliedFilters = { ...draft, timeRange: RANGE_TEXT[key], brush: null };
    setDraft(next);
    commit(next);
  };

  const resetZoom = () => {
    setBrush(null);
    commit({ ...draft, timeRange: RANGE_TEXT[trendRange], brush: null }, "Zoom reset.");
  };

  const toggleSeries = (severity: EventSeverity) => {
    setHiddenSeverities((previous) => {
      const next = new Set(previous);
      if (next.has(severity)) next.delete(severity);
      else next.add(severity);
      return next;
    });
  };

  const toggleDebugVisibility = () => {
    const showDebug = !draft.showDebug;
    const next = { ...draft, showDebug };
    setDraft(next);
    setIncludeDebug(showDebug);
    commit(next, showDebug ? "Debug events shown." : "Debug events hidden.");
  };

  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);

  const trendSummary = useMemo(() => {
    const trend = EVENT_TRENDS[trendRange];
    const total = trend.reduce((sum, bucket) => sum + bucket.total, 0);
    const critical = trend.reduce((sum, bucket) => sum + bucket.critical, 0);
    const peak = trend.reduce((best, bucket) => (bucket.total > best.total ? bucket : best), trend[0]);
    const peakTime = new Date(peak.epochMs).toLocaleTimeString("en-US", { hour: "numeric" });
    const errorRate = total > 0 ? (critical / total) * 100 : 0;
    return { total, peakTime, errorRate };
  }, [trendRange]);

  const notableSpikes = useMemo(() => {
    const trend = EVENT_TRENDS[trendRange];
    return trend
      .map((bucket, index) => ({ ...bucket, index }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
      .sort((a, b) => b.epochMs - a.epochMs)
      .map((bucket) => {
        const dominant = (["critical", "warning", "info", "debug"] as const).reduce((best, key) => (bucket[key] > bucket[best] ? key : best), "critical" as const);
        return { ...bucket, dominant: (dominant.charAt(0).toUpperCase() + dominant.slice(1)) as EventSeverity };
      });
  }, [trendRange]);

  const zoomToBucket = (index: number, label: string) => {
    const trend = EVENT_TRENDS[trendRange];
    const first = trend[index];
    const stepMs = trend.length > 1 ? trend[1].epochMs - trend[0].epochMs : 60_000;
    const nextDraft: AppliedFilters = { ...draft, timeRange: "Custom range", brush: { from: first.epochMs, to: first.epochMs + stepMs - 1 } };
    setBrush({ start: index, end: index });
    setDraft(nextDraft);
    commit(nextDraft, `Zoomed to ${label}`);
  };

  const savedViewList = [...BUILTIN_VIEWS, ...savedViews];
  const visibleTotal = (["Critical", "Warning", "Info", "Debug"] as EventSeverity[]).filter((name) => !hiddenSeverities.has(name)).reduce((sum, name) => sum + EVENT_SEVERITY_COUNTS[name], 0);

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Monitoring", "Event Explorer"]}
        title="Event Explorer"
        subtitle="Search, filter and explore infrastructure events across your environment."
        icon={<Bell size={19} />}
        onRefresh={() => { setStatus("loading"); window.setTimeout(() => setStatus("ready"), 400); }}
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <details className="relative">
              <summary aria-label="Saved views" title="Saved views" className="inline-flex h-10 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent [&::-webkit-details-marker]:hidden"><Bookmark size={15} aria-hidden="true" />Saved Views<ChevronDown size={14} className="text-muted-foreground" aria-hidden="true" /></summary>
              <div className="absolute right-0 z-30 mt-2 w-60 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
                <p className="px-2 py-1 text-[0.75rem] font-semibold uppercase tracking-wide text-muted-foreground">Views</p>
                {savedViewList.map((view) => (
                  <button key={view.id} type="button" onClick={() => applyView(view)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.8125rem] font-medium text-foreground hover:bg-accent">
                    <span className="min-w-0 flex-1 truncate">{view.name}</span>
                    {!view.builtin && (
                      <span role="button" aria-label={`Delete ${view.name}`} onClick={(event) => { event.stopPropagation(); event.preventDefault(); removeView(view.id); }} className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"><X size={11} aria-hidden="true" /></span>
                    )}
                  </button>
                ))}
                <div className="mt-1 border-t border-border pt-1">
                  <button type="button" onClick={saveCurrentView} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.8125rem] font-medium text-primary hover:bg-accent"><Plus size={13} aria-hidden="true" />Save current view</button>
                </div>
              </div>
            </details>
            <Button variant="outline" onClick={() => exportFiltered("csv")} className="h-10 gap-1.5 rounded-lg px-3 text-sm"><Download size={15} />Export</Button>
            <Button className="h-10 gap-1.5 rounded-lg px-3 text-sm"><Plus size={15} />Create Alert Rule</Button>
          </div>
        }
      />

      {status === "error" ? (
        <section role="alert" className="grid min-h-[20rem] place-items-center rounded-xl border border-border bg-card p-8 text-center">
          <div className="flex max-w-md flex-col items-center gap-3">
            <CircleAlert size={28} className="text-rose-500" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-foreground">Events could not be loaded</h2>
            <p className="text-sm text-muted-foreground">The event stream failed to load for your filters. Retry to fetch it again.</p>
            <Button onClick={() => { setStatus("loading"); window.setTimeout(() => setStatus("ready"), 400); }} className="h-10 rounded-lg px-4 text-sm">Retry</Button>
          </div>
        </section>
      ) : (<>
      <section aria-label="Event summary" className="grid grid-cols-2 items-stretch gap-4 md:grid-cols-3 xl:grid-cols-6">
        {STAT_CARDS.map((item) => (
          <StatCard key={item.label} icon={<item.icon size={20} aria-hidden="true" />} iconTone={item.tone} label={item.label} value={item.value} delta={item.delta} deltaPercent={item.pct} goodDirection={item.dir} />
        ))}
      </section>

      <section aria-label="Events trend and severity" className="grid items-stretch gap-4 xl:grid-cols-[1.65fr_1fr]">
        <Panel
          title="Events Trend"
          className="flex h-full min-w-0 flex-col rounded-xl p-5"
          titleClassName="text-[1rem] font-semibold"
          action={brush ? <button type="button" onClick={resetZoom} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent">Reset zoom</button> : undefined}
        >
          <div className="flex flex-1 flex-col pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex h-8 items-center rounded-lg border border-border p-0.5" role="group" aria-label="Trend range">
                {TREND_RANGE_ORDER.map((key) => (
                  <button key={key} type="button" aria-pressed={trendRange === key} onClick={() => selectRangeTab(key)} className={cn("h-7 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", trendRange === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>{key}</button>
                ))}
              </div>
              <span className="hidden text-[0.75rem] text-muted-foreground xl:block">Drag to select a window · click a bar to isolate it</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Toggle severity series">
              {(["Critical", "Warning", "Info", "Debug"] as EventSeverity[]).map((severity) => {
                const hidden = hiddenSeverities.has(severity);
                const count = EVENT_TRENDS[trendRange].reduce((sum, bucket) => sum + bucket[severity.toLowerCase() as "critical"], 0);
                return (
                  <button key={severity} type="button" aria-pressed={!hidden} onClick={() => toggleSeries(severity)} title={`${hidden ? "Show" : "Hide"} ${severity} series`} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", hidden ? "border-transparent bg-muted text-muted-foreground opacity-60 line-through" : "border-border bg-card text-foreground")}>
                    <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: hidden ? "#94a3b8" : SEVERITY_COLORS[severity] }} />
                    {severity}
                    <b className="tabular-nums">{formatCompact(count)}</b>
                  </button>
                );
              })}
            </div>
            <div className="mt-2">
              {status === "loading" ? <div className="h-[13.125rem] w-full animate-pulse rounded-lg bg-muted" role="status" aria-label="Loading event trend" /> : <TrendChart data={EVENT_TRENDS[trendRange]} hidden={hiddenSeverities} brush={brush} onBrush={applyTrendBrush} highlightIndex={highlightIndex} />}
            </div>

            {visibleTotal === 0 ? (
              <p className="mt-6 text-center text-[0.8125rem] text-muted-foreground">No events in this range</p>
            ) : (<>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Trend summary statistics">
                {[
                  { label: "Total Events", value: visibleTotal.toLocaleString("en-US"), icon: Bell, spark: EVENT_TRENDS[trendRange].map((bucket) => bucket.total), stroke: "#94A3B8" },
                  { label: "Peak Hour", value: trendSummary.peakTime, icon: Clock, spark: EVENT_TRENDS[trendRange].map((bucket) => bucket.critical), stroke: "#94A3B8" },
                  { label: "Error Rate", value: `${trendSummary.errorRate.toFixed(1)}%`, icon: ShieldAlert, spark: EVENT_TRENDS[trendRange].map((bucket) => (bucket.total > 0 ? (bucket.critical / bucket.total) * 100 : 0)), stroke: "#DC2626" },
                ].map((tile) => (
                  <div key={tile.label} className="flex h-[5.25rem] min-w-0 flex-col justify-between rounded-lg border border-border bg-card p-2">
                    <span className="flex items-center gap-1.5 truncate text-[0.75rem] font-medium text-muted-foreground"><tile.icon size={12} aria-hidden="true" className="shrink-0" />{tile.label}</span>
                    <div className="flex items-end justify-between gap-1.5">
                      <b className="text-[1rem] tabular-nums text-foreground">{tile.value}</b>
                      <Sparkline values={tile.spark} stroke={tile.stroke} />
                    </div>
                  </div>
                ))}
                <div className="flex h-[5.25rem] min-w-0 flex-col justify-between rounded-lg border border-border bg-card p-2">
                  <span className="flex items-center gap-1.5 truncate text-[0.75rem] font-medium text-muted-foreground"><ArrowUpRight size={12} aria-hidden="true" className="shrink-0 text-rose-500" />vs Previous 24H</span>
                  <div className="flex items-end justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[0.75rem] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"><ArrowUpRight size={11} aria-hidden="true" />6%</span>
                    <span className="flex flex-col items-end"><Sparkline values={EVENT_TRENDS[trendRange].map((bucket) => bucket.total)} stroke="#94A3B8" /><span className="text-[0.75rem] text-muted-foreground">vs yesterday</span></span>
                  </div>
                </div>
              </div>

              <div className="mt-2" aria-label="Notable spikes">
                <div className="mb-1 flex items-center justify-between gap-2 border-b border-border pb-1">
                  <span className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Notable Spikes</span>
                  <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[0.75rem] font-medium text-muted-foreground">Top 3</span>
                </div>
                <ul className="flex flex-col divide-y divide-border">
                  {notableSpikes.map((spike, index) => {
                    const maxSpike = Math.max(...notableSpikes.map((entry) => entry.total), 1);
                    const hue = DB_SOURCE_HUES[index % DB_SOURCE_HUES.length];
                    return (
                      <li key={`${spike.epochMs}`}>
                        <button
                          type="button"
                          onClick={() => zoomToBucket(spike.index, spike.label)}
                          onMouseEnter={() => setHighlightIndex(spike.index)}
                          onMouseLeave={() => setHighlightIndex(null)}
                          onFocus={() => setHighlightIndex(spike.index)}
                          onBlur={() => setHighlightIndex(null)}
                          aria-label={`Zoom chart to ${spike.label}, ${spike.total} events, ${spike.dominant} dominant`}
                          className="grid h-9 w-full grid-cols-[64px_72px_minmax(0,1fr)_auto_1.5rem] items-center gap-2 rounded-md px-1 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="whitespace-nowrap text-[0.8125rem] font-medium tabular-nums text-foreground">{spike.label}</span>
                          <span className="text-[0.8125rem] tabular-nums text-muted-foreground">{spike.total.toLocaleString("en-US")} ev</span>
                          <span className="h-1.5 min-w-0 overflow-hidden rounded-full bg-[#EEF0F4] dark:bg-slate-700"><span className="block h-full rounded-full transition-all duration-300" style={{ width: `${(spike.total / maxSpike) * 100}%`, background: hue.bar }} /></span>
                          <span className={cn("inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-xs font-semibold", SEVERITY_BADGE[spike.dominant])}>{spike.dominant}</span>
                          <ArrowRight size={14} className="justify-self-end text-muted-foreground" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>)}
            <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2 text-[0.75rem] text-muted-foreground">
              <span className="flex items-center gap-1.5"><RefreshCw size={12} aria-hidden="true" className="shrink-0" />Last updated: just now · Auto-refresh 30s</span>
              <button type="button" onClick={() => notify("Events refreshed.")} className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><RefreshCw size={12} aria-hidden="true" />Refresh</button>
            </div>
          </div>
        </Panel>

        <Panel
          title="Events by Severity"
          className="flex h-full min-w-0 flex-col rounded-xl p-4"
          titleClassName="text-[1rem] font-semibold"
          action={<button type="button" aria-pressed={includeDebug} onClick={toggleDebugVisibility} className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", includeDebug ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}>Include Debug</button>}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1">
            <SeverityDonut includeDebug={includeDebug} onToggleSeverity={toggleSeverityFilter} activeSeverities={new Set(applied.severities)} />
            <SeverityWeekTrend activeSeverities={new Set(applied.severities)} />
            <TopDatabaseSources activeSeverities={new Set(applied.severities)} onSelect={(name) => commit({ ...draft, query: name }, `Filtered to ${name}`)} />
            <QuickInsightStrip />
            <ResolutionStatus onOpenFilter={() => commit({ ...draft, statuses: ["Open"] }, "Filtered to open events")} />
            <div className="mt-auto border-t border-border pt-2 text-[0.75rem] text-muted-foreground">Debug events hidden by default. Click a severity cell to filter the table.</div>
          </div>
        </Panel>
      </section>

      <section aria-label="Event sources, hosts and recent events" className="grid items-stretch gap-4 xl:grid-cols-3">
        <Panel title="Top Event Sources" className="flex h-full min-w-0 flex-col rounded-xl p-5" titleClassName="text-[1rem] font-semibold" action={<button type="button" onClick={() => notify("Full source breakdown is a mock view.")} className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-primary hover:underline">View all <ArrowRight size={14} aria-hidden="true" /></button>}>
          <BreakdownBarList rows={EVENT_SOURCES} trends={SOURCE_TRENDS} iconFor={(name, index, iconColor) => { const Icon = SOURCE_ICONS[name] ?? Bell; return <Icon size={13} className={cn("shrink-0", iconColor)} aria-hidden="true" />; }} onSelect={(name) => commit({ ...draft, source: name }, `Filtered to ${name}`)} headerLabel="SOURCE" severityBreakdown={EVENT_SOURCE_SEVERITY} />
          <div className="mt-auto border-t border-border pt-2">
            <DistributionBar rows={EVENT_SOURCES} />
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.75rem] text-muted-foreground">
              <span>Peak source: <b className="font-semibold text-foreground">{EVENT_SOURCES[0].name} ({EVENT_SOURCES[0].pct.toFixed(1)}%)</b></span>
              <span aria-hidden="true">·</span>
              <span>Total sources: <b className="tabular-nums font-semibold text-foreground">{EVENT_SOURCES.length}</b></span>
              <span aria-hidden="true">·</span>
              <span>Last 7 days · <b className="tabular-nums font-semibold text-foreground">{formatCompact(EVENT_TOTALS.total)}</b> events</span>
            </div>
          </div>
        </Panel>
        <Panel title="Events by Host" className="flex h-full min-w-0 flex-col rounded-xl p-5" titleClassName="text-[1rem] font-semibold" action={<button type="button" onClick={() => notify("Full host breakdown is a mock view.")} className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-primary hover:underline">View all <ArrowRight size={14} aria-hidden="true" /></button>}>
          <BreakdownBarList rows={EVENT_HOSTS} trends={HOST_TRENDS} onSelect={(name) => commit({ ...draft, host: name }, `Filtered to ${name}`)} headerLabel="HOST" severityBreakdown={EVENT_HOST_SEVERITY} />
          <div className="mt-auto border-t border-border pt-2">
            <DistributionBar rows={EVENT_HOSTS} />
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.75rem] text-muted-foreground">
              <span>Busiest host: <b className="font-semibold text-foreground">{EVENT_HOSTS[0].name} ({EVENT_HOSTS[0].pct.toFixed(1)}%)</b></span>
              <span aria-hidden="true">·</span>
              <span>Total hosts: <b className="tabular-nums font-semibold text-foreground">{EVENT_HOSTS.length}</b></span>
              <span aria-hidden="true">·</span>
              <span>Last 7 days · <b className="tabular-nums font-semibold text-foreground">{formatCompact(EVENT_TOTALS.total)}</b> events</span>
            </div>
          </div>
        </Panel>
        <Panel title="Recent Events" className="flex h-full min-w-0 flex-col rounded-xl p-4" titleClassName="text-[1rem] font-semibold" action={<button type="button" onClick={() => commit({ ...DEFAULT_FILTERS })} className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-primary hover:underline">View all <ArrowRight size={14} aria-hidden="true" /></button>}>
          <ul className="flex flex-1 flex-col justify-between gap-0.5 pt-1">
            {EVENT_RECORDS.slice(0, 8).map((event) => {
              const StatusIcon = STATUS_META[resolveStatus(event)].icon;
              return (
                <li key={event.id}>
                  <Link href={`/events-explorer/${event.id}`} className="grid h-11 grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <time className="whitespace-nowrap text-[0.75rem] tabular-nums text-muted-foreground" dateTime={event.at}>{relativeTime(event.epochMs)}</time>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold", SEVERITY_BADGE[event.severity])}><i aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", SEVERITY_DOT[event.severity])} />{event.severity}</span>
                      <span className="min-w-0 truncate text-[0.8125rem] text-foreground" title={event.message}>{event.message}</span>
                    </span>
                    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-xs font-semibold", STATUS_META[resolveStatus(event)].className)}><StatusIcon size={11} aria-hidden="true" />{resolveStatus(event)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto border-t border-border pt-2 text-[0.75rem] text-muted-foreground">Latest {Math.min(8, EVENT_RECORDS.length)} of {EVENT_TOTALS.total.toLocaleString("en-US")} events</div>
        </Panel>
      </section>

      <section aria-label="Event filters" className="rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Severity filter">
            {SEVERITY_FILTER_ORDER.map((severity) => {
              const isAll = severity === "All";
              const active = isAll ? draft.severities.length === 0 : draft.severities.includes(severity);
              const count = isAll ? EVENT_TOTALS.total : EVENT_SEVERITY_COUNTS[severity];
              return (
                <button key={severity} type="button" aria-pressed={active} onClick={() => { if (isAll) { const next = { ...draft, severities: [] }; setDraft(next); commit(next); } else toggleSeverityFilter(severity); }} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent")}>
                  {isAll ? "All" : severity} <b className="tabular-nums">{formatCompact(count)}</b>
                </button>
              );
            })}
          </div>
          <span aria-hidden="true" className="hidden h-6 w-px bg-border md:block" />
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Status filter">
            {STATUS_FILTER_ORDER.map((status) => {
              const isAll = status === "All";
              const active = isAll ? draft.statuses.length === 0 : draft.statuses.includes(status as EventStatus);
              return (
                <button key={status} type="button" aria-pressed={active} onClick={() => { if (isAll) { const next = { ...draft, statuses: [] }; setDraft(next); commit(next); } else toggleStatusFilter(status as EventStatus); }} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent")}>
                  {status}
                </button>
              );
            })}
          </div>
          <span aria-hidden="true" className="hidden h-6 w-px bg-border md:block" />
          <Select value={draft.source} onValueChange={(value) => { const next = { ...draft, source: value }; setDraft(next); commit(next); }}>
            <SelectTrigger aria-label="Source" className="h-9 min-w-[8.75rem] rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{SOURCE_OPTIONS.map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={draft.host} onValueChange={(value) => { const next = { ...draft, host: value }; setDraft(next); commit(next); }}>
            <SelectTrigger aria-label="Host" className="h-9 min-w-[8.75rem] rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{HOST_OPTIONS.map((host) => <SelectItem key={host} value={host}>{host}</SelectItem>)}</SelectContent>
          </Select>
          <span className="relative min-w-[13.75rem] flex-1 sm:flex-none">
            <Input ref={searchRef} value={draft.query} onChange={(event) => setDraft((prev) => ({ ...prev, query: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") commit({ ...draft }, "Filters applied."); }} placeholder="Search events, hosts, sources..." aria-label="Search events. Press slash to focus." className="h-9 rounded-lg pr-12 text-sm" />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground" aria-hidden="true">/</kbd>
          </span>
          <Button variant="outline" onClick={() => setAdvancedOpen((value) => !value)} aria-expanded={advancedOpen} className="h-9 gap-1.5 rounded-lg px-3 text-sm"><ListChecks size={14} />Advanced Filters<ChevronDown size={13} className={cn("transition-transform", advancedOpen && "rotate-180")} aria-hidden="true" /></Button>
          <button type="button" onClick={() => commit({ ...draft }, "Filters applied.")} className="h-9 rounded-lg px-3 text-sm font-medium text-primary hover:underline">Apply</button>
        </div>
        {advancedOpen && (
          <div className="mt-3 grid grid-cols-1 gap-2 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="min-w-0 space-y-1.5">
              <span className="text-sm font-medium text-foreground">Time Range</span>
              <Select value={draft.timeRange} onValueChange={(value) => { if (value !== "Custom range") setBrush(null); const next = { ...draft, timeRange: value, brush: value === "Custom range" ? draft.brush : null }; setDraft(next); commit(next); }}>
                <SelectTrigger aria-label="Time Range" className="h-9 w-full rounded-lg text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{[...TIME_RANGES, ...(draft.timeRange === "Custom range" ? ["Custom range"] : [])].map((range) => <SelectItem key={range} value={range}>{range}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="min-w-0 space-y-1.5">
              <span className="text-sm font-medium text-foreground">Infrastructure Type</span>
              <Select value={draft.infrastructure} onValueChange={(value) => { const next = { ...draft, infrastructure: value }; setDraft(next); commit(next); }}>
                <SelectTrigger aria-label="Infrastructure Type" className="h-9 w-full rounded-lg text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{INFRA_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="min-w-0 space-y-1.5">
              <span className="text-sm font-medium text-foreground">Location</span>
              <Select value={draft.location} onValueChange={(value) => { const next = { ...draft, location: value }; setDraft(next); commit(next); }}>
                <SelectTrigger aria-label="Location" className="h-9 w-full rounded-lg text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{LOCATION_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="min-w-0 space-y-1.5">
              <span className="text-sm font-medium text-foreground">Category</span>
              <Select value={draft.category} onValueChange={(value) => { const next = { ...draft, category: value }; setDraft(next); commit(next); }}>
                <SelectTrigger aria-label="Category" className="h-9 w-full rounded-lg text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORY_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
              <Button size="sm" onClick={() => commit({ ...draft }, "Filters applied.")} className="h-9 gap-1.5 rounded-lg px-4 text-sm">Apply</Button>
              <button type="button" onClick={clearAllFilters} className="text-sm font-medium text-primary hover:underline">Reset</button>
            </div>
          </div>
        )}
      </section>

      <Panel
        title={`All Events (${status === "loading" ? "…" : (isDefaultFilters(applied) ? EVENT_TOTALS.total : sortedEvents.length).toLocaleString("en-US")})`}
        className="flex min-w-0 flex-col rounded-xl p-4"
        titleClassName="text-[1rem] font-semibold"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-8 items-center rounded-lg border border-border p-0.5" role="group" aria-label="Time zone">
              {([{ key: "Local", value: false }, { key: "UTC", value: true }] as const).map((mode) => (
                <button key={mode.key} type="button" aria-pressed={utcMode === mode.value} onClick={() => setUtcMode(mode.value)} className={cn("h-7 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", utcMode === mode.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>{mode.key}</button>
              ))}
            </div>
            <span className="text-[0.75rem] text-muted-foreground">({utcMode ? "UTC" : "local time"})</span>
            <button type="button" aria-pressed={draft.showDebug} onClick={toggleDebugVisibility} className={cn("h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", draft.showDebug ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}>Show debug</button>
          </div>
          <details className="relative">
            <summary aria-label="Export" title="Export" className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent [&::-webkit-details-marker]:hidden"><Download size={12} aria-hidden="true" />Export<ChevronDown size={12} className="text-muted-foreground" aria-hidden="true" /></summary>
            <div className="absolute right-0 z-30 mt-2 w-44 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
              <button type="button" onClick={() => exportFiltered("csv")} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-accent"><FileText size={13} className="text-muted-foreground" aria-hidden="true" />Export CSV</button>
              <button type="button" onClick={() => exportFiltered("json")} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-accent"><FileJson size={13} className="text-muted-foreground" aria-hidden="true" />Export JSON</button>
            </div>
          </details>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-primary/5 px-2 py-1.5 text-[0.8125rem] font-medium text-foreground">
            <span><b className="tabular-nums">{selected.size}</b> selected</span>
            <span className="flex items-center gap-3">
              <button type="button" onClick={() => bulkUpdate("Acknowledged")} className="font-semibold text-primary hover:underline">Acknowledge</button>
              <button type="button" onClick={() => bulkUpdate("Resolved")} className="font-semibold text-primary hover:underline">Resolve</button>
              <button type="button" onClick={() => exportFiltered("csv")} className="font-semibold text-primary hover:underline">Export</button>
              <button type="button" onClick={() => setSelected(new Set())} className="text-muted-foreground hover:text-foreground">Clear</button>
            </span>
          </div>
        )}

        <div className="overflow-x-auto pt-1">
          <table className="w-full min-w-[57.5rem] text-left text-[0.8125rem]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="w-8 px-2 py-2"><input type="checkbox" aria-label="Select events on this page" className="accent-primary" checked={pageEvents.length > 0 && pageEvents.every((event) => selected.has(event.id))} onChange={toggleSelectPage} /></th>
                {([["time", "Time"], ["severity", "Severity"], ["", "Event Message"], ["", "Source"], ["", "Host"], ["", "Category"], ["status", "Status"], ["", "Count"], ["", "Actions"]] as Array<[SortKey | "", string]>).map(([key, label], index) => key ? (
                  <th key={label + index} aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : undefined} className="whitespace-nowrap px-2 py-2 text-left font-semibold">
                    <button type="button" onClick={() => toggleSort(key)} className="flex items-center gap-1 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{label}<ChevronDown size={12} aria-hidden="true" className={cn("transition-transform", sortKey === key && sortDir === "asc" && "rotate-180", sortKey !== key && "opacity-40")} /></button>
                  </th>
                ) : (
                  <th key={label + index} className="whitespace-nowrap px-2 py-2 text-left font-semibold">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {status === "loading" && Array.from({ length: 8 }, (_, index) => (
                <tr key={`skeleton-${index}`} className="border-b border-border/60 last:border-0">
                  {Array.from({ length: 10 }, (_, col) => <td key={col} className="px-2 py-2"><div className="h-4 animate-pulse rounded bg-muted" style={{ width: `${45 + ((index * 11 + col * 23) % 40)}%` }} /></td>)}
                </tr>
              ))}
              {status === "ready" && pageEvents.map((event) => {
                const eventStatus = resolveStatus(event);
                const StatusIcon = STATUS_META[eventStatus].icon;
                const SeverityIcon = SEVERITY_ICON[event.severity];
                const expanded = expandedId === event.id;
                return (<Fragment key={event.id}>
                  <tr
                    tabIndex={0}
                    role="link"
                    onClick={(click) => { if ((click.target as HTMLElement).closest("button,a,input,select,details")) return; router.push(`/events-explorer/${event.id}`); }}
                    onKeyDown={(keyEvent) => { if (keyEvent.key === "Enter") router.push(`/events-explorer/${event.id}`); }}
                    aria-label={`Open event ${event.id}: ${event.message}`}
                    className="cursor-pointer border-b border-border/70 align-middle transition-colors last:border-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <td className="px-2 py-1.5"><input type="checkbox" aria-label={`Select event ${event.id}`} className="accent-primary" checked={selected.has(event.id)} onChange={() => toggleRow(event.id)} onClick={(click) => click.stopPropagation()} /></td>
                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-foreground" title={fullTimestamp(event.epochMs, utcMode)}><time dateTime={event.at}>{relativeTime(event.epochMs)}</time></td>
                    <td className="whitespace-nowrap px-2 py-1.5"><span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", SEVERITY_BADGE[event.severity])}><SeverityIcon size={11} aria-hidden="true" />{event.severity}</span></td>
                    <td className="max-w-[17.5rem] whitespace-nowrap px-2 py-1.5 text-foreground" title={event.message}><span className="block truncate">{highlightQuery(event.message)}</span></td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-foreground">{event.source}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-foreground">{event.host}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{event.category}</td>
                    <td className="whitespace-nowrap px-2 py-1.5"><span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_META[eventStatus].className)}><StatusIcon size={11} aria-hidden="true" />{eventStatus}</span></td>
                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-foreground">
                      <button type="button" onClick={(click) => { click.stopPropagation(); setExpandedId((current) => (current === event.id ? null : event.id)); }} aria-expanded={expanded} aria-label={expanded ? "Collapse occurrences" : `${event.count} occurrences, expand`} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10">×{event.count}<ChevronDown size={11} className={cn("transition-transform", expanded && "rotate-180")} aria-hidden="true" /></button>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5" onClick={(click) => click.stopPropagation()}>
                      <span className="flex items-center gap-1">
                        <Link href={`/events-explorer/${event.id}`} className="whitespace-nowrap font-semibold text-primary hover:underline">View</Link>
                        <RowActionMenu
                          eventId={event.id}
                          open={openMenuId === event.id}
                          onToggle={() => setOpenMenuId((current) => (current === event.id ? null : event.id))}
                          onClose={() => setOpenMenuId(null)}
                          onAcknowledge={() => { setStatusOverrides((prev) => ({ ...prev, [event.id]: "Acknowledged" })); notify(`${event.id} acknowledged.`); }}
                          onAssign={() => notify(`${event.id} assigned (mock).`)}
                          onResolve={() => { setStatusOverrides((prev) => ({ ...prev, [event.id]: "Resolved" })); notify(`${event.id} marked resolved.`); }}
                          onCreateAlertRule={() => notify(`Alert rule created from ${event.id} (mock).`)}
                          onCopyLink={() => { void navigator.clipboard?.writeText(`${window.location.origin}/events-explorer/${event.id}`).catch(() => undefined); notify("Link copied"); }}
                        />
                      </span>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-border bg-muted/20">
                      <td colSpan={10} className="px-3 py-2">
                        <p className="mb-1 text-[0.75rem] font-semibold uppercase tracking-wide text-muted-foreground">Occurrences ({event.occurrences.length} shown of {event.count})</p>
                        <ul className="flex max-h-28 flex-wrap gap-1.5 overflow-auto">
                          {event.occurrences.map((occurrence, index) => (
                            <li key={index} className="rounded-md border border-border bg-card px-2 py-0.5 text-[0.75rem] tabular-nums text-muted-foreground" title={fullTimestamp(Date.parse(occurrence.at), utcMode)}>{new Date(occurrence.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>);
              })}
              {status === "ready" && pageEvents.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-10 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <SearchX size={26} className="text-muted-foreground" aria-hidden="true" />
                      <p className="text-sm font-semibold text-foreground">No events match your filters</p>
                      <p className="text-[0.75rem] text-muted-foreground">Try removing a filter or widening the time range.</p>
                      <Button variant="outline" size="sm" onClick={clearAllFilters} className="h-9 rounded-lg px-3 text-xs">Clear filters</Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.8125rem] text-muted-foreground">Showing <b className="tabular-nums text-foreground">{rangeStart}–{rangeEnd}</b> of <b className="tabular-nums text-foreground">{displayTotal.toLocaleString("en-US")}</b> events</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.75rem] text-muted-foreground">Rows per page</span>
            <Select value={String(perPage)} onValueChange={(value) => { setPerPage(Number(value)); setPage(1); }}>
              <SelectTrigger aria-label="Rows per page" className="h-8 w-[4.75rem] rounded-lg text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{[10, 25, 50].map((option) => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}</SelectContent>
            </Select>
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1} aria-label="Previous page" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronLeft size={14} aria-hidden="true" /></button>
            {pageItems.map((item, index) => item === "…"
              ? <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground">…</span>
              : <button key={item} type="button" onClick={() => setPage(item)} aria-label={`Page ${item}`} aria-current={item === safePage ? "page" : undefined} className={cn("h-8 w-8 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", item === safePage ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-accent")}>{item}</button>)}
            <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={safePage === pageCount} aria-label="Next page" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronRight size={14} aria-hidden="true" /></button>
          </div>
        </div>
      </Panel>

      <section aria-label="Event locations and activity" className="grid items-stretch gap-4 xl:grid-cols-2">
        <Panel title="Events by Location" className="flex h-full min-w-0 flex-col rounded-xl p-4" titleClassName="text-[1rem] font-semibold" action={<button type="button" onClick={() => notify("Full location breakdown is a mock view.")} className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-primary hover:underline">View all <ArrowRight size={14} aria-hidden="true" /></button>}>
          <BreakdownBarList rows={EVENT_LOCATIONS} />
          <div className="mt-auto border-t border-border pt-2 text-[0.75rem] text-muted-foreground">Top {EVENT_LOCATIONS.length} regions by event volume · last 7 days</div>
        </Panel>
        <Panel title="Event Activity Heatmap" className="flex h-full min-w-0 flex-col rounded-xl p-4" titleClassName="text-[1rem] font-semibold" action={<span className="text-[0.75rem] text-muted-foreground">Last 7 days · hourly</span>}>
          <ActivityHeatmap />
          <div className="mt-auto border-t border-border pt-2 text-[0.75rem] text-muted-foreground">Darker cells = more events · hover a cell for the exact count</div>
        </Panel>
      </section>
      </>)}

      {toast && <div role="status" className="fixed bottom-4 right-4 z-[1300] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-lg">{toast}</div>}
    </div>
  );
}
