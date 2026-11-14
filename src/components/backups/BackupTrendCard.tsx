"use client";

import { useMemo, useState } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";

import { ChartCard, Chip, SegmentedControl } from "@/components/logs/primitives";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { MoreVertical } from "lucide-react";
import type { BackupRun } from "@/mocks/backupRuns";
import { deriveTrend, formatDuration } from "@/utils/backupStats";
import { formatBytes } from "@/utils/storageForecast";
import { cn } from "@/lib/utils";

interface TooltipPayloadItem { dataKey?: string | number; value?: number | string; payload?: Record<string, unknown> }
interface TooltipProps { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }

function RunsTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const valueOf = (key: string) => Number(payload.find((item) => item.dataKey === key)?.value ?? 0);
  const data = payload[0]?.payload as { dateKey?: string; success?: number; failed?: number; skipped?: number; sizeBytes?: number } | undefined;
  const success = valueOf("success");
  const failed = valueOf("failed");
  const skipped = valueOf("skipped");
  const total = success + failed + skipped;
  const pct = total > 0 ? Math.round((success / total) * 100) : 100;
  const rows = [
    { label: "Success", value: success, dot: "#34D399" },
    { label: "Failed", value: failed, dot: "#F87171" },
    { label: "Skipped", value: skipped, dot: "#94A3B8" },
  ];
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center gap-2 py-0.5 text-muted-foreground">
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: row.dot }} />
          <span>{row.label}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums text-foreground">{row.value}</span>
        </p>
      ))}
      <div className="mt-1 border-t border-border/70 pt-1 text-xs text-muted-foreground">
        <p className="flex items-center justify-between gap-4 py-0.5">Success rate <b className="tabular-nums text-foreground">{pct}%</b></p>
        <p className="flex items-center justify-between gap-4 py-0.5">Written <b className="tabular-nums text-foreground">{formatBytes(data?.sizeBytes ?? 0)}</b></p>
      </div>
    </div>
  );
}

const LEGEND = [
  { label: "Success", key: "success", dot: "#34D399" },
  { label: "Failed", key: "failed", dot: "#F87171" },
  { label: "Skipped", key: "skipped", dot: "#94A3B8" },
] as const;

type SeriesKey = (typeof LEGEND)[number]["key"];

