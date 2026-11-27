import type { Metadata } from "next";

import { DeclareIncident } from "@/components/incidents/declare-incident";

export const metadata: Metadata = {
  title: "Declare Incident",
};

export default function NewIncidentPage() {
  return <DeclareIncident />;
}
