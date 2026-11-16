import type { Metadata } from "next";

import { LiveOperationsNoc } from "@/components/live-operations/noc-dashboard";

export const metadata: Metadata = {
  title: "Live Operations / NOC",
};

export default function LiveOperationsNocPage() {
  return <LiveOperationsNoc />;
}
