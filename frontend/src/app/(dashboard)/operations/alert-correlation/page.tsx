import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertCorrelationDashboard } from "@/components/alert-correlation/alert-correlation-dashboard";
export const metadata: Metadata = { title: "Alert Correlation Analysis" };
export default function AlertCorrelationPage() { return <Suspense fallback={<div className="grid min-h-64 place-items-center text-sm text-muted-foreground">Loading correlation analysis…</div>}><AlertCorrelationDashboard /></Suspense>; }
