import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Network Monitoring",
};

export default function NetworkMonitoringPage() {
  return (
    <ComingSoon
      title="Network Monitoring"
      description="Bandwidth, latency, and packet health across your network."
      breadcrumbs={["Monitoring", "Network Monitoring"]}
    />
  );
}
