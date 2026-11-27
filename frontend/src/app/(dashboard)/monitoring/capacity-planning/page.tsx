import type { Metadata } from "next";
import { Suspense } from "react";
import { CapacityPlanningDashboard } from "@/components/capacity-planning/capacity-planning-dashboard";
export const metadata: Metadata = { title: "Capacity Planning & Forecasting" };
export default function CapacityPlanningPage() {
  return (
    <Suspense fallback={<div className="grid min-h-64 place-items-center text-sm text-muted-foreground">Loading capacity data…</div>}>
      <CapacityPlanningDashboard />
    </Suspense>
  );
}
