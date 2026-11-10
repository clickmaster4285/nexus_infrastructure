import type { Metadata } from "next";

import { AllServersDashboard } from "@/components/servers/all-servers-dashboard";

export const metadata: Metadata = {
  title: "All Servers",
};

export default function AllServersPage() {
  return <AllServersDashboard />;
}
