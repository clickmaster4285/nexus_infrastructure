import type { ReactNode } from "react";
import { MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = ["24h", "7d", "30d"] as const;

interface PanelProps {
  title: ReactNode;
  children?: ReactNode;
  /** Optional default time-range for the panel toolbar, e.g. "24h". */
  range?: string;
  className?: string;
  /** Optional title styling for page-scoped typography adjustments. */
  titleClassName?: string;
  /** Extra controls rendered before the range select and options button. */
  action?: ReactNode;
  showOptions?: boolean;
  optionsButtonClassName?: string;
  /** Optional classes for the header row, e.g. "h-10" for a taller header. */
  headerClassName?: string;
  /** Shared dense layout used by the overview dashboards. */
  size?: "default" | "lg";
}

export function Panel({ title, children, range, className, titleClassName, action, showOptions = true, optionsButtonClassName, headerClassName, size = "default" }: PanelProps) {
  return (
    <Card className={cn("flex min-w-0 flex-col p-2.5", className)}>
      <div className={cn("flex h-10 shrink-0 items-center justify-between gap-2", headerClassName ?? (size === "lg" ? "mb-1" : undefined))}>
        <CardTitle className={cn("truncate", size === "lg" && "text-base font-semibold leading-[1.25]", titleClassName)}>{title}</CardTitle>
        <div className="flex shrink-0 items-center gap-0.5">
          {action}
          {range && (
            <Select defaultValue={range}>
              <SelectTrigger className="h-10 w-16 text-xs" aria-label={`${title} time range`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {showOptions && (
            <Button variant="ghost" size="icon" className={cn("text-muted-foreground", optionsButtonClassName)} aria-label={`${title} options`}>
              <MoreVertical size={15} />
            </Button>
          )}
        </div>
      </div>
      {children}
    </Card>
  );
}

export interface LegendItem {
  name: string;
  color: string;
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pt-0.5 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.name} className="flex items-center gap-1.5 whitespace-nowrap">
          <span aria-hidden="true" className="h-[0.4375rem] w-[0.4375rem] rounded-full" style={{ background: item.color }} />
          {item.name}
        </span>
      ))}
    </div>
  );
}
