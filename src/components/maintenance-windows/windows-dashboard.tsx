"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowDown, ArrowUp, ArrowUpDown, Bell, BellOff, CalendarClock, ChevronDown, ChevronLeft, ChevronRight,
  Check, ChevronsRight, CircleAlert, FileDown, FilterX, ListFilter, MoreVertical, Repeat, RotateCcw, Search,
  ShieldCheck, TriangleAlert, CheckCheck, Ban, Wrench, X, Zap, CalendarDays, RefreshCw, Info,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AlertMenu, type AlertMenuItem } from "@/components/alerts/alert-menu";
import { ChartCard, Chip, SegmentedControl } from "@/components/logs/primitives";
import { MultiSelect } from "@/components/alert-rules/multi-select";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { StatCard } from "@/components/shared/stat-card";
import { ViewAllLink } from "@/components/shared/view-all-link";
import { WindowStatusBadge, WindowTypeBadge, ApprovalBadge, WINDOW_STATUS_META } from "@/components/maintenance-windows/window-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CURRENT_USER_NAME, MAINTENANCE_PEOPLE, SCOPE_GROUPS, scopeHosts, suppressedAlertsByDay, maintenanceByGroup,
  type MaintenanceWindow, type MaintenanceWindowStatus, type MaintenanceWindowType, type MaintenanceApprovalStatus,
} from "@/mocks/maintenanceWindows";
import { SAMPLE_ALERTS } from "@/mocks/alerts";
import { ALERT_RULES } from "@/mocks/alertRules";
import { useMaintenanceWindows } from "@/mocks/useMaintenanceWindows";
import { timeAgo } from "@/mocks/logs";
import { cn } from "@/lib/utils";

type RangeKey = "Today" | "7D" | "30D" | "Custom";
type ViewKey = "list" | "calendar" | "timeline";
type Density = "default" | "compact";
type SortKey = "title" | "status" | "start" | "owner";
type SortDir = "asc" | "desc";
type KpiKey = "active" | "upcoming" | "completed" | "inMaintenance" | "suppressed" | "pending";

interface WindowFilters {
  status: "All" | MaintenanceWindowStatus;
  types: string[];
  owners: string[];
  groups: string[];
  approvals: string[];
  range: RangeKey;
  customFrom: string;
  customTo: string;
  query: string;
}

const DEFAULT_FILTERS: WindowFilters = {
  status: "All", types: [], owners: [], groups: [], approvals: [],
  range: "30D", customFrom: "", customTo: "", query: "",
};

const RANGE_OPTIONS: readonly RangeKey[] = ["Today", "7D", "30D", "Custom"];
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const SAVED_VIEWS_KEY = "maintenanceWindowsSavedViews";
const RANGE_MS: Record<Exclude<RangeKey, "Custom">, number> = {
  Today: 24 * 60 * 60_000,
  "7D": 7 * 24 * 60 * 60_000,
  "30D": 30 * 24 * 60 * 60_000,
};

const TYPE_OPTIONS = [
  { value: "Planned", label: "Planned" },
  { value: "Emergency", label: "Emergency" },
  { value: "Recurring", label: "Recurring" },
];
const OWNER_OPTIONS = MAINTENANCE_PEOPLE.map((person) => ({ value: person, label: person }));
const GROUP_OPTIONS = SCOPE_GROUPS.map((group) => ({ value: group.id, label: group.name }));
const APPROVAL_OPTIONS = [
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];
const groupNameById = new Map(SCOPE_GROUPS.map((group) => [group.id, group.name]));

interface SavedView { name: string; filter: Partial<WindowFilters> }

const PRESET_VIEWS: SavedView[] = [
  { name: "Active", filter: { status: "In Progress" } },
  { name: "Upcoming", filter: { status: "Scheduled", range: "7D" } },
  { name: "Pending approval", filter: { approvals: ["Pending"] } },
  { name: "My windows", filter: { owners: [CURRENT_USER_NAME] } },
];

const numberFmt = new Intl.NumberFormat();
const nfLocale = numberFmt.format;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Re-render on an interval so countdowns stay live. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function formatCountdown(targetMs: number, nowMs: number): string {
  const diff = targetMs - nowMs;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const core = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return diff >= 0 ? core : `${core} ago`;
}

function formatClockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateRange(startMs: number, endMs: number): string {
  const start = new Date(startMs);
  const end = new Date(endMs);
  const sameDay = start.toDateString() === end.toDateString();
  const datePart = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (sameDay) return `${datePart}, ${formatClockTime(startMs)} - ${formatClockTime(endMs)}`;
  const endDatePart = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${datePart}, ${formatClockTime(startMs)} - ${endDatePart}, ${formatClockTime(endMs)}`;
}

function formatDuration(startMs: number, endMs: number): string {
  const minutes = Math.max(0, Math.round((endMs - startMs) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function recurrenceLabel(window: MaintenanceWindow): string | null {
  const { recurrence } = window;
  if (recurrence.kind === "none") return null;
  if (recurrence.kind === "daily") return "Every day";
  if (recurrence.kind === "weekly") return `Every ${recurrence.days.map((day) => WEEKDAY_SHORT[day]).join("/")}`;
  return `Monthly on day ${recurrence.days[0] ?? 1}`;
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
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  boxShadow: "0 4px 14px rgba(20,40,71,0.07)",
} as const;

function SuppressedTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={tooltipStyle} className="px-3 py-2 text-[12px]">
      <p className="font-semibold">{label}</p>
      <p className="tabular-nums text-muted-foreground">{payload[0]?.value ?? 0} alerts suppressed</p>
    </div>
  );
}

const GROUP_SHARE_COLORS = ["#7C3AED", "#8B5CF6", "#A78BFA", "#C4B5FD", "#64748B", "#94A3B8"];

const STATUS_FILTER_ORDER: Array<"All" | MaintenanceWindowStatus> = ["All", "In Progress", "Scheduled", "Completed", "Cancelled"];
const TYPE_ICON: Record<MaintenanceWindowType, typeof Zap> = { Planned: CalendarDays, Emergency: Zap, Recurring: RefreshCw };

function trendNode(delta: number, label: string) {
  const positive = delta >= 0;
  return (
    <>
      {positive ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
      {`${positive ? "+" : ""}${delta} `}<span className="font-normal text-muted-foreground">{label}</span>
    </>
  );
}

/** Scope chip cell: shows up to 2 chips on one line, "+N" for the rest, hover popover lists everything. */
function ScopeCell({ window }: { window: MaintenanceWindow }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scope = window.scope;
  const chips = [...scope.servers, ...scope.groups.map((id) => groupNameById.get(id) ?? id)];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  if (chips.length === 0) return <span className="text-[12px] text-muted-foreground">No scope</span>;
  const shown = chips.slice(0, 2);
  const extra = chips.length - shown.length;
  const detail = [
    { label: "Servers", values: scope.servers },
    { label: "Groups", values: scope.groups.map((id) => groupNameById.get(id) ?? id) },
    { label: "Services", values: scope.services },
    { label: "Tags", values: scope.tags.map((tag) => `#${tag}`) },
    { label: "Excluded", values: scope.exclude },
  ];

  return (
    <div ref={rootRef} className="relative min-w-0" onClick={(event) => event.stopPropagation()}>
      <span className="flex items-center gap-1 whitespace-nowrap">
        {shown.map((chip) => (
          <span key={chip} className="max-w-[92px] truncate rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">{chip}</span>
        ))}
        {extra > 0 && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={`Show all ${chips.length} scope targets`}
            className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            +{extra}
          </button>
        )}
      </span>
      {open && (
        <div role="dialog" aria-label="Full scope" className="absolute left-0 top-8 z-30 w-72 rounded-xl border border-border bg-popover p-3 text-[12px] shadow-lg">
          <p className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Scope &middot; {chips.length} target{chips.length === 1 ? "" : "s"}</p>
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {detail.map((group) => group.values.length > 0 && (
              <div key={group.label}>
                <p className="text-[12px] font-semibold text-muted-foreground">{group.label}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {group.values.map((value) => <span key={value} className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">{value}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function WindowsDashboard() {
  const router = useRouter();
  const tableRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);
  const didInitURL = useRef(false);

  const {
    windows, status, reload,
    extendWindow, endWindowNow, cancelWindows, approveWindows, rejectWindows, duplicateWindow, restore,
  } = useMaintenanceWindows();
  const isLoading = status === "loading";
  const isError = status === "error";

  const now = useNow(30_000);
  const [filters, setFilters] = useState<WindowFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewKey>("list");
  const [density, setDensity] = useState<Density>("default");
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toast, setToast] = useState<{ id: number; message: string; undo?: Array<Pick<MaintenanceWindow, "id" | "status">> } | null>(null);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(() => Date.now());
  const [cancelTargets, setCancelTargets] = useState<string[] | null>(null);
  const [endTarget, setEndTarget] = useState<string | null>(null);
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [calendarMode, setCalendarMode] = useState<"month" | "week">("month");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [kpiActive, setKpiActive] = useState<KpiKey | null>(null);

  const showToast = useCallback((message: string, undo?: Array<Pick<MaintenanceWindow, "id" | "status">>) => {
    setToast({ id: Date.now(), message, undo });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);

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
    const rangeParam = params.get("range");
    const viewParam = params.get("view");
    const split = (value: string | null) => (value ? value.split(",").map((item) => item.trim()).filter(Boolean) : []);
    const isStatus = (value: string | null): value is WindowFilters["status"] =>
      value === "All" || value === "In Progress" || value === "Scheduled" || value === "Completed" || value === "Cancelled";
    const isRange = (value: string | null): value is RangeKey =>
      value === "Today" || value === "7D" || value === "30D" || value === "Custom";
    const isType = (value: string) => TYPE_OPTIONS.some((option) => option.value === value);
    const isApproval = (value: string) => APPROVAL_OPTIONS.some((option) => option.value === value);
    setFilters({
      status: isStatus(statusParam) ? statusParam : "All",
      types: split(params.get("type")).filter(isType),
      owners: split(params.get("owner")).filter((value) => (MAINTENANCE_PEOPLE as readonly string[]).includes(value)),
      groups: split(params.get("group")).filter((value) => GROUP_OPTIONS.some((option) => option.value === value)),
      approvals: split(params.get("approval")).filter(isApproval),
      range: isRange(rangeParam) ? rangeParam : "30D",
      customFrom: params.get("from") ?? "",
      customTo: params.get("to") ?? "",
      query: params.get("q") ?? "",
    });
    if (viewParam === "list" || viewParam === "calendar" || viewParam === "timeline") setView(viewParam);
    const windowParam = params.get("window");
    if (windowParam && /^MW-\d+$/i.test(windowParam)) setDrawerId(windowParam.toUpperCase());
  }, []);

  /* URL params: write on change (skip defaults) */
  useEffect(() => {
    if (!didInitURL.current) return;
    const params = new URLSearchParams();
    if (filters.status !== "All") params.set("status", filters.status);
    if (filters.types.length) params.set("type", filters.types.join(","));
    if (filters.owners.length) params.set("owner", filters.owners.join(","));
    if (filters.groups.length) params.set("group", filters.groups.join(","));
    if (filters.approvals.length) params.set("approval", filters.approvals.join(","));
    if (filters.range !== "30D") params.set("range", filters.range);
    if (filters.range === "Custom" && filters.customFrom) params.set("from", filters.customFrom);
    if (filters.range === "Custom" && filters.customTo) params.set("to", filters.customTo);
    if (filters.query.trim()) params.set("q", filters.query.trim());
    if (view !== "list") params.set("view", view);
    if (drawerId) params.set("window", drawerId);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [filters, view, drawerId]);

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

  const setFilter = useCallback(<K extends keyof WindowFilters>(key: K, value: WindowFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setKpiActive(null);
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setKpiActive(null);
    setSelectedIds([]);
    setPage(1);
  }, []);

  const openDrawer = useCallback((id: string) => setDrawerId(id), []);
  const closeDrawer = useCallback(() => setDrawerId(null), []);

  /* ------------------------------ derived data ----------------------------- */

  const nowMs = now;
  const activeWindows = useMemo(() => windows.filter((window) => window.status === "In Progress"), [windows]);
  const upcomingWindows = useMemo(
    () => windows.filter((window) => window.status === "Scheduled").sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
    [windows],
  );
  const serversInMaintenance = useMemo(() => {
    const hosts = new Set<string>();
    for (const window of activeWindows) for (const host of scopeHosts(window.scope)) hosts.add(host);
    return [...hosts];
  }, [activeWindows]);
  const alertsSuppressed24h = useMemo(() => {
    const dayMs = 24 * 60 * 60_000;
    return windows
      .filter((window) => window.summary != null)
      .filter((window) => {
        const started = Date.parse(window.summary?.actualStart ?? window.start);
        const ended = window.summary?.actualEnd ? Date.parse(window.summary.actualEnd) : nowMs;
        return ended >= nowMs - dayMs && started <= nowMs;
      })
      .reduce((sum, window) => sum + (window.summary?.suppressedAlerts ?? 0), 0);
  }, [windows, nowMs]);
  const incidentsSuppressed24h = useMemo(() => {
    const dayMs = 24 * 60 * 60_000;
    return windows
      .filter((window) => window.summary != null)
      .filter((window) => {
        const started = Date.parse(window.summary?.actualStart ?? window.start);
        const ended = window.summary?.actualEnd ? Date.parse(window.summary.actualEnd) : nowMs;
        return ended >= nowMs - dayMs && started <= nowMs;
      })
      .reduce((sum, window) => sum + (window.summary?.suppressedIncidents ?? 0), 0);
  }, [windows, nowMs]);
  const pendingApproval = useMemo(
    () => windows.filter((window) => window.approvalStatus === "Pending" && window.status !== "Cancelled").length,
    [windows],
  );
  const completed30d = useMemo(
    () => windows.filter((window) => window.status === "Completed" && nowMs - Date.parse(window.end) <= 30 * 24 * 60 * 60_000).length,
    [windows, nowMs],
  );
  const upcoming7d = useMemo(
    () => upcomingWindows.filter((window) => Date.parse(window.start) - nowMs <= 7 * 24 * 60 * 60_000).length,
    [upcomingWindows, nowMs],
  );
  const nextWindow = upcomingWindows[0] ?? null;
  const earliestActiveEnd = useMemo(
    () => activeWindows.reduce<number | null>((min, window) => {
      const end = Date.parse(window.end);
      return min == null || end < min ? end : min;
    }, null),
    [activeWindows],
  );

  /** Conflict detection: same scope overlap on non-cancelled windows. */
  const conflictIds = useMemo(() => {
    const live = windows.filter((window) => window.status !== "Cancelled");
    const ids = new Set<string>();
    for (let i = 0; i < live.length; i += 1) {
      for (let j = i + 1; j < live.length; j += 1) {
        const a = live[i];
        const b = live[j];
        const aStart = Date.parse(a.start); const aEnd = Date.parse(a.end);
        const bStart = Date.parse(b.start); const bEnd = Date.parse(b.end);
        if (!(aStart < bEnd && bStart < aEnd)) continue;
        const aHosts = new Set(scopeHosts(a.scope));
        if ([...scopeHosts(b.scope)].some((host) => aHosts.has(host))) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  }, [windows]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: windows.length, "In Progress": 0, Scheduled: 0, Completed: 0, Cancelled: 0 };
    for (const window of windows) counts[window.status] += 1;
    return counts;
  }, [windows]);

  const filtered = useMemo(() => {
    const queryTokens = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
    const nowMsInner = Date.now();
    let rangeStart: number | null = null;
    let rangeEnd: number | null = null;
    if (filters.range === "Custom") {
      if (filters.customFrom) rangeStart = new Date(`${filters.customFrom}T00:00:00`).getTime();
      if (filters.customTo) rangeEnd = new Date(`${filters.customTo}T23:59:59`).getTime();
    } else if (filters.range === "Today") {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      rangeStart = startOfDay.getTime();
      rangeEnd = rangeStart + 24 * 60 * 60_000 - 1;
    } else {
      rangeStart = nowMsInner - RANGE_MS[filters.range];
    }
    return windows.filter((window) => {
      if (filters.status !== "All" && window.status !== filters.status) return false;
      if (filters.types.length > 0 && !filters.types.includes(window.type)) return false;
      if (filters.owners.length > 0 && !filters.owners.includes(window.owner)) return false;
      if (filters.groups.length > 0 && !window.scope.groups.some((group) => filters.groups.includes(group))) return false;
      if (filters.approvals.length > 0 && !filters.approvals.includes(window.approvalStatus)) return false;
      const start = Date.parse(window.start);
      if (rangeStart != null && start < rangeStart && Date.parse(window.end) < rangeStart) return false;
      if (rangeEnd != null && start > rangeEnd) return false;
      if (queryTokens.length > 0) {
        const haystack = [
          window.id, window.title, window.description, window.impact, window.owner, window.approver ?? "",
          window.changeTicket ?? "", window.createdBy,
          ...window.scope.servers, ...window.scope.groups, ...window.scope.services, ...window.scope.tags,
        ].join(" ").toLowerCase();
        if (!queryTokens.every((token) => haystack.includes(token))) return false;
      }
      return true;
    });
  }, [windows, filters]);

  const sorted = useMemo(() => {
    const statusRank: Record<MaintenanceWindowStatus, number> = { "In Progress": 0, Scheduled: 1, Completed: 2, Cancelled: 3 };
    const direction = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "status") {
        const diff = statusRank[a.status] - statusRank[b.status];
        if (diff !== 0) return diff * direction;
        return Date.parse(a.start) - Date.parse(b.start);
      }
      if (sortKey === "title") return a.title.localeCompare(b.title) * direction;
      if (sortKey === "owner") return a.owner.localeCompare(b.owner) * direction;
      return (Date.parse(a.start) - Date.parse(b.start)) * direction;
    });
  }, [filtered, sortKey, sortDir]);

  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageStart = totalFiltered === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const pageEnd = Math.min(totalFiltered, clampedPage * pageSize);
  const pageItems = useMemo(() => sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize), [sorted, clampedPage, pageSize]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => filtered.some((window) => window.id === id)));
  }, [filtered]);

  const allPageSelected = pageItems.length > 0 && pageItems.every((window) => selectedIds.includes(window.id));
  const somePageSelected = pageItems.some((window) => selectedIds.includes(window.id));
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = !allPageSelected && somePageSelected;
  }, [allPageSelected, somePageSelected]);

  const suppressed14d = useMemo(() => suppressedAlertsByDay(14, nowMs), [nowMs]);
  const suppressed7d = useMemo(() => suppressed14d.slice(7), [suppressed14d]);
  const suppressedPrev7dTotal = useMemo(() => suppressed14d.slice(0, 7).reduce((sum, bucket) => sum + bucket.alerts, 0), [suppressed14d]);
  const suppressed7dTotal = useMemo(() => suppressed7d.reduce((sum, bucket) => sum + bucket.alerts, 0), [suppressed7d]);
  const suppressedDailyAvg = suppressed7d.length ? Math.round(suppressed7dTotal / suppressed7d.length) : 0;
  const suppressedPeakDay = useMemo(() => suppressed7d.reduce((peak, bucket) => (bucket.alerts > peak.alerts ? bucket : peak), { label: "-", key: "none", alerts: 0 }), [suppressed7d]);
  const suppressedVsPrev = suppressedPrev7dTotal > 0
    ? Math.round(((suppressed7dTotal - suppressedPrev7dTotal) / suppressedPrev7dTotal) * 100)
    : null;

  /** Suppressed alerts split by the severity of the rules each window muted. */
  const suppressedBySeverity = useMemo(() => {
    const nowMsInner = Date.now();
    const weekAgo = nowMsInner - 7 * 24 * 60 * 60_000;
    const ruleSeverity = new Map(ALERT_RULES.map((rule) => [rule.id, rule.severity]));
    const tally = { SEV2: 0, SEV3: 0, SEV4: 0 };
    for (const window of windows) {
      const suppressed = window.summary?.suppressedAlerts ?? 0;
      if (suppressed <= 0) continue;
      const from = Date.parse(window.summary?.actualStart ?? window.start);
      const to = window.summary?.actualEnd ? Date.parse(window.summary.actualEnd) : nowMsInner;
      const overlap = Math.min(to, nowMsInner) - Math.max(from, weekAgo);
      if (overlap <= 0) continue;
      const duration = Math.max(1, to - from);
      const contribution = (suppressed * overlap) / duration;
      const classes = { SEV2: 0, SEV3: 0, SEV4: 0 };
      for (const id of window.alertBehavior.mutedRuleIds) {
        const severity = ruleSeverity.get(id);
        if (severity === "Critical") classes.SEV2 += 1;
        else if (severity === "Warning") classes.SEV3 += 1;
        else classes.SEV4 += 1;
      }
      const classTotal = classes.SEV2 + classes.SEV3 + classes.SEV4;
      if (classTotal === 0) {
        tally.SEV2 += contribution * 0.225;
        tally.SEV3 += contribution * 0.45;
        tally.SEV4 += contribution * 0.325;
      } else {
        tally.SEV2 += (contribution * classes.SEV2) / classTotal;
        tally.SEV3 += (contribution * classes.SEV3) / classTotal;
        tally.SEV4 += (contribution * classes.SEV4) / classTotal;
      }
    }
    return { SEV2: Math.round(tally.SEV2), SEV3: Math.round(tally.SEV3), SEV4: Math.round(tally.SEV4) };
  }, [windows]);

  const topSuppressedWindows = useMemo(() => {
    const nowMsInner = Date.now();
    const weekAgo = nowMsInner - 7 * 24 * 60 * 60_000;
    return windows
      .map((window) => {
        const suppressed = window.summary?.suppressedAlerts ?? 0;
        if (suppressed <= 0) return null;
        const from = Date.parse(window.summary?.actualStart ?? window.start);
        const to = window.summary?.actualEnd ? Date.parse(window.summary.actualEnd) : nowMsInner;
        const overlap = Math.min(to, nowMsInner) - Math.max(from, weekAgo);
        if (overlap <= 0) return null;
        const duration = Math.max(1, to - from);
        return { id: window.id, title: window.title, suppressed, contribution: (suppressed * overlap) / duration };
      })
      .filter((row): row is { id: string; title: string; suppressed: number; contribution: number } => row != null)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3);
  }, [windows]);
  const maxTopSuppressed = topSuppressedWindows.reduce((max, row) => Math.max(max, row.contribution), 1);
  const groupStats = useMemo(() => maintenanceByGroup(nowMs).slice(0, 6), [nowMs]);
  const maxGroupHours = groupStats.reduce((max, row) => Math.max(max, row.hours), 1);
  const groupTotals = useMemo(() => groupStats.reduce((acc, row) => ({ windows: acc.windows + row.windows, hours: acc.hours + row.hours }), { windows: 0, hours: 0 }), [groupStats]);
  const groupShares = useMemo(() => groupStats.map((row) => ({ ...row, pct: groupTotals.hours > 0 ? (row.hours / groupTotals.hours) * 100 : 0 })), [groupStats, groupTotals.hours]);
  const topGroupByHours = useMemo(() => groupStats.reduce((max, row) => (row.hours > max.hours ? row : max), { group: "", name: "-", windows: 0, hours: 0 }), [groupStats]);
  const topGroupPct = groupTotals.hours > 0 ? Math.round((topGroupByHours.hours / groupTotals.hours) * 100) : 0;
  const criticalAllowedThrough = useMemo(
    () => activeWindows.filter((window) => window.alertBehavior.allowCritical).length,
    [activeWindows],
  );

  const applyKpi = useCallback((kpi: KpiKey) => {
    setKpiActive((current) => (current === kpi ? null : kpi));
    setPage(1);
    setView("list");
    if (kpi === "active") setFilters((current) => ({ ...DEFAULT_FILTERS, ...current, status: current.status === "In Progress" ? "All" : "In Progress" }));
    else if (kpi === "upcoming") setFilters((current) => current.status === "Scheduled" && current.range === "7D" ? { ...current, status: "All", range: "30D" } : { ...current, status: "Scheduled", range: "7D" });
    else if (kpi === "completed") setFilters((current) => current.status === "Completed" && current.range === "30D" ? { ...current, status: "All", range: "30D" } : { ...current, status: "Completed", range: "30D" });
    else if (kpi === "inMaintenance") setFilters((current) => ({ ...current, status: "In Progress" }));
    else if (kpi === "pending") setFilters((current) => ({ ...current, approvals: current.approvals.includes("Pending") ? [] : ["Pending"] }));
    else if (kpi === "suppressed") setFilters((current) => ({ ...current, range: current.range === "7D" ? "30D" : "7D" }));
  }, []);

  /* ------------------------------- actions --------------------------------- */

  const sortBy = useCallback((key: SortKey) => {
    setSortKey((current) => {
      if (current === key) {
        setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
        return current;
      }
      setSortDir(key === "start" ? "asc" : "asc");
      return key;
    });
  }, []);

  const pageToggleAll = useCallback(() => {
    setSelectedIds((current) => {
      const pageIds = pageItems.map((window) => window.id);
      if (allPageSelected) return current.filter((id) => !pageIds.includes(id));
      return [...new Set([...current, ...pageIds])];
    });
  }, [pageItems, allPageSelected]);

  const selectWindow = useCallback((id: string, checked: boolean) => {
    setSelectedIds((current) => (checked ? [...new Set([...current, id])] : current.filter((value) => value !== id)));
  }, []);

  const exportRows = useCallback((kind: "csv" | "json", rows: MaintenanceWindow[], label: string) => {
    const flat = rows.map((window) => ({
      id: window.id, title: window.title, type: window.type, status: window.status,
      start: window.start, end: window.end, timeZone: window.timeZone,
      owner: window.owner, approver: window.approver ?? "", approvalStatus: window.approvalStatus,
      changeTicket: window.changeTicket ?? "", impact: window.impact,
      servers: window.scope.servers.join("|"), groups: window.scope.groups.join("|"),
      services: window.scope.services.join("|"), mutedRuleIds: window.alertBehavior.mutedRuleIds.join("|"),
    }));
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === "json") {
      downloadBlob(JSON.stringify(rows, null, 2), "application/json;charset=utf-8", `maintenance-windows-${stamp}.json`);
    } else {
      const header = Object.keys(flat[0] ?? { id: "" });
      const body = [header.join(","), ...flat.map((row) => header.map((key) => csvCell(String((row as Record<string, unknown>)[key] ?? ""))).join(","))].join("\r\n");
      downloadBlob(body, "text/csv;charset=utf-8", `maintenance-windows-${stamp}.csv`);
    }
    showToast(`${kind.toUpperCase()} exported (${rows.length} ${label}).`);
  }, [showToast]);

  const handleCancelRequest = useCallback((ids: string[]) => setCancelTargets(ids), []);
  const confirmCancel = useCallback(() => {
    if (!cancelTargets?.length) return;
    const snapshot = windows.filter((window) => cancelTargets.includes(window.id)).map((window) => ({ id: window.id, status: window.status }));
    cancelWindows(cancelTargets);
    showToast(`${cancelTargets.length} window${cancelTargets.length === 1 ? "" : "s"} cancelled.`, snapshot);
    setCancelTargets(null);
    setSelectedIds([]);
  }, [cancelTargets, windows, cancelWindows, showToast]);

  const confirmEndNow = useCallback(() => {
    if (!endTarget) return;
    endWindowNow(endTarget);
    showToast(`${endTarget} ended now.`);
    setEndTarget(null);
  }, [endTarget, endWindowNow, showToast]);

  const kebabFor = useCallback((window: MaintenanceWindow): AlertMenuItem[] => {
    const live = window.status === "In Progress" || window.status === "Scheduled";
    const editable = live;
    return [
      { key: "view", label: "View details", onSelect: () => openDrawer(window.id) },
      { key: "edit", label: "Edit", disabled: !editable, onSelect: () => router.push(`/maintenance-windows/${window.id}/edit`) },
      {
        key: "extend", label: "Extend", disabled: !editable,
        items: [
          { key: "+30", label: "+30 minutes", onSelect: () => { extendWindow(window.id, 30); showToast(`${window.id} extended by 30m.`); } },
          { key: "+60", label: "+1 hour", onSelect: () => { extendWindow(window.id, 60); showToast(`${window.id} extended by 1h.`); } },
        ],
      },
      { key: "end", label: "End now", disabled: window.status !== "In Progress", onSelect: () => setEndTarget(window.id) },
      { key: "duplicate", label: "Duplicate", onSelect: () => { const id = duplicateWindow(window.id); if (id) showToast(`Duplicated as ${id}.`); } },
      { divider: true, key: "d1", label: "" },
      { key: "cancel", label: "Cancel window", disabled: !live, danger: true, onSelect: () => handleCancelRequest([window.id]) },
    ];
  }, [router, openDrawer, duplicateWindow, extendWindow, handleCancelRequest, showToast]);

  const bulkNotify = useCallback(() => {
    showToast(`${selectedIds.length} owner${selectedIds.length === 1 ? "" : "s"} notified via their channels.`);
    setSelectedIds([]);
  }, [selectedIds, showToast]);

  const saveCurrentView = useCallback(() => {
    const name = window.prompt("Name this view");
    if (!name?.trim()) return;
    const next = [...savedViews.filter((viewEntry) => viewEntry.name !== name.trim()), { name: name.trim(), filter: { ...filters } }];
    setSavedViews(next);
    try {
      window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next));
    } catch {
      showToast("Could not persist the view (localStorage unavailable).");
      return;
    }
    showToast(`View "${name.trim()}" saved.`);
  }, [filters, savedViews, showToast]);

  const applyView = useCallback((saved: SavedView) => {
    setFilters({ ...DEFAULT_FILTERS, ...saved.filter });
    setKpiActive(null);
    setSelectedIds([]);
    setPage(1);
    showToast(`View "${saved.name}" applied.`);
  }, [showToast]);

  const savedViewItems: AlertMenuItem[] = [
    ...PRESET_VIEWS.map((preset) => ({ key: `preset:${preset.name}`, label: preset.name, onSelect: () => applyView(preset) })),
    ...(savedViews.length > 0 ? [{ divider: true, key: "d", label: "" } as AlertMenuItem] : []),
    ...savedViews.map((saved) => ({ key: `saved:${saved.name}`, label: saved.name, onSelect: () => applyView(saved) })),
    { divider: true, key: "d2", label: "" },
    { key: "save", label: "Save current view", onSelect: saveCurrentView },
  ];

  const exportItems: AlertMenuItem[] = [
    { key: "csv", label: "Export CSV", onSelect: () => exportRows("csv", sorted, "windows") },
    { key: "json", label: "Export JSON", onSelect: () => exportRows("json", sorted, "windows") },
  ];

  const pageNumbers: Array<number | "..."> = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const set = new Set<number>([1, totalPages, clampedPage - 1, clampedPage, clampedPage + 1]);
    const list = [...set].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
    const out: Array<number | "..."> = [];
    for (let index = 0; index < list.length; index += 1) {
      out.push(list[index]);
      if (index < list.length - 1 && list[index + 1] - list[index] > 1) out.push("...");
    }
    return out;
  }, [totalPages, clampedPage]);

  const tzLabel = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const rowHeight = density === "compact" ? "h-12" : "h-16";
  const goToWindow = useCallback((id: string) => openDrawer(id), [openDrawer]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status !== "All") count += 1;
    count += filters.types.length + filters.owners.length + filters.groups.length + filters.approvals.length;
    if (filters.range !== "30D") count += 1;
    if (filters.query.trim()) count += 1;
    return count;
  }, [filters]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    for (const type of filters.types) chips.push({ key: `type:${type}`, label: type, onRemove: () => setFilters((current) => ({ ...current, types: current.types.filter((value) => value !== type) })) });
    for (const owner of filters.owners) chips.push({ key: `owner:${owner}`, label: owner, onRemove: () => setFilters((current) => ({ ...current, owners: current.owners.filter((value) => value !== owner) })) });
    for (const group of filters.groups) chips.push({ key: `group:${group}`, label: groupNameById.get(group) ?? group, onRemove: () => setFilters((current) => ({ ...current, groups: current.groups.filter((value) => value !== group) })) });
    for (const approval of filters.approvals) chips.push({ key: `approval:${approval}`, label: approval, onRemove: () => setFilters((current) => ({ ...current, approvals: current.approvals.filter((value) => value !== approval) })) });
    if (filters.range !== "30D") chips.push({ key: "range", label: `Range: ${filters.range}`, onRemove: () => setFilter("range", "30D") });
    if (filters.query.trim()) chips.push({ key: "q", label: `Search: "${filters.query.trim()}"`, onRemove: () => setFilter("query", "") });
    return chips;
  }, [filters, setFilter]);

  const sortHeader = (key: SortKey, label: string, className?: string) => {
    const active = sortKey === key;
    return (
      <button
        type="button"
        onClick={() => sortBy(key)}
        aria-label={`Sort by ${label}${active ? ` (${sortDir === "asc" ? "ascending" : "descending"})` : ""}`}
        className={cn("inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active && "text-foreground", className)}
      >
        {label}
        {active && (sortDir === "asc" ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" />)}
      </button>
    );
  };

  const errorState = (
    <section role="alert" className="grid min-h-[320px] place-items-center rounded-xl border border-border bg-card p-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-2">
        <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-[#DC2626] dark:bg-red-500/10"><TriangleAlert size={20} /></span>
        <p className="font-display text-base font-bold text-foreground">Maintenance windows could not be loaded</p>
        <p className="text-sm text-muted-foreground">The maintenance service failed to respond. Retry to reload the schedule.</p>
        <Button onClick={reload} className="h-10 gap-1.5 rounded-lg px-4 text-sm"><RotateCcw size={15} />Retry</Button>
      </div>
    </section>
  );

  const skeletonState = (
    <>
      <section aria-busy="true" aria-label="Loading maintenance summary" className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[88px] animate-pulse rounded-xl bg-muted" />)}
      </section>
      <div className="h-[44px] animate-pulse rounded-xl bg-muted" />
      <div className="h-[520px] animate-pulse rounded-xl bg-muted" />
    </>
  );

  /* ------------------------------- calendar ------------------------------ */

  const calendarDays = useMemo(() => {
    const cursor = new Date(calendarCursor);
    if (calendarMode === "week") {
      const start = new Date(cursor);
      const day = (start.getDay() + 6) % 7; /* Monday-first */
      start.setDate(start.getDate() - day);
      return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return date;
      });
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7; /* Monday-first */
    const start = new Date(first);
    start.setDate(first.getDate() - startOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [calendarCursor, calendarMode]);

  const calendarLabel = useMemo(() => {
    if (calendarMode === "week") {
      const start = calendarDays[0];
      const end = calendarDays[calendarDays.length - 1];
      return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return calendarCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [calendarCursor, calendarMode, calendarDays]);

  const windowsByDayKey = useMemo(() => {
    const map = new Map<string, MaintenanceWindow[]>();
    for (const window of windows) {
      const start = new Date(window.start);
      const end = new Date(window.end);
      const cursor = new Date(start);
      cursor.setHours(0, 0, 0, 0);
      const lastDay = new Date(end);
      lastDay.setHours(0, 0, 0, 0);
      let guard = 0;
      while (cursor <= lastDay && guard < 62) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
        const list = map.get(key) ?? [];
        list.push(window);
        map.set(key, list);
        cursor.setDate(cursor.getDate() + 1);
        guard += 1;
      }
    }
    return map;
  }, [windows]);

  const dayKeyOf = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const todayKey = dayKeyOf(new Date());

  const moveCalendar = (direction: -1 | 1) => {
    setCalendarCursor((cursor) => {
      const next = new Date(cursor);
      if (calendarMode === "week") next.setDate(next.getDate() + direction * 7);
      else next.setMonth(next.getMonth() + direction);
      return next;
    });
  };

  const prefillForDate = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, "0");
    const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T09:00`;
    router.push(`/maintenance-windows/new?start=${encodeURIComponent(stamp)}`);
  };

  const calendarDayFocus = useRef<Array<HTMLButtonElement | null>>([]);
  const onCalendarKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const cols = 7;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = index + 1;
    else if (event.key === "ArrowLeft") nextIndex = index - 1;
    else if (event.key === "ArrowDown") nextIndex = index + cols;
    else if (event.key === "ArrowUp") nextIndex = index - cols;
    if (nextIndex == null || nextIndex < 0 || nextIndex >= calendarDays.length) return;
    event.preventDefault();
    calendarDayFocus.current[nextIndex]?.focus();
  };

  /* ------------------------------ timeline view ----------------------------- */

  const timelineGroups = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const horizonStart = startOfToday.getTime();
    const horizonEnd = horizonStart + 7 * 24 * 60 * 60_000;
    const relevant = sorted.filter((window) => Date.parse(window.end) >= horizonStart && Date.parse(window.start) < horizonEnd);
    const groupOrder: string[] = [];
    const rows = new Map<string, MaintenanceWindow[]>();
    for (const window of relevant) {
      const group = window.scope.groups[0] ?? "__ungrouped";
      const list = rows.get(group) ?? [];
      list.push(window);
      rows.set(group, list);
      if (!groupOrder.includes(group)) groupOrder.push(group);
    }
    groupOrder.sort((a, b) => (rows.get(b)?.length ?? 0) - (rows.get(a)?.length ?? 0));
    const groupNames = new Map(SCOPE_GROUPS.map((group) => [group.id, group.name]));
    return {
      horizonStart,
      horizonEnd,
      rows: groupOrder.map((group) => ({ group, name: groupNames.get(group) ?? (group === "__ungrouped" ? "No group" : group), windows: rows.get(group) ?? [] })),
    };
  }, [sorted]);

  const statusChip = (value: "All" | MaintenanceWindowStatus) => (
    <Chip
      key={value}
      active={filters.status === value}
      onClick={() => setFilter("status", value)}
    >
      {value}<span className="ml-1 tabular-nums opacity-75">({statusCounts[value]})</span>
    </Chip>
  );

  const drawerWindow = drawerId ? windows.find((window) => window.id === drawerId) ?? null : null;

  return (
    <div className="min-w-0 overflow-x-hidden space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Operations", "Maintenance Windows"]}
        title="Maintenance Windows"
        subtitle="Schedule planned maintenance and silence alerts for affected infrastructure."
        lastUpdated={timeAgo(lastRefreshedAt)}
        onRefresh={() => { reload(); setLastRefreshedAt(Date.now()); }}
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <AlertMenu
              label="Export windows"
              trigger={
                <Button variant="outline" className="h-10 gap-1.5 rounded-lg px-3 text-sm">
                  <FileDown size={15} aria-hidden="true" />Export<ChevronDown size={13} aria-hidden="true" className="text-muted-foreground" />
                </Button>
              }
              items={exportItems}
            />
            <Link
              href="/maintenance-windows/new"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <CalendarClock size={15} aria-hidden="true" />Schedule Maintenance
            </Link>
          </div>
        }
      />

      {isError && errorState}
      {isLoading && skeletonState}

      {!isLoading && !isError && (
        <>
          {/* Active banner */}
          {activeWindows.length > 0 ? (
            <div role="status" className="flex min-h-[40px] flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-200/80 bg-violet-50 px-4 py-2 dark:border-violet-500/25 dark:bg-violet-500/10">
              <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm text-violet-900 dark:text-violet-200">
                <Wrench size={14} aria-hidden="true" className="shrink-0" />
                <span className="font-semibold">{activeWindows.length} maintenance window{activeWindows.length === 1 ? "" : "s"} active</span>
                <span aria-hidden="true" className="text-violet-300 dark:text-violet-500">&middot;</span>
                <span>{serversInMaintenance.length} servers in maintenance</span>
                <span aria-hidden="true" className="text-violet-300 dark:text-violet-500">&middot;</span>
                <span>alerts muted until {earliestActiveEnd ? formatClockTime(earliestActiveEnd) : "later"} ({tzLabel})</span>
              </p>
              <button
                type="button"
                onClick={() => { setFilter("status", "In Progress"); setView("list"); tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-violet-200 bg-white px-3 text-[13px] font-semibold text-violet-800 shadow-sm transition-colors hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-200"
              >
                View active<ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div role="status" className="flex min-h-[40px] flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
              <CheckCheck size={14} aria-hidden="true" className="shrink-0" />
              <span className="font-medium text-foreground">No maintenance in progress</span>
              {nextWindow && (
                <span>&middot; next: <button type="button" onClick={() => setDrawerId(nextWindow.id)} className="font-semibold text-primary hover:underline">{nextWindow.id}</button> in {formatCountdown(Date.parse(nextWindow.start), nowMs)}</span>
              )}
            </div>
          )}

          {/* KPI row */}
          <section aria-label="Maintenance key performance indicators" className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard icon={<Wrench size={18} aria-hidden="true" />} iconTone="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" label="Active" value={nfLocale(activeWindows.length)} trend={trendNode(1, "vs last week")} trendClassName="text-emerald-600 dark:text-emerald-400" goodDirection="up" className={cn("h-full min-h-[88px] p-3", kpiActive === "active" && "border-primary ring-1 ring-primary")} onClick={() => applyKpi("active")} onClickLabel="Filter table to windows in progress" />
            <StatCard icon={<CalendarClock size={18} aria-hidden="true" />} iconTone="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" label="Upcoming 7d" value={nfLocale(upcoming7d)} trend={trendNode(2, "vs last week")} trendClassName="text-emerald-600 dark:text-emerald-400" goodDirection="up" className={cn("h-full min-h-[88px] p-3", kpiActive === "upcoming" && "border-primary ring-1 ring-primary")} onClick={() => applyKpi("upcoming")} onClickLabel="Filter table to scheduled windows in the next 7 days" />
            <StatCard icon={<CheckCheck size={18} aria-hidden="true" />} iconTone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" label="Completed 30d" value={nfLocale(completed30d)} trend={trendNode(6, "vs last week")} trendClassName="text-emerald-600 dark:text-emerald-400" goodDirection="up" className={cn("h-full min-h-[88px] p-3", kpiActive === "completed" && "border-primary ring-1 ring-primary")} onClick={() => applyKpi("completed")} onClickLabel="Filter table to completed windows" />
            <StatCard icon={<BellOff size={18} aria-hidden="true" />} iconTone="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" label="In Maintenance" value={nfLocale(serversInMaintenance.length)} trend={trendNode(2, "vs last week")} trendClassName="text-emerald-600 dark:text-emerald-400" goodDirection="up" className={cn("h-full min-h-[88px] p-3", kpiActive === "inMaintenance" && "border-primary ring-1 ring-primary")} onClick={() => applyKpi("inMaintenance")} onClickLabel="Filter table to windows in progress" />
            <StatCard icon={<Bell size={18} aria-hidden="true" />} iconTone="bg-[#e2f0ff] text-[#1379e8] dark:bg-[#17385c] dark:text-[#5fb0ff]" label="Suppressed 24h" value={nfLocale(alertsSuppressed24h)} trend={trendNode(142, "vs last week")} trendClassName="text-emerald-600 dark:text-emerald-400" goodDirection="up" className={cn("h-full min-h-[88px] p-3", kpiActive === "suppressed" && "border-primary ring-1 ring-primary")} onClick={() => applyKpi("suppressed")} onClickLabel="Filter table to last 7 days" />
            <StatCard icon={<ShieldCheck size={18} aria-hidden="true" />} iconTone="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400" label="Pending Approval" value={nfLocale(pendingApproval)} trend={trendNode(1, "vs last week")} trendClassName="text-rose-600 dark:text-rose-400" goodDirection="down" className={cn("h-full min-h-[88px] p-3", kpiActive === "pending" && "border-primary ring-1 ring-primary")} onClick={() => applyKpi("pending")} onClickLabel="Filter table to windows pending approval" />
          </section>

          {/* View toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SegmentedControl value={view === "list" ? "List" : view === "calendar" ? "Calendar" : "Timeline"} options={["List", "Calendar", "Timeline"] as const} onChange={(value) => setView(value === "List" ? "list" : value === "Calendar" ? "calendar" : "timeline")} buttonClassName="h-8 px-3 text-[13px]" />
          </div>

          {/* Filter card */}
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
              {STATUS_FILTER_ORDER.map(statusChip)}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-2">
              <div className="relative w-full sm:w-auto sm:min-w-[220px] sm:max-w-xs sm:flex-1">
                <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={filters.query}
                  onChange={(event) => setFilter("query", event.target.value)}
                  placeholder="Search windows, servers, ticket..."
                  aria-label="Search maintenance windows"
                  className="h-9 pl-9 pr-10 text-sm"
                />
                <kbd aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[12px] font-medium text-muted-foreground">/</kbd>
              </div>
              <MultiSelect label="Type" options={TYPE_OPTIONS} selected={filters.types} onChange={(values) => setFilter("types", values)} width={120} />
              <MultiSelect label="Owner" options={OWNER_OPTIONS} selected={filters.owners} onChange={(values) => setFilter("owners", values)} width={140} />
              <MultiSelect label="Server group" options={GROUP_OPTIONS} selected={filters.groups} onChange={(values) => setFilter("groups", values)} width={160} />
              <MultiSelect label="Approval" options={APPROVAL_OPTIONS} selected={filters.approvals} onChange={(values) => setFilter("approvals", values)} width={130} />
              <SegmentedControl value={filters.range} options={RANGE_OPTIONS} onChange={(value) => setFilter("range", value as RangeKey)} buttonClassName="h-8 px-2.5 text-[13px]" />
              {filters.range === "Custom" && (
                <span className="flex items-center gap-1.5">
                  <Input type="date" value={filters.customFrom} onChange={(event) => setFilter("customFrom", event.target.value)} className="h-9 w-[150px] text-sm" aria-label="From date" />
                  <span className="text-muted-foreground">-</span>
                  <Input type="date" value={filters.customTo} onChange={(event) => setFilter("customTo", event.target.value)} className="h-9 w-[150px] text-sm" aria-label="To date" />
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <AlertMenu
                  label="Saved views"
                  align="end"
                  trigger={
                    <Button variant="outline" className="h-9 gap-1.5 rounded-lg px-3 text-[13px]">
                      <ListFilter size={14} aria-hidden="true" />Saved Views<ChevronDown size={13} aria-hidden="true" className="text-muted-foreground" />
                    </Button>
                  }
                  items={savedViewItems}
                />
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded text-[13px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Clear all<span className="ml-1 tabular-nums text-muted-foreground">({activeFilterCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDensity((current) => (current === "default" ? "compact" : "default"))}
                  aria-pressed={density === "compact"}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={density === "default" ? "Switch to compact rows" : "Switch to comfortable rows"}
                >
                  <ChevronsRight size={13} aria-hidden="true" />Compact
                </button>
              </div>
            </div>
            {activeChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2" aria-label="Active filters">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Active:</span>
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onRemove}
                    aria-label={`Remove filter ${chip.label}`}
                    className="inline-flex h-7 items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 text-[12px] font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {chip.label}<X size={11} aria-hidden="true" />
                  </button>
                ))}
                <button type="button" onClick={resetFilters} className="text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Clear all</button>
              </div>
            )}
          </div>

          {/* Bulk actions bar */}
          {selectedIds.length > 0 && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
              <span className="font-semibold text-foreground">{selectedIds.length} selected</span>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" className="h-8 gap-1.5 rounded-lg px-3 text-[13px]" onClick={() => handleCancelRequest(selectedIds)}>
                  <Ban size={13} aria-hidden="true" />Cancel
                </Button>
                <Button variant="outline" className="h-8 gap-1.5 rounded-lg px-3 text-[13px]" onClick={() => exportRows("csv", windows.filter((window) => selectedIds.includes(window.id)), "selected")}>
                  <FileDown size={13} aria-hidden="true" />Export
                </Button>
                <Button variant="outline" className="h-8 gap-1.5 rounded-lg px-3 text-[13px]" onClick={bulkNotify}>
                  <Bell size={13} aria-hidden="true" />Notify
                </Button>
                <button type="button" onClick={() => setSelectedIds([])} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Clear selection"><X size={15} /></button>
              </div>
            </div>
          )}

          {view === "list" && (
            <div ref={tableRef} className="scroll-mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {/* Desktop table */}
              <div className="hidden lg:block">
                <table className="w-full table-fixed border-collapse text-left">
                  <colgroup>
                    <col style={{ width: "40px" }} />
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "48px" }} />
                  </colgroup>
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-border bg-card">
                      <th scope="col" className="px-3 py-2">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          aria-label="Select all windows on this page"
                          checked={allPageSelected}
                          onChange={pageToggleAll}
                          className="h-4 w-4 cursor-pointer rounded border-input accent-[#1479e8]"
                        />
                      </th>
                      <th scope="col" aria-sort={sortKey === "title" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2">{sortHeader("title", "Window")}</th>
                      <th scope="col" aria-sort={sortKey === "status" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2">{sortHeader("status", "Status")}</th>
                      <th scope="col" aria-sort={sortKey === "start" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2">{sortHeader("start", "Schedule")}</th>
                      <th scope="col" className="px-3 py-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Scope</th>
                      <th scope="col" aria-sort={sortKey === "owner" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2">{sortHeader("owner", "Owner")}</th>
                      <th scope="col" className="px-2 py-2"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((window) => {
                      const startMs = Date.parse(window.start);
                      const endMs = Date.parse(window.end);
                      const isLive = window.status === "In Progress";
                      const endsIn = isLive ? formatCountdown(endMs, nowMs) : null;
                      const recurrence = recurrenceLabel(window);
                      const conflicted = conflictIds.has(window.id);
                      const selected = selectedIds.includes(window.id);
                      const progress = isLive ? Math.min(1, Math.max(0, (nowMs - startMs) / Math.max(1, endMs - startMs))) : 0;
                      const muteTooltip = window.alertBehavior.allowCritical ? "Alerts muted · SEV1 allowed" : "Alerts muted";
                      return (
                        <tr
                          key={window.id}
                          onClick={() => goToWindow(window.id)}
                          className={cn(
                            "group cursor-pointer border-b border-border/60 align-middle transition-colors hover:bg-[#F8FAFC] dark:hover:bg-muted/40",
                            rowHeight,
                            WINDOW_STATUS_META[window.status].stripe,
                            conflicted && "bg-red-50/40 dark:bg-red-500/5",
                            selected && "bg-primary/[0.06] dark:bg-primary/10",
                          )}
                        >
                          <td className="px-3 py-1.5 align-middle" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${window.id}`}
                              checked={selected}
                              onChange={(event) => selectWindow(window.id, event.target.checked)}
                              className="h-4 w-4 cursor-pointer rounded border-input accent-[#1479e8]"
                            />
                          </td>
                          <td className="min-w-0 px-3 py-1.5 align-middle">
                            <Link
                              href={`/maintenance-windows/${window.id}`}
                              onClick={(event) => event.stopPropagation()}
                              className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              title={window.title}
                            >
                              <span className="flex items-center gap-1.5">
                                <span className="font-mono text-[12px] text-muted-foreground">{window.id}</span>
                                {conflicted && <CircleAlert size={13} aria-hidden="true" className="shrink-0 text-red-500" />}
                              </span>
                              <span className="mt-0.5 block truncate text-[13px] font-semibold text-foreground group-hover:text-primary"><Highlight text={window.title} query={filters.query} /></span>
                              <span className="mt-0.5 block truncate text-[12px] text-muted-foreground" title={window.impact}><Highlight text={window.impact} query={filters.query} /></span>
                            </Link>
                          </td>
                          <td className="px-3 py-1.5 align-middle">
                            <span className="flex items-center gap-1.5">
                              <WindowStatusBadge status={window.status} live={isLive} endsIn={endsIn} />
                              {isLive && (
                                <span title={muteTooltip} aria-label={muteTooltip} role="img">
                                  <BellOff size={14} aria-hidden="true" className="text-amber-600 dark:text-amber-400" />
                                </span>
                              )}
                            </span>
                            <span className="mt-1 flex items-center gap-1 text-[12px] text-muted-foreground">
                              {(() => { const Icon = TYPE_ICON[window.type]; return <Icon size={12} aria-hidden="true" />; })()}
                              {window.type}
                            </span>
                          </td>
                          <td className="min-w-0 px-3 py-1.5 align-middle">
                            <span className="block truncate whitespace-nowrap text-[13px] font-medium tabular-nums text-foreground" title={formatDateRange(startMs, endMs)}>{formatDateRange(startMs, endMs)}</span>
                            <span className="mt-0.5 block text-[12px] text-muted-foreground">
                              {formatDuration(startMs, endMs)} &middot; {window.timeZone.replace("Asia/", "")}
                              {recurrence && <span className="ml-1.5 inline-flex items-center gap-0.5 text-teal-700 dark:text-teal-400" title={recurrence}><Repeat size={11} aria-hidden="true" />{recurrence.replace("Every ", "")}</span>}
                            </span>
                            {isLive && (
                              <span className="mt-1 block max-w-[150px]">
                                <span className="block h-1 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Window progress">
                                  <span className="block h-full rounded-full bg-violet-500" style={{ width: `${Math.round(progress * 100)}%` }} />
                                </span>
                                <span className="mt-0.5 block text-[12px] font-medium tabular-nums text-violet-700 dark:text-violet-300">{formatCountdown(endMs, nowMs)} left</span>
                              </span>
                            )}
                          </td>
                          <td className="hidden min-w-0 px-3 py-1.5 align-middle lg:table-cell"><ScopeCell window={window} /></td>
                          <td className="hidden px-3 py-1.5 align-middle lg:table-cell">
                            <span className="flex items-center gap-2">
                              <InitialsAvatar name={window.owner} size={22} />
                              <span className="min-w-0 truncate text-[13px] text-foreground">{window.owner}</span>
                            </span>
                            <span className="mt-1 block"><ApprovalBadge status={window.approvalStatus} /></span>
                          </td>
                          <td className="px-1 py-1.5 align-middle" onClick={(event) => event.stopPropagation()}>
                            <AlertMenu
                              label={`Actions for ${window.id}`}
                              align="end"
                              trigger={
                                <button
                                  type="button"
                                  aria-label={`Actions for ${window.id}`}
                                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <MoreVertical size={16} />
                                </button>
                              }
                              items={kebabFor(window)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {pageItems.length === 0 && (
                      <tr>
                        <td colSpan={7}>
                          <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 py-10 text-center">
                            <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground"><FilterX size={20} /></span>
                            <p className="font-display text-base font-bold text-foreground">No maintenance windows match your filters</p>
                            <p className="max-w-sm text-sm text-muted-foreground">Try clearing the search or filters to see the full schedule.</p>
                            <Button variant="outline" className="mt-1 h-9 gap-1.5 rounded-lg px-4 text-[13px]" onClick={resetFilters}><X size={14} />Clear filters</Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="divide-y divide-border/60 lg:hidden">
                {pageItems.map((window) => {
                  const startMs = Date.parse(window.start);
                  const endMs = Date.parse(window.end);
                  const isLive = window.status === "In Progress";
                  const endsIn = isLive ? formatCountdown(endMs, nowMs) : null;
                  const conflicted = conflictIds.has(window.id);
                  const selected = selectedIds.includes(window.id);
                  return (
                    <div
                      key={window.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => goToWindow(window.id)}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); goToWindow(window.id); } }}
                      className={cn(
                        "flex cursor-pointer items-start gap-2 p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring hover:bg-[#F8FAFC] dark:hover:bg-muted/40",
                        WINDOW_STATUS_META[window.status].stripe,
                        selected && "bg-primary/[0.06] dark:bg-primary/10",
                      )}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select ${window.id}`}
                        checked={selected}
                        onChange={(event) => { event.stopPropagation(); selectWindow(window.id, event.target.checked); }}
                        onClick={(event) => event.stopPropagation()}
                        className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-[#1479e8]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[12px] text-muted-foreground">{window.id}{conflicted && <CircleAlert size={11} aria-hidden="true" className="ml-1 inline text-red-500" />}</span>
                          <span onClick={(event) => event.stopPropagation()}>
                            <AlertMenu
                              label={`Actions for ${window.id}`}
                              align="end"
                              trigger={<button type="button" aria-label={`Actions for ${window.id}`} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"><MoreVertical size={15} /></button>}
                              items={kebabFor(window)}
                            />
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] font-semibold text-foreground" title={window.title}>{window.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <WindowStatusBadge status={window.status} live={isLive} endsIn={endsIn} />
                          {isLive && <BellOff size={13} aria-hidden="true" className="text-amber-600 dark:text-amber-400" />}
                          <span className="text-[12px] text-muted-foreground">{formatDateRange(startMs, endMs)}</span>
                        </span>
                        <span className="mt-1 flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5"><InitialsAvatar name={window.owner} size={18} /><span className="truncate text-[12px] text-muted-foreground">{window.owner}</span></span>
                          <ApprovalBadge status={window.approvalStatus} />
                        </span>
                      </span>
                    </div>
                  );
                })}
                {pageItems.length === 0 && (
                  <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 p-6 text-center">
                    <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground"><FilterX size={20} /></span>
                    <p className="font-display text-base font-bold text-foreground">No maintenance windows match your filters</p>
                    <Button variant="outline" className="mt-1 h-9 gap-1.5 rounded-lg px-4 text-[13px]" onClick={resetFilters}><X size={14} />Clear filters</Button>
                  </div>
                )}
              </div>

              {/* Pagination footer */}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[13px] text-muted-foreground">
                <p className="tabular-nums">Showing <b className="text-foreground">{pageStart}-{pageEnd}</b> of <b className="text-foreground">{totalFiltered}</b> windows</p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5">
                    <span className="sr-only">Rows per page</span>
                    <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}>
                      <SelectTrigger className="h-8 w-[64px] text-[13px]" aria-label="Rows per page"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <span className="hidden sm:inline">rows</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={clampedPage <= 1}
                      aria-label="Previous page"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    {pageNumbers.map((item, index) =>
                      item === "..." ? (
                        <span key={`ellipsis-${index}`} className="grid h-8 w-8 place-items-center text-muted-foreground">&hellip;</span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setPage(item)}
                          aria-current={item === clampedPage ? "page" : undefined}
                          aria-label={`Page ${item}`}
                          className={cn(
                            "grid h-8 w-8 place-items-center rounded-lg border text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            item === clampedPage ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-accent",
                          )}
                        >
                          {item}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={clampedPage >= totalPages}
                      aria-label="Next page"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === "calendar" && (
            <section aria-label="Maintenance calendar" className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button variant="outline" size="icon-sm" className="h-8 w-8" onClick={() => moveCalendar(-1)} aria-label={calendarMode === "week" ? "Previous week" : "Previous month"}><ChevronLeft size={15} /></Button>
                  <h2 className="min-w-[150px] text-center font-display text-base font-bold text-foreground">{calendarLabel}</h2>
                  <Button variant="outline" size="icon-sm" className="h-8 w-8" onClick={() => moveCalendar(1)} aria-label={calendarMode === "week" ? "Next week" : "Next month"}><ChevronRight size={15} /></Button>
                  <Button variant="outline" className="h-8 px-3 text-[13px]" onClick={() => setCalendarCursor(new Date())}>Today</Button>
                </div>
                <SegmentedControl value={calendarMode === "month" ? "Month" : "Week"} options={["Month", "Week"] as const} onChange={(value) => setCalendarMode(value === "Week" ? "week" : "month")} buttonClassName="h-8 px-3 text-[13px]" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground" role="group" aria-label="Status legend">
                {(Object.keys(WINDOW_STATUS_META) as MaintenanceWindowStatus[]).map((key) => (
                  <span key={key} className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: WINDOW_STATUS_META[key].dot }} />{key}</span>
                ))}
              </div>

              {/* Desktop / tablet grid */}
              <div className="mt-3 hidden gap-1 md:grid" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }} role="grid" aria-label="Maintenance windows calendar">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <div key={day} role="columnheader" className="px-2 py-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{day}</div>
                ))}
                {calendarDays.map((date, index) => {
                  const key = dayKeyOf(date);
                  const dayWindows = windowsByDayKey.get(key) ?? [];
                  const isToday = key === todayKey;
                  const inMonth = calendarMode === "week" || date.getMonth() === calendarCursor.getMonth();
                  const shown = dayWindows.slice(0, 2);
                  const extra = dayWindows.length - shown.length;
                  return (
                    <div
                      key={key}
                      role="gridcell"
                      aria-selected={isToday}
                      aria-label={`${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${dayWindows.length ? `, ${dayWindows.length} window${dayWindows.length === 1 ? "" : "s"}` : ""}`}
                      className={cn(
                        "flex min-h-[104px] flex-col gap-1 rounded-lg border p-1.5",
                        isToday ? "border-primary/70 bg-primary/[0.06]" : inMonth ? "border-border" : "border-border/50 bg-muted/20",
                        calendarMode === "week" && "min-h-[220px]",
                      )}
                    >
                      <button
                        type="button"
                        ref={(element) => { calendarDayFocus.current[index] = element; }}
                        onClick={() => prefillForDate(date)}
                        onKeyDown={(event) => onCalendarKeyDown(event, index)}
                        aria-label={`Schedule a new window on ${date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`}
                        title="Schedule maintenance on this day"
                        className={cn(
                          "grid h-7 w-7 place-items-center self-start rounded-full text-[13px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isToday ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                        )}
                      >
                        {date.getDate()}
                      </button>
                      {shown.map((window) => (
                        <button
                          key={window.id}
                          type="button"
                          onClick={() => openDrawer(window.id)}
                          title={`${window.id} - ${window.title}`}
                          className="flex items-center gap-1 rounded-md border-l-[3px] bg-muted/60 px-1.5 py-1 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{ borderLeftColor: WINDOW_STATUS_META[window.status].dot }}
                        >
                          <span className="truncate">{window.title}</span>
                        </button>
                      ))}
                      {extra > 0 && <span className="px-1.5 text-[12px] font-medium text-muted-foreground">+{extra} more</span>}
                    </div>
                  );
                })}
              </div>

              {/* Mobile agenda */}
              <div className="mt-3 divide-y divide-border md:hidden">
                {calendarDays.filter((date) => (windowsByDayKey.get(dayKeyOf(date)) ?? []).length > 0).map((date) => {
                  const key = dayKeyOf(date);
                  const dayWindows = windowsByDayKey.get(key) ?? [];
                  return (
                    <div key={key} className="py-2">
                      <p className={cn("text-[12px] font-semibold uppercase tracking-wide text-muted-foreground", key === todayKey && "text-primary")}>{date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}{key === todayKey && " · Today"}</p>
                      <ul className="mt-1 space-y-1">
                        {dayWindows.map((window) => (
                          <li key={window.id}>
                            <button type="button" onClick={() => openDrawer(window.id)} className="flex w-full items-center gap-2 rounded-lg border-l-[3px] bg-muted/50 px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ borderLeftColor: WINDOW_STATUS_META[window.status].dot }}>
                              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{window.title}</span>
                              <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{formatClockTime(Date.parse(window.start))}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
                {calendarDays.every((date) => (windowsByDayKey.get(dayKeyOf(date)) ?? []).length === 0) && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No windows in this {calendarMode === "week" ? "week" : "month"}. <button type="button" className="font-semibold text-primary hover:underline" onClick={() => prefillForDate(new Date())}>Schedule one</button></p>
                )}
              </div>
            </section>
          )}

          {view === "timeline" && (
            <section aria-label="Maintenance timeline, next 7 days" className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">Next 7 days</h2>
                  <p className="text-[12px] text-muted-foreground">Windows grouped by primary server group &middot; conflicts outlined in red</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground" role="group" aria-label="Status legend">
                  {(Object.keys(WINDOW_STATUS_META) as MaintenanceWindowStatus[]).map((key) => (
                    <span key={key} className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: WINDOW_STATUS_META[key].dot }} />{key}</span>
                  ))}
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-[180px_repeat(7,minmax(0,1fr))] gap-1 pb-1">
                    <div />
                    {Array.from({ length: 7 }, (_, index) => {
                      const day = new Date(timelineGroups.horizonStart + index * 24 * 60 * 60_000);
                      const isToday = day.toDateString() === new Date().toDateString();
                      return (
                        <div key={index} className={cn("text-center text-[12px] font-semibold", isToday ? "text-primary" : "text-muted-foreground")}>
                          {day.toLocaleDateString(undefined, { weekday: "short" })}<br /><span className="tabular-nums">{day.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}</span>
                        </div>
                      );
                    })}
                  </div>
                  {timelineGroups.rows.map((row) => (
                    <div key={row.group} className="grid grid-cols-[180px_repeat(7,minmax(0,1fr))] gap-1 border-t border-border/60 py-1.5">
                      <div className="flex min-w-0 items-center pr-3">
                        <span className="truncate text-[13px] font-medium text-foreground" title={row.name}>{row.name}</span>
                      </div>
                      <div className="relative col-span-7 h-9">
                        {row.windows.map((window) => {
                          const start = Math.max(Date.parse(window.start), timelineGroups.horizonStart);
                          const end = Math.min(Date.parse(window.end), timelineGroups.horizonEnd);
                          const span = timelineGroups.horizonEnd - timelineGroups.horizonStart;
                          const left = ((start - timelineGroups.horizonStart) / span) * 100;
                          const width = Math.max(((end - start) / span) * 100, 1.5);
                          const conflicted = conflictIds.has(window.id);
                          return (
                            <button
                              key={window.id}
                              type="button"
                              onClick={() => openDrawer(window.id)}
                              title={`${window.id} - ${window.title} (${window.status})`}
                              className={cn(
                                "absolute top-0.5 flex h-8 items-center overflow-hidden rounded-md border border-black/10 px-1.5 text-[12px] font-semibold text-white transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                conflicted && "ring-2 ring-red-500 ring-offset-1",
                              )}
                              style={{ left: `${left}%`, width: `${width}%`, background: WINDOW_STATUS_META[window.status].dot }}
                            >
                              <span className="truncate">{window.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {timelineGroups.rows.length === 0 && (
                    <p className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">Nothing scheduled in the next 7 days. <Link href="/maintenance-windows/new" className="font-semibold text-primary hover:underline">Schedule one</Link></p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Insights row */}
          <section aria-label="Maintenance insights" className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-12">
            <ChartCard
              className="min-w-0 p-5 md:col-span-2 xl:col-span-4"
              title="Upcoming Windows"
              actions={
                <AlertMenu
                  label="Upcoming windows options"
                  trigger={<Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="Upcoming windows options"><MoreVertical size={15} /></Button>}
                  items={[{ key: "view-all", label: "View all scheduled", onSelect: () => { setFilters((current) => ({ ...current, status: "Scheduled", range: "7D" })); setPage(1); setView("list"); } }]}
                />
              }
            >
              <ul className="flex flex-1 flex-col divide-y divide-border/60">
                {upcomingWindows.slice(0, 5).map((window) => (
                  <li key={window.id}>
                    <button type="button" onClick={() => openDrawer(window.id)} className="flex w-full items-start gap-2 rounded-lg py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><CalendarClock size={14} aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-foreground" title={window.title}>{window.title}</span>
                        <span className="mt-0.5 block text-[12px] text-muted-foreground">in {formatCountdown(Date.parse(window.start), nowMs)} &middot; {formatShortDate(Date.parse(window.start))} {formatClockTime(Date.parse(window.start))} ({window.timeZone.replace("Asia/", "")})</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1">
                          {[...window.scope.servers, ...window.scope.groups].slice(0, 2).map((chip) => <span key={chip} className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[12px] text-muted-foreground">{chip}</span>)}
                          <ApprovalBadge status={window.approvalStatus} />
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {upcomingWindows.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nothing scheduled.</li>}
              </ul>
              <div className="mt-auto border-t border-border pt-2">
                <ViewAllLink label="View all" onClick={() => { setFilters((current) => ({ ...current, status: "Scheduled" })); setPage(1); setView("list"); }} />
              </div>
            </ChartCard>

            <ChartCard
              className="min-w-0 p-5 xl:col-span-4"
              title="Alerts Suppressed (7d)"
              actions={
                <AlertMenu
                  label="Suppressed alerts options"
                  trigger={<Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="Suppressed alerts options"><MoreVertical size={15} /></Button>}
                  items={[{ key: "csv", label: "Copy chart data (CSV)", onSelect: () => { const csv = ["day,suppressed", ...suppressed7d.map((bucket) => `${bucket.label},${bucket.alerts}`)].join("\r\n"); downloadBlob(csv, "text/csv;charset=utf-8", "suppressed-7d.csv"); showToast("Suppressed alerts data copied as CSV."); } }]}
                />
              }
            >
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <p className="font-display text-2xl font-bold tabular-nums text-foreground">{nfLocale(suppressed7dTotal)}</p>
                  <p className="text-[12px] text-muted-foreground">alerts silenced in the last 7 days</p>
                </div>
                <p className="text-right text-[12px] leading-snug text-muted-foreground"><b className="text-foreground">{criticalAllowedThrough}</b> window{criticalAllowedThrough === 1 ? "" : "s"} let SEV1<br />through (critical allowed)</p>
              </div>
              <div className="h-[120px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={suppressed7d} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="28%">
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} width={28} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<SuppressedTooltip />} cursor={{ fill: "var(--muted)", fillOpacity: 0.45 }} />
                    <Bar dataKey="alerts" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Summary stats row */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border bg-muted/30 p-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Daily Avg</p>
                  <p className="mt-0.5 font-display text-lg font-bold tabular-nums leading-tight text-foreground">{nfLocale(suppressedDailyAvg)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Peak Day</p>
                  <p className="mt-0.5 font-display text-lg font-bold tabular-nums leading-tight text-foreground">{suppressedPeakDay.label}<span className="ml-1 text-[12px] font-semibold text-muted-foreground">({nfLocale(suppressedPeakDay.alerts)})</span></p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">vs Prev 7d</p>
                  {suppressedVsPrev === null ? (
                    <p className="mt-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[12px] font-semibold text-muted-foreground" title="No suppressed alerts recorded in the previous 7 days">+{nfLocale(suppressed7dTotal)} new</p>
                  ) : (
                    <p className={cn(
                      "mt-1 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums",
                      suppressedVsPrev >= 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
                    )}>
                      {suppressedVsPrev >= 0 ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" />}
                      {suppressedVsPrev >= 0 ? "+" : ""}{suppressedVsPrev}%
                    </p>
                  )}
                </div>
              </div>

              {/* Suppressed by severity */}
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">By Severity</p>
                {(() => {
                  const total = suppressedBySeverity.SEV2 + suppressedBySeverity.SEV3 + suppressedBySeverity.SEV4;
                  const pct = (value: number) => (total > 0 ? (value / total) * 100 : 0);
                  return (
                    <>
                      <div role="img" aria-label={`SEV2 ${suppressedBySeverity.SEV2}, SEV3 ${suppressedBySeverity.SEV3}, SEV4 ${suppressedBySeverity.SEV4} alerts suppressed`} className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full">
                        <span style={{ width: `${pct(suppressedBySeverity.SEV2)}%`, background: "#DC2626" }} />
                        <span style={{ width: `${pct(suppressedBySeverity.SEV3)}%`, background: "#D97706" }} />
                        <span style={{ width: `${pct(suppressedBySeverity.SEV4)}%`, background: "#3B82F6" }} />
                      </div>
                      <p className="mt-1.5 text-[12px] tabular-nums text-muted-foreground">
                        <span className="text-red-600 dark:text-red-400">SEV2 {nfLocale(suppressedBySeverity.SEV2)}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="text-amber-700 dark:text-amber-400">SEV3 {nfLocale(suppressedBySeverity.SEV3)}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="text-blue-600 dark:text-blue-400">SEV4 {nfLocale(suppressedBySeverity.SEV4)}</span>
                      </p>
                    </>
                  );
                })()}
              </div>

              {/* Top windows by suppressed alerts */}
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Top Windows by Suppressed Alerts</p>
                <ul className="mt-1.5 space-y-1.5">
                  {topSuppressedWindows.map((row) => (
                    <li key={row.id}>
                      <button type="button" onClick={() => setDrawerId(row.id)} className="block w-full rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open ${row.id} ${row.title}`}>
                        <span className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-[12px] font-medium text-foreground" title={`${row.id} ${row.title}`}><span className="font-mono text-muted-foreground">{row.id}</span> {row.title}</span>
                          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-foreground">{nfLocale(row.suppressed)}</span>
                        </span>
                        <span className="mt-0.5 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-[#8B5CF6]" style={{ width: `${Math.round((row.contribution / maxTopSuppressed) * 100)}%` }} />
                        </span>
                      </button>
                    </li>
                  ))}
                  {topSuppressedWindows.length === 0 && <li className="py-2 text-[12px] text-muted-foreground">No suppressed alerts in the last 7 days.</li>}
                </ul>
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-border pt-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground"><i aria-hidden="true" className="h-2 w-2 rounded-full bg-[#8B5CF6]" />Muted alerts (SEV2-4)</span>
                <ViewAllLink label="View all" onClick={() => { setFilters((current) => ({ ...current, range: "7D" })); setPage(1); setView("list"); }} />
              </div>
            </ChartCard>

            <ChartCard
              className="min-w-0 p-5 xl:col-span-4"
              title="Maintenance by Group"
              actions={
                <AlertMenu
                  label="Group breakdown options"
                  trigger={<Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="Group breakdown options"><MoreVertical size={15} /></Button>}
                  items={groupStats.slice(0, 3).map((row) => ({ key: row.group, label: `Filter: ${row.name}`, onSelect: () => { setFilter("groups", [row.group]); setView("list"); } }))}
                />
              }
            >
              <ul className="flex flex-col gap-3">
                {groupStats.map((row) => (
                  <li key={row.group}>
                    <button type="button" onClick={() => { setFilter("groups", [row.group]); setView("list"); }} className="block w-full rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Filter by ${row.name}`}>
                      <span className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="min-w-0 truncate font-medium text-foreground" title={row.name}>{row.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{row.windows} win &middot; {row.hours}h</span>
                      </span>
                      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-violet-400 dark:bg-violet-500" style={{ width: `${Math.round((row.hours / maxGroupHours) * 100)}%` }} />
                      </span>
                    </button>
                  </li>
                ))}
                {groupStats.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No group data.</li>}
              </ul>

              {/* Summary strip */}
              <div className="mt-4 border-t border-border pt-4">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Groups</p>
                    <p className="mt-0.5 font-display text-lg font-bold tabular-nums leading-tight text-foreground">{groupStats.length}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Windows</p>
                    <p className="mt-0.5 font-display text-lg font-bold tabular-nums leading-tight text-foreground">{nfLocale(groupTotals.windows)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hours</p>
                    <p className="mt-0.5 font-display text-lg font-bold tabular-nums leading-tight text-foreground">{groupTotals.hours}h</p>
                  </div>
                </div>
              </div>

              {/* Share of maintenance time */}
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Share of Maintenance Time</p>
                <div className="mt-1.5 flex h-2 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={groupShares.map((row) => `${row.name}: ${Math.round(row.pct)}%`).join(", ")}>
                  {groupShares.map((row, index) => {
                    const color = GROUP_SHARE_COLORS[index % GROUP_SHARE_COLORS.length];
                    return (
                      <span
                        key={row.group}
                        style={{ width: `${row.pct}%`, background: color }}
                        title={`${row.name} — ${row.windows} windows, ${row.hours}h, ${Math.round(row.pct)}% of total hours`}
                        className="h-full rounded-[2px]"
                      />
                    );
                  })}
                </div>
                <ul className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1">
                  {groupShares.map((row, index) => (
                    <li key={row.group} className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground" title={`${row.name} — ${Math.round(row.pct)}%`}>
                      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: GROUP_SHARE_COLORS[index % GROUP_SHARE_COLORS.length] }} />
                      <span className="min-w-0 truncate">{row.name} <span className="tabular-nums">{Math.round(row.pct)}%</span></span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Insight strip */}
              <p className="mt-4 flex items-center gap-2 rounded-lg bg-violet-50 px-2.5 py-2 text-[12px] font-medium text-violet-900 dark:bg-violet-500/10 dark:text-violet-200">
                <Info size={14} aria-hidden="true" className="shrink-0" />
                <span className="min-w-0">Most maintenance: <b>{topGroupByHours.name}</b> ({topGroupPct}% of total hours)</span>
              </p>

              <div className="mt-auto border-t border-border pt-2">
                <ViewAllLink label="View all" onClick={() => { setFilter("groups", []); setView("list"); }} />
              </div>
            </ChartCard>
          </section>

          {/* Cancel confirmation */}
          <Dialog open={cancelTargets != null} onOpenChange={(open) => { if (!open) setCancelTargets(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel maintenance window{(cancelTargets?.length ?? 0) > 1 ? "s" : ""}?</DialogTitle>
                <DialogDescription>
                  {cancelTargets?.length ?? 0} window{(cancelTargets?.length ?? 0) === 1 ? "" : "s"} will be cancelled and their muted alerts restored immediately. This can be undone from the toast.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" className="h-10 rounded-lg px-4 text-sm" onClick={() => setCancelTargets(null)}>Keep windows</Button>
                <Button className="h-10 rounded-lg bg-[#DC2626] px-4 text-sm font-semibold text-white hover:bg-[#B91C1C]" onClick={confirmCancel}>Cancel maintenance</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* End now confirmation */}
          <Dialog open={endTarget != null} onOpenChange={(open) => { if (!open) setEndTarget(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>End {endTarget} now?</DialogTitle>
                <DialogDescription>The window will be marked Completed, alerts will be unmuted and actual end time recorded as now.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" className="h-10 rounded-lg px-4 text-sm" onClick={() => setEndTarget(null)}>Keep running</Button>
                <Button className="h-10 rounded-lg px-4 text-sm font-semibold" onClick={confirmEndNow}>End now</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Detail drawer */}
          <WindowDrawer
            window={drawerWindow}
            nowMs={nowMs}
            onClose={closeDrawer}
            onExtend={(id, minutes) => { extendWindow(id, minutes); showToast(`${id} extended by ${minutes}m.`); }}
            onEndNow={(id) => setEndTarget(id)}
            onCancel={(id) => handleCancelRequest([id])}
            onDuplicate={(id) => { const newId = duplicateWindow(id); if (newId) showToast(`Duplicated as ${newId}.`); }}
          />

          {/* Toast */}
          {toast && (
            <div role="status" aria-live="polite" className="fixed bottom-4 left-1/2 z-[1500] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-popover px-4 py-2.5 text-sm text-popover-foreground shadow-lg">
              <Check size={15} aria-hidden="true" className="text-emerald-600" />
              <span>{toast.message}</span>
              {toast.undo && (
                <button
                  type="button"
                  onClick={() => { restore(toast.undo ?? []); setToast(null); showToast("Restored."); }}
                  className="rounded font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Undo
                </button>
              )}
              <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X size={14} /></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------ detail drawer ------------------------------ */

const DRAWER_TIMELINE_META: Record<string, { label: string; tone: string }> = {
  created: { label: "Created", tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  approved: { label: "Approved", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  rejected: { label: "Rejected", tone: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" },
  started: { label: "Started", tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  extended: { label: "Extended", tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  completed: { label: "Completed", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  cancelled: { label: "Cancelled", tone: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" },
  updated: { label: "Updated", tone: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" },
  note: { label: "Note", tone: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" },
};

function WindowDrawer({ window, nowMs, onClose, onExtend, onEndNow, onCancel, onDuplicate }: {
  window: MaintenanceWindow | null;
  nowMs: number;
  onClose: () => void;
  onExtend: (id: string, minutes: number) => void;
  onEndNow: (id: string) => void;
  onCancel: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const open = window != null;

  useEffect(() => {
    if (!open) return;
    drawerRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusables = drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, window?.id, onClose]);

  if (!window || typeof document === "undefined") return null;

  const startMs = Date.parse(window.start);
  const endMs = Date.parse(window.end);
  const live = window.status === "In Progress";
  const startValid = Number.isFinite(startMs);
  const durationMs = live && startValid ? endMs - startMs : 0;
  const progress = live && durationMs > 0 ? Math.min(1, Math.max(0, (nowMs - startMs) / durationMs)) : 0;
  const scopeHostsList = scopeHosts(window.scope);
  const hostAlerts = SAMPLE_ALERTS.filter((alert) => scopeHostsList.includes(alert.host));
  const mutedRules = ALERT_RULES.filter((rule) => window.alertBehavior.mutedRuleIds.includes(rule.id));
  const approvalTrail = window.timeline.filter((entry) => entry.type === "created" || entry.type === "approved" || entry.type === "rejected");

  return createPortal(
    <>
      <div aria-hidden="true" className="fixed inset-0 z-[1290] bg-slate-950/40" onClick={onClose} />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="window-drawer-title"
        className="fixed inset-y-0 right-0 z-[1300] flex w-full flex-col border-l border-border bg-card shadow-2xl sm:max-w-[480px]"
      >
        {/* Header */}
        <header className="flex flex-col gap-2 border-b border-border p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[12px] text-muted-foreground">{window.id}</p>
              <h2 id="window-drawer-title" className="mt-0.5 text-base font-bold leading-snug text-foreground">{window.title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              data-autofocus
              aria-label="Close panel"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={17} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <WindowStatusBadge status={window.status} live={live} endsIn={live ? formatCountdown(endMs, nowMs) : null} />
            <WindowTypeBadge type={window.type} />
            <ApprovalBadge status={window.approvalStatus} />
          </div>
        </header>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* Schedule */}
          <section aria-labelledby="drawer-schedule">
            <h3 id="drawer-schedule" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Schedule</h3>
            <dl className="mt-1.5 space-y-1.5 text-[13px]">
              <div className="flex items-baseline justify-between gap-3"><dt className="text-muted-foreground">Start</dt><dd className="tabular-nums text-foreground">{new Date(startMs).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</dd></div>
              <div className="flex items-baseline justify-between gap-3"><dt className="text-muted-foreground">End</dt><dd className="tabular-nums text-foreground">{new Date(endMs).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</dd></div>
              <div className="flex items-baseline justify-between gap-3"><dt className="text-muted-foreground">Duration</dt><dd className="tabular-nums text-foreground">{formatDuration(startMs, endMs)}</dd></div>
              <div className="flex items-baseline justify-between gap-3"><dt className="text-muted-foreground">Time zone</dt><dd className="text-foreground">{window.timeZone}</dd></div>
              {live && (
                <div>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px]"><span className="text-muted-foreground">Progress</span><span className="tabular-nums text-violet-700 dark:text-violet-300">{formatCountdown(endMs, nowMs)} left</span></div>
                  <div role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Window progress" className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                </div>
              )}
            </dl>
          </section>

          {/* Scope */}
          <section aria-labelledby="drawer-scope" className="mt-5">
            <h3 id="drawer-scope" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Scope</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {scopeHostsList.map((host) => <span key={host} className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">{host}</span>)}
              {window.scope.groups.map((group) => <span key={group} className="rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 font-mono text-[12px] text-violet-800 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300">{group}</span>)}
              {scopeHostsList.length === 0 && window.scope.groups.length === 0 && <span className="text-[13px] text-muted-foreground">No targets in scope.</span>}
            </div>
          </section>

          {/* Mute policy */}
          <section aria-labelledby="drawer-mute" className="mt-5">
            <h3 id="drawer-mute" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Mute policy</h3>
            <ul className="mt-1.5 space-y-1 text-[13px]">
              <li className="flex items-center gap-2"><BellOff size={13} aria-hidden="true" className="text-amber-600 dark:text-amber-400" />{window.alertBehavior.muteAlerts ? "Alerts muted for scope" : "Alerts stay live"}</li>
              <li className="flex items-center gap-2"><ShieldCheck size={13} aria-hidden="true" className={window.alertBehavior.allowCritical ? "text-red-500" : "text-muted-foreground"} />{window.alertBehavior.allowCritical ? "SEV1 / Critical alerts break through" : "All severities muted"}</li>
              <li className="flex items-center gap-2"><Check size={13} aria-hidden="true" className={window.alertBehavior.suppressIncidents ? "text-emerald-600" : "text-muted-foreground"} />{window.alertBehavior.suppressIncidents ? "Incident auto-creation suppressed" : "Incidents created normally"}</li>
              <li className="flex items-center gap-2"><Zap size={13} aria-hidden="true" className="text-muted-foreground" />{window.alertBehavior.autoEnd ? "Auto-end + unmute at end" : "Manual end required"}</li>
            </ul>
            {mutedRules.length > 0 && (
              <div className="mt-2">
                <p className="text-[12px] font-semibold text-muted-foreground">Muted rules ({mutedRules.length})</p>
                <ul className="mt-1 divide-y divide-border/60">
                  {mutedRules.slice(0, 6).map((rule) => (
                    <li key={rule.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="min-w-0 truncate text-[13px] text-foreground" title={rule.name}>{rule.name}</span>
                      <Link href={`/alert-rules?rule=${rule.id}`} className="shrink-0 font-mono text-[12px] text-primary hover:underline">{rule.id}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Approval trail */}
          <section aria-labelledby="drawer-approval" className="mt-5">
            <h3 id="drawer-approval" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Approval trail</h3>
            <ol className="mt-1.5 space-y-1.5 text-[13px]">
              {approvalTrail.map((entry) => (
                <li key={entry.id} className="flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-[12px] tabular-nums text-muted-foreground">{new Date(entry.epochMs).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  <span className="min-w-0"><b>{entry.author}</b> <span className="text-muted-foreground">- {entry.text}</span></span>
                </li>
              ))}
              {window.approver && (
                <li className="flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-[12px] text-muted-foreground">&mdash;</span>
                  <span className="min-w-0">Approver: <b>{window.approver}</b> <span className="text-muted-foreground">({window.approvalStatus})</span></span>
                </li>
              )}
            </ol>
          </section>

          {/* Timeline */}
          <section aria-labelledby="drawer-timeline" className="mt-5">
            <h3 id="drawer-timeline" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Timeline</h3>
            <ol className="mt-1.5 divide-y divide-border/60">
              {[...window.timeline].sort((a, b) => a.epochMs - b.epochMs).map((entry) => {
                const meta = DRAWER_TIMELINE_META[entry.type] ?? DRAWER_TIMELINE_META.note;
                return (
                  <li key={entry.id} className="flex items-start gap-2 py-1.5">
                    <span className={cn("mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[12px] font-semibold", meta.tone)}>{meta.label}</span>
                    <span className="min-w-0 text-[13px] leading-snug text-foreground"><b>{entry.author}</b> <span className="text-muted-foreground">{new Date(entry.epochMs).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span><br />{entry.text}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Linked alerts */}
          <section aria-labelledby="drawer-linked" className="mt-5">
            <h3 id="drawer-linked" className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Linked alerts</h3>
            {hostAlerts.length === 0 ? (
              <p className="mt-1.5 text-[13px] text-muted-foreground">No alerts reference this scope.</p>
            ) : (
              <ul className="mt-1.5 divide-y divide-border/60">
                {hostAlerts.slice(0, 6).map((alert) => (
                  <li key={alert.id}>
                    <Link href={`/alerts?alert=${alert.id}`} className="flex items-center gap-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground" title={alert.name}>{alert.name}</span>
                      <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{alert.id}</span>
                      {live && <span className="shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-[12px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">Suppressed</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="flex flex-wrap items-center gap-2 border-t border-border p-4">
          {live && (
            <>
              <Button variant="outline" className="h-9 rounded-lg px-3 text-[13px]" onClick={() => onExtend(window.id, 30)}>+30m</Button>
              <Button variant="outline" className="h-9 rounded-lg px-3 text-[13px]" onClick={() => onExtend(window.id, 60)}>+1h</Button>
              <Button variant="outline" className="h-9 rounded-lg px-3 text-[13px]" onClick={() => onEndNow(window.id)}>End now</Button>
            </>
          )}
          <Link href={`/maintenance-windows/${window.id}`} className="inline-flex h-9 items-center rounded-lg border border-input bg-card px-3 text-[13px] font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open full page</Link>
          <Link href={`/maintenance-windows/${window.id}/edit`} className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Edit</Link>
          <button type="button" onClick={() => onCancel(window.id)} className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg px-3 text-[13px] font-semibold text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-red-500/10">Cancel window</button>
        </footer>
      </aside>
    </>,
    document.body,
  );
}
