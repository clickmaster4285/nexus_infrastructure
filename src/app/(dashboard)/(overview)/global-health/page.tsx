import type { Metadata } from "next";

import { GlobalHealthDashboard } from "@/components/global-health/global-health-dashboard";

export const metadata: Metadata = {
  title: "Global Health",
};

export default function GlobalHealthPage() {
  return <GlobalHealthDashboard />;
}
