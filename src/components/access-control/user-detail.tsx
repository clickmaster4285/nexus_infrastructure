"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Ban, CheckCircle2, ChevronLeft, ChevronRight, Copy, Fingerprint, KeyRound, Laptop,
  Lock, MoreVertical, RotateCcw, SearchX, ShieldAlert, ShieldCheck, Smartphone, Trash2, Users, X,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChartCard } from "@/components/logs/primitives";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import {
  AuthToast, useAuthToast, ConfirmActionDialog,
} from "@/components/access-control/access-actions";
import { assignRole, getRoleById, removeRole, revokeAllSessions, revokeSession, suspendUser, resetPassword, requireMfa } from "@/mocks/accessControl";
import { timeAgo, fullTime } from "@/components/auth-events/auth-shared";
import { UserStatusBadge, MfaBadge, RoleBadge, RiskBadge } from "@/components/access-control/access-badges";
import { cn } from "@/lib/utils";
import { useUser, useUsers } from "@/mocks/useAccessControl";

interface UserDetailProps {
  userId: string;
}

const RISK_LABELS: Record<string, string> = {
  "servers:view": "Servers: view",
  "servers:edit": "Servers: edit",
  "backups:*": "Backups: full access",
  "backups:execute": "Backups: execute",
  "incidents:*": "Incidents: full access",
  "maintenance-windows:*": "Maintenance windows: full access",
  "scheduled-tasks:execute": "Scheduled tasks: execute",
  "security:*": "Security: full access",
  "security:audit": "Security: audit",
  "access-control:*": "Access control: full access",
  "alerts:execute": "Alerts: execute",
  "*": "Full access (*)",
};

