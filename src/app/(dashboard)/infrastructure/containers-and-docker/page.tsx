import type { Metadata } from "next";

import { ContainersDockerDashboard } from "@/components/infrastructure/containers-docker-dashboard";

export const metadata: Metadata = {
  title: "Containers & Docker",
};

export default function ContainersAndDockerPage() {
  return <ContainersDockerDashboard />;
}
