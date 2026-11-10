import type { Metadata } from "next";

import { CloudAccountsDashboard } from "@/components/infrastructure/cloud-accounts-dashboard";

export const metadata: Metadata = {
  title: "Cloud Accounts & Providers",
};

export default function CloudAccountsAndProvidersPage() {
  return <CloudAccountsDashboard />;
}
