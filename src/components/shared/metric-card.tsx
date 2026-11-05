import { ArrowDown, ArrowUp } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Icon } from "@/components/shared/icon";
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
}

export function MetricCard({ item, className }: MetricCardProps) {
  const isDown = item.trend === "down";
  return (
    <Card className={cn("flex h-[77px] min-w-0 items-center gap-2.5 p-2.5 sm:p-3", className)}>
      <div
        aria-hidden="true"
        className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", toneStyles[item.tone] ?? toneStyles.blue)}
      >
        <Icon name={item.icon} size={20} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[9px] text-[#47617f] dark:text-[#a9bcd2]" title={item.label}>
          {item.label}
        </div>
        <div className="font-display whitespace-nowrap text-[22px] font-extrabold leading-tight tracking-tight text-[#10213b] dark:text-[#e6edf7]">
          {item.value}
        </div>
        <div
          className={cn(
            "flex items-center gap-0.5 whitespace-nowrap text-[9px] leading-tight text-muted-foreground",
            item.trend !== "flat" && "text-success",
          )}
        >
          {item.trend !== "flat" && (isDown ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUp size={12} aria-hidden="true" />)}
          {item.change}
        </div>
        {item.detail && (
          <div className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-[9px] text-[#657993] dark:text-[#a9bcd2]">
            <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-success shadow-[0_0_0_3px_#1eb57a18]" />
            {item.detail}
          </div>
        )}
      </div>
    </Card>
  );
}
