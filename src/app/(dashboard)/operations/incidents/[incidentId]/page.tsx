import type { Metadata } from "next";

import { IncidentDetail } from "./incident-detail";

export const metadata: Metadata = {
  title: "Incident",
};

export default async function IncidentDetailPage({ params }: { params: Promise<{ incidentId: string }> }) {
  const { incidentId } = await params;
  return <IncidentDetail incidentId={incidentId} />;
}
