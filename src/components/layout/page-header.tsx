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
  /** Shows the "DEMO DATA" badge. Defaults to true for mock-driven pages. */
  demo?: boolean;
}

export function PageHeader({ breadcrumbs, title, subtitle, icon, iconClassName, statusBadge, actions, lastUpdated, onRefresh, demo = true }: PageHeaderProps) {
  return (
    <>
      <PageMeta breadcrumbs={breadcrumbs} variant="detail" demo={demo} lastUpdated={lastUpdated} onRefresh={onRefresh} />
      <PageHeading
        title={title}
        description={subtitle}
        icon={icon}
        iconClassName={iconClassName ?? "h-11 w-11 rounded-xl"}
        statusBadge={statusBadge}
        actionsAlign="bottom"
        variant="detail"
      >
        {actions}
      </PageHeading>
    </>
  );
}
