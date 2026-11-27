import type { Metadata } from "next";

import { RunbooksDashboard } from "@/components/runbooks/runbooks-dashboard";

export const metadata: Metadata = {
  title: "Runbooks",
};

export default function RunbooksPage() {
  return <RunbooksDashboard />;
}
