import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Configuration Changes",
};

export default function ConfigurationChangesPage() {
  return (
    <ComingSoon
      title="Configuration Changes"
      description="Track configuration drift and changes across managed hosts."
      breadcrumbs={["Security", "Configuration Changes"]}
    />
  );
}
