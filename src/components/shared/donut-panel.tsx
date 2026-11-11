"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Panel } from "@/components/shared/panel";
import { cn } from "@/lib/utils";
import type { DonutDatum } from "@/data/mock/dashboard";

const tooltipStyle = {
  contentStyle: { border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)", color: "var(--popover-foreground)" },
};

interface DonutPanelProps {
  title: string;
  data: DonutDatum[];
  total: number;
  range?: string;
  totalLabel?: string;
  action?: React.ReactNode;
  className?: string;
}

export function DonutPanel({ title, data, total, range, totalLabel = "Total", action, className }: DonutPanelProps) {
  return (
    <Panel title={title} range={range} action={action} className={className}>
      <div className="executive-overview-donut flex h-[134px] flex-1 items-center gap-1.5">
        <div className="relative h-[122px] w-[47%] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="63%" outerRadius="88%" paddingAngle={1} stroke="none">
                {data.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="executive-overview-donut-center pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <b className="font-display text-[20px] font-extrabold leading-none text-[#15243b] dark:text-[#e7edf6]">{total}</b>
            <span className="mt-0.5 text-[12px] font-medium text-[#3a4a63] dark:text-[#a9bcd2]">{totalLabel}</span>
          </div>
        </div>
        <div className="executive-overview-donut-legend flex min-w-0 flex-1 flex-col gap-2.5">
          {data.map((item) => (
            <div key={item.name} className="executive-overview-donut-legend-row grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-[#15243b] dark:text-[#e7edf6]">
              <span aria-hidden="true" className="h-[8px] w-[8px] rounded-full" style={{ background: item.color }} />
              <span className="truncate">{item.name}</span>
              <span className="font-semibold tabular-nums">
                {item.value} <em className="not-italic font-medium text-[#3a4a63] dark:text-[#a9bcd2]">({Math.round((item.value / total) * 100)}%)</em>
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
