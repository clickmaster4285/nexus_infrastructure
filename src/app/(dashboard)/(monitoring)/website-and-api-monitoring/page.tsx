import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Website & API Monitoring",
};

export default function WebsiteAndApiMonitoringPage() {
  return (
    <ComingSoon
      title="Website & API Monitoring"
      description="Synthetic checks, latency percentiles, and uptime for your endpoints."
      breadcrumbs={["Monitoring", "Website & API Monitoring"]}
    />
  );
}
