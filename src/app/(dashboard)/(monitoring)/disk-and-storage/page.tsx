import type { Metadata } from "next";

import { DiskStorageDashboard } from "@/components/monitoring/disk-storage-dashboard";

export const metadata: Metadata = {
  title: "Disk & Storage",
};

export default function DiskAndStoragePage() {
  return <DiskStorageDashboard />;
}
