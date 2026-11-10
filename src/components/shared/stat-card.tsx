import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  trend?: ReactNode;
  iconTone?: string;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  trendClassName?: string;
  detail?: ReactNode;
}

export function StatCard({ icon, label, value, trend, iconTone = "bg-blue-50 text-blue-600", className, labelClassName, valueClassName, trendClassName, detail }: StatCardProps) {
  return (
    <Card className={cn("flex h-[108px] min-w-0 items-center gap-3 rounded-xl p-4", className)}>
      <span aria-hidden="true" className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", iconTone)}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[14px] font-medium text-muted-foreground", labelClassName)}>{label}</p>
        <p className={cn("font-display whitespace-nowrap text-[29px] font-bold leading-tight tracking-tight text-foreground", valueClassName)}>{value}</p>
        {trend && <div className={cn("flex items-center gap-0.5 whitespace-nowrap text-[12px] leading-tight text-emerald-600", trendClassName)}>{trend}</div>}
        {detail && <div className="mt-1 truncate text-[12px] text-muted-foreground">{detail}</div>}
      </div>
    </Card>
  );
}
