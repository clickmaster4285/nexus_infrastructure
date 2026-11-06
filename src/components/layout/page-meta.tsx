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
}

export function PageMeta({ breadcrumbs, demo = true, showRefresh = true, actions }: PageMetaProps) {
  return (
    <div className="flex h-[22px] flex-wrap items-center justify-between gap-2">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Home size={13} aria-hidden="true" className="text-muted-foreground" />
        {breadcrumbs.map((crumb) => (
          <span key={crumb} className="flex items-center gap-1.5">
            <ChevronRight size={11} aria-hidden="true" className="text-border" />
            <span aria-current={crumb === breadcrumbs[breadcrumbs.length - 1] ? "page" : undefined}>{crumb}</span>
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-2.5 text-[9px] text-muted-foreground sm:gap-4">
        {actions}
        {demo && (
          <Badge variant="secondary" className="border-transparent bg-[#e2efff] px-2.5 py-1 text-[8px] font-bold tracking-wide text-[#1476d4] dark:bg-[#17385c] dark:text-[#82c1ff]">
            DEMO DATA
          </Badge>
        )}
        <span className="hidden sm:inline">Last updated: Apr 23, 2025 14:32</span>
        {showRefresh && (
          <Button variant="ghost" size="icon-sm" aria-label="Refresh timestamp" className="h-6 w-6 text-muted-foreground">
            <RefreshCw size={13} />
          </Button>
        )}
      </div>
    </div>
  );
}
