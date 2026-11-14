"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronRight, CircleAlert, FileDown,
  FilterX, ListFilter, MoreVertical, Plus, RotateCcw, ScanLine, Search, SearchX, ShieldCheck, SlidersHorizontal,
  X, Clock3, ShieldAlert,
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
  AuthToast, useAuthToast, ScanCertificatesModal, AddCertificateDialog, RenewCertificateDialog,
  RevokeCertificateDialog, AssignCertOwnerDialog, ToggleAutoRenewDialog, downloadPem,
} from "@/components/certificates/cert-actions";
import { CertQuickDrawer } from "@/components/certificates/cert-quick-drawer";
import { timeAgo, fullTime, timeZoneLabel } from "@/components/auth-events/auth-shared";
import {
  CertStatusBadge, IssuerTypeBadge, HostChips, HealthBar, DaysLeftBadge, ExpiryStripe,
} from "@/components/certificates/cert-shared";
import { cn } from "@/lib/utils";
import { daysUntilExpiry, expiryStatus, healthScore, type CertStatus } from "@/utils/certStats";
import type { Certificate } from "@/mocks/certificates";
import { useCertificates, useCertSummary } from "@/mocks/useCertificates";

type MainTab = "all" | "expired" | "expiring" | "healthy" | "selfsigned";
type SortKey = "expiresAt" | "health" | "commonName";
type RangeKey = "7D" | "30D" | "90D" | "1Y";

const TABS: Array<{ key: MainTab; label: string }> = [
  { key: "all", label: "All" },
  { key: "expired", label: "Expired" },
  { key: "expiring", label: "Expiring Soon" },
  { key: "healthy", label: "Healthy" },
  { key: "selfsigned", label: "Self-signed" },
];

const STATUS_COLORS: Record<CertStatus, string> = { Expired: "#DC2626", Critical: "#EA580C", "Expiring soon": "#D97706", Healthy: "#16A34A", Revoked: "#94A3B8" };

function isWeak(cert: Certificate): boolean {
  return /sha1/i.test(cert.signatureAlgorithm) || cert.keySize < 2048;
}

function certHealth(cert: Certificate, nowMs: number): number {
  return healthScore({ daysLeft: daysUntilExpiry(cert.expiresAt, nowMs), signatureAlgorithm: cert.signatureAlgorithm, keySize: cert.keySize, chainValid: cert.chainValid, autoRenew: cert.autoRenew, revoked: cert.revoked });
}

