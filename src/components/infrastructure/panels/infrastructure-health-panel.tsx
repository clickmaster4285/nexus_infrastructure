import { ArrowRight, CircleAlert, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";

import { Icon } from "@/components/shared/icon";
import { Panel } from "@/components/shared/panel";
import { cn } from "@/lib/utils";
import { infrastructureHealth, resourceUtilization } from "@/data/mock/infrastructure";

interface HealthItem {
  label: string;
  value: number;
  percent: number;
  icon: LucideIcon;
  tone: "green" | "amber" | "red";
  color: string;
}

const healthItems: HealthItem[] = [
  { label: "Healthy", value: infrastructureHealth.healthy, percent: 79, icon: ShieldCheck, tone: "green", color: "oklch(0.7227 0.192 149.58)" },
  { label: "Degraded", value: infrastructureHealth.degraded, percent: 17, icon: TriangleAlert, tone: "amber", color: "oklch(0.7686 0.1647 70.08)" },
  { label: "Offline", value: infrastructureHealth.offline, percent: 4, icon: CircleAlert, tone: "red", color: "oklch(0.6368 0.2078 25.33)" },
];

const resourceTone: Record<string, string> = {
  blue: "bg-[oklch(0.9575_0.0205_254.91)] text-[oklch(0.6101_0.1679_253.22)]",
  purple: "bg-[oklch(0.9479_0.0287_298.89)] text-[oklch(0.5813_0.2061_300.67)]",
  teal: "bg-[oklch(0.9609_0.0211_189.57)] text-[oklch(0.6677_0.1093_184.8)]",
};

const resourceBar: Record<string, string> = {
  blue: "bg-gradient-to-r from-[oklch(0.6769_0.1501_251.25)] to-[oklch(0.6159_0.1651_254.79)]",
  purple: "bg-gradient-to-r from-[oklch(0.6619_0.1826_304.82)] to-[oklch(0.5851_0.2036_300.78)]",
  teal: "bg-gradient-to-r from-[oklch(0.7664_0.1108_183.29)] to-[oklch(0.7006_0.1121_183.72)]",
};

const iconToneText: Record<string, string> = {
  green: "text-[oklch(0.6818_0.1505_158.51)] fill-[oklch(0.6818_0.1505_158.51_/_0.125)]",
  amber: "text-[oklch(0.7721_0.1492_71.68)] fill-[oklch(0.7721_0.1492_71.68_/_0.125)]",
  red: "text-[oklch(0.6469_0.1996_20.06)] fill-[oklch(0.6469_0.1996_20.06_/_0.125)]",
};

const alertChips = [
  { severity: "critical", label: "3 Critical", className: "bg-[oklch(0.9661_0.0151_17.42)] text-[oklch(0.5987_0.1952_22.48)] hover:bg-[oklch(0.937_0.0286_17.67)] dark:bg-[oklch(0.328_0.0487_357.32)] dark:text-[oklch(0.7663_0.1406_13.84)]" },
  { severity: "warning", label: "5 Warning", className: "bg-[oklch(0.9722_0.0209_72.16)] text-amber-600 hover:bg-[oklch(0.9436_0.0395_67.32)] dark:bg-[oklch(0.3598_0.0347_69.88)] dark:text-[oklch(0.8508_0.123_72.9)]" },
  { severity: "info", label: "2 Info", className: "bg-[oklch(0.967_0.0159_253.9)] text-[oklch(0.5638_0.1524_253.98)] hover:bg-[oklch(0.9337_0.027_249.85)] dark:bg-[oklch(0.3478_0.0588_254.82)] dark:text-[oklch(0.8185_0.0779_247.08)]" },
] as const;

interface InfrastructureHealthPanelProps {
  /** Called with the alert severity when a chip is clicked, or without arguments for "View all". */
  onAlertSelect?: (severity?: string) => void;
  className?: string;
}

export function InfrastructureHealthPanel({ onAlertSelect, className }: InfrastructureHealthPanelProps) {
  return (
    <Panel title="Infrastructure Health" className={cn("flex flex-col p-4", className)}>
      {/* Summary */}
      <div className="mt-1.5 border-b border-border pb-2.5">
        <div className="grid h-[4rem] grid-cols-3 items-center">
          {healthItems.map((item, index) => (
            <div
              key={item.label}
              className={cn("flex flex-col items-center justify-center gap-1", index < healthItems.length - 1 && "border-r border-border")}
            >
              <item.icon size={17} aria-hidden="true" className={iconToneText[item.tone]} />
              <b className="font-display text-[1.25rem] font-extrabold leading-none text-foreground">{item.value}</b>
              <span className="text-[0.75rem] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
        <div
          className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label="Health distribution: Healthy 79% (38), Degraded 17% (8), Offline 4% (2)"
        >
          {healthItems.map((item) => (
            <span key={item.label} title={`${item.label} ${item.percent}% (${item.value})`} style={{ flexGrow: item.value, backgroundColor: item.color }} />
          ))}
        </div>
      </div>

      {/* Resource utilization */}
      <div className="mb-3 mt-3 flex items-center justify-between">
        <b className="font-display text-[0.875rem] font-bold">Resource Utilization</b>
        <button type="button" className="flex cursor-pointer items-center gap-1 text-[0.75rem] text-[oklch(0.5977_0.1154_248.69)] transition-colors hover:text-[oklch(0.5254_0.1121_249.21)]">
          View Details <ArrowRight size={12} aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col gap-4">
        {resourceUtilization.map((resource) => (
          <div key={resource.label} className="flex items-center gap-2">
            <span className={cn("grid h-[1.6875rem] w-[1.6875rem] shrink-0 place-items-center rounded-full", resourceTone[resource.tone])}>
              <Icon name={resource.icon} size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between text-[0.75rem] text-[oklch(0.5553_0.0444_253.21)] dark:text-[oklch(0.7879_0.0377_252.13)]">
                <span>{resource.label}</span>
                <b className="font-semibold text-foreground">{resource.value}%</b>
              </div>
              <div className="h-[0.4375rem] overflow-hidden rounded-md bg-muted" aria-hidden="true">
                <div className={cn("h-full rounded-md", resourceBar[resource.tone])} style={{ width: `${resource.value}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active alerts */}
      <div className="mt-auto border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between">
          <b className="font-display text-[0.8125rem] font-bold">Active Alerts</b>
          <button
            type="button"
            onClick={() => onAlertSelect?.()}
            className="flex cursor-pointer items-center gap-1 text-[0.75rem] text-[oklch(0.5977_0.1154_248.69)] transition-colors hover:text-[oklch(0.5254_0.1121_249.21)]"
          >
            View all <ArrowRight size={12} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {alertChips.map((chip) => (
            <button
              key={chip.severity}
              type="button"
              onClick={() => onAlertSelect?.(chip.severity)}
              className={cn("min-h-[1.875rem] cursor-pointer whitespace-nowrap rounded-full px-3 text-[0.75rem] font-medium transition-colors", chip.className)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}
