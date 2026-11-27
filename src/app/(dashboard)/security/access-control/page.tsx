import type { Metadata } from "next";
import { Suspense } from "react";

import { AccessControlDashboard } from "@/components/access-control/access-control-dashboard";

export const metadata: Metadata = {
  title: "Access Control",
};

function AccessSkeleton() {
  return (
    <div className="space-y-4 pb-4" aria-busy="true">
      <div className="h-[5.75rem] animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
      <div className="h-[18.75rem] animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export default function AccessControlPage() {
  return (
    <Suspense fallback={<AccessSkeleton />}>
      <AccessControlDashboard />
    </Suspense>
  );
}
