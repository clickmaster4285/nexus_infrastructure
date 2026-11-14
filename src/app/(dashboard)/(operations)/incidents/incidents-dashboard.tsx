"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowDown, ArrowUp, ArrowUpDown, Bookmark, Check, CheckCheck, CheckCircle2, ChevronDown,
  ChevronLeft, ChevronRight, ChevronsUp, ChevronUp, Clock3, FileDown, FileText, FilterX,
  MoreVertical, Phone, RotateCcw, Search, Siren, SlidersHorizontal, Timer, TriangleAlert, X,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AlertMenu, type AlertMenuItem } from "@/components/alerts/alert-menu";
import { ChartCard, Chip, SegmentedControl } from "@/components/logs/primitives";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { SeverityBadge, StatusBadge, SEVERITY_META } from "@/components/shared/incident-badges";
import { TechLogo } from "@/components/shared/icon";
import { Panel } from "@/components/shared/panel";
import { StatCard } from "@/components/shared/stat-card";
import { ViewAllLink } from "@/components/shared/view-all-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CURRENT_USER_NAME, INCIDENT_PEOPLE, INCIDENT_SERVICES, INCIDENT_TEAMS, ON_CALL, SEVERITY_ORDER, STATUS_ORDER,
  durationMinutes, formatMinutes, isOpenIncident, severityRank, snapshotOf, statusRank, trendBuckets,
  type Incident, type IncidentSeverity, type IncidentRestoreSnapshot, type StatusFilter, type TrendRange,
} from "@/mocks/incidents";
import { useIncidents } from "@/mocks/useIncidents";
import { incidentsSuppressed24h } from "@/mocks/maintenanceWindows";
import { fullTimestamp, timeAgo } from "@/mocks/logs";
import { cn } from "@/lib/utils";

type RangeKey = "24H" | "7D" | "30D" | "90D" | "Custom";

interface IncidentFilters {
  status: StatusFilter;
  severity: IncidentSeverity[];
  service: string;
  team: string;
  commander: string;
  range: RangeKey;
  customFrom: string;
  customTo: string;
  query: string;
  myIncidents: boolean;
  unacked: boolean;
}

const DEFAULT_FILTERS: IncidentFilters = {
  status: "All", severity: [], service: "all", team: "all", commander: "all",
  range: "30D", customFrom: "", customTo: "", query: "", myIncidents: false, unacked: false,
};

const RANGE_MS: Record<Exclude<RangeKey, "Custom">, number> = {
  "24H": 24 * 60 * 60_000,
  "7D": 7 * 24 * 60 * 60_000,
  "30D": 30 * 24 * 60 * 60_000,
  "90D": 90 * 24 * 60 * 60_000,
};

const RANGE_OPTIONS: readonly RangeKey[] = ["24H", "7D", "30D", "90D", "Custom"];
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const SAVED_VIEWS_KEY = "incidentsSavedViews";

interface SavedView { name: string; filter: Partial<IncidentFilters> }

const PRESET_VIEWS: SavedView[] = [
  { name: "Open", filter: { status: "Open" } },
  { name: "My incidents", filter: { myIncidents: true } },
  { name: "SEV1–2", filter: { severity: ["SEV1", "SEV2"], status: "Open" } },
  { name: "Unacknowledged", filter: { status: "Open", unacked: true } },
  { name: "Last 7d", filter: { range: "7D" } },
];

const numberFmt = new Intl.NumberFormat();
const nfLocale = numberFmt.format;

type SortKey = "severity" | "status" | "started" | "duration";
type SortDir = "asc" | "desc";

