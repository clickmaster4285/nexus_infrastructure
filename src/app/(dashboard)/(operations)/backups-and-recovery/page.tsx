import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Backups & Recovery",
};

export default function BackupsAndRecoveryPage() {
  return (
    <ComingSoon
      title="Backups & Recovery"
      description="Backup coverage, restore points, and recovery drills."
      breadcrumbs={["Operations", "Backups & Recovery"]}
    />
  );
}
