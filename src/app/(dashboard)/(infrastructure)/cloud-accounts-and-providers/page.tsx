import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Cloud Accounts & Providers",
};

export default function CloudAccountsAndProvidersPage() {
  return (
    <ComingSoon
      title="Cloud Accounts & Providers"
      description="Connected cloud accounts, credentials, quotas, and provider health."
      breadcrumbs={["Infrastructure", "Cloud Accounts & Providers"]}
    />
  );
}
