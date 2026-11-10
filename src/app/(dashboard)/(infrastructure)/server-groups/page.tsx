import type { Metadata } from "next";

import { ServerGroupsDashboard } from "@/components/servers/server-groups-dashboard";

export const metadata: Metadata = {
  title: "Server Groups",
};

export default function ServerGroupsPage() {
  return <ServerGroupsDashboard />;
}
