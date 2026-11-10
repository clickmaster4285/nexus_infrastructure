import type { Metadata } from "next";

import { ProcessesServicesDashboard } from "@/components/monitoring/processes-services-dashboard";

export const metadata: Metadata = {
  title: "Processes & Services",
};

export default function ProcessesAndServicesPage() {
  return <ProcessesServicesDashboard />;
}
