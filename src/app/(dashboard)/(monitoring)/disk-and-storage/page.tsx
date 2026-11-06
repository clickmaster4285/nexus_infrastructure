import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Disk & Storage",
};

export default function DiskAndStoragePage() {
  return (
    <ComingSoon
      title="Disk & Storage"
      description="Disk I/O, capacity growth, and volume saturation metrics."
      breadcrumbs={["Monitoring", "Disk & Storage"]}
    />
  );
}