const SEV_DOT: Record<IncidentSeverity, string> = { SEV1: SEVERITY_META.SEV1.dot, SEV2: SEVERITY_META.SEV2.dot, SEV3: SEVERITY_META.SEV3.dot, SEV4: SEVERITY_META.SEV4.dot };
const SEV_SHORT: Record<IncidentSeverity, string> = { SEV1: "SEV1", SEV2: "SEV2", SEV3: "SEV3", SEV4: "SEV4" };

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Re-render on an interval so "2h 14m" style durations stay live. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function activityMeta(type: string): { icon: LucideIcon; verb: string; tone: string } {
  switch (type) {
    case "created": return { icon: Siren, verb: "declared", tone: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400" };
    case "acknowledged": return { icon: CheckCheck, verb: "acknowledged", tone: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" };
    case "escalated": return { icon: ChevronsUp, verb: "escalated", tone: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400" };
    case "resolved": return { icon: CheckCircle2, verb: "resolved", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" };
    default: return { icon: FileText, verb: "added an update on", tone: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" };
  }
}

/** Highlight query matches in table text. */
function Highlight({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = trimmed.toLowerCase();
  const parts: Array<{ text: string; hit: boolean }> = [];
  let index = 0;
  for (;;) {
    const found = lower.indexOf(needle, index);
    if (found === -1) {
      parts.push({ text: text.slice(index), hit: false });
      break;
    }
    if (found > index) parts.push({ text: text.slice(index, found), hit: false });
    parts.push({ text: text.slice(found, found + needle.length), hit: true });
    index = found + needle.length;
  }
  return (
    <>
      {parts.map((part, partIndex) =>
        part.hit ? (
          <mark key={partIndex} className="rounded-sm bg-amber-200/80 text-inherit dark:bg-amber-500/30">{part.text}</mark>
        ) : (
          <span key={partIndex}>{part.text}</span>
        ),
      )}
    </>
  );
}

function activeFilterCount(filters: IncidentFilters): number {
  let count = 0;
  if (filters.status !== "All") count += 1;
  count += filters.severity.length;
  if (filters.service !== "all") count += 1;
  if (filters.team !== "all") count += 1;
  if (filters.commander !== "all") count += 1;
  if (filters.range !== "30D") count += 1;
  if (filters.query.trim()) count += 1;
  if (filters.myIncidents) count += 1;
  if (filters.unacked) count += 1;
  return count;
}

function csvCell(value: string): string {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function downloadBlob(content: string, type: string, filename: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const tooltipStyle = {
  border: "0.0625rem solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  boxShadow: "0 0.25rem 0.875rem oklch(0.2779 0.0632 258.88 / 0.07)",
} as const;

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((entry) => typeof entry.value === "number" && entry.value > 0);
  if (!rows.length) return null;
  return (
    <div style={tooltipStyle} className="min-w-[8.75rem] px-3 py-2">
      <p className="mb-1.5 text-[0.75rem] font-semibold">{label}</p>
      <div className="space-y-1">
        {rows.map((entry) => {
          const severity = entry.dataKey as IncidentSeverity;
          return (
            <div key={severity} className="flex items-center justify-between gap-4 text-[0.75rem]">
              <span className="flex items-center gap-1.5">
                <i aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: SEV_DOT[severity] }} />
                {SEV_SHORT[severity]}
              </span>
              <b className="tabular-nums">{entry.value}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number; payload?: { pct?: number } }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div style={tooltipStyle} className="px-3 py-2 text-[0.75rem]">
      <p className="font-semibold">{item.name}</p>
      <p className="tabular-nums text-muted-foreground">{item.value} incidents ({item.payload?.pct?.toFixed(1)}%)</p>
    </div>
  );
}

export function IncidentsDashboard() {
  const router = useRouter();
  const tableRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);
  const didInitURL = useRef(false);

  const {
    incidents, status, reload,
    acknowledge, resolve, assign, changeSeverity, changeStatus, escalate, addUpdate, restore,
  } = useIncidents();
  const isLoading = status === "loading";
  const isError = status === "error";

  const now = useNow(60_000);
  const suppressedIncidents24h = useMemo(() => incidentsSuppressed24h(), [incidents]);
  const [filters, setFilters] = useState<IncidentFilters>(DEFAULT_FILTERS);
  const [trendRange, setTrendRange] = useState<TrendRange>("7D");
  const [density, setDensity] = useState<"default" | "compact">("default");
  const [timeMode, setTimeMode] = useState<"utc" | "local">("utc");
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addUpdateId, setAddUpdateId] = useState<string | null>(null);
  const [updateDraft, setUpdateDraft] = useState("");
  const [updateType, setUpdateType] = useState<"update" | "note" | "status">("update");
  const [toast, setToast] = useState<{ id: number; message: string; undo?: IncidentRestoreSnapshot[] } | null>(null);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(() => Date.now());

  const showToast = useCallback((message: string, undo?: IncidentRestoreSnapshot[]) => {
    setToast({ id: Date.now(), message, undo });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
      if (raw) setSavedViews(JSON.parse(raw) as SavedView[]);
    } catch {
      setSavedViews([]);
    }
  }, []);

  /* URL params: read once on mount */
  useEffect(() => {
    if (didInitURL.current) return;
    didInitURL.current = true;
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get("status");
    const severityParam = params.get("sev");
    const rangeParam = params.get("range");
    const fromParam = params.get("from");
    const toParam = params.get("to");
    const isStatus = (value: string | null): value is IncidentFilters["status"] =>
      value === "All" || value === "Open" || value === "Investigating" || value === "Identified" || value === "Monitoring" || value === "Resolved";
    const isRange = (value: string | null): value is RangeKey =>
      value === "24H" || value === "7D" || value === "30D" || value === "90D" || value === "Custom";
    setFilters({
      status: isStatus(statusParam) ? statusParam : "All",
      severity: (severityParam ?? "").split(",").filter((value): value is IncidentSeverity => SEVERITY_ORDER.includes(value as IncidentSeverity)),
      service: params.get("service") ?? "all",
      team: params.get("team") ?? "all",
      commander: params.get("commander") ?? "all",
      range: isRange(rangeParam) ? rangeParam : "30D",
      customFrom: fromParam ?? "",
      customTo: toParam ?? "",
      query: params.get("q") ?? "",
      myIncidents: params.get("my") === "1",
      unacked: params.get("unacked") === "1",
    });
  }, []);

  /* URL params: write on change (skip defaults) */
  useEffect(() => {
    if (!didInitURL.current) return;
    const params = new URLSearchParams();
    if (filters.status !== "All") params.set("status", filters.status);
    if (filters.severity.length > 0) params.set("sev", filters.severity.join(","));
    if (filters.service !== "all") params.set("service", filters.service);
    if (filters.team !== "all") params.set("team", filters.team);
    if (filters.commander !== "all") params.set("commander", filters.commander);
    if (filters.range !== "30D") params.set("range", filters.range);
    if (filters.range === "Custom" && filters.customFrom) params.set("from", filters.customFrom);
    if (filters.range === "Custom" && filters.customTo) params.set("to", filters.customTo);
    if (filters.query.trim()) params.set("q", filters.query.trim());
    if (filters.myIncidents) params.set("my", "1");
    if (filters.unacked) params.set("unacked", "1");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [filters]);

  /* "/" focuses search */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const setFilter = useCallback(<K extends keyof IncidentFilters>(key: K, value: IncidentFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSelectedIds([]);
    setPage(1);
  }, []);

  const toggleSeverity = useCallback((severity: IncidentSeverity) => {
    setFilters((current) => ({
      ...current,
      severity: current.severity.includes(severity)
        ? current.severity.filter((value) => value !== severity)
        : [...current.severity, severity],
    }));
    setPage(1);
  }, []);

  /* ------------------------------ derived data ----------------------------- */

  const stats = useMemo(() => {
    const open = incidents.filter(isOpenIncident);
    const criticalOpen = open.filter((incident) => incident.severity === "SEV1" || incident.severity === "SEV2").length;
    const ackOpen = open.filter((incident) => incident.acknowledgedAt != null).length;
    const ackDeltas = incidents
      .filter((incident) => incident.acknowledgedAt != null)
      .map((incident) => (Date.parse(incident.acknowledgedAt as string) - Date.parse(incident.startedAt)) / 60_000);
    const resolveDeltas = incidents
      .filter((incident): incident is Incident & { resolvedAt: string } => incident.resolvedAt != null)
      .map((incident) => (Date.parse(incident.resolvedAt) - Date.parse(incident.startedAt)) / 60_000);
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60_000;
    return {
      open: open.length,
      criticalOpen,
      ackOpen,
      mtta: ackDeltas.length ? Math.round(ackDeltas.reduce((sum, value) => sum + value, 0) / ackDeltas.length) : null,
      mttr: resolveDeltas.length ? Math.round(resolveDeltas.reduce((sum, value) => sum + value, 0) / resolveDeltas.length) : null,
      resolved30d: incidents.filter((incident) => incident.resolvedAt != null && Date.parse(incident.resolvedAt) >= thirtyDaysAgo).length,
      oldestOpenMin: open.reduce((max, incident) => Math.max(max, now - Date.parse(incident.startedAt)), 0) / 60_000,
      sev12Open: criticalOpen,
    };
  }, [incidents, now]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: incidents.length, Open: 0, Investigating: 0, Identified: 0, Monitoring: 0, Resolved: 0 };
    for (const incident of incidents) {
      counts[incident.status] += 1;
      if (isOpenIncident(incident)) counts.Open += 1;
    }
    return counts;
  }, [incidents]);

  const severityCounts = useMemo(() => {
    const counts: Record<IncidentSeverity, number> = { SEV1: 0, SEV2: 0, SEV3: 0, SEV4: 0 };
    for (const incident of incidents) counts[incident.severity] += 1;
    return counts;
  }, [incidents]);

  const filtered = useMemo(() => {
    const queryTokens = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
    const nowMs = Date.now();
    let rangeStart: number | null = null;
    let rangeEnd: number | null = null;
    if (filters.range === "Custom") {
      if (filters.customFrom) rangeStart = new Date(`${filters.customFrom}T00:00:00`).getTime();
      if (filters.customTo) rangeEnd = new Date(`${filters.customTo}T23:59:59`).getTime();
    } else {
      rangeStart = nowMs - RANGE_MS[filters.range];
    }
    return incidents.filter((incident) => {
      if (filters.status === "Open" ? !isOpenIncident(incident) : filters.status !== "All" && incident.status !== filters.status) return false;
      if (filters.severity.length > 0 && !filters.severity.includes(incident.severity)) return false;
      if (filters.service !== "all" && !incident.affectedServices.includes(filters.service)) return false;
      if (filters.team !== "all" && incident.team !== filters.team) return false;
      if (filters.commander !== "all" && incident.commander !== filters.commander) return false;
      if (filters.unacked && !(isOpenIncident(incident) && incident.acknowledgedAt == null)) return false;
      if (filters.myIncidents && incident.commander !== CURRENT_USER_NAME && incident.assignee !== CURRENT_USER_NAME) return false;
      const started = Date.parse(incident.startedAt);
      if (rangeStart != null && started < rangeStart) return false;
      if (rangeEnd != null && started > rangeEnd) return false;
      if (queryTokens.length > 0) {
        const haystack = [incident.id, incident.title, incident.impact, incident.commander, incident.assignee ?? "", incident.team, incident.rootCause, ...incident.affectedServices, ...incident.affectedHosts, ...incident.tags].join(" ").toLowerCase();
        if (!queryTokens.every((token) => haystack.includes(token))) return false;
      }
      return true;
    });
  }, [incidents, filters]);

  const sorted = useMemo(() => {
    const direction = sortDir === "asc" ? 1 : -1;
    const compare = (a: Incident, b: Incident) => {
      const openDiff = Number(!isOpenIncident(a)) - Number(!isOpenIncident(b));
      if (openDiff !== 0) return openDiff;
      let result = 0;
      switch (sortKey) {
        case "severity":
          result = severityRank(a.severity) - severityRank(b.severity);
          if (result === 0) result = Date.parse(b.startedAt) - Date.parse(a.startedAt);
          break;
        case "status":
          result = statusRank(a.status) - statusRank(b.status);
          if (result === 0) result = severityRank(a.severity) - severityRank(b.severity);
          break;
        case "started":
          result = Date.parse(a.startedAt) - Date.parse(b.startedAt);
          break;
        case "duration":
          result = durationMinutes(a, now) - durationMinutes(b, now);
          break;
      }
      return result * direction;
    };
    return [...filtered].sort(compare);
  }, [filtered, sortKey, sortDir, now]);

  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageStart = totalFiltered === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const pageEnd = Math.min(totalFiltered, clampedPage * pageSize);
  const pageItems = useMemo(() => sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize), [sorted, clampedPage, pageSize]);

  /* Prune selection to currently-visible rows */
  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => filtered.some((incident) => incident.id === id)));
  }, [filtered]);

  const allFilteredSelected = pageItems.length > 0 && pageItems.every((incident) => selectedIds.includes(incident.id));
  const someFilteredSelected = pageItems.some((incident) => selectedIds.includes(incident.id));
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = !allFilteredSelected && someFilteredSelected;
  }, [allFilteredSelected, someFilteredSelected]);

  const trend = useMemo(() => trendBuckets(incidents, trendRange), [incidents, trendRange]);
  const trendTotal = useMemo(() => trend.reduce((sum, bucket) => sum + bucket.SEV1 + bucket.SEV2 + bucket.SEV3 + bucket.SEV4, 0), [trend]);
  const trendPeak = useMemo(() => trend.reduce((peak, bucket) => {
    const total = bucket.SEV1 + bucket.SEV2 + bucket.SEV3 + bucket.SEV4;
    return total > peak.total ? { label: bucket.label, total } : peak;
  }, { label: "—", total: 0 }), [trend]);
  const trendAvg = trend.length ? trendTotal / trend.length : 0;

  const severityDonut = useMemo(() => {
    const total = incidents.length;
    return SEVERITY_ORDER.map((severity) => ({
      severity,
      name: SEVERITY_META[severity].label,
      short: SEVERITY_META[severity].label.split(" ")[0],
      value: severityCounts[severity],
      pct: total ? (severityCounts[severity] / total) * 100 : 0,
      color: SEV_DOT[severity],
    }));
  }, [incidents.length, severityCounts]);

  const topServices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const incident of incidents) for (const service of incident.affectedServices) counts.set(service, (counts.get(service) ?? 0) + 1);
    const rows = [...counts.entries()].map(([service, count]) => ({ service, count }));
    return rows.sort((a, b) => b.count - a.count || a.service.localeCompare(b.service)).slice(0, 6);
  }, [incidents]);
  const maxServiceCount = topServices.reduce((max, row) => Math.max(max, row.count), 1);

  const postmortems = useMemo(
    () => [...incidents].filter((incident) => incident.postmortem.status !== "None").sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)).slice(0, 5),
    [incidents],
  );

  const recentActivity = useMemo(() => {
    const rows: Array<{ id: string; epochMs: number; type: string; author: string; incidentId: string; text: string }> = [];
    for (const incident of incidents) {
      for (const entry of incident.timeline) {
        rows.push({ id: entry.id, epochMs: entry.epochMs, type: entry.type, author: entry.author, incidentId: incident.id, text: entry.text });
      }
    }
    return rows.sort((a, b) => b.epochMs - a.epochMs).slice(0, 6);
  }, [incidents]);

  /* ------------------------------- actions --------------------------------- */

  const sortBy = useCallback((key: SortKey) => {
    setSortKey((current) => {
      if (current === key) {
        setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
        return current;
      }
      setSortDir(key === "started" || key === "duration" ? "desc" : "asc");
      return key;
    });
  }, []);

  const pageToggleAll = useCallback(() => {
    setSelectedIds((current) => {
      const pageIds = pageItems.map((incident) => incident.id);
      if (allFilteredSelected) return current.filter((id) => !pageIds.includes(id));
      return [...new Set([...current, ...pageIds])];
    });
  }, [pageItems, allFilteredSelected]);

  const selectIncident = useCallback((id: string, checked: boolean) => {
    setSelectedIds((current) => (checked ? [...new Set([...current, id])] : current.filter((value) => value !== id)));
  }, []);

  const bulkRun = useCallback((action: (ids: string[]) => void, message: string) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const snapshot = incidents.filter((incident) => ids.includes(incident.id)).map(snapshotOf);
    action(ids);
    setSelectedIds([]);
    showToast(message.replace("{n}", String(ids.length)), snapshot);
  }, [selectedIds, incidents, showToast]);

  const bulkAcknowledge = useCallback(() => {
    const ids = [...selectedIds];
    const targets = incidents.filter((incident) => ids.includes(incident.id) && isOpenIncident(incident) && incident.acknowledgedAt == null).map((incident) => incident.id);
    if (targets.length === 0) { showToast("Nothing to acknowledge."); return; }
    acknowledge(targets);
    setSelectedIds([]);
    showToast(`${targets.length} incident${targets.length === 1 ? "" : "s"} acknowledged.`);
  }, [selectedIds, incidents, acknowledge, showToast]);

  const copyLink = useCallback((incident: Incident) => {
    const url = `${window.location.origin}/incidents/${incident.id}`;
    const done = () => showToast(`Link copied for ${incident.id}.`);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, () => showToast(url));
    else showToast(url);
  }, [showToast]);

  const exportRows = useCallback((kind: "csv" | "json", rows: Incident[], label: string) => {
    const flat = rows.map((incident) => ({
      id: incident.id, title: incident.title, severity: incident.severity, status: incident.status,
      commander: incident.commander, assignee: incident.assignee ?? "", team: incident.team,
      services: incident.affectedServices.join("|"), hosts: incident.affectedHosts.join("|"),
      impact: incident.impact, startedAt: incident.startedAt, acknowledgedAt: incident.acknowledgedAt ?? "",
      resolvedAt: incident.resolvedAt ?? "", durationMin: String(durationMinutes(incident)), tags: incident.tags.join("|"),
    }));
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === "json") {
      downloadBlob(JSON.stringify(rows, null, 2), "application/json;charset=utf-8", `incidents-${stamp}.json`);
    } else {
      const header = Object.keys(flat[0] ?? { id: "" });
      const body = [header.join(","), ...flat.map((row) => header.map((key) => csvCell(String((row as Record<string, unknown>)[key] ?? ""))).join(","))].join("\r\n");
      downloadBlob(body, "text/csv;charset=utf-8", `incidents-${stamp}.csv`);
    }
    showToast(`${kind.toUpperCase()} exported (${rows.length} ${label}).`);
  }, [showToast]);

  const kebabFor = useCallback((incident: Incident): AlertMenuItem[] => [
    { key: "ack", label: "Acknowledge", disabled: !isOpenIncident(incident) || incident.acknowledgedAt != null, onSelect: () => { acknowledge([incident.id]); showToast(`${incident.id} acknowledged.`); } },
    {
      key: "assign", label: "Assign",
      items: [
        ...INCIDENT_PEOPLE.map((person) => ({ key: person, label: person, disabled: incident.assignee === person, onSelect: () => { assign([incident.id], person); showToast(`${incident.id} assigned to ${person}.`); } })),
        { key: "unassign", label: "Unassign", disabled: incident.assignee == null, onSelect: () => { assign([incident.id], null); showToast(`${incident.id} unassigned.`); } },
      ],
    },
    {
      key: "severity", label: "Change severity",
      items: SEVERITY_ORDER.map((severity) => ({ key: severity, label: SEVERITY_META[severity].label, disabled: incident.severity === severity, onSelect: () => { changeSeverity([incident.id], severity); showToast(`${incident.id} severity → ${severity}.`); } })),
    },
    {
      key: "status", label: "Change status",
      items: STATUS_ORDER.map((statusValue) => ({ key: statusValue, label: statusValue, disabled: incident.status === statusValue, onSelect: () => { changeStatus([incident.id], statusValue); showToast(`${incident.id} → ${statusValue}.`); } })),
    },
    { key: "update", label: "Add update", onSelect: () => { setUpdateDraft(""); setUpdateType("update"); setAddUpdateId(incident.id); } },
    { key: "escalate", label: "Escalate", disabled: !isOpenIncident(incident), onSelect: () => { escalate([incident.id]); showToast(`${incident.id} escalated to secondary responder.`); } },
    { key: "resolve", label: "Resolve", disabled: incident.status === "Resolved", onSelect: () => { resolve([incident.id]); showToast(`${incident.id} resolved.`); } },
    { divider: true, key: "d1", label: "" },
    { key: "copy", label: "Copy link", onSelect: () => copyLink(incident) },
  ], [acknowledge, assign, changeSeverity, changeStatus, escalate, resolve, copyLink, showToast]);

  const submitUpdate = useCallback(() => {
    if (!addUpdateId || !updateDraft.trim()) return;
    addUpdate(addUpdateId, updateDraft.trim(), updateType);
    showToast(`Update posted on ${addUpdateId}.`);
    setAddUpdateId(null);
    setUpdateDraft("");
  }, [addUpdateId, updateDraft, updateType, addUpdate, showToast]);

  const viewActive = useCallback(() => {
    setFilter("status", "Open");
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [setFilter]);

  const saveCurrentView = useCallback(() => {
    const name = window.prompt("Name this view");
    if (!name?.trim()) return;
    const next = [...savedViews.filter((view) => view.name !== name.trim()), { name: name.trim(), filter: { ...filters } }];
    setSavedViews(next);
    try {
      window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next));
    } catch {
      showToast("Could not persist the view (localStorage unavailable).");
      return;
    }
    showToast(`View "${name.trim()}" saved.`);
  }, [filters, savedViews, showToast]);

  const applyView = useCallback((view: SavedView) => {
    setFilters({ ...DEFAULT_FILTERS, ...view.filter });
    setSelectedIds([]);
    setPage(1);
    showToast(`View "${view.name}" applied.`);
  }, [showToast]);

  const clearSavedViews = useCallback(() => {
    setSavedViews([]);
    try {
      window.localStorage.removeItem(SAVED_VIEWS_KEY);
    } catch {
      /* localStorage unavailable */
    }
    showToast("Saved views cleared.");
  }, [showToast]);

  const savedViewItems: AlertMenuItem[] = [
    ...PRESET_VIEWS.map((view) => ({ key: `preset:${view.name}`, label: view.name, onSelect: () => applyView(view) })),
    ...(savedViews.length > 0 ? [{ divider: true, key: "d" as const, label: "" } as AlertMenuItem] : []),
    ...savedViews.map((view) => ({ key: `saved:${view.name}`, label: view.name, onSelect: () => applyView(view) })),
    { divider: true, key: "d2", label: "" },
    { key: "save", label: "Save current view", onSelect: saveCurrentView },
    ...(savedViews.length > 0 ? [{ key: "clear", label: "Reset saved views", danger: true, onSelect: clearSavedViews } as AlertMenuItem] : []),
  ];

  const bulkStatusItems: AlertMenuItem[] = STATUS_ORDER.map((statusValue) => ({
    key: statusValue, label: statusValue, onSelect: () => bulkRun((ids) => changeStatus(ids, statusValue), `{n} incident(s) → ${statusValue}.`),
  }));
  const bulkAssignItems: AlertMenuItem[] = [
    ...INCIDENT_PEOPLE.map((person) => ({ key: person, label: person, onSelect: () => bulkRun((ids) => assign(ids, person), `{n} incident(s) assigned to ${person}.`) })),
    { key: "unassign", label: "Unassign", onSelect: () => bulkRun((ids) => assign(ids, null), "{n} incident(s) unassigned.") },
  ];

  const exportItems: AlertMenuItem[] = [
    { key: "csv", label: "Export CSV", onSelect: () => exportRows("csv", sorted, "incidents") },
    { key: "json", label: "Export JSON", onSelect: () => exportRows("json", sorted, "incidents") },
  ];

  /* page number items for pagination */
  const pageNumbers: Array<number | "…"> = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const set = new Set<number>([1, totalPages, clampedPage - 1, clampedPage, clampedPage + 1]);
    const list = [...set].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
    const out: Array<number | "…"> = [];
    for (let index = 0; index < list.length; index += 1) {
      out.push(list[index]);
      if (index < list.length - 1 && list[index + 1] - list[index] > 1) out.push("…");
    }
    return out;
  }, [totalPages, clampedPage]);

  const tzLabel = Intl.DateTimeFormat().resolvedOptions().timeZone;

  /* ------------------------------ render ----------------------------------- */

  const rowHeight = density === "compact" ? "h-10" : "h-14";
  const goToIncident = (id: string) => router.push(`/incidents/${id}`);

  const errorState = (
    <section role="alert" className="grid min-h-[20rem] place-items-center rounded-xl border border-border bg-card p-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-2">
        <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10"><TriangleAlert size={20} /></span>
        <p className="font-display text-base font-bold text-foreground">Incidents could not be loaded</p>
        <p className="text-sm text-muted-foreground">The incident service failed to respond. Retry to reload the queue.</p>
        <Button onClick={reload} className="h-10 gap-1.5 rounded-lg px-4 text-sm"><RotateCcw size={15} />Retry</Button>
      </div>
    </section>
  );

  const skeletonState = (
    <>
      <section aria-busy="true" aria-label="Loading incident summary" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[6.5rem] animate-pulse rounded-xl bg-muted" />)}
      </section>
      <section aria-busy="true" className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-12">
        <div className="h-[20rem] animate-pulse rounded-xl bg-muted md:col-span-2 xl:col-span-6" />
        <div className="h-[20rem] animate-pulse rounded-xl bg-muted xl:col-span-3" />
        <div className="h-[20rem] animate-pulse rounded-xl bg-muted xl:col-span-3" />
      </section>
      <div className="h-[32.5rem] animate-pulse rounded-xl bg-muted" />
    </>
  );

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Operations", "Incidents"]}
        title="Incidents"
        subtitle="Track, manage and learn from incidents across your infrastructure."
        lastUpdated={timeAgo(lastRefreshedAt)}
        onRefresh={() => { reload(); setLastRefreshedAt(Date.now()); }}
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <AlertMenu
              label="Export incidents"
              trigger={
                <Button variant="outline" className="h-10 gap-1.5 rounded-lg px-3 text-sm">
                  <FileDown size={15} aria-hidden="true" />Export<ChevronDown size={13} aria-hidden="true" className="text-muted-foreground" />
                </Button>
              }
              items={exportItems}
            />
            <Link
              href="/incidents/new"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white shadow transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Siren size={15} aria-hidden="true" />Declare Incident
            </Link>
          </div>
        }
      />

      {isError && errorState}

      {isLoading && skeletonState}

      {!isLoading && !isError && (
        <>
          {/* Active incidents banner */}
          {stats.open > 0 ? (
            <div role="status" className="flex min-h-[2.75rem] flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200/80 bg-red-50 px-4 py-1.5 dark:border-red-500/25 dark:bg-red-500/10">
              <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm text-red-900 dark:text-red-200">
                <Siren size={15} aria-hidden="true" className="shrink-0" />
                <span className="font-semibold">{stats.open} active incident{stats.open === 1 ? "" : "s"}</span>
                <span aria-hidden="true" className="text-red-300 dark:text-red-500">·</span>
                <span>oldest open for {formatMinutes(stats.oldestOpenMin)}</span>
                <span aria-hidden="true" className="text-red-300 dark:text-red-500">·</span>
                <span>{stats.sev12Open} SEV1-2</span>{suppressedIncidents24h > 0 && (<><span aria-hidden="true" className="text-red-300 dark:text-red-500">·</span><a href="/maintenance-windows" className="inline-flex items-center gap-1 font-semibold text-red-900 underline decoration-red-300 underline-offset-2 hover:text-red-700 dark:text-red-100 dark:decoration-red-700">{suppressedIncidents24h} suppressed by maintenance</a></>)}
              </p>
              <button
                type="button"
                onClick={viewActive}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-white px-3 text-[0.8125rem] font-semibold text-red-800 shadow-sm transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200"
              >
                View active<ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div role="status" className="flex min-h-[2.75rem] items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-1.5 text-sm text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
              <CheckCircle2 size={15} aria-hidden="true" />
              <span className="font-semibold">No active incidents</span>
              <span className="text-emerald-700/80 dark:text-emerald-300/80">— everything is within SLO right now.</span>
            </div>
          )}

          {/* Stat cards */}
          <section aria-label="Incident key performance indicators" className="grid grid-cols-2 items-stretch gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatCard icon={<Siren size={20} aria-hidden="true" />} iconTone="bg-[oklch(0.9544_0.023_10.96)] text-red-600 dark:bg-[oklch(0.328_0.0487_357.32)] dark:text-[oklch(0.7663_0.1406_13.84)]" label="Open Incidents" value={nfLocale(stats.open)} delta={2} deltaPercent="50.0%" goodDirection="down" className="h-full" />
            <StatCard icon={<TriangleAlert size={20} aria-hidden="true" />} iconTone="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400" label="Critical (SEV1-2)" value={nfLocale(stats.criticalOpen)} delta={1} deltaPercent="33.3%" goodDirection="down" className="h-full" />
            <StatCard icon={<CheckCheck size={20} aria-hidden="true" />} iconTone="bg-[oklch(0.9492_0.0252_249.95)] text-[oklch(0.5854_0.1886_255.66)] dark:bg-[oklch(0.3358_0.0746_252.64)] dark:text-[oklch(0.7396_0.14_249.73)]" label="Acknowledged" value={nfLocale(stats.ackOpen)} delta={2} deltaPercent="66.7%" goodDirection="up" detail={`of ${stats.open} open`} className="h-full" />
            <StatCard icon={<Clock3 size={20} aria-hidden="true" />} iconTone="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" label="MTTA" value={stats.mtta == null ? "—" : formatMinutes(stats.mtta)} delta={2} deltaPercent="20.0%" goodDirection="down" className="h-full" />
            <StatCard icon={<Timer size={20} aria-hidden="true" />} iconTone="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" label="MTTR" value={stats.mttr == null ? "—" : formatMinutes(stats.mttr)} delta={-24} deltaPercent="9.6%" goodDirection="down" className="h-full" />
            <StatCard icon={<CheckCircle2 size={20} aria-hidden="true" />} iconTone="bg-[oklch(0.9553_0.0297_164.3)] text-green-600 dark:bg-[oklch(0.3149_0.0537_163.8)] dark:text-[oklch(0.7869_0.1465_160.69)]" label="Resolved (30d)" value={nfLocale(stats.resolved30d)} delta={6} deltaPercent="33.3%" goodDirection="up" className="h-full" />
          </section>

          {/* Insights row 1: trend / severity donut / top services */}
          <section aria-label="Incident insights" className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-12">
            <ChartCard
              className="min-w-0 md:col-span-2 xl:col-span-6"
              title="Incident Trend"
              actions={
                <div className="flex items-center gap-1.5">
                  <SegmentedControl value={trendRange} options={["7D", "30D", "90D"]} onChange={(value) => setTrendRange(value as TrendRange)} buttonClassName="px-3 text-sm" />
                  <AlertMenu
                    label="Incident trend options"
                    trigger={<Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="Incident trend options"><MoreVertical size={15} /></Button>}
                    items={[
                      { key: "copy", label: "Copy chart data (CSV)", onSelect: () => { const csv = ["bucket,SEV1,SEV2,SEV3,SEV4", ...trend.map((bucket) => `${bucket.label},${bucket.SEV1},${bucket.SEV2},${bucket.SEV3},${bucket.SEV4}`)].join("\r\n"); downloadBlob(csv, "text/csv;charset=utf-8", `incident-trend-${trendRange.toLowerCase()}.csv`); showToast("Trend data copied as CSV."); } },
                      { key: "refresh", label: "Refresh", onSelect: reload },
                    ]}
                  />
                </div>
              }
            >
              <div className="h-[11.25rem] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barCategoryGap="28%">
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={0} tickCount={6} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} width={26} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TrendTooltip />} cursor={{ fill: "var(--muted)", fillOpacity: 0.45 }} wrapperStyle={{ pointerEvents: "none", outline: "none" }} />
                    {SEVERITY_ORDER.map((severity) => (
                      <Bar key={severity} dataKey={severity} stackId="sev" fill={SEV_DOT[severity]} radius={severity === "SEV4" ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Toggle severity filters">
                {SEVERITY_ORDER.map((severity) => {
                  const active = filters.severity.includes(severity);
                  return (
                    <button
                      key={severity}
                      type="button"
                      onClick={() => toggleSeverity(severity)}
                      aria-pressed={active}
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <i aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: SEV_DOT[severity] }} />
                      {SEV_SHORT[severity]}
                      <span className="tabular-nums opacity-80">({severityCounts[severity]})</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-auto grid grid-cols-3 divide-x divide-border border-t border-border pt-3 text-center">
                <div className="px-2"><p className="text-[0.75rem] text-muted-foreground">Total</p><p className="font-display text-lg font-bold tabular-nums text-foreground">{trendTotal}</p></div>
                <div className="px-2"><p className="text-[0.75rem] text-muted-foreground">Peak day</p><p className="font-display text-lg font-bold tabular-nums text-foreground">{trendPeak.total > 0 ? trendPeak.total : "—"}<span className="ml-1 text-[0.75rem] font-medium text-muted-foreground">{trendPeak.total > 0 ? trendPeak.label : ""}</span></p></div>
                <div className="px-2"><p className="text-[0.75rem] text-muted-foreground">Avg / day</p><p className="font-display text-lg font-bold tabular-nums text-foreground">{trendAvg.toFixed(1)}</p></div>
              </div>
            </ChartCard>

            <ChartCard
              className="min-w-0 xl:col-span-3"
              title="Incidents by Severity"
              actions={
                <AlertMenu
                  label="Severity breakdown options"
                  trigger={<Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="Severity breakdown options"><MoreVertical size={15} /></Button>}
                  items={[
                    { key: "open", label: "View open incidents", onSelect: () => setFilter("status", "Open") },
                    { key: "sev12", label: "View SEV1-2 only", onSelect: () => setFilters((current) => ({ ...current, severity: ["SEV1", "SEV2"], status: "Open" })) },
                  ]}
                />
              }
            >
              <div className="flex flex-1 items-center gap-4">
                <div className="relative h-[8.125rem] w-[8.125rem] shrink-0" role="img" aria-label={`Severity distribution across ${incidents.length} incidents`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={severityDonut} dataKey="value" nameKey="short" innerRadius={47} outerRadius={65} paddingAngle={2} strokeWidth={2}>
                        {severityDonut.map((entry) => <Cell key={entry.severity} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<DonutTooltip />} wrapperStyle={{ pointerEvents: "none", outline: "none" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="text-center">
                      <p className="font-display text-[1.375rem] font-bold leading-none tabular-nums text-foreground">{incidents.length}</p>
                      <p className="mt-1 text-[0.75rem] text-muted-foreground">Total</p>
                    </div>
                  </div>
                </div>
                <ul className="grid min-w-0 flex-1 grid-cols-3 gap-x-2 gap-y-3">
                  {severityDonut.map((entry) => {
                    const active = filters.severity.includes(entry.severity);
                    return (
                      <li key={entry.severity}>
                        <button
                          type="button"
                          onClick={() => toggleSeverity(entry.severity)}
                          aria-pressed={active}
                          aria-label={`Filter by ${entry.name}`}
                          className={cn(
                            "flex w-full flex-col items-start gap-0.5 rounded-lg border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/60",
                          )}
                        >
                          <span className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-foreground"><i aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: entry.color }} />{entry.short}</span>
                          <span className="text-[0.8125rem] font-bold tabular-nums text-foreground">{entry.value}<span className="ml-1 text-[0.75rem] font-medium text-muted-foreground">{entry.pct.toFixed(1)}%</span></span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </ChartCard>

            <ChartCard
              className="min-w-0 xl:col-span-3"
              title="Top Affected Services"
              actions={
                <AlertMenu
                  label="Affected services options"
                  trigger={<Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="Affected services options"><MoreVertical size={15} /></Button>}
                  items={[
                    { key: "clear", label: "Clear service filter", disabled: filters.service === "all", onSelect: () => setFilter("service", "all") },
                    { key: "all", label: "Show all incidents", onSelect: resetFilters },
                  ]}
                />
              }
            >
              <ul className="flex flex-1 flex-col justify-center gap-1">
                {topServices.map(({ service, count }) => (
                  <li key={service}>
                    <button
                      type="button"
                      onClick={() => setFilter("service", service)}
                      title={`Filter incidents by ${service}`}
                      aria-pressed={filters.service === service}
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,1fr)_minmax(3.5rem,1.4fr)_2rem] items-center gap-2 rounded-lg px-1.5 py-[0.4375rem] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        filters.service === service ? "bg-primary/5 ring-1 ring-inset ring-primary/40" : "hover:bg-muted/60",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <TechLogo name={service} className="!h-6 !w-6 !rounded-md [&_svg]:!h-3.5 [&_svg]:!w-3.5" />
                        <span className="truncate text-[0.8125rem] font-medium text-foreground">{service}</span>
                      </span>
                      <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-blue-500" style={{ width: `${(count / maxServiceCount) * 100}%` }} /></span>
                      <b className="text-right text-[0.8125rem] tabular-nums text-foreground">{count}</b>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                <span className="text-[0.75rem] text-muted-foreground">{topServices.length} of {INCIDENT_SERVICES.length} services</span>
                <ViewAllLink label="View all" onClick={() => setFilter("service", "all")} />
              </div>
            </ChartCard>
          </section>

          {/* Filter bar + incidents table */}
          <div ref={tableRef} className="scroll-mt-4">
          <Panel
            title="Incidents"
            showOptions={false}
            titleClassName="text-[1rem] font-semibold"
            headerClassName="h-10"
            className="flex min-w-0 flex-col rounded-xl p-4"
            action={
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-[0.75rem] font-semibold text-muted-foreground">
                  <SlidersHorizontal size={11} aria-hidden="true" />
                  {filtered.length} {filtered.length === 1 ? "incident" : "incidents"}
                </span>
                <SegmentedControl
                  value={density === "default" ? "Default" : "Compact"}
                  options={["Default", "Compact"]}
                  onChange={(value) => setDensity(value === "Compact" ? "compact" : "default")}
                  buttonClassName="h-7 px-2 text-[0.75rem]"
                />
                <AlertMenu
                  label="Table options"
                  trigger={<Button variant="ghost" size="icon-sm" className="h-8 w-8 text-muted-foreground" aria-label="Table options"><MoreVertical size={16} /></Button>}
                  items={[{ key: "export", label: "Export filtered (CSV)", onSelect: () => exportRows("csv", sorted, "filtered incidents") }]}
                />
              </div>
            }
          >
            {/* Filter bar */}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
                {([
                  { key: "All", label: "All" },
                  { key: "Open", label: "Open" },
                  { key: "Investigating", label: "Investigating" },
                  { key: "Identified", label: "Identified" },
                  { key: "Monitoring", label: "Monitoring" },
                  { key: "Resolved", label: "Resolved" },
                ] as Array<{ key: StatusFilter; label: string }>).map(({ key, label }) => (
                  <Chip key={key} active={filters.status === key} onClick={() => setFilter("status", key)}>
                    {label} <span className="tabular-nums opacity-70">{statusCounts[key]}</span>
                  </Chip>
                ))}
              </div>

              <span aria-hidden="true" className="mx-0.5 hidden h-5 w-px bg-border sm:block" />

              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by severity">
                {SEVERITY_ORDER.map((severity) => {
                  const active = filters.severity.includes(severity);
                  return (
                    <button
                      key={severity}
                      type="button"
                      onClick={() => toggleSeverity(severity)}
                      aria-pressed={active}
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <i aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: SEV_DOT[severity] }} />
                      {severity} <span className="tabular-nums opacity-70">{severityCounts[severity]}</span>
                    </button>
                  );
                })}
              </div>

              <span aria-hidden="true" className="mx-0.5 hidden h-5 w-px bg-border sm:block" />

              <button
                type="button"
                role="switch"
                aria-checked={filters.myIncidents}
                onClick={() => setFilter("myIncidents", !filters.myIncidents)}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  filters.myIncidents ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                <span aria-hidden="true" className={cn("grid h-4 w-4 place-items-center rounded-full border", filters.myIncidents ? "border-primary-foreground/60 bg-primary-foreground/20" : "border-border")}>{filters.myIncidents && <Check size={11} aria-hidden="true" />}</span>
                My incidents
              </button>

              <Select value={filters.service} onValueChange={(value) => setFilter("service", value)}>
                <SelectTrigger className="h-9 w-[9.25rem] text-sm" aria-label="Filter by service"><SelectValue placeholder="Service" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-sm">All services</SelectItem>
                  {INCIDENT_SERVICES.map((service) => <SelectItem key={service} value={service} className="text-sm">{service}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filters.team} onValueChange={(value) => setFilter("team", value)}>
                <SelectTrigger className="h-9 w-[9.375rem] text-sm" aria-label="Filter by team"><SelectValue placeholder="Team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-sm">All teams</SelectItem>
                  {INCIDENT_TEAMS.map((team) => <SelectItem key={team} value={team} className="text-sm">{team}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filters.commander} onValueChange={(value) => setFilter("commander", value)}>
                <SelectTrigger className="h-9 w-[9.875rem] text-sm" aria-label="Filter by commander"><SelectValue placeholder="Commander" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-sm">All commanders</SelectItem>
                  {INCIDENT_PEOPLE.map((person) => <SelectItem key={person} value={person} className="text-sm">{person}</SelectItem>)}
                </SelectContent>
              </Select>

              <SegmentedControl value={filters.range} options={RANGE_OPTIONS} onChange={(value) => setFilter("range", value as RangeKey)} buttonClassName="h-8 px-2.5 text-xs" />

              {filters.range === "Custom" && (
                <span className="flex items-center gap-1.5">
                  <Input type="date" value={filters.customFrom} onChange={(event) => setFilter("customFrom", event.target.value)} aria-label="From date" className="h-9 w-[8.625rem] text-sm" />
                  <span className="text-sm text-muted-foreground">–</span>
                  <Input type="date" value={filters.customTo} onChange={(event) => setFilter("customTo", event.target.value)} aria-label="To date" className="h-9 w-[8.625rem] text-sm" />
                </span>
              )}

              <div className="relative min-w-[11.875rem] flex-1">
                <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  value={filters.query}
                  onChange={(event) => setFilter("query", event.target.value)}
                  placeholder="Search incidents, services, ID..."
                  aria-label="Search incidents"
                  className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-9 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                />
                <kbd aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded border border-border bg-muted text-[0.75rem] font-semibold text-muted-foreground">/</kbd>
              </div>

              <AlertMenu
                label="Saved views"
                align="end"
                trigger={
                  <Button variant="outline" className="h-9 gap-1.5 rounded-lg px-3 text-sm">
                    <Bookmark size={14} aria-hidden="true" />Saved views<ChevronDown size={13} aria-hidden="true" className="text-muted-foreground" />
                  </Button>
                }
                items={savedViewItems}
              />

              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-9 items-center gap-1 rounded-md px-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X size={13} aria-hidden="true" />Reset
              </button>
            </div>

            {/* Bulk actions bar */}
            {selectedIds.length > 0 && (
              <div role="region" aria-label="Bulk actions" className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[0.8125rem] text-foreground">
                <b className="tabular-nums">{selectedIds.length} selected</b>
                <span aria-hidden="true" className="text-muted-foreground">·</span>
                <AlertMenu label="Bulk assign" trigger={<Button variant="ghost" size="sm" className="h-8 gap-1 rounded-lg px-2 text-[0.8125rem]">Assign<ChevronDown size={12} aria-hidden="true" /></Button>} items={bulkAssignItems} />
                <AlertMenu label="Bulk change status" trigger={<Button variant="ghost" size="sm" className="h-8 gap-1 rounded-lg px-2 text-[0.8125rem]">Change status<ChevronDown size={12} aria-hidden="true" /></Button>} items={bulkStatusItems} />
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg px-2 text-[0.8125rem]" onClick={() => bulkRun(resolve, "{n} incident(s) resolved.")}><CheckCircle2 size={13} aria-hidden="true" />Resolve</Button>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg px-2 text-[0.8125rem]" onClick={() => bulkAcknowledge()}><CheckCheck size={13} aria-hidden="true" />Acknowledge</Button>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg px-2 text-[0.8125rem]" onClick={() => exportRows("csv", sorted.filter((incident) => selectedIds.includes(incident.id)), "selected incidents")}><FileDown size={13} aria-hidden="true" />Export</Button>
                <button type="button" onClick={() => setSelectedIds([])} className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[0.8125rem] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Clear selection"><X size={13} aria-hidden="true" />Clear</button>
              </div>
            )}

            {/* Table */}
            {totalFiltered === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground"><FilterX size={20} /></span>
                <p className="font-display text-[0.9375rem] font-bold text-foreground">No incidents match your filters</p>
                <p className="text-[0.8125rem] text-muted-foreground">Try widening the time range or clearing the filters.</p>
                <Button variant="outline" size="sm" onClick={resetFilters} className="mt-1 h-9 rounded-lg px-3 text-[0.8125rem]">Reset filters</Button>
              </div>
            ) : (
              <>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[61.25rem] text-left text-[0.8125rem]">
                    <thead>
                      <tr className="border-b border-border text-[0.75rem] text-muted-foreground">
                        <th scope="col" className="w-10 px-2 pb-2.5">
                          <input ref={selectAllRef} type="checkbox" checked={allFilteredSelected} onChange={pageToggleAll} aria-label="Select all incidents on this page" className="h-4 w-4 accent-[oklch(0.5771_0.2152_27.33)]" />
                        </th>
                        <th scope="col" className="pb-2.5 pr-3 font-medium">ID</th>
                        <th scope="col" className="pb-2.5 pr-3 font-medium">Title</th>
                        <th scope="col" className="pb-2.5 pr-3 font-medium" aria-sort={sortKey === "severity" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                          <button type="button" onClick={() => sortBy("severity")} className="inline-flex items-center gap-1 rounded font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Severity{sortKey === "severity" ? (sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-60" />}</button>
                        </th>
                        <th scope="col" className="pb-2.5 pr-3 font-medium" aria-sort={sortKey === "status" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                          <button type="button" onClick={() => sortBy("status")} className="inline-flex items-center gap-1 rounded font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Status{sortKey === "status" ? (sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-60" />}</button>
                        </th>
                        <th scope="col" className="hidden pb-2.5 pr-3 font-medium lg:table-cell">Affected</th>
                        <th scope="col" className="hidden pb-2.5 pr-3 font-medium sm:table-cell">Commander</th>
                        <th scope="col" className="pb-2.5 pr-3 font-medium" aria-sort={sortKey === "started" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => sortBy("started")} className="inline-flex items-center gap-1 rounded font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Started{sortKey === "started" ? (sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-60" />}</button>
                            <SegmentedControl value={timeMode === "utc" ? "UTC" : "Local"} options={["UTC", "Local"]} onChange={(value) => setTimeMode(value === "UTC" ? "utc" : "local")} buttonClassName="h-7 px-2 text-[0.75rem]" />
                          </div>
                        </th>
                        <th scope="col" className="hidden pb-2.5 pr-3 font-medium md:table-cell" aria-sort={sortKey === "duration" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                          <button type="button" onClick={() => sortBy("duration")} className="inline-flex items-center gap-1 rounded font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Duration{sortKey === "duration" ? (sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-60" />}</button>
                        </th>
                        <th scope="col" className="w-24 pb-2.5 text-right font-medium"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((incident) => {
                        const meta = SEVERITY_META[incident.severity];
                        const open = isOpenIncident(incident);
                        const selected = selectedIds.includes(incident.id);
                        return (
                          <tr
                            key={incident.id}
                            role="link"
                            tabIndex={0}
                            aria-label={`View ${incident.id}: ${incident.title}`}
                            onClick={() => goToIncident(incident.id)}
                            onKeyDown={(event) => {
                              if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                                event.preventDefault();
                                goToIncident(incident.id);
                              }
                            }}
                            className={cn(
                              "group cursor-pointer border-b border-border/70 align-middle transition-colors last:border-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                              rowHeight,
                              selected && "bg-primary/[0.045]",
                            )}
                          >
                            <td className={cn("w-10 px-2", meta.stripe)} onClick={(event) => event.stopPropagation()}>
                              <input type="checkbox" checked={selected} onChange={(event) => selectIncident(incident.id, event.target.checked)} aria-label={`Select ${incident.id}`} className="h-4 w-4 accent-[oklch(0.5771_0.2152_27.33)]" />
                            </td>
                            <td className="whitespace-nowrap pr-3">
                              <Link href={`/incidents/${incident.id}`} className="font-mono text-[0.8125rem] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{incident.id}</Link>
                            </td>
                            <td className="max-w-[20.625rem] pr-3">
                              <span className="block truncate text-[0.8125rem] font-semibold text-foreground" title={incident.title}><Highlight text={incident.title} query={filters.query} /></span>
                              <span className="block truncate text-[0.75rem] text-muted-foreground" title={incident.impact}><Highlight text={incident.impact} query={filters.query} /></span>
                            </td>
                            <td className="whitespace-nowrap pr-3"><SeverityBadge severity={incident.severity} /></td>
                            <td className="whitespace-nowrap pr-3"><StatusBadge status={incident.status} /></td>
                            <td className="hidden pr-3 lg:table-cell" onClick={(event) => event.stopPropagation()}>
                              <div className="flex max-w-[11.25rem] flex-wrap items-center gap-1">
                                {incident.affectedServices.slice(0, 2).map((service) => (
                                  <button key={service} type="button" onClick={() => setFilter("service", service)} title={`Filter by ${service}`} className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[0.75rem] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{service}</button>
                                ))}
                                {incident.affectedServices.length > 2 && (
                                  <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[0.75rem] font-medium text-muted-foreground" title={incident.affectedServices.slice(2).join(", ")}>+{incident.affectedServices.length - 2}</span>
                                )}
                              </div>
                            </td>
                            <td className="hidden whitespace-nowrap pr-3 sm:table-cell">
                              <span className="flex items-center gap-2" title={`Commander: ${incident.commander}${incident.assignee ? ` · Assignee: ${incident.assignee}` : ""}`}>
                                <InitialsAvatar name={incident.commander} size={24} />
                                <span className="hidden min-w-0 xl:inline">
                                  <span className="block max-w-[7.5rem] truncate text-[0.8125rem] font-medium leading-tight text-foreground">{incident.commander}</span>
                                  <span className="block max-w-[7.5rem] truncate text-[0.75rem] leading-tight text-muted-foreground">{incident.assignee ? `→ ${incident.assignee}` : "Unassigned"}</span>
                                </span>
                              </span>
                            </td>
                            <td className="whitespace-nowrap pr-3 text-[0.8125rem] text-foreground" title={fullTimestamp(Date.parse(incident.startedAt), timeMode === "utc")}>{timeAgo(Date.parse(incident.startedAt))}</td>
                            <td className="hidden whitespace-nowrap pr-3 text-[0.8125rem] tabular-nums text-foreground md:table-cell" title={open ? "Live — incident still open" : `Resolved in ${formatMinutes(durationMinutes(incident))}`}>
                              {formatMinutes(durationMinutes(incident, now))}
                              {open && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" aria-hidden="true" />}
                            </td>
                            <td className="pr-1 text-right" onClick={(event) => event.stopPropagation()}>
                              <div className="flex items-center justify-end gap-0.5">
                                {open && incident.acknowledgedAt == null && (
                                  <button
                                    type="button"
                                    onClick={() => { acknowledge([incident.id]); showToast(`${incident.id} acknowledged.`); }}
                                    aria-label={`Acknowledge ${incident.id}`}
                                    title="Acknowledge"
                                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                                  >
                                    <Check size={15} aria-hidden="true" />
                                  </button>
                                )}
                                <AlertMenu
                                  label={`Actions for ${incident.id}`}
                                  trigger={<Button variant="ghost" size="icon-sm" className="h-8 w-8 text-muted-foreground" aria-label={`Actions for ${incident.id}`}><MoreVertical size={16} /></Button>}
                                  items={kebabFor(incident)}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-[0.8125rem] text-muted-foreground">
                  <p>
                    Showing <b className="font-semibold text-foreground">{pageStart}–{pageEnd}</b> of <b className="font-semibold text-foreground">{totalFiltered}</b> incident{totalFiltered === 1 ? "" : "s"}
                    <span className="hidden sm:inline"> · Times: {timeMode === "utc" ? "UTC" : tzLabel}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}>
                      <SelectTrigger className="h-8 w-[4.625rem] text-[0.8125rem]" aria-label="Rows per page"><SelectValue /></SelectTrigger>
                      <SelectContent>{PAGE_SIZE_OPTIONS.map((size) => <SelectItem key={size} value={String(size)} className="text-[0.8125rem]">{size}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={clampedPage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page"><ChevronLeft size={15} /></Button>
                    {pageNumbers.map((item, index) =>
                      typeof item === "number" ? (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setPage(item)}
                          aria-current={item === clampedPage ? "page" : undefined}
                          aria-label={`Page ${item}`}
                          className={cn(
                            "grid h-8 w-8 place-items-center rounded-md border text-[0.8125rem] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            item === clampedPage ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-accent",
                          )}
                        >
                          {item}
                        </button>
                      ) : (
                        <span key={`ellipsis-${index}`} aria-hidden="true" className="grid h-8 w-8 place-items-center text-muted-foreground">…</span>
                      ),
                    )}
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={clampedPage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} aria-label="Next page"><ChevronRight size={15} /></Button>
                  </div>
                </div>
              </>
            )}
          </Panel>
          </div>

          {/* Insights row 2: on-call / postmortems / activity */}
          <section aria-label="Operational context" className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ChartCard
              title="On-Call Now"
              actions={
                <AlertMenu
                  label="On-call options"
                  trigger={<Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="On-call options"><MoreVertical size={15} /></Button>}
                  items={[
                    { key: "copy", label: "Copy handoff summary", onSelect: () => { const text = `On-call handoff — Primary: ${ON_CALL.primary.name} (${ON_CALL.primary.role}, since ${ON_CALL.primary.since}); Secondary: ${ON_CALL.secondary.name}. Next shift: ${ON_CALL.primary.nextShift}.`; if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => showToast("Handoff summary copied."), () => showToast(text)); else showToast(text); } },
                    { key: "page2", label: "Page secondary on-call", onSelect: () => showToast("Secondary paged — Priya Nair (Backend).") },
                  ]}
                />
              }
            >
              <div className="flex flex-1 flex-col gap-3">
                {[
                  { label: "Primary", person: ON_CALL.primary, pill: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300" },
                  { label: "Secondary", person: ON_CALL.secondary, pill: "bg-slate-200/70 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200" },
                ].map(({ label, person, pill }) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
                    <InitialsAvatar name={person.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{person.name}</p>
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[0.75rem] font-semibold", pill)}>{label}</span>
                      </div>
                      <p className="truncate text-[0.75rem] text-muted-foreground">{person.role}</p>
                      <p className="mt-0.5 text-[0.75rem] text-muted-foreground">since {person.since} · Next: {person.nextShift}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={() => showToast("On-call paged — Marcus Lee (Platform · Primary).")} className="mt-3 h-9 w-full gap-1.5 rounded-lg bg-red-600 text-sm text-white hover:bg-red-700">
                <Phone size={15} aria-hidden="true" />Page on-call
              </Button>
            </ChartCard>

            <ChartCard
              title="Recent Postmortems"
              actions={
                <AlertMenu
                  label="Postmortem options"
                  trigger={<Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="Postmortem options"><MoreVertical size={15} /></Button>}
                  items={[
                    { key: "resolved", label: "View resolved incidents", onSelect: () => setFilter("status", "Resolved") },
                    { key: "runbooks", label: "Open runbooks", onSelect: () => router.push("/runbooks") },
                  ]}
                />
              }
            >
              <ul className="flex flex-1 flex-col divide-y divide-border/70">
                {postmortems.map((incident) => {
                  const done = incident.postmortem.actionItems.filter((item) => item.done).length;
                  const totalItems = incident.postmortem.actionItems.length;
                  return (
                    <li key={incident.id}>
                      <button
                        type="button"
                        onClick={() => router.push(`/incidents/${incident.id}`)}
                        className="flex w-full items-center gap-3 rounded-md py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.8125rem] font-medium text-foreground" title={incident.title}>{incident.title}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.75rem] text-muted-foreground">
                            <span className={cn("rounded-full px-1.5 py-0.5 text-[0.75rem] font-semibold", incident.postmortem.status === "Published" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300")}>{incident.postmortem.status}</span>
                            <span>{incident.commander}</span>
                            <span aria-hidden="true">·</span>
                            <span>{timeAgo(Date.parse(incident.startedAt))}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-[0.75rem]">{incident.id}</span>
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[0.8125rem] font-semibold tabular-nums text-foreground">{done}/{totalItems} done</span>
                          <span aria-hidden="true" className="mt-1 block h-1.5 w-20 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${totalItems ? (done / totalItems) * 100 : 0}%` }} /></span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                <span className="text-[0.75rem] text-muted-foreground">Action items tracked per postmortem</span>
                <ViewAllLink onClick={() => setFilter("status", "Resolved")} />
              </div>
            </ChartCard>

            <ChartCard
              title="Recent Activity"
              className="md:col-span-2 xl:col-span-1"
              actions={
                <AlertMenu
                  label="Activity options"
                  trigger={<Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="Activity options"><MoreVertical size={15} /></Button>}
                  items={[{ key: "audit", label: "Open audit logs", onSelect: () => router.push("/audit-logs") }]}
                />
              }
            >
              <ul className="flex flex-1 flex-col divide-y divide-border/70">
                {recentActivity.map((entry) => {
                  const meta = activityMeta(entry.type);
                  const ActivityIcon = meta.icon;
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => router.push(`/incidents/${entry.incidentId}`)}
                        className="flex w-full items-center gap-2.5 rounded-md py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span aria-hidden="true" className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", meta.tone)}><ActivityIcon size={13} /></span>
                        <span className="min-w-0 flex-1 truncate text-[0.8125rem] leading-snug text-foreground" title={entry.text}><b>{entry.author === CURRENT_USER_NAME ? "You" : entry.author.split(" ")[0]}</b> {meta.verb} <span className="font-mono text-[0.75rem] font-semibold text-primary">{entry.incidentId}</span></span>
                        <span className="shrink-0 text-[0.75rem] tabular-nums text-muted-foreground" title={fullTimestamp(entry.epochMs, timeMode === "utc")}>{timeAgo(entry.epochMs)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                <span className="text-[0.75rem] text-muted-foreground">Declared → acknowledged → resolved</span>
                <ViewAllLink href="/audit-logs" />
              </div>
            </ChartCard>
          </section>
        </>
      )}

      {/* Toast with optional Undo */}
      {toast && (
        <div role="status" className="fixed bottom-4 right-4 z-[1300] flex max-w-md items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-lg">
          <span className="min-w-0">{toast.message}</span>
          {toast.undo && (
            <button type="button" onClick={() => { restore(toast.undo ?? []); setToast(null); }} className="shrink-0 rounded font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Undo</button>
          )}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification" className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"><X size={14} aria-hidden="true" /></button>
        </div>
      )}

      {/* Add update dialog */}
      <Dialog open={addUpdateId != null} onOpenChange={(open) => { if (!open) setAddUpdateId(null); }}>
        <DialogContent className="w-[min(30rem,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>Add update{addUpdateId ? ` — ${addUpdateId}` : ""}</DialogTitle>
            <DialogDescription>Posts to the incident timeline. Use “Internal note” for responder-only context; it is visible to the whole team in this demo.</DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Type
            <Select value={updateType} onValueChange={(value) => setUpdateType(value as "update" | "note" | "status")}>
              <SelectTrigger className="h-9 w-full text-sm" aria-label="Update type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="update" className="text-sm">Update</SelectItem>
                <SelectItem value="note" className="text-sm">Internal note</SelectItem>
                <SelectItem value="status" className="text-sm">Status change</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Update
            <textarea
              autoFocus
              rows={3}
              value={updateDraft}
              onChange={(event) => setUpdateDraft(event.target.value)}
              onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submitUpdate(); }}
              placeholder="What changed? Impact, scope, next steps…"
              aria-label="Update text"
              className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
          </label>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="h-9">Cancel</Button></DialogClose>
            <Button onClick={submitUpdate} disabled={!updateDraft.trim()} className="h-9 bg-primary text-primary-foreground hover:bg-primary/90">Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

