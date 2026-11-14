import type { ReactNode } from "react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";

interface PageHeaderProps {
  breadcrumbs: string[];
  breadcrumbLinks?: Record<string, string>;
  title: string;
  subtitle: string;
  /** Optional page icon rendered in a soft green tile left of the title. */
  icon?: ReactNode;
  /** Override the icon tile classes (colours), keeping the default sizing. */
  iconClassName?: string;
  /** Optional status pill rendered next to the title, before the actions. */
  statusBadge?: ReactNode;
  actions?: ReactNode;
  /** Hides the refresh button, e.g. on placeholder pages. */
  showRefresh?: boolean;
  lastUpdated?: string;
  onRefresh?: () => void;
  /** Shows the demo badge when explicitly enabled. */
  demo?: boolean;
  /** Actions rendered in the page title row. */
  children?: ReactNode;
}

export function PageHeader({ breadcrumbs, breadcrumbLinks, title, subtitle, icon, iconClassName, statusBadge, actions, showRefresh = true, lastUpdated, onRefresh, demo = false, children }: PageHeaderProps) {
  return (
    <div className="min-w-0">
      <PageMeta breadcrumbs={breadcrumbs} breadcrumbLinks={breadcrumbLinks} demo={demo} showRefresh={showRefresh} lastUpdated={lastUpdated} onRefresh={onRefresh} />
      <PageHeading
        title={title}
        description={subtitle}
        icon={icon}
        iconClassName={iconClassName ?? "h-11 w-11 rounded-xl"}
        statusBadge={statusBadge}
        actionsAlign="bottom"
      >
        {actions}
        {children}
      </PageHeading>
    </div>
  );
}
