import type { Metadata } from "next";

import { UserDetail } from "@/components/access-control/user-detail";

interface UserDetailPageProps {
  params: Promise<{ userId: string }>;
}

export async function generateMetadata({ params }: UserDetailPageProps): Promise<Metadata> {
  const { userId } = await params;
  return { title: `${userId} | Access Control` };
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const { userId } = await params;
  return <UserDetail userId={userId} />;
}
