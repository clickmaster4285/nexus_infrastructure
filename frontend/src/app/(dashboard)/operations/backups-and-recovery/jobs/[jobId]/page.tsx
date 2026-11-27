import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobDetail } from "@/components/backups/JobDetail";
import { getBackupsSnapshot } from "@/mocks/backups";

interface JobDetailPageProps {
  params: Promise<{ jobId: string }>;
}

export async function generateMetadata({ params }: JobDetailPageProps): Promise<Metadata> {
  const { jobId } = await params;
  const decoded = decodeURIComponent(jobId);
  const job = getBackupsSnapshot().find((entry) => entry.id === decoded);
  return { title: job ? `${job.name} (${job.id}) | Backups & Recovery` : "Backup job not found | Backups & Recovery" };
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { jobId } = await params;
  const decoded = decodeURIComponent(jobId);
  const job = getBackupsSnapshot().find((entry) => entry.id === decoded);
  if (!job) notFound();
  return <JobDetail jobId={decoded} />;
}
