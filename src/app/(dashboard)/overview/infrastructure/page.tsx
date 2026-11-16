import type { Metadata } from "next";

import { InfrastructureDashboard } from "@/components/infrastructure/infrastructure-dashboard";

export const metadata: Metadata = {
  title: "Infrastructure Dashboard",
};

export default function InfrastructureDashboardPage() {
  return <InfrastructureDashboard />;
}
