import type { Metadata } from "next";

import { UptimeSlaReportsDashboard } from "@/components/monitoring/uptime-sla/uptime-sla-reports-dashboard";

export const metadata: Metadata = {
  title: "Uptime & SLA Reports",
};

export default function UptimeAndSlaReportsPage() {
  return <UptimeSlaReportsDashboard />;
}
