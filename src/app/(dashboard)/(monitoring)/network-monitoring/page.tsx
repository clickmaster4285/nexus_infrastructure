import type { Metadata } from "next";

import { NetworkMonitoringDashboard } from "@/components/monitoring/network-monitoring-dashboard";

export const metadata: Metadata = {
  title: "Network Monitoring",
};

export default function NetworkMonitoringPage() {
  return <NetworkMonitoringDashboard />;
}
