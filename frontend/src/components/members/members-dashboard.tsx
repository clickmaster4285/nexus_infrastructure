"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Download, Pencil, PhoneCall, Plus, Search, Trash2, UserCheck, Users, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MemberFormDialog, MEMBER_STATUS_OPTIONS } from "@/components/members/member-form-dialog";
import {
  createMember, deleteMember, loadMembers, readMembers, toggleMemberOnCall, updateMember,
  type Member, type MemberStatus, type MemberUpsertInput,
} from "@/mocks/members";
import { cn } from "@/lib/utils";

const statusLabel: Record<MemberStatus, string> = { active: "Active", on_leave: "On Leave", invited: "Invited", inactive: "Inactive" };
const statusTone: Record<MemberStatus, "success" | "warning" | "secondary" | "outline"> = { active: "success", on_leave: "warning", invited: "secondary", inactive: "outline" };

export function MembersDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(params.get("q") || "");
  const [tab, setTab] = useState<MemberStatus | "all">((params.get("tab") as MemberStatus) || "all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState<Member | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void loadMembers().then((items) => { if (!cancelled) { setMembers(items); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const next = new URLSearchParams(params.toString());
    tab === "all" ? next.delete("tab") : next.set("tab", tab);
    query ? next.set("q", query) : next.delete("q");
    const suffix = next.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
  }, [tab, query, pathname, params, router]);

  const toast = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2500); };
  const refresh = () => setMembers(readMembers());

  const visible = useMemo(() => members.filter((member) =>
    (tab === "all" || member.status === tab)
    && `${member.fullName} ${member.email} ${member.jobTitle} ${member.department} ${member.role}`.toLowerCase().includes(query.toLowerCase()),
  ), [members, tab, query]);

  const activeCount = members.filter((member) => member.status === "active").length;
  const onLeaveCount = members.filter((member) => member.status === "on_leave").length;
  const onCallCount = members.filter((member) => member.onCall).length;
  const departmentCount = new Set(members.map((member) => member.department)).size;

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (member: Member) => { setEditing(member); setFormOpen(true); };

  const handleSubmit = (input: MemberUpsertInput, id: string | null) => {
    if (id) updateMember(id, input);
    else createMember(input);
    refresh();
    toast(id ? "Member saved" : "Member added");
  };

  const confirmDelete = () => {
    if (deleting) { deleteMember(deleting.id); refresh(); toast(`Removed ${deleting.fullName}`); }
    setDeleting(null);
  };

  const exportMembers = () => {
    if (members.length === 0) return;
    const blob = new Blob([JSON.stringify(members, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "members.json";
    anchor.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${members.length} members`);
  };

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Members"]}
        title="Members"
        subtitle="Manage your team members, roles and availability"
        actions={
          <>
            <Button variant="outline" onClick={exportMembers}><Download size={15} />Export</Button>
            <Button onClick={openAdd}><Plus size={15} />Add Member</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        <StatCard label="Total Members" value={String(members.length)} icon={<Users size={18} />} iconTone="bg-blue-500/10 text-blue-600" />
        <StatCard label="Active" value={String(activeCount)} icon={<UserCheck size={18} />} iconTone="bg-emerald-500/10 text-emerald-600" />
        <StatCard label="On Leave" value={String(onLeaveCount)} icon={<Clock3 size={18} />} iconTone="bg-amber-500/10 text-amber-600" />
        <StatCard label="On-Call Now" value={String(onCallCount)} icon={<PhoneCall size={18} />} iconTone="bg-violet-500/10 text-violet-600" />
        <StatCard label="Departments" value={String(departmentCount)} icon={<Users size={18} />} iconTone="bg-slate-500/10 text-slate-600" />
      </div>

      <Card className="rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Filter members by status">
            {(["all", ...MEMBER_STATUS_OPTIONS.map((option) => option.value)] as const).map((value) => {
              const count = value === "all" ? members.length : members.filter((member) => member.status === value).length;
              const label = value === "all" ? "All" : statusLabel[value];
              return (
                <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors", tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                  {label} ({count})
                </button>
              );
            })}
          </div>
          <div className="relative ml-auto min-w-[15rem] flex-1 sm:flex-none sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search members…" aria-label="Search members" className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[850px] text-left text-[13px]">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>{["Member", "Role & Title", "Department", "Status", "Location", "Joined", ""].map((head) => <th key={head} className="px-3 py-3 font-semibold last:text-right">{head}</th>)}</tr>
            </thead>
            <tbody>
              {visible.map((member) => (
                <tr key={member.id} onClick={() => router.push(`/members/${member.id}`)} className="cursor-pointer border-t border-border transition-colors hover:bg-muted/50">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold", member.avatarColor)}>{member.avatarInitials}</span>
                      <span className="min-w-0"><b className="block truncate">{member.fullName}</b><span className="block truncate text-xs text-muted-foreground">{member.email}</span></span>
                    </div>
                  </td>
                  <td className="px-3 py-3"><Badge variant="outline">{member.role}</Badge><span className="mt-1 block text-xs text-muted-foreground">{member.jobTitle}</span></td>
                  <td className="px-3 py-3">{member.department}</td>
                  <td className="px-3 py-3"><Badge variant={statusTone[member.status]}>{statusLabel[member.status]}</Badge></td>
                  <td className="px-3 py-3">{member.location}<span className="block text-xs text-muted-foreground">{member.timezone}</span></td>
                  <td className="px-3 py-3 tabular-nums text-muted-foreground">{new Date(member.joinedAt).toLocaleDateString()}</td>
                  <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end gap-0.5">
                      <button type="button" onClick={() => { toggleMemberOnCall(member.id); refresh(); }} aria-pressed={member.onCall} title={member.onCall ? "Remove from on-call rotation" : "Add to on-call rotation"} aria-label={member.onCall ? `Remove ${member.fullName} from on-call` : `Assign ${member.fullName} to on-call`} className={cn("grid h-8 w-8 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", member.onCall ? "bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-950/60 dark:text-violet-300" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                        <PhoneCall size={15} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => openEdit(member)} title={`Edit ${member.fullName}`} aria-label={`Edit ${member.fullName}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => setDeleting(member)} title={`Delete ${member.fullName}`} aria-label={`Delete ${member.fullName}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-red-950/40">
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">Loading members…</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  <p>No members match these filters.</p>
                  <button type="button" onClick={() => { setTab("all"); setQuery(""); }} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"><X size={13} aria-hidden="true" />Clear filters</button>
                </td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <MemberFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} onSubmit={handleSubmit} />

      <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <DialogContent className="w-[min(26.25rem,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>Delete member?</DialogTitle>
            <DialogDescription>
              {deleting ? <><b>{deleting.fullName}</b> ({deleting.email}) will be removed from the organization. This only affects the demo data on this device.</> : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={confirmDelete}><Trash2 size={14} aria-hidden="true" />Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {notice && (
        <div role="status" className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-lg">
          <Check size={16} className="text-emerald-600" aria-hidden="true" />{notice}
        </div>
      )}
    </div>
  );
}
