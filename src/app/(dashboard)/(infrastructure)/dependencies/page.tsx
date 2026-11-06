import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Dependencies",
};

export default function DependenciesPage() {
  return (
    <ComingSoon
      title="Dependencies"
      description="Map service dependencies and blast radius across your stack."
      breadcrumbs={["Infrastructure", "Dependencies"]}
    />
  );
}
