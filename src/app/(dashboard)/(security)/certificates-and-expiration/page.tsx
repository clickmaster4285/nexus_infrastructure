import type { Metadata } from "next";
import { Suspense } from "react";

import { CertificatesDashboard } from "@/components/certificates/certificates-dashboard";

export const metadata: Metadata = {
  title: "Certificates & Expiration",
};

function CertsSkeleton() {
  return (
    <div className="space-y-4 pb-4" aria-busy="true">
      <div className="h-[92px] animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
      <div className="h-[300px] animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export default function CertificatesAndExpirationPage() {
  return (
    <Suspense fallback={<CertsSkeleton />}>
      <CertificatesDashboard />
    </Suspense>
  );
}
