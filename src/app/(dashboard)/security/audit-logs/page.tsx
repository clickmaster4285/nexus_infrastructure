import type { Metadata } from "next";

import { AuditLogsDashboard } from "@/components/audit-logs-dashboard";

export const metadata: Metadata = {
  title: "Audit Logs",
};

export default function AuditLogsPage() {
  return <AuditLogsDashboard />;
}
