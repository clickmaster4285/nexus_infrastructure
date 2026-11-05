import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Data Centers & Locations",
};

export default function DataCentersAndLocationsPage() {
  return (
    <ComingSoon
      title="Data Centers & Locations"
      description="Browse data centers and physical locations with rack and facility details."
      breadcrumbs={["Infrastructure", "Data Centers & Locations"]}
    />
  );
}
