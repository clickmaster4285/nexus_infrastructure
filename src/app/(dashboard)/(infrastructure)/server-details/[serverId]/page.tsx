import type { Metadata } from "next";

import { ServerDetailsDashboard } from "@/components/servers/server-details-dashboard";
import { findServerById } from "@/data/mock/servers";

interface ServerDetailsPageProps {
  params: Promise<{ serverId: string }>;
}

export async function generateMetadata({ params }: ServerDetailsPageProps): Promise<Metadata> {
  const { serverId } = await params;
  const server = findServerById(serverId);
  return { title: server ? `${server.name} | Server Details` : "Server not found | Server Details" };
}

export default async function ServerDetailsPage({ params }: ServerDetailsPageProps) {
  const { serverId } = await params;
  return <ServerDetailsDashboard serverId={serverId} />;
}
