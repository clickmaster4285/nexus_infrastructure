"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Ban, BellPlus, CheckCircle2, ChevronRight,
  FileDown, KeyRound, Laptop, Lock, LockOpen, MoreVertical, RotateCcw, Search, SearchX, ShieldCheck,
  ShieldAlert, SquareTerminal, XCircle, Users, MapPin, Bug, Timer, ListFilter, X,
  Fingerprint as FingerprintIcon, CircleAlert,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { ChartCard, SegmentedControl } from "@/components/logs/primitives";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pagination } from "@/components/shared/pagination";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { ViewAllLink } from "@/components/shared/view-all-link";
import { CountryFlag } from "@/components/shared/country-flag";
import {
  BlockIpDialog, LockAccountDialog, ForceResetDialog, RevokeSessionsDialog,
  MarkReviewedDialog, FalsePositiveDialog, CreateIncidentDialog, DetectionDialog,
  AuthToast, useAuthToast,
} from "@/components/auth-events/auth-actions";
import {
  ResultBadge, SeverityBadge, RiskStripe, RiskScoreBar, FlagChips, AuthCardMenu,
  timeAgo, fullTime, dateTimeShort, timeZoneLabel, targetHref,
} from "@/components/auth-events/auth-shared";
import { cn } from "@/lib/utils";
import {
  AUTH_FAILURE_REASONS, AUTH_LOCKED_ACCOUNT_USERS, AUTH_LOCATIONS, AUTH_METHOD_COUNTS, AUTH_RANGE_STATS,
  AUTH_SSO_FAILURE_RATE_PCT, AUTH_TARGETED_ACCOUNTS, AUTH_BRUTE_FORCE_SUSPECTS, getAuthSummary, authTrendBuckets,
  loadAuthEvents, loadAuthDetections, getAuthEventById, isAuthIpBlocked, isAuthAccountLocked,
  setAuthDetectionStatus, markAuthReviewed, type AuthDetection, type AuthEvent, type AuthRiskFlag, type AuthTrendRange,
} from "@/mocks/security";

type TableTab = "all" | "failed" | "suspicious" | "lockouts" | "sso";
type RiskBand = "all" | "low" | "medium" | "high";
type SortKey = "time" | "riskScore" | "result";
type SortDir = "asc" | "desc";
type RangeKey = "1H" | "24H" | "7D" | "30D";
type ChartMode = "result" | "method";

const RANGE_MS: Record<RangeKey, number> = { "1H": 3_600_000, "24H": 86_400_000, "7D": 7 * 86_400_000, "30D": 30 * 86_400_000 };

