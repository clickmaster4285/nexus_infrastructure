import type { Metadata } from "next";

import { CpuMemoryDashboard } from "@/components/monitoring/cpu-memory-dashboard";

export const metadata: Metadata = {
  title: "CPU & Memory",
};

export default function CpuAndMemoryPage() {
  return <CpuMemoryDashboard />;
}
