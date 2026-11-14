"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { MoreVertical, CheckCircle2, XCircle, MinusCircle, Timer, Trophy } from "lucide-react";

import { AlertMenu } from "@/components/alerts/alert-menu";
import { SegmentedControl, ChartCard } from "@/components/logs/primitives";
import { Button } from "@/components/ui/button";
import type { TrendBucket } from "@/utils/taskStats";
import { cn } from "@/lib/utils";

export type TrendRange = "7D" | "30D" | "90D";
type TrendTab = "Runs" | "Duration" | "Heatmap";

interface ExecutionTrendCardProps {
  data: TrendBucket[];
  range: TrendRange;
  onRangeChange: (range: TrendRange) => void;
  onExport?: () => void;
}

const STATUS = [
  { name: "Success", key: "success", color: "#34D399" },
  { name: "Failed", key: "failed", color: "#F87171" },
  { name: "Skipped", key: "skipped", color: "#94A3B8" },
] as const;

function EChart({ option, label }: { option: EChartsOption; label: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = echarts.init(host);
    chartRef.current = chart;
    const resize = () => chart.resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => { observer.disconnect(); chart.dispose(); chartRef.current = null; };
  }, []);
  useEffect(() => { chartRef.current?.setOption(option, true); chartRef.current?.resize(); }, [option]);
  return <div ref={hostRef} className="h-full min-h-[15rem] min-w-0" role="img" aria-label={label} />;
}

