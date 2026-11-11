import { ArrowRight } from "lucide-react";

import { Icon } from "@/components/shared/icon";
import { Panel } from "@/components/shared/panel";
import { cn } from "@/lib/utils";
import { infrastructureEvents } from "@/data/mock/infrastructure";

const eventIconTone: Record<string, string> = {
  green: "bg-[#e6f8ef] text-[#20ad71]",
  blue: "bg-[#e9f5ff] text-[#3286d5]",
  amber: "bg-[#fff3df] text-[#e89b2d]",
};

const environmentDot: Record<string, string> = {
  production: "bg-[#25b578]",
  staging: "bg-[#eca232]",
  office: "bg-[#aaa88d]",
};

export function InfrastructureEventsPanel({ className }: { className?: string }) {
  const action = (
    <button type="button" className="flex cursor-pointer items-center gap-1 text-[12px] text-[#4284c1] transition-colors hover:text-[#2f6ea8]">
      View All <ArrowRight size={12} aria-hidden="true" />
    </button>
  );

  return (
    <Panel title="Recent Infrastructure Events" action={action} className={className}>
      <div className="mt-1.5 flex flex-col">
        {infrastructureEvents.map((event) => (
          <div key={event.title} className="flex h-[44px] min-w-0 items-center gap-2 border-b border-border/70 last:border-b-0">
            <span className={cn("grid h-[25px] w-[25px] shrink-0 place-items-center rounded-full", eventIconTone[event.tone] ?? eventIconTone.blue)}>
              <Icon name={event.icon} size={14} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <b className="truncate text-[12px] font-semibold text-[#556d88] dark:text-[#c4d1e1]">{event.title}</b>
              <small className="text-[12px] text-muted-foreground">{event.date}</small>
            </div>
            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] text-[#54708d] dark:text-[#a9bcd2]">
              <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", environmentDot[event.environment.toLowerCase()] ?? "bg-[#aaa88d]")} />
              {event.environment}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
