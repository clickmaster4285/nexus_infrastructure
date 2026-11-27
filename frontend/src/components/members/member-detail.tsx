"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Mail, Pencil, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemberFormDialog, MEMBER_STATUS_OPTIONS } from "@/components/members/member-form-dialog";
import { loadMember, loadMembers, updateMember, type Member, type MemberUpsertInput } from "@/mocks/members";

const statusTone: Record<Member["status"], "success" | "warning" | "secondary" | "outline"> = { active: "success", on_leave: "warning", invited: "secondary", inactive: "outline" };

export function MemberDetail({ id }: { id: string }) {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [managerName, setManagerName] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const toast = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2500); };

  const load = useCallback(() => {
    setState("loading");
    void loadMember(id).then((item) => {
      setMember(item);
      setState(item ? "ready" : "error");
      if (item?.managerId) {
        void loadMembers().then((all) => setManagerName(all.find((entry) => entry.id === item.managerId)?.fullName ?? null));
      } else {
        setManagerName(null);
      }
    });
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (state === "loading") return <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">Loading member…</div>;
  if (!member) return <div className="space-y-4"><button className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium" onClick={() => router.push("/members")}><ArrowLeft size={15} />Back to Members</button><Card className="grid min-h-64 place-items-center rounded-xl p-6 text-sm text-muted-foreground">Member not found.</Card></div>;

  const statusLabel = MEMBER_STATUS_OPTIONS.find((option) => option.value === member.status)?.label ?? member.status;

  const handleSubmit = (input: MemberUpsertInput, memberId: string | null) => {
    if (memberId) updateMember(memberId, input);
    load();
    toast("Member saved");
  };

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Members", member.fullName]}
        title={member.fullName}
        subtitle={member.jobTitle}
        actions={
          <>
            <Button variant="outline" onClick={() => router.push("/members")}><ArrowLeft size={15} />Back</Button>
            <Button onClick={() => setFormOpen(true)}><Pencil size={15} />Edit member</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="rounded-xl p-4"><span className="text-xs text-muted-foreground">Department</span><b className="mt-1 block text-sm">{member.department}</b></Card>
        <Card className="rounded-xl p-4"><span className="text-xs text-muted-foreground">Role</span><b className="mt-1 block text-sm">{member.role}</b></Card>
        <Card className="rounded-xl p-4"><span className="text-xs text-muted-foreground">Location</span><b className="mt-1 block text-sm">{member.location}</b></Card>
        <Card className="rounded-xl p-4"><span className="text-xs text-muted-foreground">Availability</span><b className="mt-1 block text-sm">{member.onCall ? "On-call" : "Standard"}</b></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-xl p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Profile</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="mt-0.5 flex min-w-0 items-center gap-2"><Mail size={14} className="shrink-0 text-muted-foreground" /><span className="truncate">{member.email}</span></dd></div>
            <div><dt className="text-xs text-muted-foreground">Phone</dt><dd className="mt-0.5 flex items-center gap-2"><Phone size={14} className="shrink-0 text-muted-foreground" />{member.phone || "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1"><Badge variant={statusTone[member.status]}>{statusLabel}</Badge></dd></div>
            <div><dt className="text-xs text-muted-foreground">Joined</dt><dd className="mt-0.5 tabular-nums">{new Date(member.joinedAt).toLocaleDateString()}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Employment</dt><dd className="mt-0.5">{member.employmentType}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Timezone</dt><dd className="mt-0.5">{member.timezone}</dd></div>
          </dl>
          {member.skills.length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-semibold">Skills</h3>
              <div className="mt-2 flex flex-wrap gap-2">{member.skills.map((skill) => <Badge key={skill} variant="outline">{skill}</Badge>)}</div>
            </>
          )}
        </Card>
        <Card className="rounded-xl p-5">
          <h2 className="text-sm font-semibold">Notes</h2>
          <p className="mt-3 text-sm text-muted-foreground">{member.notes || "No notes for this member yet."}</p>
          <div className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">Reports to: <span className="font-medium text-foreground">{managerName ?? "Executive team"}</span></div>
        </Card>
      </div>

      <MemberFormDialog open={formOpen} onOpenChange={setFormOpen} initial={member} onSubmit={handleSubmit} />

      {notice && (
        <div role="status" className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-lg">
          <Check size={16} className="text-emerald-600" aria-hidden="true" />{notice}
        </div>
      )}
    </div>
  );
}
