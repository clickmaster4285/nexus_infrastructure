import type { Metadata } from "next";

import { WindowForm } from "@/components/maintenance-windows/window-form";

export const metadata: Metadata = {
  title: "Edit Maintenance Window",
};

export default async function EditMaintenanceWindowPage({ params }: { params: Promise<{ windowId: string }> }) {
  const { windowId } = await params;
  return <WindowForm mode="edit" windowId={decodeURIComponent(windowId)} />;
}
