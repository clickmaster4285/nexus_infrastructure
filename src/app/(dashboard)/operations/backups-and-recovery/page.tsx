import type { Metadata } from "next";

import { BackupsDashboard } from "@/components/backups/backups-dashboard";

export const metadata: Metadata = {
  title: "Backups & Recovery",
};

export default function BackupsAndRecoveryPage() {
  return <BackupsDashboard />;
}
