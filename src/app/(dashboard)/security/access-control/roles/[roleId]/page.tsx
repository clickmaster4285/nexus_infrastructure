import type { Metadata } from "next";

import { RoleDetail } from "@/components/access-control/role-detail";

interface RoleDetailPageProps {
  params: Promise<{ roleId: string }>;
}

export async function generateMetadata({ params }: RoleDetailPageProps): Promise<Metadata> {
  const { roleId } = await params;
  return { title: `${roleId} | Access Control` };
}

export default async function RoleDetailPage({ params }: RoleDetailPageProps) {
  const { roleId } = await params;
  return <RoleDetail roleId={roleId} />;
}
