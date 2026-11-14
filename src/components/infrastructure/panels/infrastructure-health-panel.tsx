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
  { label: "Healthy", value: infrastructureHealth.healthy, percent: 79, icon: ShieldCheck, tone: "green", color: "#22c55e" },
  { label: "Degraded", value: infrastructureHealth.degraded, percent: 17, icon: TriangleAlert, tone: "amber", color: "#f59e0b" },
  { label: "Offline", value: infrastructureHealth.offline, percent: 4, icon: CircleAlert, tone: "red", color: "#ef4444" },
];

const resourceTone: Record<string, string> = {
  blue: "bg-[#e8f2ff] text-[#2784e4]",
  purple: "bg-[#f0eaff] text-[#9152df]",
  teal: "bg-[#e3f7f5] text-[#27aa9d]",
};

const resourceBar: Record<string, string> = {
  blue: "bg-gradient-to-r from-[#479bf0] to-[#3385e5]",
  purple: "bg-gradient-to-r from-[#ad70eb] to-[#9254df]",
  teal: "bg-gradient-to-r from-[#50caba] to-[#32b5a6]",
};

const iconToneText: Record<string, string> = {
  green: "text-[#20b475] fill-[#20b47520]",
  amber: "text-[#efa333] fill-[#efa33320]",
  red: "text-[#ef4b59] fill-[#ef4b5920]",
};

const alertChips = [
  { severity: "critical", label: "3 Critical", className: "bg-[#fef0f0] text-[#dc3d46] hover:bg-[#fde3e3] dark:bg-[#492a35] dark:text-[#ff8b98]" },
  { severity: "warning", label: "5 Warning", className: "bg-[#fff4e7] text-amber-600 hover:bg-[#ffe8d1] dark:bg-[#493a29] dark:text-[#ffc16e]" },
  { severity: "info", label: "2 Info", className: "bg-[#edf5ff] text-[#2876cc] hover:bg-[#dcebfb] dark:bg-[#243b58] dark:text-[#9bc9f4]" },
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
        <button type="button" className="flex cursor-pointer items-center gap-1 text-[0.75rem] text-[#4284c1] transition-colors hover:text-[#2f6ea8]">
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
              <div className="mb-1 flex items-center justify-between text-[0.75rem] text-[#61758d] dark:text-[#a9bcd2]">
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
            className="flex cursor-pointer items-center gap-1 text-[0.75rem] text-[#4284c1] transition-colors hover:text-[#2f6ea8]"
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
