"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronRight, CircleAlert,
  FileDown, FilterX, ListFilter, MoreVertical, RotateCcw, Search, SearchX, ShieldCheck,
  SlidersHorizontal, UserRound, Users, Globe, Layers, KeyRound, Mail, ShieldAlert,
  X, Clock3,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { ChartCard, SegmentedControl } from "@/components/logs/primitives";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/shared/pagination";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { ViewAllLink } from "@/components/shared/view-all-link";
import {
  AuthToast, useAuthToast, InviteUserDialog, CreateTokenDialog, CreateRoleDialog, TokenSecretDialog, ConfirmActionDialog,
} from "@/components/access-control/access-actions";
import { timeAgo, fullTime, timeZoneLabel } from "@/components/auth-events/auth-shared";
import { UserStatusBadge, RoleBadge, TokenEnvBadge, TokenStatusBadge, MfaBadge, RiskBadge } from "@/components/access-control/access-badges";
import { cn } from "@/lib/utils";
import { computeUserStats } from "@/utils/accessStats";
import {
  useUsers, useRoles, useApiTokens, useAccessAudit, DEMO_CURRENT_USER,
} from "@/mocks/useAccessControl";
import type { UserStatus } from "@/utils/accessStats";

type MainTab = "users" | "roles" | "tokens" | "matrix" | "audit";
type UsersStatus = "all" | UserStatus;
type UsersSortKey = "name" | "lastLogin" | "role" | "status";

const TABS: Array<{ key: MainTab; label: string }> = [
  { key: "users", label: "Users" },
  { key: "roles", label: "Roles" },
  { key: "tokens", label: "API Tokens" },
  { key: "matrix", label: "Permission Matrix" },
  { key: "audit", label: "Access Audit" },
];



