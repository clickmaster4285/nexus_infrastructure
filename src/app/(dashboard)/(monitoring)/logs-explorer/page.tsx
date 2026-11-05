import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Logs Explorer",
};

export default function LogsExplorerPage() {
  return (
    <ComingSoon
      title="Logs Explorer"
      description="Search and tail logs across every host with saved views."
      breadcrumbs={["Monitoring", "Logs Explorer"]}
    />
  );
}
