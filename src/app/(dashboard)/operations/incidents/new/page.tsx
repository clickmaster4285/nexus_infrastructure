import type { Metadata } from "next";

import { DeclareIncident } from "./declare-incident";

export const metadata: Metadata = {
  title: "Declare Incident",
};

export default function NewIncidentPage() {
  return <DeclareIncident />;
}
