import type { Metadata } from "next";

import { WindowDetail } from "@/components/maintenance-windows/window-detail";

export const metadata: Metadata = {
  title: "Maintenance Window",
};

export default async function MaintenanceWindowDetailPage({ params }: { params: Promise<{ windowId: string }> }) {
  const { windowId } = await params;
  return <WindowDetail windowId={decodeURIComponent(windowId)} />;
}
