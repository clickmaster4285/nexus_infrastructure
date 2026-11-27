import type { Metadata } from "next";
import { Suspense } from "react";

import { NetworkTopologyDashboard } from "@/components/network/network-topology-dashboard";

export const metadata: Metadata = { title: "Network Topology" };

function NetworkTopologySkeleton() {
  return (
    <div className="space-y-4 pb-4" aria-busy="true">
      <div className="h-[5.75rem] animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
      <div className="h-[36rem] animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export default function NetworkTopologyPage() {
  return (
    <Suspense fallback={<NetworkTopologySkeleton />}>
      <NetworkTopologyDashboard />
    </Suspense>
  );
}
