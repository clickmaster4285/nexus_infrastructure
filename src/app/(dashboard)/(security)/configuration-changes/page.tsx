import type { Metadata } from "next";
import { Suspense } from "react";

import { ConfigChangesDashboard } from "@/components/config-changes/config-changes-dashboard";

export const metadata: Metadata = {
  title: "Configuration Changes",
};

function ChangesSkeleton() {
  return (
    <div className="space-y-4 pb-4" aria-busy="true">
      <div className="h-[92px] animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />)}</div>
      <div className="h-[340px] animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export default function ConfigurationChangesPage() {
  return (
    <Suspense fallback={<ChangesSkeleton />}>
      <ConfigChangesDashboard />
    </Suspense>
  );
}
