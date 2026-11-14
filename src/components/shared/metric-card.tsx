import { ArrowDown, ArrowUp } from "lucide-react";

import { Icon } from "@/components/shared/icon";
import { StatCard } from "@/components/shared/stat-card";
import { cn } from "@/lib/utils";
import type { MetricStat } from "@/data/mock/dashboard";

const toneStyles: Record<string, string> = {
  blue: "bg-[oklch(0.9492_0.0252_249.95)] text-[oklch(0.5854_0.1886_255.66)] dark:bg-[oklch(0.3358_0.0746_252.64)] dark:text-[oklch(0.7396_0.14_249.73)]",
  green: "bg-[oklch(0.9553_0.0297_164.3)] text-[oklch(0.6367_0.1492_156.39)] dark:bg-[oklch(0.3149_0.0537_163.8)] dark:text-[oklch(0.7869_0.1465_160.69)]",
  red: "bg-[oklch(0.9544_0.023_10.96)] text-[oklch(0.6219_0.2045_21.23)] dark:bg-[oklch(0.328_0.0487_357.32)] dark:text-[oklch(0.7663_0.1406_13.84)]",
  amber: "bg-[oklch(0.9624_0.0373_83.03)] text-[oklch(0.7213_0.1471_72.82)] dark:bg-[oklch(0.3598_0.0347_69.88)] dark:text-[oklch(0.8508_0.123_72.9)]",
  purple: "bg-[oklch(0.9487_0.0289_301)] text-[oklch(0.5675_0.2098_296.93)] dark:bg-[oklch(0.306_0.07_300.04)] dark:text-[oklch(0.7536_0.1483_299.39)]",
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
      trendClassName={cn(
        item.trend !== "flat" && ((item.tone === "red" || item.tone === "amber") && item.trend === "up" ? "text-rose-600" : "text-success"),
        trendClassName,
      )}
      detailClassName={detailClassName}
      detail={item.detail}
    />
  );
}
