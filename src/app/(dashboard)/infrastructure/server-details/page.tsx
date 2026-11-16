import type { Metadata } from "next";

import { ServerDetailsDashboard } from "@/components/servers/server-details-dashboard";

export const metadata: Metadata = {
  title: "Server Details",
};

export default function ServerDetailsPage() {
  return <ServerDetailsDashboard />;
}
