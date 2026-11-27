"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "@/lib/echarts";
import { LineChart } from "echarts/charts";
import {
  GridComponent, MarkLineComponent, MarkAreaComponent, MarkPointComponent, TooltipComponent, LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Table2, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { daysToThreshold, forecastSeries, type CapacityResource, type ForecastMethod } from "@/mocks/capacityPlanning";

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkAreaComponent, MarkPointComponent, CanvasRenderer]);

export interface ScenarioOverlay {
  /** Adjusted trajectory, same length as the chart horizon. */
  points: Array<{ day: string; value: number }>;
  /** Display label, e.g. "What-if · S3 +5 TB". */
  label: string;
}

interface ForecastChartProps {
  resource: CapacityResource;
  horizonDays: 30 | 60 | 90 | 180;
  method: ForecastMethod;
  scenarioOverlay?: ScenarioOverlay | null;
  /** History window in days (30 | 90 | all=1Y). */
  historyDays: 30 | 90 | 365;
  className?: string;
  heightClassName?: string;
  showTableFallback?: boolean;
}

const pct = (value: number, capacity: number) => (capacity <= 0 ? 0 : (value / capacity) * 100);

/** Forecast chart for one resource. History solid, forecast dotted, band ±1.96σ, limit/warn/crit lines, Today line, exhaustion marker, maintenance bands hatched. */
export function ForecastChart({ resource, horizonDays, method, scenarioOverlay, historyDays, className, heightClassName }: ForecastChartProps) {
  const host = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);
  const [tableMode, setTableMode] = useState(false);
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});

  const model = useMemo(() => {
    const history = resource.history.slice(historyDays === 365 ? 0 : -historyDays);
    const fitted = forecastSeries(history.filter((point) => !point.excluded).map((point) => point.value), horizonDays, method);
    const xLabels: string[] = [];
    history.forEach((point) => xLabels.push(new Date(point.day).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })));
    for (let i = 1; i <= horizonDays; i += 1) {
      xLabels.push(new Date(Date.now() + i * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }));
    }
    const historyPct = history.map((point) => pct(point.value, resource.capacity));
    const forecastPct = fitted.points.map((point) => pct(point.value, resource.capacity));
    const lowerPct = fitted.points.map((point) => pct(point.lower, resource.capacity));
    const upperPct = fitted.points.map((point) => pct(point.upper, resource.capacity));
    const scenarioPct = scenarioOverlay
      ? scenarioOverlay.points.map((point) => pct(point.value, resource.capacity))
      : null;
    // markArea for excluded (maintenance/incident) days
    const excludedAreas = history.flatMap((point, index) => point.excluded ? [[{ xAxis: xLabels[index] }, { xAxis: xLabels[index] }]] : []);
    const todayIndex = history.length - 1;
    const exhaustionIndex = Number.isFinite(fitted.slopePerDay) && fitted.slopePerDay > 0
      ? Math.min(horizonDays, Math.floor(daysToThreshold(resource.current, fitted.slopePerDay, resource.critThreshold)))
      : null;
    const exhaustionLabel = exhaustionIndex != null && Number.isFinite(daysToThreshold(resource.current, fitted.slopePerDay, resource.critThreshold))
      ? `${new Date(Date.now() + daysToThreshold(resource.current, fitted.slopePerDay, resource.critThreshold) * 86_400_000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · est.`
      : null;
    return { xLabels, historyPct, forecastPct, lowerPct, upperPct, scenarioPct, excludedAreas, todayIndex, exhaustionIndex, exhaustionLabel, fitted, history };
  }, [resource, horizonDays, method, historyDays, scenarioOverlay]);

  useEffect(() => {
    if (tableMode) return;
    const node = host.current;
    if (!node) return;
    const chart = echarts.init(node, undefined, { renderer: "canvas" });
    instance.current = chart;
    const { xLabels, historyPct, forecastPct, lowerPct, upperPct, scenarioPct, excludedAreas, todayIndex, exhaustionIndex, exhaustionLabel } = model;
    const historySeries = historyPct.map((value) => Math.round(value * 10) / 10);
    const forecastLine = forecastPct.map((value) => Math.round(value * 10) / 10);
    const lower = lowerPct.map((value) => Math.round(value * 10) / 10);
    const upper = upperPct.map((value) => Math.round(value * 10) / 10);
    const blankHistoryTail = new Array(Math.max(0, forecastLine.length - 1)).fill(null);
    chart.setOption({
      animation: false,
      grid: { left: 8, right: 12, top: 34, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross", label: { show: true } },
        backgroundColor: "var(--popover)",
        borderColor: "var(--border)",
        textStyle: { color: "var(--popover-foreground)", fontSize: 12 },
        formatter: (params: Array<{ seriesName: string; value: number | null; axisValue: string }>) => {
          const axis = params[0]?.axisValue ?? "";
          const lines = params
            .filter((entry) => entry.value != null && (entry.seriesName === "Actual" || entry.seriesName === "Forecast"))
            .map((entry) => `<div style="display:flex;justify-content:space-between;gap:12px"><span>${entry.seriesName}</span><b>${Number(entry.value).toFixed(1)}%</b></div>`);
          return `<div style="font-weight:600;margin-bottom:4px">${axis}</div>${lines.join("")}<div style="margin-top:4px;color:var(--muted-foreground);font-size:11px">Estimated · band ±1.96σ</div>`;
        },
      },
      legend: { show: false, selected: { Actual: !hiddenSeries["Actual"], Forecast: !hiddenSeries["Forecast"], Scenario: !hiddenSeries["Scenario"], Band: !hiddenSeries["Band"], "band-gap": !hiddenSeries["Band"] } },
      xAxis: { type: "category", data: xLabels, boundaryGap: false, axisLine: { lineStyle: { color: "var(--border)" } }, axisTick: { show: false }, axisLabel: { color: "var(--muted-foreground)", fontSize: 11, interval: Math.max(0, Math.floor(xLabels.length / 9) - 1) } },
      yAxis: { type: "value", min: 0, max: 100, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: "var(--border)", type: "dashed", opacity: 0.6 } }, axisLabel: { color: "var(--muted-foreground)", fontSize: 11, formatter: "{value}%" } },
      series: [
        {
          name: "Band",
          type: "line",
          data: [...new Array(historyPct.length - 1).fill(null), ...lower],
          stack: "band",
          symbol: "none",
          lineStyle: { opacity: 0 },
          areaStyle: { color: "oklch(0.6231 0.188 259.81)", opacity: 0.12 },
          emphasis: { disabled: true },
          z: 1,
        },
        {
          name: "band-gap",
          type: "line",
          data: [...new Array(historyPct.length - 1).fill(null), ...upper.map((value, index) => Math.max(0, value - lower[index]))],
          stack: "band",
          symbol: "none",
          lineStyle: { opacity: 0 },
          areaStyle: { color: "transparent" },
          emphasis: { disabled: true },
          z: 1,
        },
        {
          name: "Actual",
          type: "line",
          data: [...historySeries, ...blankHistoryTail],
          smooth: 0.35,
          showSymbol: false,
          lineStyle: { width: 2.5, color: "oklch(0.6231 0.188 259.81)" },
          itemStyle: { color: "oklch(0.6231 0.188 259.81)" },
          emphasis: { focus: "series" },
          z: 5,
        },
        {
          name: "Forecast",
          type: "line",
          data: [...new Array(Math.max(0, historyPct.length - 1)).fill(null), ...forecastLine],
          smooth: 0.35,
          showSymbol: false,
          lineStyle: { width: 2.5, type: "dashed", color: "oklch(0.6658 0.1574 58.32)" },
          itemStyle: { color: "oklch(0.6658 0.1574 58.32)" },
          markLine: {
            symbol: "none",
            silent: true,
            data: [
              { xAxis: xLabels[todayIndex], label: { show: true, formatter: "Today", position: "insideEndTop", color: "var(--muted-foreground)", fontSize: 10 }, lineStyle: { color: "#0f766e", type: "solid", width: 1.5 } },
              { yAxis: resource.warnThreshold, name: "", label: { formatter: "Warn 85%", position: "insideStartTop", color: "#d97706", fontSize: 10 }, lineStyle: { color: "#f59e0b", type: "dashed", width: 1.5 } },
              { yAxis: resource.critThreshold, label: { formatter: "Crit 90%", position: "insideStartBottom", color: "#dc2626", fontSize: 10 }, lineStyle: { color: "#ef4444", type: "dashed", width: 1.5 } },
              { yAxis: 100, label: { formatter: "Capacity 100%", position: "insideStartBottom", color: "var(--muted-foreground)", fontSize: 10 }, lineStyle: { color: "var(--muted-foreground)", type: "solid", width: 1.5 } },
            ],
          },
          markPoint: exhaustionIndex != null && exhaustionLabel ? {
            symbol: "pin",
            symbolSize: 30,
            silent: true,
            label: { show: true, formatter: `Hits 90%\n${exhaustionLabel}`, fontSize: 9, color: "#fff", lineHeight: 11 },
            itemStyle: { color: "#dc2626" },
            data: [{ coord: [xLabels[historyPct.length + exhaustionIndex - 1], forecastLine[exhaustionIndex]] }],
          } : undefined,
          markArea: excludedAreas.length ? {
            silent: true,
            itemStyle: { color: "oklch(0.709 0.1592 293.54)", opacity: 0.14 },
            label: { show: true, formatter: "excluded", fontSize: 9, color: "var(--muted-foreground)" },
            data: excludedAreas,
          } : undefined,
          z: 4,
        },
        ...(scenarioOverlay && scenarioPct ? [{
          name: "Scenario",
          type: "line" as const,
          data: [...new Array(historyPct.length - 1).fill(null), ...scenarioPct.map((value) => Math.round(value * 10) / 10)],
          symbol: "none",
          smooth: 0.35,
          lineStyle: { width: 2, type: "dashed" as const, color: "oklch(0.709 0.1592 293.54)" },
          itemStyle: { color: "oklch(0.709 0.1592 293.54)" },
          z: 4,
        }] : []),
      ],
    });
    const resize = () => chart.resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      chart.dispose();
      instance.current = null;
    };
  }, [model, tableMode, resource.capacity, resource.warnThreshold, resource.critThreshold]);

  const visibleChips = [
    { key: "Actual", label: "Actual", color: "oklch(0.6231 0.188 259.81)" },
    { key: "Forecast", label: "Forecast · est.", color: "oklch(0.6658 0.1574 58.32)", dashed: true },
    { key: "Band", label: "Confidence band ±1.96σ", color: "oklch(0.6231 0.188 259.81 / 0.16)", block: true },
    ...(scenarioOverlay ? [{ key: "Scenario", label: scenarioOverlay.label, color: "oklch(0.709 0.1592 293.54)", dashed: true }] : []),
  ];

  const legendSelection = (hidden: Record<string, boolean>) => ({ Actual: !hidden["Actual"], Forecast: !hidden["Forecast"], Scenario: !hidden["Scenario"], Band: !hidden["Band"], "band-gap": !hidden["Band"] });
  const toggleSeries = (key: string) => {
    setHiddenSeries((current) => {
      const next = { ...current, [key]: !current[key] };
      instance.current?.setOption({ legend: { selected: legendSelection(next) } }, { notMerge: false });
      return next;
    });
  };

  const { xLabels, historyPct, lowerPct, upperPct, fitted } = model;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Toggle chart series">
          {visibleChips.map((chip) => {
            const hidden = Boolean(hiddenSeries[chip.key]);
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => toggleSeries(chip.key)}
                aria-pressed={!hidden}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[0.75rem] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  hidden ? "border-border text-muted-foreground opacity-50" : "border-primary/30 bg-primary/5 text-foreground",
                )}
              >
                <i aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: chip.color, ...(chip.dashed ? { backgroundImage: `linear-gradient(90deg, ${chip.color} 55%, transparent 55%)`, backgroundSize: "6px 2px" } : {}) }} />
                {chip.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setTableMode((value) => !value)} aria-pressed={tableMode} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-[0.75rem] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Table2 size={12} aria-hidden="true" />{tableMode ? "View chart" : "View as table"}
          </button>
        </div>
      </div>

      {tableMode ? (
        <div className="mt-2 max-h-[360px] flex-1 overflow-auto rounded-lg border border-border text-[0.8125rem]">
          <table className="w-full min-w-[520px] text-left">
            <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
              <tr><th className="px-3 py-2">Day</th><th className="px-3 py-2 text-right">Actual</th><th className="px-3 py-2 text-right">Forecast · est.</th><th className="px-3 py-2 text-right">Band low</th><th className="px-3 py-2 text-right">Band high</th></tr>
            </thead>
            <tbody>
              {xLabels.map((label, index) => {
                const isForecast = index >= historyPct.length;
                const forecastIndex = index - historyPct.length + 1;
                return (
                  <tr key={`${label}-${index}`} className="border-t border-border">
                    <td className="px-3 py-1.5 tabular-nums">{label}{isForecast ? " · est." : ""}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{isForecast ? "—" : `${historyPct[index].toFixed(1)}%`}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{isForecast || index === historyPct.length - 1 ? `${(fitted.points[Math.max(0, forecastIndex)]?.value ?? 0) / resource.capacity * 100 < 100 ? (((fitted.points[Math.max(0, forecastIndex)]?.value ?? 0) / resource.capacity) * 100).toFixed(1) : "100.0"}%` : "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{isForecast || index === historyPct.length - 1 ? `${pct(fitted.points[Math.max(0, forecastIndex)]?.lower ?? 0, resource.capacity).toFixed(1)}%` : "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{isForecast || index === historyPct.length - 1 ? `${pct(fitted.points[Math.max(0, forecastIndex)]?.upper ?? 0, resource.capacity).toFixed(1)}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={cn("relative mt-1 min-h-[360px] flex-1", heightClassName)}>
          <div ref={wrap} className="flex h-full w-full flex-col">
            <div ref={host} className="min-h-0 w-full flex-1" role="img" aria-label={`Forecast for ${resource.name}: history, ${model.fitted.method.toLowerCase()} forecast with ±1.96 sigma band, warn 85 percent and crit 90 percent thresholds`} />
          </div>
        </div>
      )}
    </div>
  );
}

export function ForecastAccuracyChip({ slopePerDay, r2, mape, method }: { slopePerDay: number; r2: number; mape: number; method: string }) {
  const accuracy = Math.max(0, Math.round(100 - mape));
  const tier = r2 >= 0.85 ? "High" : r2 >= 0.5 ? "Medium" : "Low";
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2 text-[0.6875rem] font-semibold text-muted-foreground" title={`${method} fit · R² ${r2.toFixed(2)} · MAPE ${mape.toFixed(1)}%`}>
      <TrendingUp size={12} aria-hidden="true" />Accuracy {accuracy}% · R² {r2.toFixed(2)} · {tier}
    </span>
  );
}

export function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const tone = level === "high" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
    : level === "medium" ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
      : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300";
  const label = level === "high" ? "High confidence" : level === "medium" ? "Medium confidence" : "Low · indicative only";
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.75rem] font-semibold capitalize", tone)}>{label}</span>;
}
