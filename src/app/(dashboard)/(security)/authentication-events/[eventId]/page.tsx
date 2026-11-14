import type { Metadata } from "next";

import { AuthEventDetail } from "@/components/auth-events/auth-event-detail";

interface EventDetailPageProps {
  params: Promise<{ eventId: string }>;
}

export async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const { eventId } = await params;
  return { title: `${eventId} | Authentication Events` };
}

export default async function AuthenticationEventDetailPage({ params }: EventDetailPageProps) {
  const { eventId } = await params;
  return <AuthEventDetail eventId={eventId} />;
}
