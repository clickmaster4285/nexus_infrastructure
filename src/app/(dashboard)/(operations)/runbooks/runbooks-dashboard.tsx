"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown, ArrowUp, ArrowUpDown, ArrowRight, ArrowUpRight, BookOpen, CheckCircle2, Clock, FilePlus2, FileDown, FileUp, ListFilter, MoreVertical,
  Eye, Play, Rocket, RotateCcw, Search, ShieldAlert, Star, Timer, X, ChevronDown,
} from "lucide-react";

import { useRunbooks } from "@/hooks/useRunbooks";
import { ALERT_RULE_LIST } from "@/mocks/alertRules";
import {
  isNeedsReview, mutateRunbooks,
  type Runbook, type RunbookCategory, type RunbookSeverity, type RunbookStatus,
} from "@/mocks/runbooks";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ChartCard, Chip, SegmentedControl } from "@/components/logs/primitives";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { Pagination } from "@/components/shared/pagination";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { TechLogo } from "@/components/shared/icon";
import { ViewAllLink } from "@/components/shared/view-all-link";
import {
  ExecutionResultBadge, RunbookSeverityBadge, RunbookStatusBadge,
} from "@/components/shared/runbook-badges";
import { formatDate, formatDurationMs, formatMinutes, timeAgo } from "@/components/shared/runbook-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const STATUS_FILTERS: readonly ("All" | RunbookStatus)[] = ["All", "Published", "Draft", "Needs review", "Archived"];
const CATEGORY_OPTIONS: readonly ("all" | RunbookCategory)[] = ["all", "Database", "Network", "Compute", "Storage", "Application", "Security", "Backup", "General"];
const SEVERITY_OPTIONS: readonly ("all" | RunbookSeverity)[] = ["all", "Critical", "High", "Medium", "Low"];
const SERVICE_OPTIONS = ["all", "api-server-01", "api-server-02", "app-server-02", "cache-01", "db-01", "db-02", "edge-01", "storage-01", "worker-01", "web-app-01"];
const SEVERITY_RANK: Record<RunbookSeverity, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const SEVERITY_STRIPE: Record<RunbookSeverity, string> = {
  Critical: "shadow-[inset_3px_0_0_0_oklch(0.5771_0.2152_27.33)]",
  High: "shadow-[inset_3px_0_0_0_oklch(0.6461_0.1943_41.12)]",
  Medium: "shadow-[inset_3px_0_0_0_oklch(0.6658_0.1574_58.32)]",
  Low: "shadow-[inset_3px_0_0_0_oklch(0.6231_0.188_259.81)]",
};

interface SavedView { name: string; query: string; status: string; category: string; severity: string; service: string; owner: string; favoritesOnly: boolean }

const PRESET_VIEWS: SavedView[] = [
  { name: "My runbooks", query: "", status: "all", category: "all", severity: "all", service: "all", owner: "you@nexus.io", favoritesOnly: false },
  { name: "Needs review", query: "", status: "Needs review", category: "all", severity: "all", service: "all", owner: "all", favoritesOnly: false },
  { name: "Critical", query: "", status: "all", category: "all", severity: "Critical", service: "all", owner: "all", favoritesOnly: false },
  { name: "Favorites", query: "", status: "all", category: "all", severity: "all", service: "all", owner: "all", favoritesOnly: true },
];

const SAVED_VIEWS_KEY = "runbooks.savedViews";
const FAVORITES_KEY = "runbooks.favorites";

function readStorage<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStorage(key: string, value: unknown): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / quota) */
  }
}

