"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Bell, BellOff, CalendarClock, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Copy, FileText, MoreVertical, Repeat, RotateCcw, ShieldCheck, ShieldX, TriangleAlert, Wrench, X, Ban, Zap,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AlertMenu, type AlertMenuItem } from "@/components/alerts/alert-menu";
import { ChartCard } from "@/components/logs/primitives";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { WindowStatusBadge, WindowTypeBadge, ApprovalBadge } from "@/components/maintenance-windows/window-badges";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CURRENT_USER_NAME, CANONICAL_TO_OPS, MAINTENANCE_TIME_ZONES, scopeHosts,
  type MaintenanceTimelineEntry, type MaintenanceWindow,
} from "@/mocks/maintenanceWindows";
import { useMaintenanceWindows } from "@/mocks/useMaintenanceWindows";
import { ALERT_RULES } from "@/mocks/alertRules";
import { timeAgo } from "@/mocks/logs";
import { cn } from "@/lib/utils";

const TIMELINE_META: Record<string, { icon: typeof Wrench; tone: string; label: string }> = {
  created: { icon: Wrench, tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", label: "Created" },
  scheduled: { icon: CalendarClock, tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", label: "Scheduled" },
  approved: { icon: ShieldCheck, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", label: "Approved" },
  rejected: { icon: ShieldX, tone: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400", label: "Rejected" },
  started: { icon: Zap, tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", label: "Started" },
  extended: { icon: ChevronRight, tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", label: "Extended" },
  completed: { icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", label: "Completed" },
  cancelled: { icon: Ban, tone: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300", label: "Cancelled" },
  updated: { icon: FileText, tone: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300", label: "Updated" },
  note: { icon: FileText, tone: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300", label: "Note" },
};

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Canonical All-Servers name for an ops host (inverse of CANONICAL_TO_OPS), else null. */
const OPS_TO_CANONICAL: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [canonical, opsNames] of Object.entries(CANONICAL_TO_OPS)) {
    for (const ops of opsNames) if (!map[ops]) map[ops] = canonical;
  }
  return map;
})();

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
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Next `count` occurrences of a (non-none) recurrence, starting after `afterMs`. */
function nextOccurrences(window: MaintenanceWindow, count: number, afterMs: number): number[] {
  const { recurrence } = window;
  const out: number[] = [];
  if (recurrence.kind === "none") return out;
  const untilMs = recurrence.until ? new Date(`${recurrence.until}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
  const dayMs = 24 * 60 * 60_000;
  const start = new Date(window.start);
  const startTime = start.getHours() * 60 + start.getMinutes();
  const cursor = new Date(afterMs);
  cursor.setHours(0, 0, 0, 0);
  for (let guard = 0; out.length < count && guard < 400; guard += 1) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    let matches = false;
    if (recurrence.kind === "daily") matches = true;
    else if (recurrence.kind === "weekly") matches = recurrence.days.includes(day);
    else if (recurrence.kind === "monthly") matches = recurrence.days.includes(cursor.getDate());
    if (!matches) continue;
    const occurrence = new Date(cursor);
    occurrence.setHours(Math.floor(startTime / 60), startTime % 60, 0, 0);
    const occurrenceMs = occurrence.getTime();
    if (occurrenceMs <= afterMs) continue;
    if (occurrenceMs > untilMs) break;
    out.push(occurrenceMs);
  }
  return out;
}

export function WindowDetail({ windowId }: { windowId: string }) {
  const router = useRouter();
  const toastTimer = useRef<number | null>(null);
  const {
    windows, status, reload,
    extendWindow, endWindowNow, cancelWindows, approveWindows, rejectWindows, addNote, duplicateWindow,
  } = useMaintenanceWindows();
  const isLoading = status === "loading";
  const isError = status === "error";

  const now = useNow(30_000);
  const [noteDraft, setNoteDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3800);
  }, []);

  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);

  /* Show the toast handed off by the create/edit flow. */
  useEffect(() => {
    try {
      const handoff = window.sessionStorage.getItem("nexus:maintenance-toast");
      if (handoff) {
        window.sessionStorage.removeItem("nexus:maintenance-toast");
        showToast(handoff);
      }
    } catch {
      /* sessionStorage unavailable */
    }
  }, [showToast]);

  const window_ = useMemo(() => windows.find((item) => item.id === windowId) ?? null, [windows, windowId]);

  const chronological = useMemo(() => [...windows].sort((a, b) => Date.parse(b.start) - Date.parse(a.start)), [windows]);
  const currentIndex = chronological.findIndex((item) => item.id === windowId);
  const newer = currentIndex > 0 ? chronological[currentIndex - 1] : null;
  const older = currentIndex >= 0 && currentIndex < chronological.length - 1 ? chronological[currentIndex + 1] : null;

  const coveredHosts = useMemo(() => (window_ ? scopeHosts(window_.scope).filter((host) => !window_.scope.exclude.includes(host)) : []), [window_]);
  const mutedRules = useMemo(() => (window_ ? ALERT_RULES.filter((rule) => window_.alertBehavior.mutedRuleIds.includes(rule.id)) : []), [window_]);
  const occurrences = useMemo(() => (window_ ? nextOccurrences(window_, 5, now) : []), [window_, now]);

  const goBack = useCallback(() => router.push("/maintenance-windows"), [router]);

  const copy = useCallback((label: string, text: string) => {
    const done = () => showToast(`${label} copied.`);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => showToast(text));
    else showToast(text);
  }, [showToast]);

  const submitNote = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    if (!window_ || !noteDraft.trim()) return;
    addNote(window_.id, noteDraft.trim());
    showToast(`Note added to ${window_.id}.`);
    setNoteDraft("");
  }, [window_, noteDraft, addNote, showToast]);

  const confirmEndNow = useCallback(() => {
    if (!window_) return;
    endWindowNow(window_.id);
    showToast(`${window_.id} ended now.`);
    setEndOpen(false);
  }, [window_, endWindowNow, showToast]);

  const confirmCancel = useCallback(() => {
    if (!window_) return;
    cancelWindows([window_.id]);
    showToast(`${window_.id} cancelled.`);
    setCancelOpen(false);
  }, [window_, cancelWindows, showToast]);

  const kebabItems: AlertMenuItem[] = window_ ? [
    { key: "duplicate", label: "Duplicate", onSelect: () => { const id = duplicateWindow(window_.id); if (id) showToast(`Duplicated as ${id}.`); } },
    { key: "copy-link", label: "Copy link", onSelect: () => copy("Link", `${window.location.origin}/maintenance-windows/${window_.id}`) },
    { divider: true, key: "d1", label: "" },
    { key: "cancel", label: "Cancel window", danger: true, disabled: window_.status === "Cancelled" || window_.status === "Completed", onSelect: () => setCancelOpen(true) },
  ] : [];

  if (isLoading) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Operations", "Maintenance Windows", windowId]} title="Maintenance Window" subtitle="Loading window details…" icon={<Wrench size={22} />} iconClassName="h-11 w-11 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" />
        <div aria-busy="true" className="grid items-stretch gap-4 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-8">
            <div className="h-[240px] animate-pulse rounded-xl bg-muted" />
            <div className="h-[280px] animate-pulse rounded-xl bg-muted" />
            <div className="h-[220px] animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="space-y-4 xl:col-span-4">
            <div className="h-[200px] animate-pulse rounded-xl bg-muted" />
            <div className="h-[220px] animate-pulse rounded-xl bg-muted" />
            <div className="h-[160px] animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Operations", "Maintenance Windows", windowId]} title="Maintenance Window" subtitle="The maintenance service failed to respond." icon={<Wrench size={22} />} iconClassName="h-11 w-11 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" />
        <section role="alert" className="grid min-h-[320px] place-items-center rounded-xl border border-border bg-card p-6 text-center">
          <div className="flex max-w-md flex-col items-center gap-2">
            <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-[#DC2626] dark:bg-red-500/10"><TriangleAlert size={20} /></span>
            <p className="font-display text-base font-bold text-foreground">Window could not be loaded</p>
            <p className="text-sm text-muted-foreground">Retry to reload the schedule.</p>
            <Button onClick={reload} className="h-10 gap-1.5 rounded-lg px-4 text-sm"><RotateCcw size={15} />Retry</Button>
          </div>
        </section>
      </div>
    );
  }

  if (!window_) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Operations", "Maintenance Windows", windowId]} title="Window not found" subtitle="No maintenance window with this ID exists." icon={<Wrench size={22} />} iconClassName="h-11 w-11 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" />
        <section role="alert" className="grid min-h-[320px] place-items-center rounded-xl border border-border bg-card p-6 text-center">
          <div className="flex max-w-md flex-col items-center gap-2">
            <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground"><Wrench size={20} /></span>
            <p className="font-display text-base font-bold text-foreground">Window not found</p>
            <p className="text-sm text-muted-foreground"><span className="font-mono">{windowId}</span> does not exist or was purged.</p>
            <Link href="/maintenance-windows" className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><ArrowLeft size={15} />Back to Maintenance Windows</Link>
          </div>
        </section>
      </div>
    );
  }

  const startMs = Date.parse(window_.start);
  const endMs = Date.parse(window_.end);
  const live = window_.status === "In Progress";
  const scheduled = window_.status === "Scheduled";
  const completed = window_.status === "Completed";
  const countdownLabel = completed
    ? `Ended ${formatCountdown(endMs, now)} ago`
    : live
      ? `Ends in ${formatCountdown(endMs, now)}`
      : `Starts in ${formatCountdown(startMs, now)}`;
  const plannedDurationMin = Math.round((endMs - startMs) / 60_000);
  const actualDurationMin = window_.summary?.actualStart && window_.summary?.actualEnd
    ? Math.round((Date.parse(window_.summary.actualEnd) - Date.parse(window_.summary.actualStart)) / 60_000)
    : null;
  const durationLabel = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  };
  const stepIndex = completed ? 2 : live ? 1 : 0;
  const pendingApproval = window_.approvalStatus === "Pending";
  const recurrenceSummary = window_.recurrence.kind === "none"
    ? "Does not repeat"
    : window_.recurrence.kind === "daily"
      ? `Daily${window_.recurrence.until ? ` until ${window_.recurrence.until}` : ""}`
      : window_.recurrence.kind === "weekly"
        ? `Every ${window_.recurrence.days.map((day) => WEEKDAY_SHORT[day]).join(", ")}${window_.recurrence.until ? ` until ${window_.recurrence.until}` : ""}`
        : `Monthly on day ${window_.recurrence.days[0] ?? 1}${window_.recurrence.until ? ` until ${window_.recurrence.until}` : ""}`;
  const plannedVsActual = actualDurationMin != null ? actualDurationMin - plannedDurationMin : null;

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Operations", "Maintenance Windows", window_.id]}
        title={window_.title}
        subtitle={window_.impact}
        icon={<Wrench size={22} />}
        iconClassName="h-11 w-11 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
        statusBadge={<span className="flex flex-wrap items-center gap-1.5"><WindowStatusBadge status={window_.status} live={live} endsIn={live ? formatCountdown(endMs, now) : null} /><WindowTypeBadge type={window_.type} /><ApprovalBadge status={window_.approvalStatus} /></span>}
        onRefresh={reload}
        lastUpdated={timeAgo(now)}
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={goBack} className="h-10 gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} aria-hidden="true" />Back to Maintenance Windows</Button>
            <Link href={`/maintenance-windows/${window_.id}/edit`} aria-disabled={!live && !scheduled} tabIndex={!live && !scheduled ? -1 : undefined} className={cn("inline-flex h-10 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", !live && !scheduled && "pointer-events-none opacity-40")}>Edit</Link>
            <AlertMenu
              label="Extend window"
              trigger={<Button variant="outline" disabled={!live && !scheduled} className="h-10 gap-1.5 rounded-lg px-3 text-sm"><ChevronDown size={14} aria-hidden="true" className="order-2" />Extend</Button>}
              items={[
                { key: "+30", label: "+30 minutes", onSelect: () => { extendWindow(window_.id, 30); showToast(`${window_.id} extended by 30m.`); } },
                { key: "+60", label: "+1 hour", onSelect: () => { extendWindow(window_.id, 60); showToast(`${window_.id} extended by 1h.`); } },
                { key: "custom", label: "Custom…", onSelect: () => {
                  const raw = window.prompt("Extend by how many minutes?", "45");
                  const minutes = raw ? Number.parseInt(raw, 10) : Number.NaN;
                  if (Number.isFinite(minutes) && minutes > 0) { extendWindow(window_.id, minutes); showToast(`${window_.id} extended by ${minutes}m.`); }
                } },
              ]}
            />
            <Button variant="outline" onClick={() => setEndOpen(true)} disabled={!live} className="h-10 gap-1.5 rounded-lg px-3 text-sm">End now</Button>
            {pendingApproval && (
              <>
                <Button variant="outline" onClick={() => { approveWindows([window_.id]); showToast(`${window_.id} approved.`); }} className="h-10 gap-1.5 rounded-lg border-emerald-200 px-3 text-sm text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-300"><ShieldCheck size={15} aria-hidden="true" />Approve</Button>
                <Button variant="outline" onClick={() => { rejectWindows([window_.id]); showToast(`${window_.id} rejected.`); }} className="h-10 gap-1.5 rounded-lg border-red-200 px-3 text-sm text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300"><ShieldX size={15} aria-hidden="true" />Reject</Button>
              </>
            )}
            <AlertMenu
              label="More actions"
              trigger={<Button variant="outline" size="icon-sm" className="h-10 w-10" aria-label="More actions"><MoreVertical size={16} /></Button>}
              items={kebabItems}
            />
          </div>
        }
      />

      <div className="grid items-stretch gap-4 xl:grid-cols-12">
        {/* ------------------------------- left column ------------------------------ */}
        <div className="min-w-0 space-y-4 xl:col-span-8">

          {/* Overview */}
          <ChartCard
            title="Overview"
            actions={
              <AlertMenu
                label="Overview options"
                trigger={<Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label="Overview options"><MoreVertical size={15} /></Button>}
                items={[
                  { key: "copy-summary", label: "Copy summary", onSelect: () => copy("Summary", `${window_.id} [${window_.status}] ${window_.title}\n${formatDateTime(startMs)} → ${formatDateTime(endMs)} (${window_.timeZone})\nOwner: ${window_.owner} · Ticket: ${window_.changeTicket ?? "—"}`) },
                  { key: "copy-ticket", label: "Copy ticket id", onSelect: () => copy("Ticket", window_.changeTicket ?? "") },
                ]}
              />
            }
          >
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-violet-200/70 bg-violet-50 px-4 py-2.5 dark:border-violet-500/25 dark:bg-violet-500/10">
              <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", live ? "animate-pulse bg-violet-500" : completed ? "bg-emerald-500" : "bg-blue-500")} />
              <p className="font-display text-base font-bold tabular-nums text-violet-900 dark:text-violet-200">{countdownLabel}</p>
              <span className="text-[12px] text-violet-800/80 dark:text-violet-300/80">{live ? "alerts muted until end" : completed ? "window closed, alerts restored" : "alerts will mute at start"}</span>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Starts</dt>
                <dd className="mt-1 text-sm tabular-nums text-foreground">{formatDateTime(startMs)}<span className="ml-1.5 text-[12px] text-muted-foreground">({timeAgo(startMs)})</span></dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Ends</dt>
                <dd className="mt-1 text-sm tabular-nums text-foreground">{formatDateTime(endMs)}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Duration</dt>
                <dd className="mt-1 text-sm tabular-nums text-foreground">{durationLabel(plannedDurationMin)}<span className="ml-1.5 text-[12px] text-muted-foreground">planned</span></dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Time zone</dt>
                <dd className="mt-1 text-sm text-foreground">{window_.timeZone}<span className="block text-[12px] text-muted-foreground">local to this window · your browser: {Intl.DateTimeFormat().resolvedOptions().timeZone}</span></dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Recurrence</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-sm text-foreground">{window_.recurrence.kind !== "none" && <Repeat size={13} aria-hidden="true" className="text-teal-600" />}{recurrenceSummary}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Change ticket</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-sm">
                  <span className="font-mono text-foreground">{window_.changeTicket ?? "—"}</span>
                  {window_.changeTicket && (
                    <button type="button" onClick={() => copy("Ticket", window_.changeTicket ?? "")} aria-label="Copy change ticket id" className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Copy size={12} aria-hidden="true" /></button>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Owner</dt>
                <dd className="mt-1 flex items-center gap-2 text-sm text-foreground"><InitialsAvatar name={window_.owner} size={22} />{window_.owner}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Approver</dt>
                <dd className="mt-1 flex items-center gap-2 text-sm text-foreground">{window_.approver ? (<><InitialsAvatar name={window_.approver} size={22} />{window_.approver}</>) : <span className="text-muted-foreground">Not required (Emergency)</span>}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Created</dt>
                <dd className="mt-1 text-sm text-foreground">{formatDateTime(Date.parse(window_.createdAt))}<span className="ml-1.5 text-[12px] text-muted-foreground">by {window_.createdBy}</span></dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">ID</dt>
                <dd className="mt-1 font-mono text-[13px] text-foreground">{window_.id}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Description</dt>
                <dd className="mt-1 text-sm leading-snug text-foreground">{window_.description || "No description provided."}</dd>
              </div>
            </dl>
          </ChartCard>

          {/* Scope */}
          <ChartCard
            title="Scope"
            actions={<span className="rounded-full bg-muted px-2 py-1 text-[12px] font-semibold tabular-nums text-muted-foreground">{coveredHosts.length} host{coveredHosts.length === 1 ? "" : "s"}</span>}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-1.5 pr-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Server</th>
                    <th scope="col" className="py-1.5 pr-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Group</th>
                    <th scope="col" className="py-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {coveredHosts.map((host) => {
                    const canonical = OPS_TO_CANONICAL[host];
                    const groupNames = window_.scope.groups
                      .map((group) => group)
                      .join(", ");
                    return (
                      <tr key={host} className="border-b border-border/60 last:border-b-0">
                        <td className="py-2 pr-3">
                          {canonical ? (
                            <Link href={`/server-details/${encodeURIComponent(canonical)}`} className="font-mono text-[13px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">{host}</Link>
                          ) : (
                            <span className="font-mono text-[13px] text-foreground">{host}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-[13px] text-muted-foreground">{groupNames || "—"}</td>
                        <td className="py-2">
                          {live
                            ? <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-violet-100 px-2 py-0.5 text-[12px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />In Maintenance</span>
                            : completed
                              ? <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-[12px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Restored</span>
                              : <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-blue-100 px-2 py-0.5 text-[12px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">Scheduled</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {coveredHosts.length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-sm text-muted-foreground">No servers in scope.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-border/70 pt-3 text-[13px]">
              <span className="text-muted-foreground">Services: {window_.scope.services.length > 0 ? window_.scope.services.join(", ") : "—"}</span>
              <span className="text-muted-foreground">Tags: {window_.scope.tags.length > 0 ? window_.scope.tags.map((tag) => `#${tag}`).join(" ") : "—"}</span>
              {window_.scope.exclude.length > 0 && <span className="text-muted-foreground">Excluded: <span className="font-mono">{window_.scope.exclude.join(", ")}</span></span>}
              <span className="text-muted-foreground"><b className="text-foreground">{mutedRules.length}</b> alert rules muted</span>
            </div>
          </ChartCard>

          {/* Timeline */}
          <ChartCard
            title="Timeline"
            actions={<span className="rounded-full bg-muted px-2 py-1 text-[12px] font-semibold tabular-nums text-muted-foreground">{window_.timeline.length} entries</span>}
          >
            <form onSubmit={submitNote} className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
              <label htmlFor="note-draft" className="text-[12px] font-medium text-foreground">Add note</label>
              <textarea
                id="note-draft"
                rows={2}
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="What changed? Impact, scope, next steps…"
                className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={!noteDraft.trim()} className="h-9 rounded-lg px-4 text-sm">Post</Button>
              </div>
            </form>
            <ol className="relative ml-2 border-l-2 border-border pl-6">
              {[...window_.timeline].sort((a, b) => a.epochMs - b.epochMs).map((entry) => {
                const meta = TIMELINE_META[entry.type] ?? TIMELINE_META.note;
                const EntryIcon = meta.icon;
                return (
                  <li key={entry.id} className="relative pb-4 last:pb-0">
                    <span aria-hidden="true" className={cn("absolute -left-[34px] top-0.5 grid h-6 w-6 place-items-center rounded-full border border-border bg-card", meta.tone)}>
                      <EntryIcon size={12} />
                    </span>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-[12px] tabular-nums text-muted-foreground">{new Date(entry.epochMs).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-[12px] text-muted-foreground">{timeAgo(entry.epochMs)}</span>
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">· {meta.label}</span>
                    </div>
                    <p className="mt-0.5 text-[13px] leading-snug text-foreground"><b>{entry.author === CURRENT_USER_NAME ? "You" : entry.author}</b> — {entry.text}</p>
                  </li>
                );
              })}
            </ol>
          </ChartCard>

          {/* Summary (Completed only) */}
          {completed && window_.summary && (
            <ChartCard title="Summary">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                  <p className="font-display text-2xl font-bold tabular-nums text-foreground">{window_.summary.suppressedAlerts}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">Alerts suppressed</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                  <p className="font-display text-2xl font-bold tabular-nums text-foreground">{window_.summary.suppressedIncidents}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">Incidents suppressed</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                  <p className="font-display text-2xl font-bold tabular-nums text-foreground">{actualDurationMin != null ? durationLabel(actualDurationMin) : "—"}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">Actual duration</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                  <p className={cn("font-display text-2xl font-bold tabular-nums", plannedVsActual != null && plannedVsActual > 15 ? "text-amber-700 dark:text-amber-400" : "text-foreground")}>
                    {plannedVsActual == null ? "—" : plannedVsActual === 0 ? "on time" : plannedVsActual > 0 ? `+${plannedVsActual}m` : `${plannedVsActual}m`}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">vs planned</p>
                </div>
              </div>
              {window_.summary.notes && (
                <div className="mt-3">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</h3>
                  <p className="mt-1 text-sm leading-snug text-foreground">{window_.summary.notes}</p>
                </div>
              )}
            </ChartCard>
          )}
        </div>

        {/* ------------------------------- right column ------------------------------ */}
        <div className="min-w-0 space-y-4 xl:col-span-4">

          {/* Status stepper */}
          <ChartCard title="Status">
            {window_.status === "Cancelled" ? (
              <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-300"><Ban size={15} aria-hidden="true" className="mt-0.5 shrink-0" />This window was cancelled. Its muted alerts were restored.</p>
            ) : (
              <ol className="space-y-0">
                {["Scheduled", "In Progress", "Completed"].map((step, index) => {
                  const reached = index <= stepIndex;
                  const current = index === stepIndex && !completed;
                  const done = index < stepIndex || completed;
                  return (
                    <li key={step} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span aria-hidden="true" className={cn(
                          "grid h-6 w-6 place-items-center rounded-full border text-[12px] font-bold",
                          done ? "border-emerald-500 bg-emerald-500 text-white" : current ? "border-violet-500 bg-violet-500 text-white" : "border-border bg-card text-muted-foreground",
                        )}>
                          {done ? <Check size={13} /> : index + 1}
                        </span>
                        {index < 2 && <span aria-hidden="true" className={cn("w-0.5 flex-1", done && !current ? "bg-emerald-500" : "bg-border", "min-h-8")} />}
                      </div>
                      <div className="pb-5">
                        <p className={cn("text-sm font-semibold", reached ? "text-foreground" : "text-muted-foreground")}>{step}{current && <span className="ml-2 text-[12px] font-normal text-violet-700 dark:text-violet-300">current</span>}</p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          {index === 0 && formatDateTime(startMs)}
                          {index === 1 && (live ? `since ${new Date(startMs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : stepIndex >= 1 ? formatDateTime(startMs) : "—")}
                          {index === 2 && (completed ? formatDateTime(endMs) : "Pending")}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </ChartCard>

          {/* Alert behaviour */}
          <ChartCard title="Alert behaviour">
            <div className="flex items-center gap-2.5">
              {window_.alertBehavior.muteAlerts
                ? <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"><BellOff size={17} /></span>
                : <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground"><Bell size={17} /></span>}
              <div>
                <p className="text-sm font-semibold text-foreground">{window_.alertBehavior.muteAlerts ? "Alerts muted for scope" : "Alerts stay live"}</p>
                <p className="text-[12px] text-muted-foreground">{window_.alertBehavior.suppressIncidents ? "Incident auto-creation suppressed" : "Incidents will be created normally"}</p>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {window_.alertBehavior.allowCritical
                ? <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[12px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300"><Zap size={11} aria-hidden="true" />SEV1 allowed through</span>
                : <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[12px] font-semibold text-muted-foreground">All severities muted</span>}
              {window_.alertBehavior.autoEnd && <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[12px] font-semibold text-muted-foreground">Auto-end + unmute at end</span>}
            </div>
            <div className="mt-3 border-t border-border/70 pt-3">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Muted rules ({mutedRules.length})</h3>
              <ul className="mt-1.5 divide-y divide-border/60">
                {mutedRules.map((rule) => (
                  <li key={rule.id}>
                    <Link href={`/alert-rules?rule=${rule.id}`} className="flex items-center justify-between gap-2 py-1.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                      <span className="min-w-0 truncate text-foreground" title={rule.name}>{rule.name}</span>
                      <span className="shrink-0 font-mono text-[12px] text-primary">{rule.id}</span>
                    </Link>
                  </li>
                ))}
                {mutedRules.length === 0 && <li className="py-2 text-[13px] text-muted-foreground">No specific rules muted.</li>}
              </ul>
            </div>
          </ChartCard>

          {/* Notifications */}
          <ChartCard title="Notifications">
            <div className="flex flex-wrap gap-1.5">
              {window_.notifyChannels.map((channel) => (
                <span key={channel} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-[12px] font-semibold text-foreground"><Bell size={11} aria-hidden="true" />{channel}</span>
              ))}
              {window_.notifyChannels.length === 0 && <span className="text-[13px] text-muted-foreground">No channels configured.</span>}
            </div>
            <ul className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
              <li className="flex items-center justify-between gap-2"><span>Window created</span><span className="tabular-nums">{new Date(window_.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></li>
              {window_.timeline.filter((entry) => entry.type === "approved").map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-2"><span>Approval notice sent</span><span className="tabular-nums">{new Date(entry.epochMs).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></li>
              ))}
              {scheduled && <li className="flex items-center justify-between gap-2"><span>Reminder scheduled</span><span className="text-foreground">15m / 1h / 24h before start</span></li>}
            </ul>
          </ChartCard>

          {/* Upcoming occurrences */}
          {window_.recurrence.kind !== "none" && (
            <ChartCard title="Upcoming occurrences">
              <ul className="divide-y divide-border/60">
                {occurrences.map((occurrenceMs) => (
                  <li key={occurrenceMs} className="flex items-center justify-between gap-2 py-1.5 text-[13px]">
                    <span className="text-foreground">{new Date(occurrenceMs).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                    <span className="tabular-nums text-muted-foreground">{new Date(occurrenceMs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · in {formatCountdown(occurrenceMs, now)}</span>
                  </li>
                ))}
                {occurrences.length === 0 && <li className="py-2 text-[13px] text-muted-foreground">Series has ended.</li>}
              </ul>
            </ChartCard>
          )}

          {/* Prev / next */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2">
            <button type="button" onClick={() => older && router.push(`/maintenance-windows/${older.id}`)} disabled={!older} className="inline-flex h-9 max-w-[46%] items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40" aria-label={older ? `Older window ${older.id}` : "No older windows"}>
              <ChevronLeft size={15} aria-hidden="true" className="shrink-0" /><span className="truncate">{older ? older.id : "No older"}</span>
            </button>
            <span className="text-[12px] tabular-nums text-muted-foreground">{currentIndex + 1} / {chronological.length}</span>
            <button type="button" onClick={() => newer && router.push(`/maintenance-windows/${newer.id}`)} disabled={!newer} className="inline-flex h-9 max-w-[46%] items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40" aria-label={newer ? `Newer window ${newer.id}` : "No newer windows"}>
              <span className="truncate">{newer ? newer.id : "No newer"}</span><ChevronRight size={15} aria-hidden="true" className="shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {/* End now confirmation */}
      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End {window_.id} now?</DialogTitle>
            <DialogDescription>The window will be marked Completed, alerts will be unmuted and the actual end time recorded as now.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-10 rounded-lg px-4 text-sm" onClick={() => setEndOpen(false)}>Keep running</Button>
            <Button className="h-10 rounded-lg px-4 text-sm font-semibold" onClick={confirmEndNow}>End now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {window_.id}?</DialogTitle>
            <DialogDescription>The window will be cancelled and its muted alerts restored immediately.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-10 rounded-lg px-4 text-sm" onClick={() => setCancelOpen(false)}>Keep window</Button>
            <Button className="h-10 rounded-lg bg-[#DC2626] px-4 text-sm font-semibold text-white hover:bg-[#B91C1C]" onClick={confirmCancel}>Cancel window</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-4 left-1/2 z-[1500] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-popover px-4 py-2.5 text-sm text-popover-foreground shadow-lg">
          <Check size={15} aria-hidden="true" className="text-emerald-600" />
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
