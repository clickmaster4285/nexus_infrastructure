import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Runbooks",
};

export default function RunbooksPage() {
  return (
    <ComingSoon
      title="Runbooks"
      description="Documented remediation runbooks attached to alerts."
      breadcrumbs={["Operations", "Runbooks"]}
    />
  );
}
