"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

import type { DailyUptime } from "@/mocks/uptimeSla";

echarts.use([LineChart, GridComponent, MarkLineComponent, TooltipComponent, CanvasRenderer]);

interface UptimeTrendChartProps {
  /** Oldest → newest */
  daily: DailyUptime[];
  /** SLA target in percent, e.g. 99.9 */
  target: number;
}

/** Flat daily uptime line. Y-axis auto-zooms to the data; points below target are red. */
export function UptimeTrendChart({ daily, target }: UptimeTrendChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const chart = echarts.init(host, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(host);

    const labels = daily.map((day) => day.label);
    const points = daily.map((day) => Number(day.uptime.toFixed(2)));
    const lowest = Math.min(...points, target);
    const yMin = Math.floor(Math.max(0, lowest - 0.15) * 10) / 10;

    const option: EChartsOption = {
      grid: { left: 0, right: 16, top: 22, bottom: 0, containLabel: true },
      tooltip: {
        trigger: "axis",
        triggerOn: "mousemove",
        confine: true,
        backgroundColor: "var(--popover)",
        borderColor: "var(--border)",
        borderWidth: 1,
        textStyle: { color: "var(--popover-foreground)", fontSize: 12 },
        axisPointer: { type: "line", lineStyle: { color: "#CBD5E1", width: 1 } },
        formatter: (params: unknown) => {
          const list = (Array.isArray(params) ? params : [params]) as Array<{ axisValue: string; value: number; dataIndex: number }>;
          const point = list[0];
          if (!point) return "";
          const day = daily[point.dataIndex];
          return [
            `<div style="font-weight:600;margin-bottom:0.25rem">${day.label}</div>`,
            `<div style="display:flex;justify-content:space-between;gap:1rem;line-height:1.25rem"><span>Uptime</span><b style="font-variant-numeric:tabular-nums">${point.value.toFixed(2)}%</b></div>`,
            `<div style="display:flex;justify-content:space-between;gap:1rem;line-height:1.25rem;color:var(--muted-foreground)"><span>Downtime</span><b style="font-variant-numeric:tabular-nums">${day.downtimeMinutes}m</b></div>`,
            `<div style="display:flex;justify-content:space-between;gap:1rem;line-height:1.25rem;color:var(--muted-foreground)"><span>Incidents</span><b style="font-variant-numeric:tabular-nums">${day.incidents}</b></div>`,
          ].join("");
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: labels,
        axisTick: { show: false },
        axisLine: { show: true, lineStyle: { color: "#D1D5DB" } },
        axisLabel: { color: "var(--muted-foreground)", fontSize: 12, hideOverlap: true, interval: Math.max(0, Math.ceil(labels.length / 7) - 1) },
      },
      yAxis: {
        type: "value",
        min: yMin,
        max: 100,
        splitNumber: 4,
        splitLine: { lineStyle: { color: "#E5E7EB", type: "solid", width: 1 } },
        axisLine: { show: false },
        axisLabel: { color: "var(--muted-foreground)", fontSize: 12, formatter: "{value}%" },
      },
      series: [{
        name: "Uptime",
        type: "line",
        smooth: 0.25,
        symbol: "circle",
        symbolSize: 7,
        showSymbol: true,
        data: points,
        lineStyle: { width: 2, color: "#3B82F6" },
        itemStyle: { color: "#3B82F6" },
        emphasis: { focus: "series" },
        areaStyle: {
          color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(59,130,246,0.18)" }, { offset: 1, color: "rgba(59,130,246,0)" }] },
        },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { type: "dashed", color: "#94A3B8", width: 1.5 },
          label: { formatter: `SLA ${target}%`, position: "insideEndTop", color: "#94A3B8", fontSize: 12 },
          data: [{ yAxis: target }],
        },
        markPoint: {
          symbol: "circle",
          symbolSize: 9,
          itemStyle: { color: "#DC2626" },
          data: daily.map((day, index) => ({ name: `low-${index}`, coord: [index, Number(day.uptime.toFixed(2))] })).filter((_, index) => daily[index].uptime < target),
          label: { show: false },
        },
      }],
    };
    chart.setOption(option, { notMerge: true });
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [daily, target]);

  return <div ref={hostRef} className="h-[18.75rem] w-full" role="img" aria-label="Daily uptime percentage with target reference line" />;
}
