import { ArrowRight } from "lucide-react";

import { Icon } from "@/components/shared/icon";
import { Panel } from "@/components/shared/panel";
import { cn } from "@/lib/utils";
import { infrastructureEvents } from "@/data/mock/infrastructure";

const eventIconTone: Record<string, string> = {
  green: "bg-[oklch(0.9634_0.0223_164.52)] text-[oklch(0.6624_0.1451_158.7)]",
  blue: "bg-[oklch(0.9641_0.0185_242.96)] text-[oklch(0.6081_0.1442_250.41)]",
  amber: "bg-[oklch(0.9683_0.0293_80.66)] text-[oklch(0.7491_0.1479_70.33)]",
};

const environmentDot: Record<string, string> = {
  production: "bg-[oklch(0.6858_0.1479_159.12)]",
  staging: "bg-[oklch(0.7668_0.1478_72.4)]",
  office: "bg-[oklch(0.7259_0.0377_103.81)]",
};

export function InfrastructureEventsPanel({ className }: { className?: string }) {
  const action = (
    <button type="button" className="flex cursor-pointer items-center gap-1 text-[0.75rem] text-[oklch(0.5977_0.1154_248.69)] transition-colors hover:text-[oklch(0.5254_0.1121_249.21)]">
      View All <ArrowRight size={12} aria-hidden="true" />
    </button>
  );

  return (
    <Panel title="Recent Infrastructure Events" action={action} className={className}>
      <div className="mt-1.5 flex flex-col">
        {infrastructureEvents.map((event) => (
          <div key={event.title} className="flex h-[2.25rem] min-w-0 items-center gap-2 border-b border-border/70 last:border-b-0">
            <span className={cn("grid h-[1.5625rem] w-[1.5625rem] shrink-0 place-items-center rounded-full", eventIconTone[event.tone] ?? eventIconTone.blue)}>
              <Icon name={event.icon} size={14} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <b className="truncate text-[0.75rem] font-semibold text-[oklch(0.5263_0.0514_251.75)] dark:text-[oklch(0.8557_0.0264_253.59)]">{event.title}</b>
              <small className="text-[0.75rem] text-muted-foreground">{event.date}</small>
            </div>
            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[0.6875rem] text-[oklch(0.5348_0.0563_249.79)] dark:text-[oklch(0.7879_0.0377_252.13)]">
              <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", environmentDot[event.environment.toLowerCase()] ?? "bg-[oklch(0.7259_0.0377_103.81)]")} />
              {event.environment}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
