import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Server Details",
};

export default function ServerDetailsPage() {
  return (
    <ComingSoon
      title="Server Details"
      description="Deep per-server inspection: metrics, events, configuration, and history."
      breadcrumbs={["Infrastructure", "Server Details"]}
    />
  );
}
