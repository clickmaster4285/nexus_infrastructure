import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import { Panel } from "@/components/shared/panel";
import { cn } from "@/lib/utils";
import type { BackupTableRow, LatencyTableRow, MetricTableRow } from "@/data/mock/dashboard";

const metricHeaderLabel = (title: string) => (title.includes("CPU") ? "CPU Usage" : "Memory Usage");

const metricTextColor: Record<string, string> = {
  red: "text-[oklch(0.6231_0.2035_20.75)] dark:text-[oklch(0.7142_0.1804_17.61)]",
  amber: "text-[oklch(0.7182_0.1575_62.3)] dark:text-[oklch(0.8247_0.1356_68.25)]",
  orange: "text-[oklch(0.7182_0.1575_62.3)] dark:text-[oklch(0.8247_0.1356_68.25)]",
  yellow: "text-[oklch(0.7428_0.1464_89.61)] dark:text-[oklch(0.897_0.1308_89.72)]",
  green: "text-[oklch(0.6137_0.1504_152.29)] dark:text-[oklch(0.7869_0.1465_160.69)]",
  blue: "text-[oklch(0.6211_0.1895_256.06)] dark:text-[oklch(0.7727_0.1187_253.05)]",
};

const dotColor: Record<string, string> = {
  red: "bg-[oklch(0.6406_0.2075_21.05)]",
  amber: "bg-[oklch(0.7643_0.1586_66.17)]",
  orange: "bg-[oklch(0.7643_0.1586_66.17)]",
  yellow: "bg-[oklch(0.847_0.162_95.65)]",
  green: "bg-[oklch(0.6807_0.155_156.74)]",
  blue: "bg-[oklch(0.6211_0.1895_256.06)]",
  teal: "bg-[oklch(0.7027_0.1244_179.91)]",
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

const linkArrowColor = (kind: SummaryServerTableProps["kind"], title: string) => {
  if (kind === "backup") return "text-amber-500 dark:text-amber-400";
  if (kind === "latency") return "text-emerald-500 dark:text-emerald-400";
  return title.includes("CPU") ? "text-blue-500 dark:text-blue-400" : "text-violet-500 dark:text-violet-400";
};

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
    <Panel title={title} className={cn("min-h-[11.375rem] p-2.5", className)}>
      <div className="min-w-0 flex-1 overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th
                  key={header}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap border-y border-border px-2 py-1.5 text-center text-[0.5625rem] font-semibold text-[oklch(0.5077_0.0481_255.16)] dark:text-muted-foreground",
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
                  <td className="truncate px-2 py-1.5 text-[0.8125rem] font-medium text-[oklch(0.2947_0.0474_257.44)] dark:text-[oklch(0.9083_0.0214_252.5)]">
                    <span aria-hidden="true" className={cn("mr-1.5 inline-block h-[0.375rem] w-[0.375rem] rounded-full align-middle", dotColor[row.color] ?? dotColor.blue)} />
                    {row.name}
                  </td>
                  <td className={cn("px-2 py-1.5 text-center text-[0.8125rem] font-semibold", metricTextColor[row.color] ?? metricTextColor.blue)}>
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
                  <td className="truncate px-2 py-1.5 text-[0.8125rem] font-medium text-[oklch(0.2947_0.0474_257.44)] dark:text-[oklch(0.9083_0.0214_252.5)]">
                    <span aria-hidden="true" className={cn("mr-1.5 inline-block h-[0.375rem] w-[0.375rem] rounded-full align-middle", dotColor[row.color] ?? dotColor.blue)} />
                    {row.name}
                  </td>
                  <td className="px-2 py-1.5 text-center text-[0.8125rem] text-[oklch(0.4972_0.0484_255.17)] dark:text-[oklch(0.8156_0.0279_255.11)]">{row.free}</td>
                  <td className={cn("px-2 py-1.5 text-center text-[0.8125rem] font-semibold", metricTextColor[row.color] ?? metricTextColor.blue)}>
                    {row.usage}%
                  </td>
                </tr>
              ))}
            {props.kind === "latency" &&
              props.rows.map((row) => (
                <tr key={row.name} className="border-b border-border/60 last:border-b-0">
                  <td className="truncate px-2 py-1.5 text-[0.8125rem] font-medium text-[oklch(0.2947_0.0474_257.44)] dark:text-[oklch(0.9083_0.0214_252.5)]">
                    <span aria-hidden="true" className={cn("mr-1.5 inline-block h-[0.375rem] w-[0.375rem] rounded-full align-middle", dotColor[row.color] ?? dotColor.blue)} />
                    {row.name}
                  </td>
                  <td
                    className={cn(
                    "px-2 py-1.5 text-center text-[0.8125rem] font-semibold",
                      row.color === "green" || row.color === "teal"
                        ? "text-[oklch(0.6275_0.1381_159.56)] dark:text-[oklch(0.7869_0.1465_160.69)]"
                        : row.color === "amber"
                          ? "text-[oklch(0.7002_0.1443_68.3)] dark:text-[oklch(0.8247_0.1356_68.25)]"
                          : "text-[oklch(0.5945_0.1692_254.83)] dark:text-[oklch(0.7727_0.1187_253.05)]",
                    )}
                  >
                    {row.latency}
                  </td>
                  <td className="truncate px-2 py-1.5 text-center text-[0.75rem] text-muted-foreground">
                    <LatencyTrendIndicator trend={row.trend} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Link href={link.href} className="executive-overview-trend mt-1.5 inline-flex w-fit items-center gap-1.5 pt-1 text-[0.75rem] font-semibold text-primary transition-colors hover:text-primary/80">
        View all {link.label} <ArrowRight className={linkArrowColor(kind, title)} size={12} aria-hidden="true" />
      </Link>
    </Panel>
  );
}

function TrendIndicator({ trend }: { trend: string }) {
  if (trend === "↑") {
    return (
      <span className="executive-overview-trend inline-flex items-center justify-center text-destructive" role="img" aria-label="Increasing">
        <ArrowUp size={14} strokeWidth={2.6} />
      </span>
    );
  }
  if (trend === "↓") {
    return (
      <span className="executive-overview-trend inline-flex items-center justify-center text-success" role="img" aria-label="Decreasing">
        <ArrowDown size={14} strokeWidth={2.6} />
      </span>
    );
  }
  return (
    <span className="executive-overview-trend inline-flex items-center justify-center text-muted-foreground" role="img" aria-label="Stable">
      <ArrowRight size={14} strokeWidth={2.4} />
    </span>
  );
}

function LatencyTrendIndicator({ trend }: { trend: string }) {
  const match = trend.match(/^([↑↓→])\s*(.*)$/);
  if (!match) return <span className="whitespace-nowrap">{trend}</span>;

  const [, direction, time] = match;
  const Icon = direction === "↑" ? ArrowUp : direction === "↓" ? ArrowDown : ArrowRight;
  const color = direction === "↑" ? "text-destructive" : direction === "↓" ? "text-success" : "text-muted-foreground";

  return (
    <span className="inline-flex items-center justify-center gap-1 whitespace-nowrap">
      <Icon className={color} size={14} strokeWidth={2.6} aria-hidden="true" />
      {time && <span>{time}</span>}
    </span>
  );
}
