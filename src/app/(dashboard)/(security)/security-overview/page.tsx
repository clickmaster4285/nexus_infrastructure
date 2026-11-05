import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Security Overview",
};

export default function SecurityOverviewPage() {
  return (
    <ComingSoon
      title="Security Overview"
      description="Security posture at a glance: exposure, drift, and patch status."
      breadcrumbs={["Security", "Security Overview"]}
    />
  );
}
