import type { Metadata } from "next";

import { SecurityOverviewDashboard } from "@/components/security-overview-dashboard";

export const metadata: Metadata = {
  title: "Security Overview",
};

export default function SecurityOverviewPage() {
  return <SecurityOverviewDashboard />;
}
