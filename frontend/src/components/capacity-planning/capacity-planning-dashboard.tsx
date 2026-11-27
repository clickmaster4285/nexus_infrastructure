"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BellOff, Bookmark, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, Copy, Database, Download, FileJson, FileText, FileSpreadsheet, Filter,
  Flame, Gauge, GitBranch, HardDrive, Layers3, Menu, Monitor, MoreHorizontal, Network, PiggyBank, Plug, Plus,
  RefreshCw, Search, Server, ShieldAlert, TrendingUp, Trash2, X, Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Panel } from "@/components/shared/panel";
import { ViewAllLink } from "@/components/shared/view-all-link";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TechLogo } from "@/components/shared/icon";
import { cn } from "@/lib/utils";
import {
  capacityResources, createCapacityPlan, createForecastAlertRule, deleteCapacityPlans, daysToThreshold,
  dismissRecommendation, loadCapacityData, readCapacityPlans, readScenarios, recordPlanDecision,
  resourceForecast, restoreRecommendation,
  type CapacityPlan, type CapacityResource, type ForecastMethod, type RiskLevel, type Scenario,
} from "@/mocks/capacityPlanning";
import { ForecastChart, ForecastAccuracyChip, ConfidenceBadge, type ScenarioOverlay } from "@/components/capacity-planning/forecast-chart";
import { ScenarioBuilderDialog, type ScenarioBuilderResult } from "@/components/capacity-planning/scenario-builder-dialog";
import { NewCapacityPlanDialog, ForecastAlertDialog, type PlanPrefill } from "@/components/capacity-planning/plan-dialog";

