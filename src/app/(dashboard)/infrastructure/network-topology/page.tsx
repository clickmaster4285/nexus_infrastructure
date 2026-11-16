import type { Metadata } from "next";
import { NetworkTopologyDashboard } from "@/components/network/network-topology-dashboard";

export const metadata: Metadata = { title: "Network Topology" };

export default function NetworkTopologyPage() {
  return <NetworkTopologyDashboard />;
}
