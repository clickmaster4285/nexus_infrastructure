import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthEventsDashboard } from "@/components/auth-events/auth-events-dashboard";

export const metadata: Metadata = {
  title: "Authentication Events",
};

function EventsSkeleton() {
  return (
    <div className="space-y-4 pb-4" aria-busy="true">
      <div className="h-[5.75rem] animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />)}</div>
      <div className="h-[21.25rem] animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export default function AuthenticationEventsPage() {
  return (
    <Suspense fallback={<EventsSkeleton />}>
      <AuthEventsDashboard />
    </Suspense>
  );
}
