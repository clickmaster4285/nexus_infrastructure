import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Containers & Docker",
};

export default function ContainersAndDockerPage() {
  return (
    <ComingSoon
      title="Containers & Docker"
      description="Container fleets, images, registries, and resource usage."
      breadcrumbs={["Infrastructure", "Containers & Docker"]}
    />
  );
}
