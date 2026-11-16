import type { Metadata } from "next";

import { NetworkDevicesDashboard } from "@/components/network/network-devices-dashboard";

export const metadata: Metadata = {
  title: "Network Devices",
};

export default function NetworkDevicesPage() {
  return <NetworkDevicesDashboard />;
}
