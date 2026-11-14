"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ArrowRight, Check, CheckCircle2, ChevronRight, Copy, FileCog, FileDiff,
  Filter, Globe, Laptop, Monitor, MoreVertical, RotateCcw, ScanLine, Search, SearchX, ShieldCheck, ShieldAlert,
  ExternalLink, ListFilter, X, Bug, Eye, Timer, CircleAlert,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { ChartCard, SegmentedControl } from "@/components/logs/primitives";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/shared/pagination";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { ViewAllLink } from "@/components/shared/view-all-link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ApproveChangeDialog, RejectChangeDialog, MarkExpectedDialog, AcceptBaselineDialog, RollbackDialog,
  RunDriftScanDialog, AuthToast, useAuthToast,
} from "@/components/config-changes/config-actions";
import { CreateIncidentDialog } from "@/components/auth-events/auth-actions";
import { AuthCardMenu, timeAgo, fullTime, dateTimeShort, timeZoneLabel, targetHref, RiskScoreBar } from "@/components/auth-events/auth-shared";
import { ConfigRiskBadge, ApprovalBadge, ConfigSourceBadge, ConfigStatusBadge, ChangeTypeBadge, OsIcon } from "@/components/shared/change-badges";
import { diffSummary, splitPath } from "@/components/config-changes/config-shared";
import { cn } from "@/lib/utils";
import {
  CONFIG_APPROVAL_MIX, CONFIG_CATEGORY_MIX, CONFIG_COMPLIANCE, CONFIG_INCIDENT_LINKS,
  CONFIG_SOURCE_MIX, CONFIG_WINDOW_MARKERS,
  approveConfigChange, configSnapshotsFor, configTrendBuckets, getConfigSummary, loadConfigChanges,
  markConfigExpected, rejectConfigChange,
} from "@/mocks/security";

type TableTab = "all" | "unapproved" | "drift" | "highrisk" | "rolledback";
type SortKey = "detectedAt" | "riskScore" | "approvalStatus";
type SortDir = "asc" | "desc";
type RangeKey = "1H" | "24H" | "7D" | "30D";
type ChartMode = "approval" | "category" | "source";

const RANGE_MS: Record<RangeKey, number> = { "1H": 3_600_000, "24H": 86_400_000, "7D": 7 * 86_400_000, "30D": 30 * 86_400_000 };

const TABS: Array<{ key: TableTab; label: string }> = [
  { key: "all", label: "All" },
  { key: "unapproved", label: "Unapproved" },
  { key: "drift", label: "Drift" },
  { key: "highrisk", label: "High risk" },
  { key: "rolledback", label: "Rolled back" },
];

const savedViewsBuiltin: Array<{ name: string; patch: Record<string, string | null> }> = [
  { name: "Unapproved", patch: { tab: "unapproved" } },
  { name: "High risk", patch: { tab: "highrisk" } },
  { name: "Drift", patch: { tab: "drift" } },
  { name: "SSH/Firewall", patch: { category: "SSH/Auth" } },
  { name: "Outside maintenance window", patch: { window: "none" } },
];
const SAVED_VIEWS_KEY = "config-changes:saved-views:v1";

function loadSavedViews(): Array<{ name: string; patch: Record<string, string | null> }> {
  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is { name: string; patch: Record<string, string | null> } =>
      typeof item === "object" && item != null && typeof (item as { name?: unknown }).name === "string");
  } catch {
    return [];
  }
}

function persistSavedViews(views: Array<{ name: string; patch: Record<string, string | null> }>): boolean {
  try {
    window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
    return true;
  } catch {
    return false;
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  "Packages": "#60A5FA",
  "Network/Firewall": "#F87171",
  "Services": "#A78BFA",
  "Files": "#94A3B8",
  "SSH/Auth": "#FBBF24",
  "Registry": "#34D399",
  "Users/Groups": "#F472B6",
  "Kernel/OS": "#FB923C",
  "Cron/Scheduled": "#38BDF8",
};

function bucketWindow(range: "24H" | "7D" | "30D", index: number): { start: number; end: number; label: string } {
  const now = Date.now();
  if (range === "24H") {
    const hour = new Date(); hour.setMinutes(0, 0, 0);
    const start = hour.getTime() - (23 - index) * 3_600_000;
    return { start, end: start + 3_600_000, label: new Date(start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }) };
  }
  const count = range === "7D" ? 7 : 30;
  const start = now - (count - 1 - index) * 86_400_000;
  return { start, end: index === count - 1 ? now + 1 : start + 86_400_000, label: new Date(start).toLocaleDateString(undefined, { month: "short", day: "numeric" }) };
}

