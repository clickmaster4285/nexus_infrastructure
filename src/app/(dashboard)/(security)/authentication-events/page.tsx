import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Authentication Events",
};

export default function AuthenticationEventsPage() {
  return (
    <ComingSoon
      title="Authentication Events"
      description="Logins, failures, and SSO anomalies across your fleet."
      breadcrumbs={["Security", "Authentication Events"]}
    />
  );
}