export function UserDetail({ userId }: UserDetailProps) {
  const router = useRouter();
  const { user, status, reload } = useUser(userId);
  const { users: allUsers } = useUsers();
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; description: string; confirmLabel: string; danger: boolean; action: () => string } | null>(null);
  const { toast, notify, dismiss } = useAuthToast();

  useEffect(() => setMounted(true), []);

  const ordered = useMemo(() => [...allUsers].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)), [allUsers]);
  const index = ordered.findIndex((item) => item.id === userId);
  const newer = index > 0 ? ordered[index - 1] : null;
  const older = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;

  if (status === "loading") {
    return (
      <div className="space-y-4 pb-4" aria-busy="true">
        <div className="h-[110px] animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-4 xl:grid-cols-12"><div className="space-y-4 xl:col-span-8"><div className="h-56 animate-pulse rounded-xl bg-muted" /><div className="h-44 animate-pulse rounded-xl bg-muted" /></div><div className="space-y-4 xl:col-span-4"><div className="h-44 animate-pulse rounded-xl bg-muted" /><div className="h-44 animate-pulse rounded-xl bg-muted" /></div></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Security", "Access Control", userId]} title="User not found" subtitle="This user does not exist in the current set." />
        <Card className="grid min-h-[280px] place-items-center rounded-xl p-6"><div className="text-center"><SearchX className="mx-auto text-muted-foreground" size={28} /><h2 className="mt-2 text-base font-semibold">No user matches “{userId}”</h2><p className="mt-1 text-sm text-muted-foreground">It may have been deleted or the link is incorrect.</p><Button className="mt-4" onClick={() => router.back()}><ArrowLeft size={15} />Back to users</Button></div></Card>
      </div>
    );
  }

  const effectivePerms = user.roleIds.flatMap((roleId) => getRoleById(roleId)?.permissions ?? []);
  const uniquePerms = [...new Set(effectivePerms)];
  const highRisk = uniquePerms.filter((perm) => perm === "*" || /delete|execute|access-control/.test(perm));
  const isAdmin = user.roleIds.some((id) => id === "role-super-admin" || id === "role-admin");
  const isSelf = user.email === "admin@gmail.com";

  const suspend = () => { suspendUser(user.id, "Suspended via dashboard"); notify({ message: `${user.name} suspended` }); reload(); };
  const revokeEvery = () => { revokeAllSessions(user.id); notify({ message: `Revoked all sessions for ${user.name}` }); reload(); };
  const reset = () => { const { temporaryPassword } = resetPassword(user.id); notify({ message: `Password reset link sent to ${user.email}` }); reload(); };

  return (
    <div className="min-w-0 space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Security", "Access Control", user.name]}
        title={user.name}
        subtitle={user.email}
        lastUpdated={mounted ? new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "…"}
        onRefresh={reload}
        statusBadge={<span className="flex flex-wrap items-center gap-1.5"><UserStatusBadge status={user.status} /><MfaBadge enabled={user.mfaEnabled} />{user.roleIds.map((roleId, index) => <span key={index} className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{getRoleById(roleId)?.name ?? roleId}</span>)}</span>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="h-10 gap-1.5 text-sm" onClick={() => router.back()}><ArrowLeft size={15} />Back</Button>
            <Button variant="outline" className="h-10 gap-1.5 text-sm" onClick={() => setDrawerOpen(true)}><KeyRound size={15} />Edit roles</Button>
            <Button variant="destructive" className="h-10 gap-1.5 text-sm" onClick={() => setConfirm({ title: "Suspend user", description: `${user.name} will lose access immediately. Existing sessions will be revoked.`, confirmLabel: "Suspend", danger: true, action: () => { suspend(); return `${user.name} suspended`; } })}><Ban size={15} />Suspend</Button>
            <Button variant="outline" className="h-10 gap-1.5 text-sm" onClick={reset}><KeyRound size={15} />Reset password</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 items-stretch gap-4 md:grid-cols-4">
        <MiniMetric label="Roles" value={String(user.roleIds.length)} />
        <MiniMetric label="Effective permissions" value={String(uniquePerms.length)} />
        <MiniMetric label="Last login" value={mounted && user.lastLoginAt ? timeAgo(user.lastLoginAt) : "Never"} tone={user.lastLoginAt && Date.now() - Date.parse(user.lastLoginAt) > 90 * 86_400_000 ? "text-amber-700" : "text-foreground"} />
        <MiniMetric label="Active sessions" value={String(user.sessions.length)} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
          <Card className="flex flex-col rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground">Profile</h2>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
              <Field label="Name" value={user.name} />
              <Field label="Email" value={<span className="font-mono text-xs">{user.email}</span>} />
              <Field label="Groups" value={user.groupIds.join(", ") || "—"} />
              <Field label="Sites" value={user.siteIds.join(", ") || "—"} />
              <Field label="Created" value={new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })} />
              <Field label="Invited by" value={user.invitedBy ?? "—"} />
              <Field label="Password changed" value={user.passwordLastChangedAt ? timeAgo(user.passwordLastChangedAt) : "Never"} />
              <Field label="Last login IP" value={<span className="font-mono text-xs">{user.lastLoginIp ?? "—"}</span>} />
            </dl>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              <Link href={`/authentication-events?q=${encodeURIComponent(user.email)}`} className="text-xs font-semibold text-primary hover:underline">View authentication events →</Link>
            </div>
          </Card>

          <ChartCard title="Roles & permissions" actions={<span className="text-xs text-muted-foreground">{uniquePerms.length} effective permissions</span>}>
            <div className="flex flex-wrap gap-2">
              {user.roleIds.map((roleId) => (
                <span key={roleId} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-medium text-foreground">
                  {getRoleById(roleId)?.name ?? roleId}
                  <button type="button" onClick={() => { removeRole(user.id, roleId); reload(); }} className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${getRoleById(roleId)?.name ?? roleId}`}><X size={11} /></button>
                </span>
              ))}
            </div>
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">High-risk permissions</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {highRisk.length === 0 && <li className="text-xs text-muted-foreground">None — low risk profile.</li>}
                {highRisk.map((perm) => (
                  <li key={perm} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"><ShieldAlert size={11} />{RISK_LABELS[perm] ?? perm}</li>
                ))}
              </ul>
            </div>
          </ChartCard>

          <ChartCard title="Active sessions" actions={<span className="text-xs text-muted-foreground">{user.sessions.length} active</span>}>
            {user.sessions.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No active sessions</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {user.sessions.map((session) => (
                  <li key={session.id} className="flex items-center gap-3 py-2.5">
                    {session.device.toLowerCase().includes("iphone") ? <Smartphone size={16} className="text-muted-foreground" aria-hidden="true" /> : <Laptop size={16} className="text-muted-foreground" aria-hidden="true" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-foreground">{session.device}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{session.ip} · {session.location} · started {mounted ? timeAgo(session.startedAt) : "…"}</p>
                    </div>
                    <button type="button" onClick={() => { revokeSession(user.id, session.id); reload(); }} className="shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Revoke</button>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        </div>

        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <Card className="flex flex-col rounded-xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><ShieldCheck size={15} aria-hidden="true" />Security posture</h2>
            <div className="mt-3 flex flex-col gap-3 text-[13px]">
              <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">MFA</span><MfaBadge enabled={user.mfaEnabled} /></div>
              <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Role risk</span><RiskBadge level={isAdmin ? "High" : "Medium"} /></div>
              <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Password changed</span><span className="font-medium text-foreground">{user.passwordLastChangedAt ? timeAgo(user.passwordLastChangedAt) : "Never"}</span></div>
              <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Stale login</span><span className={cn("font-medium", user.lastLoginAt && Date.now() - Date.parse(user.lastLoginAt) > 90 * 86_400_000 ? "text-amber-700" : "text-foreground")}>{user.lastLoginAt ? `${Math.floor((Date.now() - Date.parse(user.lastLoginAt)) / 86_400_000)}d ago` : "Never"}</span></div>
            </div>
            {!user.mfaEnabled && <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"><ShieldAlert size={12} aria-hidden="true" />Enable MFA to reduce account takeover risk</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button variant="outline" className="h-9 text-xs" onClick={() => { if (isSelf) { notify({ message: "Cannot require MFA on yourself" }); return; } requireMfa(user.id); reload(); notify({ message: "MFA required" }); }}><ShieldCheck size={13} />Require MFA</Button>
              <Button variant="destructive" className="h-9 text-xs" onClick={() => setConfirm({ title: "Revoke all sessions", description: `All ${user.sessions.length} active sessions for ${user.name} will be invalidated.`, confirmLabel: "Revoke all", danger: true, action: () => { revokeAllSessions(user.id); return "All sessions revoked"; } })}><Ban size={13} />Revoke sessions</Button>
            </div>
          </Card>

          <Card className="flex flex-col rounded-xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Fingerprint size={15} aria-hidden="true" />Recent activity</h2>
            <ul className="mt-3 flex flex-col divide-y divide-border text-[12px]">
              {[
                { action: "Logged in", at: user.lastLoginAt ?? new Date().toISOString(), detail: user.lastLoginIp ?? "internal" },
                { action: "Password changed", at: user.passwordLastChangedAt ?? user.createdAt, detail: "via self-service" },
                { action: "Role updated", at: user.createdAt, detail: user.roleIds.join(", ") },
              ].map((item, index) => (
                <li key={index} className="flex items-center justify-between gap-2 py-2"><span className="min-w-0"><span className="block font-medium text-foreground">{item.action}</span><span className="block truncate text-muted-foreground">{item.detail}</span></span><span className="shrink-0 tabular-nums text-muted-foreground">{mounted ? timeAgo(item.at) : "…"}</span></li>
              ))}
            </ul>
          </Card>

          <Card className="flex flex-col rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground">Actions</h2>
            <div className="mt-3 flex flex-col gap-2">
              <Button size="sm" onClick={reset} className="justify-start"><KeyRound size={13} />Reset password</Button>
              <Button size="sm" variant="outline" className="justify-start" onClick={() => { navigator.clipboard?.writeText(user.email); notify({ message: "Email copied" }); }}><Copy size={13} />Copy email</Button>
              {user.status !== "suspended" ? <Button size="sm" variant="destructive" className="justify-start" onClick={() => setConfirm({ title: "Suspend user", description: `${user.name} will lose access immediately.`, confirmLabel: "Suspend", danger: true, action: () => { suspend(); return `${user.name} suspended`; } })}><Ban size={13} />Suspend user</Button> : <Button size="sm" variant="outline" className="justify-start" onClick={() => { notify({ message: `${user.name} reactivated` }); reload(); }}><CheckCircle2 size={13} />Reactivate user</Button>}
              {!isSelf && <Button size="sm" variant="ghost" className="justify-start text-red-600 hover:bg-red-50" onClick={() => { notify({ message: "Delete flow opened (mock)" }); }}><Trash2 size={13} />Delete user</Button>}
            </div>
          </Card>
        </div>
      </div>

      <ConfirmActionDialog open={confirm != null} onOpenChange={(open: boolean) => { if (!open) setConfirm(null); }} title={confirm?.title ?? ""} description={confirm?.description ?? ""} confirmLabel={confirm?.confirmLabel ?? "Confirm"} danger={confirm?.danger} onConfirm={() => confirm?.action() ?? ""} onDone={notify} />
      <AuthToast toast={toast} onDismiss={dismiss} />
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="flex flex-col rounded-xl p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 font-display text-2xl font-bold leading-none tabular-nums", tone ?? "text-foreground")}>{value}</p>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-[13px] text-foreground">{value}</dd>
    </div>
  );
}

