import type { Metadata } from "next";

import { WebsiteApiMonitoringDashboard } from "@/components/monitoring/website-api-monitoring-dashboard";

export const metadata: Metadata = {
  title: "Website & API Monitoring",
};

export default function WebsiteAndApiMonitoringPage() {
  return <WebsiteApiMonitoringDashboard />;
}