export function ConfigChangesDashboard() {
  const summary = getConfigSummary();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = (searchParams.get("tab") ?? "all") as TableTab;
  const riskFilter = searchParams.get("risk") ?? "all";
  const approvalFilter = searchParams.get("approval") ?? "all";
  const categoryFilter = searchParams.get("category") ?? "all";
  const sourceFilter = searchParams.get("source") ?? "all";
  const assetFilter = searchParams.get("asset") ?? "all";
  const groupFilter = searchParams.get("group") ?? "all";
  const changedByFilter = searchParams.get("changedBy") ?? "all";
  const statusFilter = searchParams.get("status") ?? "all";
  const range = (searchParams.get("range") ?? "24H") as RangeKey;
  const query = searchParams.get("q") ?? "";
  const windowFilter = searchParams.get("window") ?? "all";
  const bucketParam = searchParams.get("bucket") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const compact = searchParams.get("compact") === "1";
  const utc = searchParams.get("tz") === "utc";

  const [events, setEvents] = useState<import("@/mocks/security").ConfigChange[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "error" | "success">("loading");
  const [mounted, setMounted] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "detectedAt", dir: "desc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(25);
  const [trendRange, setTrendRange] = useState<"24H" | "7D" | "30D">("24H");
  const [chartMode, setChartMode] = useState<ChartMode>("approval");
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [reviewFilter, setReviewFilter] = useState<"unapproved" | "highrisk">("unapproved");
  const [approveTarget, setApproveTarget] = useState<import("@/mocks/security").ConfigChange | null>(null);
  const [rejectTarget, setRejectTarget] = useState<import("@/mocks/security").ConfigChange | null>(null);
  const [markExpectedTarget, setMarkExpectedTarget] = useState<import("@/mocks/security").ConfigChange | null>(null);
  const [acceptBaselineTarget, setAcceptBaselineTarget] = useState<import("@/mocks/security").ConfigChange | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<import("@/mocks/security").ConfigChange | null>(null);
  const [incidentTarget, setIncidentTarget] = useState<{ title: string; impact: string; hosts?: string[]; changeId: string } | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [savedViews, setSavedViews] = useState<Array<{ name: string; patch: Record<string, string | null> }>>([]);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const tableTopRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const { toast, notify, dismiss } = useAuthToast();

  const load = useCallback(() => {
    setLoadState("loading");
    const forcedError = typeof window !== "undefined" && window.location.search.includes("configError=1");
    const timer = window.setTimeout(() => {
      if (forcedError) { setLoadState("error"); return; }
      loadConfigChanges()
        .then((loaded) => { setEvents(loaded); setLoadState("success"); setLastUpdated(new Date()); })
        .catch(() => setLoadState("error"));
    }, 220);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => load(), [load]);
  useEffect(() => { setMounted(true); setSavedViews(loadSavedViews()); }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (event.key === "/" && tag !== "input" && tag !== "textarea" && tag !== "select" && !target?.isContentEditable) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const activeBucket = useMemo(() => {
    const [rangeTag, indexRaw] = bucketParam.split(":");
    const index = Number(indexRaw);
    if (!Number.isFinite(index) || (rangeTag !== "24H" && rangeTag !== "7D" && rangeTag !== "30D")) return null;
    if (rangeTag !== trendRange) return null;
    return { range: rangeTag as "24H" | "7D" | "30D", index, ...bucketWindow(rangeTag as "24H" | "7D" | "30D", index) };
  }, [bucketParam, trendRange]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const list = events.filter((change) => {
      if (tab === "unapproved" && change.approvalStatus !== "Unapproved") return false;
      if (tab === "drift" && !change.driftFromBaseline) return false;
      if (tab === "highrisk" && change.risk !== "Critical" && change.risk !== "High") return false;
      if (tab === "rolledback" && change.status !== "Rolled back") return false;
      if (riskFilter !== "all" && (riskFilter === "low" ? change.risk !== "Low" : riskFilter === "medium" ? change.risk !== "Medium" : change.risk !== (riskFilter === "high" ? "High" : "Critical"))) return false;
      if (approvalFilter !== "all" && change.approvalStatus !== approvalFilter) return false;
      if (categoryFilter !== "all" && change.category !== categoryFilter) return false;
      if (sourceFilter !== "all" && change.source !== sourceFilter) return false;
      if (assetFilter !== "all" && change.assetId !== assetFilter) return false;
      if (groupFilter !== "all" && change.group !== groupFilter) return false;
      if (changedByFilter !== "all" && change.changedBy !== changedByFilter) return false;
      if (statusFilter !== "all" && change.status !== statusFilter) return false;
      if (windowFilter === "none" && change.maintenanceWindowId != null) return false;
      if (range && now - Date.parse(change.detectedAt) > RANGE_MS[range]) return false;
      if (activeBucket) {
        const at = Date.parse(change.detectedAt);
        if (at < activeBucket.start || at >= activeBucket.end) return false;
      }
      if (query) {
        const haystack = `${change.id} ${change.assetId} ${change.assetName} ${change.path} ${change.changedBy} ${change.ticket ?? ""} ${change.category} ${change.group} ${change.source} ${change.approvalStatus}`.toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort.key === "detectedAt") return (Date.parse(a.detectedAt) - Date.parse(b.detectedAt)) * dir;
      if (sort.key === "riskScore") return (a.riskScore - b.riskScore) * dir;
      return a.approvalStatus.localeCompare(b.approvalStatus) * dir;
    });
  }, [events, tab, riskFilter, approvalFilter, categoryFilter, sourceFilter, assetFilter, groupFilter, changedByFilter, statusFilter, windowFilter, range, activeBucket, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageStart = (clampedPage - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  const tabCounts = {
    all: summary.total24h,
    unapproved: summary.unapproved,
    drift: 46,
    highrisk: summary.highCriticalRisk,
    rolledback: summary.rolledBack,
  };

  const trendBuckets = useMemo(() => configTrendBuckets(trendRange), [trendRange]);
  const peakApprovalBucket = useMemo(() => trendBuckets.reduce((best, bucket) => (bucket.total > best.total ? bucket : best), trendBuckets[0]), [trendBuckets]);

  const needsReview = useMemo(
    () => events.filter((change) => change.approvalStatus === "Unapproved" || change.approvalStatus === "Pending" || change.risk === "Critical" || change.risk === "High")
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 6),
    [events],
  );

  const topAssets = useMemo(() => {
    const counts = new Map<string, { assetId: string; assetOs: string; group: string; total: number; unapproved: number; last: string }>();
    for (const change of events) {
      const current = counts.get(change.assetId) ?? { assetId: change.assetId, assetOs: change.assetOs, group: change.group, total: 0, unapproved: 0, last: change.detectedAt };
      current.total += 1;
      if (change.approvalStatus === "Unapproved") current.unapproved += 1;
      if (Date.parse(change.detectedAt) > Date.parse(current.last)) current.last = change.detectedAt;
      counts.set(change.assetId, current);
    }
    return [...counts.values()].sort((a, b) => b.total - a.total).slice(0, 6);
  }, [events]);

  const groupDrift = useMemo(() => {
    const byGroup = new Map<string, { group: string; total: number; drifted: number; worst: number }>();
    for (const change of events) {
      if (!change.driftFromBaseline) continue;
      const current = byGroup.get(change.group) ?? { group: change.group, total: 0, drifted: 0, worst: 0 };
      current.drifted += 1;
      current.worst = Math.max(current.worst, change.riskScore);
      byGroup.set(change.group, current);
    }
    for (const change of events) {
      const current = byGroup.get(change.group);
      if (current) current.total += 1;
    }
    return [...byGroup.values()].sort((a, b) => b.drifted - a.drifted).slice(0, 6);
  }, [events]);

  const exportCsv = useCallback((rows: typeof events) => {
    const header = ["id", "detectedAt", "assetId", "group", "category", "path", "changeType", "source", "changedBy", "approvalStatus", "ticket", "maintenanceWindowId", "risk", "riskScore", "driftFromBaseline", "status"];
    const escapeCsv = (value: string) => (/[",\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value);
    const lines = [header.join(",")];
    for (const change of rows) {
      lines.push([
        change.id, change.detectedAt, change.assetId, change.group, change.category, change.path, change.changeType,
        change.source, change.changedBy, change.approvalStatus, change.ticket ?? "", change.maintenanceWindowId ?? "",
        change.risk, String(change.riskScore), String(change.driftFromBaseline), change.status,
      ].map((value) => escapeCsv(String(value))).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `config-changes-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportJson = useCallback((rows: typeof events) => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `config-changes-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExport = useCallback((kind: "csv" | "json") => {
    try {
      if (kind === "csv") exportCsv(filtered); else exportJson(filtered);
      notify({ message: `${filtered.length.toLocaleString()} changes exported as ${kind.toUpperCase()}` });
    } catch {
      notify({ message: "Export failed in this browser context" });
    }
  }, [exportCsv, exportJson, filtered, notify]);

  const toggleSeries = useCallback((name: string) => {
    setHiddenSeries((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const openEvent = useCallback((changeId: string) => {
    sessionStorage.setItem("config-changes:scroll", String(window.scrollY));
    router.push(`/configuration-changes/${changeId}`);
  }, [router]);

  const applySavedView = useCallback((patch: Record<string, string | null>) => applyFilters({ ...patch, page: null }), [applyFilters]);

  const saveCurrentView = useCallback(() => {
    const name = saveViewName.trim();
    if (!name) return;
    const patch: Record<string, string | null> = {};
    if (tab !== "all") patch.tab = tab;
    if (riskFilter !== "all") patch.risk = riskFilter;
    if (approvalFilter !== "all") patch.approval = approvalFilter;
    if (categoryFilter !== "all") patch.category = categoryFilter;
    if (sourceFilter !== "all") patch.source = sourceFilter;
    if (assetFilter !== "all") patch.asset = assetFilter;
    if (groupFilter !== "all") patch.group = groupFilter;
    if (changedByFilter !== "all") patch.changedBy = changedByFilter;
    if (statusFilter !== "all") patch.status = statusFilter;
    if (range !== "24H") patch.range = range;
    if (query) patch.q = query;
    if (windowFilter !== "all") patch.window = windowFilter;
    const next = [...savedViews.filter((view) => view.name !== name), { name, patch }];
    if (persistSavedViews(next)) {
      setSavedViews(next);
      notify({ message: `View "${name}" saved` });
    } else {
      notify({ message: "Could not persist the view (localStorage unavailable)" });
    }
    setSaveViewOpen(false);
    setSaveViewName("");
  }, [approvalFilter, assetFilter, categoryFilter, changedByFilter, groupFilter, notify, query, range, riskFilter, savedViews, saveViewName, sourceFilter, statusFilter, tab, windowFilter]);

  const toggleSort = useCallback((key: SortKey) => {
    setSort((current) => current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectPage = useCallback(() => {
    setSelected((current) => {
      const pageIds = pageRows.map((row) => row.id);
      const allSelected = pageIds.every((id) => current.has(id));
      const next = new Set(current);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }, [pageRows]);

  const bulkApprove = useCallback(() => {
    const chosen = events.filter((change) => selected.has(change.id) && change.approvalStatus !== "Approved");
    for (const change of chosen) {
      approveConfigChange(change.id, { ticket: change.ticket, reason: "Bulk approved from Configuration Changes" });
    }
    setEvents((current) => current.map((change) => selected.has(change.id) && change.approvalStatus !== "Approved" ? { ...change, approvalStatus: "Approved", approvedBy: "Ayesha Khan", status: "Reviewed" } : change));
    notify({ message: `${chosen.length} ${chosen.length === 1 ? "change" : "changes"} approved` });
    setSelected(new Set());
  }, [events, notify, selected]);

  const bulkReject = useCallback(() => {
    const chosen = events.filter((change) => selected.has(change.id));
    for (const change of chosen) {
      // Import lazily typed to keep the top import list focused; direct static import below.
      rejectConfigChange(change.id, { reason: "Bulk rejected from Configuration Changes", createRollback: false });
    }
    setEvents((current) => current.map((change) => selected.has(change.id) ? { ...change, approvalStatus: "Unapproved", status: "Reverted" } : change));
    notify({ message: `${chosen.length} ${chosen.length === 1 ? "change" : "changes"} rejected` });
    setSelected(new Set());
  }, [events, notify, selected]);

  const bulkMarkExpected = useCallback(() => {
    const chosen = events.filter((change) => selected.has(change.id));
    for (const change of chosen) {
      markConfigExpected(change.id, { reason: "Bulk marked expected from Configuration Changes", expiresAt: null });
    }
    setEvents((current) => current.map((change) => selected.has(change.id) ? { ...change, approvalStatus: "Expected", driftFromBaseline: false, status: "Reviewed" } : change));
    notify({ message: `${chosen.length} ${chosen.length === 1 ? "change" : "changes"} marked as expected` });
    setSelected(new Set());
  }, [events, notify, selected]);

  const bulkExport = useCallback(() => {
    const chosen = events.filter((change) => selected.has(change.id));
    if (chosen.length === 0) return;
    try {
      exportCsv(chosen);
      notify({ message: `${chosen.length} ${chosen.length === 1 ? "change" : "changes"} exported as CSV` });
    } catch {
      notify({ message: "Export failed in this browser context" });
    }
  }, [events, exportCsv, notify, selected]);

  const copyLink = useCallback((id: string) => {
    try {
      void navigator.clipboard?.writeText(`${window.location.origin}/configuration-changes/${id}`);
      notify({ message: "Change link copied" });
    } catch {
      notify({ message: "Clipboard unavailable in this context" });
    }
  }, [notify]);

  const selectionCount = selected.size;
  const bannerCount = summary.unapproved + summary.driftedAssets + summary.highCriticalRisk;
  const activeFilterCount = [riskFilter, approvalFilter, categoryFilter, sourceFilter, assetFilter, groupFilter, changedByFilter, statusFilter, windowFilter].filter((value) => value !== "all").length + (query ? 1 : 0) + (activeBucket ? 1 : 0);

  if (loadState === "loading") {
    return (
      <div className="space-y-4 pb-4" aria-busy="true">
        <div className="h-[5.75rem] animate-pulse rounded-xl bg-muted" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />)}</div>
        <div className="grid items-stretch gap-4 xl:grid-cols-12"><div className="h-[21.25rem] animate-pulse rounded-xl bg-muted xl:col-span-8" /><div className="h-[21.25rem] animate-pulse rounded-xl bg-muted xl:col-span-4" /></div>
        <div className="h-[15rem] animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Security", "Configuration Changes"]} title="Configuration Changes" subtitle="Track configuration drift and changes across managed hosts." />
        <Card className="grid min-h-[20rem] place-items-center rounded-xl p-6">
          <div className="text-center">
            <CircleAlert className="mx-auto text-rose-500" size={28} />
            <h2 className="mt-2 text-base font-semibold">Configuration changes could not be loaded</h2>
            <p className="mt-1 text-sm text-muted-foreground">Retry to reload changes and baselines.</p>
            <Button className="mt-4" onClick={load}><RotateCcw size={15} />Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  const bannerRed = summary.unapproved > 0 || summary.highCriticalRisk > 0;
  return (
    <div className="min-w-0 space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Security", "Configuration Changes"]}
        title="Configuration Changes"
        subtitle="Track configuration drift and changes across managed hosts."
        lastUpdated={lastUpdated.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        onRefresh={load}
        actions={
          <div className="flex items-center gap-2">
            <AlertMenu
              label="Export configuration changes"
              trigger={<Button variant="outline" className="h-10 gap-1.5 text-sm"><FileCog size={15} />Export</Button>}
              items={[
                { key: "csv", label: "CSV (filtered)", onSelect: () => handleExport("csv") },
                { key: "json", label: "JSON (filtered)", onSelect: () => handleExport("json") },
              ]}
            />
            <Button className="h-10 gap-1.5 text-sm" onClick={() => setScanOpen(true)}><ScanLine size={15} />Run Drift Scan</Button>
          </div>
        }
      />

      {bannerRed ? (
        <div role="status" className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} aria-hidden="true" />{summary.unapproved} unapproved changes</span>
            <span className="hidden sm:inline" aria-hidden="true">·</span>
            <span>{summary.highCriticalRisk} high risk</span>
            <span className="hidden sm:inline" aria-hidden="true">·</span>
            <span>{summary.driftedAssets} assets drifted from baseline</span>
          </span>
          <button type="button" onClick={() => { applyFilters({ tab: "unapproved" }); tableTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="shrink-0 font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
            Review unapproved <ChevronRight size={14} className="inline" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div role="status" className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
          <span className="flex items-center gap-2"><ShieldCheck size={16} aria-hidden="true" />All changes approved, no drift detected</span>
          <span className="text-xs">Last full scan 35 min ago</span>
        </div>
      )}

      {/* Stat cards */}
      <section aria-label="Configuration change KPIs" className="grid grid-cols-2 items-stretch gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={<FileDiff size={19} />} label="Total Changes (24h)" value={summary.total24h.toLocaleString()} delta={summary.deltas.total} deltaPercent={summary.deltas.totalPct} goodDirection="up" iconTone="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" className="min-h-[7rem]" detail="in the last 24h" />
        <StatCard icon={<AlertTriangle size={19} />} label="Unapproved" value={String(summary.unapproved)} delta={summary.deltas.unapproved} deltaPercent="+2 today" goodDirection="down" iconTone="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" className="min-h-[7rem]" detail="awaiting review" onClick={() => applyFilters({ tab: "unapproved" })} onClickLabel="Show unapproved changes" />
        <StatCard icon={<Globe size={19} />} label="Drifted Assets" value={String(summary.driftedAssets)} delta={summary.deltas.driftedAssets} deltaPercent="+1 today" goodDirection="down" iconTone="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" className="min-h-[7rem]" detail="off approved baseline" onClick={() => applyFilters({ tab: "drift" })} onClickLabel="Show drifted changes" />
        <StatCard icon={<ShieldAlert size={19} />} label="High / Critical Risk" value={String(summary.highCriticalRisk)} delta={summary.deltas.highCriticalRisk} deltaPercent="-3 vs yesterday" goodDirection="down" iconTone="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" className="min-h-[7rem]" detail="in the last 24h" onClick={() => applyFilters({ tab: "highrisk" })} onClickLabel="Show high risk changes" />
        <StatCard icon={<RotateCcw size={19} />} label="Rolled Back" value={String(summary.rolledBack)} delta={summary.deltas.rolledBack} deltaPercent="+1 today" goodDirection="down" iconTone="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" className="min-h-[7rem]" detail="in the last 24h" onClick={() => applyFilters({ tab: "rolledback" })} onClickLabel="Show rolled back changes" />
        <StatCard icon={<CheckCircle2 size={19} />} label="Baseline Compliance" value={`${summary.compliancePct}%`} delta={summary.deltas.compliance} deltaPercent="+1.4 pts" goodDirection="up" iconTone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" className="min-h-[7rem]" detail="CIS Ubuntu 22.04" />
      </section>

      {/* Row 1 - timeline chart + needs review */}
      <section className="grid items-stretch gap-4 xl:grid-cols-12">
        <ChartCard
          title="Change Timeline"
          className="xl:col-span-8"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl value={trendRange} options={["24H", "7D", "30D"]} onChange={(value) => setTrendRange(value as "24H" | "7D" | "30D")} />
              <SegmentedControl value={chartMode} options={["Approval", "Category", "Source"]} onChange={(value) => setChartMode(value.toLowerCase() as ChartMode)} />
              <AuthCardMenu label="Change timeline" onExport={() => handleExport("csv")} />
            </div>
          }
        >
          <ChangeTimelineChart
            mode={chartMode}
            buckets={trendBuckets}
            hidden={hiddenSeries}
            windowMarkers={CONFIG_WINDOW_MARKERS}
            onBarClick={(index) => updateParams({ bucket: `${trendRange}:${index}`, page: null })}
          />
          {chartMode === "approval" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Toggle approval series">
              {[
                { name: "Approved", count: CONFIG_APPROVAL_MIX.approved, color: "#34D399" },
                { name: "Unapproved", count: CONFIG_APPROVAL_MIX.unapproved, color: "#F87171" },
                { name: "Pending", count: CONFIG_APPROVAL_MIX.pending, color: "#FBBF24" },
                { name: "Expected", count: CONFIG_APPROVAL_MIX.expected, color: "#94A3B8" },
              ].map((entry) => {
                const active = !hiddenSeries.has(entry.name);
                return (
                  <button key={entry.name} type="button" onClick={() => toggleSeries(entry.name)} aria-pressed={active} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-border bg-card text-foreground" : "border-border/60 bg-muted/40 text-muted-foreground opacity-60")}>
                    <i className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                    {entry.name} <b className="tabular-nums">{entry.count}</b>
                  </button>
                );
              })}
              <span className="ml-auto text-xs text-muted-foreground">Bar click filters the table below</span>
            </div>
          )}
          {chartMode === "category" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Toggle category series">
              {CONFIG_CATEGORY_MIX.map(([category, count]) => {
                const active = !hiddenSeries.has(category);
                return (
                  <button key={category} type="button" onClick={() => toggleSeries(category)} aria-pressed={active} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-border bg-card text-foreground" : "border-border/60 bg-muted/40 text-muted-foreground opacity-60")}>
                    <i className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[category] }} aria-hidden="true" />
                    {category} <b className="tabular-nums">{count}</b>
                  </button>
                );
              })}
            </div>
          )}
          {chartMode === "source" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Toggle source series">
              {CONFIG_SOURCE_MIX.map(([source, count]) => {
                const active = !hiddenSeries.has(source);
                const color = { "Manual": "#60A5FA", "Automation/IaC": "#A78BFA", "Agent-detected": "#FBBF24", "Patch": "#34D399" }[source];
                return (
                  <button key={source} type="button" onClick={() => toggleSeries(source)} aria-pressed={active} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-border bg-card text-foreground" : "border-border/60 bg-muted/40 text-muted-foreground opacity-60")}>
                    <i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                    {source} <b className="tabular-nums">{count}</b>
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Peak hour</p><p className="mt-0.5 font-semibold text-foreground">{peakApprovalBucket.label} <span className="text-muted-foreground">(+{peakApprovalBucket.total.toLocaleString()})</span></p></div>
            <div><p className="text-xs text-muted-foreground">Unapproved %</p><p className="mt-0.5 font-semibold tabular-nums text-foreground">{((CONFIG_APPROVAL_MIX.unapproved / summary.total24h) * 100).toFixed(1)}%</p></div>
            <div><p className="text-xs text-muted-foreground">In maintenance windows</p><p className="mt-0.5 font-semibold tabular-nums text-foreground">41%</p></div>
            <div><p className="text-xs text-muted-foreground">Avg / hour</p><p className="mt-0.5 font-semibold tabular-nums text-foreground">{(summary.total24h / 24).toFixed(1)}</p></div>
          </div>
        </ChartCard>

        <ChartCard
          title="Needs Review"
          className="xl:col-span-4"
          actions={
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label="Review filter">
                {(["unapproved", "highrisk"] as const).map((value) => (
                  <button key={value} type="button" aria-pressed={reviewFilter === value} onClick={() => setReviewFilter(value)} className={cn("rounded-md px-2.5 py-1 text-xs font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", reviewFilter === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                    {value === "unapproved" ? "Unapproved" : "High risk"}
                  </button>
                ))}
              </div>
              <span className="inline-flex h-7 items-center gap-1 rounded-full bg-rose-100 px-2 text-xs font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"><AlertTriangle size={11} aria-hidden="true" />{summary.unapproved} unapproved</span>
              <AuthCardMenu label="Needs review" onExport={() => handleExport("csv")} />
            </div>
          }
        >
          <ul className="flex flex-1 flex-col divide-y divide-border">
            {needsReview
              .filter((change) => (reviewFilter === "unapproved" ? change.approvalStatus === "Unapproved" || change.approvalStatus === "Pending" : change.risk === "Critical" || change.risk === "High"))
              .slice(0, 6)
              .map((change) => (
                <li key={change.id} className="group relative flex-1">
                  <button type="button" onClick={() => openEvent(change.id)} className="flex h-full w-full items-center gap-2 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40" aria-label={`Open change ${change.id}`}>
                    <ConfigRiskBadge risk={change.risk} className="w-[4.5rem] shrink-0 justify-center" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[0.75rem] font-semibold text-foreground" title={change.path}>{change.path}</span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><b className="shrink-0 text-foreground">{change.assetName}</b><span className="truncate">· {change.changeType} · {change.category}</span></span>
                      <span className="mt-0.5 block text-[0.6875rem] tabular-nums text-muted-foreground">{mounted ? timeAgo(change.detectedAt) : "…"}{change.maintenanceWindowId ? ` · via ${change.maintenanceWindowId}` : " · outside window"}</span>
                    </span>
                    <ApprovalBadge status={change.approvalStatus} className="shrink-0" />
                  </button>
                  <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-border bg-card p-1 shadow group-hover:flex focus-within:flex">
                    <button type="button" title="Approve" aria-label={`Approve ${change.id}`} className="grid h-7 w-7 place-items-center rounded-md text-emerald-600 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-emerald-500/10" onClick={() => setApproveTarget(change)}><Check size={13} /></button>
                    <button type="button" title="Reject" aria-label={`Reject ${change.id}`} className="grid h-7 w-7 place-items-center rounded-md text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-rose-500/10" onClick={() => setRejectTarget(change)}><X size={13} /></button>
                  </div>
                </li>
              ))}
            {needsReview.filter((change) => (reviewFilter === "unapproved" ? change.approvalStatus === "Unapproved" || change.approvalStatus === "Pending" : change.risk === "Critical" || change.risk === "High")).length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-1 text-emerald-500" size={20} />Nothing awaiting review</li>
            )}
          </ul>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
            <div className="rounded-lg bg-rose-50 p-1.5 dark:bg-rose-500/10"><b className="block text-base tabular-nums text-rose-700 dark:text-rose-300">{summary.unapproved}</b><span className="text-[0.6875rem] text-muted-foreground">unapproved</span></div>
            <div className="rounded-lg bg-orange-50 p-1.5 dark:bg-orange-500/10"><b className="block text-base tabular-nums text-orange-700 dark:text-orange-300">{summary.highCriticalRisk}</b><span className="text-[0.6875rem] text-muted-foreground">high / critical</span></div>
            <div className="rounded-lg bg-blue-50 p-1.5 dark:bg-blue-500/10"><b className="block text-base tabular-nums text-blue-700 dark:text-blue-300">{oldestQueueAge(events)}</b><span className="text-[0.6875rem] text-muted-foreground">oldest in queue</span></div>
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <ViewAllLink href="/configuration-changes?tab=unapproved" label="Review all" />
          </div>
        </ChartCard>
      </section>

      {/* Row 2 - donut, drift by group, compliance */}
      <section className="grid items-stretch gap-4 xl:grid-cols-3">
        <ChartCard title="Changes by Type" className="min-h-[24.375rem]" actions={<AuthCardMenu label="Changes by type" onExport={() => handleExport("csv")} />}>
          <div className="flex flex-1 flex-col items-center gap-5">
            <TypeDonut onSelect={(category) => applyFilters({ category })} />
            <ul className="grid w-full grid-cols-3 gap-x-4 gap-y-3 text-sm">
              {CONFIG_CATEGORY_MIX.slice(0, 6).map(([category, count]) => (
                <li key={category}>
                  <button type="button" onClick={() => applyFilters({ category })} className="flex w-full flex-col items-start gap-0.5 rounded-md p-1.5 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Filter by ${category}`}>
                    <span className="flex min-w-0 items-center gap-1.5 text-[0.6875rem] text-muted-foreground"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[category] }} aria-hidden="true" /><span className="truncate">{category}</span></span>
                    <span className="flex w-full items-baseline justify-between gap-2"><b className="tabular-nums text-foreground">{count}</b><span className="text-[0.6875rem] tabular-nums text-muted-foreground">{Math.round((count / summary.total24h) * 100)}%</span></span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-auto w-full border-t border-border pt-3 text-xs text-muted-foreground">Legend rows are clickable · filter the table by category.</p>
          </div>
        </ChartCard>

        <ChartCard title="Drift by Asset Group" actions={<AuthCardMenu label="Drift by asset group" onExport={() => handleExport("csv")} />}>
          <ul className="flex flex-1 flex-col justify-center divide-y divide-border">
            {groupDrift.map((group) => {
              const total = Math.max(group.total, group.drifted);
              const pct = Math.min(100, Math.round((group.drifted / Math.max(1, total)) * 100));
              return (
                <li key={group.group}>
                  <button type="button" onClick={() => applyFilters({ group: group.group })} className="flex w-full items-center gap-2 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1" aria-label={`Filter by group ${group.group}`}>
                    <span className="w-32 shrink-0 truncate text-[0.8125rem] font-medium text-foreground">{group.group}</span>
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.max(12, pct)}%` }} /></div>
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground"><b className="text-foreground">{group.drifted}</b> drifted</span>
                    <span className="hidden w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">worst {group.worst}</span>
                  </button>
                </li>
              );
            })}
            {groupDrift.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No drift in the current window.</li>}
          </ul>
          <p className="mt-2 border-t border-border pt-3 text-xs text-muted-foreground">Groups sourced from Server Groups · <b>{summary.driftedAssetNames.join(", ")}</b></p>
        </ChartCard>

        <ChartCard
          title="Compliance (CIS)"
          actions={<AuthCardMenu label="Compliance" onExport={() => handleExport("csv")} />}
        >
          <div className="flex items-center gap-4">
            <ComplianceGauge pct={summary.compliancePct} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Benchmark</p>
              <p className="font-semibold text-foreground">{CONFIG_COMPLIANCE.benchmark}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{summary.compliancePct}%</p>
              <p className="text-xs text-muted-foreground">{CONFIG_COMPLIANCE.failedRules.length} failing rules</p>
            </div>
          </div>
          <ol className="mt-3 flex flex-1 flex-col divide-y divide-border">
            {CONFIG_COMPLIANCE.failedRules.map((rule) => (
              <li key={rule.id} className="flex items-center gap-2 py-1.5 text-[0.8125rem]">
                <code className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{rule.id}</code>
                <span className="min-w-0 flex-1 truncate text-foreground" title={rule.name}>{rule.name}</span>
                <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{rule.assets} assets</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Benchmark: <b className="text-foreground">{CONFIG_COMPLIANCE.benchmark}</b></p>
            <button type="button" onClick={() => setScanOpen(true)} className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded inline-flex items-center gap-1"><ScanLine size={12} />Run scan</button>
          </div>
        </ChartCard>
      </section>

      {/* Row 3 - top assets, sources, changes ? incidents */}
      <section className="grid items-stretch gap-4 xl:grid-cols-3">
        <ChartCard title="Top Changed Assets" actions={<AuthCardMenu label="Top changed assets" onExport={() => handleExport("csv")} />}>
          <ul className="flex flex-1 flex-col divide-y divide-border">
            {topAssets.map((asset) => {
              const max = topAssets[0]?.total ?? 1;
              const target = { target: asset.assetId, targetKind: "server" as const };
              const href = targetHref(target);
              const inner = (
                <>
                  <OsIcon os={asset.assetOs} className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className="truncate font-mono text-[0.8125rem] font-semibold text-foreground">{asset.assetId}</span>{asset.unapproved > 0 && <span className="inline-flex shrink-0 items-center rounded-full bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{asset.unapproved} unapproved</span>}</span>
                    <span className="mt-0.5 flex items-center gap-2"><span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-blue-500/80" style={{ width: `${Math.round((asset.total / max) * 100)}%` }} /></span><span className="text-xs tabular-nums text-muted-foreground">{asset.total} changes · {mounted ? timeAgo(asset.last) : "…"}</span></span>
                  </span>
                </>
              );
              return (
                <li key={asset.assetId}>
                  {href
                    ? <Link href={href} className="flex items-center gap-2 rounded-md px-1 py-2 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{inner}</Link>
                    : <span className="flex items-center gap-2 rounded-md px-1 py-2">{inner}</span>}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 border-t border-border pt-3 text-xs text-muted-foreground">Assets sampled from the 240 loaded changes · <button type="button" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" onClick={() => applyFilters({ tab: "all", range: "7D" })}>view 7D <ArrowRight size={12} aria-hidden="true" /></button></p>
        </ChartCard>

        <ChartCard title="Change Sources & Approval" actions={<AuthCardMenu label="Change sources and approval" onExport={() => handleExport("csv")} />}>
          <ul className="flex flex-1 flex-col justify-center divide-y divide-border">
            {CONFIG_SOURCE_MIX.map(([source, count]) => {
              const pct = Math.round((count / summary.total24h) * 100);
              return (
                <li key={source}>
                  <button type="button" onClick={() => applyFilters({ source })} className="flex w-full items-center gap-2 rounded-md px-1 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Filter by source ${source}`}>
                    <ConfigSourceBadge source={source} className="w-36 shrink-0 justify-center" />
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-sky-400" style={{ width: `${Math.max(10, pct)}%` }} /></div>
                    <b className="w-9 shrink-0 text-right text-xs tabular-nums text-foreground">{count}</b>
                  </button>
                </li>
              );
            })}
          </ul>
          <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center text-xs">
            <div className="rounded-lg bg-muted/50 p-2"><dt className="text-muted-foreground">With ticket</dt><dd className="mt-0.5 text-base font-bold tabular-nums text-foreground">{summary.approvedPct}%</dd></div>
            <div className="rounded-lg bg-muted/50 p-2"><dt className="text-muted-foreground">Maintenance window</dt><dd className="mt-0.5 text-base font-bold tabular-nums text-foreground">41%</dd></div>
            <div className="rounded-lg bg-muted/50 p-2"><dt className="text-muted-foreground">Unapproved</dt><dd className="mt-0.5 text-base font-bold tabular-nums text-rose-600 dark:text-rose-400">{Math.round((CONFIG_APPROVAL_MIX.unapproved / summary.total24h) * 100)}%</dd></div>
          </dl>
        </ChartCard>

        <ChartCard title="Changes → Incidents" actions={<AuthCardMenu label="Changes to incidents" onExport={() => handleExport("csv")} />}>
          <ul className="flex flex-1 flex-col divide-y divide-border">
            {CONFIG_INCIDENT_LINKS.map((link) => (
              <li key={link.changeId} className="flex flex-1 flex-col justify-center py-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => openEvent(link.changeId)} className="min-w-0 flex-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="block truncate font-mono text-[0.8125rem] font-semibold text-primary hover:underline">{link.changeId}</span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden="true" className="text-[0.9375rem] leading-none text-muted-foreground">→</span><Link href={`/incidents/${link.incidentId}`} onClick={(event) => event.stopPropagation()} className="font-mono font-semibold text-primary hover:underline">{link.incidentId}</Link><span className="shrink-0">· {link.minutesAfter} min later</span></span>
                  </button>
                  <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", link.confidence === "Likely cause" ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300")}>{link.confidence}</span>
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center text-xs">
            <div className="rounded-lg bg-muted/50 p-2"><dt className="text-muted-foreground">Change failure rate</dt><dd className="mt-0.5 text-base font-bold tabular-nums text-foreground">4.3%</dd></div>
            <div className="rounded-lg bg-muted/50 p-2"><dt className="text-muted-foreground">Likely causes</dt><dd className="mt-0.5 text-base font-bold tabular-nums text-foreground">{CONFIG_INCIDENT_LINKS.filter((link) => link.confidence === "Likely cause").length} of {CONFIG_INCIDENT_LINKS.length}</dd></div>
            <div className="rounded-lg bg-muted/50 p-2"><dt className="text-muted-foreground">Median gap</dt><dd className="mt-0.5 text-base font-bold tabular-nums text-foreground">{Math.round(CONFIG_INCIDENT_LINKS.reduce((acc, link) => acc + link.minutesAfter, 0) / CONFIG_INCIDENT_LINKS.length)}m</dd></div>
          </dl>
        </ChartCard>
      </section>

      {/* Changes table */}
      <section ref={tableTopRef} aria-label="Configuration changes" className="scroll-mt-4">
        <Card className="flex min-w-0 flex-col rounded-xl p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 pb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Configuration Changes</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">240 most recent changes sampled · totals in tabs are 24h fleet-wide</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label="Change tabs" className="flex flex-wrap items-center gap-1">
                {TABS.map((entry) => (
                  <button key={entry.key} role="tab" aria-selected={tab === entry.key} type="button" onClick={() => applyFilters({ tab: entry.key })} className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === entry.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
                    {entry.label}
                    <span className={cn("rounded-full px-1.5 py-0.5 text-xs tabular-nums", tab === entry.key ? "bg-black/15" : "bg-muted")}>{tabCounts[entry.key].toLocaleString()}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => updateParams({ compact: compact ? null : "1" })} aria-pressed={compact} className={cn("h-9 rounded-lg border px-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", compact ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")} title="Toggle compact rows">Compact</button>
              <AuthCardMenu label="Changes table" onExport={() => handleExport("csv")} />
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-1" role="group" aria-label="Filter by risk">
              {(["all", "low", "medium", "high", "critical"] as const).map((value) => (
                <button key={value} type="button" onClick={() => applyFilters({ risk: value })} aria-pressed={riskFilter === value} className={cn("h-8 rounded-md border px-2.5 text-xs font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", riskFilter === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent")}>
                  {value === "all" ? "All risk" : value}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1" role="group" aria-label="Filter by approval">
              {(["all", "Approved", "Unapproved", "Pending", "Expected"] as const).map((value) => (
                <button key={value} type="button" onClick={() => applyFilters({ approval: value })} aria-pressed={approvalFilter === value} className={cn("h-8 rounded-md border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", approvalFilter === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent")}>
                  {value === "all" ? "All approvals" : value}
                </button>
              ))}
            </div>
            <FilterSelect value={categoryFilter} onChange={(value) => applyFilters({ category: value })} label="Category" options={CONFIG_CATEGORY_MIX.map(([category]) => category)} allLabel="All categories" />
            <FilterSelect value={sourceFilter} onChange={(value) => applyFilters({ source: value })} label="Source" options={CONFIG_SOURCE_MIX.map(([source]) => source)} allLabel="All sources" />
            <FilterSelect value={assetFilter} onChange={(value) => applyFilters({ asset: value })} label="Asset" options={["api-server-01", "api-server-02", "db-01", "web-app-01", "web-02", "app-server-02", "cache-01", "edge-01", "pay-01", "auth-01"]} allLabel="All assets" />
            <FilterSelect value={groupFilter} onChange={(value) => applyFilters({ group: value })} label="Group" options={["API Services", "Production Web", "Database Cluster", "Edge Locations", "Cache Servers", "Security Services", "Load Balancers"]} allLabel="All groups" />
            <FilterSelect value={changedByFilter} onChange={(value) => applyFilters({ changedBy: value })} label="Changed by" options={["ops@nexus.io", "automation@nexus.io", "agent", "apt", "marcus.lee@nexus.io", "sara.iqbal@nexus.io", "unknown"]} allLabel="All actors" />
            <FilterSelect value={statusFilter} onChange={(value) => applyFilters({ status: value })} label="Status" options={["Open", "Reviewed", "Reverted", "Rolled back", "Accepted as new baseline"]} allLabel="All statuses" />
            <FilterSelect value={range} onChange={(value) => updateParams({ range: value, page: null, bucket: null })} label="Time range" options={["1H", "24H", "7D", "30D"]} allLabel="" hideAll />
            <div className="relative min-w-[11.25rem] flex-1 sm:min-w-[13.75rem]">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input ref={searchRef} value={query} onChange={(event) => applyFilters({ q: event.target.value })} onKeyDown={(event) => { if (event.key === "Escape") applyFilters({ q: null }); }} placeholder="Search asset, path, setting, user, ticket…" aria-label="Search changes" className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-8 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" />
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">/</kbd>
            </div>
            {activeFilterCount > 0 && (
              <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X size={12} />Reset ({activeFilterCount})</button>
            )}
            <AlertMenu
              label="Saved Views"
              align="end"
              trigger={<Button variant="outline" className="h-9 gap-1.5 text-sm"><ListFilter size={14} />Saved Views</Button>}
              items={[
                ...savedViewsBuiltin.map((view) => ({ key: `builtin-${view.name}`, label: view.name, onSelect: () => applySavedView(view.patch) })),
                ...(savedViews.length > 0 ? [{ key: "divider-user", label: "", divider: true } as const] : []),
                ...savedViews.map((view) => ({ key: `user-${view.name}`, label: view.name, onSelect: () => applySavedView(view.patch) })),
                { key: "divider-save", label: "", divider: true },
                { key: "save", label: "Save current view…", onSelect: () => setSaveViewOpen(true) },
                ...(savedViews.length > 0 ? [{ key: "clear", label: "Remove all saved views", danger: true, onSelect: () => { persistSavedViews([]); setSavedViews([]); } }] : []),
              ]}
            />
            {activeBucket && (
              <button type="button" onClick={() => updateParams({ bucket: null, page: null })} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300" title="Clear bucket filter">
                Bucket {activeBucket.label} <X size={11} />
              </button>
            )}
          </div>

          {/* Bulk action bar */}
          {selectionCount > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-primary/5 px-4 py-2 text-sm">
              <b className="tabular-nums text-foreground">{selectionCount} selected</b>
              <div className="flex flex-wrap items-center gap-1">
                <button type="button" onClick={bulkApprove} className="h-8 rounded-md px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Approve</button>
                <button type="button" onClick={bulkReject} className="h-8 rounded-md px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-rose-500/10">Reject</button>
                <button type="button" onClick={bulkMarkExpected} className="h-8 rounded-md px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Mark expected</button>
                <button type="button" onClick={bulkExport} className="h-8 rounded-md px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Export</button>
              </div>
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Clear selection</button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[70rem] text-left text-[0.8125rem]">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2.5"><input type="checkbox" aria-label="Select all changes on this page" className="h-4 w-4 accent-[var(--primary)]" checked={pageRows.length > 0 && pageRows.every((row) => selected.has(row.id))} onChange={toggleSelectPage} /></th>
                  <th className="px-2 py-2.5"><button type="button" onClick={() => toggleSort("detectedAt")} className="inline-flex items-center gap-1 font-semibold uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Detected {sort.key === "detectedAt" ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-60" />}</button></th>
                  <th className="px-2 py-2.5 font-semibold">Asset</th>
                  <th className="px-2 py-2.5 font-semibold">Change</th>
                  <th className="hidden px-2 py-2.5 font-semibold md:table-cell">Source</th>
                  <th className="hidden px-2 py-2.5 font-semibold md:table-cell">Changed by</th>
                  <th className="px-2 py-2.5"><button type="button" onClick={() => toggleSort("approvalStatus")} className="inline-flex items-center gap-1 font-semibold uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Approval {sort.key === "approvalStatus" ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-60" />}</button></th>
                  <th className="px-2 py-2.5"><button type="button" onClick={() => toggleSort("riskScore")} className="inline-flex items-center gap-1 font-semibold uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Risk {sort.key === "riskScore" ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-60" />}</button></th>
                  <th className="hidden px-2 py-2.5 font-semibold sm:table-cell">Drift</th>
                  <th className="hidden px-2 py-2.5 font-semibold lg:table-cell">Status</th>
                  <th className="px-2 py-2.5 text-right"><span className="sr-only">Actions</span><span className="mr-2 hidden items-center gap-1.5 font-semibold normal-case sm:inline-flex">UTC<button type="button" onClick={() => updateParams({ tz: utc ? null : "utc" })} role="switch" aria-checked={utc} aria-label="Toggle UTC times" className={cn("relative h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", utc ? "bg-primary" : "bg-muted")}><span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", utc ? "left-[1.125rem]" : "left-0.5")} /></button></span></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((change) => {
                  const target = { target: change.assetId, targetKind: "server" as const };
                  const href = targetHref(target);
                  const [file, setting] = splitPath(change.path);
                  const highlight = (value: string) => highlightMatch(value, query);
                  return (
                    <tr key={change.id} tabIndex={0} role="link" aria-label={`Open change ${change.id}`} onClick={() => openEvent(change.id)} onKeyDown={(keyEvent) => { if (keyEvent.key === "Enter" || keyEvent.key === " ") { keyEvent.preventDefault(); openEvent(change.id); } }} className="group relative cursor-pointer border-b border-border/70 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40">
                      <td className={cn("relative px-3 align-middle", compact ? "py-1.5" : "py-2.5")}>
                        <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-[0.1875rem]", change.risk === "Critical" ? "bg-red-500" : change.risk === "High" ? "bg-orange-400" : change.risk === "Medium" ? "bg-amber-400" : "bg-blue-400")} />
                        <input type="checkbox" aria-label={`Select ${change.id}`} className="ml-1 h-4 w-4 accent-[var(--primary)]" checked={selected.has(change.id)} onClick={(clickEvent) => clickEvent.stopPropagation()} onKeyDown={(keyEvent) => keyEvent.stopPropagation()} onChange={() => toggleSelect(change.id)} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 align-middle" title={fullTime(change.detectedAt, utc)}>
                        <span className="block font-semibold tabular-nums text-foreground">{mounted ? timeAgo(change.detectedAt) : "…"}</span>
                        <span className="block text-[0.6875rem] text-muted-foreground">{dateTimeShort(change.detectedAt, utc)}{utc ? " UTC" : ""}</span>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <span className="flex items-center gap-2">
                          <OsIcon os={change.assetOs} />
                          {href ? <Link href={href} onClick={(clickEvent) => clickEvent.stopPropagation()} className="max-w-[9.375rem] truncate font-mono text-[0.8125rem] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded" title={change.assetId}>{change.assetId}</Link> : <span className="max-w-[9.375rem] truncate font-mono text-[0.8125rem] font-semibold text-foreground">{change.assetId}</span>}
                        </span>
                      </td>
                      <td className="max-w-[20rem] px-2 py-2 align-middle">
                        <span className="block truncate text-[0.8125rem] font-semibold text-foreground" title={change.path}>{highlight(file)}{setting ? <span className="text-muted-foreground">: {setting}</span> : null}</span>
                        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[0.6875rem] text-muted-foreground"><ChangeTypeBadge type={change.changeType} /><span className="truncate">{change.category}</span><span className="hidden font-mono text-[0.625rem] text-slate-500 xl:inline" title={diffSummary(change.path, change.beforeValue, change.afterValue)}>{diffSummary(change.path, change.beforeValue, change.afterValue)}</span></span>
                      </td>
                      <td className="hidden px-2 py-2 align-middle md:table-cell"><ConfigSourceBadge source={change.source} /></td>
                      <td className="hidden px-2 py-2 align-middle md:table-cell">
                        <span className="flex items-center gap-2">
                          {change.changedBy === "unknown" || change.changedBy === "agent" || change.changedBy === "apt"
                            ? <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-[0.6875rem] font-bold uppercase text-slate-500 dark:bg-slate-500/20">?</span>
                            : <InitialsAvatar name={change.changedBy.split("@")[0]} size={22} />}
                          <span className="max-w-[8.125rem] truncate text-muted-foreground" title={change.changedBy}>{change.changedBy}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <div className="flex flex-col items-start gap-1"><ApprovalBadge status={change.approvalStatus} />{change.maintenanceWindowId ? <span className="inline-flex items-center gap-1 rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[0.6875rem] font-medium text-teal-800 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300" title={`Via maintenance window ${change.maintenanceWindowId}`}>{change.maintenanceWindowId}</span> : change.ticket ? <span className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[0.6875rem] text-slate-600 dark:border-slate-600 dark:text-slate-300">{change.ticket}</span> : null}</div>
                      </td>
                      <td className="px-2 py-2 align-middle"><div className="flex flex-col items-start gap-1"><ConfigRiskBadge risk={change.risk} /><RiskScoreBar score={change.riskScore} /></div></td>
                      <td className="hidden px-2 py-2 align-middle sm:table-cell">{change.driftFromBaseline ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 dark:text-orange-300" title="Drifted from baseline"><Bug size={12} aria-hidden="true" />Drift</span> : <span className="text-xs text-muted-foreground">-</span>}</td>
                      <td className="hidden px-2 py-2 align-middle lg:table-cell"><ConfigStatusBadge status={change.status} /></td>
                      <td className="px-2 py-2 align-middle text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(clickEvent) => clickEvent.stopPropagation()} onKeyDown={(keyEvent) => keyEvent.stopPropagation()}>
                          <button type="button" title="Approve" aria-label={`Approve ${change.id}`} onClick={() => setApproveTarget(change)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-emerald-50 hover:text-emerald-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 dark:hover:bg-emerald-500/10"><Check size={13} /></button>
                          <button type="button" title="Reject" aria-label={`Reject ${change.id}`} onClick={() => setRejectTarget(change)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 dark:hover:bg-rose-500/10"><X size={13} /></button>
                          <AlertMenu
                            label={`Change ${change.id} actions`}
                            align="end"
                            trigger={<button type="button" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Change ${change.id} actions`}><MoreVertical size={14} /></button>}
                            items={[
                              { key: "view", label: "View details", onSelect: () => openEvent(change.id) },
                              { key: "d1", label: "", divider: true },
                              { key: "approve", label: "Approve", onSelect: () => setApproveTarget(change) },
                              { key: "reject", label: "Reject", danger: true, onSelect: () => setRejectTarget(change) },
                              { key: "expected", label: "Mark expected", onSelect: () => setMarkExpectedTarget(change) },
                              { key: "baseline", label: "Accept as baseline", onSelect: () => setAcceptBaselineTarget(change) },
                              { key: "rollback", label: "Rollback", danger: true, onSelect: () => setRollbackTarget(change) },
                              { key: "d2", label: "", divider: true },
                              { key: "incident", label: "Create incident", onSelect: () => setIncidentTarget({ title: `Configuration change under investigation: ${change.assetId}`, impact: `Drift on ${change.assetName}: ${change.path} (${change.changeType} · ${change.category}).`, hosts: [change.assetId], changeId: change.id }) },
                              { key: "copy", label: "Copy link", onSelect: () => copyLink(change.id) },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center">
                      <SearchX className="mx-auto text-muted-foreground" size={26} />
                      <p className="mt-2 text-sm font-semibold text-foreground">No changes match these filters</p>
                      <p className="mt-1 text-xs text-muted-foreground">Try removing a filter or clearing the search.</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => router.replace(pathname, { scroll: false })}><RotateCcw size={13} />Reset filters</Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination page={clampedPage} pageSize={pageSize} totalItems={filtered.length} onPageChange={(next) => updateParams({ page: String(next) })} onPageSizeChange={(size) => { setPageSize(size); updateParams({ page: null }); }} noun="changes" pageSizeOptions={[10, 25, 50]} />
          <p className="border-t border-border px-4 py-2 text-[0.6875rem] text-muted-foreground">Showing the {filtered.length.toLocaleString()} most recent matching changes sampled from a 24h fleet-wide workload ({summary.total24h} changes). Times shown in <b>{utc ? "UTC" : "local time"}</b> · {timeZoneLabel()}.</p>
        </Card>
      </section>

      {/* Dialogs + toast */}
      <ApproveChangeDialog open={approveTarget != null} onOpenChange={(open) => { if (!open) setApproveTarget(null); }} change={approveTarget} onDone={(result) => { const id = approveTarget?.id; notify(result); setApproveTarget(null); setEvents((current) => current.map((change) => change.id === id ? { ...change, approvalStatus: "Approved", approvedBy: "Ayesha Khan", status: "Reviewed" } : change)); }} />
      <RejectChangeDialog open={rejectTarget != null} onOpenChange={(open) => { if (!open) setRejectTarget(null); }} change={rejectTarget} onDone={(result) => { notify(result); setRejectTarget(null); setEvents((current) => current.map((change) => change.id === rejectTarget?.id ? { ...change, approvalStatus: "Unapproved", status: "Reverted" } : change)); }} />
      <MarkExpectedDialog open={markExpectedTarget != null} onOpenChange={(open) => { if (!open) setMarkExpectedTarget(null); }} change={markExpectedTarget} onDone={(result) => { notify(result); setMarkExpectedTarget(null); setEvents((current) => current.map((change) => change.id === markExpectedTarget?.id ? { ...change, approvalStatus: "Expected", driftFromBaseline: false, status: "Reviewed" } : change)); }} />
      <AcceptBaselineDialog open={acceptBaselineTarget != null} onOpenChange={(open) => { if (!open) setAcceptBaselineTarget(null); }} change={acceptBaselineTarget} onDone={(result) => { notify(result); setAcceptBaselineTarget(null); setEvents((current) => current.map((change) => change.id === acceptBaselineTarget?.id ? { ...change, driftFromBaseline: false, status: "Accepted as new baseline", approvalStatus: "Approved" } : change)); }} />
      <RollbackDialog open={rollbackTarget != null} onOpenChange={(open) => { if (!open) setRollbackTarget(null); }} change={rollbackTarget} snapshots={rollbackTarget ? configSnapshotsFor(rollbackTarget.assetId).map((snapshot) => ({ id: snapshot.id, takenAt: snapshot.takenAt, version: snapshot.version })) : []} onDone={(result) => { notify(result); setRollbackTarget(null); setEvents((current) => current.map((change) => change.id === rollbackTarget?.id ? { ...change, status: "Rolled back", driftFromBaseline: false } : change)); }} />
      <CreateIncidentDialog open={incidentTarget != null} onOpenChange={(open) => { if (!open) setIncidentTarget(null); }} prefill={incidentTarget ? { title: incidentTarget.title, impact: incidentTarget.impact, hosts: incidentTarget.hosts } : { title: "", impact: "" }} onDone={notify} />
      <RunDriftScanDialog open={scanOpen} onOpenChange={setScanOpen} onDone={notify} onScanned={load} />
      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent className="w-[min(26.25rem,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>Save current view</DialogTitle>
            <DialogDescription>Stores the active filters as a named view in this browser.</DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            View name
            <input autoFocus value={saveViewName} onChange={(event) => setSaveViewName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveCurrentView(); }} placeholder="e.g. Unapproved SSH changes" aria-label="View name" className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveViewOpen(false)}>Cancel</Button>
            <Button onClick={saveCurrentView} disabled={saveViewName.trim().length === 0}>Save view</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AuthToast toast={toast} onDismiss={dismiss} />
    </div>
  );
}

/* ------------------------------ sub components ----------------------------- */

function highlightMatch(value: string, query: string): ReactNode {
  const q = query.trim().toLowerCase();
  if (!q) return value;
  const index = value.toLowerCase().indexOf(q);
  if (index === -1) return value;
  return (<>{value.slice(0, index)}<mark className="bg-amber-200 text-amber-900 dark:bg-amber-500/40 dark:text-amber-100">{value.slice(index, index + q.length)}</mark>{value.slice(index + q.length)}</>);
}

type FilterOption = string;

function FilterSelect({ value, onChange, label, options, allLabel, hideAll = false }: { value: string; onChange: (value: string) => void; label: string; options: FilterOption[]; allLabel: string; hideAll?: boolean }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className="h-9 max-w-[9.6875rem] rounded-md border border-input bg-card px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
      {!hideAll && <option value="all">{allLabel}</option>}
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function useEChart(option: EChartsOption, label: string) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const chart = echarts.init(host);
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(host);
    return () => { observer.disconnect(); chart.dispose(); chartRef.current = null; };
  }, []);
  useEffect(() => {
    chartRef.current?.setOption(option, true);
    chartRef.current?.resize();
  }, [option]);
  return hostRef;
}

interface ChangeTimelineChartProps {
  mode: ChartMode;
  buckets: Array<{ label: string; approved: number; unapproved: number; pending: number; expected: number; total: number }>;
  hidden: Set<string>;
  windowMarkers: ReadonlyArray<{ id: string; title: string; assetId: string; hoursAgo: number; durationMinutes: number }>;
  onBarClick?: (index: number) => void;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  const raw = weights.map((weight) => (weight / sum) * total);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((acc, value) => acc + value, 0);
  const order = raw.map((value, index) => ({ index, frac: value - Math.floor(value) })).sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < order.length && remainder > 0; k += 1, remainder -= 1) out[order[k].index] += 1;
  return out;
}

function ChangeTimelineChart({ mode, buckets, hidden, windowMarkers, onBarClick }: ChangeTimelineChartProps) {
  const hostRef = useEChart(
    useMemo<EChartsOption>(() => {
      const labels = buckets.map((bucket) => bucket.label);
      const grid = { left: 40, right: 16, top: 24, bottom: 26 } as const;
      const axis = {
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#E2E8F0" } },
        axisLabel: { color: "#64748B", fontSize: 10, interval: labels.length > 16 ? Math.floor(labels.length / 6) : 0 },
      } as const;
      const tooltip = {
        trigger: "axis" as const,
        confine: true,
        axisPointer: { type: "shadow" as const },
        backgroundColor: "#0f172a",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 12 },
      };
      const yAxis = {
        type: "value" as const,
        splitLine: { lineStyle: { type: "dashed" as const, color: "#E2E8F0" } },
        axisLabel: { color: "#64748B", fontSize: 10 },
      };
      const maxTotal = buckets.reduce((acc, bucket) => Math.max(acc, bucket.total), 0);
      const yAxisMax = { ...yAxis, max: Math.ceil(maxTotal * 1.15) };

      // Maintenance window bands (only when the window is inside the visible range).
      const markAreaData = windowMarkers
        .map((marker) => ({ marker, index: buckets.findIndex((bucket, index) => {
          const window = bucketWindow(labels.length === 24 ? "24H" : labels.length === 7 ? "7D" : "30D", index);
          const markerStart = Date.now() - marker.hoursAgo * 3_600_000;
          return markerStart >= window.start && markerStart < window.end;
        }) }))
        .filter((entry) => entry.index >= 0)
        .map((entry) => ([{ xAxis: buckets[entry.index].label, name: entry.marker.id }, { xAxis: buckets[entry.index].label }]));

      // Incident marker (red) pinned near "now", and an amber spike on the max unapproved bucket.
      const lastIndex = buckets.length - 1;
      const unapprovedMax = buckets.reduce((best, bucket) => (bucket.unapproved > buckets[best].unapproved ? buckets.indexOf(bucket) : best), 0);

      if (mode === "approval") {
        const series = [
          { name: "Approved", color: "#34D399", data: buckets.map((bucket) => bucket.approved) },
          { name: "Unapproved", color: "#F87171", data: buckets.map((bucket) => bucket.unapproved) },
          { name: "Pending", color: "#FBBF24", data: buckets.map((bucket) => bucket.pending) },
          { name: "Expected", color: "#94A3B8", data: buckets.map((bucket) => bucket.expected) },
        ].filter((entry) => !hidden.has(entry.name));
        const spikeIndex = series.findIndex((entry) => entry.name === "Unapproved");
        return {
          grid,
          tooltip: { ...tooltip, axisPointer: { type: "shadow" } },
          xAxis: { type: "category" as const, data: labels, ...axis },
          yAxis: yAxisMax,
          series: series.map((entry, index) => ({
            name: entry.name,
            type: "bar" as const,
            stack: "total",
            barMaxWidth: 24,
            itemStyle: { color: entry.color, borderRadius: index === series.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0] },
            emphasis: { focus: "series" as const },
            data: entry.data,
            ...(index === spikeIndex ? {
              markPoint: {
                symbol: "pin",
                symbolSize: 34,
                itemStyle: { color: "#FBBF24" },
                label: { color: "#0f172a", fontSize: 8, fontWeight: 700, formatter: `${buckets[unapprovedMax]?.unapproved ?? 0} unappr.` },
                data: [{ type: "max" as const, name: "Unapproved spike" }],
              },
            } : {}),
          })),
        };
      }
      if (mode === "category") {
        const rand = mulberry32(11_777);
        const categoryNames = CONFIG_CATEGORY_MIX.map(([category]) => category).filter((category) => !hidden.has(category));
        const categoryWeights = CONFIG_CATEGORY_MIX.map(([, count]) => count);
        return {
          grid,
          tooltip,
          xAxis: { type: "category" as const, data: labels, ...axis },
          yAxis: yAxisMax,
          series: categoryNames.map((category) => {
            const catIndex = CONFIG_CATEGORY_MIX.findIndex(([name]) => name === category);
            const data = buckets.map((bucket, index) => {
              const randForBucket = mulberry32(11_777 + index);
              return distribute(bucket.total, categoryWeights.map((weight) => weight * (0.7 + randForBucket() * 0.6)))[catIndex];
            });
            void rand;
            return {
              name: category,
              type: "bar" as const,
              stack: "total",
              barMaxWidth: 24,
              itemStyle: { color: CATEGORY_COLORS[category] ?? "#94A3B8" },
              emphasis: { focus: "series" as const },
              data,
            };
          }),
        };
      }
      // Source mode
      const sourceColors: Record<string, string> = { "Manual": "#60A5FA", "Automation/IaC": "#A78BFA", "Agent-detected": "#FBBF24", "Patch": "#34D399" };
      const sourceWeights = CONFIG_SOURCE_MIX.map(([, count]) => count);
      const sourceNames = CONFIG_SOURCE_MIX.map(([source]) => source).filter((source) => !hidden.has(source));
      return {
        grid,
        tooltip,
        xAxis: { type: "category" as const, data: labels, ...axis },
        yAxis: yAxisMax,
        series: sourceNames.map((source) => {
          const srcIndex = CONFIG_SOURCE_MIX.findIndex(([name]) => name === source);
          const data = buckets.map((bucket, index) => {
            const randForBucket = mulberry32(12_345 + index);
            return distribute(bucket.total, sourceWeights.map((weight) => weight * (0.7 + randForBucket() * 0.6)))[srcIndex];
          });
          return {
            name: source,
            type: "bar" as const,
            stack: "total",
            barMaxWidth: 24,
            itemStyle: { color: sourceColors[source] },
            emphasis: { focus: "series" as const },
            data,
          };
        }),
      };
    }, [buckets, hidden, mode, windowMarkers]),
    mode === "approval" ? "Approval state per bucket" : mode === "category" ? "Change category per bucket" : "Change source per bucket",
  );

  useEffect(() => {
    if (!onBarClick) return undefined;
    const host = hostRef.current;
    if (!host) return undefined;
    const chart = echarts.getInstanceByDom(host);
    if (!chart) return undefined;
    const handler = (params: unknown) => {
      const point = params as { dataIndex?: number };
      if (typeof point.dataIndex === "number") onBarClick(point.dataIndex);
    };
    chart.on("click", handler);
    return () => { chart.off("click", handler); };
  }, [hostRef, onBarClick]);

  return <div ref={hostRef} className="h-[14.375rem] min-h-[14.375rem] w-full flex-1" role="img" aria-label="Configuration change timeline chart" />;
}

function TypeDonut({ onSelect }: { onSelect: (category: string) => void }) {
  const summary = getConfigSummary();
  const hostRef = useEChart(
    useMemo<EChartsOption>(() => ({
      tooltip: { trigger: "item", confine: true, backgroundColor: "#0f172a", borderWidth: 0, textStyle: { color: "#fff", fontSize: 12 } },
      series: [
        {
          name: "Changes by type",
          type: "pie",
          radius: ["52%", "100%"],
          avoidLabelOverlap: true,
          label: { show: false },
          itemStyle: { borderRadius: 4, borderColor: "transparent", borderWidth: 2 },
          data: CONFIG_CATEGORY_MIX.map(([category, count]) => ({ name: category, value: count, itemStyle: { color: CATEGORY_COLORS[category] } })),
        },
      ],
    }), []),
    "Changes by category donut chart",
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const chart = echarts.getInstanceByDom(host);
    if (!chart) return undefined;
    const handler = (params: unknown) => {
      const point = params as { name?: string };
      if (point.name) onSelect(point.name);
    };
    chart.on("click", handler);
    return () => { chart.off("click", handler); };
  }, [hostRef, onSelect]);

  return (
    <div className="relative h-[10rem] min-h-[10rem] w-[10rem]">
      <div ref={hostRef} className="absolute inset-0" role="img" aria-label="Changes by category donut chart" />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <b className="font-display text-[1.375rem] leading-none text-foreground tabular-nums">{summary.total24h}</b>
        <span className="mt-1 text-[0.625rem] uppercase tracking-wide text-muted-foreground">changes · 24h</span>
      </div>
    </div>
  );
}

function ComplianceGauge({ pct }: { pct: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" role="img" aria-label={`Baseline compliance ${pct}%`}>
      <circle cx="55" cy="55" r={radius} stroke="currentColor" strokeOpacity="0.12" strokeWidth="12" fill="none" />
      <circle cx="55" cy="55" r={radius} stroke="#34D399" strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 55 55)" />
      <text x="55" y="52" textAnchor="middle" fontSize="22" fontWeight="800" fill="currentColor">{pct}%</text>
      <text x="55" y="70" textAnchor="middle" fontSize="8" fill="#64748B">CIS PASS</text>
    </svg>
  );
}

/** Age label of the oldest change still awaiting review (unapproved or pending). */
function oldestQueueAge(events: Array<{ detectedAt: string; approvalStatus: string }>): string {
  const pending = events.filter((change) => change.approvalStatus === "Unapproved" || change.approvalStatus === "Pending");
  if (pending.length === 0) return "—";
  let oldest = Number.POSITIVE_INFINITY;
  for (const change of pending) {
    const at = Date.parse(change.detectedAt);
    if (at < oldest) oldest = at;
  }
  const minutes = Math.max(1, Math.floor((Date.now() - oldest) / 60_000));
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;
}
