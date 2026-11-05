import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Network Devices",
};

export default function NetworkDevicesPage() {
  return (
    <ComingSoon
      title="Network Devices"
      description="Routers, switches, and firewalls with interface-level monitoring."
      breadcrumbs={["Infrastructure", "Network Devices"]}
    />
  );
}
