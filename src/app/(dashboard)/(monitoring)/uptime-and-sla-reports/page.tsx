import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Uptime & SLA Reports",
};

export default function UptimeAndSlaReportsPage() {
  return (
    <ComingSoon
      title="Uptime & SLA Reports"
      description="SLA attainment reports with exportable incident timelines."
      breadcrumbs={["Monitoring", "Uptime & SLA Reports"]}
    />
  );
}
