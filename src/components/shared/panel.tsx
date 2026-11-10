import { MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = ["24h", "7d", "30d"] as const;

interface PanelProps {
  title: string;
  children?: React.ReactNode;
  /** Optional default time-range for the panel toolbar, e.g. "24h". */
  range?: string;
  className?: string;
  /** Extra controls rendered before the range select and options button. */
  action?: React.ReactNode;
  showOptions?: boolean;
}

export function Panel({ title, children, range, className, action, showOptions = true }: PanelProps) {
  return (
    <Card className={cn("flex min-w-0 flex-col p-2.5", className)}>
      <div className="flex h-6 shrink-0 items-center justify-between gap-2">
        <CardTitle className="truncate">{title}</CardTitle>
        <div className="flex shrink-0 items-center gap-0.5">
          {action}
          {range && (
            <Select defaultValue={range}>
              <SelectTrigger className="h-[23px] w-[64px] text-[9px]" aria-label={`${title} time range`}>
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
            <Button variant="ghost" size="icon-sm" className="h-6 w-6 text-muted-foreground" aria-label={`${title} options`}>
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
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pt-0.5 text-[9px] text-muted-foreground">
      {items.map((item) => (
        <span key={item.name} className="flex items-center gap-1.5 whitespace-nowrap">
          <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ background: item.color }} />
          {item.name}
        </span>
      ))}
    </div>
  );
}
