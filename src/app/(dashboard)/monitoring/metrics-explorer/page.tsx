import type { Metadata } from "next";

import { MetricsExplorerDashboard } from "@/components/monitoring/metrics-explorer-dashboard";

export const metadata: Metadata = {
  title: "Metrics Explorer",
};

export default function MetricsExplorerPage() {
  return <MetricsExplorerDashboard />;
}
