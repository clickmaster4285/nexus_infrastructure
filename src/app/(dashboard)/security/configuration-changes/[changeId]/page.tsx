import type { Metadata } from "next";

import { ConfigChangeDetail } from "@/components/config-changes/config-change-detail";

interface ChangeDetailPageProps {
  params: Promise<{ changeId: string }>;
}

export async function generateMetadata({ params }: ChangeDetailPageProps): Promise<Metadata> {
  const { changeId } = await params;
  return { title: `${changeId} | Configuration Changes` };
}

export default async function ConfigurationChangeDetailPage({ params }: ChangeDetailPageProps) {
  const { changeId } = await params;
  return <ConfigChangeDetail changeId={changeId} />;
}
