import type { Metadata } from "next";

import { LogsExplorerDashboard } from "@/components/monitoring/logs-explorer-dashboard";

export const metadata: Metadata = {
  title: "Logs Explorer",
};

export default function LogsExplorerPage() {
  return <LogsExplorerDashboard />;
}
