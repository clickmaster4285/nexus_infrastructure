import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Processes & Services",
};

export default function ProcessesAndServicesPage() {
  return (
    <ComingSoon
      title="Processes & Services"
      description="Process trees, systemd services, and per-process resource usage."
      breadcrumbs={["Monitoring", "Processes & Services"]}
    />
  );
}
