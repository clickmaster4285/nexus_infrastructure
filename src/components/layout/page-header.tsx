import type { ReactNode } from "react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";

interface PageHeaderProps {
  breadcrumbs: string[];
  title: string;
  subtitle: string;
  /** Optional page icon rendered in a soft green tile left of the title. */
  icon?: ReactNode;
  /** Override the icon tile classes (colours), keeping the default sizing. */
  iconClassName?: string;
  /** Optional status pill rendered next to the title, before the actions. */
  statusBadge?: ReactNode;
  actions?: ReactNode;
  lastUpdated?: string;
  onRefresh?: () => void;
  /** Shows the demo badge when explicitly enabled. */
  demo?: boolean;
  /** Actions rendered in the page title row. */
  children?: ReactNode;
  /** Header density. Default keeps the larger detail-page rhythm. */
  variant?: "default" | "detail";
}

export function PageHeader({ breadcrumbs, title, subtitle, icon, iconClassName, statusBadge, actions, lastUpdated, onRefresh, demo = false, children, variant = "detail" }: PageHeaderProps) {
  return (
    <div className="min-w-0">
      <PageMeta breadcrumbs={breadcrumbs} variant={variant} demo={demo} lastUpdated={lastUpdated} onRefresh={onRefresh} />
      <PageHeading
        title={title}
        description={subtitle}
        icon={icon}
        iconClassName={iconClassName ?? "h-11 w-11 rounded-xl"}
        statusBadge={statusBadge}
        actionsAlign="bottom"
        variant={variant}
      >
        {actions}
        {children}
      </PageHeading>
    </div>
  );
}
