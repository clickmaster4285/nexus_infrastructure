import type { Metadata } from "next";

import { WindowsDashboard } from "@/components/maintenance-windows/windows-dashboard";

export const metadata: Metadata = {
  title: "Maintenance Windows",
};

export default function MaintenanceWindowsPage() {
  return <WindowsDashboard />;
}