export function AccessControlDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = (searchParams.get("tab") ?? "users") as MainTab;
  const roleFilter = searchParams.get("role") ?? "all";
  const statusFilter = (searchParams.get("status") ?? "all") as UsersStatus;
  const mfaFilter = searchParams.get("mfa") ?? "all";
  const staleOnly = searchParams.get("stale") === "1";
  const adminsOnly = searchParams.get("admins") === "1";
  const query = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const compact = searchParams.get("compact") === "1";
  const userParam = searchParams.get("user") ?? null;

  const { users, status: usersStatus, reload: reloadUsers } = useUsers();
  const { roles, status: rolesStatus, reload: reloadRoles } = useRoles();
  const { tokens, status: tokensStatus, reload: reloadTokens } = useApiTokens();
  const { audit, status: auditStatus, reload: reloadAudit } = useAccessAudit();

  const [mounted, setMounted] = useState(false);
  const [everLoaded, setEverLoaded] = useState(false);
  useEffect(() => { if (usersStatus === "success" && rolesStatus === "success" && tokensStatus === "success" && auditStatus === "success") setEverLoaded(true); }, [usersStatus, rolesStatus, tokensStatus, auditStatus]);
  const [sort, setSort] = useState<{ key: UsersSortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(10);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [createTokenOpen, setCreateTokenOpen] = useState(false);
  const [roleDraft, setRoleDraft] = useState<{ name: string; description: string; permissions: string[] } | null>(null);
  const [tokenDraft, setTokenDraft] = useState<{ name: string; ownerId: string; environment: "production" | "staging" | "development"; scopes: string[]; expiresAt: string | null } | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [drawerUser, setDrawerUser] = useState<string | null>(userParam);
  const [highRiskConfirm, setHighRiskConfirm] = useState<{ label: string } | null>(null);
  const [savedViews, setSavedViews] = useState<Array<{ name: string; patch: Record<string, string | null> }>>(() => {
    try { const raw = window.localStorage.getItem("access:saved-views:v1"); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const { toast, notify, dismiss } = useAuthToast();
  const tableTopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (userParam) setDrawerUser(userParam); }, [userParam]);

  const updateParams = useCallback((patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "" || value === "all") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const applyFilters = useCallback((patch: Record<string, string | null>) => updateParams({ ...patch, page: null }), [updateParams]);

  const roleMap = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);

  const filteredUsers = useMemo(() => {
    const now = Date.now();
    const list = users.filter((user) => {
      if (statusFilter !== "all" && user.status !== statusFilter) return false;
      if (roleFilter !== "all" && !user.roleIds.includes(roleFilter)) return false;
      if (mfaFilter === "off" && user.mfaEnabled) return false;
      if (mfaFilter === "on" && !user.mfaEnabled) return false;
      if (staleOnly && (!user.lastLoginAt || now - Date.parse(user.lastLoginAt) <= 90 * 86_400_000)) return false;
      if (adminsOnly && !user.roleIds.some((id) => id === "role-super-admin" || id === "role-admin")) return false;
      if (query) {
        const haystack = `${user.name} ${user.email} ${user.id} ${user.roleIds.map((id) => roleMap.get(id)?.name ?? id).join(" ")}`.toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort.key === "name") return a.name.localeCompare(b.name) * dir;
      if (sort.key === "lastLogin") return (Date.parse(a.lastLoginAt ?? "0") - Date.parse(b.lastLoginAt ?? "0")) * dir;
      if (sort.key === "role") return (roleMap.get(a.roleIds[0] ?? "")?.name ?? "").localeCompare(roleMap.get(b.roleIds[0] ?? "")?.name ?? "") * dir;
      return a.status.localeCompare(b.status) * dir;
    });
  }, [users, statusFilter, roleFilter, mfaFilter, staleOnly, adminsOnly, query, sort, roleMap]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageStart = (clampedPage - 1) * pageSize;
  const pageRows = filteredUsers.slice(pageStart, pageStart + pageSize);

  const stats = useMemo(() => computeUserStats(users.map((user) => ({ status: user.status, mfaEnabled: user.mfaEnabled, roleIds: user.roleIds, lastLoginAt: user.lastLoginAt }))), [users]);

  const activeTokens = useMemo(() => tokens.filter((token) => token.status === "active").length, [tokens]);
  const expiringSoon = useMemo(() => tokens.filter((token) => token.status === "active" && token.expiresAt && Date.parse(token.expiresAt) - Date.now() <= 14 * 86_400_000).length, [tokens]);
  const overPrivTokens = useMemo(() => tokens.filter((token) => token.scopes.includes("*")).length, [tokens]);
  const unusedTokens = useMemo(() => tokens.filter((token) => token.lastUsedAt && Date.now() - Date.parse(token.lastUsedAt) > 90 * 86_400_000).length, [tokens]);
  const accessRisks = stats.adminsWithoutMfa + overPrivTokens;

  const signInData = useMemo(() => {
    // 14 buckets of success/fail counts, seeded from mock audit + user logins
    const buckets: Array<{ label: string; success: number; failed: number }> = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 14 * 24 * 60 * 60 * 1000 / 13);
      buckets.push({ label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), success: Math.floor(18 + Math.random() * 12), failed: Math.floor(Math.random() * 3) });
    }
    return buckets;
  }, []);

  const userRoleShare = useMemo(() => {
    const counts = new Map<string, number>();
    for (const user of users) if (user.status !== "disabled") for (const roleId of user.roleIds) counts.set(roleId, (counts.get(roleId) ?? 0) + 1);
    const entries = [...counts.entries()].map(([roleId, count]) => ({ roleId, label: roleMap.get(roleId)?.name ?? roleId, count })).sort((a, b) => b.count - a.count);
    const max = entries[0]?.count ?? 1;
    return entries.map((entry) => ({ ...entry, pct: Math.round((entry.count / max) * 100) }));
  }, [users, roleMap]);

  const mfaCoverageByRole = useMemo(() => {
    const map = new Map<string, { total: number; enabled: number }>();
    for (const user of users) {
      for (const roleId of user.roleIds) {
        const entry = map.get(roleId) ?? { total: 0, enabled: 0 };
        entry.total += 1;
        if (user.mfaEnabled) entry.enabled += 1;
        map.set(roleId, entry);
      }
    }
    return [...map.entries()].map(([roleId, counts]) => ({
      label: roleMap.get(roleId)?.name ?? roleId,
      total: counts.total,
      pct: counts.total > 0 ? Math.round((counts.enabled / counts.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total).slice(0, 4);
  }, [users, roleMap]);

  const usersWithoutMfa = useMemo(() => users.filter((user) => !user.mfaEnabled && user.status !== "disabled").slice(0, 5), [users]);

  const upcomingTokens = useMemo(() => {
    return tokens
      .filter((token) => token.status === "active" && token.expiresAt)
      .sort((a, b) => Date.parse(a.expiresAt ?? "0") - Date.parse(b.expiresAt ?? "0"))
      .slice(0, 8);
  }, [tokens]);

  const recentChanges = useMemo(() => audit.slice(0, 10), [audit]);

  const fullyLoaded = usersStatus === "success" && rolesStatus === "success" && tokensStatus === "success" && auditStatus === "success";

  if (!fullyLoaded && !everLoaded) {
    return (
      <div className="space-y-4 pb-4" aria-busy="true">
        <div className="h-[5.75rem] animate-pulse rounded-xl bg-muted" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
        <div className="h-[18.75rem] animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }
  if (!fullyLoaded && everLoaded) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Security", "Access Control"]} title="Access Control" subtitle="Roles, permissions, and API tokens for your team" />
        <Card className="grid min-h-[17.5rem] place-items-center rounded-xl p-6"><div className="text-center"><CircleAlert className="mx-auto text-rose-500" size={28} /><h2 className="mt-2 text-base font-semibold">Access data could not be loaded</h2><p className="mt-1 text-sm text-muted-foreground">Retry to reload users, roles and tokens.</p><Button className="mt-4" onClick={() => { reloadUsers(); reloadRoles(); reloadTokens(); reloadAudit(); }}><RotateCcw size={15} />Retry</Button></div></Card>
      </div>
    );
  }

  const bannerRed = accessRisks > 0;
  const currentRoleName = DEMO_CURRENT_USER.role;

  return (
    <div className="min-w-0 space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Security", "Access Control"]}
        title="Access Control"
        subtitle="Roles, permissions, and API tokens for your team"
        lastUpdated={mounted ? new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "…"}
        onRefresh={() => { reloadUsers(); reloadRoles(); reloadTokens(); reloadAudit(); }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AlertMenu
              label="Export access control"
              trigger={<Button variant="outline" className="h-10 gap-1.5 text-sm"><FileDown size={15} />Export</Button>}
              items={[{ key: "csv", label: "CSV (filtered)", onSelect: () => { downloadAccessCsv(filteredUsers); notify({ message: `${filteredUsers.length} users exported` }); } }]}
            />
            <Button variant="outline" className="h-10 gap-1.5 text-sm" onClick={() => setCreateTokenOpen(true)}><KeyRound size={15} />Create API Token</Button>
            <Button variant="outline" className="h-10 gap-1.5 text-sm" onClick={() => setCreateRoleOpen(true)}><Layers size={15} />Create Role</Button>
            <Button className="h-10 gap-1.5 text-sm" onClick={() => setInviteOpen(true)}><UserRound size={15} />Invite User</Button>
          </div>
        }
      />

      {bannerRed ? (
        <div role="status" className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} aria-hidden="true" />{stats.adminsWithoutMfa} admins without MFA</span>
            <span className="hidden sm:inline" aria-hidden="true">·</span>
            <span>{overPrivTokens} over-privileged token{overPrivTokens === 1 ? "" : "s"}</span>
          </span>
          <button type="button" onClick={() => { applyFilters({ mfa: "off", admins: "1" }); tableTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="shrink-0 font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Review risks <ChevronRight size={14} className="inline" aria-hidden="true" /></button>
        </div>
      ) : (
        <div role="status" className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
          <span className="flex items-center gap-2"><ShieldCheck size={16} aria-hidden="true" />No access risks detected</span>
        </div>
      )}

      {/* KPI row — non-clickable */}
      <section aria-label="Access control KPIs" className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={<Users size={18} />} iconTone="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" label="Total Users" value={String(stats.total)} detail="across org" className="min-h-[5.5rem] p-3" />
        <StatCard icon={<CheckCircle2 size={18} />} iconTone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" label="Active Users" value={String(stats.active)} detail="active sessions" className="min-h-[5.5rem] p-3" />
        <StatCard icon={<ShieldCheck size={18} />} iconTone="bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300" label="MFA Coverage" value={`${stats.mfaCoveragePct}%`} detail={`${stats.mfaEnabled} of ${stats.total}`} className="min-h-[5.5rem] p-3" />
        <StatCard icon={<Layers size={18} />} iconTone="bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300" label="Roles" value={String(roles.length)} detail="system + custom" className="min-h-[5.5rem] p-3" />
        <StatCard icon={<KeyRound size={18} />} iconTone="bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300" label="Active Tokens" value={String(activeTokens)} detail={`${expiringSoon} expire within 14d`} className="min-h-[5.5rem] p-3" />
        <StatCard icon={<ShieldAlert size={18} />} iconTone="bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300" label="Access Risks" value={String(accessRisks)} detail="admin MFA + over-priv" className="min-h-[5.5rem] p-3" />
      </section>

      {/* Row A — sign-in activity + users by role */}
      <section className="grid items-stretch gap-4 xl:grid-cols-12">
        <ChartCard title="Sign-in Activity" className="xl:col-span-8" actions={<SegmentedControl value="30D" options={["7D", "30D", "90D"] as const} onChange={(value) => updateParams({ range: value })} />}>
          <div className="h-[14.375rem] min-h-[13.75rem] w-full flex-1" role="img" aria-label="Successful vs failed sign-ins">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={signInData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#E5E7EB" strokeDasharray="4 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 10 }} width={26} allowDecimals={false} />
                <Tooltip cursor={{ stroke: "#94A3B8" }} contentStyle={{ background: "#0f172a", border: 0, borderRadius: 8, color: "#fff", fontSize: 12 }} />
                <Area type="monotone" dataKey="success" name="Successful" stroke="#16A34A" fill="#16A34A" fillOpacity={0.25} />
                <Area type="monotone" dataKey="failed" name="Failed" stroke="#DC2626" fill="#DC2626" fillOpacity={0.35} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Users by Role" className="xl:col-span-4" actions={<CardKebab label="Users by role" />}>
          <div className="flex flex-1 items-center gap-4">
            <div className="relative h-[8.125rem] min-h-[8.125rem] w-[8.125rem] shrink-0" role="img" aria-label={`Role distribution`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={userRoleShare.slice(0, 5).map((item) => ({ name: item.label, value: item.count }))} dataKey="value" innerRadius="62%" outerRadius="100%" paddingAngle={2}>
                    {userRoleShare.slice(0, 5).map((entry, index) => <Cell key={index} fill={["#0EA5E9", "#8B5CF6", "#F59E0B", "#16A34A", "#94A3B8"][index % 5]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", border: 0, borderRadius: 8, color: "#fff", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className="font-display text-[1.125rem] leading-none text-foreground tabular-nums">{users.length}</b><span className="mt-1 text-[0.625rem] uppercase tracking-wide text-muted-foreground">users</span></div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
              {userRoleShare.slice(0, 5).map((entry, index) => (
                <li key={entry.roleId} className="flex items-center gap-2">
                  <i className="h-2 w-2 rounded-full" style={{ backgroundColor: ["#0EA5E9", "#8B5CF6", "#F59E0B", "#16A34A", "#94A3B8"][index % 5] }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground" title={entry.label}>{entry.label}</span>
                  <b className="tabular-nums text-foreground">{entry.count}</b>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">Excludes disabled users</p>
        </ChartCard>
      </section>

      {/* Row B — MFA coverage, token expiry, recent changes */}
      <section className="grid items-stretch gap-4 xl:grid-cols-3">
        <ChartCard title="MFA Coverage" className="p-3" actions={<CardKebab label="MFA coverage" />}>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 items-center gap-4 text-sm">
              <div><p className="text-muted-foreground">Enabled</p><p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{stats.mfaEnabled}</p></div>
              <div><p className="text-muted-foreground">Disabled</p><p className="mt-0.5 text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{stats.total - stats.mfaEnabled}</p></div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${stats.mfaCoveragePct}%` }} /></div>
            {stats.adminsWithoutMfa > 0 && <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"><AlertTriangle size={12} aria-hidden="true" />{stats.adminsWithoutMfa} admin account{stats.adminsWithoutMfa > 1 ? "s" : ""} without MFA</p>}
            <div className="border-t border-border pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">By role</p>
              <ul className="mt-1.5 space-y-1">
                {mfaCoverageByRole.map((row) => (
                  <li key={row.label} className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 truncate text-muted-foreground">{row.label}</span>
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.pct}%` }} /></div>
                    <span className="w-10 shrink-0 text-right tabular-nums text-foreground">{row.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
            {usersWithoutMfa.length > 0 && (
              <div className="border-t border-border pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accounts without MFA</p>
                <ul className="mt-1.5 flex flex-col divide-y divide-border">
                  {usersWithoutMfa.map((user) => (
                    <li key={user.id} className="flex items-center gap-2 py-1.5">
                      <InitialsAvatar name={user.name} size={22} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.75rem] font-medium text-foreground">{user.name}</span>
                        <span className="block truncate text-[0.625rem] text-muted-foreground">{user.email}</span>
                      </span>
                      <span className="shrink-0 text-[0.6875rem] font-semibold text-amber-700 dark:text-amber-300">No MFA</span>
                    </li>
                  ))}
                </ul>
            </div>
          )}
          </div>
        </ChartCard>

        <ChartCard title="Token Expiry" className="p-3" actions={<CardKebab label="Token expiry" />}>
          <ul className="flex flex-col divide-y divide-border">
            {upcomingTokens.map((token) => {
              const daysLeft = token.expiresAt ? Math.ceil((Date.parse(token.expiresAt) - Date.now()) / 86_400_000) : null;
              return (
                <li key={token.id}>
                  <button type="button" onClick={() => { updateParams({ tab: "tokens" }); }} className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${token.name} expires in ${daysLeft ?? ""} days`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] font-semibold text-foreground">{token.name}</span>
                      <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">{token.ownerName} · {token.environment}</span>
                    </span>
                    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-1 text-xs font-semibold", (daysLeft ?? 999) <= 7 ? "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300" : (daysLeft ?? 999) <= 30 ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300")}>in {daysLeft}d</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto border-t border-border pt-2"><p className="mb-2 text-center text-xs text-muted-foreground">{expiringSoon} expire within 14 days</p><ViewAllLink onClick={() => updateParams({ tab: "tokens" })} label="View all tokens" /></div>
        </ChartCard>

        <ChartCard title="Recent Access Changes" className="p-3" actions={<CardKebab label="Recent changes" />}>
          <ul className="flex flex-col divide-y divide-border">
            {recentChanges.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 py-1.5">
                <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full", entry.result === "Success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                  {entry.result === "Success" ? <CheckCircle2 size={11} /> : <CircleAlert size={11} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-muted-foreground">{entry.actor}</span>
                  <span className="mt-0.5 block truncate text-[0.75rem] font-medium text-foreground" title={entry.action}>{entry.action}</span>
                </span>
                <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">{timeAgo(entry.at)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto border-t border-border pt-2"><ViewAllLink href="/audit-logs" label="View audit logs" /></div>
        </ChartCard>
      </section>

      {/* Filter card + table */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((entry) => {
            const count = entry.key === "users" ? users.length : entry.key === "roles" ? roles.length : entry.key === "tokens" ? tokens.length : entry.key === "matrix" ? 12 : audit.length;
            return (
              <button key={entry.key} type="button" role="tab" aria-selected={tab === entry.key} onClick={() => updateParams({ tab: entry.key, page: null })} className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === entry.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
                {entry.label}
                <span className={cn("rounded-full px-1.5 py-0.5 text-xs tabular-nums", tab === entry.key ? "bg-black/15" : "bg-muted")}>{count}</span>
              </button>
            );
          })}
          <span className="ml-auto inline-flex h-9 items-center rounded-lg border border-border px-2.5 text-xs tabular-nums text-muted-foreground">{filteredUsers.length} shown</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-2">
          <div className="relative w-full min-w-[12.5rem] sm:w-auto sm:min-w-[15rem] sm:max-w-xs sm:flex-1">
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => applyFilters({ q: event.target.value || null })} placeholder="Search users, roles, tokens..." aria-label="Search access control" className="h-9 pl-9 pr-9 text-sm" />
            <kbd aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[0.75rem] font-medium text-muted-foreground">/</kbd>
          </div>
          {tab === "users" && (
            <>
              <FilterSelect value={roleFilter} onChange={(value) => applyFilters({ role: value })} label="Role" options={roles.map((role) => role.id)} optionLabels={roles.map((role) => role.name)} allLabel="All roles" />
              <FilterSelect value={statusFilter} onChange={(value) => applyFilters({ status: value })} label="Status" options={["active", "invited", "suspended", "disabled"]} optionLabels={["Active", "Invited", "Suspended", "Disabled"]} allLabel="All statuses" />
              <FilterSelect value={mfaFilter} onChange={(value) => applyFilters({ mfa: value })} label="MFA" options={["on", "off"]} optionLabels={["MFA on", "MFA off"]} allLabel="All MFA" />
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground hover:bg-accent focus-within:ring-2 focus-within:ring-ring"><input type="checkbox" checked={staleOnly} onChange={(event) => applyFilters({ stale: event.target.checked ? "1" : null })} className="h-4 w-4 accent-[var(--primary)]" aria-label="Stale 90d+ only" />Stale 90d+</label>
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground hover:bg-accent focus-within:ring-2 focus-within:ring-ring"><input type="checkbox" checked={adminsOnly} onChange={(event) => applyFilters({ admins: event.target.checked ? "1" : null })} className="h-4 w-4 accent-[var(--primary)]" aria-label="Admins only" />Admins only</label>
            </>
          )}
          {tab === "tokens" && (
            <FilterSelect value="all" onChange={() => {}} label="Owner" options={[]} allLabel="All owners" />
          )}
          <div className="flex items-center gap-1" role="group" aria-label="Range">{(["7D", "30D", "90D"] as const).map((value) => <button key={value} type="button" onClick={() => updateParams({ range: value })} className={cn("h-8 rounded-md border px-2 text-xs font-semibold", searchParams.get("range") === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent")}>{value}</button>)}</div>
          <button type="button" onClick={() => setSaveViewOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ListFilter size={13} />Saved views</button>
          <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><FilterX size={13} />Reset</button>
          <button type="button" onClick={() => updateParams({ compact: compact ? null : "1" })} aria-pressed={compact} className={cn("h-9 rounded-lg border px-2.5 text-xs font-semibold", compact ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}>Compact</button>
        </div>
        {savedViews.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-2 text-xs">
            <span className="font-semibold text-muted-foreground">Saved views:</span>
            {savedViews.map((view) => <button key={view.name} type="button" onClick={() => applyFilters(view.patch)} className="rounded-full border border-border px-2.5 py-1 text-[0.6875rem] font-medium text-muted-foreground hover:bg-accent">{view.name}</button>)}
          </div>
        )}
      </div>

      {/* Users table */}
      {tab === "users" && (
        <section ref={tableTopRef} aria-label="Users inventory" className="scroll-mt-4">
          <Card className="flex min-w-0 flex-col rounded-xl p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5"><p className="text-sm font-semibold text-foreground">Users</p><p className="text-xs text-muted-foreground">Click a row to open the quick drawer</p></div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-[0.8125rem]">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-12 px-2 py-2.5 text-center"><input type="checkbox" aria-label="Select page" className="h-4 w-4 accent-[var(--primary)]" checked={pageRows.length > 0 && pageRows.every((row) => selected.has(row.id))} onChange={toggleSelectPage} /></th>
                    <th className="w-[30%] px-2 py-2.5"><button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 font-semibold uppercase hover:text-foreground">User {sort.key === "name" ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-60" />}</button></th>
                    <th className="w-[16%] px-2 py-2.5 font-semibold">Role</th>
                    <th className="w-[12%] px-2 py-2.5 font-semibold">Status</th>
                    <th className="w-[10%] px-2 py-2.5 font-semibold">MFA</th>
                    <th className="w-[16%] px-2 py-2.5"><button type="button" onClick={() => toggleSort("lastLogin")} className="inline-flex items-center gap-1 font-semibold uppercase hover:text-foreground">Last login {sort.key === "lastLogin" ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-60" />}</button></th>
                    <th className="w-[12%] px-2 py-2.5 font-semibold">Groups</th>
                    <th className="w-11 px-2 py-2.5 text-right font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((user) => {
                    const isCurrent = user.email === DEMO_CURRENT_USER.email;
                    const roleNames = user.roleIds.map((id) => roleMap.get(id)?.name ?? id);
                    const isAdminMfaOff = user.roleIds.some((id) => id === "role-super-admin" || id === "role-admin") && !user.mfaEnabled;
                    return (
                      <tr key={user.id} tabIndex={0} className={cn("group relative cursor-pointer border-b border-border/70 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:bg-slate-50 dark:hover:bg-muted/30", compact ? "h-12" : "h-14")} onClick={() => openDrawer(user.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDrawer(user.id); } }}>
                        {isAdminMfaOff && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[0.1875rem] bg-amber-500" />}
                        <td className="relative px-2 py-2 text-center align-middle"><input type="checkbox" aria-label={`Select ${user.name}`} className="h-4 w-4 accent-[var(--primary)]" checked={selected.has(user.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleSelect(user.id)} /></td>
                        <td className="px-2 py-2 align-middle"><div className="flex items-center gap-2.5"><InitialsAvatar name={user.name} size={compact ? 24 : 30} /><span className="min-w-0"><span className="block truncate text-[0.8125rem] font-semibold text-foreground">{user.name}{isCurrent && <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 align-middle text-[0.625rem] font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">You</span>}</span><span className="block truncate text-[0.6875rem] text-muted-foreground">{user.email}</span></span></div></td>
                        <td className="px-2 py-2 align-middle"><div className="flex flex-wrap items-center gap-1">{roleNames.slice(0, 2).map((role, index) => <span key={index} className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">{role}</span>)}{roleNames.length > 2 && <span className="text-[0.6875rem] font-semibold text-muted-foreground">+{roleNames.length - 2}</span>}</div></td>
                        <td className="px-2 py-2 align-middle"><UserStatusBadge status={user.status} /></td>
                        <td className="px-2 py-2 align-middle"><MfaBadge enabled={user.mfaEnabled} /></td>
                        <td className="px-2 py-2 align-middle"><span className="block text-xs font-medium text-foreground">{mounted && user.lastLoginAt ? timeAgo(user.lastLoginAt) : "never"}</span>{user.lastLoginIp && <span className="block text-[0.6875rem] text-muted-foreground">{user.lastLoginIp}</span>}</td>
                        <td className="px-2 py-2 align-middle"><div className="flex flex-wrap items-center gap-1">{user.groupIds.slice(0, 2).map((group) => <span key={group} className="max-w-[5.625rem] truncate rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">{group}</span>)}{user.groupIds.length > 2 && <span className="text-[0.6875rem] font-semibold text-muted-foreground">+{user.groupIds.length - 2}</span>}</div></td>
                        <td className="px-2 py-2 align-middle text-right" onClick={(event) => event.stopPropagation()}>
                          <AlertMenu label={`Actions for ${user.name}`} align="end" trigger={<button type="button" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Actions for ${user.name}`}><MoreVertical size={15} /></button>} items={[
                            { key: "view", label: "View profile", onSelect: () => openDrawer(user.id) },
                            { key: "edit", label: "Edit roles", onSelect: () => notify({ message: "Role editor opened (mock)" }) },
                            { key: "reset", label: "Reset password", onSelect: () => notify({ message: `Password reset link sent to ${user.email}` }) },
                            { key: "mfa", label: user.mfaEnabled ? "Disable MFA" : "Require MFA", onSelect: () => notify({ message: user.mfaEnabled ? "MFA disabled" : "MFA required" }) },
                            { key: "suspend", label: user.status === "suspended" ? "Reactivate" : "Suspend", danger: true, onSelect: () => notify({ message: user.status === "suspended" ? "User reactivated" : "User suspended" }) },
                            { key: "delete", label: "Delete user", danger: true, disabled: isCurrent, onSelect: () => notify({ message: "Delete flow opened (mock)" }) },
                          ]} />
                        </td>
                      </tr>
                    );
                  })}
                  {pageRows.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-12 text-center"><SearchX className="mx-auto text-muted-foreground" size={26} /><p className="mt-2 text-sm font-semibold text-foreground">No users match your filters</p><p className="mt-1 text-xs text-muted-foreground">Try removing a filter or clearing the search.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => router.replace(pathname, { scroll: false })}><RotateCcw size={13} />Clear filters</Button></td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={clampedPage} pageSize={pageSize} totalItems={filteredUsers.length} onPageChange={(next) => updateParams({ page: String(next) })} onPageSizeChange={(size) => { setPageSize(size); updateParams({ page: null }); }} noun="users" pageSizeOptions={[10, 25, 50]} />
          </Card>
        </section>
      )}
      {tab === "roles" && <RolesPanel roles={roles} onCreate={() => setCreateRoleOpen(true)} onAssign={(roleId) => updateParams({ role: roleId })} />}
      {tab === "tokens" && <TokensPanel tokens={tokens} onCreate={() => setCreateTokenOpen(true)} />}
      {tab === "matrix" && <PermissionMatrixPanel roles={roles} />}
      {tab === "audit" && <AccessAuditPanel audit={audit} />}
      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} onDone={(result) => { notify(result); reloadUsers(); reloadAudit(); }} />
      <CreateTokenDialog open={createTokenOpen} onOpenChange={setCreateTokenOpen} onDone={(result) => { const secret = result.message.split("::")[1]; if (secret) setSecret(secret); notify({ message: result.message }); reloadTokens(); reloadAudit(); }} />
      <TokenSecretDialog open={secret != null} onOpenChange={(open) => { if (!open) setSecret(null); }} token={secret} onDone={() => setSecret(null)} />
      <CreateRoleDialog open={createRoleOpen} onOpenChange={setCreateRoleOpen} onDone={(result) => { notify(result); reloadRoles(); }} />
      <AuthToast toast={toast} onDismiss={dismiss} />
    </div>
  );

  function toggleSort(key: UsersSortKey) { setSort((current) => current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }); }
  function toggleSelect(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function toggleSelectPage() {
    setSelected((current) => {
      const ids = pageRows.map((row) => row.id);
      const all = ids.every((id) => current.has(id));
      const next = new Set(current);
      if (all) ids.forEach((id) => next.delete(id)); else ids.forEach((id) => next.add(id));
      return next;
    });
  }
  function openDrawer(userId: string) { setDrawerUser(userId); updateParams({ user: userId }); }
  function downloadAccessCsv(rows: typeof filteredUsers) {
    const header = ["id", "name", "email", "status", "roles", "mfa", "lastLogin"];
    const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const lines = [header.join(",")];
    for (const user of rows) lines.push([user.id, user.name, user.email, user.status, user.roleIds.map((id) => roleMap.get(id)?.name ?? id).join(";"), String(user.mfaEnabled), user.lastLoginAt ?? ""].map(escape).join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `access-control-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }
}

function FilterSelect({ value, onChange, label, options, optionLabels, allLabel }: { value: string; onChange: (value: string) => void; label: string; options: string[]; optionLabels?: string[]; allLabel: string }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className="h-9 max-w-[10rem] rounded-md border border-input bg-card px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
      <option value="all">{allLabel}</option>
      {options.map((option, index) => <option key={option} value={option}>{optionLabels?.[index] ?? option}</option>)}
    </select>
  );
}

function CardKebab({ label }: { label: string }) {
  return <AlertMenu label={`${label} actions`} trigger={<button type="button" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`${label} actions`}><MoreVertical size={15} /></button>} items={[{ key: "table", label: "View as table", onSelect: () => undefined }, { key: "export", label: "Export CSV", onSelect: () => undefined }]} />;
}

function RolesPanel({ roles, onCreate, onAssign }: { roles: import("@/mocks/accessControl").Role[]; onCreate: () => void; onAssign: (roleId: string) => void }) {
  return (
    <section className="grid items-stretch gap-4 xl:grid-cols-3">
      {roles.map((role) => (
        <Card key={role.id} className="flex flex-col rounded-xl p-4">
          <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-foreground">{role.name}</h2><RoleBadge type={role.type} /></div>
          <p className="mt-2 text-xs text-muted-foreground">{role.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded border border-border bg-muted/40 px-2 py-0.5">{role.userCount} users</span><span className="rounded border border-border bg-muted/40 px-2 py-0.5">{role.permissions.length} permissions</span><span className={cn("rounded border px-2 py-0.5", role.riskLevel === "High" ? "border-red-200 text-red-700" : role.riskLevel === "Medium" ? "border-amber-200 text-amber-700" : "border-emerald-200 text-emerald-700")}>{role.riskLevel} risk</span></div>
          <button type="button" onClick={() => onAssign(role.id)} className="mt-4 text-xs font-semibold text-primary hover:underline">Filter users by this role →</button>
        </Card>
      ))}
      <Card className="flex min-h-[11.25rem] flex-col items-center justify-center rounded-xl border-dashed p-4 text-center"><p className="text-sm text-muted-foreground">Create a custom role for a specific need</p><Button className="mt-4" onClick={onCreate}><Layers size={15} />Create Role</Button></Card>
    </section>
  );
}

function TokensPanel({ tokens, onCreate }: { tokens: import("@/mocks/accessControl").ApiToken[]; onCreate: () => void }) {
  return (
    <section className="space-y-3">
      <Card className="flex flex-col rounded-xl p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5"><p className="text-sm font-semibold text-foreground">API Tokens</p><Button size="sm" onClick={onCreate}><KeyRound size={13} />Create token</Button></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[55rem] text-left text-[0.8125rem]">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2 font-semibold">Token</th><th className="px-3 py-2 font-semibold">Owner</th><th className="px-3 py-2 font-semibold">Scopes</th><th className="px-3 py-2 font-semibold">Last used</th><th className="px-3 py-2 font-semibold">Expires</th><th className="px-3 py-2 font-semibold">Status</th></tr></thead>
            <tbody>
              {tokens.slice(0, 8).map((token) => (
                <tr key={token.id} className="border-b border-border/70 hover:bg-muted/30">
                  <td className="px-3 py-2.5"><span className="block font-mono text-xs text-foreground">{token.prefix}••••</span><span className="block text-[0.6875rem] text-muted-foreground">{token.name} · {token.environment}</span></td>
                  <td className="px-3 py-2.5 text-muted-foreground">{token.ownerName}</td>
                  <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{token.scopes.slice(0, 2).map((scope) => <span key={scope} className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">{scope}</span>)}{token.scopes.length > 2 && <span className="text-[0.625rem] font-semibold text-muted-foreground">+{token.scopes.length - 2}</span>}</div></td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{token.lastUsedAt ? timeAgo(token.lastUsedAt) : <span className="text-amber-600">Never</span>}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{token.expiresAt ? new Date(token.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : <span className="text-muted-foreground">Never</span>}</td>
                  <td className="px-3 py-2.5"><TokenStatusBadge status={token.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function PermissionMatrixPanel({ roles }: { roles: import("@/mocks/accessControl").Role[] }) {
  const resources = ["servers", "alerts", "alert-rules", "incidents", "security", "access-control"];
  const actions = ["view", "create", "edit", "delete", "execute", "approve"];
  return (
    <Card className="flex min-w-0 flex-col rounded-xl p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><p className="text-sm font-semibold text-foreground">Permission Matrix</p><p className="text-[0.6875rem] text-muted-foreground">Read-only preview · edit in Role detail</p></div>
      <div className="overflow-x-auto">
        <table className="min-w-[55rem] w-full table-fixed text-left text-[0.75rem]">
          <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="w-44 px-3 py-2 font-semibold">Resource / Action</th>{roles.slice(0, 6).map((role) => <th key={role.id} className="px-2 py-2 text-center font-semibold" title={role.name}>{role.name.split(" ")[0]}</th>)}</tr></thead>
          <tbody>
            {resources.map((resource) => (
              <tr key={resource} className="border-b border-border/70">
                <td className="px-3 py-2.5 font-semibold text-foreground">{resource}</td>
                {roles.slice(0, 6).map((role) => {
                  const perms = new Set(role.permissions);
                  const has = (action: string) => perms.has(`${resource}:${action}`) || perms.has(`${resource}:*`) || perms.has("*") || role.permissions.some((p) => p.startsWith(`${resource}:*`));
                  return (
                    <td key={role.id} className="px-2 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {actions.map((action) => (
                          <span key={action} className={cn("grid h-5 w-5 place-items-center rounded-sm text-[0.625rem] font-bold", has(action) ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")} title={action}>{has(action) ? "✓" : "·"}</span>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AccessAuditPanel({ audit }: { audit: import("@/mocks/accessControl").AccessAuditEntry[] }) {
  return (
    <Card className="flex min-w-0 flex-col rounded-xl p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5"><p className="text-sm font-semibold text-foreground">Access Audit</p><Link href="/audit-logs" className="text-xs font-semibold text-primary hover:underline">Full audit log →</Link></div>
      <div className="overflow-x-auto">
        <table className="min-w-[45rem] w-full text-left text-[0.8125rem]">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2 font-semibold">Time</th><th className="px-3 py-2 font-semibold">Actor</th><th className="px-3 py-2 font-semibold">Action</th><th className="px-3 py-2 font-semibold">Target</th><th className="px-3 py-2 font-semibold">Result</th></tr></thead>
          <tbody>
            {audit.slice(0, 10).map((entry) => (
              <tr key={entry.id} className="border-b border-border/70 hover:bg-muted/30">
                <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground" title={fullTime(entry.at)}>{timeAgo(entry.at)}</td>
                <td className="px-3 py-2.5 font-medium text-foreground">{entry.actor}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{entry.action}</td>
                <td className="max-w-[16.25rem] truncate px-3 py-2.5 font-mono text-[0.6875rem] text-muted-foreground" title={entry.target}>{entry.target}</td>
                <td className="px-3 py-2.5"><span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold", entry.result === "Success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{entry.result}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

