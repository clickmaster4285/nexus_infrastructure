import type { Metadata } from "next";
import { MonitoringTemplateDetail } from "@/components/monitoring/monitoring-template-detail";

export const metadata: Metadata = { title: "Template Details" };
export default async function MonitoringTemplateDetailPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return <MonitoringTemplateDetail templateId={templateId} />;
}
