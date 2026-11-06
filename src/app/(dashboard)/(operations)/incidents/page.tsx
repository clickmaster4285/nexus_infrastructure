import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Incidents",
};

export default function IncidentsPage() {
  return (
    <ComingSoon
      title="Incidents"
      description="Incident timelines, commander tooling, and postmortems."
      breadcrumbs={["Operations", "Incidents"]}
    />
  );
}
