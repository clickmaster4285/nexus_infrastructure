import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Access Control",
};

export default function AccessControlPage() {
  return (
    <ComingSoon
      title="Access Control"
      description="Roles, permissions, and API tokens for your team."
      breadcrumbs={["Security", "Access Control"]}
    />
  );
}