function bucketWindow(range: AuthTrendRange, index: number): { start: number; end: number; label: string } {
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

const TABS: Array<{ key: TableTab; label: string }> = [
  { key: "all", label: "All" },
  { key: "failed", label: "Failed" },
  { key: "suspicious", label: "Suspicious" },
  { key: "lockouts", label: "Lockouts" },
  { key: "sso", label: "SSO" },
];

const savedViewsBuiltin: Array<{ name: string; patch: Record<string, string | null> }> = [
  { name: "Failed last 24h", patch: { tab: "failed", range: "24H" } },
  { name: "High risk", patch: { risk: "high" } },
  { name: "Privileged", patch: { flags: "privileged" } },
  { name: "Off-hours", patch: { flags: "off_hours" } },
  { name: "My reviewed", patch: { review: "Reviewed" } },
];
const SAVED_VIEWS_KEY = "auth-events:saved-views:v1";

function loadSavedViews(): Array<{ name: string; patch: Record<string, string | null> }> {
  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is { name: string; patch: Record<string, string | null> } =>
      typeof item === "object" && item != null && typeof (item as { name?: unknown }).name === "string" && typeof (item as { patch?: unknown }).patch === "object");
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

/** Deterministic per-bucket PRNG for splitting bucket totals across methods. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const METHOD_SERIES = [
  { name: "Password", color: "#38BDF8", weight: 8_214 },
  { name: "SSO/SAML", color: "#A78BFA", weight: 5_893 },
  { name: "MFA/TOTP", color: "#FBBF24", weight: 2_213 },
  { name: "SSH key", color: "#34D399", weight: 1_471 },
  { name: "API token", color: "#94A3B8", weight: 629 },
];

function splitByWeights(total: number, weights: number[], rand: () => number): number[] {
  const jittered = weights.map((weight) => weight * (0.75 + rand() * 0.5));
  const sum = jittered.reduce((acc, value) => acc + value, 0);
  const raw = jittered.map((value) => (value / sum) * total);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((acc, value) => acc + value, 0);
  const order = raw.map((value, index) => ({ index, frac: value - Math.floor(value) })).sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < order.length && remainder > 0; k += 1, remainder -= 1) out[order[k].index] += 1;
  return out;
}

export function AuthEventsDashboard() {
  const summary = getAuthSummary();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = (searchParams.get("tab") ?? "all") as TableTab;
  const resultFilter = searchParams.get("result") ?? "all";
  const methodFilter = searchParams.get("method") ?? "all";
  const typeFilter = searchParams.get("type") ?? "all";
  const countryFilter = searchParams.get("country") ?? "all";
  const userTypeFilter = searchParams.get("userType") ?? "all";
  const riskFilter = (searchParams.get("risk") ?? "all") as RiskBand;
  const range = (searchParams.get("range") ?? "24H") as RangeKey;
  const query = searchParams.get("q") ?? "";
  const reasonFilter = searchParams.get("reason") ?? "all";
  const flagsParam = searchParams.get("flags") ?? "";
  const reviewFilter = searchParams.get("review") ?? "all";
  const bucketParam = searchParams.get("bucket") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const compact = searchParams.get("compact") === "1";
  const utc = searchParams.get("tz") === "utc";

  const [events, setEvents] = useState<AuthEvent[]>([]);
  const [detections, setDetections] = useState<AuthDetection[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "error" | "success">("loading");
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "time", dir: "desc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(25);
  const [trendRange, setTrendRange] = useState<AuthTrendRange>("24H");
  const [chartMode, setChartMode] = useState<ChartMode>("result");
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [detectionFilter, setDetectionFilter] = useState<"open" | "all">("open");
  const [detectionDialog, setDetectionDialog] = useState<AuthDetection | null>(null);
  const [liveTail, setLiveTail] = useState(false);
  const [pendingNew, setPendingNew] = useState(0);
  const [hoveringTable, setHoveringTable] = useState(false);
  const [blockIps, setBlockIps] = useState<string[] | null>(null);
  const [lockTarget, setLockTarget] = useState<{ user: string; locked: boolean } | null>(null);
  const [forceResetTarget, setForceResetTarget] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [markReviewedIds, setMarkReviewedIds] = useState<string[]>([]);
  const [falsePositiveIds, setFalsePositiveIds] = useState<string[]>([]);
  const [incidentPrefill, setIncidentPrefill] = useState<{ title: string; impact: string; hosts?: string[] } | null>(null);
  const [savedViews, setSavedViews] = useState<Array<{ name: string; patch: Record<string, string | null> }>>([]);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const liveCounter = useRef(0);
  const tableTopRef = useRef<HTMLDivElement | null>(null);
  const detectionsRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const { toast, notify, dismiss } = useAuthToast();

  const load = useCallback(() => {
    setLoadState("loading");
    const forcedError = typeof window !== "undefined" && window.location.search.includes("authError=1");
    const timer = window.setTimeout(() => {
      if (forcedError) {
        setLoadState("error");
        return;
      }
      Promise.all([loadAuthEvents(), loadAuthDetections()])
        .then(([loadedEvents, loadedDetections]) => {
          setEvents(loadedEvents);
          setDetections(loadedDetections);
          setLoadState("success");
          setLastUpdated(new Date());
        })
        .catch(() => setLoadState("error"));
    }, 220);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => load(), [load]);
  useEffect(() => { setSavedViews(loadSavedViews()); }, []);

  /* Restore scroll position when returning from the detail page via Back. */
  useEffect(() => {
    const saved = sessionStorage.getItem("auth-events:scroll");
    if (saved) {
      const top = Number(saved);
      if (Number.isFinite(top)) requestAnimationFrame(() => window.scrollTo({ top, behavior: "instant" as ScrollBehavior }));
    }
    const onScroll = () => sessionStorage.setItem("auth-events:scroll", String(window.scrollY));
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* "/" focuses the search box. */
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

  /* ------------------------------ derived data ----------------------------- */

  const activeBucket = useMemo(() => {
    const [rangeTag, indexRaw] = bucketParam.split(":");
    const index = Number(indexRaw);
    if (!Number.isFinite(index) || (rangeTag !== "24H" && rangeTag !== "7D" && rangeTag !== "30D")) return null;
    if (rangeTag !== range) return null;
    return { range: rangeTag as AuthTrendRange, index, ...bucketWindow(rangeTag as AuthTrendRange, index) };
  }, [bucketParam, range]);

  const flagFilters = useMemo(() => flagsParam.split(",").map((flag) => flag.trim()).filter(Boolean) as AuthRiskFlag[], [flagsParam]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const list = events.filter((event) => {
      if (tab === "failed" && event.result === "Success") return false;
      if (tab === "suspicious" && event.riskScore < 60) return false;
      if (tab === "lockouts" && event.eventType !== "Account lockout") return false;
      if (tab === "sso" && event.method !== "SSO/SAML") return false;
      if (resultFilter !== "all" && event.result !== resultFilter) return false;
      if (methodFilter !== "all" && event.method !== methodFilter) return false;
      if (typeFilter !== "all" && event.eventType !== typeFilter) return false;
      if (countryFilter !== "all" && event.country !== countryFilter) return false;
      if (userTypeFilter !== "all" && event.userType !== userTypeFilter) return false;
      if (reasonFilter !== "all" && event.failureReason !== reasonFilter) return false;
      if (riskFilter !== "all") {
        if (riskFilter === "low" && event.riskScore >= 40) return false;
        if (riskFilter === "medium" && (event.riskScore < 40 || event.riskScore >= 70)) return false;
        if (riskFilter === "high" && event.riskScore < 70) return false;
      }
      if (reviewFilter !== "all" && event.reviewState !== reviewFilter) return false;
      if (flagFilters.length > 0 && !flagFilters.every((flag) => event.riskFlags.includes(flag))) return false;
      if (range && now - Date.parse(event.time) > RANGE_MS[range]) return false;
      if (activeBucket) {
        const at = Date.parse(event.time);
        if (at < activeBucket.start || at >= activeBucket.end) return false;
      }
      if (query) {
        const haystack = `${event.id} ${event.user} ${event.ip} ${event.target} ${event.country} ${event.city} ${event.method} ${event.eventType}`.toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort.key === "time") return (Date.parse(a.time) - Date.parse(b.time)) * dir;
      if (sort.key === "riskScore") return (a.riskScore - b.riskScore) * dir;
      return a.result.localeCompare(b.result) * dir;
    });
  }, [events, tab, resultFilter, methodFilter, typeFilter, countryFilter, userTypeFilter, riskFilter, reviewFilter, flagFilters, range, activeBucket, query, reasonFilter, sort]);

  /* Live tail — fabricate a fresh mock event every 2s (in-memory only). */
  const liveBuffer = useRef<AuthEvent[]>([]);
  useEffect(() => {
    if (!liveTail) return undefined;
    const timer = window.setInterval(() => {
      liveCounter.current += 1;
      const seq = liveCounter.current;
      const rand = mulberry32(9_100 + seq);
      const users = ["sara.iqbal@nexus.io", "ops@nexus.io", "monitoring-probe", "priya.nair@nexus.io"] as const;
      const user = users[Math.floor(rand() * users.length)];
      const isService = user === "monitoring-probe";
      const item: AuthEvent = {
        id: `AUTH-${90500 + seq}`,
        time: new Date().toISOString(),
        user,
        userType: isService ? "Service" : "Human",
        eventType: isService ? "Token issued" : "Login",
        method: isService ? "API token" : rand() < 0.5 ? "SSO/SAML" : "Password",
        result: rand() < 0.94 ? "Success" : "Failed",
        failureReason: null,
        ip: `192.168.88.${20 + (seq % 30)}`,
        country: "Pakistan",
        countryCode: "PK",
        city: "Karachi",
        browser: "Chrome",
        os: "macOS",
        device: "Chrome on macOS",
        target: "api-server-01",
        targetKind: "server",
        mfaUsed: !isService,
        riskScore: isService ? 8 : 14,
        riskFlags: [],
        reviewState: "New",
        blocked: false,
      };
      if (hoveringTable || page !== 1 || query) {
        liveBuffer.current = [...liveBuffer.current, item];
        setPendingNew((count) => count + 1);
      } else {
        setEvents((current) => [item, ...current]);
      }
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [liveTail, hoveringTable, page, query]);

  const mergeLiveBuffer = useCallback(() => {
    if (liveBuffer.current.length > 0) {
      setEvents((current) => [...liveBuffer.current.reverse(), ...current]);
      liveBuffer.current = [];
    }
    setPendingNew(0);
    updateParams({ page: null });
  }, [updateParams]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageStart = (clampedPage - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);

  const tabCounts = {
    all: summary.total,
    failed: summary.failed,
    suspicious: summary.suspicious,
    lockouts: summary.lockedAccounts,
    sso: 5_893,
  };

  const trendBuckets = useMemo(() => authTrendBuckets(trendRange), [trendRange]);
  const trendPeak = useMemo(() => trendBuckets.reduce((best, bucket) => (bucket.failed + bucket.blocked > best.failed + best.blocked ? bucket : best), trendBuckets[0]), [trendBuckets]);
  const methodDistribution = useMemo(() => trendBuckets.map((bucket, index) => {
    const rand = mulberry32(7_000 + index);
    const parts = splitByWeights(bucket.total, METHOD_SERIES.map((series) => series.weight), rand);
    return { label: bucket.label, parts };
  }), [trendBuckets]);

  const exportCsv = useCallback((rows: AuthEvent[]) => {
    const header = ["id", "time", "user", "userType", "eventType", "method", "result", "failureReason", "ip", "country", "city", "target", "riskScore", "reviewState", "blocked"];
    const escapeCsv = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const lines = [header.join(",")];
    for (const event of rows) {
      lines.push([
        event.id, event.time, event.user, event.userType, event.eventType, event.method, event.result,
        event.failureReason ?? "", event.ip, event.country, event.city, event.target,
        String(event.riskScore), event.reviewState, String(event.blocked),
      ].map(escapeCsv).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `auth-events-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportJson = useCallback((rows: AuthEvent[]) => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `auth-events-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExport = useCallback((kind: "csv" | "json") => {
    try {
      if (kind === "csv") exportCsv(filtered); else exportJson(filtered);
      notify({ message: `${filtered.length.toLocaleString()} events exported as ${kind.toUpperCase()}` });
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

  const openEvent = useCallback((eventId: string) => {
    const top = window.scrollY;
    sessionStorage.setItem("auth-events:scroll", String(top));
    router.push(`/authentication-events/${eventId}`);
  }, [router]);

  const applySavedView = useCallback((patch: Record<string, string | null>) => {
    applyFilters({ ...patch, page: null });
  }, [applyFilters]);

  const saveCurrentView = useCallback(() => {
    const name = saveViewName.trim();
    if (!name) return;
    const patch: Record<string, string | null> = {};
    if (tab !== "all") patch.tab = tab;
    if (resultFilter !== "all") patch.result = resultFilter;
    if (methodFilter !== "all") patch.method = methodFilter;
    if (typeFilter !== "all") patch.type = typeFilter;
    if (countryFilter !== "all") patch.country = countryFilter;
    if (userTypeFilter !== "all") patch.userType = userTypeFilter;
    if (riskFilter !== "all") patch.risk = riskFilter;
    if (range !== "24H") patch.range = range;
    if (query) patch.q = query;
    if (reasonFilter !== "all") patch.reason = reasonFilter;
    if (flagsParam) patch.flags = flagsParam;
    if (reviewFilter !== "all") patch.review = reviewFilter;
    const next = [...savedViews.filter((view) => view.name !== name), { name, patch }];
    if (persistSavedViews(next)) {
      setSavedViews(next);
      notify({ message: `View “${name}” saved` });
    } else {
      notify({ message: "Could not persist the view (localStorage unavailable)" });
    }
    setSaveViewOpen(false);
    setSaveViewName("");
  }, [countryFilter, flagsParam, methodFilter, notify, query, range, reasonFilter, resultFilter, reviewFilter, riskFilter, savedViews, saveViewName, tab, typeFilter, userTypeFilter]);

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

  const bulkMarkReviewed = useCallback(() => {
    setMarkReviewedIds([...selected]);
  }, [selected]);

  const bulkBlockIps = useCallback(() => {
    const ips = [...new Set(events.filter((event) => selected.has(event.id)).map((event) => event.ip))];
    if (ips.length > 0) setBlockIps(ips);
  }, [events, selected]);

  const bulkExport = useCallback(() => {
    const chosen = events.filter((event) => selected.has(event.id));
    handleExport("csv");
    void chosen;
  }, [events, handleExport, selected]);

  const copyLink = useCallback((id: string) => {
    const url = `${window.location.origin}/authentication-events/${id}`;
    try {
      void navigator.clipboard?.writeText(url);
      notify({ message: "Event link copied to clipboard" });
    } catch {
      notify({ message: "Clipboard unavailable in this context" });
    }
  }, [notify]);

  const selectionCount = selected.size;
  const suspects = summary.bruteForceSuspects;
  const bannerCount = suspects.length + summary.impossibleTravel + summary.lockedAccounts;

  /* --------------------------------- render -------------------------------- */

  if (loadState === "loading") {
    return (
      <div className="space-y-4 pb-4" aria-busy="true">
        <div className="h-[92px] animate-pulse rounded-xl bg-muted" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />)}</div>
        <div className="grid items-stretch gap-4 xl:grid-cols-12"><div className="h-[340px] animate-pulse rounded-xl bg-muted xl:col-span-8" /><div className="h-[340px] animate-pulse rounded-xl bg-muted xl:col-span-4" /></div>
        <div className="h-[260px] animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Security", "Authentication Events"]} title="Authentication Events" subtitle="Logins, failures, and SSO anomalies across your fleet." />
        <Card className="grid min-h-[320px] place-items-center rounded-xl p-6">
          <div className="text-center">
            <CircleAlert className="mx-auto text-rose-500" size={28} />
            <h2 className="mt-2 text-base font-semibold">Authentication events could not be loaded</h2>
            <p className="mt-1 text-sm text-muted-foreground">Retry to reload events and detections.</p>
            <Button className="mt-4" onClick={load}><RotateCcw size={15} />Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  const failedBreakdown = summary.failedBreakdown;
  const failureRate = summary.failureRatePct;
  const rangeStats = AUTH_RANGE_STATS[range];
  const activeFilterCount = [resultFilter, methodFilter, typeFilter, countryFilter, userTypeFilter, reasonFilter, riskFilter, reviewFilter].filter((value) => value !== "all").length + flagFilters.length + (query ? 1 : 0) + (activeBucket ? 1 : 0);

  return (
    <div className="min-w-0 space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Security", "Authentication Events"]}
        title="Authentication Events"
        subtitle="Logins, failures, and SSO anomalies across your fleet."
        lastUpdated={lastUpdated.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        onRefresh={load}
        actions={
          <div className="flex items-center gap-2">
            <AlertMenu
              label="Export authentication events"
              trigger={<Button variant="outline" className="h-10 gap-1.5 text-sm"><FileDown size={15} />Export</Button>}
              items={[
                { key: "csv", label: "CSV (filtered)", onSelect: () => handleExport("csv") },
                { key: "json", label: "JSON (filtered)", onSelect: () => handleExport("json") },
              ]}
            />
            <Button className="h-10 gap-1.5 text-sm" onClick={() => router.push("/alert-rules")}><BellPlus size={15} />Create Alert Rule</Button>
          </div>
        }
      />

      {/* Threat banner */}
      {bannerCount > 0 ? (
        <div role="status" className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200">
          <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} aria-hidden="true" />{suspects.length} brute-force suspects</span>
            <span className="hidden sm:inline" aria-hidden="true">�</span>
            <span>{summary.impossibleTravel} impossible-travel logins</span>
            <span className="hidden sm:inline" aria-hidden="true">�</span>
            <span>{summary.lockedAccounts} locked accounts</span>
          </span>
          <button type="button" onClick={() => detectionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="shrink-0 font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
            View detections <ChevronRight size={14} className="inline" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div role="status" className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
          <span className="flex items-center gap-2"><ShieldCheck size={16} aria-hidden="true" />No suspicious authentication activity</span>
          <span className="text-xs">{summary.total.toLocaleString()} events scanned � last 24h</span>
        </div>
      )}

      {/* Stat cards */}
      <section aria-label="Authentication KPIs" className="grid grid-cols-2 items-stretch gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={<FingerprintIcon size={19} />} label="Total Events" value={summary.total.toLocaleString()} delta={summary.deltas.total} deltaPercent={summary.deltas.totalPct} goodDirection="up" iconTone="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" className="min-h-[112px]" detail="in the last 24h" />
        <StatCard icon={<CheckCircle2 size={19} />} label="Successful Logins" value={summary.success.toLocaleString()} delta={summary.deltas.success} deltaPercent={summary.deltas.successPct} goodDirection="up" iconTone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" className="min-h-[112px]" detail="in the last 24h" />
        <StatCard icon={<XCircle size={19} />} label="Failed Logins" value={summary.failed.toLocaleString()} delta={summary.deltas.failed} deltaPercent={summary.deltas.failedPct} goodDirection="down" iconTone="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" className="min-h-[112px]" detail={`${failureRate}% failure rate`} onClick={() => applyFilters({ tab: "failed" })} onClickLabel="Show only failed logins" />
        <StatCard icon={<KeyRound size={19} />} label="MFA Coverage" value={`${summary.mfaCoveragePct}%`} delta={summary.deltas.mfaCoverage} deltaPercent="1.2 pts" goodDirection="up" iconTone="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" className="min-h-[112px]" detail="of enabled accounts" />
        <StatCard icon={<Lock size={19} />} label="Locked Accounts" value={String(summary.lockedAccounts)} delta={summary.deltas.locked} deltaPercent="+2 today" goodDirection="down" iconTone="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" className="min-h-[112px]" detail="locked right now" onClick={() => applyFilters({ tab: "lockouts" })} onClickLabel="Show account lockout events" />
        <StatCard icon={<ShieldAlert size={19} />} label="Suspicious Events" value={String(summary.suspicious)} delta={summary.deltas.suspicious} deltaPercent="+3 today" goodDirection="down" iconTone="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" className="min-h-[112px]" detail="in the last 24h" onClick={() => applyFilters({ tab: "suspicious" })} onClickLabel="Show suspicious events" />
      </section>

      {/* Row 1 � activity chart + detections */}
      <section className="grid items-stretch gap-4 xl:grid-cols-12">
        <ChartCard
          title="Login Activity"
          className="xl:col-span-8"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl value={trendRange} options={["24H", "7D", "30D"]} onChange={(value) => setTrendRange(value as AuthTrendRange)} />
              <SegmentedControl value={chartMode} options={["Result", "Method"]} onChange={(value) => setChartMode(value.toLowerCase() as ChartMode)} />
              <AuthCardMenu label="Login activity" onExport={() => handleExport("csv")} />
            </div>
          }
        >
          <LoginActivityChart
            mode={chartMode}
            buckets={trendBuckets}
            methodDistribution={methodDistribution}
            hidden={hiddenSeries}
            peakBucket={trendPeak}
            onBarClick={(index) => updateParams({ bucket: `${trendRange}:${index}`, page: null })}
          />
          {chartMode === "result" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Toggle result series">
              {[
                { name: "Success", count: summary.success, color: "#34D399" },
                { name: "Failed", count: failedBreakdown.failed, color: "#F87171" },
                { name: "Blocked", count: failedBreakdown.blocked, color: "#B91C1C" },
                { name: "Challenged", count: failedBreakdown.challenged, color: "#FBBF24" },
              ].map((entry) => {
                const active = !hiddenSeries.has(entry.name);
                return (
                  <button key={entry.name} type="button" onClick={() => toggleSeries(entry.name)} aria-pressed={active} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-border bg-card text-foreground" : "border-border/60 bg-muted/40 text-muted-foreground opacity-60")}>
                    <i className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                    {entry.name} <b className="tabular-nums">{entry.count.toLocaleString()}</b>
                  </button>
                );
              })}
              <span className="ml-auto text-xs text-muted-foreground">Bar click filters the table below</span>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Toggle method series">
              {METHOD_SERIES.map((entry) => {
                const active = !hiddenSeries.has(entry.name);
                return (
                  <button key={entry.name} type="button" onClick={() => toggleSeries(entry.name)} aria-pressed={active} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-border bg-card text-foreground" : "border-border/60 bg-muted/40 text-muted-foreground opacity-60")}>
                    <i className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                    {entry.name} <b className="tabular-nums">{entry.weight.toLocaleString()}</b>
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Peak failures</p><p className="mt-0.5 font-semibold text-foreground">{trendPeak.label} <span className="text-muted-foreground">(+{(trendPeak.failed + trendPeak.blocked).toLocaleString()})</span></p></div>
            <div><p className="text-xs text-muted-foreground">Failure rate</p><p className="mt-0.5 flex items-center gap-1 font-semibold tabular-nums text-foreground">{failureRate}% <ArrowUp size={12} className="text-rose-600" aria-hidden="true" /></p></div>
            <div><p className="text-xs text-muted-foreground">Unique users</p><p className="mt-0.5 font-semibold tabular-nums text-foreground">{rangeStats.uniqueUsers.toLocaleString()}</p></div>
            <div><p className="text-xs text-muted-foreground">Unique IPs</p><p className="mt-0.5 font-semibold tabular-nums text-foreground">{rangeStats.uniqueIps.toLocaleString()}</p></div>
          </div>
        </ChartCard>

        <div ref={detectionsRef} className="min-w-0 scroll-mt-4 xl:col-span-4">
          <ChartCard
            title="Active Detections"
            className="h-full min-h-[280px]"
            actions={
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label="Detection status filter">
                  {(["open", "all"] as const).map((value) => (
                    <button key={value} type="button" aria-pressed={detectionFilter === value} onClick={() => setDetectionFilter(value)} className={cn("rounded-md px-2.5 py-1 text-xs font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", detectionFilter === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                      {value}
                    </button>
                  ))}
                </div>
                <AuthCardMenu label="Active detections" onExport={() => handleExport("csv")} />
              </div>
            }
          >
            <ul className="flex flex-1 flex-col divide-y divide-border">
              {detections
                .filter((detection) => detectionFilter === "all" || detection.status === "Open" || detection.status === "Investigating")
                .slice(0, 6)
                .map((detection) => {
                  const isIp = !detection.subject.includes("@");
                  return (
                    <li key={detection.id} className="group relative">
                      <button type="button" onClick={() => setDetectionDialog(detection)} className="flex w-full flex-col gap-1 rounded-md px-1 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40" aria-label={`Open detection ${detection.id}`}>
                        <span className="flex w-full items-center gap-2">
                          <DetectionTypeIcon type={detection.type} />
                          <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold text-foreground">{detection.subject}</span>
                          <DetectionStatusInline status={detection.status} />
                        </span>
                        <span className="flex w-full items-center gap-2 pl-9">
                          <SeverityBadge severity={detection.severity} />
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground"><b className="tabular-nums text-foreground">{detection.count.toLocaleString()}</b> events · since {timeAgo(detection.firstSeen).replace(" ago", "")}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{timeAgo(detection.lastSeen)}</span>
                        </span>
                      </button>
                      <div className="absolute inset-y-0 right-0 hidden items-center gap-1 rounded-l-md border-l border-border bg-card/95 pl-2 pr-1 backdrop-blur-sm group-hover:flex focus-within:flex" aria-label="Quick actions">
                        {isIp
                          ? <button type="button" title="Block IP" aria-label={`Block ${detection.subject}`} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-red-200 px-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10" onClick={() => setBlockIps([detection.subject])}><Ban size={12} aria-hidden="true" />Block</button>
                          : <button type="button" title="Lock user" aria-label={`Lock ${detection.subject}`} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-amber-200 px-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/10" onClick={() => setLockTarget({ user: detection.subject, locked: isAuthAccountLocked(detection.subject) })}><Lock size={12} aria-hidden="true" />Lock</button>}
                        <button type="button" title="Mark as Investigating" aria-label={`Investigate ${detection.id}`} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-blue-200 px-2 text-xs font-semibold text-blue-800 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10" onClick={() => { setAuthDetectionStatus(detection.id, "Investigating"); setDetections((current) => current.map((item) => item.id === detection.id ? { ...item, status: "Investigating" } : item)); notify({ message: `${detection.id} assigned to IAM team` }); }}><Search size={12} aria-hidden="true" />Investigate</button>
                      </div>
                    </li>
                  );
                })}
              {detections.filter((detection) => detectionFilter === "all" || detection.status === "Open" || detection.status === "Investigating").length === 0 && (
                <li className="py-8 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-1 text-emerald-500" size={20} />No open detections</li>
              )}
            </ul>
            <div className="mt-auto border-t border-border pt-3">
              <ViewAllLink href="/authentication-events?tab=suspicious" label="View all detections" />
            </div>
          </ChartCard>
        </div>
      </section>

      {/* Row 2 � methods, failure reasons, locations */}
      <section className="grid items-stretch gap-4 xl:grid-cols-3">
        <ChartCard
          title="Auth Methods"
          actions={<AuthCardMenu label="Auth methods" onExport={() => handleExport("csv")} />}
        >
          <div className="flex flex-1 flex-col items-center gap-3">
            <MethodDonut onSelect={(method) => applyFilters({ method })} />
            <ul className="grid w-full grid-cols-3 gap-2 text-sm">
              {AUTH_METHOD_COUNTS.map((entry) => (
                <li key={entry.method}>
                  <button type="button" onClick={() => applyFilters({ method: entry.method })} className="flex w-full flex-col items-start gap-0.5 rounded-md p-1.5 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Filter by ${entry.method}`}>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: METHOD_SERIES.find((series) => series.name === entry.method)?.color }} aria-hidden="true" />{entry.method}</span>
                    <span className="flex w-full items-baseline justify-between gap-2"><b className="tabular-nums text-foreground">{entry.count.toLocaleString()}</b><span className="text-xs tabular-nums text-muted-foreground">{((entry.count / summary.total) * 100).toFixed(1)}%</span></span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-auto w-full border-t border-border pt-3">
              <button type="button" onClick={() => applyFilters({ method: "SSO/SAML" })} className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle size={12} aria-hidden="true" />SSO failure rate {AUTH_SSO_FAILURE_RATE_PCT}%
              </button>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Failure Reasons"
          actions={<AuthCardMenu label="Failure reasons" onExport={() => handleExport("csv")} />}
        >
          <ul className="flex flex-1 flex-col justify-center gap-[7px]">
            {AUTH_FAILURE_REASONS.slice().sort((a, b) => b.count - a.count).map((entry) => {
              const pct = Math.round((entry.count / AUTH_FAILURE_REASONS.reduce((acc, item) => acc + item.count, 0)) * 100);
              return (
                <li key={entry.reason}>
                  <button type="button" onClick={() => applyFilters({ reason: entry.reason })} className="group flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Filter by failure reason ${entry.reason}`}>
                    <span className="w-40 shrink-0 truncate text-xs text-muted-foreground group-hover:text-foreground">{entry.reason}</span>
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-rose-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <b className="w-9 shrink-0 text-right text-xs tabular-nums text-foreground">{entry.count.toLocaleString()}</b>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">top reason: <b className="text-foreground">Wrong password � {Math.round((724 / AUTH_FAILURE_REASONS.reduce((acc, item) => acc + item.count, 0)) * 100)}%</b></p>
        </ChartCard>

        <ChartCard
          title="Logins by Location"
          actions={<AuthCardMenu label="Logins by location" onExport={() => handleExport("csv")} />}
        >
          <ul className="flex flex-1 flex-col divide-y divide-border">
            {AUTH_LOCATIONS.map((location) => (
              <li key={location.countryCode}>
                <button type="button" onClick={() => applyFilters({ country: location.country })} className="flex w-full items-center gap-2 py-[7px] text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1" aria-label={`Filter by country ${location.country}`}>
                  <CountryFlag code={location.countryCode} name={location.country} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                    {location.country}
                    {location.unusual && <span className="ml-1.5 inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 align-middle text-xs font-semibold text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300">unusual</span>}
                  </span>
                  <span className="w-14 text-right text-xs tabular-nums text-foreground">{location.logins.toLocaleString()}</span>
                  <span className={cn("w-12 text-right text-xs tabular-nums", location.failedPct >= 20 ? "font-semibold text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>{location.failedPct}%</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">Failed % per country � <b className="text-foreground">unusual</b> = first country seen for this tenant</p>
        </ChartCard>
      </section>

      {/* Row 3 � targeted accounts, top IPs, privileged & service accounts */}
      <section className="grid items-stretch gap-4 xl:grid-cols-3">
        <ChartCard
          title="Top Targeted Accounts"
          actions={<AuthCardMenu label="Top targeted accounts" onExport={() => handleExport("csv")} />}
        >
          <ul className="flex flex-1 flex-col divide-y divide-border">
            {AUTH_TARGETED_ACCOUNTS.map((account) => {
              const max = AUTH_TARGETED_ACCOUNTS[0].failedAttempts;
              const lockedUser = account.locked || isAuthAccountLocked(account.user);
              return (
                <li key={account.user} className="group flex items-center gap-2 py-2">
                  <button type="button" onClick={() => updateParams({ q: account.user, page: null })} className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1 hover:bg-muted/50" aria-label={`Filter events for ${account.user}`}>
                    <InitialsAvatar name={account.user.split("@")[0]} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5"><span className="truncate text-[13px] font-medium text-foreground">{account.user}</span>{lockedUser && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"><Lock size={10} />Locked</span>}</span>
                      <span className="mt-0.5 flex items-center gap-2"><span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-rose-400" style={{ width: `${Math.round((account.failedAttempts / max) * 100)}%` }} /></span><span className="text-xs tabular-nums text-muted-foreground">{account.failedAttempts} failed � {timeAgo(new Date(Date.now() - account.lastAttemptMinutesAgo * 60_000).toISOString())}</span></span>
                    </span>
                  </button>
                  <button type="button" onClick={() => setLockTarget({ user: account.user, locked: Boolean(lockedUser) })} aria-label={lockedUser ? `Unlock ${account.user}` : `Lock ${account.user}`} title={lockedUser ? "Unlock account" : "Lock account"} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100">
                    {lockedUser ? <LockOpen size={14} /> : <Lock size={14} />}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">Sorted by failed attempts � <button type="button" className="font-semibold text-primary hover:underline" onClick={() => applyFilters({ tab: "failed" })}>view all failures ?</button></p>
        </ChartCard>

        <ChartCard
          title="Top Source IPs"
          actions={<AuthCardMenu label="Top source IPs" onExport={() => handleExport("csv")} />}
        >
          <ul className="flex flex-1 flex-col divide-y divide-border">
            {[
              ...AUTH_BRUTE_FORCE_SUSPECTS.map((suspect) => ({ ip: suspect.ip, country: suspect.country, countryCode: suspect.countryCode, attempts: suspect.attempts, users: suspect.usersTargeted, status: isAuthIpBlocked(suspect.ip) ? "Blocked" as const : suspect.status, anonymizer: suspect.anonymizer === true })),
              { ip: "198.51.100.87", country: "China", countryCode: "CN", attempts: 96, users: 12, status: "Watch" as const, anonymizer: false },
              { ip: "203.0.113.102", country: "Russia", countryCode: "RU", attempts: 88, users: 9, status: "Allowed" as const, anonymizer: false },
              { ip: "192.168.88.45", country: "Pakistan", countryCode: "PK", attempts: 64, users: 5, status: "Allowed" as const, anonymizer: false },
            ].slice(0, 6).map((source) => (
              <li key={source.ip} className="flex items-center gap-2 py-2">
                <CountryFlag code={source.countryCode} name={source.country} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px] font-semibold text-foreground">{source.ip}{source.anonymizer && <span className="ml-1.5 rounded border border-violet-200 bg-violet-50 px-1 py-0.5 align-middle text-xs font-semibold text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300" title="Traffic via known anonymizer exit">anonymizer</span>}</p>
                  <p className="text-xs text-muted-foreground"><b className="tabular-nums text-foreground">{source.attempts}</b> attempts � <b className="tabular-nums text-foreground">{source.users}</b> users targeted</p>
                </div>
                <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", source.status === "Blocked" ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" : source.status === "Watch" ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" : "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300")}>
                  <i className={cn("h-1.5 w-1.5 rounded-full", source.status === "Blocked" ? "bg-red-500" : source.status === "Watch" ? "bg-amber-500" : "bg-slate-400")} aria-hidden="true" />
                  {source.status}
                </span>
                {source.status !== "Blocked" && <button type="button" onClick={() => setBlockIps([source.ip])} className="shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10">Block</button>}
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">Public ranges shown are documentation (TEST-NET) addresses used for simulation.</p>
        </ChartCard>

        <ChartCard
          title="Privileged & Service Accounts"
          actions={<AuthCardMenu label="Privileged and service accounts" onExport={() => handleExport("csv")} />}
        >
          <ul className="flex flex-1 flex-col divide-y divide-border">
            {PRIVILEGED_ROWS.map((account) => (
              <li key={account.account}>
                <Link href={`/access-control?user=${encodeURIComponent(account.account)}`} className="flex items-center gap-2 py-2 rounded-md px-1 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40">
                  <InitialsAvatar name={account.account.replace(/[@.-]/g, " ")} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5"><span className="truncate text-[13px] font-medium text-foreground">{account.account}</span><span className={cn("inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-xs font-semibold", account.type === "Admin" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" : "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300")}>{account.type}</span>{account.interactiveService && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300" title="Interactive login from a service account"><AlertTriangle size={10} />interactive</span>}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">Last login {timeAgo(account.lastLogin)}{account.flags.map((flag) => <span key={flag} className="rounded border border-orange-200 bg-orange-50 px-1 py-0.5 text-xs font-medium text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">{flag === "off_hours" ? "off-hours" : flag === "new_location" ? "new location" : flag}</span>)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground"><b className="text-red-600 dark:text-red-400">backup-agent</b> signed in interactively via Password � service accounts should use tokens.</p>
        </ChartCard>
      </section>

      {/* Events table */}
      <section ref={tableTopRef} aria-label="Events" className="scroll-mt-4">
        <Card className="flex min-w-0 flex-col rounded-xl p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 pb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Authentication Events</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">400 most recent sampled events � totals in tabs are fleet-wide (24h)</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label="Event tabs" className="flex flex-wrap items-center gap-1">
                {TABS.map((entry) => (
                  <button key={entry.key} role="tab" aria-selected={tab === entry.key} type="button" onClick={() => applyFilters({ tab: entry.key })} className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === entry.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
                    {entry.label}
                    <span className={cn("rounded-full px-1.5 py-0.5 text-xs tabular-nums", tab === entry.key ? "bg-black/15" : "bg-muted")}>{tabCounts[entry.key].toLocaleString()}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => updateParams({ compact: compact ? null : "1" })} aria-pressed={compact} className={cn("h-9 rounded-lg border px-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", compact ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")} title="Toggle compact rows">Compact</button>
              <AuthCardMenu label="Events table" onExport={() => handleExport("csv")} />
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-1" role="group" aria-label="Filter by result">
              {(["all", "Success", "Failed", "Blocked", "Challenged"] as const).map((value) => (
                <button key={value} type="button" onClick={() => applyFilters({ result: value })} aria-pressed={resultFilter === value} className={cn("h-8 rounded-md border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", resultFilter === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent")}>
                  {value === "all" ? "All results" : value}
                </button>
              ))}
            </div>
            <FilterSelect value={methodFilter} onChange={(value) => applyFilters({ method: value })} label="Method" options={["Password", "SSO/SAML", "SSH key", "API token", "MFA/TOTP"]} allLabel="All methods" />
            <FilterSelect value={typeFilter} onChange={(value) => applyFilters({ type: value })} label="Event type" options={["Login", "Logout", "MFA challenge", "Password reset", "Account lockout", "SSO assertion", "Token issued"]} allLabel="All types" />
            <FilterSelect value={countryFilter} onChange={(value) => applyFilters({ country: value })} label="Country" options={AUTH_LOCATIONS.map((location) => location.country)} allLabel="All countries" />
            <FilterSelect value={userTypeFilter} onChange={(value) => applyFilters({ userType: value })} label="User type" options={["Human", "Admin", "Service"]} allLabel="All user types" />
            <FilterSelect value={riskFilter} onChange={(value) => applyFilters({ risk: value })} label="Risk" options={["low", "medium", "high"]} allLabel="All risk" />
            <FilterSelect value={range} onChange={(value) => updateParams({ range: value, page: null, bucket: null })} label="Time range" options={["1H", "24H", "7D", "30D"]} allLabel="" hideAll />
            <div className="relative min-w-[180px] flex-1 sm:min-w-[220px]">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input ref={searchRef} value={query} onChange={(event) => applyFilters({ q: event.target.value })} onKeyDown={(event) => { if (event.key === "Escape") applyFilters({ q: null }); }} placeholder="Search user, IP, app�" aria-label="Search events" className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-8 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" />
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">/</kbd>
            </div>
            {(activeFilterCount > 0) && (
              <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="h-9 gap-1 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring inline-flex items-center"><X size={12} />Reset ({activeFilterCount})</button>
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
                { key: "save", label: "Save current view�", onSelect: () => setSaveViewOpen(true) },
                ...(savedViews.length > 0 ? [{ key: "clear", label: "Remove all saved views", danger: true, onSelect: () => { persistSavedViews([]); setSavedViews([]); } }] : []),
              ]}
            />
            <button type="button" role="switch" aria-checked={liveTail} onClick={() => { setLiveTail((value) => !value); if (liveTail) { setPendingNew(0); liveBuffer.current = []; } }} className={cn("inline-flex h-9 items-center gap-2 rounded-md border px-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", liveTail ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-border text-muted-foreground hover:bg-accent")}>
              <span className={cn("h-2 w-2 rounded-full", liveTail ? "animate-pulse bg-emerald-500" : "bg-slate-400")} aria-hidden="true" />
              Live tail
            </button>
            {pendingNew > 0 && (
              <button type="button" onClick={mergeLiveBuffer} className="h-9 animate-pulse rounded-full border border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">{pendingNew} new events</button>
            )}
            {activeBucket && (
              <button type="button" onClick={() => updateParams({ bucket: null, page: null })} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300" title="Clear bucket filter">
                Bucket {activeBucket.label} <X size={11} />
              </button>
            )}
            {reasonFilter !== "all" && (
              <button type="button" onClick={() => updateParams({ reason: null, page: null })} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300" title="Clear reason filter">
                {reasonFilter} <X size={11} />
              </button>
            )}
            {(flagFilters.length > 0 || reviewFilter !== "all") && (
              <button type="button" onClick={() => updateParams({ flags: null, review: null, page: null })} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 text-xs font-semibold text-orange-800 hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300" title="Clear saved-view filters">
                {[...flagFilters, reviewFilter !== "all" ? `review: ${reviewFilter}` : null].filter(Boolean).join(", ")} <X size={11} />
              </button>
            )}
          </div>

          {/* Bulk action bar */}
          {selectionCount > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-primary/5 px-4 py-2 text-sm">
              <b className="tabular-nums text-foreground">{selectionCount} selected</b>
              <div className="flex items-center gap-1">
                <button type="button" onClick={bulkMarkReviewed} className="h-8 rounded-md px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Mark reviewed</button>
                <button type="button" onClick={bulkBlockIps} className="h-8 rounded-md px-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-red-500/10">Block IPs</button>
                <button type="button" onClick={bulkExport} className="h-8 rounded-md px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Export</button>
              </div>
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-2 py-1">Clear selection</button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto" onMouseEnter={() => setHoveringTable(true)} onMouseLeave={() => setHoveringTable(false)}>
            <table className="w-full min-w-[1080px] text-left text-[13px]">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2.5"><input type="checkbox" aria-label="Select all events on this page" className="h-4 w-4 accent-[var(--primary)]" checked={pageRows.length > 0 && pageRows.every((row) => selected.has(row.id))} onChange={toggleSelectPage} /></th>
                  <th className="px-2 py-2.5"><button type="button" onClick={() => toggleSort("time")} className="inline-flex items-center gap-1 font-semibold uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Time {sort.key === "time" ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-60" />}</button></th>
                  <th className="px-2 py-2.5 font-semibold">User</th>
                  <th className="px-2 py-2.5 font-semibold">Event</th>
                  <th className="hidden px-2 py-2.5 font-semibold md:table-cell">Method</th>
                  <th className="px-2 py-2.5"><button type="button" onClick={() => toggleSort("result")} className="inline-flex items-center gap-1 font-semibold uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Result {sort.key === "result" ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-60" />}</button></th>
                  <th className="px-2 py-2.5 font-semibold">Source</th>
                  <th className="hidden px-2 py-2.5 font-semibold lg:table-cell">Target</th>
                  <th className="hidden px-2 py-2.5 font-semibold xl:table-cell">Device</th>
                  <th className="px-2 py-2.5"><button type="button" onClick={() => toggleSort("riskScore")} className="inline-flex items-center gap-1 font-semibold uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Risk {sort.key === "riskScore" ? (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-60" />}</button></th>
                  <th className="px-2 py-2.5 text-right"><span className="sr-only">Actions</span><span className="mr-2 hidden items-center gap-1.5 font-semibold normal-case sm:inline-flex">UTC<button type="button" onClick={() => updateParams({ tz: utc ? null : "utc" })} role="switch" aria-checked={utc} aria-label="Toggle UTC times" className={cn("relative h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", utc ? "bg-primary" : "bg-muted")}><span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", utc ? "left-[18px]" : "left-0.5")} /></button></span></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((event) => {
                  const accountLocked = isAuthAccountLocked(event.user);
                  const targetLink = targetHref(event);
                  const risk = event.riskScore;
                  return (
                    <tr key={event.id} tabIndex={0} role="link" aria-label={`Open event ${event.id}`} onClick={() => openEvent(event.id)} onKeyDown={(keyEvent) => { if (keyEvent.key === "Enter" || keyEvent.key === " ") { keyEvent.preventDefault(); openEvent(event.id); } }} className="group relative cursor-pointer border-b border-border/70 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40">
                      <td className={cn("relative px-3 align-middle", compact ? "py-1.5" : "py-2.5")}>
                        <RiskStripe score={risk} />
                        <input type="checkbox" aria-label={`Select ${event.id}`} className="ml-1 h-4 w-4 accent-[var(--primary)]" checked={selected.has(event.id)} onClick={(clickEvent) => clickEvent.stopPropagation()} onKeyDown={(keyEvent) => keyEvent.stopPropagation()} onChange={() => toggleSelect(event.id)} />
                      </td>
                      <td className="px-2 py-2 align-middle whitespace-nowrap" title={fullTime(event.time, utc)}>
                        <span className="block font-semibold tabular-nums text-foreground">{timeAgo(event.time)}</span>
                        <span className="block text-[11px] text-muted-foreground">{dateTimeShort(event.time, utc)}{utc ? " UTC" : ""}</span>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <div className="flex items-center gap-2">
                          <InitialsAvatar name={event.user.split("@")[0]} size={compact ? 22 : 28} />
                          <span className="min-w-0">
                            <span className="block max-w-[180px] truncate font-medium text-foreground" title={event.user}>{event.user}</span>
                            <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">{event.userType}{accountLocked ? " � locked" : ""}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 align-middle whitespace-nowrap">
                        <span className="flex items-center gap-1.5"><span className="font-mono text-[13px] font-semibold text-foreground">{event.id}</span><span className="text-muted-foreground">�</span><span className="text-muted-foreground">{event.eventType}</span></span>
                      </td>
                      <td className="hidden px-2 py-2 align-middle whitespace-nowrap text-muted-foreground md:table-cell">{event.method}</td>
                      <td className="px-2 py-2 align-middle"><ResultBadge result={event.result} /></td>
                      <td className="px-2 py-2 align-middle">
                        <div className="flex items-center gap-1.5">
                          <CountryFlag code={event.countryCode} name={event.country} className="h-[14px] w-[19px]" />
                          <span className="min-w-0"><span className="block font-mono text-[12px] text-foreground">{event.ip}</span><span className="block text-[11px] text-muted-foreground">{event.city}</span></span>
                        </div>
                      </td>
                      <td className="hidden px-2 py-2 align-middle whitespace-nowrap lg:table-cell">
                        {targetLink
                          ? <Link href={targetLink} onClick={(clickEvent) => clickEvent.stopPropagation()} className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">{event.target}</Link>
                          : <span className="text-muted-foreground">{event.target}</span>}
                      </td>
                      <td className="hidden px-2 py-2 align-middle whitespace-nowrap text-muted-foreground xl:table-cell">
                        <span className="flex items-center gap-1.5" title={event.device}>{event.browser === "curl" || event.browser === "OpenSSH" ? <SquareTerminal size={13} aria-hidden="true" /> : <Laptop size={13} aria-hidden="true" />}{event.browser} � {event.os}</span>
                      </td>
                      <td className="px-2 py-2 align-middle"><div className="flex flex-col gap-1"><RiskScoreBar score={risk} /><FlagChips flags={event.riskFlags} max={2} /></div></td>
                      <td className="px-2 py-2 align-middle text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(clickEvent) => clickEvent.stopPropagation()} onKeyDown={(keyEvent) => keyEvent.stopPropagation()}>
                          <button type="button" title="Block IP" aria-label={`Block ${event.ip}`} onClick={() => setBlockIps([event.ip])} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"><Ban size={13} /></button>
                          <button type="button" title={accountLocked ? "Unlock user" : "Lock user"} aria-label={accountLocked ? `Unlock ${event.user}` : `Lock ${event.user}`} onClick={() => setLockTarget({ user: event.user, locked: accountLocked })} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100">{accountLocked ? <LockOpen size={13} /> : <Lock size={13} />}</button>
                          <AlertMenu
                            label={`Event ${event.id} actions`}
                            align="end"
                            trigger={<button type="button" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Event ${event.id} actions`}><MoreVertical size={14} /></button>}
                            items={[
                              { key: "review", label: "Mark reviewed", onSelect: () => markAuthReviewed([event.id], "Reviewed") },
                              { key: "fp", label: "False positive", onSelect: () => setFalsePositiveIds([event.id]) },
                              { key: "d1", label: "", divider: true },
                              { key: "block", label: "Block IP", danger: true, onSelect: () => setBlockIps([event.ip]) },
                              { key: "lock", label: accountLocked ? "Unlock user" : "Lock user", onSelect: () => setLockTarget({ user: event.user, locked: accountLocked }) },
                              { key: "reset", label: "Force password reset", onSelect: () => setForceResetTarget(event.user) },
                              { key: "revoke", label: "Revoke sessions", danger: true, onSelect: () => setRevokeTarget(event.user) },
                              { key: "incident", label: "Create incident", onSelect: () => setIncidentPrefill({ title: `${event.result === "Failed" ? "Failed login" : event.result}: ${event.user} from ${event.ip}`, impact: `Authentication anomaly on ${event.target} (${event.eventType} � ${event.method}).`, hosts: event.targetKind === "server" ? [event.target] : undefined }) },
                              { key: "d2", label: "", divider: true },
                              { key: "copy", label: "Copy link", onSelect: () => copyLink(event.id) },
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
                      <p className="mt-2 text-sm font-semibold text-foreground">No events match these filters</p>
                      <p className="mt-1 text-xs text-muted-foreground">Try removing a filter or clearing the search.</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => router.replace(pathname, { scroll: false })}><RotateCcw size={13} />Reset filters</Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination page={clampedPage} pageSize={pageSize} totalItems={filtered.length} onPageChange={(next) => updateParams({ page: String(next) })} onPageSizeChange={(size) => { setPageSize(size); updateParams({ page: null }); }} noun="events" pageSizeOptions={[10, 25, 50]} />
          <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">Showing the {filtered.length.toLocaleString()} most recent matching events sampled from a 24h fleet-wide workload ({summary.total.toLocaleString()} events). Times shown in <b>{utc ? "UTC" : "local time"}</b> � {timeZoneLabel()}.</p>
        </Card>
      </section>

      {/* Dialogs */}
      <BlockIpDialog open={blockIps != null} onOpenChange={(open) => { if (!open) setBlockIps(null); }} ips={blockIps ?? []} onDone={(result) => { notify(result); setSelected(new Set()); }} />
      <LockAccountDialog open={lockTarget != null} onOpenChange={(open) => { if (!open) setLockTarget(null); }} user={lockTarget?.user ?? null} locked={lockTarget?.locked ?? false} onDone={notify} />
      <ForceResetDialog open={forceResetTarget != null} onOpenChange={(open) => { if (!open) setForceResetTarget(null); }} user={forceResetTarget} onDone={notify} />
      <RevokeSessionsDialog open={revokeTarget != null} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }} user={revokeTarget} onDone={notify} />
      <MarkReviewedDialog open={markReviewedIds.length > 0} onOpenChange={(open) => { if (!open) setMarkReviewedIds([]); }} ids={markReviewedIds} onDone={(result) => { notify(result); setMarkReviewedIds([]); setSelected(new Set()); }} />
      <FalsePositiveDialog open={falsePositiveIds.length > 0} onOpenChange={(open) => { if (!open) setFalsePositiveIds([]); }} ids={falsePositiveIds} onDone={(result) => { notify(result); setFalsePositiveIds([]); setSelected(new Set()); }} />
      <CreateIncidentDialog open={incidentPrefill != null} onOpenChange={(open) => { if (!open) setIncidentPrefill(null); }} prefill={incidentPrefill ?? { title: "", impact: "" }} onDone={notify} />
      <DetectionDialog
        detection={detectionDialog}
        open={detectionDialog != null}
        onOpenChange={(open) => { if (!open) setDetectionDialog(null); }}
        onBlockIp={(ip) => { setDetectionDialog(null); setBlockIps([ip]); }}
        onLockUser={(user) => { setDetectionDialog(null); setLockTarget({ user, locked: isAuthAccountLocked(user) }); }}
        onInvestigate={(id) => { setAuthDetectionStatus(id, "Investigating"); setDetections((current) => current.map((item) => item.id === id ? { ...item, status: "Investigating" } : item)); setDetectionDialog(null); notify({ message: `${id} assigned to IAM team` }); }}
      />
      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent className="w-[min(420px,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>Save current view</DialogTitle>
            <DialogDescription>Stores the active filters as a named view in this browser.</DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            View name
            <input autoFocus value={saveViewName} onChange={(event) => setSaveViewName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveCurrentView(); }} placeholder="e.g. Failed SSO from unusual countries" aria-label="View name" className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
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

const PRIVILEGED_ROWS: Array<{ account: string; type: "Admin" | "Service"; lastLogin: string; flags: Array<"off_hours" | "new_location">; interactiveService?: boolean }> = (() => {
  const now = Date.now();
  return [
    { account: "admin@nexus.io", type: "Admin", lastLogin: new Date(now - 2 * 3_600_000).toISOString(), flags: [] },
    { account: "legacy@nexus.io", type: "Admin", lastLogin: new Date(now - 12 * 60_000).toISOString(), flags: ["off_hours", "new_location"] },
    { account: "ops@nexus.io", type: "Admin", lastLogin: new Date(now - 8 * 60_000).toISOString(), flags: [] },
    { account: "backup-agent", type: "Service", lastLogin: new Date(now - 5 * 3_600_000).toISOString(), flags: ["off_hours"], interactiveService: true },
    { account: "monitoring-probe", type: "Service", lastLogin: new Date(now - 5 * 60_000).toISOString(), flags: [] },
    { account: "ci-cd-bot", type: "Service", lastLogin: new Date(now - 3 * 3_600_000).toISOString(), flags: ["off_hours"] },
  ];
})();

type FilterOption = string;

function FilterSelect({ value, onChange, label, options, allLabel, hideAll = false }: { value: string; onChange: (value: string) => void; label: string; options: FilterOption[]; allLabel: string; hideAll?: boolean }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className="h-9 max-w-[150px] rounded-md border border-input bg-card px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
      {!hideAll && <option value="all">{allLabel}</option>}
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function DetectionTypeIcon({ type }: { type: AuthDetection["type"] }) {
  const Icon = { brute_force: Bug, password_spray: Users, impossible_travel: MapPin, mfa_fatigue: KeyRound, off_hours: Timer }[type] as typeof Bug;
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" aria-hidden="true">
      <Icon size={14} />
    </span>
  );
}

function DetectionStatusInline({ status }: { status: AuthDetection["status"] }) {
  const classes = {
    Open: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    Investigating: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    Resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    "False positive": "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300",
  }[status];
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold", classes)}>{status}</span>;
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

interface LoginActivityChartProps {
  mode: ChartMode;
  buckets: Array<{ label: string; success: number; failed: number; blocked: number; challenged: number; total: number }>;
  methodDistribution: Array<{ label: string; parts: number[] }>;
  hidden: Set<string>;
  peakBucket: { label: string; failed: number; blocked: number };
  onBarClick?: (index: number) => void;
}

function LoginActivityChart({ mode, buckets, methodDistribution, hidden, peakBucket, onBarClick }: LoginActivityChartProps) {
  const hostRef = useEChart(
    useMemo<EChartsOption>(() => {
      const labels = buckets.map((bucket) => bucket.label);
      const grid = { left: 40, right: 16, top: 38, bottom: 26 } as const;
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
      const maxStack = buckets.reduce((acc, bucket) => Math.max(acc, bucket.total), 0);
      const valueAxis = {
        type: "value" as const,
        max: Math.ceil(maxStack * 1.18),
        splitLine: { lineStyle: { type: "dashed" as const, color: "#E2E8F0" } },
        axisLabel: { color: "#64748B", fontSize: 10 },
      };
      if (mode === "result") {
        const series = [
          { name: "Success", color: "#34D399", data: buckets.map((bucket) => bucket.success) },
          { name: "Failed", color: "#F87171", data: buckets.map((bucket) => bucket.failed) },
          { name: "Blocked", color: "#B91C1C", data: buckets.map((bucket) => bucket.blocked) },
          { name: "Challenged", color: "#FBBF24", data: buckets.map((bucket) => bucket.challenged) },
        ].filter((entry) => !hidden.has(entry.name));
        const failureSeriesIndex = series.findIndex((entry) => entry.name === "Failed");
        return {
          grid,
          tooltip,
          xAxis: { type: "category" as const, data: labels, ...axis },
          yAxis: valueAxis,
          series: series.map((entry, index) => ({
            name: entry.name,
            type: "bar" as const,
            stack: "total",
            barMaxWidth: 18,
            itemStyle: { color: entry.color, borderRadius: index === series.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0] },
            emphasis: { focus: "series" as const },
            data: entry.data,
            ...(index === failureSeriesIndex ? {
              markPoint: {
                symbol: "pin",
                symbolSize: 38,
                itemStyle: { color: "#EF4444" },
                label: { color: "#fff", fontSize: 8, formatter: `Brute force\n${peakBucket.label}` },
                data: [{ type: "max" as const, name: "Peak failures" }],
              },
            } : {}),
          })),
        };
      }
      const methodSeries = METHOD_SERIES.filter((entry) => !hidden.has(entry.name));
      return {
        grid,
        tooltip,
        xAxis: { type: "category" as const, data: labels, ...axis },
        yAxis: valueAxis,
        series: methodSeries.map((entry) => ({
          name: entry.name,
          type: "bar" as const,
          stack: "total",
          barMaxWidth: 18,
          itemStyle: { color: entry.color },
          emphasis: { focus: "series" as const },
          data: methodDistribution.map((bucket) => bucket.parts[METHOD_SERIES.findIndex((series) => series.name === entry.name)]),
        })),
      };
    }, [buckets, methodDistribution, hidden, mode, peakBucket]),
    mode === "result" ? "Stacked auth results per bucket" : "Stacked auth methods per bucket",
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

  return <div ref={hostRef} className="h-[230px] min-h-[230px] w-full flex-1" role="img" aria-label="Authentication activity chart" />;
}

function MethodDonut({ onSelect }: { onSelect: (method: string) => void }) {
  const summary = getAuthSummary();
  const hostRef = useEChart(
    useMemo<EChartsOption>(() => ({
      tooltip: { trigger: "item", confine: true, backgroundColor: "#0f172a", borderWidth: 0, textStyle: { color: "#fff", fontSize: 12 } },
      series: [
        {
          name: "Auth methods",
          type: "pie",
          radius: ["52%", "100%"],
          avoidLabelOverlap: true,
          label: { show: false },
          itemStyle: { borderRadius: 4, borderColor: "transparent", borderWidth: 2 },
          data: AUTH_METHOD_COUNTS.map((entry) => ({ name: entry.method, value: entry.count, itemStyle: { color: METHOD_SERIES.find((series) => series.name === entry.method)?.color } })),
        },
      ],
    }), [summary.total]),
    "Auth method distribution donut chart",
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
    <div className="relative h-[130px] min-h-[130px] w-[130px]">
      <div ref={hostRef} className="absolute inset-0" role="img" aria-label="Auth methods donut chart" />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <b className="font-display text-[18px] leading-none text-foreground tabular-nums">{summary.total.toLocaleString()}</b>
        <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">logins · 24h</span>
      </div>
    </div>
  );
}
