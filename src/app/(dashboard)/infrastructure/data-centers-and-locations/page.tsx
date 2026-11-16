import type { Metadata } from "next";

import { DataCentersDashboard } from "@/components/infrastructure/data-centers-dashboard";

export const metadata: Metadata = {
  title: "Data Centers & Locations",
};

export default function DataCentersAndLocationsPage() {
  return <DataCentersDashboard />;
}
