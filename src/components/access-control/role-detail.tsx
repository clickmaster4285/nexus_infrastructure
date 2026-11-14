"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, CircleAlert, Copy, KeyRound, Layers, MoreVertical, SearchX, ShieldAlert, ShieldCheck, Users, X,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChartCard } from "@/components/logs/primitives";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import {
  AuthToast, useAuthToast, ConfirmActionDialog,
} from "@/components/access-control/access-actions";
import { assignRole, getRoleById, removeRole } from "@/mocks/accessControl";
import { timeAgo } from "@/components/auth-events/auth-shared";
import { cn } from "@/lib/utils";
import { useRole, useUsers } from "@/mocks/useAccessControl";
import { RoleBadge, RiskBadge } from "@/components/access-control/access-badges";

interface RoleDetailProps {
  roleId: string;
}

export function RoleDetail({ roleId }: RoleDetailProps) {
  const router = useRouter();
  const { role, status, reload } = useRole(roleId);
  const { users, reload: reloadUsers } = useUsers();
  const [mounted, setMounted] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; description: string; confirmLabel: string; danger: boolean; action: () => string } | null>(null);
  const { toast, notify, dismiss } = useAuthToast();

  useEffect(() => setMounted(true), []);

  if (status === "loading") {
    return (
      <div className="space-y-4 pb-4" aria-busy="true">
        <div className="h-[6.875rem] animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Security", "Access Control", roleId]} title="Role not found" subtitle="This role does not exist." />
        <Card className="grid min-h-[15rem] place-items-center rounded-xl p-6"><div className="text-center"><SearchX className="mx-auto text-muted-foreground" size={28} /><h2 className="mt-2 text-base font-semibold">No role matches “{roleId}”</h2><Button className="mt-4" onClick={() => router.back()}><ArrowLeft size={15} />Back to roles</Button></div></Card>
      </div>
    );
  }

  const members = users.filter((user) => user.roleIds.includes(role.id));

  return (
    <div className="min-w-0 space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Security", "Access Control", role.name]}
        title={role.name}
        subtitle={role.description}
        lastUpdated={mounted ? new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "…"}
        onRefresh={() => { reload(); reloadUsers(); }}
        statusBadge={<span className="flex items-center gap-1.5"><RoleBadge type={role.type} /><RiskBadge level={role.riskLevel} /></span>}
        actions={<div className="flex flex-wrap items-center gap-2"><Button variant="outline" className="h-10 gap-1.5 text-sm" onClick={() => router.back()}><ArrowLeft size={15} />Back</Button>{role.type === "system" ? <Button disabled className="h-10 gap-1.5 text-sm" title="System roles cannot be edited">Edit role</Button> : <Button className="h-10 gap-1.5 text-sm" onClick={() => notify({ message: "Role editor opened" })}>Edit role</Button>}</div>}
      />

      <div className="grid grid-cols-2 items-stretch gap-4 md:grid-cols-4">
        <MiniMetric label="Members" value={String(members.length)} />
        <MiniMetric label="Permissions" value={String(role.permissions.length)} />
        <MiniMetric label="Type" value={role.type === "system" ? "System" : "Custom"} />
        <MiniMetric label="Risk" value={role.riskLevel} tone={role.riskLevel === "High" ? "text-red-600" : role.riskLevel === "Medium" ? "text-amber-700" : "text-emerald-700"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
          <ChartCard title="Permissions" actions={<span className="text-xs text-muted-foreground">{role.permissions.length} entries</span>}>
            <div className="flex flex-wrap gap-2">
              {role.permissions.map((perm) => (
                <span key={perm} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[0.6875rem] font-medium", perm.includes("delete") || perm.includes("access-control") ? "border-red-200 bg-red-50 text-red-700" : perm.includes("execute") || perm.includes("edit") || perm.includes("create") ? "border-amber-200 bg-amber-50 text-amber-800" : perm === "*" ? "border-red-300 bg-red-50 text-red-800" : "border-border bg-muted/40 text-muted-foreground")}>{perm}</span>
              ))}
            </div>
            {role.type === "system" && <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">System roles are read-only. Duplicate to customize.</p>}
          </ChartCard>
          <ChartCard title="Members" actions={<span className="text-xs text-muted-foreground">{members.length} assigned</span>}>
            {members.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No users assigned to this role.</p> : (
              <ul className="flex flex-col divide-y divide-border">
                {members.map((member) => (
                  <li key={member.id} className="flex items-center gap-3 py-2.5">
                    <InitialsAvatar name={member.name} size={28} />
                    <span className="min-w-0 flex-1"><Link href={`/access-control/users/${member.id}`} className="block truncate text-[0.8125rem] font-semibold text-foreground hover:underline">{member.name}</Link><span className="block truncate text-[0.6875rem] text-muted-foreground">{member.email}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        </div>
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <Card className="flex flex-col rounded-xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><ShieldCheck size={15} aria-hidden="true" />Risk profile</h2>
            <div className="mt-3 flex flex-col gap-3 text-[0.8125rem]">
              <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">High-risk permissions</span><b className="tabular-nums text-foreground">{role.permissions.filter((p) => p === "*" || /delete|execute|access-control/.test(p)).length}</b></div>
              <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Full access</span><b className="tabular-nums text-foreground">{role.permissions.includes("*") ? "Yes" : "No"}</b></div>
              <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Created</span><span className="font-medium text-foreground">{new Date(role.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span></div>
              <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Created by</span><span className="font-medium text-foreground">{role.createdBy}</span></div>
            </div>
          </Card>
        </div>
      </div>

      <AuthToast toast={toast} onDismiss={dismiss} />
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="flex flex-col rounded-xl p-4">
      <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 font-display text-2xl font-bold leading-none tabular-nums", tone ?? "text-foreground")}>{value}</p>
    </Card>
  );
}

