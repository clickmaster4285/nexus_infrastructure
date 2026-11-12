import type { Metadata } from "next";

import { EventsExplorerDashboard } from "@/components/monitoring/events-explorer-dashboard";

export const metadata: Metadata = {
  title: "Event Explorer",
};

export default function EventsExplorerPage() {
  return <EventsExplorerDashboard />;
}
