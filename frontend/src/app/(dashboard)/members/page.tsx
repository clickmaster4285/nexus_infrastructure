import type { Metadata } from "next";
import { Suspense } from "react";
import { MembersDashboard } from "@/components/members/members-dashboard";
export const metadata: Metadata = { title: "Members" };
export default function MembersPage() { return <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading members…</div>}><MembersDashboard /></Suspense>; }