const DAY_MS = 86_400_000;
const now = () => Date.now();
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const fmtDay = fmtDate;
const fmtDayYear = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const fmtValue = (resource: CapacityResource, value: number) => `${value.toFixed(resource.metric === "Storage TB" ? 1 : resource.metric === "Storage GB" ? 0 : 1)}${resource.metric.includes("%") ? "%" : resource.metric === "Storage TB" ? " TB" : resource.metric === "Storage GB" ? " GB" : ""}`;
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const METRIC_TABS = [
  { value: "all", label: "All", match: (_: string) => true },
  { value: "cpu", label: "CPU", match: (m: string) => m === "CPU %" },
  { value: "memory", label: "Memory", match: (m: string) => m === "Memory %" },
  { value: "disk", label: "Disk", match: (m: string) => m === "Disk %" },
  { value: "storage", label: "Storage", match: (m: string) => m.startsWith("Storage") },
  { value: "network", label: "Network", match: (m: string) => m === "Bandwidth %" },
  { value: "connections", label: "Connections", match: (m: string) => m === "Connections" },
] as const;
const TYPE_FILTERS = ["All types", "Server", "Storage Pool", "Database", "Network Link", "Cluster"] as const;
const RISK_META: Record<RiskLevel, { label: string; badge: string; stripe: string; icon: typeof AlertTriangle }> = {
  at_risk: { label: "At risk", badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300", stripe: "bg-red-500", icon: Flame },
  watch: { label: "Watch", badge: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300", stripe: "bg-amber-400", icon: AlertTriangle },
  healthy: { label: "Healthy", badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300", stripe: "bg-emerald-500", icon: CheckCircle2 },
  stable: { label: "Stable", badge: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300", stripe: "bg-slate-300", icon: Gauge },
};
const statusTone: Record<CapacityPlan["status"], "destructive" | "warning" | "success" | "secondary" | "outline"> = {
  Proposed: "secondary", Approved: "success", "In progress": "warning", Done: "outline", Rejected: "destructive",
};
const TYPE_ICON: Record<CapacityResource["type"], typeof Server> = {
  Server: Server, "Storage Pool": HardDrive, Database: Database, "Network Link": Network, Cluster: Layers3,
};

function Sparkline({ values, stroke, className }: { values: number[]; stroke: string; className?: string }) {
  const width = 60, height = 20, min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const step = width / Math.max(1, values.length - 1);
  const path = values.map((value, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)},${(height - 2 - ((value - min) / range) * (height - 4)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("h-5 w-[60px]", className)} aria-hidden="true">
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const riskRank: Record<RiskLevel, number> = { at_risk: 0, watch: 1, healthy: 2, stable: 3 };

const SAVED_VIEWS_KEY = "capacitySavedViews";

interface SavedView { name: string; tab: string; metric: string; group: string; confidence: string }

export function CapacityPlanningDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const setParam = useCallback((key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value == null || value === "") next.delete(key); else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [params, pathname, router]);

  const [resources, setResources] = useState<CapacityResource[] | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const attemptRef = useRef(0);
  const reload = useCallback(() => {
    attemptRef.current += 1;
    setLoadState("loading");
    loadCapacityData().then((result) => { setResources(result.resources); setLoadState("ready"); }).catch(() => setLoadState("error"));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  // URL-synced controls
  const metric = params.get("metric") ?? "storage";
  const horizon = (Number(params.get("horizon") ?? 90) as 30 | 60 | 90 | 180);
  const tab = params.get("tab") ?? "all";
  const selectedId = params.get("resource") ?? "CR-POOL-S3";
  const typeFilter = params.get("type") ?? "All types";
  const groupFilter = params.get("group") ?? "All groups";
  const confidenceFilter = params.get("confidence") ?? "All";
  const search = params.get("q") ?? "";
  const sort = (params.get("sort") ?? "days") as "days" | "growth" | "current";
  const compact = params.get("compact") === "1";
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  useEffect(() => {
    try { setSavedViews(JSON.parse(window.localStorage.getItem(SAVED_VIEWS_KEY) ?? "[]") as SavedView[]); } catch { setSavedViews([]); }
  }, []);

  const [method, setMethod] = useState<ForecastMethod>("auto");
  const [historyDays, setHistoryDays] = useState<30 | 90 | 365>(90);
  const [scenarioOverlay, setScenarioOverlay] = useState<ScenarioOverlay | null>(null);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planPrefill, setPlanPrefill] = useState<PlanPrefill | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [recFilter, setRecFilter] = useState<"All" | "Urgent" | "Savings">("All");
  const [dismissedTick, setDismissedTick] = useState(0);
  const [notice, setNotice] = useState("");
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const toastTimer = useRef<number | null>(null);
  const toast = useCallback((message: string) => { setNotice(message); if (toastTimer.current) window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setNotice(""), 2800); }, []);

  const [plans, setPlans] = useState<CapacityPlan[]>(() => readCapacityPlans());
  const [scenarios, setScenarios] = useState<Scenario[]>(() => readScenarios());
  const [planDetail, setPlanDetail] = useState<CapacityPlan | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const forecasts = useMemo(() => (resources ?? []).map((resource) => ({ resource, forecast: resourceForecast(resource, "auto") })), [resources]);

  const summary = useMemo(() => {
    const atRisk = forecasts.filter((entry) => entry.forecast.risk === "at_risk");
    const watch = forecasts.filter((entry) => entry.forecast.risk === "watch");
    const healthy = forecasts.filter((entry) => entry.forecast.risk === "healthy");
    const withDays = forecasts.filter((entry) => Number.isFinite(entry.forecast.daysToCrit));
    const earliest = withDays.length ? withDays.reduce((best, entry) => (entry.forecast.daysToCrit < best.forecast.daysToCrit ? entry : best)) : null;
    const percentForecasts = forecasts.filter((entry) => entry.resource.metric.includes("%"));
    const headroom = Math.round(percentForecasts.reduce((acc, entry) => acc + (100 - entry.resource.p95), 0) / Math.max(1, percentForecasts.length));
    const mapeAvg = Math.round(forecasts.reduce((acc, entry) => acc + entry.forecast.mape, 0) / Math.max(1, forecasts.length));
    const growth30d = Math.round((percentForecasts.reduce((acc, entry) => acc + (entry.forecast.slopePerDay * 30 * 100) / Math.max(1, entry.resource.current), 0) / Math.max(1, percentForecasts.length)) * 10) / 10;
    const overprovisioned = forecasts.filter((entry) => entry.resource.metric === "CPU %" && entry.resource.current < 20 && entry.resource.p95 < 20);
    const savings = overprovisioned.reduce((acc, entry) => acc + Math.abs(entry.resource.estimatedCost ?? 0), 0);
    return { atRisk, watch, healthy, earliest, headroom, mapeAvg, growth30d, overprovisioned, savings, total: forecasts.length };
  }, [forecasts]);

  const selectedResource = useMemo(() => resources?.find((resource) => resource.id === selectedId) ?? resources?.[0] ?? null, [resources, selectedId]);
  const selectedForecast = selectedResource ? resourceForecast(selectedResource, method) : null;
  const scenarioOverlayPoints = useMemo(() => {
    if (!scenarioOverlay || !selectedResource) return scenarioOverlay;
    // Rebuild overlay against the currently selected resource's horizon.
    return scenarioOverlay;
  }, [scenarioOverlay, selectedResource]);

  // Table model
  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const metricMatch = METRIC_TABS.find((entry) => entry.value === metric)?.match;
    let rows = forecasts.filter((entry) => {
      if (tab === "at_risk" && entry.forecast.risk !== "at_risk") return false;
      if (tab === "watch" && entry.forecast.risk !== "watch") return false;
      if (tab === "healthy" && entry.forecast.risk !== "healthy") return false;
      if (tab === "overprovisioned" && !(entry.resource.metric === "CPU %" && entry.resource.current < 20 && entry.resource.p95 < 20)) return false;
      if (metric !== "all" && metricMatch && !metricMatch(entry.resource.metric)) return false;
      if (typeFilter !== "All types" && entry.resource.type !== typeFilter) return false;
      if (groupFilter !== "All groups" && entry.resource.group !== groupFilter) return false;
      if (confidenceFilter !== "All" && entry.forecast.confidence !== confidenceFilter.toLowerCase()) return false;
      if (q && !`${entry.resource.name} ${entry.resource.group} ${entry.resource.site} ${entry.resource.metric}`.toLowerCase().includes(q)) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => sort === "current" ? b.resource.current - a.resource.current : sort === "growth" ? b.resource.growthPerWeek - a.resource.growthPerWeek : a.forecast.daysToCrit - b.forecast.daysToCrit);
    return rows;
  }, [forecasts, tab, metric, typeFilter, groupFilter, confidenceFilter, search, sort]);

  const groups = useMemo(() => ["All groups", ...new Set((resources ?? []).map((resource) => resource.group))], [resources]);
  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageStart = (clampedPage - 1) * pageSize;
  const pageRows = tableRows.slice(pageStart, pageStart + pageSize);
  useEffect(() => { setPage(1); }, [tab, metric, typeFilter, groupFilter, confidenceFilter, search, pageSize]);

  const toggleSelect = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleSelectAll = () => {
    const visibleIds = pageRows.map((entry) => entry.resource.id);
    const allVisible = visibleIds.every((id) => selectedIds.includes(id)) && visibleIds.length > 0;
    setSelectedIds((current) => allVisible ? current.filter((id) => !visibleIds.includes(id)) : [...new Set([...current, ...visibleIds])]);
  };

  const plansByResource = useMemo(() => {
    const map = new Map<string, CapacityPlan>();
    plans.forEach((plan) => { if (plan.resourceId && !map.has(plan.resourceId)) map.set(plan.resourceId, plan); });
    return map;
  }, [plans]);

  const openPlan = useCallback((prefill: PlanPrefill | null) => { setPlanPrefill(prefill); setPlanOpen(true); }, []);
  const prefillFor = useCallback((resource: CapacityResource): PlanPrefill => {
    const forecast = resourceForecast(resource, "auto");
    const days = Number.isFinite(forecast.daysToCrit) ? Math.round(forecast.daysToCrit) : 30;
    return {
      resourceId: resource.id,
      action: resource.recommendedAction === "Add capacity" ? "Add server" : resource.recommendedAction === "Investigate" ? "Cleanup" : resource.recommendedAction === "Right-size" ? "Right-size" : resource.recommendedAction === "Migrate" ? "Migrate" : resource.recommendedAction === "Expand storage" ? "Expand storage" : "Cleanup",
      title: resource.recommendedDetail,
      estimatedCost: resource.estimatedCost ?? 0,
      targetDate: fmtDate(now() + Math.min(20, Math.max(7, Math.round(days * 0.6))) * DAY_MS),
      orderByDate: forecast.orderByDate ? fmtDate(Date.parse(forecast.orderByDate)) : fmtDate(now() + 28 * DAY_MS),
    };
  }, []);

  const recRows = useMemo(() => {
    const rows: Array<{
      id: string; resource: CapacityResource; priority: "Urgent" | "High" | "Medium" | "Low";
      title: string; reason: string; impact: string; effort: "S" | "M" | "L"; cost: number | null; saving: boolean;
    }> = [];
    forecasts.forEach(({ resource, forecast }) => {
      const overprovisioned = resource.metric === "CPU %" && resource.current < 20 && resource.p95 < 20;
      if (overprovisioned) {
        rows.push({ id: `rec-${resource.id}`, resource, priority: "Low", title: resource.recommendedDetail, reason: `Avg ${resource.current.toFixed(1)}% CPU · p95 ${resource.p95.toFixed(1)}%`, impact: "Savings", effort: resource.effort, cost: resource.estimatedCost, saving: true });
        return;
      }
      if (forecast.risk === "at_risk") {
        rows.push({ id: `rec-${resource.id}`, resource, priority: "Urgent", title: resource.recommendedDetail, reason: `${resource.metric}: hits crit ${Number.isFinite(forecast.daysToCrit) ? `~${Math.round(forecast.daysToCrit)}d` : "—"} (est.)`, impact: `+${Math.round(Math.min(90, forecast.daysToCrit))}d headroom`, effort: resource.effort, cost: resource.estimatedCost, saving: false });
        return;
      }
      if (forecast.risk === "watch" && (resource.estimatedCost ?? 0) > 0) {
        rows.push({ id: `rec-${resource.id}`, resource, priority: "Medium", title: resource.recommendedDetail, reason: `${resource.metric}: crit in ~${Math.round(forecast.daysToCrit)}d (est.)`, impact: `+${Math.round(forecast.daysToCrit * 0.5)}d headroom`, effort: resource.effort, cost: resource.estimatedCost, saving: false });
      }
    });
    const order = { Urgent: 0, High: 1, Medium: 2, Low: 3 } as const;
    return rows.sort((a, b) => order[a.priority] - order[b.priority]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecasts, dismissedTick]);

  const visibleRecs = useMemo(() => recRows.filter((row) => {
    if (recFilter === "Urgent") return row.priority === "Urgent";
    if (recFilter === "Savings") return row.saving;
    return true;
  }).slice(0, 7), [recRows, recFilter]);

  const atRiskBanner = summary.earliest;
  const fmtSector = (value: number) => `${Math.round(value)}%`;

  const exportData = (format: "pdf" | "csv" | "json") => {
    const snapshot = { generatedAt: new Date().toISOString(), summary: { atRisk: summary.atRisk.length, watch: summary.watch.length, earliest: summary.earliest?.resource.name ?? null, headroom: summary.headroom, mapeAvg: summary.mapeAvg }, resources: tableRows.map(({ resource, forecast }) => ({ id: resource.id, name: resource.name, metric: resource.metric, current: resource.current, p95: resource.p95, perWeek: resource.growthPerWeek, daysToCrit: Number.isFinite(forecast.daysToCrit) ? Math.round(forecast.daysToCrit) : null, risk: forecast.risk, confidence: forecast.confidence })) };
    let blob: Blob;
    let name: string;
    if (format === "json") { blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }); name = "capacity-report.json"; }
    else if (format === "csv") {
      const rows = snapshot.resources.map((row) => [row.id, row.name, row.metric, row.current, row.p95, row.perWeek, row.daysToCrit ?? "", row.risk, row.confidence].join(","));
      blob = new Blob([["id,name,metric,current,p95,growthPerWeek,daysToCrit,risk,confidence", ...rows].join("\n")], { type: "text/csv" });
      name = "capacity-report.csv";
    } else {
      blob = new Blob([`Capacity Planning & Forecasting — ${fmtDayYear(now())}\nResources at risk: ${summary.atRisk.length}\nEarliest exhaustion: ${summary.earliest?.resource.name ?? "none"} (~${summary.earliest ? Math.round(summary.earliest.forecast.daysToCrit) : 0}d est.)\n\n` + snapshot.resources.map((row) => `${row.name} (${row.metric}) — ${row.current} → ${row.daysToCrit ?? "stable"}d`).join("\n")], { type: "text/plain" });
      name = "capacity-report.txt";
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
    toast(`Exported ${format.toUpperCase()} report`);
  };

  const applyScenarioToChart = (result: ScenarioBuilderResult) => {
    if (!selectedResource) return;
    const baseSlope = selectedResource.growthPerWeek / 7;
    const adjusted = Math.max(0, baseSlope * (1 + result.growthPct / 100 + result.workloadShiftPct / 100));
    const relief = result.addCapacity > 0 ? Math.min(selectedResource.current, (result.addCapacity / selectedResource.capacity) * 100) : 0;
    const startCurrent = selectedResource.current - relief;
    const points = Array.from({ length: 181 }, (_, i) => ({ day: new Date(now() + i * DAY_MS).toISOString(), value: Math.max(0, startCurrent + adjusted * i) }));
    setScenarioOverlay({ points, label: `Scenario · ${result.name}` });
    toast("Scenario applied to chart");
  };

  const createPlanFromScenario = (result: ScenarioBuilderResult) => {
    setPlanPrefill({
      resourceId: selectedResource!.id,
      action: "Expand storage",
      title: result.name,
      estimatedCost: result.estimatedCost,
      targetDate: fmtDate(now() + 14 * DAY_MS),
      orderByDate: fmtDate(now() + 7 * DAY_MS),
    });
    setPlanOpen(true);
  };

  const bulkCreatePlans = () => {
    const created: string[] = [];
    selectedIds.forEach((id) => {
      const resource = capacityResources.find((item) => item.id === id);
      if (!resource) return;
      const prefill = prefillFor(resource);
      const plan = createCapacityPlan({
        title: prefill.title, resourceId: resource.id, resourceName: resource.name,
        action: prefill.action, status: "Proposed", owner: "Ayesha Khan",
        targetDate: new Date().toISOString(), orderByDate: new Date().toISOString(),
        estimatedCost: prefill.estimatedCost, changeTicket: null, maintenanceWindowId: null, notes: "Bulk-created from the at-risk table.",
      });
      created.push(plan.id);
    });
    setPlans(readCapacityPlans());
    setSelectedIds([]);
    toast(`${created.length} plan${created.length === 1 ? "" : "s"} proposed — see Capacity Plans`);
  };
  const bulkExport = () => {
    const rows = tableRows.filter((entry) => selectedIds.includes(entry.resource.id)).map(({ resource, forecast }) => [resource.id, resource.name, resource.metric, resource.current, resource.p95, Number.isFinite(forecast.daysToCrit) ? Math.round(forecast.daysToCrit) : "", forecast.risk].join(","));
    const blob = new Blob([["id,name,metric,current,p95,daysToCrit,risk", ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "capacity-selection.csv"; anchor.click(); URL.revokeObjectURL(url);
    toast(`Exported ${rows.length} rows`);
  };
  const bulkCreateAlerts = () => {
    let count = 0;
    selectedIds.slice(0, 5).forEach((id) => {
      const resource = capacityResources.find((item) => item.id === id);
      if (!resource) return;
      createForecastAlertRule({ resourceName: resource.name, metric: resource.metric, threshold: 85, windowDays: 14, severity: "Warning" });
      count += 1;
    });
    toast(`${count} forecast alert${count === 1 ? "" : "s"} created in Alert Rules`);
  };

  const copyLink = (resourceId: string) => {
    const url = `${window.location.origin}/monitoring/capacity-planning/${resourceId}`;
    void navigator.clipboard?.writeText(url);
    toast("Link copied to clipboard");
  };

  const saveCurrentView = useCallback(() => {
    try {
      const name = window.prompt("Name this view", "Capacity view");
      if (!name) return;
      const views = [...savedViews, { name, tab, metric, group: groupFilter, confidence: confidenceFilter }];
      window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
      setSavedViews(views);
      toast(`Saved view "${name}"`);
    } catch { toast("Couldn't save view (storage unavailable)"); }
  }, [savedViews, tab, metric, groupFilter, confidenceFilter, toast]);

  const applySavedView = (view: SavedView) => {
    setParam("tab", view.tab === "all" ? null : view.tab);
    setParam("metric", view.metric === "all" ? null : view.metric);
    setParam("group", view.group === "All groups" ? null : view.group);
    setParam("confidence", view.confidence === "All" ? null : view.confidence);
    toast(`Applied view "${view.name}"`);
  };

  const formattedUpdated = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(lastUpdated);

  if (loadState === "error") {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Monitoring", "Capacity Planning"]} title="Capacity Planning & Forecasting" subtitle="Predict when resources run out, test what-if scenarios and plan upgrades before it hurts." demo lastUpdated={undefined} showRefresh={false} />
        <div className="grid min-h-64 place-items-center rounded-xl border border-border bg-card p-8 text-center">
          <div className="max-w-sm space-y-3">
            <ShieldAlert size={28} className="mx-auto text-amber-600" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">Couldn&apos;t load capacity data</p>
            <p className="text-[0.8125rem] text-muted-foreground">The demo feed didn&apos;t respond. Retry the load — if you meant to test the error state, remove <code className="rounded bg-muted px-1">?capacityError=1</code> from the URL.</p>
            <Button onClick={reload}><RefreshCw size={15} />Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  const bannerAtRisk = atRiskBanner && Number.isFinite(atRiskBanner.forecast.daysToCrit) ? atRiskBanner : null;

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Monitoring", "Capacity Planning"]}
        title="Capacity Planning & Forecasting"
        subtitle="Predict when resources run out, test what-if scenarios and plan upgrades before it hurts."
        demo
        lastUpdated={formattedUpdated}
        onRefresh={() => { setLastUpdated(new Date()); reload(); toast("Refreshed from the demo capacity feed"); }}
        actions={
          <>
            <div className="relative">
              <Button variant="outline" className="h-10" onClick={() => setExportOpen((value) => !value)} aria-haspopup="menu" aria-expanded={exportOpen}><Download size={15} />Export Report<ChevronDown size={14} /></Button>
              {exportOpen && (
                <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-border bg-popover p-1.5 text-sm shadow-lg" role="menu">
                  {[["pdf", "PDF summary", FileText], ["csv", "CSV spreadsheet", FileSpreadsheet], ["json", "JSON payload", FileJson]].map(([format, label, Icon]) => (
                    <button key={format as string} role="menuitem" type="button" onClick={() => exportData(format as "pdf" | "csv" | "json")} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-accent">
                      <Icon size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />{label as string}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button className="h-10" onClick={() => openPlan(null)}><Plus size={15} />New Capacity Plan</Button>
          </>
        }
      />

      {/* ---- Risk banner ---- */}
      {bannerAtRisk ? (
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-[0.8125rem] text-amber-900 dark:text-amber-200" role="alert">
          <span className="flex min-w-0 items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
            <span className="truncate"><b>{summary.atRisk.length} resource{summary.atRisk.length === 1 ? "" : "s"} predicted to hit threshold within 30 days</b> · earliest: {bannerAtRisk.resource.name} in ~{Math.round(bannerAtRisk.forecast.daysToCrit)} days (est.)</span>
          </span>
          <button type="button" className="font-semibold underline underline-offset-2 hover:opacity-80" onClick={() => setParam("tab", "at_risk")}>View at-risk</button>
        </div>
      ) : (
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-[0.8125rem] text-emerald-800 dark:text-emerald-300" role="status">
          <span className="flex items-center gap-2"><CheckCircle2 size={16} aria-hidden="true" /><b>No resources at risk in the next 90 days</b></span>
        </div>
      )}

      {/* ---- Stat cards ---- */}
      <section aria-label="Capacity key metrics" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Resources at Risk (30d)" value={String(summary.atRisk.length)} goodDirection="down" icon={<Flame size={19} />} iconTone="bg-red-500/10 text-red-600" onClick={() => setParam("tab", "at_risk")} trend={<span className="text-xs text-muted-foreground">{summary.atRisk.length ? summary.atRisk.map((entry) => entry.resource.name.split(" · ")[0]).join(", ") : "All clear"}</span>} />
        <StatCard label="Earliest Exhaustion" value={summary.earliest ? `~${Math.round(summary.earliest.forecast.daysToCrit)}d` : "None"} goodDirection="up" icon={<Activity size={19} />} iconTone="bg-red-500/10 text-red-600" onClick={() => setParam("tab", "at_risk")} trend={<span className="text-xs text-muted-foreground">{summary.earliest ? summary.earliest.resource.name : "No threshold found"} · est.</span>} />
        <StatCard label="Avg Headroom (P95)" value={`${summary.headroom}%`} goodDirection="up" icon={<Gauge size={19} />} iconTone="bg-emerald-500/10 text-emerald-600" onClick={() => setParam("tab", "all")} />
        <StatCard label="Overprovisioned" value={String(summary.overprovisioned.length)} goodDirection="down" icon={<PiggyBank size={19} />} iconTone="bg-violet-500/10 text-violet-600" onClick={() => setParam("tab", "overprovisioned")} trend={<span className="text-xs text-muted-foreground">est. savings ${summary.savings}/mo</span>} />
        <StatCard label="Forecast Accuracy" value={`${100 - summary.mapeAvg}%`} goodDirection="up" icon={<Zap size={19} />} iconTone="bg-sky-500/10 text-sky-600" onClick={() => setParam("metric", "all")} trend={<span className="text-xs text-muted-foreground">backtest MAPE {summary.mapeAvg}%</span>} />
        <StatCard label="Projected Growth (30d)" value={`${summary.growth30d >= 0 ? "+" : ""}${summary.growth30d}%`} goodDirection="down" icon={<TrendingUp size={19} />} iconTone="bg-amber-500/10 text-amber-600" onClick={() => setParam("sort", "growth")} trend={<span className="text-xs text-muted-foreground">fleet util. avg</span>} />
      </section>

      {/* ---- Workspace + recommendations ---- */}
      <section aria-label="Forecast workspace" className="grid items-stretch gap-4 xl:grid-cols-12">
        <Panel
          className="p-4 xl:col-span-8"
          headerClassName="h-10"
          showOptions={false}
          title={<span className="flex items-center gap-2 text-[1rem] font-semibold leading-6 text-foreground"><TrendingUp size={17} aria-hidden="true" />Forecast</span>}
        >
          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2.5">
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Metric family">
              {METRIC_TABS.map((entry) => (
                <button key={entry.value} role="tab" aria-selected={metric === entry.value} onClick={() => setParam("metric", entry.value)} className={cn("min-h-8 rounded-lg px-2.5 text-[0.75rem] font-medium text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", metric === entry.value && "bg-primary/10 text-primary")}>{entry.label}</button>
              ))}
            </div>
            <div className="h-5 w-px bg-border" aria-hidden="true" />
            <Select value={selectedResource?.id} onValueChange={(value) => setParam("resource", value)}>
              <SelectTrigger className="h-9 w-44 text-[0.75rem]" aria-label="Resource"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">{(resources ?? []).map((resource) => <SelectItem key={resource.id} value={resource.id}>{resource.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex items-center gap-1" role="group" aria-label="History window">
              {[{ v: 30, l: "30D" }, { v: 90, l: "90D" }, { v: 365, l: "1Y" }].map((entry) => (
                <button key={entry.v} onClick={() => setHistoryDays(entry.v as 30 | 90 | 365)} aria-pressed={historyDays === entry.v} className={cn("h-8 rounded-lg border border-transparent px-2 text-[0.75rem] font-medium text-muted-foreground hover:bg-accent", historyDays === entry.v && "border-primary/30 bg-primary/10 text-primary")}>{entry.l}</button>
              ))}
            </div>
            <div className="flex items-center gap-1" role="group" aria-label="Forecast horizon">
              {[30, 60, 90, 180].map((days) => (
                <button key={days} onClick={() => setParam("horizon", String(days))} aria-pressed={horizon === days} className={cn("h-8 rounded-lg border border-transparent px-2 text-[0.75rem] font-medium text-muted-foreground hover:bg-accent", horizon === days && "border-primary/30 bg-primary/10 text-primary")}>{days}D</button>
              ))}
            </div>
            <Select value={method} onValueChange={(value) => setMethod(value as ForecastMethod)}>
              <SelectTrigger className="h-9 w-24 text-[0.75rem]" aria-label="Forecast method"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="seasonal">Seasonal</SelectItem>
              </SelectContent>
            </Select>
            {selectedForecast && <ForecastAccuracyChip slopePerDay={selectedForecast.slopePerDay} r2={selectedForecast.r2} mape={selectedForecast.mape} method={selectedForecast.method} />}
            <button type="button" onClick={() => setScenarioOpen(true)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[0.75rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", scenarioOverlay ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300" : "border-border text-muted-foreground hover:text-foreground")} aria-pressed={scenarioOverlay != null}>
              <GitBranch size={13} aria-hidden="true" />Scenario
            </button>
          </div>

          {selectedForecast?.confidence === "low" && (
            <p className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[0.75rem] font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"><AlertTriangle size={14} aria-hidden="true" />Indicative only — limited history or weak fit (R² {selectedForecast.r2.toFixed(2)}). Confirm with raw metrics before acting.</p>
          )}

          {selectedResource && selectedForecast ? (
            <ForecastChart
              resource={selectedResource}
              horizonDays={horizon}
              method={method}
              historyDays={historyDays}
              scenarioOverlay={scenarioOverlay}
              className="mt-2 min-h-[360px] flex-1"
            />
          ) : (
            <div className="grid min-h-[360px] flex-1 place-items-center text-sm text-muted-foreground">Select a resource to forecast.</div>
          )}

          {scenarioOverlay && (
            <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[0.75rem] text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300">
              <span className="flex min-w-0 items-center gap-2"><GitBranch size={13} aria-hidden="true" /><span className="truncate">Overlay: {scenarioOverlay.label}</span></span>
              <button type="button" className="shrink-0 rounded-md px-1.5 py-1 font-medium hover:bg-violet-100 dark:hover:bg-violet-900/40" onClick={() => setScenarioOverlay(null)} aria-label="Remove scenario overlay"><X size={13} /></button>
            </div>
          )}

          {selectedResource && selectedForecast && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Forecast summary">
              {[
                { label: "Current", value: fmtValue(selectedResource, selectedForecast.current) },
                { label: "P95 peak", value: fmtValue(selectedResource, selectedResource.p95) },
                { label: "Growth", value: `${selectedResource.growthPerWeek >= 0 ? "+" : ""}${selectedResource.growthPerWeek.toFixed(2)}/wk` },
                { label: "Days to threshold", value: Number.isFinite(selectedForecast.daysToCrit) ? `${Math.round(selectedForecast.daysToCrit)}d est.` : "No exhaustion" },
              ].map((tile) => (
                <div key={tile.label} className="rounded-lg bg-muted/50 px-2.5 py-2">
                  <span className="block text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">{tile.label}</span>
                  <b className="mt-0.5 block text-[0.9375rem] tabular-nums text-foreground">{tile.value}</b>
                </div>
              ))}
              <div className="rounded-lg bg-muted/50 px-2.5 py-2">
                <span className="block text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">Confidence</span>
                <span className="mt-1 inline-flex"><ConfidenceBadge level={selectedForecast.confidence} /></span>
              </div>
            </div>
          )}
        </Panel>

        {/* Recommendations */}
        <Panel
          className="flex flex-col p-4 xl:col-span-4"
          headerClassName="h-10"
          showOptions={false}
          title={<span className="flex items-center gap-2 text-[1rem] font-semibold leading-6 text-foreground">Recommendations<Badge variant="secondary" className="text-[0.625rem]">{visibleRecs.length}</Badge></span>}
          action={
            <div className="flex items-center gap-1" role="group" aria-label="Filter recommendations">
              {(["All", "Urgent", "Savings"] as const).map((filter) => (
                <button key={filter} onClick={() => setRecFilter(filter)} aria-pressed={recFilter === filter} className={cn("h-8 rounded-lg px-2.5 text-[0.75rem] font-medium text-muted-foreground hover:bg-accent", recFilter === filter && "bg-primary/10 text-primary")}>{filter}</button>
              ))}
            </div>
          }
        >
          <ul className="mt-1 min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
            {visibleRecs.length === 0 && <li className="py-8 text-center text-[0.8125rem] text-muted-foreground">No recommendations match this filter.</li>}
            {visibleRecs.map((rec) => {
              const priorityTone = rec.priority === "Urgent" ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300" : rec.priority === "High" ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300" : rec.priority === "Medium" ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300" : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
              return (
                <li key={rec.id} className="flex flex-col gap-1.5 py-2.5">
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-0.5 inline-flex h-5 shrink-0 items-center rounded border px-1.5 text-[0.625rem] font-bold uppercase", priorityTone)}>{rec.priority}</span>
                    <div className="min-w-0 flex-1">
                      <b className="block text-[0.8125rem] leading-5 text-foreground">{rec.title}</b>
                      <span className="mt-0.5 block text-[0.75rem] text-muted-foreground">{rec.reason}</span>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.625rem] font-medium text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5">{rec.impact}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5">Effort {rec.effort}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5">{rec.cost == null ? "—" : rec.cost < 0 ? `saves $${Math.abs(rec.cost)}/mo` : `$${rec.cost}/mo`}</span>
                      </div>
                    </div>
                    <button type="button" aria-label={`Dismiss recommendation: ${rec.title}`} title="Dismiss" onClick={() => { dismissRecommendation(rec.id, "Not actionable right now"); setDismissedTick((value) => value + 1); toast("Recommendation dismissed"); }} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X size={14} /></button>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    <Button variant="outline" className="h-7 px-2.5 text-[0.75rem]" onClick={() => openPlan(prefillFor(rec.resource))}>Create plan</Button>
                    <Link href={`/monitoring/capacity-planning/${rec.resource.id}`} className="text-[0.75rem] font-medium text-primary hover:underline">View resource →</Link>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
            <span className="text-[0.6875rem] text-muted-foreground">Recommendations are estimates.</span>
            <ViewAllLink label="View all" href="/monitoring/capacity-planning?tab=at_risk" />
          </div>
        </Panel>
      </section>

      {/* ---- Insights row ---- */}
      <section aria-label="Capacity insights" className="grid items-stretch gap-4 xl:grid-cols-3">
        <Panel title={<span className="text-[1rem] font-semibold text-foreground">Headroom by Resource Type</span>} className="p-4" headerClassName="h-10" showOptions={false}>
          <ul className="mt-1 flex flex-1 flex-col justify-between divide-y divide-border/60">
            {([
              { label: "CPU", match: "cpu", metric: "CPU %" },
              { label: "Memory", match: "memory", metric: "Memory %" },
              { label: "Storage", match: "storage", metric: "Storage" },
              { label: "Network", match: "network", metric: "Bandwidth %" },
            ] as const).map((row) => {
              const entries = forecasts.filter((entry) => row.metric.startsWith("Storage") ? entry.resource.metric.startsWith("Storage") : entry.resource.metric === row.metric);
              if (entries.length === 0) return null;
              const avg = Math.round(entries.reduce((acc, entry) => acc + entry.resource.avg, 0) / entries.length);
              const p95 = Math.round(entries.reduce((acc, entry) => acc + entry.resource.p95, 0) / entries.length);
              const free = Math.max(0, 100 - p95);
              const withDays = entries.filter((entry) => Number.isFinite(entry.forecast.daysToCrit));
              const minDays = withDays.length ? Math.min(...withDays.map((entry) => entry.forecast.daysToCrit)) : Infinity;
              return (
                <li key={row.label}>
                  <button type="button" onClick={() => setParam("metric", row.match)} className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open ${row.label} forecast in workspace`}>
                    <span className="w-16 shrink-0 text-[0.8125rem] font-medium text-foreground">{row.label}</span>
                    <span className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p95} aria-valuemin={0} aria-valuemax={100} aria-label={`${row.label} average ${avg}%, p95 ${p95}%`}>
                      <span className="h-full bg-blue-500" style={{ width: `${avg}%` }} />
                      <span className="h-full bg-amber-400" style={{ width: `${Math.max(0, p95 - avg)}%` }} />
                    </span>
                    <span className="w-12 shrink-0 text-right text-[0.75rem] tabular-nums text-muted-foreground">{avg}%</span>
                    <span className={cn("w-14 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[0.6875rem] font-semibold", Number.isFinite(minDays) && minDays <= 30 ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" : Number.isFinite(minDays) && minDays <= 90 ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300")}>{Number.isFinite(minDays) ? `${Math.round(minDays)}d` : "stable"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 border-t border-border pt-2 text-[0.75rem] text-muted-foreground">Bar: <i className="inline-block h-2 w-3 rounded-sm bg-blue-500 align-middle" /> avg · <i className="inline-block h-2 w-3 rounded-sm bg-amber-400 align-middle" /> p95 peak. Chip = earliest crit.</p>
        </Panel>

        <Panel title={<span className="text-[1rem] font-semibold text-foreground">Fastest Growing</span>} className="p-4" headerClassName="h-10" showOptions={false}>
          <ul className="mt-1 flex flex-1 flex-col divide-y divide-border/60">
            {[...forecasts]
              .filter((entry) => entry.resource.growthPerWeek > 0)
              .sort((a, b) => (b.resource.growthPerWeek / b.resource.capacity) - (a.resource.growthPerWeek / a.resource.capacity))
              .slice(0, 6)
              .map(({ resource }) => {
                const growth = resource.growthPerWeek >= 1 ? `${resource.growthPerWeek.toFixed(1)}/wk` : `${((resource.growthPerWeek / resource.capacity) * 100).toFixed(2)}%/wk`;
                const spark = resource.history.slice(-30).map((point) => point.value);
                return (
                  <li key={resource.id}>
                    <Link href={`/monitoring/capacity-planning/${resource.id}`} className="flex items-center gap-3 py-2 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">{(() => { const Icon = TYPE_ICON[resource.type]; return <Icon size={14} />; })()}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.8125rem] font-medium text-foreground" title={resource.name}>{resource.name}</span>
                        <span className="block text-[0.6875rem] text-muted-foreground">{resource.group} · {resource.metric}</span>
                      </span>
                      <Sparkline values={spark} stroke="oklch(0.6231 0.188 259.81)" />
                      <span className="w-20 shrink-0 text-right text-[0.8125rem] font-semibold tabular-nums text-foreground">+{growth}</span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </Panel>

        <Panel
          title={<span className="text-[1rem] font-semibold text-foreground">Savings Opportunities</span>}
          className="flex flex-col p-4"
          headerClassName="h-10"
          showOptions={false}
          action={<span className="text-[0.75rem] font-semibold text-emerald-700 dark:text-emerald-400">Est. savings ${summary.savings}/mo</span>}
        >
          <ul className="mt-1 flex-1 divide-y divide-border/60">
            {summary.overprovisioned.map(({ resource }) => (
              <li key={resource.id} className="flex items-center gap-3 py-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Server size={15} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-medium text-foreground" title={resource.name}>{resource.name}</span>
                  <span className="block text-[0.75rem] text-muted-foreground">avg {resource.current.toFixed(1)}% CPU · p95 {resource.p95.toFixed(1)}% · {resource.name.includes("worker-08") || resource.name.includes("worker-07") ? "4 vCPU → 2 vCPU" : "2 vCPU → 1 vCPU"}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[0.8125rem] font-bold tabular-nums text-emerald-700 dark:text-emerald-400">${Math.abs(resource.estimatedCost ?? 0)}/mo</span>
                  <button type="button" onClick={() => openPlan({ resourceId: resource.id, action: "Right-size", title: resource.recommendedDetail, estimatedCost: resource.estimatedCost ?? 0, targetDate: fmtDate(now() + 14 * DAY_MS), orderByDate: fmtDate(now() + 7 * DAY_MS) })} className="rounded-lg border border-border px-2 py-1 text-[0.6875rem] font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Right-size</button>
                </span>
              </li>
            ))}
            {summary.overprovisioned.length === 0 && <li className="py-6 text-center text-[0.8125rem] text-muted-foreground">No overprovisioned servers detected.</li>}
          </ul>
        </Panel>
      </section>

      {/* ---- At-risk table ---- */}
      <section aria-label="At-risk resources table">
        <Panel
          title={<span className="text-[1rem] font-semibold text-foreground">At-Risk Resources</span>}
          className="p-0"
          headerClassName="h-12 px-4 pt-1"
          showOptions={false}
          action={
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setParam("compact", compact ? null : "1")} aria-pressed={compact} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[0.75rem] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Menu size={13} aria-hidden="true" />{compact ? "Comfortable" : "Compact"}
              </button>
              <Select value={savedViews.length ? "" : "custom"} onValueChange={(value) => { const view = savedViews.find((v) => v.name === value); if (view) applySavedView(view); }}>
                <SelectTrigger className="h-8 w-40 text-[0.75rem]" aria-label="Saved views"><SelectValue placeholder="Saved views…" /></SelectTrigger>
                <SelectContent>
                  {savedViews.map((view) => <SelectItem key={view.name} value={view.name}>{view.name}</SelectItem>)}
                  <SelectItem value="custom">Custom (current)</SelectItem>
                </SelectContent>
              </Select>
              <button type="button" onClick={saveCurrentView} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[0.75rem] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title="Save current view to this browser"><Bookmark size={13} aria-hidden="true" />Save view</button>
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 pb-2.5">
            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Filter by risk">
              {([
                { value: "all", label: "All", count: tableRows.length === tableRows.length ? forecasts.length : 0 },
                { value: "at_risk", label: "At risk", count: summary.atRisk.length },
                { value: "watch", label: "Watch", count: summary.watch.length },
                { value: "healthy", label: "Healthy", count: summary.healthy.length },
                { value: "overprovisioned", label: "Overprovisioned", count: summary.overprovisioned.length },
              ] as const).map((entry) => (
                <button key={entry.value} role="tab" aria-selected={tab === entry.value} onClick={() => setParam("tab", entry.value === "all" ? null : entry.value)} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-[0.75rem] font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === entry.value && "bg-primary/10 text-primary")}>
                  {entry.label} ({entry.count})
                </button>
              ))}
            </div>
            <div className="relative ml-auto min-w-[12rem] flex-1 sm:w-64 sm:flex-none">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input value={search} onChange={(event) => setParam("q", event.target.value || null)} placeholder="Search resource, group…  ( / )" aria-label="Search resources" className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
            {TYPE_FILTERS.map((type) => (
              <button key={type} onClick={() => setParam("type", type === "All types" ? null : type)} aria-pressed={typeFilter === type} className={cn("h-8 rounded-full border border-transparent px-2.5 text-[0.75rem] font-medium text-muted-foreground hover:bg-accent", typeFilter === type && "border-primary/30 bg-primary/10 text-primary")}>{type}</button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
            <Select value={metric} onValueChange={(value) => setParam("metric", value === "all" ? null : value)}>
              <SelectTrigger className="h-8 w-32 text-[0.75rem]" aria-label="Metric"><SelectValue /></SelectTrigger>
              <SelectContent>{METRIC_TABS.map((entry) => <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={groupFilter} onValueChange={(value) => setParam("group", value === "All groups" ? null : value)}>
              <SelectTrigger className="h-8 w-36 text-[0.75rem]" aria-label="Group"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-56">{groups.map((group) => <SelectItem key={group} value={group}>{group}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={confidenceFilter} onValueChange={(value) => setParam("confidence", value === "All" ? null : value)}>
              <SelectTrigger className="h-8 w-32 text-[0.75rem]" aria-label="Confidence"><SelectValue /></SelectTrigger>
              <SelectContent>{["All", "High", "Medium", "Low"].map((value) => <SelectItem key={value} value={value}>{value === "All" ? "All confidence" : `${value} confidence`}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={sort} onValueChange={(value) => setParam("sort", value === "days" ? null : value)}>
              <SelectTrigger className="h-8 w-36 text-[0.75rem]" aria-label="Sort"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="days">Days to threshold</SelectItem>
                <SelectItem value="growth">Growth rate</SelectItem>
                <SelectItem value="current">Current value</SelectItem>
              </SelectContent>
            </Select>
            <button type="button" onClick={() => { setParam("tab", null); setParam("metric", null); setParam("type", null); setParam("group", null); setParam("confidence", null); setParam("q", null); setParam("sort", null); }} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[0.75rem] font-medium text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><RefreshCw size={13} aria-hidden="true" />Reset</button>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-primary/20 bg-primary/5 px-4 py-2 text-[0.75rem] font-medium text-foreground" role="status">
              <span className="tabular-nums">{selectedIds.length} selected</span>
              <Button variant="outline" className="h-7 px-2.5 text-[0.75rem]" onClick={bulkCreatePlans}>Create plans</Button>
              <Button variant="outline" className="h-7 px-2.5 text-[0.75rem]" onClick={bulkExport}>Export CSV</Button>
              <Button variant="outline" className="h-7 px-2.5 text-[0.75rem]" onClick={bulkCreateAlerts}>Create alerts</Button>
              <button type="button" onClick={() => setSelectedIds([])} className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[0.75rem] text-muted-foreground hover:text-foreground"><X size={13} aria-hidden="true" />Clear</button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-[13px]">
              <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
                <tr>
                  <th className="w-10 px-3 py-2.5"><input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={pageRows.length > 0 && pageRows.every((entry) => selectedIds.includes(entry.resource.id))} onChange={toggleSelectAll} aria-label="Select all rows on this page" /></th>
                  <th className="px-3 py-2.5 font-semibold">Resource</th>
                  <th className="px-3 py-2.5 font-semibold">Metric</th>
                  <th className="px-3 py-2.5 font-semibold">Current</th>
                  <th className="px-3 py-2.5 font-semibold">P95</th>
                  <th className="px-3 py-2.5 font-semibold">Growth</th>
                  <th className="px-3 py-2.5 font-semibold">Days to crit</th>
                  <th className="px-3 py-2.5 font-semibold">Exhaustion</th>
                  <th className="px-3 py-2.5 font-semibold">Order by</th>
                  <th className="px-3 py-2.5 font-semibold">Confidence</th>
                  <th className="px-3 py-2.5 font-semibold">Plan</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadState === "loading" ? (
                  Array.from({ length: 6 }, (_, index) => (
                    <tr key={index} className="border-t border-border"><td colSpan={12} className="px-3 py-3"><div className="h-6 animate-pulse rounded bg-muted" /></td></tr>
                  ))
                ) : pageRows.length === 0 ? (
                  <tr><td colSpan={12} className="px-3 py-10 text-center text-sm text-muted-foreground">No resources match these filters. <button type="button" className="ml-2 font-semibold text-primary hover:underline" onClick={() => { setParam("tab", null); setParam("q", null); setParam("type", null); setParam("group", null); setParam("confidence", null); }}>Reset filters</button></td></tr>
                ) : pageRows.map(({ resource, forecast }) => {
                  const plan = plansByResource.get(resource.id);
                  const days = forecast.daysToCrit;
                  const daysLabel = Number.isFinite(days) ? (days <= 0 ? "Now" : `${Math.round(days)}d (est.)`) : "No exhaustion";
                  const exhaustion = forecast.exhaustionDate ? fmtDayYear(Date.parse(forecast.exhaustionDate)) : "—";
                  const orderBy = forecast.orderByDate ? Date.parse(forecast.orderByDate) : null;
                  const orderOverdue = orderBy !== null && orderBy < now();
                  const risk = RISK_META[forecast.risk];
                  const rowLink = `/monitoring/capacity-planning/${resource.id}`;
                  return (
                    <tr
                      key={resource.id}
                      className={cn("h-14 cursor-pointer border-t border-l-[3px] border-border transition-colors hover:bg-muted/40", compact && "h-12 text-[12px]")}
                      style={{ borderLeftColor: forecast.risk === "at_risk" ? "#ef4444" : forecast.risk === "watch" ? "#f59e0b" : forecast.risk === "healthy" ? "#10b981" : "#cbd5e1" }}
                      onClick={(event) => { if (event.metaKey || event.ctrlKey) window.open(rowLink, "_blank", "noopener"); else router.push(rowLink); }}
                      tabIndex={0}
                      onKeyDown={(event) => { if (event.key === "Enter") router.push(rowLink); }}
                      aria-label={`Open ${resource.name}`}
                    >
                      <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(resource.id)} onChange={() => toggleSelect(resource.id)} aria-label={`Select ${resource.name}`} className="h-4 w-4 accent-[var(--primary)]" /></td>
                      <td className="px-3 py-2">
                        <span className="block max-w-[13rem] truncate font-semibold text-foreground" title={resource.name}>{resource.name}</span>
                        <span className="block text-[0.625rem] text-muted-foreground">{resource.group} · {resource.site}</span>
                      </td>
                      <td className="px-3 py-2"><Badge variant="outline" className="text-[0.625rem]">{resource.metric}</Badge></td>
                      <td className="px-3 py-2">
                        <span className="tabular-nums font-medium text-foreground">{fmtValue(resource, resource.current)}</span>
                        <span className="mt-1 block h-1.5 w-20 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full", resource.current >= 90 ? "bg-red-500" : resource.current >= 85 ? "bg-amber-500" : "bg-primary")} style={{ width: `${Math.min(100, resource.current)}%` }} /></span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{fmtValue(resource, resource.p95)}</td>
                      <td className="px-3 py-2 tabular-nums"><span className={cn(resource.growthPerWeek > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>{resource.growthPerWeek >= 0 ? "+" : ""}{resource.growthPerWeek.toFixed(resource.growthPerWeek >= 1 ? 1 : 2)}/wk</span></td>
                      <td className="px-3 py-2">
                        <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.75rem] font-semibold", risk.badge)}>
                          <risk.icon size={11} aria-hidden="true" />{daysLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{exhaustion}</td>
                      <td className="px-3 py-2"><span className={cn("tabular-nums", orderOverdue ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground")}>{orderBy ? `${fmtDayYear(orderBy)}${orderOverdue ? " · overdue" : ""}` : "—"}</span></td>
                      <td className="px-3 py-2"><ConfidenceBadge level={forecast.confidence} /></td>
                      <td className="px-3 py-2">{plan ? <Badge variant={statusTone[plan.status]} className="text-[0.625rem]">{plan.status}</Badge> : <button type="button" className="text-[0.75rem] font-medium text-primary hover:underline" onClick={(event) => { event.stopPropagation(); openPlan(prefillFor(resource)); }}>No plan · Create →</button>}</td>
                      <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Link href={rowLink} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`View ${resource.name}`} title="View details"><ChevronRight size={16} /></Link>
                          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Create forecast alert for ${resource.name}`} title="Create forecast alert" onClick={() => setAlertOpen(true)}><Bell size={14} /></button>
                          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`New plan for ${resource.name}`} title="Create plan" onClick={() => openPlan(prefillFor(resource))}><Plus size={15} /></button>
                          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Copy link to ${resource.name}`} title="Copy link" onClick={() => copyLink(resource.id)}><Copy size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={clampedPage} pageSize={pageSize} totalItems={tableRows.length} noun="resources" onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
        </Panel>
      </section>

      {/* ---- Scenarios & plans ---- */}
      <section aria-label="Scenarios and plans" className="grid items-stretch gap-4 xl:grid-cols-2">
        <Panel title={<span className="text-[1rem] font-semibold text-foreground">What-if Scenarios</span>} className="flex flex-col p-4" headerClassName="h-10" showOptions={false} action={<Button variant="outline" className="h-8 gap-1.5 px-2.5 text-[0.75rem]" onClick={() => setScenarioOpen(true)}><Plus size={13} />New Scenario</Button>}>
          <ul className="mt-1 flex-1 divide-y divide-border/60">
            {scenarios.length === 0 && <li className="py-8 text-center text-[0.8125rem] text-muted-foreground">No scenarios yet. Build a what-if to compare baselines.</li>}
            {scenarios.map((scenario) => (
              <li key={scenario.id} className="flex items-start gap-3 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-600"><GitBranch size={16} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <b className="truncate text-[0.8125rem] text-foreground" title={scenario.name}>{scenario.name}</b>
                    <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">{new Date(scenario.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[0.75rem] text-muted-foreground" title={scenario.resourceName}>{scenario.resourceName}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.625rem] font-medium text-muted-foreground">
                    {scenario.adjustment.growthPct !== 0 && <span className="rounded bg-muted px-1.5 py-0.5">{scenario.adjustment.growthPct > 0 ? "+" : ""}{scenario.adjustment.growthPct}% growth</span>}
                    {scenario.adjustment.addCapacity > 0 && <span className="rounded bg-muted px-1.5 py-0.5">+{scenario.adjustment.addCapacity} capacity</span>}
                    {scenario.adjustment.addServers > 0 && <span className="rounded bg-muted px-1.5 py-0.5">+{scenario.adjustment.addServers} servers</span>}
                    {scenario.adjustment.workloadShiftPct !== 0 && <span className="rounded bg-muted px-1.5 py-0.5">workload {scenario.adjustment.workloadShiftPct > 0 ? "+" : ""}{scenario.adjustment.workloadShiftPct}%</span>}
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">{scenario.resultSummary}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button variant="outline" className="h-7 px-2.5 text-[0.75rem]" onClick={() => { setParam("resource", scenario.resourceId ?? selectedId ?? null); applyScenarioToChart({ name: scenario.name, growthPct: scenario.adjustment.growthPct, addCapacity: scenario.adjustment.addCapacity, addServers: scenario.adjustment.addServers, workloadShiftPct: scenario.adjustment.workloadShiftPct, startDate: scenario.adjustment.startDate, daysGained: scenario.daysGained, newExhaustionDate: scenario.newExhaustionDate, estimatedCost: scenario.estimatedCost, utilizationAtHorizonPct: 0, baselineDays: Number.POSITIVE_INFINITY, scenarioDays: Number.POSITIVE_INFINITY, baselineExhaustionDate: null }); }}>Apply to chart</Button>
                    <Button variant="outline" className="h-7 px-2.5 text-[0.75rem]" onClick={() => { const resource = scenario.resourceId ? capacityResources.find((item) => item.id === scenario.resourceId) : null; openPlan({ resourceId: resource?.id ?? capacityResources[0].id, action: "Expand storage", title: scenario.name, estimatedCost: scenario.estimatedCost, targetDate: fmtDate(now() + 14 * DAY_MS), orderByDate: fmtDate(now() + 7 * DAY_MS) }); }}>Create plan</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={<span className="text-[1rem] font-semibold text-foreground">Capacity Plans</span>} className="flex flex-col p-4" headerClassName="h-10" showOptions={false} action={<span className="text-[0.75rem] text-muted-foreground">Total planned ${plans.reduce((sum, plan) => sum + Math.max(0, plan.estimatedCost), 0)}/mo</span>}>
          <ul className="mt-1 flex-1 divide-y divide-border/60">
            {plans.length === 0 && <li className="py-8 text-center text-[0.8125rem] text-muted-foreground">No plans yet. Create one from a recommendation or the New Capacity Plan button.</li>}
            {plans.slice(0, 6).map((plan) => {
              const orderBy = Date.parse(plan.orderByDate);
              const overdue = orderBy < now() && plan.status !== "Done" && plan.status !== "Rejected";
              return (
                <li key={plan.id}>
                  <button type="button" onClick={() => setPlanDetail(plan)} className="flex w-full items-start gap-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><GitBranch size={16} aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <b className="min-w-0 truncate text-[0.8125rem] text-foreground" title={plan.title}>{plan.title}</b>
                        <Badge variant={statusTone[plan.status]} className="shrink-0 text-[0.625rem]">{plan.status}</Badge>
                      </span>
                      <span className="mt-0.5 block truncate text-[0.75rem] text-muted-foreground">{plan.resourceName} · {plan.action} · {plan.owner}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-muted-foreground">
                        <span className={cn("tabular-nums", overdue && "font-semibold text-red-600 dark:text-red-400")}>Order by {fmtDayYear(orderBy)}{overdue ? " · overdue" : ""}</span>
                        <span className="tabular-nums">${plan.estimatedCost}/mo</span>
                        {plan.changeTicket && <span className="rounded bg-muted px-1.5 py-0.5">{plan.changeTicket}</span>}
                      </span>
                    </span>
                    <ChevronRight size={16} className="mt-2 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      </section>

      {/* ---- Dialogs ---- */}
      <ScenarioBuilderDialog open={scenarioOpen} onOpenChange={setScenarioOpen} resource={selectedResource} onApply={applyScenarioToChart} onCreatePlan={createPlanFromScenario} onSaved={toast} />
      <NewCapacityPlanDialog open={planOpen} onOpenChange={setPlanOpen} prefill={planPrefill} onCreated={() => setPlans(readCapacityPlans())} onSaved={toast} />
      <ForecastAlertDialog open={alertOpen} onOpenChange={setAlertOpen} resourceName={selectedResource?.name ?? "Resource"} metric={selectedResource?.metric ?? "CPU %"} onCreated={toast} />

      {/* Plan detail dialog with approve/reject */}
      <Dialog open={planDetail !== null} onOpenChange={(open) => { if (!open) setPlanDetail(null); }}>
        <DialogContent className="w-[min(30rem,calc(100vw-2rem))]" aria-describedby="plan-detail-desc">
          {planDetail && (
            <>
              <DialogHeader>
                <DialogTitle>{planDetail.title}</DialogTitle>
                <DialogDescription id="plan-detail-desc">{planDetail.resourceName} · {planDetail.action} · owned by {planDetail.owner}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-[0.8125rem]">
                <div className="rounded-lg bg-muted/50 p-2.5"><span className="block text-[0.625rem] uppercase text-muted-foreground">Status</span><Badge variant={statusTone[planDetail.status]} className="mt-1">{planDetail.status}</Badge></div>
                <div className="rounded-lg bg-muted/50 p-2.5"><span className="block text-[0.625rem] uppercase text-muted-foreground">Est. cost</span><b className="mt-1 block tabular-nums text-foreground">${planDetail.estimatedCost}/mo</b></div>
                <div className="rounded-lg bg-muted/50 p-2.5"><span className="block text-[0.625rem] uppercase text-muted-foreground">Target date</span><b className="mt-1 block text-foreground">{fmtDayYear(Date.parse(planDetail.targetDate))}</b></div>
                <div className="rounded-lg bg-muted/50 p-2.5"><span className="block text-[0.625rem] uppercase text-muted-foreground">Order by</span><b className={cn("mt-1 block", Date.parse(planDetail.orderByDate) < now() ? "text-red-600 dark:text-red-400" : "text-foreground")}>{fmtDayYear(Date.parse(planDetail.orderByDate))}</b></div>
              </div>
              <p className="text-[0.8125rem] leading-6 text-muted-foreground">{planDetail.notes}</p>
              {planDetail.timeline.length > 0 && (
                <ol className="max-h-28 space-y-1.5 overflow-y-auto border-t border-border pt-2 text-[0.75rem]">
                  {planDetail.timeline.map((entry) => <li key={entry.id} className="flex items-center gap-2"><Check size={12} className="text-emerald-600" aria-hidden="true" /><span className="flex-1 truncate">{entry.text}</span><span className="tabular-nums text-muted-foreground">{fmtDateTime(entry.at)}</span></li>)}
                </ol>
              )}
              {planDetail.status === "Proposed" && (
                <div className="space-y-2">
                  <label htmlFor="reject-reason" className="block text-[0.75rem] font-medium text-muted-foreground">Reject reason (required to reject)</label>
                  <textarea id="reject-reason" rows={2} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-[0.8125rem] outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Why is this plan being rejected?" />
                </div>
              )}
              <DialogFooter className="flex-wrap gap-2">
                <Button variant="outline" onClick={() => setPlanDetail(null)}>Close</Button>
                {planDetail.status === "Proposed" && (
                  <>
                    <Button variant="destructive" onClick={() => { recordPlanDecision(planDetail.id, "Rejected", rejectReason.trim()); setPlans(readCapacityPlans()); setPlanDetail(null); setRejectReason(""); toast("Plan rejected"); }} disabled={!rejectReason.trim()}>Reject</Button>
                    <Button onClick={() => { recordPlanDecision(planDetail.id, "Approved", "Approved by capacity review."); setPlans(readCapacityPlans()); setPlanDetail(null); toast("Plan approved"); }}><Check size={15} />Approve</Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {notice && (
        <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-lg">
          <Check size={16} className="shrink-0 text-emerald-600" aria-hidden="true" />{notice}
        </div>
      )}
    </div>
  );
}
