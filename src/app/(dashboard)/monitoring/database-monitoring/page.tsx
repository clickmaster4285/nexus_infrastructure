import type { Metadata } from "next";

import { DatabaseMonitoringDashboard } from "@/components/monitoring/database-monitoring-dashboard";

export const metadata: Metadata = {
  title: "Database Monitoring",
};

export default function DatabaseMonitoringPage() {
  return <DatabaseMonitoringDashboard />;
}
