import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Audit Logs",
};

export default function AuditLogsPage() {
  return (
    <ComingSoon
      title="Audit Logs"
      description="Who did what, when — the immutable audit trail."
      breadcrumbs={["Security", "Audit Logs"]}
    />
  );
}
