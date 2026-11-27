import type { Metadata } from "next";

import { WindowForm } from "@/components/maintenance-windows/window-form";

export const metadata: Metadata = {
  title: "Schedule Maintenance",
};

export default async function NewMaintenanceWindowPage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const { start } = await searchParams;
  return <WindowForm mode="create" initialStart={start ?? null} />;
}
