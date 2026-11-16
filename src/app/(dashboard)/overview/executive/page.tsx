import type { Metadata } from "next";

import { ExecutiveOverview } from "@/components/overview/executive-overview";

export const metadata: Metadata = {
  title: "Executive Overview",
};

export default function ExecutiveOverviewPage() {
  return <ExecutiveOverview />;
}
