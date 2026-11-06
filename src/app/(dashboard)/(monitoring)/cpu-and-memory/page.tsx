import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "CPU & Memory",
};

export default function CpuAndMemoryPage() {
  return (
    <ComingSoon
      title="CPU & Memory"
      description="CPU and memory analytics with saturation and pressure breakdowns."
      breadcrumbs={["Monitoring", "CPU & Memory"]}
    />
  );
}
