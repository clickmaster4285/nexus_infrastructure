import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Maintenance Windows",
};

export default function MaintenanceWindowsPage() {
  return (
    <ComingSoon
      title="Maintenance Windows"
      description="Silence monitoring during planned maintenance."
      breadcrumbs={["Operations", "Maintenance Windows"]}
    />
  );
}
