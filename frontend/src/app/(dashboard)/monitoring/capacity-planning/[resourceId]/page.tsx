import type { Metadata } from "next";
import { Suspense } from "react";
import { ResourceDetail } from "@/components/capacity-planning/resource-detail";
export const metadata: Metadata = { title: "Capacity Resource" };
export default async function CapacityResourcePage({ params }: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = await params;
  return (
    <Suspense fallback={<div className="grid min-h-64 place-items-center text-sm text-muted-foreground">Loading resource…</div>}>
      <ResourceDetail resourceId={resourceId} />
    </Suspense>
  );
}
