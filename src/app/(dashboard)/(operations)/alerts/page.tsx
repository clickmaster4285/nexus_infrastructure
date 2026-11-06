import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Alerts",
};

export default function AlertsPage() {
  return (
    <ComingSoon
      title="Alerts"
      description="Active alerts with routing, acknowledgement, and escalation."
      breadcrumbs={["Operations", "Alerts"]}
    />
  );
}