export function ExecutionTrendCard({ data, range, onRangeChange, onExport }: ExecutionTrendCardProps) {
  const [tab, setTab] = useState<TrendTab>("Runs");
  const [showTable, setShowTable] = useState(false);
  const totals = useMemo(() => {
    const total = data.reduce((sum, item) => sum + item.success + item.failed + item.skipped, 0);
    const success = data.reduce((sum, item) => sum + item.success, 0);
    const failed = data.reduce((sum, item) => sum + item.failed, 0);
    const skipped = data.reduce((sum, item) => sum + item.skipped, 0);
    const completed = success + failed;
    return { total, success, failed, skipped, rate: completed ? Math.round(success / completed * 100) : 0 };
  }, [data]);
  const longest = data.reduce((best, item) => item.failed > best.failed ? item : best, data[0]);
  const labels = data.map((item) => item.label);
  const option = useMemo<any>(() => {
    const common: EChartsOption = { textStyle: { fontFamily: "inherit", color: "#64748B", fontSize: 12 }, grid: { left: 38, right: 42, top: 24, bottom: 28 }, tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "#0f172a", borderWidth: 0, textStyle: { color: "#fff", fontSize: 12 } }, legend: { show: false } };
    if (tab === "Runs") return { ...common, xAxis: { type: "category", data: labels, axisTick: { show: false }, axisLine: { lineStyle: { color: "#E2E8F0" } } }, yAxis: [{ type: "value", min: 0, splitLine: { lineStyle: { color: "#E2E8F0" } } }, { type: "value", min: 80, max: 100, splitLine: { show: false }, axisLabel: { formatter: "{value}%" } }], series: [...STATUS.map((item) => ({ name: item.name, type: "bar", stack: "runs", barMaxWidth: 24, itemStyle: { color: item.color, borderRadius: item.key === "skipped" ? [4, 4, 0, 0] : 0 }, data: data.map((bucket) => bucket[item.key]) })), { name: "Success rate", type: "line", yAxisIndex: 1, smooth: 0.3, symbolSize: 6, lineStyle: { color: "#2563EB", width: 2 }, itemStyle: { color: "#2563EB" }, data: data.map((bucket) => { const done = bucket.success + bucket.failed; return done ? Math.round(bucket.success / done * 100) : 100; }), markLine: { symbol: "none", lineStyle: { type: "dashed", color: "#94A3B8" }, label: { formatter: "Target 95%", color: "#64748B", fontSize: 11 }, data: [{ yAxis: 95 }] } }] };
    if (tab === "Duration") return { ...common, xAxis: { type: "category", data: labels, axisTick: { show: false } }, yAxis: { type: "value", name: "minutes", splitLine: { lineStyle: { color: "#E2E8F0" } } }, series: [{ name: "P50", type: "line", smooth: 0.3, lineStyle: { color: "#60A5FA", width: 2 }, areaStyle: { color: "rgba(96,165,250,.12)" }, data: data.map((bucket) => Math.max(2, bucket.success * 1.4)) }, { name: "P95", type: "line", smooth: 0.3, lineStyle: { color: "#FBBF24", width: 2 }, data: data.map((bucket) => Math.max(4, (bucket.success + bucket.failed) * 2.2)) }] };
    return { ...common, grid: { left: 60, right: 20, top: 18, bottom: 28 }, xAxis: { type: "category", data: ["00", "04", "08", "12", "16", "20"], axisTick: { show: false } }, yAxis: { type: "category", data: labels.slice(-7), axisTick: { show: false } }, visualMap: { min: 0, max: 4, calculable: false, orient: "horizontal", right: 0, top: -4, itemWidth: 70, itemHeight: 8, inRange: { color: ["#F8FAFC", "#FECACA", "#F87171", "#B91C1C"] }, textStyle: { fontSize: 11 } }, series: [{ type: "heatmap", data: labels.slice(-7).flatMap((_, row) => [0, 1, 2, 3, 4, 5].map((column) => [column, row, (data[row]?.failed ?? 0) > 0 && column === (row + 2) % 6 ? data[row].failed : 0])), label: { show: false }, itemStyle: { borderColor: "#fff", borderWidth: 2 } }] };
  }, [data, labels, tab]);
  return <ChartCard className="flex h-full min-w-0 flex-col rounded-xl p-4" title="Execution Trend" actions={<div className="flex shrink-0 items-center gap-2"><SegmentedControl value={tab} options={["Runs", "Duration", "Heatmap"]} onChange={(value) => setTab(value as TrendTab)} buttonClassName="h-8 px-2 text-sm" /><SegmentedControl value={range} options={["7D", "30D", "90D"]} onChange={(value) => onRangeChange(value as TrendRange)} buttonClassName="h-8 px-2 text-sm" /><AlertMenu label="Execution trend options" width={200} trigger={<Button variant="ghost" size="icon-sm" className="h-8 w-8 text-muted-foreground" aria-label="Execution trend options"><MoreVertical size={16} /></Button>} items={[{ key: "table", label: showTable ? "Hide table" : "View as table", onSelect: () => setShowTable((value) => !value) }, { key: "fullscreen", label: "Fullscreen", onSelect: () => document.querySelector("[data-execution-trend]")?.requestFullscreen?.() }, { key: "export", label: "Export CSV", onSelect: onExport }]} /></div>}>
    <div data-execution-trend className="flex min-h-0 flex-1 flex-col gap-3">
      {showTable ? <div className="min-h-[15rem] overflow-auto rounded-lg border border-border"><table className="w-full text-left text-sm"><caption className="sr-only">Execution trend by day</caption><thead><tr className="border-b border-border text-muted-foreground"><th className="px-2 py-2">Day</th><th className="px-2 py-2">Success</th><th className="px-2 py-2">Failed</th><th className="px-2 py-2">Skipped</th></tr></thead><tbody>{data.map((item) => <tr key={item.label} className="border-b border-border/70"><td className="px-2 py-2 font-medium">{item.label}</td><td className="px-2 py-2 text-emerald-600">{item.success}</td><td className="px-2 py-2 text-rose-500">{item.failed}</td><td className="px-2 py-2 text-slate-500">{item.skipped}</td></tr>)}</tbody></table></div> : <EChart option={option} label={`Execution trend ${tab.toLowerCase()} chart`} />}
      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-5"><Summary label="Total runs" value={String(totals.total)} icon={<Timer size={14} />} /><Summary label="Success rate excl. skipped" value={`${totals.rate}%`} icon={<CheckCircle2 size={14} />} /><Summary label="Failures" value={String(totals.failed)} icon={<XCircle size={14} />} tone="text-rose-500" /><Summary label="Avg duration" value="8m 24s" icon={<Timer size={14} />} /><Summary label="Longest run" value={longest?.label ?? "—"} icon={<Trophy size={14} />} /></div>
    </div>
  </ChartCard>;
}

function Summary({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone?: string }) { return <div className="min-w-0 rounded-lg bg-muted/50 px-2.5 py-2"><p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">{icon}{label}</p><p className={cn("mt-1 truncate text-base font-bold tabular-nums text-foreground", tone)}>{value}</p></div>; }
