import type { Metadata } from "next";

import { ServerSitesDashboard } from "@/components/infrastructure/server-sites-dashboard";

export const metadata: Metadata = {
  title: "Server Sites",
};

export default function ServerSitesPage() {
  return <ServerSitesDashboard />;
}
