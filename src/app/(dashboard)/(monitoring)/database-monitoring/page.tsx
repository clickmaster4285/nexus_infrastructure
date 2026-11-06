import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Database Monitoring",
};

export default function DatabaseMonitoringPage() {
  return (
    <ComingSoon
      title="Database Monitoring"
      description="Query performance, replication lag, and connection pool health."
      breadcrumbs={["Monitoring", "Database Monitoring"]}
    />
  );
}