/** Split text around matches of `query` and render <mark> highlights. */
function highlight(text: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const lower = text.toLowerCase();
  const needle = trimmed.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let index = lower.indexOf(needle);
  let key = 0;
  while (index !== -1) {
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(<mark key={key} className="rounded-sm bg-amber-200/70 px-0 text-inherit dark:bg-amber-400/30">{text.slice(index, index + trimmed.length)}</mark>);
    cursor = index + trimmed.length;
    key += 1;
    index = lower.indexOf(needle, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function RunbooksDashboard() {
  const router = useRouter();
  const { status, reload, runbooks, executions, stats, archive, markReviewed, duplicate } = useRunbooks();
  const isLoading = status === "loading";
  const isError = status === "error";

  const [view, setView] = useState<"list" | "cards">("list");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>("all");
  const [severity, setSeverity] = useState<(typeof SEVERITY_OPTIONS)[number]>("all");
  const [service, setService] = useState<string>("all");
  const [owner, setOwner] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<"title" | "severity" | "reviewed" | "used">("used");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [density, setDensity] = useState<"default" | "compact">("default");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() => readStorage(FAVORITES_KEY, []));
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => readStorage(SAVED_VIEWS_KEY, []));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [confirmArchive, setConfirmArchive] = useState<string[] | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string; undo?: () => void } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const coverageRef = useRef<HTMLDivElement | null>(null);

  const showToast = useCallback((message: string, undo?: () => void) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  /* URL param sync -------------------------------------------------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setView(params.get("view") === "cards" ? "cards" : "list");
    const urlStatus = params.get("status");
    if (urlStatus && (STATUS_FILTERS as readonly string[]).includes(urlStatus)) setStatusFilter(urlStatus as (typeof STATUS_FILTERS)[number]);
    if (params.get("category")) setCategory(params.get("category") as (typeof CATEGORY_OPTIONS)[number]);
    if (params.get("severity")) setSeverity(params.get("severity") as (typeof SEVERITY_OPTIONS)[number]);
    if (params.get("service")) setService(params.get("service") as string);
    if (params.get("owner")) setOwner(params.get("owner") as string);
    if (params.get("q")) setQuery(params.get("q") ?? "");
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (view !== "list") params.set("view", view);
    if (statusFilter !== "All") params.set("status", statusFilter);
    if (category !== "all") params.set("category", category);
    if (severity !== "all") params.set("severity", severity);
    if (service !== "all") params.set("service", service);
    if (owner !== "all") params.set("owner", owner);
    if (query.trim()) params.set("q", query.trim());
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [view, statusFilter, category, severity, service, owner, query]);

  /* "/" focuses search ------------------------------------------------ */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { writeStorage(FAVORITES_KEY, favorites); }, [favorites]);
  useEffect(() => { writeStorage(SAVED_VIEWS_KEY, savedViews); }, [savedViews]);
  useEffect(() => { setPage(1); }, [statusFilter, category, severity, service, owner, query, favoritesOnly, view]);

  const runbookById = useMemo(() => new Map(runbooks.map((runbook) => [runbook.id, runbook])), [runbooks]);
  const ownerOptions = useMemo(() => ["all", ...new Set(runbooks.map((runbook) => runbook.owner))], [runbooks]);
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: runbooks.length };
    for (const status of ["Published", "Draft", "Needs review", "Archived"] as RunbookStatus[]) counts[status] = runbooks.filter((runbook) => runbook.status === status).length;
    return counts;
  }, [runbooks]);

  const matchesQuery = useCallback((runbook: Runbook, needle: string) => {
    if (!needle) return true;
    const haystack = [
      runbook.title, runbook.summary, runbook.tags.join(" "), runbook.id, runbook.owner, runbook.team, runbook.category,
      ...runbook.steps.flatMap((step) => [step.title, step.description, step.command ?? ""]),
      ...runbook.prerequisites,
    ].join(" ").toLowerCase();
    return needle.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = runbooks.filter((runbook) => {
      if (statusFilter !== "All" && runbook.status !== statusFilter) return false;
      if (category !== "all" && runbook.category !== category) return false;
      if (severity !== "all" && runbook.severity !== severity) return false;
      if (service !== "all" && !runbook.services.includes(service)) return false;
      if (owner !== "all" && runbook.owner !== owner) return false;
      if (favoritesOnly && !favorites.includes(runbook.id)) return false;
      return matchesQuery(runbook, needle);
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case "title": return dir * a.title.localeCompare(b.title);
        case "severity": return dir * (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.title.localeCompare(b.title));
        case "reviewed": return dir * (new Date(a.lastReviewedAt).getTime() - new Date(b.lastReviewedAt).getTime());
        case "used": return dir * ((stats.usage30d.get(a.id) ?? 0) - (stats.usage30d.get(b.id) ?? 0));
        default: return 0;
      }
    });
  }, [runbooks, statusFilter, category, severity, service, owner, favoritesOnly, favorites, query, matchesQuery, sortKey, sortDir, stats.usage30d]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = view === "list" ? filtered.slice((safePage - 1) * pageSize, safePage * pageSize) : filtered;

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "title" ? "asc" : "desc"); }
  };
  const sortIcon = (key: typeof sortKey) => sortKey !== key ? <ArrowUpDown size={12} aria-hidden /> : sortDir === "asc" ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />;

  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  const toggleSelectAll = (checked: boolean) => setSelectedIds(checked ? pageRows.map((row) => row.id) : []);
  const resetFilters = () => {
    setStatusFilter("All"); setCategory("all"); setSeverity("all"); setService("all"); setOwner("all");
    setQuery(""); setFavoritesOnly(false); setSortKey("used"); setSortDir("desc");
  };

  const applyView = (viewPreset: SavedView) => {
    setQuery(viewPreset.query);
    setStatusFilter((viewPreset.status === "all" ? "All" : viewPreset.status) as (typeof STATUS_FILTERS)[number]);
    setCategory(viewPreset.category as (typeof CATEGORY_OPTIONS)[number]);
    setSeverity(viewPreset.severity as (typeof SEVERITY_OPTIONS)[number]);
    setService(viewPreset.service);
    setOwner(viewPreset.owner);
    setFavoritesOnly(viewPreset.favoritesOnly);
  };
  const saveCurrentView = () => {
    const name = window.prompt("Name this view", "My view")?.trim();
    if (!name) return;
    setSavedViews((current) => [...current.filter((viewEntry) => viewEntry.name !== name), { name, query, status: statusFilter === "All" ? "all" : statusFilter, category, severity, service, owner, favoritesOnly }]);
    showToast(`Saved view "${name}".`);
  };

  const exportGapRows = () => {
    const header = ["id", "name", "severity", "fired24h"];
    const lines = [
      header.join(","),
      ...uncoveredRules.map((rule) => [rule.id, rule.name, rule.severity, String(rule.fired24h)].map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(",")),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "alert-rules-without-runbook.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${uncoveredRules.length} rule(s) without runbook.`);
  };
  const exportRows = (rows: Runbook[], kind: "csv" | "json") => {
    const data = rows.map((runbook) => ({
      id: runbook.id, title: runbook.title, category: runbook.category, severity: runbook.severity, status: runbook.status,
      owner: runbook.owner, services: runbook.services.join("|"), linkedAlertRules: runbook.linkedAlertRuleIds.join("|"),
      used30d: stats.usage30d.get(runbook.id) ?? 0, lastReviewedAt: runbook.lastReviewedAt,
    }));
    const blob = kind === "json"
      ? new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" })
      : new Blob([[Object.keys(data[0] ?? { id: "" }).join(","), ...data.map((row) => Object.values(row).map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(","))].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `runbooks-export.${kind}`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${data.length} runbook(s) as ${kind.toUpperCase()}.`);
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Array<Partial<Runbook> & { title?: string }>;
        if (!Array.isArray(parsed)) throw new Error("expected array");
        let created = 0;
        for (const item of parsed) {
          if (!item || typeof item.title !== "string" || !item.title.trim()) continue;
          router.push(`/runbooks/new?title=${encodeURIComponent(item.title.trim())}`);
          created += 1;
        }
        showToast(created > 0 ? `Import validated - opened editor for "${String(parsed[0]?.title ?? "")}".` : "No valid runbooks found in file.");
      } catch {
        showToast("Import failed - expected a JSON array of runbooks.");
      }
    };
    reader.readAsText(file);
  };

  const copyRunbookLink = (runbook: Runbook) => {
    const url = `${window.location.origin}/runbooks/${runbook.id}`;
    try {
      navigator.clipboard?.writeText(url).then(() => showToast(`Link copied for ${runbook.id}.`), () => showToast(url));
    } catch {
      showToast(url);
    }
  };

  const confirmArchiveNow = () => {
    if (!confirmArchive) return;
    const prior = new Map(confirmArchive.map((id) => [id, runbookById.get(id)?.status]));
    archive(confirmArchive);
    showToast(`Archived ${confirmArchive.length} runbook(s).`, () => {
      // Undo: restore prior statuses through the store so subscribers re-render.
      for (const [id, priorStatus] of prior) {
        if (priorStatus) mutateRunbooks({ ids: [id], patch: () => ({ status: priorStatus }) });
      }
      showToast("Archive undone.");
    });
    setConfirmArchive(null);
    setSelectedIds([]);
  };

  const uncoveredRules = useMemo(() => {
    const wanted = new Set(stats.uncoveredRuleIds);
    return ALERT_RULE_LIST.filter((rule) => wanted.has(rule.id)).sort((a, b) => b.fired24h - a.fired24h);
  }, [stats.uncoveredRuleIds]);
  const coverageBySeverity = useMemo(() => {
    const linked = new Set(runbooks.filter((runbook) => runbook.status !== "Archived").flatMap((runbook) => runbook.linkedAlertRuleIds));
    return (["Critical", "Warning", "Info"] as const).map((severity) => {
      const rules = ALERT_RULE_LIST.filter((rule) => rule.severity === severity);
      const covered = rules.filter((rule) => linked.has(rule.id)).length;
      return { severity, total: rules.length, covered, pct: rules.length > 0 ? Math.round((covered / rules.length) * 100) : 0 };
    });
  }, [runbooks]);
  const uncoveredImpact = useMemo(() => {
    const fires = uncoveredRules.reduce((sum, rule) => sum + rule.fired24h, 0);
    const critical = uncoveredRules.filter((rule) => rule.severity === "Critical").length;
    const warning = uncoveredRules.filter((rule) => rule.severity === "Warning").length;
    const info = uncoveredRules.filter((rule) => rule.severity === "Info").length;
    return { fires, critical, warning, info };
  }, [uncoveredRules]);
  const recentlyCovered = useMemo(() => [...runbooks]
    .filter((runbook) => runbook.linkedAlertRuleIds.length > 0 && runbook.status !== "Archived")
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 4), [runbooks]);
  const reviewFreshness = useMemo(() => {
    const active = runbooks.filter((runbook) => runbook.status !== "Archived");
    const fresh = active.filter((runbook) => !isNeedsReview(runbook)).length;
    return { total: active.length, fresh, stale: active.length - fresh, pct: active.length > 0 ? Math.round((fresh / active.length) * 100) : 0 };
  }, [runbooks]);
  const reviewQueue = useMemo(() => {
    const DAY = 86_400_000;
    const overdue = runbooks.filter(isNeedsReview);
    const overdueDays = overdue.map((runbook) => Math.floor((Date.now() - new Date(runbook.lastReviewedAt).getTime()) / DAY));
    const sum = overdueDays.reduce((acc, days) => acc + days, 0);
    const longestIndex = overdueDays.length > 0 ? overdueDays.indexOf(Math.max(...overdueDays)) : -1;
    const dueSoon = runbooks.filter((runbook) => runbook.status !== "Archived" && runbook.status !== "Draft" && !isNeedsReview(runbook) && Date.now() - new Date(runbook.lastReviewedAt).getTime() > (runbook.reviewIntervalDays - 30) * DAY).length;
    return { avg: overdueDays.length > 0 ? Math.round(sum / overdueDays.length) : 0, longest: longestIndex >= 0 ? overdueDays[longestIndex] : 0, longestOwner: longestIndex >= 0 ? overdue[longestIndex].owner : "—", dueSoon };
  }, [runbooks]);
  const needsReviewList = useMemo(() => runbooks.filter(isNeedsReview).sort((a, b) => +new Date(a.lastReviewedAt) - +new Date(b.lastReviewedAt)).slice(0, 5), [runbooks]);
  const mostUsed = useMemo(() => [...runbooks].filter((runbook) => (stats.usage30d.get(runbook.id) ?? 0) > 0).sort((a, b) => (stats.usage30d.get(b.id) ?? 0) - (stats.usage30d.get(a.id) ?? 0)).slice(0, 6), [runbooks, stats.usage30d]);
  const recentExecutions = useMemo(() => [...executions].sort((a, b) => b.epochMs - a.epochMs).slice(0, 8), [executions]);
  const maxUsage = Math.max(1, ...mostUsed.map((runbook) => stats.usage30d.get(runbook.id) ?? 0));
  const coverageGood = stats.uncoveredRuleIds.length === 0 && stats.needsReview === 0;
  const lastUpdated = new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (isError) {
    return (
      <div className="space-y-4">
         <PageHeader breadcrumbs={["Operations", "Runbooks"]} title="Runbooks" subtitle="Documented remediation procedures attached to alerts, incidents and services." />
        <section role="alert" className="grid min-h-[20rem] place-items-center rounded-xl border border-border bg-card p-6 text-center">
          <div className="flex max-w-md flex-col items-center gap-2">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10"><ShieldAlert size={20} aria-hidden /></span>
            <h2 className="font-display text-base font-bold text-foreground">Couldn&rsquo;t load runbooks</h2>
            <p className="text-sm text-muted-foreground">The runbook store did not respond. Check the pipeline and try again.</p>
            <Button variant="outline" className="h-10 gap-1.5 rounded-lg px-4 text-sm" onClick={reload}><RotateCcw size={15} aria-hidden />Retry</Button>
          </div>
        </section>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-11 animate-pulse rounded-xl bg-muted" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[6.5rem] animate-pulse rounded-xl bg-muted" />)}</div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-[17.5rem] animate-pulse rounded-xl bg-muted" />)}</div>
        <div className="h-[32.5rem] animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={["Operations", "Runbooks"]}
        title="Runbooks"
        subtitle="Documented remediation procedures attached to alerts, incidents and services."
        lastUpdated={`${lastUpdated} · ${tz}`}
        onRefresh={reload}
        actions={
          <div className="flex h-10 shrink-0 flex-wrap items-center gap-2">
            <input ref={importInputRef} type="file" accept="application/json,.json" className="sr-only" onChange={handleImportFile} aria-hidden="true" tabIndex={-1} />
            <Button variant="outline" className="h-10 gap-1.5 rounded-lg px-3 text-sm" onClick={() => importInputRef.current?.click()}>
              <FileUp size={15} aria-hidden />Import
            </Button>
            <AlertMenu
              label="Export runbooks"
              align="end"
              width={170}
              trigger={<Button variant="outline" className="h-10 gap-1.5 rounded-lg px-3 text-sm"><FileDown size={15} aria-hidden />Export</Button>}
              items={[
                { key: "csv", label: "Export CSV", onSelect: () => exportRows(filtered, "csv") },
                { key: "json", label: "Export JSON", onSelect: () => exportRows(filtered, "json") },
              ]}
            />
            <AlertMenu
              label="New runbook"
              align="end"
              width={230}
              trigger={<Button className="h-10 gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"><FilePlus2 size={15} aria-hidden />New Runbook<ChevronDown size={13} aria-hidden className="text-primary-foreground/80" /></Button>}
              items={[
                { key: "blank", label: "Blank runbook", onSelect: () => router.push("/runbooks/new") },
                { key: "template-restart", label: "From template: Service restart", onSelect: () => router.push("/runbooks/new?template=service-restart") },
                { key: "template-failover", label: "From template: Database failover", onSelect: () => router.push("/runbooks/new?template=database-failover") },
                { key: "template-disk", label: "From template: Disk cleanup", onSelect: () => router.push("/runbooks/new?template=disk-cleanup") },
                { key: "template-cert", label: "From template: Certificate renewal", onSelect: () => router.push("/runbooks/new?template=certificate-renewal") },
                { key: "template-restore", label: "From template: Backup restore", onSelect: () => router.push("/runbooks/new?template=backup-restore") },
              ]}
            />
          </div>
        }
      />

      {/* Banner - derived from the same source the stat cards use */}
      {coverageGood ? (
        <section aria-label="Runbook coverage" className="flex h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 size={16} aria-hidden />All alert rules have a runbook — reviews are up to date.
        </section>
      ) : (
        <section aria-label="Runbook coverage gaps" className="flex h-11 items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          <span className="flex min-w-0 items-center gap-2 truncate">
            <ShieldAlert size={16} aria-hidden className="shrink-0" />
            {stats.uncoveredRuleIds.length} alert rules have no runbook · {stats.needsReview} runbook{stats.needsReview === 1 ? "" : "s"} need{stats.needsReview === 1 ? "s" : ""} review
          </span>
          <button type="button" onClick={() => coverageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="shrink-0 rounded text-[0.8125rem] font-semibold underline underline-offset-2 transition-colors hover:text-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-amber-200">
            View gaps
          </button>
        </section>
      )}

      {/* Stat cards */}
      <section aria-label="Runbook overview" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={<BookOpen size={19} aria-hidden />} label="Total Runbooks" value={String(stats.total)} delta={3} deltaPercent="6.1%" goodDirection="up" iconTone="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" onClick={resetFilters} onClickLabel="Clear library filters" />
        <StatCard icon={<CheckCircle2 size={19} aria-hidden />} label="Published" value={String(stats.published)} delta={2} deltaPercent="4.2%" goodDirection="up" iconTone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" onClick={() => setStatusFilter("Published")} onClickLabel="Filter to published runbooks" />
        <StatCard icon={<ShieldAlert size={19} aria-hidden />} label="Needs Review" value={String(stats.needsReview)} delta={1} deltaPercent="33%" goodDirection="down" iconTone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" onClick={() => setStatusFilter("Needs review")} onClickLabel="Filter to runbooks needing review" />
        <StatCard icon={<Rocket size={19} aria-hidden />} label="Alert Coverage" value={`${stats.coveragePct}%`} delta={8} deltaPercent="pts" goodDirection="up" iconTone="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400" detail={`${stats.coverageCount} of ${stats.coverageTotal} rules`} onClick={() => coverageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} onClickLabel="Jump to alert coverage" />
        <StatCard icon={<Timer size={19} aria-hidden />} label="Executions (30d)" value={String(stats.executions30d)} delta={18} deltaPercent="27%" goodDirection="up" iconTone="bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400" onClick={() => { setSortKey("used"); setSortDir("desc"); }} onClickLabel="Sort library by usage" />
        <StatCard icon={<Clock size={19} aria-hidden />} label="Avg Time to Complete" value={stats.avgMinutes != null ? formatMinutes(stats.avgMinutes) : "—"} delta={-2} deltaPercent="12%" goodDirection="down" iconTone="bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" detail="Target ≤ 20m" />
      </section>

      {/* Insights row 1 - equal height */}
      <section aria-label="Coverage, usage and reviews" className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        {/* Alert Coverage donut */}
        <ChartCard title="Alert Coverage" className="flex h-full min-w-0 flex-col rounded-xl p-4" actions={<AlertMenu label="Coverage options" align="end" width={190} trigger={<button type="button" aria-label="Coverage options" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MoreVertical size={16} aria-hidden /></button>} items={[{ key: "export", label: "Export coverage report (CSV)", onSelect: () => exportRows(runbooks.filter((runbook) => runbook.linkedAlertRuleIds.length > 0), "csv") }]} />}>
          <div id="alert-coverage" className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-3 pt-1">
              <div className="relative h-[8.125rem] w-[8.125rem] shrink-0">
                <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" role="img" aria-label={`Alert coverage ${stats.coveragePct}%: ${stats.coverageCount} of ${stats.coverageTotal} rules linked`}>
                  <circle cx="21" cy="21" r="15.9155" fill="none" strokeWidth="6" className="stroke-slate-200 dark:stroke-slate-500/30" />
                  <circle cx="21" cy="21" r="15.9155" fill="none" strokeWidth="6" strokeDasharray={`${stats.coveragePct} ${100 - stats.coveragePct}`} strokeLinecap="round" className="stroke-green-600 transition-all duration-500 dark:stroke-emerald-400" />
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <b className="font-display text-[1.375rem] font-extrabold leading-none tabular-nums text-foreground">{stats.coveragePct}%</b>
                  <span className="mt-1 text-center text-[0.6875rem] font-medium leading-tight text-muted-foreground">of rules<br />covered</span>
                </div>
              </div>
              <ul className="grid min-w-0 flex-1 grid-cols-1 gap-2 text-xs">
                <li className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2.5 py-2"><span className="flex items-center gap-1.5 text-muted-foreground"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-green-600" />With runbook</span><b className="tabular-nums text-foreground">{stats.coverageCount} · {stats.coveragePct}%</b></li>
                <li className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2.5 py-2"><span className="flex items-center gap-1.5 text-muted-foreground"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />Without runbook</span><b className="tabular-nums text-foreground">{stats.coverageTotal - stats.coverageCount} · {100 - stats.coveragePct}%</b></li>
                <li className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2.5 py-2"><span className="flex items-center gap-1.5 text-muted-foreground"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />Total rules</span><b className="tabular-nums text-foreground">{stats.coverageTotal}</b></li>
              </ul>
            </div>
            {/* Coverage by severity - fills the card body with data from the same source */}
            <div className="mt-4 border-t border-border/70 pt-3">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Coverage by severity</p>
              <ul className="mt-2 space-y-2">
                {coverageBySeverity.map((bucket) => (
                  <li key={bucket.severity} className="flex items-center gap-2">
                    <span className="flex w-[4.625rem] shrink-0 items-center gap-1.5 text-xs font-semibold text-foreground/90"><span aria-hidden="true" className={cn("h-2 w-2 rounded-full", bucket.severity === "Critical" ? "bg-red-600" : bucket.severity === "Warning" ? "bg-amber-600" : "bg-blue-500")} />{bucket.severity}</span>
                    <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${bucket.severity} rules: ${bucket.covered} of ${bucket.total} covered`}><span className="block h-full rounded-full bg-green-600 dark:bg-emerald-400" style={{ width: `${bucket.pct}%` }} /></span>
                    <b className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">{bucket.covered}/{bucket.total}</b>
                  </li>
                ))}
              </ul>
            </div>
            {/* Review freshness - same-source signal that the coverage above is current */}
            <div className="mt-3 border-t border-border/70 pt-3">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Review freshness</p>
              <ul className="mt-2 space-y-2">
                <li className="flex items-center gap-2">
                  <span className="flex w-[4.625rem] shrink-0 items-center gap-1.5 text-xs font-semibold text-foreground/90"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />Fresh</span>
                  <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${reviewFreshness.fresh} of ${reviewFreshness.total} runbooks reviewed within their interval`}><span className="block h-full rounded-full bg-primary" style={{ width: `${reviewFreshness.pct}%` }} /></span>
                  <b className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">{reviewFreshness.fresh}/{reviewFreshness.total}</b>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldAlert size={12} aria-hidden className="text-amber-600 dark:text-amber-400" />Overdue for review</span>
                  <button type="button" onClick={() => setStatusFilter("Needs review")} className="inline-flex items-center gap-1 rounded text-[0.6875rem] font-semibold tabular-nums text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${reviewFreshness.stale} runbooks overdue - filter library to needs review`}>{reviewFreshness.stale} · filter <ArrowRight size={11} aria-hidden className="inline-block align-[-0.0625rem]" /></button>
                </li>
              </ul>
            </div>
            <div className="mt-auto border-t border-border pt-3">
              <Link href={`/runbooks/new?rule=${stats.uncoveredRuleIds[0] ?? ""}`} className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                <FilePlus2 size={13} aria-hidden />Create runbook for {stats.uncoveredRuleIds[0] ?? "first uncovered rule"} and {stats.uncoveredRuleIds.length - 1} other{stats.uncoveredRuleIds.length - 1 === 1 ? "" : "s"}
              </Link>
            </div>
          </div>
        </ChartCard>

        {/* Most Used 30d */}
        <ChartCard title="Most Used (30d)" className="flex h-full min-w-0 flex-col rounded-xl p-4" actions={<AlertMenu label="Usage options" align="end" width={170} trigger={<button type="button" aria-label="Usage options" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MoreVertical size={16} aria-hidden /></button>} items={[{ key: "export", label: "Export usage (CSV)", onSelect: () => exportRows(mostUsed, "csv") }]} />}>
          <ul className="flex min-h-0 flex-1 flex-col divide-y divide-border/60">
            {mostUsed.map((runbook) => {
              const used = stats.usage30d.get(runbook.id) ?? 0;
              const helpful = stats.helpfulPct(runbook);
              return (
                <li key={runbook.id}>
                  <Link href={`/runbooks/${runbook.id}`} className="group block rounded px-1 py-2 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-muted/40">
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-[0.8125rem] font-semibold text-foreground group-hover:text-primary">{runbook.title}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{used} run{used === 1 ? "" : "s"}</span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${(used / maxUsage) * 100}%` }} /></span>
                      <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">{helpful != null ? `${helpful}% helpful` : "No feedback"}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {mostUsed.length === 0 && <li className="py-6 text-center text-xs text-muted-foreground">No executions recorded in the last 30 days.</li>}
          </ul>
          <div className="mt-auto border-t border-border pt-3"><ViewAllLink href="/runbooks?view=list&status=Published" label="View all" /></div>
        </ChartCard>

        {/* Needs Review */}
        <ChartCard title="Needs Review" className="flex h-full min-w-0 flex-col rounded-xl p-4" actions={<AlertMenu label="Review options" align="end" width={170} trigger={<button type="button" aria-label="Review options" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MoreVertical size={16} aria-hidden /></button>} items={[{ key: "export", label: "Export review queue (CSV)", onSelect: () => exportRows(needsReviewList, "csv") }]} />}>
          <ul className="flex min-h-0 flex-1 flex-col divide-y divide-border/60">
            {needsReviewList.map((runbook) => {
              const days = Math.floor((Date.now() - new Date(runbook.lastReviewedAt).getTime()) / 86_400_000);
              return (
                <li key={runbook.id} className="flex items-center gap-2 py-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-100 text-[0.6875rem] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{initials(runbook.owner)}</span>
                  <span className="min-w-0 flex-1">
                    <Link href={`/runbooks/${runbook.id}`} className="block truncate text-[0.8125rem] font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">{runbook.title}</Link>
                    <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">Last reviewed {days}d ago · {runbook.owner}</span>
                  </span>
                  <Button variant="outline" className="h-8 shrink-0 gap-1 rounded-lg px-2 text-xs" onClick={() => { markReviewed(runbook.id); showToast(`${runbook.id} marked as reviewed.`); }} aria-label={`Mark ${runbook.id} as reviewed`}>
                    <CheckCircle2 size={13} aria-hidden />Review
                  </Button>
                </li>
              );
            })}
            {needsReviewList.length === 0 && <li className="py-6 text-center text-xs text-muted-foreground">Nothing needs review — every runbook is within its review interval.</li>}
          </ul>
          {/* Review queue health - same-source signals for the rows above */}
          <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border/70 pt-3">
            {[
              { label: "Avg since review", value: `${reviewQueue.avg}d`, sub: "across overdue" },
              { label: "Longest overdue", value: `${reviewQueue.longest}d`, sub: reviewQueue.longestOwner },
              { label: "Due ≤ 30d", value: String(reviewQueue.dueSoon), sub: "before next cycle" },
            ].map((tile) => (
              <div key={tile.label} className="min-w-0 rounded-lg bg-muted/50 p-2.5">
                <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">{tile.label}</p>
                <p className="mt-1 font-display text-[0.9375rem] font-bold tabular-nums leading-snug text-foreground">{tile.value}</p>
                <p className="mt-0.5 truncate text-[0.625rem] text-muted-foreground" title={tile.sub}>{tile.sub}</p>
              </div>
            ))}
          </div>
          <div className="mt-auto border-t border-border pt-3"><ViewAllLink onClick={() => setStatusFilter("Needs review")} label="View all" /></div>
        </ChartCard>
      </section>

      {/* Library */}
      <section aria-label="Runbook library" className="rounded-xl border border-border bg-card p-3">
        {/* Toolbar row */}
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl value={view === "list" ? "List" : "Cards"} options={["List", "Cards"]} onChange={(value) => setView(value === "Cards" ? "cards" : "list")} buttonClassName="h-8 px-2.5 text-sm" />
          <div className="relative min-w-0 flex-1 sm:min-w-[15rem]">
            <Search size={15} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search runbooks, steps, commands..." aria-label="Search runbooks" className="h-9 rounded-lg pl-8 pr-8 text-sm" />
            <kbd aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[0.75rem] text-muted-foreground">/</kbd>
          </div>
          <button type="button" onClick={resetFilters} className="rounded text-[0.8125rem] font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Reset</button>
          <AlertMenu
            label="Saved views"
            align="end"
            width={220}
            trigger={<Button variant="outline" className="h-9 gap-1.5 rounded-lg px-3 text-sm"><Star size={14} aria-hidden />Saved Views<ChevronDown size={12} aria-hidden className="text-muted-foreground" /></Button>}
            items={[
              ...PRESET_VIEWS.map((viewPreset) => ({ key: `preset-${viewPreset.name}`, label: viewPreset.name, onSelect: () => applyView(viewPreset) })),
              ...savedViews.map((viewPreset) => ({ key: `saved-${viewPreset.name}`, label: viewPreset.name, onSelect: () => applyView(viewPreset) })),
              { key: "save", label: "Save current view", onSelect: saveCurrentView },
              { key: "clear", label: "Clear saved views", danger: true, onSelect: () => { setSavedViews([]); showToast("Saved views cleared."); } },
            ]}
          />
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" aria-label={density === "default" ? "Switch to compact rows" : "Switch to comfortable rows"} onClick={() => setDensity((current) => (current === "default" ? "compact" : "default"))}>
            <ListFilter size={16} aria-hidden />
          </Button>
        </div>

        {/* Filter row: status chips */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2">
          {STATUS_FILTERS.map((statusOption) => (
            <Chip key={statusOption} active={statusFilter === statusOption} onClick={() => setStatusFilter(statusOption)}>
              {statusOption} <span className="tabular-nums text-[0.6875rem] opacity-80">{statusCounts[statusOption] ?? 0}</span>
            </Chip>
          ))}
          <button
            type="button"
            role="switch"
            aria-checked={favoritesOnly}
            onClick={() => setFavoritesOnly((current) => !current)}
            className={cn("ml-1 inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", favoritesOnly ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent")}
            aria-label="Show favorites only"
          >
            <Star size={12} aria-hidden className={favoritesOnly ? "fill-current" : ""} />Favorites
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={category} onValueChange={(value) => setCategory(value as (typeof CATEGORY_OPTIONS)[number])}>
              <SelectTrigger className="h-9 w-[8rem] text-sm" aria-label="Filter by category"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>{CATEGORY_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option === "all" ? "All categories" : option}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={severity} onValueChange={(value) => setSeverity(value as (typeof SEVERITY_OPTIONS)[number])}>
              <SelectTrigger className="h-9 w-[7.75rem] text-sm" aria-label="Filter by severity"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>{SEVERITY_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option === "all" ? "All severities" : option}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger className="h-9 w-[9rem] text-sm" aria-label="Filter by service"><SelectValue placeholder="Service" /></SelectTrigger>
              <SelectContent>{SERVICE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option === "all" ? "All services" : option}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger className="h-9 w-[8.5rem] text-sm" aria-label="Filter by owner"><SelectValue placeholder="Owner" /></SelectTrigger>
              <SelectContent>{ownerOptions.map((option) => <SelectItem key={option} value={option}>{option === "all" ? "All owners" : option}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {/* Bulk actions */}
        {selectedIds.length > 0 && (
          <div role="status" className="mt-2 flex h-11 flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 text-sm">
            <b className="tabular-nums text-foreground">{selectedIds.length} selected</b>
            <button type="button" className="rounded font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { selectedIds.forEach((id) => markReviewed(id)); showToast(`Marked ${selectedIds.length} as reviewed.`); setSelectedIds([]); }}>Mark reviewed</button>
            <button type="button" className="rounded font-semibold text-red-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setConfirmArchive([...selectedIds])}>Archive</button>
            <button type="button" className="rounded font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => exportRows(selectedIds.map((id) => runbookById.get(id)).filter((runbook): runbook is Runbook => Boolean(runbook)), "csv")}>Export</button>
            <button type="button" className="ml-auto rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Clear selection" onClick={() => setSelectedIds([])}><X size={16} aria-hidden /></button>
          </div>
        )}

        {/* List view */}
        {view === "list" && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[83.75rem] table-fixed text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-border text-[0.75rem] font-semibold text-muted-foreground">
                  <th className="w-9 py-2 pl-2 pr-1"><input type="checkbox" aria-label="Select all visible runbooks" className="h-4 w-4 accent-[oklch(0.5461_0.2152_262.88)]" checked={pageRows.length > 0 && selectedIds.length === pageRows.length} onChange={(event) => toggleSelectAll(event.target.checked)} /></th>
                  <th className="w-[14%] py-2 pr-2"><button type="button" className="inline-flex items-center gap-1 uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded" onClick={() => toggleSort("title")}>Title {sortIcon("title")}</button></th>
                  <th className="w-[8%] py-2 pr-2">Category</th>
                  <th className="w-[7%] py-2 pr-2"><button type="button" className="inline-flex items-center gap-1 uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded" onClick={() => toggleSort("severity")}>Severity {sortIcon("severity")}</button></th>
                  <th className="w-[10%] py-2 pr-2">Linked alerts</th>
                  <th className="hidden w-[15%] py-2 pr-2 lg:table-cell">Services</th>
                  <th className="w-[10%] py-2 pr-2">Status</th>
                  <th className="hidden w-[8%] py-2 pr-2 xl:table-cell">Owner</th>
                  <th className="w-[7%] py-2 pr-2"><button type="button" className="inline-flex items-center gap-1 uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded" onClick={() => toggleSort("reviewed")}>Reviewed {sortIcon("reviewed")}</button></th>
                  <th className="w-[5%] py-2 pr-2 text-right"><button type="button" className="inline-flex items-center gap-1 uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded" onClick={() => toggleSort("used")}>Used {sortIcon("used")}</button></th>
                  <th className="w-[5%] py-2 pr-2 text-right">Helpful</th>
                  <th className="w-[11%] py-2 pr-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((runbook) => {
                  const days = Math.floor((Date.now() - new Date(runbook.lastReviewedAt).getTime()) / 86_400_000);
                  const stale = days > runbook.reviewIntervalDays;
                  const used = stats.usage30d.get(runbook.id) ?? 0;
                  const helpful = stats.helpfulPct(runbook);
                  const linked = runbook.linkedAlertRuleIds;
                  const isFavorite = favorites.includes(runbook.id);
                  return (
                    <tr key={runbook.id} className={cn("group border-b border-border/60 transition-colors hover:bg-slate-50 dark:hover:bg-muted/40", SEVERITY_STRIPE[runbook.severity], density === "compact" ? "h-12" : "h-14")}>
                      <td className="py-1.5 pl-2 pr-1 align-middle"><input type="checkbox" aria-label={`Select ${runbook.id}`} className="h-4 w-4 accent-[oklch(0.5461_0.2152_262.88)]" checked={selectedIds.includes(runbook.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, runbook.id] : current.filter((id) => id !== runbook.id))} onClick={(event) => event.stopPropagation()} /></td>
                      <td className="py-1.5 pr-2 align-middle">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <button type="button" aria-label={isFavorite ? `Unfavorite ${runbook.id}` : `Favorite ${runbook.id}`} aria-pressed={isFavorite} onClick={() => toggleFavorite(runbook.id)} className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <Star size={14} aria-hidden className={isFavorite ? "fill-amber-400 text-amber-400" : ""} />
                          </button>
                          <Link href={`/runbooks/${runbook.id}`} className="min-w-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <span className="block truncate text-[0.8125rem] font-semibold text-foreground hover:text-primary">{highlight(runbook.title, query)}</span>
                            <span className="mt-0.5 block truncate text-[0.75rem] text-muted-foreground" title={runbook.summary}>{highlight(runbook.summary, query)}</span>
                          </Link>
                        </div>
                      </td>
                      <td className="py-1.5 pr-2 align-middle"><span className="inline-flex h-6 items-center whitespace-nowrap rounded border border-border px-2 text-[0.6875rem] font-semibold text-muted-foreground">{runbook.category}</span></td>
                      <td className="py-1.5 pr-2 align-middle"><RunbookSeverityBadge severity={runbook.severity} /></td>
                      <td className="py-1.5 pr-2 align-middle">
                        <span className="flex flex-wrap items-center gap-1">
                          {linked.slice(0, 2).map((ruleId) => <Link key={ruleId} href={`/alert-rules?rule=${ruleId}`} className="inline-flex h-6 items-center rounded bg-muted px-1.5 text-[0.6875rem] font-semibold tabular-nums text-foreground/80 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{ruleId}</Link>)}
                          {linked.length > 2 && <span className="inline-flex h-6 items-center rounded bg-muted px-1.5 text-[0.6875rem] font-semibold text-muted-foreground" title={linked.join(", ")}>+{linked.length - 2}</span>}
                          {linked.length === 0 && <span className="text-[0.75rem] text-muted-foreground">—</span>}
                        </span>
                      </td>
                      <td className="hidden overflow-hidden py-1.5 pr-2 align-middle lg:table-cell" title={runbook.services.join(", ")}>
                        <span className="flex min-w-0 items-center gap-1 overflow-hidden">
                          {runbook.services.slice(0, 2).map((serviceName) => (
                            <span key={serviceName} className="inline-flex h-6 max-w-[5.5rem] shrink-0 items-center gap-1 rounded border border-border px-1.5 text-[0.6875rem] font-medium text-muted-foreground"><TechLogo name={serviceName} className="!h-4 !w-4 shrink-0 !rounded-sm [&_svg]:!h-2.5 [&_svg]:!w-2.5" /><span className="truncate">{serviceName}</span></span>
                          ))}
                          {runbook.services.length > 2 && <span className="text-[0.6875rem] font-semibold text-muted-foreground">+{runbook.services.length - 2}</span>}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 align-middle"><RunbookStatusBadge status={runbook.status} /></td>
                      <td className="hidden py-1.5 pr-2 align-middle xl:table-cell"><span className="flex min-w-0 items-center gap-1.5"><InitialsAvatar name={runbook.owner} size={22} /><span className="truncate text-[0.75rem] text-foreground/90">{runbook.owner}</span></span></td>
                      <td className="py-1.5 pr-2 align-middle"><span className={cn("text-[0.75rem] tabular-nums", stale ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground")} title={formatDate(runbook.lastReviewedAt)}>{days}d ago</span></td>
                      <td className="py-1.5 pr-2 text-right align-middle tabular-nums text-foreground/90">{used}</td>
                      <td className="py-1.5 pr-2 text-right align-middle tabular-nums text-foreground/90">{helpful != null ? `${helpful}%` : "—"}</td>
                      <td className="py-1.5 pr-1 align-middle">
                        <span className="flex items-center justify-end gap-1">
                          <span className="hidden items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 md:flex">
                            <Link href={`/runbooks/${runbook.id}`} aria-label={`Open ${runbook.id}`} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Eye size={15} aria-hidden /></Link>
                            <Link href={`/runbooks/${runbook.id}?mode=run`} aria-label={`Run ${runbook.id}`} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Play size={15} aria-hidden /></Link>
                          </span>
                          <AlertMenu
                            label={`Actions for ${runbook.id}`}
                            align="end"
                            width={200}
                            trigger={<button type="button" aria-label={`More actions for ${runbook.id}`} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MoreVertical size={15} aria-hidden /></button>}
                            items={[
                              { key: "edit", label: "Edit", onSelect: () => router.push(`/runbooks/${runbook.id}?mode=edit`) },
                              { key: "duplicate", label: "Duplicate", onSelect: () => { const copy = duplicate(runbook.id); showToast(copy ? `Duplicated as ${copy.id}.` : "Duplicate failed."); } },
                              { key: "run", label: "Run", onSelect: () => router.push(`/runbooks/${runbook.id}?mode=run`) },
                              { key: "review", label: "Mark reviewed", onSelect: () => { markReviewed(runbook.id); showToast(`${runbook.id} marked as reviewed.`); } },
                              { key: "archive", label: "Archive", danger: true, onSelect: () => setConfirmArchive([runbook.id]) },
                              { key: "copy", label: "Copy link", onSelect: () => copyRunbookLink(runbook) },
                            ]}
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && (
                  <tr><td colSpan={12} className="py-10 text-center">
                    <p className="text-sm font-semibold text-foreground">No runbooks match your filters</p>
                    <p className="mt-1 text-xs text-muted-foreground">Try widening the search or clearing filters.</p>
                    <Button variant="outline" className="mt-3 h-9 rounded-lg px-4 text-sm" onClick={resetFilters}>Reset filters</Button>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Cards view */}
        {view === "cards" && (
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pageRows.map((runbook) => {
              const used = stats.usage30d.get(runbook.id) ?? 0;
              return (
                <article key={runbook.id} className="flex h-full flex-col rounded-xl border border-border bg-card p-3 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/runbooks/${runbook.id}`} className="min-w-0 rounded font-semibold leading-snug text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{highlight(runbook.title, query)}</Link>
                    <RunbookStatusBadge status={runbook.status} className="shrink-0" />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground" title={runbook.summary}>{runbook.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5"><RunbookSeverityBadge severity={runbook.severity} /><span className="inline-flex h-6 items-center rounded border border-border px-2 text-[0.6875rem] font-semibold text-muted-foreground">{runbook.category}</span>{runbook.linkedAlertRuleIds.slice(0, 2).map((ruleId) => <Link key={ruleId} href={`/alert-rules?rule=${ruleId}`} className="inline-flex h-6 items-center rounded bg-muted px-1.5 text-[0.6875rem] font-semibold tabular-nums text-foreground/80 hover:bg-accent">{ruleId}</Link>)}</div>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2">
                    <span className="text-[0.6875rem] tabular-nums text-muted-foreground">{used} runs · {runbook.estimatedMinutes}m est</span>
                    <span className="flex items-center gap-1.5">
                      <Button variant="outline" className="h-8 gap-1 rounded-lg px-2.5 text-xs" asChild><Link href={`/runbooks/${runbook.id}`}>Open</Link></Button>
                      <Button className="h-8 gap-1 rounded-lg px-2.5 text-xs" asChild><Link href={`/runbooks/${runbook.id}?mode=run`}><Play size={12} aria-hidden />Run</Link></Button>
                    </span>
                  </div>
                </article>
              );
            })}
            {pageRows.length === 0 && (
              <div className="col-span-full py-10 text-center">
                <p className="text-sm font-semibold text-foreground">No runbooks match your filters</p>
                <p className="mt-1 text-xs text-muted-foreground">Try widening the search or clearing filters.</p>
                <Button variant="outline" className="mt-3 h-9 rounded-lg px-4 text-sm" onClick={resetFilters}>Reset filters</Button>
              </div>
            )}
          </div>
        )}

        {/* Pagination footer */}
        {filtered.length > 0 && (
          <Pagination page={safePage} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} noun="runbooks" pageSizeOptions={PAGE_SIZE_OPTIONS} className="mt-2 rounded-lg border border-border" />
        )}
      </section>

      {/* Insights row 2 - equal height */}
      <section ref={coverageRef} aria-label="Executions and alert coverage gaps" className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2 scroll-mt-4">
        {/* Recent executions */}
        <ChartCard title="Recent Executions" className="flex h-full min-w-0 flex-col rounded-xl p-4" actions={<AlertMenu label="Executions options" align="end" width={180} trigger={<button type="button" aria-label="Executions options" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MoreVertical size={16} aria-hidden /></button>} items={[{ key: "export", label: "Export executions (CSV)", onSelect: () => exportRows(recentExecutions.map((execution) => runbookById.get(execution.runbookId)).filter((runbook): runbook is Runbook => Boolean(runbook)), "csv") }]} />}>
          <ul className="flex min-h-0 flex-1 flex-col divide-y divide-border/60">
            {recentExecutions.map((execution) => {
              const runbook = runbookById.get(execution.runbookId);
              if (!runbook) return null;
              return (
                <li key={execution.id} className="group relative">
                  <Link href={`/runbooks/${runbook.id}`} aria-label={`Open ${runbook.title}`} className="absolute inset-0 z-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <div className="pointer-events-none relative z-[1] flex items-center gap-2 rounded px-1 py-2 transition-colors group-hover:bg-slate-50 dark:group-hover:bg-muted/40">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Play size={13} aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] font-semibold text-foreground">{runbook.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-muted-foreground">
                        <span>{execution.by}</span>
                        {execution.incidentId && <Link href={`/incidents/${execution.incidentId}`} className="pointer-events-auto relative z-[2] inline-flex items-center gap-0.5 font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">INC <ArrowUpRight size={10} aria-hidden className="inline-block align-[-0.0625rem]" /></Link>}
                        <span className="tabular-nums">{execution.durationMs != null ? formatDurationMs(execution.durationMs) : "in progress"}</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1"><ExecutionResultBadge result={execution.result} /><span className="text-[0.6875rem] tabular-nums text-muted-foreground">{timeAgo(execution.epochMs)}</span></span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto border-t border-border pt-3"><ViewAllLink onClick={() => setStatusFilter("All")} label="View all" /></div>
        </ChartCard>

        {/* Alert rules without runbook */}
        <ChartCard title="Alert Rules without Runbook" className="flex h-full min-w-0 flex-col rounded-xl p-4" actions={            <AlertMenu label="Gaps options" align="end" width={180} trigger={<button type="button" aria-label="Gaps options" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MoreVertical size={16} aria-hidden /></button>} items={[{ key: "export", label: "Export gap list (CSV)", onSelect: exportGapRows }]} />}>
          <ul className="flex min-h-0 flex-1 flex-col divide-y divide-border/60">
            {uncoveredRules.slice(0, 7).map((rule) => (
              <li key={rule.id} className="flex items-center gap-2 py-2">
                <Link href={`/alert-rules?rule=${rule.id}`} className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="block truncate text-[0.8125rem] font-semibold text-foreground hover:text-primary">{rule.name}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-[0.6875rem] text-muted-foreground"><RunbookSeverityBadge severity={rule.severity === "Critical" ? "Critical" : rule.severity === "Warning" ? "Medium" : "Low"} /><span className="tabular-nums">{rule.fired24h} fires 24h</span></span>
                </Link>
                <Button variant="outline" className="h-8 shrink-0 gap-1 rounded-lg px-2 text-xs" asChild><Link href={`/runbooks/new?rule=${rule.id}`}><FilePlus2 size={12} aria-hidden />Create runbook</Link></Button>
              </li>
            ))}
            {uncoveredRules.length === 0 && <li className="py-6 text-center text-xs text-muted-foreground">Every alert rule has at least one runbook.</li>}
          </ul>
          {/* Uncovered impact - aggregate of the gap list above */}
          <div className="mt-2 border-t border-border/70 pt-3">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Uncovered impact · 24h</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                { label: "Fires 24h", value: String(uncoveredImpact.fires), sub: `across ${uncoveredRules.length} ${uncoveredRules.length === 1 ? "rule" : "rules"}` },
                { label: "Critical gap", value: String(uncoveredImpact.critical), sub: "need runbook first" },
                { label: "Warnings / Info", value: String(uncoveredImpact.warning + uncoveredImpact.info), sub: "standard tier" },
              ].map((tile) => (
                <div key={tile.label} className="min-w-0 rounded-lg bg-muted/50 p-2.5">
                  <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">{tile.label}</p>
                  <p className="mt-1 font-display text-[0.9375rem] font-bold tabular-nums leading-snug text-foreground">{tile.value}</p>
                  <p className="mt-0.5 truncate text-[0.625rem] text-muted-foreground" title={tile.sub}>{tile.sub}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Recently covered - coverage momentum from the same store */}
          <div className="mt-3 border-t border-border/70 pt-3">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Recently covered</p>
            <ul className="mt-1.5 divide-y divide-border/60">
              {recentlyCovered.map((runbook) => (
                <li key={runbook.id}>
                  <Link href={`/runbooks/${runbook.id}`} className="flex items-center gap-2 rounded px-1 py-1.5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-muted/40">
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold tabular-nums text-foreground/80">{runbook.linkedAlertRuleIds[0]}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[0.8125rem] font-semibold text-foreground">{runbook.title}</span></span>
                    <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">{timeAgo(new Date(runbook.updatedAt).getTime())}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-xs tabular-nums text-muted-foreground">{stats.uncoveredRuleIds.length} of {stats.coverageTotal} rules without runbook</span>
            <Link href="/alert-rules" className="inline-flex items-center gap-1 rounded text-[0.8125rem] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">All rules <ArrowRight size={13} aria-hidden className="inline-block align-[-0.0625rem]" /></Link>
          </div>
        </ChartCard>
      </section>

      {/* Archive confirm dialog */}
      <Dialog open={confirmArchive != null} onOpenChange={(open) => { if (!open) setConfirmArchive(null); }}>
        <DialogContent className="w-[min(26.25rem,calc(100vw-2rem))] rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Archive {confirmArchive?.length ?? 0} runbook{confirmArchive?.length === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription className="text-[0.75rem]">Archived runbooks stay in the library under the Archived status and remain readable for audit. Linked alerts will no longer offer them as remediation.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-9 rounded-lg px-4 text-[0.8125rem]" onClick={() => setConfirmArchive(null)}>Keep runbooks</Button>
            <Button className="h-9 rounded-lg bg-red-600 px-4 text-[0.8125rem] font-semibold text-white hover:bg-red-700" onClick={confirmArchiveNow}>Archive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[1200] flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">
          <span>{toast.message}</span>
          {toast.undo && <button type="button" className="rounded font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { toast.undo?.(); setToast(null); }}>Undo</button>}
        </div>
      )}
    </div>
  );
}
