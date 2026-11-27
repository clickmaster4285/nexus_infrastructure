import type { Metadata } from "next";
import { MemberDetail } from "@/components/members/member-detail";
export const metadata: Metadata = { title: "Member" };
export default async function MemberPage({ params }: { params: Promise<{ memberId: string }> }) { return <MemberDetail id={(await params).memberId} />; }
