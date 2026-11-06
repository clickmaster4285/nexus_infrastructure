import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Alert Rules",
};

export default function AlertRulesPage() {
  return (
    <ComingSoon
      title="Alert Rules"
      description="Threshold, anomaly, and composite alert rules and notification policies."
      breadcrumbs={["Operations", "Alert Rules"]}
    />
  );
}
