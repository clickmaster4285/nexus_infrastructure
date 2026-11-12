import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: ReactNode;
  /** Full label, never truncated — wraps to a second line when needed. */
  label: string;
  value: string;
  /** Signed delta in absolute units, e.g. 142 or -38. Renders "↑ 142 (6.1%)". */
  delta?: number | null;
  /** Pre-formatted percent for the delta, e.g. "6.1%". */
  deltaPercent?: string;
  /** Which direction counts as good. Default "up". */
  goodDirection?: "up" | "down";
  /** Free-form trend node; overrides the delta rendering when provided. */
  trend?: ReactNode;
  iconTone?: string;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  trendClassName?: string;
  detailClassName?: string;
  detail?: ReactNode;
}

export function StatCard({
  icon,
  label,
  value,
  delta = null,
  deltaPercent,
  goodDirection = "up",
  trend,
  iconTone = "bg-blue-50 text-blue-600",
  className,
  labelClassName,
  valueClassName,
  trendClassName,
  detailClassName,
  detail,
}: StatCardProps) {
  const isGood = delta == null
    ? null
    : goodDirection === "down"
      ? delta <= 0
      : delta >= 0;
  const autoTrend = delta == null
    ? null
    : (
      <>
        {delta >= 0 ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
        {`${Math.abs(delta) >= 1000 ? Math.round(Math.abs(delta)).toLocaleString("en-US") : Math.abs(delta)}${deltaPercent ? ` (${deltaPercent})` : ""}`}
      </>
    );
  const trendNode = trend ?? autoTrend;
  const trendTone = trend != null || isGood == null
    ? undefined
    : isGood
      ? "text-success"
      : "text-rose-600";

  return (
    <Card className={cn("flex h-full min-h-[104px] w-full min-w-0 items-center gap-3 rounded-xl p-4", className)}>
      <span aria-hidden="true" className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", iconTone)}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[12px] font-medium leading-snug text-muted-foreground", labelClassName)}>{label}</p>
        <p className={cn("font-display whitespace-nowrap text-[24px] font-bold leading-tight tracking-tight text-foreground tabular-nums", valueClassName)}>{value}</p>
        {trendNode && (
          <div className={cn("mt-0.5 flex items-center gap-0.5 whitespace-nowrap text-[12px] leading-tight text-emerald-600", trendTone, trendClassName)}>
            {trendNode}
          </div>
        )}
        {detail && <div className={cn("mt-1 text-[12px] leading-snug text-muted-foreground", detailClassName)}>{detail}</div>}
      </div>
    </Card>
  );
}
