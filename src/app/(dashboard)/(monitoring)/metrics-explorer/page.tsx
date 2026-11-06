import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Metrics Explorer",
};

export default function MetricsExplorerPage() {
  return (
    <ComingSoon
      title="Metrics Explorer"
      description="Query any metric across any resource with flexible grouping and filters."
      breadcrumbs={["Monitoring", "Metrics Explorer"]}
    />
  );
}
