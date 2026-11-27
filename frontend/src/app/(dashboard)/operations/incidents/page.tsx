import type { Metadata } from "next";

import { IncidentsDashboard } from "@/components/incidents/incidents-dashboard";

export const metadata: Metadata = {
  title: "Incidents",
};

export default function IncidentsPage() {
  return <IncidentsDashboard />;
}
