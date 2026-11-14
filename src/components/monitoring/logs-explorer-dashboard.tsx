"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart, PieChart } from "echarts/charts";
import { BrushComponent, GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, Bookmark, ChevronDown, ChevronLeft, ChevronRight,
  CircleAlert, Clock, Columns3, Copy, Download, FileJson, FileText, Plus, RotateCcw,
  Rows3, Save, ScrollText, Search, SearchX, ShieldAlert, SlidersHorizontal, Trash2, TriangleAlert, WrapText, X,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/shared/panel";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLogs } from "@/mocks/useLogs";
import {
  LEVEL_COUNTS, LOG_ENVIRONMENTS, LOG_HOSTS, LOG_SERVICES, LOG_SOURCES, LOG_TOTALS, LOG_TRENDS,
  NOISY_LOG_SOURCES,
  RANGE_TEXT, TREND_RANGE_ORDER, TOP_ERROR_PATTERNS, TOP_SERVICES_BY_ERRORS, createLiveLog,
  formatClock, formatCompact, formatFull, fullTimestamp, parseLogQuery, timeAgo,
  type LogEntry, type LogLevel, type TrendRangeKey,
} from "@/mocks/logs";

echarts.use([BarChart, PieChart, GridComponent, TooltipComponent, BrushComponent, CanvasRenderer]);

const CHART_COLORS: Record<LogLevel, string> = { ERROR: "oklch(0.7106 0.1661 22.22)", WARNING: "oklch(0.8369 0.1644 84.43)", INFO: "oklch(0.7137 0.1434 254.62)", DEBUG: "oklch(0.7107 0.0351 256.79)" };
const LEVEL_ORDER: LogLevel[] = ["ERROR", "WARNING", "INFO", "DEBUG"];
const LEVEL_RANK: Record<LogLevel, number> = { ERROR: 3, WARNING: 2, INFO: 1, DEBUG: 0 };
const LEVEL_BADGE: Record<LogLevel, string> = {
  ERROR: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  WARNING: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  INFO: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  DEBUG: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};
const LEVEL_BADGE_ICON: Record<LogLevel, typeof CircleAlert> = { ERROR: CircleAlert, WARNING: TriangleAlert, INFO: BadgeCheck, DEBUG: Rows3 };
const LEVEL_CHIP: Record<LogLevel, { dot: string; active: string }> = {
  ERROR: { dot: "bg-rose-400", active: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300" },
  WARNING: { dot: "bg-amber-400", active: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300" },
  INFO: { dot: "bg-blue-400", active: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300" },
  DEBUG: { dot: "bg-slate-400", active: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" },
};
const TIME_RANGES = ["Last 15 minutes", "Last 1 hour", "Last 6 hours", "Last 12 hours", "Last 24 hours", "Last 7 days"] as const;
const TIME_LIMIT_MINUTES: Record<string, number> = {
  "Last 15 minutes": 15, "Last 1 hour": 60, "Last 6 hours": 360, "Last 12 hours": 720, "Last 24 hours": 1440, "Last 7 days": 10080,
};
const CUSTOM_RANGE = "Custom range";
const ALL_SERVICES = "All Services";
const ALL_HOSTS = "All Hosts";
const ALL_ENVS = "All Environments";
const ALL_SOURCES = "All Sources";
const SAMPLE_COUNT = 500;
const SAVED_KEY = "nexus.logs.savedSearches";
const RECENT_KEY = "nexus.logs.recentSearches";

type SortKey = "timestamp" | "level";
type Density = "comfortable" | "compact";
type ColumnKey = "level" | "service" | "host" | "context";

interface AppliedFilters {
  query: string;
  levels: LogLevel[];
  service: string;
  host: string;
  timeRange: string;
  environment: string;
  source: string;
  context: string;
  traceId: string;
  brush: { from: number; to: number } | null;
}

const DEFAULT_FILTERS: AppliedFilters = {
  query: "", levels: [], service: ALL_SERVICES, host: ALL_HOSTS, timeRange: "Last 24 hours",
  environment: ALL_ENVS, source: ALL_SOURCES, context: "", traceId: "", brush: null,
};

interface SavedSearch {
  id: string;
  name: string;
  filters: AppliedFilters;
  builtin?: boolean;
}

const MOCK_SAVED_SEARCHES: SavedSearch[] = [
  { id: "saved-api-errors", name: "API errors 1h", builtin: true, filters: { ...DEFAULT_FILTERS, query: "level:error service:api-server", levels: ["ERROR"], service: "api-server", timeRange: "Last 1 hour" } },
  { id: "saved-slow-queries", name: "Slow queries", builtin: true, filters: { ...DEFAULT_FILTERS, query: "slow", timeRange: "Last 24 hours" } },
  { id: "saved-auth-failures", name: "Auth failures", builtin: true, filters: { ...DEFAULT_FILTERS, query: "auth", levels: ["ERROR"], service: "auth-service", timeRange: "Last 24 hours" } },
];

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

function isDefaultFilters(f: AppliedFilters): boolean {
  return !f.query && f.levels.length === 0 && f.service === ALL_SERVICES && f.host === ALL_HOSTS
    && f.timeRange === "Last 24 hours" && f.environment === ALL_ENVS && f.source === ALL_SOURCES
    && !f.context && !f.traceId && !f.brush;
}

/** Highlights occurrences of the active query terms inside a message. */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const cleaned = terms.filter((term) => term.length >= 2);
  if (cleaned.length === 0) return <>{text}</>;
  const pattern = cleaned.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const parts = text.split(new RegExp(`(${pattern})`, "gi"));
  return (
    <>
      {parts.map((part, index) =>
        cleaned.some((term) => part.toLowerCase() === term.toLowerCase()) || new RegExp(`^(${pattern})$`, "i").test(part)
          ? <mark key={index} className="rounded-sm bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-500/30">{part}</mark>
          : <span key={index}>{part}</span>,
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline — tiny inline SVG trend line                                */
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

/* ------------------------------------------------------------------ */
/* Trend chart — ECharts stacked bars, lineX brush, click-to-isolate.   */
/* ------------------------------------------------------------------ */
interface TrendChartProps {
  data: (typeof LOG_TRENDS)[TrendRangeKey];
  hidden: ReadonlySet<LogLevel>;
  brush: { start: number; end: number } | null;
  onBrush: (brush: { start: number; end: number } | null) => void;
}

function TrendChart({ data, hidden, brush, onBrush }: TrendChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const onBrushRef = useRef(onBrush);
  onBrushRef.current = onBrush;

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
    const maxBucket = Math.max(...data.map((bucket) => bucket.total), 1);
    const magnitude = 10 ** Math.floor(Math.log10(Math.max(maxBucket, 10)));
    const yMax = Math.ceil(maxBucket / (magnitude / 2)) * (magnitude / 2);
    const series = LEVEL_ORDER.filter((level) => !hidden.has(level)).map((level) => ({
      name: level,
      type: "bar" as const,
      stack: "logs",
      barMaxWidth: 22,
      itemStyle: { color: CHART_COLORS[level] },
      emphasis: { focus: "series" as const },
      large: true,
      data: data.map((bucket) => bucket[level.toLowerCase() as "error" | "warning" | "info" | "debug"]),
    }));

    const option: EChartsOption = {
      grid: { left: 0, right: 16, top: 12, bottom: 0, containLabel: true },
      tooltip: {
        trigger: "axis",
        triggerOn: "mousemove",
        axisPointer: { type: "shadow" },
        backgroundColor: "var(--popover)",
        borderColor: "var(--border)",
        borderWidth: 1,
        textStyle: { color: "var(--popover-foreground)", fontSize: 12 },
        extraCssText: "border-radius:0.5rem;box-shadow:0 0.5rem 1.5rem rgb(15 23 42 / 0.18);padding:0.625rem 0.75rem;",
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? (params as Array<{ color: string | { colorStops?: Array<{ color: string }> }; seriesName: string; value: number }>) : [];
          const first = list[0] as { dataIndex?: number } | undefined;
          const index = typeof first?.dataIndex === "number" ? first.dataIndex : 0;
          const bucket = data[index];
          if (!bucket) return "";
          const stamp = new Date(bucket.epochMs);
          const title = `${stamp.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${stamp.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
          const lines = list.map((item) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;line-height:1.25rem"><span style="display:flex;align-items:center;gap:0.375rem"><span style="display:inline-block;width:0.5rem;height:0.5rem;border-radius:50%;background:${typeof item.color === "string" ? item.color : "var(--primary)"}"></span>${item.seriesName}</span><b style="font-variant-numeric:tabular-nums">${formatFull(item.value)}</b></div>`).join("");
          return `<div style="font-weight:600;margin-bottom:0.25rem">${title}</div>${lines}`;
        },
      },
      brush: {
        toolbox: ["lineX"],
        xAxisIndex: 0,
        brushStyle: { color: "oklch(0.5855 0.1885 255.72 / 0.15)", borderColor: "oklch(0.5855 0.1885 255.72)", borderWidth: 1 },
        outOfBrush: { colorAlpha: 0.25 },
        throttleType: "debounce",
        throttleDelay: 120,
      },
      xAxis: {
        type: "category",
        data: data.map((bucket) => bucket.label),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          color: "var(--muted-foreground)",
          fontSize: 12,
          interval: Math.max(0, Math.ceil(data.length / 6) - 1),
          hideOverlap: true,
          margin: 12,
        },
      },
      yAxis: {
        type: "value",
        max: yMax,
        splitNumber: 4,
        splitLine: { lineStyle: { color: "var(--border)", type: "dashed" } },
        axisLabel: {
          color: "var(--muted-foreground)",
          fontSize: 12,
          formatter: (value: number) => (value === 0 ? "0" : value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : `${Math.round(value / 1000)}K`),
        },
      },
      series,
    };
    chart.setOption(option, { notMerge: true });

    // Arm the lineX brush so a drag on the canvas selects a time window.
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
  }, [data, hidden, brush]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label="Stacked bar chart of log volume by level over time. Drag to select a time window."
      className="h-[13.125rem] w-full"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Donut — level distribution, 8.125rem, 72% cutout, center total.        */
/* ------------------------------------------------------------------ */
function LevelDonut() {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const chart = echarts.init(host, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(host);
    const seriesData = LEVEL_ORDER.map((level) => ({ name: level, value: LEVEL_COUNTS[level], itemStyle: { color: CHART_COLORS[level] } }));
    const option: EChartsOption = {
      series: [{
        type: "pie",
        radius: ["72%", "88%"],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: { borderRadius: 4, borderWidth: 2, borderColor: "var(--card)" },
        data: seriesData,
      }],
      tooltip: { trigger: "item", backgroundColor: "var(--popover)", borderColor: "var(--border)", textStyle: { color: "var(--popover-foreground)", fontSize: 12 } },
    };
    chart.setOption(option);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-[8.125rem] w-[8.125rem] shrink-0">
      <div ref={hostRef} className="absolute inset-0" role="img" aria-label="Donut chart of log levels" />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <b className="font-display text-[0.9375rem] font-extrabold leading-none text-foreground tabular-nums">48.7M</b>
        <span className="mt-1 text-[0.75rem] font-medium text-muted-foreground">Total</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main dashboard                                                        */
/* ------------------------------------------------------------------ */
const STAT_CARDS = [
  { label: "Total Logs", value: "48.7M", icon: ScrollText, tone: "bg-[oklch(0.9492_0.0252_249.95)] text-[oklch(0.5854_0.1886_255.66)] dark:bg-[oklch(0.3358_0.0746_252.64)] dark:text-[oklch(0.7396_0.14_249.73)]", delta: 142, pct: "6.1%", dir: "up" as const },
  { label: "Parsed Logs", value: "48.1M", icon: BadgeCheck, tone: "bg-[oklch(0.9553_0.0297_164.3)] text-[oklch(0.6367_0.1492_156.39)] dark:bg-[oklch(0.3149_0.0537_163.8)] dark:text-[oklch(0.7869_0.1465_160.69)]", delta: 126, pct: "5.8%", dir: "up" as const },
  { label: "Errors", value: "124.5K", icon: CircleAlert, tone: "bg-[oklch(0.9544_0.023_10.96)] text-[oklch(0.6219_0.2045_21.23)] dark:bg-[oklch(0.328_0.0487_357.32)] dark:text-[oklch(0.7663_0.1406_13.84)]", delta: 7500, pct: "6.4%", dir: "down" as const },
  { label: "Warnings", value: "268.7K", icon: TriangleAlert, tone: "bg-[oklch(0.9624_0.0373_83.03)] text-[oklch(0.7213_0.1471_72.82)] dark:bg-[oklch(0.3598_0.0347_69.88)] dark:text-[oklch(0.8508_0.123_72.9)]", delta: 16100, pct: "6.4%", dir: "down" as const },
  { label: "Log Rate", value: "564/s", icon: Activity, tone: "bg-[oklch(0.9487_0.0289_301)] text-[oklch(0.5675_0.2098_296.93)] dark:bg-[oklch(0.306_0.07_300.04)] dark:text-[oklch(0.7536_0.1483_299.39)]", delta: 26, pct: "4.8%", dir: "up" as const },
  { label: "Parse Failures", value: "0.6M", icon: ShieldAlert, tone: "bg-[oklch(0.9501_0.0255_35.71)] text-[oklch(0.6455_0.1705_41.28)] dark:bg-[oklch(0.3254_0.0258_41.52)] dark:text-[oklch(0.8243_0.1061_46.49)]", delta: -14400, pct: "2.4%", dir: "down" as const },
];

export function LogsExplorerDashboard() {
  const { logs, status, reload } = useLogs();
  const isLoading = status === "loading";
  const isError = status === "error";

  const [draft, setDraft] = useState<AppliedFilters>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<AppliedFilters>(DEFAULT_FILTERS);
  const [trendRange, setTrendRange] = useState<TrendRangeKey>("24H");
  const [hiddenLevels, setHiddenLevels] = useState<ReadonlySet<LogLevel>>(new Set());
  const [brush, setBrush] = useState<{ start: number; end: number } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [density, setDensity] = useState<Density>("comfortable");
  const [wrapMessage, setWrapMessage] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({ level: true, service: true, host: true, context: true });
  const [utcMode, setUtcMode] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [liveTail, setLiveTail] = useState(true);
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [hoverPause, setHoverPause] = useState(false);
  const [toast, setToast] = useState("");
  const [customSaved, setCustomSaved] = useState<SavedSearch[]>(() => readJSON(SAVED_KEY, [] as SavedSearch[]));
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readJSON(RECENT_KEY, [] as string[]));

  const searchRef = useRef<HTMLInputElement>(null);
  const liveSeq = useRef(0);
  const hoverRef = useRef(false);
  const pendingRef = useRef<LogEntry[]>([]);
  const toastTimer = useRef<number | null>(null);
  const didInitURL = useRef(false);

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3200);
  };

  const syncURL = (f: AppliedFilters) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (f.query) params.set("q", f.query);
    if (f.levels.length) params.set("levels", f.levels.join(","));
    if (f.service !== ALL_SERVICES) params.set("service", f.service);
    if (f.host !== ALL_HOSTS) params.set("host", f.host);
    if (f.timeRange !== "Last 24 hours") params.set("time", f.timeRange);
    if (f.environment !== ALL_ENVS) params.set("env", f.environment);
    if (f.source !== ALL_SOURCES) params.set("source", f.source);
    if (f.context) params.set("context", f.context);
    if (f.traceId) params.set("trace", f.traceId);
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

  const pushRecent = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((item) => item !== trimmed)].slice(0, 5);
      writeJSON(RECENT_KEY, next);
      return next;
    });
  };

  // Initial state from the URL (one pass only).
  useEffect(() => {
    if (didInitURL.current || typeof window === "undefined") return;
    didInitURL.current = true;
    const params = new URLSearchParams(window.location.search);
    const parsedLevels = (params.get("levels")?.split(",") ?? []).filter((level): level is LogLevel => (LEVEL_ORDER as string[]).includes(level));
    const from = Number(params.get("from"));
    const to = Number(params.get("to"));
    const brushParam = params.has("from") && params.has("to") && Number.isFinite(from) && Number.isFinite(to) ? { from, to } : null;
    const next: AppliedFilters = {
      ...DEFAULT_FILTERS,
      query: params.get("q") ?? "",
      levels: parsedLevels,
      service: params.get("service") ?? ALL_SERVICES,
      host: params.get("host") ?? ALL_HOSTS,
      timeRange: params.get("time") ?? "Last 24 hours",
      environment: params.get("env") ?? ALL_ENVS,
      source: params.get("source") ?? ALL_SOURCES,
      context: params.get("context") ?? "",
      traceId: params.get("trace") ?? "",
      brush: brushParam,
    };
    setDraft(next);
    setApplied(next);
  }, []);

  // "/" focuses the search box from anywhere on the page.
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

  // Live tail: a fresh mock log every 2s; paused while hovered or hidden.
  useEffect(() => {
    if (!liveTail) return undefined;
    const id = window.setInterval(() => {
      const entry = createLiveLog(liveSeq.current + 1);
      liveSeq.current += 1;
      if (hoverRef.current || document.hidden) {
        pendingRef.current.push(entry);
        setPendingCount(pendingRef.current.length);
        return;
      }
      setLiveLogs((prev) => [entry, ...prev].slice(0, 80));
    }, 2000);
    return () => window.clearInterval(id);
  }, [liveTail]);

  const flushPending = () => {
    const buffered = pendingRef.current;
    if (buffered.length === 0) return;
    pendingRef.current = [];
    setLiveLogs((prev) => [...buffered.slice().reverse(), ...prev].slice(0, 80));
    setPendingCount(0);
  };

  const allLogs = useMemo(() => [...liveLogs, ...logs], [liveLogs, logs]);

  const filteredLogs = useMemo(() => {
    const timeLimit = applied.brush ? Number.POSITIVE_INFINITY : (TIME_LIMIT_MINUTES[applied.timeRange] ?? Number.POSITIVE_INFINITY);
    const tokens = parseLogQuery(applied.query);
    const now = Date.now();
    return allLogs.filter((log) => {
      if (applied.brush) {
        if (log.epochMs < applied.brush.from || log.epochMs > applied.brush.to) return false;
      } else if (timeLimit !== Number.POSITIVE_INFINITY && now - log.epochMs > timeLimit * 60_000) {
        return false;
      }
      if (applied.levels.length > 0 && !applied.levels.includes(log.level)) return false;
      if (applied.service !== ALL_SERVICES && log.service !== applied.service) return false;
      if (applied.host !== ALL_HOSTS && log.host !== applied.host) return false;
      if (applied.environment !== ALL_ENVS && log.environment !== applied.environment) return false;
      if (applied.source !== ALL_SOURCES && log.source !== applied.source) return false;
      if (applied.context) {
        const needle = applied.context.toLowerCase();
        if (!log.tags.some((tag) => tag.toLowerCase().includes(needle))) return false;
      }
      if (applied.traceId && !log.traceId.toLowerCase().includes(applied.traceId.toLowerCase())) return false;
      if (tokens.length > 0) {
        const haystack = `${log.message} ${log.service} ${log.host} ${log.environment} ${log.source} ${log.level} ${log.tags.join(" ")} ${log.traceId}`.toLowerCase();
        for (const token of tokens) {
          const value = token.value;
          if (token.key) {
            switch (token.key) {
              case "level": if (!log.level.toLowerCase().includes(value)) return false; break;
              case "service": if (!log.service.toLowerCase().includes(value)) return false; break;
              case "host": if (!log.host.toLowerCase().includes(value)) return false; break;
              case "env": case "environment": if (!log.environment.toLowerCase().includes(value)) return false; break;
              case "source": if (!log.source.toLowerCase().includes(value)) return false; break;
              case "trace": case "traceid": if (!log.traceId.toLowerCase().includes(value)) return false; break;
              case "tag": case "context": if (!log.tags.some((tag) => tag.toLowerCase().includes(value))) return false; break;
              default: if (!haystack.includes(value)) return false;
            }
          } else if (!haystack.includes(value)) return false;
        }
      }
      return true;
    });
  }, [allLogs, applied]);

  const sortedLogs = useMemo(() => {
    const copy = [...filteredLogs];
    copy.sort((a, b) => {
      const diff = sortKey === "timestamp" ? a.epochMs - b.epochMs : LEVEL_RANK[a.level] - LEVEL_RANK[b.level];
      return sortDir === "asc" ? diff : -diff;
    });
    return copy;
  }, [filteredLogs, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedLogs.length / perPage));
  const safePage = Math.min(page, pageCount);
  const pageLogs = sortedLogs.slice((safePage - 1) * perPage, safePage * perPage);
  const rangeStart = sortedLogs.length === 0 ? 0 : (safePage - 1) * perPage + 1;
  const rangeEnd = Math.min(safePage * perPage, sortedLogs.length);
  const displayTotal = isDefaultFilters(applied) ? LOG_TOTALS.total : Math.round((LOG_TOTALS.total * sortedLogs.length) / SAMPLE_COUNT);

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

  const highlightTerms = useMemo(() => parseLogQuery(applied.query).map((token) => token.value).filter((value) => value.length >= 2), [applied.query]);

  const toggleLevel = (level: LogLevel) => {
    const nextLevels = draft.levels.includes(level) ? draft.levels.filter((item) => item !== level) : [...draft.levels, level];
    const next = { ...draft, levels: nextLevels };
    setDraft(next);
    commit(next);
  };

  const applyQuery = (query: string, message?: string) => {
    const next = { ...draft, query };
    setDraft(next);
    commit(next, message);
    pushRecent(query);
  };

  const clearAllFilters = () => {
    setDraft(DEFAULT_FILTERS);
    setBrush(null);
    commit(DEFAULT_FILTERS, "All log filters cleared.");
  };

  const applySavedSearch = (saved: SavedSearch) => {
    setDraft(saved.filters);
    setBrush(null);
    commit(saved.filters, `Applied "${saved.name}"`);
    pushRecent(saved.filters.query);
  };

  const saveCurrentSearch = () => {
    const snapshot: SavedSearch = {
      id: `custom-${Date.now()}`,
      name: draft.query ? (draft.query.length > 34 ? `${draft.query.slice(0, 34)}…` : draft.query) : `Search ${customSaved.length + 1}`,
      filters: { ...applied },
    };
    const next = [snapshot, ...customSaved].slice(0, 8);
    setCustomSaved(next);
    writeJSON(SAVED_KEY, next);
    notify(`Saved "${snapshot.name}" locally.`);
  };

  const removeCustomSaved = (id: string) => {
    setCustomSaved((prev) => {
      const next = prev.filter((item) => item.id !== id);
      writeJSON(SAVED_KEY, next);
      return next;
    });
  };

  const resetZoom = () => {
    setBrush(null);
    commit({ ...draft, timeRange: RANGE_TEXT[trendRange], brush: null }, "Zoom reset.");
  };

  const onTrendBrush = (next: { start: number; end: number } | null) => {
    if (!next) return;
    const trend = LOG_TRENDS[trendRange];
    const first = trend[next.start];
    const last = trend[next.end];
    if (!first || !last) return;
    const stepMs = trend.length > 1 ? trend[1].epochMs - trend[0].epochMs : 60_000;
    const nextDraft: AppliedFilters = { ...draft, timeRange: CUSTOM_RANGE, brush: { from: first.epochMs, to: last.epochMs + stepMs - 1 } };
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

  const toggleSeries = (level: LogLevel) => {
    setHiddenLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  /* Isolate a single level: keep only that series visible, or reset when already isolated */
  const isolateLevel = (level: LogLevel) => {
    setHiddenLevels((prev) => {
      const visibleCount = LEVEL_ORDER.filter((item) => !prev.has(item)).length;
      const soloed = visibleCount === 1 && !prev.has(level);
      return soloed ? new Set() : new Set(LEVEL_ORDER.filter((item) => item !== level));
    });
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(`${label} copied.`);
    } catch {
      notify("Copy failed — clipboard unavailable.");
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportFiltered = (format: "csv" | "json") => {
    if (sortedLogs.length === 0) {
      notify("Nothing to export with the current filters.");
      return;
    }
    if (format === "json") {
      triggerDownload(new Blob([JSON.stringify(sortedLogs.map((log) => log.raw), null, 2)], { type: "application/json" }), "logs-export.json");
    } else {
      const header = "timestamp,level,service,host,environment,message,tags,traceId,source";
      const lines = sortedLogs.map((log) => [log.timestamp, log.level, log.service, log.host, log.environment, log.message, log.tags.join(" "), log.traceId, log.source]
        .map((field) => `"${String(field).replaceAll("\"", "\"\"")}"`)
        .join(","));
      triggerDownload(new Blob([[header, ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" }), "logs-export.csv");
    }
    notify(`${sortedLogs.length} filtered logs exported as ${format.toUpperCase()}.`);
  };

  const trend = LOG_TRENDS[trendRange];
  const visibleBucketValue = (bucket: (typeof trend)[number]) => LEVEL_ORDER.filter((level) => !hiddenLevels.has(level)).reduce((sum, level) => sum + bucket[level.toLowerCase() as "error" | "warning" | "info" | "debug"], 0);
  const trendSum = trend.reduce((acc, bucket) => acc + visibleBucketValue(bucket), 0);
  const trendPeak = trend.reduce((peak, bucket) => (visibleBucketValue(bucket) > visibleBucketValue(peak) ? bucket : peak), trend[0]);
  const trendPeakValue = visibleBucketValue(trendPeak);
  const trendAvg = Math.round(trendSum / Math.max(1, trend.length));
  const trendErrorRate = trendSum === 0 ? 0 : (trend.reduce((acc, bucket) => acc + bucket.error, 0) / trendSum) * 100;

  const highlightQuery = (text: string) => <Highlight text={text} terms={highlightTerms} />;

  const colSpan = 3 + (visibleColumns.level ? 1 : 0) + (visibleColumns.service ? 1 : 0) + (visibleColumns.host ? 1 : 0) + (visibleColumns.context ? 1 : 0);
  const rowPad = density === "comfortable" ? "px-3 py-2" : "px-3 py-0.5";
  const cellText = density === "comfortable" ? "text-[0.8125rem]" : "text-xs";
  const allSavedSearches = [...MOCK_SAVED_SEARCHES, ...customSaved];
  const bucketLevelCount = (level: LogLevel, key: TrendRangeKey) => LOG_TRENDS[key].reduce((acc, bucket) => acc + bucket[level.toLowerCase() as "error" | "warning" | "info" | "debug"], 0);
  const startNewQuery = () => {
    setDraft(DEFAULT_FILTERS);
    commit(DEFAULT_FILTERS);
    searchRef.current?.focus();
  };
  const applyDraftAndRecent = () => {
    commit({ ...draft }, "Filters applied.");
    pushRecent(draft.query);
  };

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Monitoring", "Logs Explorer"]}
        title="Logs Explorer"
        subtitle="Search, filter and analyze logs from all your infrastructure sources."
        onRefresh={reload}
        actions={
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" onClick={saveCurrentSearch} className="h-10 gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm"><Save size={15} />Save Search</Button>
            <details className="relative">
              <summary aria-label="Export logs" className="inline-flex h-10 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent [&::-webkit-details-marker]:hidden"><Download size={15} />Export Logs<ChevronDown size={14} className="text-muted-foreground" /></summary>
              <div className="absolute right-0 z-30 mt-2 w-48 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
                <button type="button" onClick={() => exportFiltered("csv")} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-accent"><FileText size={14} className="text-muted-foreground" />Export CSV</button>
                <button type="button" onClick={() => exportFiltered("json")} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-accent"><FileJson size={14} className="text-muted-foreground" />Export JSON</button>
              </div>
            </details>
            <Button onClick={startNewQuery} className="h-10 gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm"><Plus size={15} />New Query</Button>
          </div>
        }
      />

      {/* Stat cards — values derive from LOG_TOTALS */}
      <section aria-label="Log summary" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {STAT_CARDS.map((item) => (
          <StatCard key={item.label} icon={<item.icon size={20} aria-hidden="true" />} iconTone={item.tone} label={item.label} value={item.value} delta={item.delta} deltaPercent={item.pct} goodDirection={item.dir} />
        ))}
      </section>

      {isError ? (
        <section role="alert" className="grid min-h-[20rem] place-items-center rounded-xl border border-border bg-card p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <CircleAlert size={28} className="text-rose-500" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-foreground">Logs could not be loaded</h2>
            <p className="max-w-md text-sm text-muted-foreground">The mock log stream failed before delivering any entries. Retry to fetch the latest logs.</p>
            <Button onClick={reload} className="h-10 gap-1.5 rounded-lg px-4 text-sm"><RotateCcw size={15} />Retry</Button>
          </div>
        </section>
      ) : (<>

      {/* Trend + Filters */}
      <section aria-label="Log trend and filters" className="grid items-stretch gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Panel
          title="Logs Trend"
          className="flex h-full min-w-0 flex-col rounded-xl p-4"
          titleClassName="text-[1rem] font-semibold"
          action={brush ? (
            <button type="button" onClick={resetZoom} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"><RotateCcw size={12} aria-hidden="true" />Reset zoom</button>
          ) : undefined}
        >
          <div className="flex flex-1 flex-col pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex h-8 items-center rounded-lg border border-border p-0.5" role="group" aria-label="Trend range">
                {TREND_RANGE_ORDER.map((key) => (
                  <button key={key} type="button" aria-pressed={trendRange === key} onClick={() => selectRangeTab(key)} className={cn("h-7 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", trendRange === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>{key}</button>
                ))}
              </div>
              <span className="hidden text-xs text-muted-foreground xl:block">Drag to select a window · click a bar to isolate it</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Toggle level series">
              {LEVEL_ORDER.map((level) => {
                const hidden = hiddenLevels.has(level);
                return (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={!hidden}
                    onClick={() => toggleSeries(level)}
                    title={`Toggle ${level.toLowerCase()} series`}
                    className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", hidden ? "border-transparent bg-muted text-muted-foreground opacity-60 line-through" : LEVEL_CHIP[level].active)}
                  >
                    <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", hidden ? "bg-slate-400" : LEVEL_CHIP[level].dot)} />
                    {level}
                    <b className="tabular-nums">{formatCompact(bucketLevelCount(level, trendRange))}</b>
                  </button>
                );
              })}
            </div>
            <div className="mt-2">
              {isLoading ? (
                <div className="h-[13.125rem] w-full animate-pulse rounded-lg bg-muted" role="status" aria-label="Loading log trend" />
              ) : (
                <TrendChart data={trend} hidden={hiddenLevels} brush={brush} onBrush={onTrendBrush} />
              )}
            </div>
            <div className="mt-auto border-t border-border pt-2 text-sm text-muted-foreground">
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <li>Peak <b className="text-foreground">{trendPeak.label}</b> ({formatCompact(trendPeakValue)})</li>
                <li>Avg/bucket <b className="tabular-nums text-foreground">{formatCompact(trendAvg)}</b></li>
                <li>Error rate <b className="tabular-nums text-foreground">{trendErrorRate.toFixed(2)}%</b></li>
              </ul>
            </div>
          </div>
        </Panel>

        <Panel
          title="Filter Logs"
          className="flex h-full min-w-0 flex-col rounded-xl p-4"
          titleClassName="text-[1rem] font-semibold"
          action={<button type="button" onClick={clearAllFilters} className="text-sm font-medium text-primary hover:underline">Clear All</button>}
        >
          <div className="flex flex-1 flex-col gap-3 pt-1">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Search Logs</span>
              <span className="relative block">
                <Input
                  ref={searchRef}
                  value={draft.query}
                  onChange={(event) => setDraft((prev) => ({ ...prev, query: event.target.value }))}
                  onKeyDown={(event) => { if (event.key === "Enter") applyDraftAndRecent(); }}
                  placeholder="level:error service:api-server"
                  aria-label="Search query. Press slash to focus."
                  className="h-10 rounded-lg pr-12 text-sm"
                />
                <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground" aria-hidden="true">/</kbd>
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Level filters">
              <button
                type="button"
                aria-pressed={draft.levels.length === 0}
                onClick={() => { const next = { ...draft, levels: [] }; setDraft(next); commit(next); }}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", draft.levels.length === 0 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent")}
              >
                All levels <b className="tabular-nums">{formatCompact(LOG_TOTALS.total)}</b>
              </button>
              {LEVEL_ORDER.map((level) => {
                const active = draft.levels.includes(level);
                return (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleLevel(level)}
                    className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? LEVEL_CHIP[level].active : "border-border bg-card text-muted-foreground hover:bg-accent")}
                  >
                    <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", LEVEL_CHIP[level].dot)} />
                    {level} <b className="tabular-nums">{formatCompact(LEVEL_COUNTS[level])}</b>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <label className="min-w-0 space-y-1.5">
                <span className="text-sm font-medium text-foreground">Service</span>
                <Select value={draft.service} onValueChange={(value) => { const next = { ...draft, service: value }; setDraft(next); commit(next); }}>
                  <SelectTrigger aria-label="Service" className="h-10 w-full min-w-0 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{[ALL_SERVICES, ...LOG_SERVICES].map((service) => <SelectItem key={service} value={service}>{service}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label className="min-w-0 space-y-1.5">
                <span className="text-sm font-medium text-foreground">Host</span>
                <Select value={draft.host} onValueChange={(value) => { const next = { ...draft, host: value }; setDraft(next); commit(next); }}>
                  <SelectTrigger aria-label="Host" className="h-10 w-full min-w-0 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{[ALL_HOSTS, ...LOG_HOSTS].map((host) => <SelectItem key={host} value={host}>{host}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label className="min-w-0 space-y-1.5">
                <span className="text-sm font-medium text-foreground">Time Range</span>
                <Select value={draft.timeRange} onValueChange={(value) => { if (value !== CUSTOM_RANGE) setBrush(null); const next = { ...draft, timeRange: value, brush: value === CUSTOM_RANGE ? draft.brush : null }; setDraft(next); commit(next); }}>
                  <SelectTrigger aria-label="Time Range" className="h-10 w-full min-w-0 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{[...TIME_RANGES, ...(draft.timeRange === CUSTOM_RANGE ? [CUSTOM_RANGE] : [])].map((range) => <SelectItem key={range} value={range}>{range}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label className="min-w-0 space-y-1.5">
                <span className="text-sm font-medium text-foreground">Environment</span>
                <Select value={draft.environment} onValueChange={(value) => { const next = { ...draft, environment: value }; setDraft(next); commit(next); }}>
                  <SelectTrigger aria-label="Environment" className="h-10 w-full min-w-0 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{[ALL_ENVS, ...LOG_ENVIRONMENTS].map((environment) => <SelectItem key={environment} value={environment}>{environment}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            </div>

            {advancedOpen && (
              <div className="grid grid-cols-1 gap-2 border-t border-border pt-2 sm:grid-cols-3">
                <label className="min-w-0 space-y-1.5">
                  <span className="text-sm font-medium text-foreground">Trace ID</span>
                  <Input value={draft.traceId} onChange={(event) => setDraft((prev) => ({ ...prev, traceId: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") applyDraftAndRecent(); }} placeholder="Full or partial trace ID" aria-label="Trace ID filter" className="h-10 rounded-lg font-mono text-sm" />
                </label>
                <label className="min-w-0 space-y-1.5">
                  <span className="text-sm font-medium text-foreground">Source</span>
                  <Select value={draft.source} onValueChange={(value) => { const next = { ...draft, source: value }; setDraft(next); commit(next); }}>
                    <SelectTrigger aria-label="Source" className="h-10 w-full min-w-0 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{[ALL_SOURCES, ...LOG_SOURCES].map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
                <label className="min-w-0 space-y-1.5">
                  <span className="text-sm font-medium text-foreground">Context tag</span>
                  <Input value={draft.context} onChange={(event) => setDraft((prev) => ({ ...prev, context: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") applyDraftAndRecent(); }} placeholder="e.g. smtp" aria-label="Context tag filter" className="h-10 rounded-lg text-sm" />
                </label>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" onClick={() => setAdvancedOpen((value) => !value)} aria-expanded={advancedOpen} className="h-10 gap-1.5 rounded-lg px-3 text-sm"><SlidersHorizontal size={14} />{advancedOpen ? "Hide Advanced" : "Advanced Filters"}<ChevronDown size={13} className={cn("transition-transform", advancedOpen && "rotate-180")} aria-hidden="true" /></Button>
              <Button onClick={applyDraftAndRecent} className="h-10 gap-1.5 rounded-lg px-4 text-sm"><Search size={15} />Search Logs</Button>
            </div>

            <div className="mt-auto border-t border-border pt-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saved Searches</span>
                <button type="button" onClick={saveCurrentSearch} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><Plus size={11} aria-hidden="true" />Save current</button>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {allSavedSearches.map((saved) => (
                  <li key={saved.id} className="flex h-8 items-stretch overflow-hidden rounded-full border border-border bg-card">
                    <button type="button" onClick={() => applySavedSearch(saved)} title={`${saved.filters.query || "No query"} · ${saved.filters.timeRange}`} className="inline-flex items-center gap-1.5 px-2.5 text-xs font-medium text-foreground transition-colors hover:text-primary"><Bookmark size={11} className="shrink-0 text-primary" aria-hidden="true" />{saved.name}</button>
                    {!saved.builtin && (
                      <button type="button" onClick={() => removeCustomSaved(saved.id)} aria-label={`Delete saved search ${saved.name}`} title="Delete saved search" className="grid w-7 place-items-center border-l border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><X size={11} aria-hidden="true" /></button>
                    )}
                  </li>
                ))}
              </ul>
              {recentSearches.length > 0 && (
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Searches</span>
                    <button type="button" onClick={() => { setRecentSearches([]); writeJSON(RECENT_KEY, []); }} className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground" aria-label="Clear recent searches"><Trash2 size={11} aria-hidden="true" />Clear</button>
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {recentSearches.map((term) => (
                      <li key={term}><button type="button" onClick={() => applyQuery(term, "Recent search applied.")} className="inline-flex h-7 max-w-[15rem] items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs text-foreground transition-colors hover:bg-accent"><Clock size={11} className="shrink-0 text-muted-foreground" aria-hidden="true" /><span className="truncate">{term}</span></button></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </section>

      {/* Results table */}
      <Panel
        title={`Logs Results (${isLoading ? "…" : formatFull(isDefaultFilters(applied) ? LOG_TOTALS.total : sortedLogs.length)})`}
        className="flex min-w-0 flex-col rounded-xl p-4"
        titleClassName="text-[1rem] font-semibold"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-8 items-center rounded-lg border border-border p-0.5" role="group" aria-label="Timestamp format">
              {([{ key: "UTC", value: true }, { key: "Local", value: false }] as const).map((mode) => (
                <button key={mode.key} type="button" aria-pressed={utcMode === mode.value} onClick={() => setUtcMode(mode.value)} className={cn("h-7 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", utcMode === mode.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>{mode.key}</button>
              ))}
            </div>
            <div className="flex h-8 items-center rounded-lg border border-border p-0.5" role="group" aria-label="Row density">
              {(["comfortable", "compact"] as const).map((option) => (
                <button key={option} type="button" aria-pressed={density === option} onClick={() => setDensity(option)} className={cn("h-7 rounded-md px-2.5 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", density === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>{option}</button>
              ))}
            </div>
            <button type="button" aria-pressed={wrapMessage} aria-label="Wrap message" title="Wrap message" onClick={() => setWrapMessage((value) => !value)} className={cn("grid h-8 w-8 place-items-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", wrapMessage ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}><WrapText size={14} aria-hidden="true" /></button>
            <details className="relative">
              <summary aria-label="Choose columns" title="Columns" className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&::-webkit-details-marker]:hidden"><Columns3 size={14} aria-hidden="true" /></summary>
              <div className="absolute left-0 z-30 mt-2 w-44 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
                <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Toggle columns</p>
                {([["level", "Level"], ["service", "Service"], ["host", "Host"], ["context", "Context"]] as Array<[ColumnKey, string]>).map(([key, label]) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-accent">
                    <input type="checkbox" className="accent-primary" checked={visibleColumns[key]} onChange={() => setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }))} />
                    {label}
                  </label>
                ))}
              </div>
            </details>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground"><span aria-hidden="true" className={cn("h-2 w-2 rounded-full", liveTail ? "animate-pulse bg-emerald-500" : "bg-slate-400")} />Live Tail</span>
            <button type="button" role="switch" aria-checked={liveTail} aria-label="Toggle live tail" title={liveTail ? "Pause live tail" : "Resume live tail"} onClick={() => { setLiveTail((value) => { if (value) notify("Live tail paused."); return !value; }); }} className={cn("relative h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", liveTail ? "bg-blue-500" : "bg-slate-400")}>
              <span aria-hidden="true" className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", liveTail ? "left-[1.125rem]" : "left-0.5")} />
            </button>
            {pendingCount > 0 && (
              <button type="button" onClick={flushPending} className="h-8 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:opacity-90">{pendingCount} new logs ↑</button>
            )}
            {liveTail && hoverPause && <span className="text-xs text-muted-foreground">Paused on hover</span>}
            <button type="button" onClick={() => notify("Realtime tail is a mock preview of the live stream.")} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium text-primary hover:underline">View in Real-time <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>
          </div>
        </div>

        <div className="overflow-x-auto pt-1" onMouseEnter={() => { hoverRef.current = true; setHoverPause(true); }} onMouseLeave={() => { hoverRef.current = false; setHoverPause(false); }}>
          <table className="w-full min-w-[51.25rem] text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th aria-sort={sortKey === "timestamp" ? (sortDir === "asc" ? "ascending" : "descending") : undefined} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                  <button type="button" onClick={() => toggleSort("timestamp")} className="flex items-center gap-1 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Timestamp<ChevronDown size={12} aria-hidden="true" className={cn("transition-transform", sortKey === "timestamp" && sortDir === "asc" && "rotate-180", sortKey !== "timestamp" && "opacity-40")} /></button>
                </th>
                {visibleColumns.level && (
                  <th aria-sort={sortKey === "level" ? (sortDir === "asc" ? "ascending" : "descending") : undefined} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                    <button type="button" onClick={() => toggleSort("level")} className="flex items-center gap-1 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Level<ChevronDown size={12} aria-hidden="true" className={cn("transition-transform", sortKey === "level" && sortDir === "asc" && "rotate-180", sortKey !== "level" && "opacity-40")} /></button>
                  </th>
                )}
                {visibleColumns.service && <th className="px-3 py-2 text-left font-semibold">Service</th>}
                {visibleColumns.host && <th className="px-3 py-2 text-left font-semibold">Host</th>}
                <th className="px-3 py-2 text-left font-semibold">Message</th>
                {visibleColumns.context && <th className="px-3 py-2 text-left font-semibold">Context</th>}
                <th className="w-[4.5rem] px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 8 }, (_, index) => (
                <tr key={`skeleton-${index}`} className="border-b border-border/60 last:border-0">
                  {Array.from({ length: colSpan }, (_, col) => (
                    <td key={col} className="px-3 py-2.5"><div className="h-4 animate-pulse rounded bg-muted" style={{ width: `${52 + ((index * 13 + col * 29) % 38)}%` }} /></td>
                  ))}
                </tr>
              ))}
              {!isLoading && pageLogs.map((log) => {
                const expanded = expandedId === log.id;
                const LevelIcon = LEVEL_BADGE_ICON[log.level];
                return (<Fragment key={log.id}>
                  <tr
                    onClick={(event) => { if ((event.target as HTMLElement).closest("button,a,input,select,details")) return; setExpandedId((current) => (current === log.id ? null : log.id)); }}
                    aria-expanded={expanded}
                    title="Click row to expand"
                    className={cn("cursor-pointer border-b border-border/70 align-top transition-colors last:border-0 hover:bg-muted/40", expanded && "bg-muted/30")}
                  >
                    <td className={cn(rowPad, cellText, "whitespace-nowrap font-mono tabular-nums text-foreground")} title={`${fullTimestamp(log.epochMs, true)} · ${fullTimestamp(log.epochMs, false)}`}>{formatClock(log.epochMs, utcMode)}</td>
                    {visibleColumns.level && (
                      <td className={cn(rowPad, cellText)}>
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", LEVEL_BADGE[log.level])}><LevelIcon size={11} aria-hidden="true" />{log.level}</span>
                      </td>
                    )}
                    {visibleColumns.service && <td className={cn(rowPad, cellText)}><span className="whitespace-nowrap font-medium text-foreground transition-colors hover:text-primary">{log.service}</span></td>}
                    {visibleColumns.host && <td className={cn(rowPad, cellText)}><span className="whitespace-nowrap font-medium text-foreground transition-colors hover:text-primary">{log.host}</span></td>}
                    <td className={cn(rowPad, cellText, "max-w-[26.25rem]")}>
                      <span className={cn("text-foreground", wrapMessage ? "whitespace-normal break-words" : "block truncate")} title={log.message}>{highlightQuery(log.message)}</span>
                    </td>
                    {visibleColumns.context && (
                      <td className={cn(rowPad, cellText)}>
                        <span className="flex flex-wrap gap-1">{log.tags.map((tag) => <span key={tag} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">{tag}</span>)}</span>
                      </td>
                    )}
                    <td className={cn(rowPad, cellText)}>
                      <span className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => copyText(JSON.stringify(log.raw, null, 2), "Log JSON")} aria-label="Copy raw JSON" title="Copy raw JSON" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><Copy size={13} aria-hidden="true" /></button>
                        <button type="button" onClick={() => setExpandedId((current) => (current === log.id ? null : log.id))} aria-label={expanded ? "Collapse log" : "Expand log"} aria-expanded={expanded} title={expanded ? "Collapse" : "Expand"} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><ChevronDown size={13} aria-hidden="true" className={cn("transition-transform", expanded && "rotate-180")} /></button>
                      </span>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-border bg-muted/20">
                      <td colSpan={colSpan} className="px-3 py-3">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                          <div className="min-w-0">
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Raw JSON</span>
                              <button type="button" onClick={() => copyText(JSON.stringify(log.raw, null, 2), "Log JSON")} className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"><Copy size={11} aria-hidden="true" />Copy</button>
                            </div>
                            <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/40 p-2 font-mono text-xs leading-relaxed text-foreground">{JSON.stringify(log.raw, null, 2)}</pre>
                          </div>
                          <div className="min-w-0 space-y-2">
                            <dl className="grid grid-cols-[92px_minmax(0,1fr)] gap-y-1.5 text-xs">
                              <dt className="text-muted-foreground">Trace ID</dt>
                              <dd className="flex min-w-0 items-center gap-1"><code className="truncate font-mono text-foreground" title={log.traceId}>{log.traceId}</code><button type="button" onClick={() => copyText(log.traceId, "Trace ID")} aria-label="Copy trace ID" className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"><Copy size={11} aria-hidden="true" /></button></dd>
                              <dt className="text-muted-foreground">Source</dt>
                              <dd className="text-foreground">{log.source}</dd>
                              <dt className="text-muted-foreground">Environment</dt>
                              <dd className="capitalize text-foreground">{log.environment}</dd>
                              <dt className="text-muted-foreground">Host</dt>
                              <dd className="text-foreground">{log.host}</dd>
                              <dt className="text-muted-foreground">Time (UTC)</dt>
                              <dd className="font-mono text-foreground">{fullTimestamp(log.epochMs, true)}</dd>
                            </dl>
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button variant="outline" size="sm" onClick={() => applyQuery(log.traceId, "Showing logs for this trace.")} className="h-8 rounded-lg px-2.5 text-xs"><Rows3 size={12} />Show surrounding logs</Button>
                              <Button size="sm" onClick={() => notify("Trace opened in APM (mock).")} className="h-8 rounded-lg px-2.5 text-xs">Open trace<ArrowRight size={12} /></Button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>);
              })}
              {!isLoading && pageLogs.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="py-10 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <SearchX size={26} className="text-muted-foreground" aria-hidden="true" />
                      <p className="text-sm font-semibold text-foreground">No logs match your filters</p>
                      <p className="text-xs text-muted-foreground">Try removing a filter or widening the time range.</p>
                      <Button variant="outline" size="sm" onClick={clearAllFilters} className="mt-1 h-9 rounded-lg px-3 text-xs">Clear filters</Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.8125rem] text-muted-foreground">Showing <b className="tabular-nums text-foreground">{rangeStart}–{rangeEnd}</b> of <b className="tabular-nums text-foreground">{formatFull(displayTotal)}</b> logs</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Rows per page</span>
            <Select value={String(perPage)} onValueChange={(value) => { setPerPage(Number(value)); setPage(1); }}>
              <SelectTrigger aria-label="Rows per page" className="h-9 w-[5.5rem] rounded-lg text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{[25, 50, 100].map((option) => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}</SelectContent>
            </Select>
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1} aria-label="Previous page" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={14} aria-hidden="true" /></button>
            {pageItems.map((item, index) => item === "…"
              ? <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground">…</span>
              : <button key={item} type="button" onClick={() => setPage(item)} aria-label={`Page ${item}`} aria-current={item === safePage ? "page" : undefined} className={cn("h-8 w-8 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", item === safePage ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-accent")}>{item}</button>)}
            <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={safePage === pageCount} aria-label="Next page" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={14} aria-hidden="true" /></button>
          </div>
        </div>
      </Panel>

      {/* Insights row */}
      <section aria-label="Log insights" className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Top Services by Errors" className="flex h-full min-w-0 flex-col rounded-xl p-4" titleClassName="text-[1rem] font-semibold">
          <ul className="flex flex-1 flex-col justify-between gap-1.5 pt-1">
            {TOP_SERVICES_BY_ERRORS.map((row) => (
              <li key={row.service} className="grid grid-cols-[minmax(0,1fr)_minmax(5rem,1.5fr)_auto] items-center gap-2">
                <span className="truncate text-[0.8125rem] font-medium text-foreground" title={row.service}>{row.service}</span>
                <span className="h-2 min-w-0 overflow-hidden rounded-full bg-muted" role="presentation"><span className="block h-full rounded-full bg-red-400" style={{ width: `${(row.count / Math.max(...TOP_SERVICES_BY_ERRORS.map((item) => item.count), 1)) * 100}%` }} /></span>
                <b className="w-16 text-right text-[0.8125rem] tabular-nums text-foreground">{formatFull(row.count)}</b>
              </li>
            ))}
          </ul>
          <footer className="mt-auto flex items-center justify-between border-t border-border pt-2">
            <button type="button" onClick={() => notify("Full service error table is a mock view.")} className="text-sm font-medium text-primary hover:underline">View all →</button>
            <span className="text-xs text-muted-foreground">{formatFull(LOG_TOTALS.errors)} errors total</span>
          </footer>
        </Panel>

        <Panel title="Top Error Patterns" className="flex h-full min-w-0 flex-col rounded-xl p-4" titleClassName="text-[1rem] font-semibold">
          <ul className="flex flex-1 flex-col justify-between gap-1 pt-1">
            {TOP_ERROR_PATTERNS.map((row) => (
              <li key={row.pattern}>
                <button
                  type="button"
                  onClick={() => applyQuery(row.exemplar.slice(0, 64), "Pattern applied to search.")}
                  title={`${row.pattern}\nClick to search this pattern`}
                  className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 truncate font-mono text-xs text-foreground">{row.pattern}</span>
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <b className="text-[0.8125rem] tabular-nums text-foreground">{formatCompact(row.count)}</b>
                    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums", row.trendPct > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
                      {row.trendPct > 0 ? <ArrowUpRight size={12} aria-hidden="true" /> : <ArrowDownRight size={12} aria-hidden="true" />}{Math.abs(row.trendPct).toFixed(0)}%
                    </span>
                  </span>
                  <span className="col-span-2 truncate text-xs text-muted-foreground">Last seen {timeAgo(row.lastSeenMs)} · {formatFull(row.count)} occurrences</span>
                </button>
              </li>
            ))}
          </ul>
          <footer className="mt-auto flex items-center justify-between border-t border-border pt-2">
            <button type="button" onClick={() => notify("Full pattern list is a mock view.")} className="text-sm font-medium text-primary hover:underline">View all →</button>
            <span className="text-xs text-muted-foreground">vs previous window</span>
          </footer>
        </Panel>

        <Panel title="Level Distribution" className="flex h-full min-w-0 flex-col rounded-xl p-4" titleClassName="text-[1rem] font-semibold">
          <div className="flex flex-1 flex-wrap items-center gap-4 pt-1">
            <LevelDonut />
            <div className="grid min-w-[12.5rem] flex-1 grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
              {LEVEL_ORDER.map((level) => {
                const value = LEVEL_COUNTS[level];
                const pct = (value / LOG_TOTALS.total) * 100;
                return (
                  <div key={level} className="flex flex-col items-center gap-0.5 rounded-lg border border-border/60 px-2 py-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[level] }} />{level}</span>
                    <b className="text-[0.8125rem] tabular-nums text-foreground">{formatCompact(value)}</b>
                    <span className="text-xs tabular-nums text-muted-foreground">{pct.toFixed(pct < 1 ? 2 : 1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
          <footer className="mt-auto flex items-center justify-between border-t border-border pt-2">
            <button type="button" onClick={() => notify("Full level breakdown is a mock view.")} className="text-sm font-medium text-primary hover:underline">View all →</button>
            <span className="text-xs text-muted-foreground">Total <b className="tabular-nums text-foreground">{formatFull(LOG_TOTALS.total)}</b></span>
          </footer>
        </Panel>
      </section>
      </>)}

      {toast && <div role="status" className="fixed bottom-4 right-4 z-[1300] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-lg">{toast}</div>}
    </div>
  );
}
