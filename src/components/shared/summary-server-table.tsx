import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import { Panel } from "@/components/shared/panel";
import { cn } from "@/lib/utils";
import type { BackupTableRow, LatencyTableRow, MetricTableRow } from "@/data/mock/dashboard";

const metricHeaderLabel = (title: string) => (title.includes("CPU") ? "CPU Usage" : "Memory Usage");

const metricTextColor: Record<string, string> = {
  red: "text-[#e8404f] dark:text-[#ff6b78]",
  amber: "text-[#e88a1c] dark:text-[#ffb45c]",
  orange: "text-[#e88a1c] dark:text-[#ffb45c]",
  yellow: "text-[#d0a61a] dark:text-[#ffd970]",
  green: "text-[#1f9d55] dark:text-[#4fd69a]",
  blue: "text-[#2684f5] dark:text-[#7db9ff]",
};

const dotColor: Record<string, string> = {
  red: "bg-[#f04452]",
  amber: "bg-[#f59b28]",
  orange: "bg-[#f59b28]",
  yellow: "bg-[#edcb31]",
  green: "bg-[#20b470]",
  blue: "bg-[#2684f5]",
  teal: "bg-[#16b8a2]",
};

const linkHrefByKind = {
  metric: { label: "servers", href: "/all-servers" },
  backup: { label: "backups", href: "/backups-and-recovery" },
  latency: { label: "collectors", href: "/website-and-api-monitoring" },
} as const;

type SummaryServerTableProps =
  | { title: string; kind: "metric"; rows: MetricTableRow[]; className?: string }
  | { title: string; kind: "backup"; rows: BackupTableRow[]; className?: string }
  | { title: string; kind: "latency"; rows: LatencyTableRow[]; className?: string };

export function SummaryServerTable(props: SummaryServerTableProps) {
  const { title, kind, className } = props;
  const link = linkHrefByKind[kind];
  const headers =
    kind === "metric"
      ? ["Server", metricHeaderLabel(title), "Trend"]
      : kind === "backup"
        ? ["Server", "Free Space", "Usage"]
        : ["Service", "Latency", "Trend"];

  return (
    <Panel title={title} className={cn("min-h-[182px] p-2.5", className)}>
      <div className="min-w-0 flex-1 overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th
                  key={header}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap border-y border-border px-2 py-1.5 text-center text-[9px] font-semibold text-[#536781] dark:text-[#9babc0]",
                    index === 0 && "w-[38%]",
                  )}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.kind === "metric" &&
              props.rows.map((row) => (
                <tr key={row.name} className="border-b border-border/60 last:border-b-0">
                  <td className="truncate px-2 py-1.5 text-[10px] font-medium text-[#1d2d44] dark:text-[#d7e2ef]">
                    <span aria-hidden="true" className={cn("mr-1.5 inline-block h-[6px] w-[6px] rounded-full align-middle", dotColor[row.color] ?? dotColor.blue)} />
                    {row.name}
                  </td>
                  <td className={cn("px-2 py-1.5 text-center text-[10px] font-semibold", metricTextColor[row.color] ?? metricTextColor.blue)}>
                    {row.usage}%
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <TrendIndicator trend={row.trend} />
                  </td>
                </tr>
              ))}
            {props.kind === "backup" &&
              props.rows.map((row) => (
                <tr key={row.name} className="border-b border-border/60 last:border-b-0">
                  <td className="truncate px-2 py-1.5 text-[10px] font-medium text-[#1d2d44] dark:text-[#d7e2ef]">
                    <span aria-hidden="true" className={cn("mr-1.5 inline-block h-[6px] w-[6px] rounded-full align-middle", dotColor[row.color] ?? dotColor.blue)} />
                    {row.name}
                  </td>
                  <td className="px-2 py-1.5 text-center text-[10px] text-[#50647e] dark:text-[#b7c4d5]">{row.free}</td>
                  <td className={cn("px-2 py-1.5 text-center text-[10px] font-semibold", metricTextColor[row.color] ?? metricTextColor.blue)}>
                    {row.usage}%
                  </td>
                </tr>
              ))}
            {props.kind === "latency" &&
              props.rows.map((row) => (
                <tr key={row.name} className="border-b border-border/60 last:border-b-0">
                  <td className="truncate px-2 py-1.5 text-[10px] font-medium text-[#1d2d44] dark:text-[#d7e2ef]">
                    <span aria-hidden="true" className={cn("mr-1.5 inline-block h-[6px] w-[6px] rounded-full align-middle", dotColor[row.color] ?? dotColor.blue)} />
                    {row.name}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-1.5 text-center text-[10px] font-semibold",
                      row.color === "green" || row.color === "teal"
                        ? "text-[#16a16a] dark:text-[#4fd69a]"
                        : row.color === "amber"
                          ? "text-[#d88b20] dark:text-[#ffb45c]"
                          : "text-[#287ee0] dark:text-[#7db9ff]",
                    )}
                  >
                    {row.latency}
                  </td>
                  <td className="truncate px-2 py-1.5 text-center text-[9px] text-muted-foreground">{row.trend}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Link href={link.href} className="mt-1.5 inline-flex w-fit items-center gap-1.5 pt-1 text-[9px] font-semibold text-primary transition-colors hover:text-primary/80">
        View all {link.label} <ArrowRight size={12} aria-hidden="true" />
      </Link>
    </Panel>
  );
}

function TrendIndicator({ trend }: { trend: string }) {
  if (trend === "↑") {
    return (
      <span className="inline-flex items-center justify-center text-destructive" role="img" aria-label="Increasing">
        <ArrowUp size={14} strokeWidth={2.6} />
      </span>
    );
  }
  if (trend === "↓") {
    return (
      <span className="inline-flex items-center justify-center text-success" role="img" aria-label="Decreasing">
        <ArrowDown size={14} strokeWidth={2.6} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center text-muted-foreground" role="img" aria-label="Stable">
      <ArrowRight size={14} strokeWidth={2.4} />
    </span>
  );
}
