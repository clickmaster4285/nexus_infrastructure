import type { Metadata } from "next";

import { IncidentsDashboard } from "./incidents-dashboard";

export const metadata: Metadata = {
  title: "Incidents",
};

export default function IncidentsPage() {
  return <IncidentsDashboard />;
}
