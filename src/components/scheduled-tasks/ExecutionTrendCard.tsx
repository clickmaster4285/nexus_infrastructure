"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MoreVertical } from "lucide-react";

import { AlertMenu } from "@/components/alerts/alert-menu";
import { SegmentedControl, ChartCard } from "@/components/logs/primitives";
import { Button } from "@/components/ui/button";
import type { TrendBucket } from "@/utils/taskStats";
import { cn } from "@/lib/utils";

export type TrendRange = "7D" | "30D";

interface ExecutionTrendCardProps {
  data: TrendBucket[];
  range: TrendRange;
  onRangeChange: (range: TrendRange) => void;
  onExport?: () => void;
}

const LEGEND = [
  { name: "Success", color: "#16A34A" },
  { name: "Failed", color: "#DC2626" },
  { name: "Skipped", color: "#94A3B8" },
] as const;

/** Stacked success/failed/skipped bars. Header row carries title + legend + 7D/30D tabs. */
export function ExecutionTrendCard({ data, range, onRangeChange, onExport }: ExecutionTrendCardProps) {
  const totals = useMemo(() => {
    let success = 0, failed = 0, skipped = 0;
    for (const bucket of data) { success += bucket.success; failed += bucket.failed; skipped += bucket.skipped; }
    const completed = success + failed;
    const rate = completed === 0 ? null : Math.round((success / completed) * 100);
    return { total: success + failed + skipped, success, failed, skipped, rate };
  }, [data]);

  return (
    <ChartCard
      className="flex h-full min-w-0 flex-col rounded-xl p-5"
      title="Execution Trend"
      actions={
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden items-center gap-3 md:flex" aria-hidden="true">
            {LEGEND.map((item) => (
              <span key={item.name} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                {item.name}
              </span>
            ))}
          </div>
          <SegmentedControl value={range} options={["7D", "30D"] as const} onChange={(value) => onRangeChange(value as TrendRange)} buttonClassName="h-7 px-2 text-[12px]" />
          <AlertMenu
            label="Execution trend options"
            width={180}
            trigger={
              <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="Execution trend options">
                <MoreVertical size={15} aria-hidden="true" />
              </Button>
            }
            items={[{ key: "export", label: "Export chart CSV", onSelect: onExport }]}
          />
        </div>
      }
    >
      <div className="mt-1 max-h-[260px] min-h-[220px] flex-1" role="img" aria-label={`Stacked bar chart of successful, failed and skipped runs per day, ${range === "7D" ? "last 7 days" : "last 30 days"}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap={8}>
            <CartesianGrid vertical={false} stroke="#E5E7EB" strokeDasharray="0" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} dy={6} interval={range === "30D" ? 4 : 0} />
            <YAxis allowDecimals={false} width={26} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              contentStyle={{
                borderRadius: 10, border: "1px solid var(--border)", background: "var(--popover)",
                fontSize: 12, boxShadow: "0 8px 24px rgba(16,24,40,0.12)",
              }}
              labelStyle={{ color: "var(--foreground)", fontWeight: 700 }}
              itemStyle={{ color: "var(--foreground)" }}
            />
            <Bar dataKey="success" name="Success" stackId="runs" fill="#16A34A" stroke="var(--card)" strokeWidth={1} />
            <Bar dataKey="failed" name="Failed" stackId="runs" fill="#DC2626" stroke="var(--card)" strokeWidth={1} />
            <Bar dataKey="skipped" name="Skipped" stackId="runs" fill="#94A3B8" stroke="var(--card)" strokeWidth={1} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary strip */}
      <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total Runs</p>
          <p className="mt-0.5 font-display text-lg font-bold leading-tight tabular-nums text-foreground">{totals.total}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Success Rate</p>
          <p className={cn("mt-0.5 font-display text-lg font-bold leading-tight tabular-nums", totals.rate == null ? "text-foreground" : totals.rate >= 95 ? "text-[#16A34A]" : "text-[#D97706]")}>
            {totals.rate == null ? "—" : `${totals.rate}%`}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Failures</p>
          <p className={cn("mt-0.5 font-display text-lg font-bold leading-tight tabular-nums", totals.failed > 0 ? "text-[#DC2626]" : "text-foreground")}>{totals.failed}</p>
        </div>
      </div>
    </ChartCard>
  );
}