export function CertificatesDashboard() {
  const summary = useCertSummary();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = (searchParams.get("tab") ?? "all") as MainTab;
  const statusFilter = searchParams.get("status") ?? "all";
  const issuerFilter = searchParams.get("issuer") ?? "all";
  const envFilter = searchParams.get("env") ?? "all";
  const ownerFilter = searchParams.get("owner") ?? "all";
  const groupFilter = searchParams.get("group") ?? "all";
  const keyTypeFilter = searchParams.get("keyType") ?? "all";
  const autoRenewOff = searchParams.get("autorenew") === "0";
  const weakOnly = searchParams.get("weak") === "1";
  const range = (searchParams.get("range") ?? "30D") as RangeKey;
  const query = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const compact = searchParams.get("compact") === "1";
  const certParam = searchParams.get("cert") ?? null;

  const { certs, status: loadStatus, reload } = useCertificates();

  const [mounted, setMounted] = useState(false);
  const [everLoaded, setEverLoaded] = useState(false);
  useEffect(() => { if (loadStatus === "success") setEverLoaded(true); }, [loadStatus]);

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "expiresAt", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(10);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [scanOpen, setScanOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [renewFor, setRenewFor] = useState<string | null>(null);
  const [revokeFor, setRevokeFor] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [autoRenewFor, setAutoRenewFor] = useState<string | null>(null);
  const [drawerCert, setDrawerCert] = useState<string | null>(certParam);
  const [savedViews, setSavedViews] = useState<Array<{ name: string; patch: Record<string, string | null> }>>(() => {
    try { const raw = window.localStorage.getItem("certs:saved-views:v1"); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const { toast, notify, dismiss } = useAuthToast();
  const tableTopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (certParam) setDrawerCert(certParam); }, [certParam]);

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

  const filteredCerts = useMemo(() => {
    const nowMs = Date.now();
    const list = certs.filter((cert) => {
      const status = expiryStatus(cert.expiresAt, cert.revoked, nowMs);
      if (tab === "expired" && status !== "Expired") return false;
      if (tab === "expiring" && status !== "Critical" && status !== "Expiring soon") return false;
      if (tab === "healthy" && status !== "Healthy") return false;
      if (tab === "selfsigned" && cert.issuerType !== "Self-signed") return false;
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (issuerFilter !== "all" && cert.issuer !== issuerFilter) return false;
      if (envFilter !== "all" && cert.environment !== envFilter) return false;
      if (ownerFilter !== "all" && cert.ownerId !== ownerFilter) return false;
      if (groupFilter !== "all" && !cert.hostIds.some((host) => {
        if (groupFilter === "database-cluster") return host === "db-01";
        if (groupFilter === "production-web") return host === "web-app-01" || host === "web-02";
        if (groupFilter === "edge-locations") return host === "edge-01";
        return false;
      })) return false;
      if (keyTypeFilter !== "all" && cert.keyType !== keyTypeFilter) return false;
      if (autoRenewOff && cert.autoRenew) return false;
      if (weakOnly && !isWeak(cert)) return false;
      if (query) {
        const haystack = `${cert.id} ${cert.commonName} ${cert.sans.join(" ")} ${cert.issuer} ${cert.hostIds.join(" ")} ${cert.serial} ${cert.fingerprintSha256}`.toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort.key === "expiresAt") return (Date.parse(a.expiresAt) - Date.parse(b.expiresAt)) * dir;
      if (sort.key === "health") return (certHealth(a, nowMs) - certHealth(b, nowMs)) * dir;
      return a.commonName.localeCompare(b.commonName) * dir;
    });
  }, [certs, tab, statusFilter, issuerFilter, envFilter, ownerFilter, groupFilter, keyTypeFilter, autoRenewOff, weakOnly, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredCerts.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageStart = (clampedPage - 1) * pageSize;
  const pageRows = filteredCerts.slice(pageStart, pageStart + pageSize);

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) + (issuerFilter !== "all" ? 1 : 0) + (envFilter !== "all" ? 1 : 0) + (ownerFilter !== "all" ? 1 : 0)
    + (groupFilter !== "all" ? 1 : 0) + (keyTypeFilter !== "all" ? 1 : 0) + (autoRenewOff ? 1 : 0) + (weakOnly ? 1 : 0) + (query ? 1 : 0);

  const bannerRed = summary.expired > 0 || summary.expiring7 > 0;

  const timelineData = useMemo(() => {
    const dayMs = 86_400_000;
    const bucketSpecs: Array<{ count: number; ms: number; fmt: Intl.DateTimeFormatOptions; rangeFmt: Intl.DateTimeFormatOptions }> =
      range === "7D" ? [{ count: 7, ms: dayMs, fmt: { weekday: "short", day: "numeric" }, rangeFmt: { weekday: "short", month: "short", day: "numeric" } }]
      : range === "30D" ? [{ count: 6, ms: 5 * dayMs, fmt: { month: "short", day: "numeric" }, rangeFmt: { month: "short", day: "numeric" } }]
      : range === "90D" ? [{ count: 6, ms: 15 * dayMs, fmt: { month: "short", day: "numeric" }, rangeFmt: { month: "short", day: "numeric" } }]
      : [{ count: 12, ms: 30.5 * dayMs, fmt: { month: "short" }, rangeFmt: { month: "short", year: "numeric" } }];
    const buckets: Array<{ label: string; expired: number; critical: number; soon: number; healthy: number; range: string }> = [];
    for (const spec of bucketSpecs) {
      for (let i = spec.count - 1; i >= 0; i -= 1) {
        const start = Date.now() + i * spec.ms;
        const end = start + spec.ms;
        let expired = 0, critical = 0, soon = 0, healthy = 0;
        for (const cert of certs) {
          const exp = Date.parse(cert.expiresAt);
          if (exp >= start && exp < end) {
            const s = expiryStatus(cert.expiresAt, cert.revoked);
            if (s === "Expired") expired += 1; else if (s === "Critical") critical += 1; else if (s === "Expiring soon") soon += 1; else healthy += 1;
          }
        }
        buckets.push({ label: new Date(start).toLocaleDateString(undefined, spec.fmt), expired, critical, soon, healthy, range: `${new Date(start).toLocaleDateString(undefined, spec.rangeFmt)} – ${new Date(end - dayMs).toLocaleDateString(undefined, spec.rangeFmt)}` });
      }
    }
    return buckets;
  }, [certs, range]);

  const expiringThisMonth = useMemo(() => certs.filter((cert) => { const days = daysUntilExpiry(cert.expiresAt); return days >= 0 && days <= 30; }).length, [certs]);
  const expiringCritical = useMemo(() => certs.filter((cert) => { const days = daysUntilExpiry(cert.expiresAt); return days >= 0 && days <= 7; }).length, [certs]);

  const statusData = useMemo(() => {
    const counts: Record<CertStatus, number> = { Expired: 0, Critical: 0, "Expiring soon": 0, Healthy: 0, Revoked: 0 };
    for (const cert of certs) counts[expiryStatus(cert.expiresAt, cert.revoked)] += 1;
    return (["Expired", "Critical", "Expiring soon", "Healthy", "Revoked"] as CertStatus[]).map((name) => ({ name, value: counts[name], color: STATUS_COLORS[name] }));
  }, [certs]);

  const issuerData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cert of certs) counts.set(cert.issuer, (counts.get(cert.issuer) ?? 0) + 1);
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] ?? 1;
    return entries.slice(0, 6).map(([issuer, count]) => ({ issuer, count, pct: Math.round((count / max) * 100) }));
  }, [certs]);

  const trustMix = useMemo(() => {
    const publicCA = certs.filter((c) => c.issuerType === "Public CA").length;
    const internalCA = certs.filter((c) => c.issuerType === "Internal CA").length;
    const selfSigned = certs.filter((c) => c.issuerType === "Self-signed").length;
    const total = publicCA + internalCA + selfSigned || 1;
    return [
      { type: "Public CAs", count: publicCA, pct: Math.round((publicCA / total) * 100), color: "#0EA5E9" },
      { type: "Internal CA", count: internalCA, pct: Math.round((internalCA / total) * 100), color: "#8B5CF6" },
      { type: "Self-signed", count: selfSigned, pct: Math.round((selfSigned / total) * 100), color: "#F59E0B" },
    ];
  }, [certs]);

  const upcoming = useMemo(() => {
    return [...certs]
      .filter((cert) => { const days = daysUntilExpiry(cert.expiresAt); return days >= 0 && days <= 60; })
      .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt))
      .slice(0, 9);
  }, [certs]);

  const manualCount = useMemo(() => certs.filter((cert) => !cert.autoRenew && !cert.revoked).length, [certs]);

  const nextRenewal = useMemo(() => {
    const now = Date.now();
    const upcoming = [...certs].filter((c) => !c.revoked).sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt))[0];
    if (!upcoming) return null;
    const days = daysUntilExpiry(upcoming.expiresAt);
    return { cert: upcoming, days };
  }, [certs]);

  const manualRenewals = useMemo(() => {
    return [...certs]
      .filter((cert) => !cert.autoRenew && !cert.revoked)
      .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt))
      .slice(0, 4);
  }, [certs]);

  const envRenewal = useMemo(() => {
    const byEnv: Record<string, { total: number; auto: number }> = { Production: { total: 0, auto: 0 }, Staging: { total: 0, auto: 0 }, Development: { total: 0, auto: 0 } };
    for (const cert of certs) {
      const env = cert.environment;
      if (!byEnv[env]) continue;
      byEnv[env].total += 1;
      if (cert.autoRenew) byEnv[env].auto += 1;
    }
    return Object.entries(byEnv).map(([env, v]) => ({ env, auto: v.auto, total: v.total, pct: v.total ? Math.round((v.auto / v.total) * 100) : 0 }));
  }, [certs]);

  const renewalMethods = useMemo(() => {
    const counts: Record<string, number> = { ACME: 0, Vendor: 0, Manual: 0 };
    for (const cert of certs) { if (!cert.revoked) counts[cert.renewalMethod] = (counts[cert.renewalMethod] ?? 0) + 1; }
    const total = counts.ACME + counts.Vendor + counts.Manual;
    const max = Math.max(counts.ACME, counts.Vendor, counts.Manual, 1);
    return [
      { method: "ACME", count: counts.ACME, pct: Math.round((counts.ACME / max) * 100), color: "#16A34A" },
      { method: "Vendor", count: counts.Vendor, pct: Math.round((counts.Vendor / max) * 100), color: "#0EA5E9" },
      { method: "Manual", count: counts.Manual, pct: Math.round((counts.Manual / max) * 100), color: "#F59E0B" },
    ];
  }, [certs]);

  const toggleSort = useCallback((key: SortKey) => setSort((current) => current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }), []);
  const toggleSelect = useCallback((id: string) => {
    setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);
  const toggleSelectPage = useCallback(() => {
    setSelected((current) => {
      const ids = pageRows.map((row) => row.id);
      const all = ids.every((id) => current.has(id));
      const next = new Set(current);
      if (all) ids.forEach((id) => next.delete(id)); else ids.forEach((id) => next.add(id));
      return next;
    });
  }, [pageRows]);

  const exportCsv = useCallback((rows: Certificate[]) => {
    const header = ["id", "commonName", "issuer", "issuerType", "issuedAt", "expiresAt", "status", "autoRenew", "hosts", "serial"];
    const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const lines = [header.join(",")];
    for (const cert of rows) lines.push([cert.id, cert.commonName, cert.issuer, cert.issuerType, cert.issuedAt, cert.expiresAt, expiryStatus(cert.expiresAt, cert.revoked), String(cert.autoRenew), cert.hostIds.join(";"), cert.serial].map(escape).join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `certificates-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const applySavedView = useCallback((patch: Record<string, string | null>) => applyFilters(patch), [applyFilters]);
  const saveCurrentView = useCallback(() => {
    const name = saveViewName.trim();
    if (!name) return;
    const patch: Record<string, string | null> = {};
    if (tab !== "all") patch.tab = tab;
    if (statusFilter !== "all") patch.status = statusFilter;
    if (issuerFilter !== "all") patch.issuer = issuerFilter;
    if (envFilter !== "all") patch.env = envFilter;
    if (ownerFilter !== "all") patch.owner = ownerFilter;
    if (groupFilter !== "all") patch.group = groupFilter;
    if (keyTypeFilter !== "all") patch.keyType = keyTypeFilter;
    if (autoRenewOff) patch.autorenew = "0";
    if (weakOnly) patch.weak = "1";
    if (range !== "30D") patch.range = range;
    if (query) patch.q = query;
    const next = [...savedViews.filter((view) => view.name !== name), { name, patch }];
    try { window.localStorage.setItem("certs:saved-views:v1", JSON.stringify(next)); } catch { /* quota */ }
    setSavedViews(next);
    notify({ message: `View “${name}” saved` });
    setSaveViewOpen(false);
    setSaveViewName("");
  }, [tab, statusFilter, issuerFilter, envFilter, ownerFilter, groupFilter, keyTypeFilter, autoRenewOff, weakOnly, range, query, savedViews, saveViewName, notify]);

  const clearAllFilters = useCallback(() => router.replace(pathname, { scroll: false }), [pathname, router]);
  const openDrawer = useCallback((certId: string) => { setDrawerCert(certId); updateParams({ cert: certId }); }, [updateParams]);
  const closeDrawer = useCallback(() => { setDrawerCert(null); updateParams({ cert: null }); }, [updateParams]);

  if (loadStatus === "loading" && !everLoaded) {
    return (
      <div className="space-y-4 pb-4" aria-busy="true">
        <div className="h-[5.75rem] animate-pulse rounded-xl bg-muted" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
        <div className="h-[18.75rem] animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }
  if (loadStatus === "error" && !everLoaded) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Security", "Certificates & Expiration"]} title="Certificates & Expiration" subtitle="TLS certificate inventory with expiration alerts" />
        <Card className="grid min-h-[17.5rem] place-items-center rounded-xl p-6"><div className="text-center"><CircleAlert className="mx-auto text-rose-500" size={28} /><h2 className="mt-2 text-base font-semibold">Certificates could not be loaded</h2><p className="mt-1 text-sm text-muted-foreground">Retry to reload certificate inventory.</p><Button className="mt-4" onClick={reload}><RotateCcw size={15} />Retry</Button></div></Card>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Security", "Certificates & Expiration"]}
        title="Certificates & Expiration"
        subtitle="TLS certificate inventory with expiration alerts"
        lastUpdated={mounted ? lastUpdated.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "…"}
        onRefresh={() => { reload(); setLastUpdated(new Date()); }}
        actions={
          <div className="flex items-center gap-2">
            <AlertMenu
              label="Export certificates"
              trigger={<Button variant="outline" className="h-10 gap-1.5 text-sm"><FileDown size={15} />Export</Button>}
              items={[
                { key: "csv", label: "CSV (filtered)", onSelect: () => { exportCsv(filteredCerts); notify({ message: `${filteredCerts.length} rows exported as CSV` }); } },
                { key: "pdf", label: "PDF summary", onSelect: () => notify({ message: "PDF summary queued (mock)" }) },
              ]}
            />
            <Button variant="outline" className="h-10 gap-1.5 text-sm" onClick={() => setAddOpen(true)}><Plus size={15} />Add Certificate</Button>
            <Button className="h-10 gap-1.5 text-sm" onClick={() => setScanOpen(true)}><ScanLine size={15} />Scan Certificates</Button>
          </div>
        }
      />

      {bannerRed ? (
        <div role="status" className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200">
          <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} aria-hidden="true" />{summary.expired} certificates expired</span>
            <span className="hidden sm:inline" aria-hidden="true">·</span>
            <span>{summary.expiring7} expire within 7 days</span>
          </span>
          <button type="button" onClick={() => { applyFilters({ tab: "expired" }); tableTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="shrink-0 font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">View expired <ChevronRight size={14} className="inline" aria-hidden="true" /></button>
        </div>
      ) : (
        <div role="status" className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
          <span className="flex items-center gap-2"><ShieldCheck size={16} aria-hidden="true" />All certificates healthy</span>
          <span className="text-xs">Last scan 2h ago</span>
        </div>
      )}

      <section aria-label="Certificate KPIs" className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={<ShieldAlert size={18} />} iconTone="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" label="Total Certificates" value={String(summary.total)} detail="across fleet" className="min-h-[5.5rem] p-3" />
        <StatCard icon={<AlertTriangle size={18} />} iconTone="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" label="Expired" value={String(summary.expired)} detail="action required" className="min-h-[5.5rem] p-3" />
        <StatCard icon={<Clock3 size={18} />} iconTone="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" label="Expiring (30d)" value={String(summary.expiring30)} detail="within 30 days" className="min-h-[5.5rem] p-3" />
        <StatCard icon={<CheckCircle2 size={18} />} iconTone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" label="Auto-Renew Coverage" value={`${summary.autoRenewCoveragePct}%`} detail="fleet-wide" className="min-h-[5.5rem] p-3" />
        <StatCard icon={<ShieldAlert size={18} />} iconTone="bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300" label="Weak / Insecure" value={String(summary.weak)} detail="SHA-1 or key < 2048" className="min-h-[5.5rem] p-3" />
        <StatCard icon={<CheckCircle2 size={18} />} iconTone="bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300" label="Avg Health Score" value={String(summary.avgHealthScore)} detail="0-100" className="min-h-[5.5rem] p-3" />
      </section>

      {/* Row A - timeline + status donut */}
      <section className="grid items-stretch gap-4 xl:grid-cols-12">
        <ChartCard title="Expiration Timeline" className="xl:col-span-8" actions={<SegmentedControl value={range} options={["7D", "30D", "90D", "1Y"] as const} onChange={(value) => updateParams({ range: value })} />}>
          <div className="flex flex-1 flex-col justify-center gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[0.1875rem] bg-red-600" /><span className="text-muted-foreground">Expired</span></span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[0.1875rem] bg-orange-500" /><span className="text-muted-foreground">Critical</span></span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[0.1875rem] bg-amber-500" /><span className="text-muted-foreground">Expiring soon</span></span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[0.1875rem] bg-emerald-500" /><span className="text-muted-foreground">Healthy</span></span>
              <span className="ml-auto tabular-nums text-muted-foreground"><b className="text-foreground">{expiringThisMonth}</b> expiring in 30 days · <b className="text-red-600 dark:text-red-400">{expiringCritical}</b> critical</span>
            </div>
            <div className="h-[14.375rem] min-h-[13.75rem] w-full flex-1" role="img" aria-label="Certificates expiring stacked area chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#E5E7EB" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 10 }} width={26} allowDecimals={false} />
                  <Tooltip cursor={{ stroke: "#94A3B8" }} contentStyle={{ background: "#0f172a", border: 0, borderRadius: 8, color: "#fff", fontSize: 12 }} labelStyle={{ color: "#fff" }} />
                  <Area type="monotone" dataKey="expired" name="Expired" stackId="1" stroke="#DC2626" fill="#DC2626" fillOpacity={0.85} />
                  <Area type="monotone" dataKey="critical" name="Critical" stackId="1" stroke="#EA580C" fill="#EA580C" fillOpacity={0.85} />
                  <Area type="monotone" dataKey="soon" name="Expiring soon" stackId="1" stroke="#D97706" fill="#D97706" fillOpacity={0.85} />
                  <Area type="monotone" dataKey="healthy" name="Healthy" stackId="1" stroke="#16A34A" fill="#16A34A" fillOpacity={0.85} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Certificates by Status" className="xl:col-span-4" actions={<CardKebab label="Certificates by status" />}>
          <div className="flex flex-1 items-center gap-4">
            <div className="relative h-[8.125rem] min-h-[8.125rem] w-[8.125rem] shrink-0" role="img" aria-label={`Status breakdown: ${statusData.map((s) => `${s.name} ${s.value}`).join(", ")}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" innerRadius="62%" outerRadius="100%" startAngle={90} endAngle={-270} paddingAngle={2}>
                    {statusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", border: 0, borderRadius: 8, color: "#fff", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className="font-display text-[1.25rem] leading-none text-foreground tabular-nums">{summary.total}</b><span className="mt-1 text-[0.625rem] uppercase tracking-wide text-muted-foreground">certs</span></div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
              {statusData.map((entry) => {
                const total = Math.max(1, statusData.reduce((acc, s) => acc + s.value, 0));
                return (
                  <li key={entry.name} className="flex items-center gap-2">
                    <i className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-muted-foreground">{entry.name}</span>
                    <b className="tabular-nums text-foreground">{entry.value}</b>
                    <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round((entry.value / total) * 100)}%</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">All certs in scope · revoked included</p>
        </ChartCard>
      </section>

      {/* Row B - issuers, renewal coverage, upcoming */}
      <section className="grid items-stretch gap-4 xl:grid-cols-3">
        <ChartCard title="By Issuer" actions={<CardKebab label="Certificates by issuer" />}>
          <div className="flex flex-1 flex-col justify-between gap-5 pt-1">
            <ul className="flex flex-col gap-3">
              {issuerData.map((entry) => (
                <li key={entry.issuer} className="flex items-center gap-2 text-sm">
                  <span className="w-28 shrink-0 truncate text-xs font-medium text-foreground" title={entry.issuer}>{entry.issuer}</span>
                  <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted"><div className={cn("h-full rounded-sm", entry.issuer === "Self-signed" ? "bg-amber-400" : "bg-sky-400")} style={{ width: `${entry.pct}%` }} /></div>
                  <b className="w-6 shrink-0 text-right text-xs tabular-nums text-foreground">{entry.count}</b>
                </li>
              ))}
            </ul>
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trust distribution</p>
              <ul className="mt-2 space-y-2">
                {trustMix.map((item) => (
                  <li key={item.type} className="flex items-center gap-2 text-xs">
                    <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 tabular-nums text-foreground">{item.type}</span>
                    <b className="shrink-0 tabular-nums text-muted-foreground">{item.count}</b>
                    <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">{item.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risk signals</p>
              <ul className="mt-2 space-y-2">
                {[
                  { label: "Self-signed", value: summary.selfSigned, tone: "bg-amber-400", icon: ShieldAlert, text: "text-amber-800 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/30" },
                  { label: "Weak algorithms", value: summary.weak, tone: "bg-red-500", icon: AlertTriangle, text: "text-red-700 dark:text-red-300", bg: "bg-red-50 dark:bg-red-500/10", border: "border-red-200 dark:border-red-500/30" },
                  { label: "Chain invalid", value: 1, tone: "bg-orange-500", icon: CircleAlert, text: "text-orange-800 dark:text-orange-300", bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-200 dark:border-orange-500/30" },
                  { label: "Auto-renew off", value: manualCount, tone: "bg-blue-500", icon: Clock3, text: "text-blue-800 dark:text-blue-300", bg: "bg-blue-50 dark:bg-blue-500/10", border: "border-blue-200 dark:border-blue-500/30" },
                ].map((item) => (
                  <li key={item.label} className={cn("flex items-center gap-2 rounded-lg border p-2", item.border, item.bg)}>
                    <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md", item.tone)} aria-hidden="true"><item.icon size={12} className="text-white" /></span>
                    <span className={cn("min-w-0 flex-1 truncate text-xs font-medium", item.text)}>{item.label}</span>
                    <b className="shrink-0 text-xs tabular-nums text-foreground">{item.value}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-2 border-t border-border pt-3 text-xs text-muted-foreground">Self-signed & weak keys shown with amber/red indicators</p>
        </ChartCard>

        <ChartCard title="Renewal Coverage" actions={<CardKebab label="Renewal coverage" />}>
          <div className="flex flex-1 flex-col justify-between gap-4 pt-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Renewal method split</p>
              <ul className="mt-2 space-y-1.5">
                {renewalMethods.map((item) => (
                  <li key={item.method} className="flex items-center gap-2 text-xs">
                    <span className="w-14 shrink-0 tabular-nums text-muted-foreground">{item.method}</span>
                    <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} /></div>
                    <span className="w-8 shrink-0 text-right tabular-nums text-foreground">{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Auto-renew</span><b className="tabular-nums text-foreground">{summary.total - manualCount} / {summary.total}</b></div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${summary.autoRenewCoveragePct}%` }} /></div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Manual renewal</span><b className="tabular-nums text-amber-700 dark:text-amber-300">{manualCount} certificates</b></div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(manualCount / summary.total) * 100}%` }} /></div>
            </div>
            {nextRenewal && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 size={12} aria-hidden="true" />
                <span>Next deadline:</span>
                <b className="text-foreground">{nextRenewal.cert.id}</b>
                <span className="tabular-nums">{nextRenewal.days < 0 ? "overdue" : `in ${nextRenewal.days}d`}</span>
              </div>
            )}
            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Auto-renew by environment</p>
              <ul className="mt-2 space-y-1.5">
                {envRenewal.map((item) => (
                  <li key={item.env} className="flex items-center gap-2 text-xs">
                    <span className="w-20 shrink-0 text-muted-foreground">{item.env}</span>
                    <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.pct}%` }} /></div>
                    <span className="w-10 shrink-0 text-right tabular-nums text-foreground">{item.auto}/{item.total}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manual renewals due soon</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {manualRenewals.map((cert) => {
                  const days = daysUntilExpiry(cert.expiresAt);
                  return (
                    <li key={cert.id} className="flex items-center gap-2 text-[0.75rem]">
                      <span className="w-16 shrink-0 truncate font-mono text-muted-foreground">{cert.id}</span>
                      <span className="min-w-0 flex-1 truncate text-foreground">{cert.commonName}</span>
                      <span className={cn("shrink-0 tabular-nums font-semibold", days < 0 ? "text-red-600 dark:text-red-400" : days <= 7 ? "text-orange-700 dark:text-orange-400" : "text-amber-700 dark:text-amber-400")}>{days < 0 ? "overdue" : `in ${days}d`}</span>
                    </li>
                  );
                })}
                {manualRenewals.length === 0 && <li className="py-1 text-xs text-muted-foreground">No manual renewals pending.</li>}
              </ul>
            </div>
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 mt-auto"><AlertTriangle size={12} className="mr-1 inline" aria-hidden="true" />{manualCount} certificates need manual renewal before expiry</p>
          </div>
        </ChartCard>

        <ChartCard title="Upcoming Expirations" actions={<CardKebab label="Upcoming expirations" />}>
          <ul className="flex flex-1 flex-col divide-y divide-border">
            {upcoming.map((cert) => {
              const days = daysUntilExpiry(cert.expiresAt);
              return (
                <li key={cert.id}>
                  <button type="button" onClick={() => openDrawer(cert.id)} className="flex w-full items-center gap-2 rounded-md px-1 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${cert.commonName} expires in ${days} days`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[0.8125rem] font-semibold text-foreground">{cert.commonName}</span>
                      <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">{cert.hostIds[0]} · {new Date(cert.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                    </span>
                    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-1 text-xs font-semibold", days <= 7 ? "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300" : days <= 30 ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300")}>in {days}d</span>
                  </button>
                </li>
              );
            })}
            {upcoming.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nothing expires in the next 60 days.</li>}
          </ul>
          <p className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <span>Upcoming <b className="text-foreground">{upcoming.length}</b> in 60 days · <b className="text-orange-700 dark:text-orange-400">{upcoming.filter((c) => daysUntilExpiry(c.expiresAt) <= 7).length}</b> ≤ 7 days</span>
            <ViewAllLink href="/certificates-and-expiration?tab=expiring" label="View all expiring" />
          </p>
        </ChartCard>
      </section>

      {/* Filter card */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((entry) => {
            const count = entry.key === "all" ? summary.total : entry.key === "expired" ? summary.expired : entry.key === "expiring" ? summary.expiring30 : entry.key === "healthy" ? summary.healthy : summary.selfSigned;
            return (
              <button key={entry.key} type="button" role="tab" aria-selected={tab === entry.key} onClick={() => updateParams({ tab: entry.key, page: null })} className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === entry.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
                {entry.label}
                <span className={cn("rounded-full px-1.5 py-0.5 text-xs tabular-nums", tab === entry.key ? "bg-black/15" : "bg-muted")}>{count}</span>
              </button>
            );
          })}
          <span className="ml-auto inline-flex h-9 items-center rounded-lg border border-border px-2.5 text-xs tabular-nums text-muted-foreground">{filteredCerts.length} shown</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-2">
          <div className="relative w-full min-w-[12.5rem] sm:w-auto sm:min-w-[15rem] sm:max-w-xs sm:flex-1">
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => applyFilters({ q: event.target.value || null })} placeholder="domain, host, issuer..." aria-label="Search certificates" className="h-9 pl-9 pr-9 text-sm" />
            <kbd aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[0.75rem] font-medium text-muted-foreground">/</kbd>
          </div>
          <FilterSelect value={statusFilter} onChange={(value) => applyFilters({ status: value })} label="Status" options={["Expired", "Critical", "Expiring soon", "Healthy", "Revoked"]} allLabel="All statuses" />
          <FilterSelect value={issuerFilter} onChange={(value) => applyFilters({ issuer: value })} label="Issuer" options={["Let's Encrypt", "DigiCert", "Sectigo", "Internal CA", "Self-signed"]} allLabel="All issuers" />
          <FilterSelect value={envFilter} onChange={(value) => applyFilters({ env: value })} label="Environment" options={["Production", "Staging", "Development"]} allLabel="All envs" />
          <FilterSelect value={ownerFilter} onChange={(value) => applyFilters({ owner: value })} label="Owner" options={["Sara Iqbal", "Tom Becker", "Marcus Lee", "Priya Nair"]} allLabel="All owners" />
          <FilterSelect value={groupFilter} onChange={(value) => applyFilters({ group: value })} label="Group" options={["database-cluster", "production-web", "edge-locations"]} allLabel="All groups" />
          <FilterSelect value={keyTypeFilter} onChange={(value) => applyFilters({ keyType: value })} label="Key type" options={["RSA", "ECDSA"]} allLabel="All key types" />
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
            <input type="checkbox" checked={autoRenewOff} onChange={(event) => applyFilters({ autorenew: event.target.checked ? "0" : null })} className="h-4 w-4 accent-[var(--primary)]" aria-label="Auto-renew off only" />
            Auto-renew off
          </label>
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
            <input type="checkbox" checked={weakOnly} onChange={(event) => applyFilters({ weak: event.target.checked ? "1" : null })} className="h-4 w-4 accent-[var(--primary)]" aria-label="Weak algorithms only" />
            Weak only
          </label>
          <div className="flex items-center gap-1" role="group" aria-label="Expiring in">
            {(["7D", "30D", "90D"] as const).map((value) => <button key={value} type="button" aria-pressed={range === value} onClick={() => updateParams({ range: value })} className={cn("h-8 rounded-md border px-2 text-xs font-semibold", range === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent")}>{value}</button>)}
          </div>
          <button type="button" onClick={() => setSaveViewOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ListFilter size={13} />Saved views</button>
          {activeFilterCount > 0 && <button type="button" onClick={clearAllFilters} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><FilterX size={13} />Clear all ({activeFilterCount})</button>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {statusFilter !== "all" && <ChipButton label={`Status: ${statusFilter}`} onClear={() => applyFilters({ status: null })} />}
          {issuerFilter !== "all" && <ChipButton label={`Issuer: ${issuerFilter}`} onClear={() => applyFilters({ issuer: null })} />}
          {envFilter !== "all" && <ChipButton label={`Env: ${envFilter}`} onClear={() => applyFilters({ env: null })} />}
          {ownerFilter !== "all" && <ChipButton label={`Owner: ${ownerFilter}`} onClear={() => applyFilters({ owner: null })} />}
          {groupFilter !== "all" && <ChipButton label={`Group: ${groupFilter}`} onClear={() => applyFilters({ group: null })} />}
          {keyTypeFilter !== "all" && <ChipButton label={`Key: ${keyTypeFilter}`} onClear={() => applyFilters({ keyType: null })} />}
          {autoRenewOff && <ChipButton label="Auto-renew off" onClear={() => applyFilters({ autorenew: null })} />}
          {weakOnly && <ChipButton label="Weak algorithms" onClear={() => applyFilters({ weak: null })} />}
          {query && <ChipButton label={`"${query}"`} onClear={() => applyFilters({ q: null })} />}
          <button type="button" onClick={() => updateParams({ compact: compact ? null : "1" })} aria-pressed={compact} className={cn("h-7 rounded-full border px-2.5 text-[0.6875rem] font-semibold", compact ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}>Compact</button>
        </div>
        {savedViews.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-2 text-xs">
            <span className="font-semibold text-muted-foreground">Saved views:</span>
            {savedViews.map((view) => <button key={view.name} type="button" onClick={() => applySavedView(view.patch)} className="rounded-full border border-border px-2.5 py-1 text-[0.6875rem] font-medium text-muted-foreground hover:bg-accent">{view.name}</button>)}
            <button type="button" onClick={() => { try { window.localStorage.removeItem("certs:saved-views:v1"); } catch { /* noop */ } setSavedViews([]); }} className="text-[0.6875rem] text-muted-foreground hover:text-foreground underline">Clear all</button>
          </div>
        )}
      </div>

      {/* Table */}
      <section ref={tableTopRef} aria-label="Certificates inventory" className="scroll-mt-4">
        <Card className="flex min-w-0 flex-col rounded-xl p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold text-foreground">Certificates</p>
            <p className="text-xs text-muted-foreground">Click a row to open the quick drawer</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-[0.8125rem]">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-12 px-2 py-2.5 text-center"><input type="checkbox" aria-label="Select page" className="h-4 w-4 accent-[var(--primary)]" checked={pageRows.length > 0 && pageRows.every((row) => selected.has(row.id))} onChange={toggleSelectPage} /></th>
                  <th className="w-[30%] px-2 py-2.5"><button type="button" onClick={() => toggleSort("commonName")} className="inline-flex items-center gap-1 font-semibold uppercase hover:text-foreground">Certificate {sort.key === "commonName" ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-60" />}</button></th>
                  <th className="w-[12%] px-2 py-2.5 font-semibold">Status</th>
                  <th className="w-[14%] px-2 py-2.5"><button type="button" onClick={() => toggleSort("expiresAt")} className="inline-flex items-center gap-1 font-semibold uppercase hover:text-foreground">Expires {sort.key === "expiresAt" ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-60" />}</button></th>
                  <th className="w-[14%] px-2 py-2.5 font-semibold">Issuer</th>
                  <th className="w-[12%] px-2 py-2.5 font-semibold">Hosts</th>
                  <th className="w-[10%] px-2 py-2.5 font-semibold">Auto-renew</th>
                  <th className="w-[8%] px-2 py-2.5"><button type="button" onClick={() => toggleSort("health")} className="inline-flex items-center gap-1 font-semibold uppercase hover:text-foreground">Health {sort.key === "health" ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-60" />}</button></th>
                  <th className="w-11 px-2 py-2.5 text-right font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((cert) => {
                  const health = certHealth(cert, Date.now());
                  const daysLeft = daysUntilExpiry(cert.expiresAt);
                  const expired = daysLeft < 0;
                  const weak = /sha1/i.test(cert.signatureAlgorithm) || cert.keySize < 2048;
                  const status = expiryStatus(cert.expiresAt, cert.revoked);
                  return (
                    <tr key={cert.id} tabIndex={0} className={cn("group relative cursor-pointer border-b border-border/70 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:bg-slate-50 dark:hover:bg-muted/30", compact ? "h-12" : "h-14")} onClick={() => openDrawer(cert.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDrawer(cert.id); } }}>
                        <td className="relative px-2 py-2 align-middle text-center">
                        <ExpiryStripe expired={expired || status === "Critical"} />
                        <input type="checkbox" aria-label={`Select ${cert.id}`} className="h-4 w-4 accent-[var(--primary)]" checked={selected.has(cert.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleSelect(cert.id)} />
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <p className="font-mono text-[0.6875rem] font-semibold text-muted-foreground">{cert.id}</p>
                        <p className="mt-0.5 truncate text-[0.8125rem] font-medium text-foreground" title={cert.commonName}>{cert.commonName}</p>
                        <p className="mt-0.5 truncate text-[0.6875rem] text-muted-foreground" title={cert.sans.join(", ")}>+{cert.sans.length} SANs · {cert.sans.slice(0, 2).join(", ")}{cert.sans.length > 2 ? "·" : ""}</p>
                      </td>
                      <td className="px-2 py-2 align-middle"><div className="flex flex-col items-start gap-1"><CertStatusBadge status={status} />{(weak || !cert.chainValid) && <span className="flex items-center gap-1 text-[0.625rem] text-red-600 dark:text-red-400">{weak && <AlertTriangle size={10} aria-hidden="true" />}{weak ? "Weak" : "Chain invalid"}</span>}</div></td>
                      <td className="px-2 py-2 align-middle"><DaysLeftBadge daysLeft={daysLeft} revoked={cert.revoked} /><span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">{new Date(cert.expiresAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span></td>
                      <td className="px-2 py-2 align-middle"><span className="block truncate text-[0.8125rem] text-foreground" title={cert.issuer}>{cert.issuer}</span><IssuerTypeBadge type={cert.issuerType} className="mt-0.5" /></td>
                      <td className="px-2 py-2 align-middle"><HostChips hosts={cert.hostIds} /></td>
                      <td className="px-2 py-2 align-middle"><span className="flex items-center gap-1.5">{cert.autoRenew ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400"><CheckCircle2 size={12} aria-hidden="true" />Auto</span> : <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400"><AlertTriangle size={12} aria-hidden="true" />Manual</span>}</span><span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">{cert.ownerId}</span></td>
                      <td className="px-2 py-2 align-middle"><HealthBar score={health} /></td>
                      <td className="px-2 py-2 align-middle text-right" onClick={(event) => event.stopPropagation()}>
                        <AlertMenu label={`Actions for ${cert.id}`} align="end" trigger={<button type="button" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Actions for ${cert.id}`}><MoreVertical size={15} /></button>} items={[
                          { key: "view", label: "View details", onSelect: () => openDrawer(cert.id) },
                          { key: "renew", label: "Renew now", onSelect: () => setRenewFor(cert.id) },
                          { key: "toggle", label: cert.autoRenew ? "Disable auto-renew" : "Enable auto-renew", onSelect: () => setAutoRenewFor(cert.id) },
                          { key: "assign", label: "Assign owner", onSelect: () => setAssignFor(cert.id) },
                          { key: "download", label: "Download PEM", onSelect: () => downloadPem(cert) },
                          { key: "fingerprint", label: "Copy fingerprint", onSelect: () => { try { void navigator.clipboard?.writeText(cert.fingerprintSha256); notify({ message: "Fingerprint copied" }); } catch { notify({ message: "Clipboard unavailable" }); } } },
                          { key: "revoke", label: "Revoke certificate", danger: true, onSelect: () => setRevokeFor(cert.id) },
                          { key: "copy", label: "Copy link", onSelect: () => { try { void navigator.clipboard?.writeText(`${window.location.origin}/certificates-and-expiration/${cert.id}`); notify({ message: "Link copied" }); } catch { notify({ message: "Clipboard unavailable" }); } } },
                        ]} />
                      </td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center"><SearchX className="mx-auto text-muted-foreground" size={26} /><p className="mt-2 text-sm font-semibold text-foreground">No certificates match your filters</p><p className="mt-1 text-xs text-muted-foreground">Try removing a filter or clearing the search.</p><Button variant="outline" size="sm" className="mt-3" onClick={clearAllFilters}><RotateCcw size={13} />Clear filters</Button></td></tr>
                )}
              </tbody>
            </table>
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-t border-border bg-primary/5 px-4 py-2 text-sm">
              <b className="tabular-nums text-foreground">{selected.size} selected</b>
              <div className="flex flex-wrap items-center gap-1">
                <button type="button" onClick={() => setRenewFor("__bulk__")} className="h-8 rounded-md px-2.5 text-xs font-semibold text-primary hover:bg-primary/10">Renew</button>
                <button type="button" onClick={() => setAssignFor("__bulk__")} className="h-8 rounded-md px-2.5 text-xs font-semibold text-primary hover:bg-primary/10">Assign owner</button>
                <button type="button" onClick={() => setAutoRenewFor("__bulk__")} className="h-8 rounded-md px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent">Enable auto-renew</button>
                <button type="button" onClick={() => { exportCsv(certs.filter((cert) => selected.has(cert.id))); notify({ message: `${selected.size} rows exported as CSV` }); setSelected(new Set()); }} className="h-8 rounded-md px-2.5 text-xs font-semibold text-primary hover:bg-primary/10">Export</button>
              </div>
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground">Clear selection</button>
            </div>
          )}

          <Pagination page={clampedPage} pageSize={pageSize} totalItems={filteredCerts.length} onPageChange={(next) => updateParams({ page: String(next) })} onPageSizeChange={(size) => { setPageSize(size); updateParams({ page: null }); }} noun="certificates" pageSizeOptions={[10, 25, 50]} />
        </Card>
      </section>

      <CertQuickDrawer
        certId={drawerCert}
        onClose={closeDrawer}
        onRenew={(id) => { closeDrawer(); setRenewFor(id); }}
        onRevoke={(id) => { closeDrawer(); setRevokeFor(id); }}
        onToggleAutoRenew={(id) => { closeDrawer(); setAutoRenewFor(id); }}
        onAssign={(id) => { closeDrawer(); setAssignFor(id); }}
      />

      <ScanCertificatesModal open={scanOpen} onOpenChange={setScanOpen} onDone={(result) => { notify(result); reload(); }} />
      <AddCertificateDialog open={addOpen} onOpenChange={setAddOpen} onDone={(result) => { notify(result); reload(); }} />
      <RenewCertificateDialog open={renewFor != null} onOpenChange={(open) => { if (!open) setRenewFor(null); }} certId={renewFor === "__bulk__" ? "__bulk__" : renewFor} onDone={(result) => { notify(result); reload(); }} />
      <RevokeCertificateDialog open={revokeFor != null} onOpenChange={(open) => { if (!open) setRevokeFor(null); }} certId={revokeFor} onDone={(result) => { notify(result); reload(); }} />
      <AssignCertOwnerDialog open={assignFor != null} onOpenChange={(open) => { if (!open) setAssignFor(null); }} certId={assignFor === "__bulk__" ? "__bulk__" : assignFor} onDone={(result) => { notify(result); reload(); }} />
      <ToggleAutoRenewDialog open={autoRenewFor != null} onOpenChange={(open) => { if (!open) setAutoRenewFor(null); }} certId={autoRenewFor === "__bulk__" ? "__bulk__" : autoRenewFor} current={false} onDone={(result) => { notify(result); reload(); }} />

      <AuthToast toast={toast} onDismiss={dismiss} />

      <SaveViewDialog open={saveViewOpen} name={saveViewName} setName={setSaveViewName} onCancel={() => setSaveViewOpen(false)} onSave={saveCurrentView} />
    </div>
  );
}

/* ------------------------------ sub components ----------------------------- */

function FilterSelect({ value, onChange, label, options, allLabel }: { value: string; onChange: (value: string) => void; label: string; options: string[]; allLabel: string }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className="h-9 max-w-[10rem] rounded-md border border-input bg-card px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
      <option value="all">{allLabel}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function ChipButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button type="button" onClick={onClear} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2 text-[0.6875rem] font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {label}<X size={11} aria-hidden="true" />
    </button>
  );
}

function CardKebab({ label, onExport }: { label: string; onExport?: () => void }) {
  return (
    <AlertMenu
      label={`${label} actions`}
      trigger={<button type="button" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${label} actions`}><MoreVertical size={15} /></button>}
      items={[{ key: "export", label: "Export CSV", onSelect: onExport ?? (() => undefined) }, { key: "table", label: "View as table", onSelect: onExport ?? (() => undefined) }]}
    />
  );
}

function SaveViewDialog({ open, name, setName, onCancel, onSave }: { open: boolean; name: string; setName: (value: string) => void; onCancel: () => void; onSave: () => void }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Save current view" className="fixed inset-0 z-[1200] grid place-items-center bg-black/40">
      <div className="w-[min(26.25rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-5 shadow-2xl">
        <h2 className="font-display text-base font-bold text-foreground">Save current view</h2>
        <p className="mt-1 text-xs text-muted-foreground">Stores the active filters as a named view in this browser.</p>
        <label className="mt-3 flex flex-col gap-1.5 text-sm font-medium">
          View name
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSave(); if (event.key === "Escape") onCancel(); }} placeholder="e.g. Expiring soon — internal CA" aria-label="View name" className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSave} disabled={name.trim().length === 0}>Save view</Button>
        </div>
      </div>
    </div>
  );
}
