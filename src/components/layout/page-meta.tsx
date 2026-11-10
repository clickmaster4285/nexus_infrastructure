import { ChevronRight, Home, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PageMetaProps {
  /** Breadcrumb trail, e.g. ["Infrastructure", "All Servers"] */
  breadcrumbs: string[];
  /** Shows the "DEMO DATA" badge. Defaults to true for mock-driven pages. */
  demo?: boolean;
  /** Hides the refresh button, e.g. on placeholder pages. */
  showRefresh?: boolean;
  /** Extra controls rendered on the right, before the demo badge. */
  actions?: React.ReactNode;
  /** Larger breadcrumb and status scale used by server detail dashboards. */
  variant?: "default" | "detail";
  /** Timestamp label, overridable by pages with a working refresh action. */
  lastUpdated?: string;
  onRefresh?: () => void;
}

export function PageMeta({ breadcrumbs, demo = true, showRefresh = true, actions, variant = "default", lastUpdated = "Nov 7, 2026 12:09", onRefresh }: PageMetaProps) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${variant === "detail" ? "min-h-6" : "h-[22px]"}`}>
      <nav aria-label="Breadcrumb" className={`flex items-center gap-1.5 text-muted-foreground ${variant === "detail" ? "text-[12px]" : "text-[10px]"}`}>
        <Home size={13} aria-hidden="true" className="text-muted-foreground" />
        {breadcrumbs.map((crumb) => (
          <span key={crumb} className="flex items-center gap-1.5">
            <ChevronRight size={11} aria-hidden="true" className="text-border" />
            <span aria-current={crumb === breadcrumbs[breadcrumbs.length - 1] ? "page" : undefined}>{crumb}</span>
          </span>
        ))}
      </nav>
      <div className={`flex items-center gap-2.5 text-muted-foreground sm:gap-4 ${variant === "detail" ? "text-[12px]" : "text-[9px]"}`}>
        {actions}
        {demo && (
          <Badge variant="secondary" className={`border-transparent bg-[#e2efff] px-2.5 py-1 font-bold tracking-wide text-[#1476d4] dark:bg-[#17385c] dark:text-[#82c1ff] ${variant === "detail" ? "text-[12px]" : "text-[8px]"}`}>
            DEMO DATA
          </Badge>
        )}
        <span className="hidden sm:inline">Last updated: {lastUpdated}</span>
        {showRefresh && (
          <Button variant="ghost" size="icon-sm" aria-label="Refresh timestamp" title="Refresh timestamp" onClick={onRefresh} className="h-7 w-7 text-muted-foreground">
            <RefreshCw size={13} />
          </Button>
        )}
      </div>
    </div>
  );
}
