import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Events Explorer",
};

export default function EventsExplorerPage() {
  return (
    <ComingSoon
      title="Events Explorer"
      description="Chronological event stream with filters by source and severity."
      breadcrumbs={["Monitoring", "Events Explorer"]}
    />
  );
}
