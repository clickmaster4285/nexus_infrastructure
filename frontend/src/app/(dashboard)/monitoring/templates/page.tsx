import type { Metadata } from "next";
import { Suspense } from "react";
import { MonitoringTemplatesDashboard } from "@/components/monitoring/monitoring-templates-dashboard";

export const metadata: Metadata = { title: "Monitoring Templates" };
export default function MonitoringTemplatesPage() {
  return <Suspense fallback={<div className="grid min-h-64 place-items-center text-sm text-muted-foreground">Loading monitoring templates…</div>}><MonitoringTemplatesDashboard /></Suspense>;
}
