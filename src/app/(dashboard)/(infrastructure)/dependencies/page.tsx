import type { Metadata } from "next";

import { DependenciesDashboard } from "@/components/infrastructure/dependencies-dashboard";

export const metadata: Metadata = {
  title: "Dependencies",
};

export default function DependenciesPage() {
  return <DependenciesDashboard />;
}
