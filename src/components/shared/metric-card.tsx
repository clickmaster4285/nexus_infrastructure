import { ArrowDown, ArrowUp } from "lucide-react";

import { Icon } from "@/components/shared/icon";
import { StatCard } from "@/components/shared/stat-card";
import { cn } from "@/lib/utils";
import type { MetricStat } from "@/data/mock/dashboard";

const toneStyles: Record<string, string> = {
  blue: "bg-[#e2f0ff] text-[#1379e8] dark:bg-[#17385c] dark:text-[#5fb0ff]",
  green: "bg-[#dff7eb] text-[#13a564] dark:bg-[#123a2a] dark:text-[#4fd69a]",
  red: "bg-[#ffeaec] text-[#e83f4d] dark:bg-[#492a35] dark:text-[#ff8b98]",
  amber: "bg-[#fff1d7] text-[#dc941c] dark:bg-[#493a29] dark:text-[#ffc16e]",
  purple: "bg-[#f1eaff] text-[#874fe0] dark:bg-[#35264d] dark:text-[#bd98ff]",
};

interface MetricCardProps {
  item: MetricStat;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  trendClassName?: string;
  detailClassName?: string;
}

export function MetricCard({ item, className, labelClassName, valueClassName, trendClassName, detailClassName }: MetricCardProps) {
  const isDown = item.trend === "down";
  const trend = item.trend === "flat"
    ? item.change
    : <>{isDown ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUp size={12} aria-hidden="true" />}{item.change}</>;
  return (
    <StatCard
      icon={<Icon name={item.icon} size={20} />}
      iconTone={toneStyles[item.tone] ?? toneStyles.blue}
      label={item.label}
      value={item.value}
      trend={trend}
      className={className}
      labelClassName={labelClassName}
      valueClassName={valueClassName}
      trendClassName={cn(item.trend !== "flat" && "text-success", trendClassName)}
      detailClassName={detailClassName}
      detail={item.detail}
    />
  );
}
