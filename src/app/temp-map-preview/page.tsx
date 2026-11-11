"use client";

import dynamic from "next/dynamic";

const TempMap = dynamic(
  () => import("@/components/live-operations/noc-osm-map").then((mod) => mod.NocOsmMap),
  { ssr: false, loading: () => <div className="grid h-full place-items-center text-[12px] text-muted-foreground">Loading…</div> },
);

export default function TempMapPreviewPage() {
  return (
    <div className="mx-auto max-w-[1400px] p-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <b className="text-[16px] font-semibold">Infrastructure Map</b>
          <span className="text-[12px] text-muted-foreground">12 sites · 16 servers</span>
        </div>
        <div className="h-[420px] w-full overflow-hidden rounded-lg border">
          <TempMap />
        </div>
      </div>
    </div>
  );
}