/** Stacked daily run bars with a smooth success-rate area line on a secondary axis. Range 7/30/90D, legend chips toggle series, bar click filters Jobs to that date; summary strip below. */
export function BackupTrendCard({ runs, onBarClick, onExport }: { runs: BackupRun[]; onBarClick: (dateKey: string) => void; onExport: () => void }) {
  const [range, setRange] = useState<"7D" | "30D" | "90D">("7D");
  const [hidden, setHidden] = useState<ReadonlySet<SeriesKey>>(new Set());
  const days = range === "7D" ? 7 : range === "30D" ? 30 : 90;

  const data = useMemo(() => deriveTrend(runs, days).map((bucket) => {
    const assessable = bucket.success + bucket.failed;
    return { ...bucket, rate: assessable > 0 ? Math.round((bucket.success / assessable) * 100) : null };
  }), [runs, days]);
  const summary = useMemo(() => {
    const total = data.reduce((sum, bucket) => sum + bucket.success + bucket.failed + bucket.skipped, 0);
    const success = data.reduce((sum, bucket) => sum + bucket.success, 0);
    const assessable = data.reduce((sum, bucket) => sum + bucket.success + bucket.failed, 0);
    const bytes = data.reduce((sum, bucket) => sum + bucket.sizeBytes, 0);
    const durations = runs
      .filter((run) => run.durationMs != null && run.status !== "running" && run.epochMs >= Date.now() - days * 24 * 60 * 60 * 1000)
      .map((run) => run.durationMs as number);
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
    return {
      total,
      successRate: assessable > 0 ? Math.round((success / assessable) * 100) : null,
      avgDuration,
      bytes,
    };
  }, [data, runs, days]);

  const toggleSeries = (key: SeriesKey) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // recharts v2 passes the datum merged into the bar entry; fall back to entry.payload for older shapes.
  const handleBarClick = (entry: { dateKey?: string; payload?: { dateKey?: string } } | null) => {
    const key = entry?.dateKey ?? entry?.payload?.dateKey;
    if (key) onBarClick(String(key));
  };

  return (
    <ChartCard
      title="Backup Trend"
      className="h-full min-h-[280px] p-4"
      actions={
        <div className="flex items-center gap-1.5">
          <SegmentedControl value={range} options={["7D", "30D", "90D"] as const} onChange={(value) => setRange(value as "7D" | "30D" | "90D")} buttonClassName="h-8 px-3 text-xs" />
          <AlertMenu
            label="Trend actions"
            align="end"
            width={190}
            trigger={
              <button type="button" aria-label="Trend actions" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <MoreVertical size={16} aria-hidden="true" />
              </button>
            }
            items={[{ key: "export", label: `Export ${range} CSV`, onSelect: onExport }]}
          />
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Toggle series">
          {LEGEND.map((item) => (
            <Chip key={item.key} active={!hidden.has(item.key)} onClick={() => toggleSeries(item.key)}>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: item.dot }} aria-hidden="true" />{item.label}</span>
            </Chip>
          ))}
        </div>
        <div className="min-h-[220px] flex-1" role="img" aria-label="Combo chart: stacked bars of daily backup runs by status, with a success-rate line on the right axis">
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <ComposedChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap={10}>
              <defs>
                <linearGradient id="btSuccess" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34D399" /><stop offset="100%" stopColor="#10B981" /></linearGradient>
                <linearGradient id="btFailed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F87171" /><stop offset="100%" stopColor="#EF4444" /></linearGradient>
                <linearGradient id="btSkipped" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#94A3B8" /><stop offset="100%" stopColor="#64748B" /></linearGradient>
                <linearGradient id="btRateFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={0.28} /><stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} /></linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#E5E7EB" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                interval={range === "90D" ? 14 : range === "30D" ? 4 : 0}
              />
              <YAxis
                yAxisId="vol"
                width={30}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                yAxisId="rate"
                orientation="right"
                width={34}
                domain={[0, 100]}
                tickCount={5}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={(value: number) => `${value}%`}
              />
              <Tooltip cursor={{ fill: "rgba(15,23,42,0.05)" }} content={<RunsTooltip />} />
              <ReferenceLine yAxisId="rate" y={95} stroke="#94A3B8" strokeDasharray="4 4" strokeWidth={1.25}
                label={{ value: "Target 95%", position: "insideTopRight", fontSize: 10, fill: "var(--muted-foreground)" }} />
              {!hidden.has("success") && (
                <Bar yAxisId="vol" dataKey="success" name="Success" stackId="status" fill="url(#btSuccess)" stroke="#ffffff" strokeWidth={1} maxBarSize={26} isAnimationActive={false}
                  onClick={handleBarClick} cursor="pointer" />
              )}
              {!hidden.has("failed") && (
                <Bar yAxisId="vol" dataKey="failed" name="Failed" stackId="status" fill="url(#btFailed)" stroke="#ffffff" strokeWidth={1} maxBarSize={26} isAnimationActive={false}
                  onClick={handleBarClick} cursor="pointer" />
              )}
              {!hidden.has("skipped") && (
                <Bar yAxisId="vol" dataKey="skipped" name="Skipped" stackId="status" fill="url(#btSkipped)" stroke="#ffffff" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false}
                  onClick={handleBarClick} cursor="pointer" />
              )}
              <Area yAxisId="rate" type="monotone" dataKey="rate" name="Success rate" stroke="none" fill="url(#btRateFill)" isAnimationActive={false} />
              <Line yAxisId="rate" type="monotone" dataKey="rate" name="Success rate" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3.5, strokeWidth: 1.5, fill: "#fff" }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {/* Summary strip */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border/70 pt-2 text-xs">
          <p className="text-muted-foreground">Total runs <b className="tabular-nums text-foreground">{summary.total}</b></p>
          <p className="text-muted-foreground">Success rate <b className="tabular-nums text-foreground">{summary.successRate == null ? "—" : `${summary.successRate}%`}</b></p>
          <p className="text-muted-foreground">Avg duration <b className="tabular-nums text-foreground">{summary.avgDuration == null ? "—" : formatDuration(summary.avgDuration)}</b></p>
          <p className="text-muted-foreground">Data written <b className="tabular-nums text-foreground">{formatBytes(summary.bytes)}</b></p>
        </div>
      </div>
    </ChartCard>
  );
}
