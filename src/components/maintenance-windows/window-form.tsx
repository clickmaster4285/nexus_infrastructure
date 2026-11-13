"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Bell, BellOff, CalendarClock, Check, CheckCircle2, ChevronDown,
  RotateCcw, Search, ShieldCheck, ShieldOff, Ticket, Wrench, X, Zap, CalendarDays, RefreshCw, Repeat, Siren, Circle,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { ApprovalBadge, WindowStatusBadge, WindowTypeBadge, ConflictBadge } from "@/components/maintenance-windows/window-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  MAINTENANCE_CHANNELS, MAINTENANCE_PEOPLE, MAINTENANCE_TIME_ZONES, SCOPE_GROUPS, SCOPE_SERVERS, SCOPE_SERVICES, SCOPE_TAGS,
  CURRENT_USER_NAME, overlappingWindows, rulesForScope, scopeHosts,
  type MaintenanceRecurrence, type MaintenanceWindowType,
} from "@/mocks/maintenanceWindows";
import { useMaintenanceWindows } from "@/mocks/useMaintenanceWindows";
import { readIncidentStore } from "@/mocks/incidents";
import { cn } from "@/lib/utils";

/* ---------------------------------- helpers ---------------------------------- */

const pad = (value: number) => String(value).padStart(2, "0");
const toLocalInput = (ms: number) => {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const fromLocalInput = (value: string) => (value ? new Date(value).getTime() : Number.NaN);

const WEEKDAY_TOGGLES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function SearchableMultiSelect({ label, options, selected, onChange, placeholder }: {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="truncate">{selected.length > 0 ? <>{label} · <b>{selected.length}</b></> : label}</span>
        <ChevronDown size={14} aria-hidden="true" className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-40 w-full min-w-56 rounded-[10px] border border-[#E5E7EB] bg-white p-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] outline-none dark:border-border dark:bg-popover">
          <div className="relative border-b border-border/60 p-1">
            <Search size={13} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              aria-label={`Filter ${label}`}
              className="h-8 w-full rounded-md bg-transparent pl-7 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div role="listbox" aria-label={label} aria-multiselectable="true" className="max-h-48 overflow-y-auto p-1">
            {filtered.map((option) => {
              const checked = selected.includes(option.value);
              return (
                <label key={option.value} className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] text-foreground transition-colors hover:bg-[#F3F4F6] dark:hover:bg-accent">
                  <input type="checkbox" checked={checked} onChange={() => toggle(option.value)} className="h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-[#1479e8]" />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </label>
              );
            })}
            {filtered.length === 0 && <p className="px-2 py-2 text-[13px] text-muted-foreground">No matches.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function SelectedChips({ values, onRemove, mono = false }: { values: string[]; onRemove: (value: string) => void; mono?: boolean }) {
  if (values.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span key={value} className={cn("inline-flex items-center gap-1 rounded-md border border-border bg-muted py-0.5 pl-1.5 pr-1 text-[12px] text-foreground", mono && "font-mono")}>
          {value}
          <button type="button" onClick={() => onRemove(value)} aria-label={`Remove ${value}`} className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X size={11} aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  );
}

const TYPE_CARDS: Array<{ value: MaintenanceWindowType; icon: typeof CalendarDays; blurb: string }> = [
  { value: "Planned", icon: CalendarDays, blurb: "Scheduled change with approvals and a freeze window." },
  { value: "Emergency", icon: Zap, blurb: "Immediate action. Skips approver; can start in the past." },
  { value: "Recurring", icon: RefreshCw, blurb: "Repeats daily, weekly or monthly until an end date." },
];

const MAX_TITLE = 120;
const MAX_DURATION_MS = 24 * 60 * 60_000;

export function WindowForm({ mode, windowId, initialStart }: { mode: "create" | "edit"; windowId?: string; initialStart?: string | null }) {
  const router = useRouter();
  const {
    windows, status, reload, createWindow, updateWindow,
  } = useMaintenanceWindows();
  const isLoading = status === "loading";
  const isError = status === "error";

  const editing = useMemo(() => (mode === "edit" && windowId ? windows.find((window) => window.id === windowId) ?? null : null), [mode, windowId, windows]);
  const notFound = mode === "edit" && !isLoading && !isError && windows.length > 0 && !editing;
  const terminal = editing != null && (editing.status === "Completed" || editing.status === "Cancelled");

  const prefillStart = useMemo(() => (initialStart && !Number.isNaN(Date.parse(initialStart)) ? Date.parse(initialStart) : null), [initialStart]);

  const defaults = useMemo(() => {
    if (editing) {
      return {
        title: editing.title, description: editing.description, type: editing.type,
        start: toLocalInput(Date.parse(editing.start)), end: toLocalInput(Date.parse(editing.end)),
        timeZone: editing.timeZone,
        recurrenceKind: editing.recurrence.kind, recurrenceDays: editing.recurrence.days, recurrenceUntil: editing.recurrence.until ?? "",
        servers: editing.scope.servers, groups: editing.scope.groups, services: editing.scope.services, tags: editing.scope.tags, exclude: editing.scope.exclude,
        muteAlerts: editing.alertBehavior.muteAlerts, suppressIncidents: editing.alertBehavior.suppressIncidents,
        allowCritical: editing.alertBehavior.allowCritical, autoEnd: editing.alertBehavior.autoEnd,
        mutedRuleIds: editing.alertBehavior.mutedRuleIds,
        owner: editing.owner, approver: editing.approver ?? "",
        channels: editing.notifyChannels, changeTicket: editing.changeTicket ?? "", impact: editing.impact,
      };
    }
    const start = prefillStart ?? Date.now() + 60 * 60_000;
    const startMs = start;
    return {
      title: "", description: "", type: "Planned" as MaintenanceWindowType,
      start: toLocalInput(startMs), end: toLocalInput(startMs + 60 * 60_000),
      timeZone: "Asia/Karachi",
      recurrenceKind: "none" as MaintenanceRecurrence["kind"], recurrenceDays: [] as number[], recurrenceUntil: "",
      servers: [] as string[], groups: [] as string[], services: [] as string[], tags: [] as string[], exclude: [] as string[],
      muteAlerts: true, suppressIncidents: true, allowCritical: true, autoEnd: true,
      mutedRuleIds: [] as string[],
      owner: CURRENT_USER_NAME as string, approver: "",
      channels: ["Slack"] as string[], changeTicket: "", impact: "",
    };
  }, [editing, prefillStart]);




  const [title, setTitle] = useState(defaults.title);
  const [description, setDescription] = useState(defaults.description);
  const [type, setType] = useState<MaintenanceWindowType>(defaults.type);
  const [startText, setStartText] = useState(defaults.start);
  const [endText, setEndText] = useState(defaults.end);
  const [timeZone, setTimeZone] = useState(defaults.timeZone);
  const [recurrenceKind, setRecurrenceKind] = useState<MaintenanceRecurrence["kind"]>(defaults.recurrenceKind);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(defaults.recurrenceDays);
  const [recurrenceUntil, setRecurrenceUntil] = useState(defaults.recurrenceUntil);
  const [servers, setServers] = useState<string[]>(defaults.servers);
  const [groups, setGroups] = useState<string[]>(defaults.groups);
  const [services, setServices] = useState<string[]>(defaults.services);
  const [tags, setTags] = useState<string[]>(defaults.tags);
  const [exclude, setExclude] = useState<string[]>(defaults.exclude);
  const [muteAlerts, setMuteAlerts] = useState(defaults.muteAlerts);
  const [suppressIncidents, setSuppressIncidents] = useState(defaults.suppressIncidents);
  const [allowCritical, setAllowCritical] = useState(defaults.allowCritical);
  const [autoEnd, setAutoEnd] = useState(defaults.autoEnd);
  const [mutedRuleIds, setMutedRuleIds] = useState<string[]>(defaults.mutedRuleIds);
  const [owner, setOwner] = useState(defaults.owner);
  const [approver, setApprover] = useState(defaults.approver);
  const [channels, setChannels] = useState<string[]>(defaults.channels);
  const [changeTicket, setChangeTicket] = useState(defaults.changeTicket);
  const [impact, setImpact] = useState(defaults.impact);
  const [statusUpdate, setStatusUpdate] = useState("");
  const [notifyBefore, setNotifyBefore] = useState<"15m" | "1h" | "24h">("1h");

  const [errors, setErrors] = useState<Partial<Record<"title" | "start" | "end" | "owner", string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState<null | "emergency" | "conflict">(null);
  const [initialized, setInitialized] = useState(false);

  /* Populate the form once the editing window finishes loading */
  useEffect(() => {
    if (initialized || mode !== "edit") return;
    if (!editing) return;
    setInitialized(true);
    setTitle(editing.title); setDescription(editing.description); setType(editing.type);
    setStartText(toLocalInput(Date.parse(editing.start))); setEndText(toLocalInput(Date.parse(editing.end)));
    setTimeZone(editing.timeZone);
    setRecurrenceKind(editing.recurrence.kind); setRecurrenceDays(editing.recurrence.days); setRecurrenceUntil(editing.recurrence.until ?? "");
    setServers(editing.scope.servers); setGroups(editing.scope.groups); setServices(editing.scope.services); setTags(editing.scope.tags); setExclude(editing.scope.exclude);
    setMuteAlerts(editing.alertBehavior.muteAlerts); setSuppressIncidents(editing.alertBehavior.suppressIncidents);
    setAllowCritical(editing.alertBehavior.allowCritical); setAutoEnd(editing.alertBehavior.autoEnd); setMutedRuleIds(editing.alertBehavior.mutedRuleIds);
    setOwner(editing.owner); setApprover(editing.approver ?? ""); setChannels(editing.notifyChannels);
    setChangeTicket(editing.changeTicket ?? ""); setImpact(editing.impact);
  }, [editing, initialized, mode]);

  /* Emergency windows start now by default */
  const setTypeAndPrefill = useCallback((nextType: MaintenanceWindowType) => {
    setType(nextType);
    if (nextType === "Emergency") {
      const nowMs = Date.now();
      setStartText(toLocalInput(nowMs));
      setEndText(toLocalInput(nowMs + 60 * 60_000));
      setApprover("");
    }
  }, []);

  const dirty = useMemo(() => {
    const current = JSON.stringify({ title, description, type, startText, endText, timeZone, recurrenceKind, recurrenceDays, recurrenceUntil, servers, groups, services, tags, exclude, muteAlerts, suppressIncidents, allowCritical, autoEnd, mutedRuleIds, owner, approver, channels, changeTicket, impact });
    return current !== JSON.stringify({ title: defaults.title, description: defaults.description, type: defaults.type, startText: defaults.start, endText: defaults.end, timeZone: defaults.timeZone, recurrenceKind: defaults.recurrenceKind, recurrenceDays: defaults.recurrenceDays, recurrenceUntil: defaults.recurrenceUntil, servers: defaults.servers, groups: defaults.groups, services: defaults.services, tags: defaults.tags, exclude: defaults.exclude, muteAlerts: defaults.muteAlerts, suppressIncidents: defaults.suppressIncidents, allowCritical: defaults.allowCritical, autoEnd: defaults.autoEnd, mutedRuleIds: defaults.mutedRuleIds, owner: defaults.owner, approver: defaults.approver, channels: defaults.channels, changeTicket: defaults.changeTicket, impact: defaults.impact });
  }, [title, description, type, startText, endText, timeZone, recurrenceKind, recurrenceDays, recurrenceUntil, servers, groups, services, tags, exclude, muteAlerts, suppressIncidents, allowCritical, autoEnd, mutedRuleIds, owner, approver, channels, changeTicket, impact, defaults]);

  /* Warn on browser navigation away with unsaved changes */
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const startMs = fromLocalInput(startText);
  const endMs = fromLocalInput(endText);
  const now = Date.now();
  const durationMs = Number.isFinite(startMs) && Number.isFinite(endMs) ? endMs - startMs : Number.NaN;
  const scopeValue = useMemo(() => ({ servers, groups, services, tags, exclude }), [servers, groups, services, tags, exclude]);
  const coveredHosts = useMemo(() => scopeHosts(scopeValue).filter((host) => !exclude.includes(host)), [scopeValue, exclude]);
  const scopeRuleCount = useMemo(() => (muteAlerts ? rulesForScope(scopeValue).filter((rule) => !exclude.includes(rule.target)).length : 0), [scopeValue, muteAlerts, exclude]);
  const affectedOpenIncidents = useMemo(() => {
    if (!suppressIncidents) return 0;
    try {
      const hosts = new Set(coveredHosts);
      return readIncidentStore().filter((incident) => incident.status !== "Resolved" && incident.affectedHosts.some((host) => hosts.has(host))).length;
    } catch {
      return 0;
    }
  }, [coveredHosts, suppressIncidents]);

  const matchedRules = useMemo(() => (muteAlerts ? rulesForScope(scopeValue) : []), [scopeValue, muteAlerts]);

  const conflicts = useMemo(() => {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];
    if (servers.length === 0 && groups.length === 0) return [];
    return overlappingWindows(scopeValue, startMs, endMs, editing?.id);
  }, [scopeValue, startMs, endMs, editing?.id, servers.length, groups.length]);

  const durationWarning = Number.isFinite(durationMs) && durationMs > MAX_DURATION_MS;
  const startInPast = type !== "Emergency" && Number.isFinite(startMs) && startMs < now - 60_000;

  const checklist = useMemo(() => [
    { label: "Title filled in", done: title.trim().length > 0 },
    { label: "Schedule is valid", done: Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs && !startInPast },
    { label: "Scope covers at least one target", done: coveredHosts.length > 0 },
    { label: "Owner assigned", done: owner.trim().length > 0 },
    { label: "Change ticket linked", done: changeTicket.trim().length > 0 },
  ], [title, startMs, endMs, startInPast, coveredHosts.length, owner, changeTicket]);
  const checklistDone = checklist.filter((item) => item.done).length;

  const applyDurationChip = useCallback((minutes: number) => {
    if (!Number.isFinite(startMs)) return;
    setEndText(toLocalInput(startMs + minutes * 60_000));
  }, [startMs]);

  const startsNow = useCallback(() => {
    const nowMs = Date.now();
    const duration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 60 * 60_000;
    setStartText(toLocalInput(nowMs));
    setEndText(toLocalInput(nowMs + duration));
  }, [durationMs]);

  const toggleDay = useCallback((day: number) => {
    setRecurrenceDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort());
  }, []);

  const validate = useCallback(() => {
    const next: typeof errors = {};
    if (!title.trim()) next.title = "A title is required.";
    if (!Number.isFinite(startMs)) next.start = "Start time is required.";
    if (!Number.isFinite(endMs)) next.end = "End time is required.";
    else if (Number.isFinite(startMs) && endMs <= startMs) next.end = "End must be after start.";
    else if (startInPast) next.start = "Start cannot be in the past (except for Emergency windows).";
    if (!owner.trim()) next.owner = "An owner is required.";
    setErrors(next);
    return next;
  }, [title, startMs, endMs, startInPast, owner]);

  const buildInput = useCallback(() => ({
    title,
    description,
    type,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    timeZone,
    recurrence: { kind: recurrenceKind, days: recurrenceKind === "none" || recurrenceKind === "daily" ? [] : recurrenceDays, until: recurrenceKind === "none" ? null : (recurrenceUntil || null) },
    scope: { servers, groups, services, tags, exclude },
    alertBehavior: { muteAlerts, suppressIncidents, allowCritical, mutedRuleIds, autoEnd },
    owner,
    approver: type === "Emergency" ? null : (approver || null),
    approvalStatus: (type === "Emergency" || (editing != null && approver === (editing.approver ?? "") && editing.approvalStatus === "Approved") ? "Approved" : "Pending") as "Approved" | "Pending",
    changeTicket: changeTicket.trim() || null,
    notifyChannels: channels,
    impact: impact.trim() || "Impact not specified.",
    statusUpdate,
  }), [title, description, type, startMs, endMs, timeZone, recurrenceKind, recurrenceDays, recurrenceUntil, servers, groups, services, tags, exclude, muteAlerts, suppressIncidents, allowCritical, mutedRuleIds, autoEnd, owner, approver, changeTicket, channels, impact, statusUpdate, editing]);

  const persist = useCallback(() => {
    setSubmitting(true);
    const input = buildInput();
    window.setTimeout(() => {
      if (mode === "edit" && editing) {
        updateWindow(editing.id, input);
        try { window.sessionStorage.setItem("nexus:maintenance-toast", `${editing.id} updated`); } catch { /* sessionStorage unavailable */ }
        router.push(`/maintenance-windows/${editing.id}`);
      } else {
        const id = createWindow(input);
        try { window.sessionStorage.setItem("nexus:maintenance-toast", `${id} scheduled`); } catch { /* sessionStorage unavailable */ }
        router.push(`/maintenance-windows/${id}`);
      }
    }, 350);
  }, [buildInput, mode, editing, updateWindow, createWindow, router]);

  const handleSubmit = useCallback((event?: React.FormEvent) => {
    event?.preventDefault();
    const next = validate();
    if (Object.keys(next).length > 0) {
      const order: Array<keyof typeof next> = ["title", "start", "end", "owner"];
      const first = order.find((key) => next[key]);
      if (first) document.getElementById(`field-${first}`)?.focus();
      return;
    }
    if (type === "Emergency") { setConfirmSubmit("emergency"); return; }
    if (conflicts.length > 0) { setConfirmSubmit("conflict"); return; }
    persist();
  }, [validate, type, conflicts.length, persist]);

/* ----------------------------------- render ---------------------------------- */

  const tzNow = useMemo(() => new Date(now).toLocaleString(undefined, { timeZone, dateStyle: "medium", timeStyle: "short" }), [now, timeZone]);
  const startValid = Number.isFinite(startMs);
  const endValid = Number.isFinite(endMs);
  const scheduleSummary = startValid && endValid
    ? `${new Date(startMs).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}, ${new Date(startMs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} → ${new Date(endMs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
    : "Pick a start and end time";
  const durationLabel = Number.isFinite(durationMs) && durationMs > 0
    ? durationMs >= 24 * 60 * 60_000 ? `${Math.floor(durationMs / 86_400_000)}d ${Math.floor((durationMs % 86_400_000) / 3_600_000)}h` : durationMs >= 3_600_000 ? `${Math.floor(durationMs / 3_600_000)}h ${Math.round((durationMs % 3_600_000) / 60_000)}m` : `${Math.round(durationMs / 60_000)}m`
    : null;

  const breadcrumbTail = mode === "edit" && editing ? editing.id : "Schedule";
  const submitLabel = mode === "edit" ? "Save changes" : "Schedule Maintenance";

  if (isLoading) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Operations", "Maintenance Windows", breadcrumbTail]} title="Loading…" subtitle="Loading maintenance window details" icon={<Wrench size={22} />} iconClassName="h-11 w-11 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" />
        <div aria-busy="true" className="grid items-start gap-4 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-8">
            <div className="h-[300px] animate-pulse rounded-xl bg-muted" />
            <div className="h-[240px] animate-pulse rounded-xl bg-muted" />
            <div className="h-[260px] animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="space-y-4 xl:col-span-4">
            <div className="h-[280px] animate-pulse rounded-xl bg-muted" />
            <div className="h-[200px] animate-pulse rounded-xl bg-muted" />
            <div className="h-[240px] animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Operations", "Maintenance Windows", breadcrumbTail]} title="Maintenance windows unavailable" subtitle="The maintenance service failed to respond." icon={<Wrench size={22} />} iconClassName="h-11 w-11 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" />
        <section role="alert" className="grid min-h-[320px] place-items-center rounded-xl border border-border bg-card p-6 text-center">
          <div className="flex max-w-md flex-col items-center gap-2">
            <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-[#DC2626] dark:bg-red-500/10"><AlertTriangle size={20} /></span>
            <p className="font-display text-base font-bold text-foreground">Couldn’t load the form data</p>
            <p className="text-sm text-muted-foreground">Retry to reach the maintenance service again.</p>
            <Button onClick={reload} className="h-10 gap-1.5 rounded-lg px-4 text-sm"><RotateCcw size={15} />Retry</Button>
          </div>
        </section>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Operations", "Maintenance Windows", windowId ?? "Not found"]} title="Window not found" subtitle="No maintenance window with this ID exists." icon={<Wrench size={22} />} iconClassName="h-11 w-11 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" />
        <section role="alert" className="grid min-h-[320px] place-items-center rounded-xl border border-border bg-card p-6 text-center">
          <div className="flex max-w-md flex-col items-center gap-2">
            <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground"><Wrench size={20} /></span>
            <p className="font-display text-base font-bold text-foreground">Window not found</p>
            <p className="text-sm text-muted-foreground"><span className="font-mono">{windowId}</span> does not exist or was already purged.</p>
            <Link href="/maintenance-windows" className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><ArrowLeft size={15} />Back to Maintenance Windows</Link>
          </div>
        </section>
      </div>
    );
  }

  if (terminal && editing) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader
          breadcrumbs={["Operations", "Maintenance Windows", editing.id]}
          title={editing.title}
          subtitle={`This window is ${editing.status.toLowerCase()} and can no longer be edited.`}
          icon={<Wrench size={22} />}
          iconClassName="h-11 w-11 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
          statusBadge={<span className="flex items-center gap-1.5"><WindowStatusBadge status={editing.status} /><WindowTypeBadge type={editing.type} /></span>}
          actions={<Link href={`/maintenance-windows/${editing.id}`} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft size={15} />Back to window</Link>}
        />
        <section role="status" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <CheckCircle2 size={18} aria-hidden="true" className="shrink-0 text-emerald-600" />
          <span>The record is read-only. <Link className="font-semibold text-primary hover:underline" href={`/maintenance-windows/${editing.id}`}>Duplicate this window</Link> to schedule a similar one.</span>
        </section>
      </div>
    );
  }

  const sectionHeader = (step: number, titleText: string, hint?: string) => (
    <div className="mb-3 flex items-center gap-2.5">
      <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-[12px] font-bold text-primary">{step}</span>
      <h2 id={step === 1 ? "section-basics" : `section-${step}`} className="font-display text-sm font-bold text-foreground">{titleText}</h2>
      {hint && <span className="text-[12px] text-muted-foreground">{hint}</span>}
    </div>
  );

  const fieldLabel = (htmlFor: string, children: React.ReactNode, required = false) => (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground">{children}{required && <span aria-hidden="true" className="ml-0.5 text-red-500">*</span>}</label>
  );

  const fieldError = (key: "title" | "start" | "end" | "owner") => errors[key]
    ? <p role="alert" className="mt-1 text-[12px] text-red-600 dark:text-red-400">{errors[key]}</p>
    : null;

  const checkboxCard = (id: string, checked: boolean, onChange: (value: boolean) => void, icon: React.ReactNode, titleText: string, desc: string, tone = "default") => (
    <label htmlFor={id} className={cn(
      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
      checked ? (tone === "red" ? "border-red-300 bg-red-50/60 dark:border-red-500/40 dark:bg-red-500/10" : "border-primary/50 bg-primary/5") : "border-border hover:bg-accent/50",
    )}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-[#1479e8]" />
      <span aria-hidden="true" className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{titleText}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{desc}</span>
      </span>
    </label>
  );

  const previewCount = coveredHosts.length;
  const excludedFromRules = matchedRules.filter((rule) => mutedRuleIds.includes(rule.id)).length;

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Operations", "Maintenance Windows", breadcrumbTail]}
        title={mode === "edit" ? (editing?.title ?? "Edit window") : "Schedule Maintenance"}
        subtitle={mode === "edit" ? "Update the schedule, scope and alert behaviour for this window." : "Silence alerts during planned maintenance for affected infrastructure."}
        icon={<Wrench size={22} />}
        iconClassName="h-11 w-11 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link href={editing ? `/maintenance-windows/${editing.id}` : "/maintenance-windows"} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-input bg-card px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Cancel</Link>
            <Button onClick={() => handleSubmit()} disabled={submitting} className="h-10 gap-1.5 rounded-lg px-4 text-sm font-semibold">
              {submitting ? <><RotateCcw size={15} className="animate-spin" aria-hidden="true" />Saving…</> : <><CalendarClock size={15} aria-hidden="true" />{submitLabel}</>}
            </Button>
          </div>
        }
      />

      <form onSubmit={handleSubmit} noValidate className="grid items-start gap-4 xl:grid-cols-12">
        {/* ------------------------------- left column ------------------------------ */}
        <div className="min-w-0 space-y-4 xl:col-span-8">

          {/* 1. Basics */}
          <section aria-labelledby="section-basics" className="rounded-xl border border-border bg-card p-4">
            {sectionHeader(1, "Basics")}
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  {fieldLabel("field-title", "Title", true)}
                  <span className="text-[12px] tabular-nums text-muted-foreground">{title.length}/{MAX_TITLE}</span>
                </div>
                <Input
                  id="field-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value.slice(0, MAX_TITLE))}
                  placeholder="e.g. Database failover rehearsal"
                  maxLength={MAX_TITLE}
                  aria-invalid={Boolean(errors.title)}
                  className={cn("h-10 text-sm font-medium", errors.title && "border-red-400")}
                />
                {fieldError("title")}
              </div>

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-foreground">Type</legend>
                <div role="radiogroup" aria-label="Window type" className="grid gap-2 sm:grid-cols-3">
                  {TYPE_CARDS.map(({ value, icon: Icon, blurb }) => {
                    const selected = type === value;
                    return (
                      <label
                        key={value}
                        className={cn(
                          "cursor-pointer rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-ring",
                          selected ? (value === "Emergency" ? "border-red-400 bg-red-50/60 ring-1 ring-red-400 dark:border-red-500/50 dark:bg-red-500/10" : "border-primary/60 bg-primary/5 ring-1 ring-primary/60") : "border-border hover:bg-accent/50",
                        )}
                      >
                        <input type="radio" name="window-type" value={value} checked={selected} onChange={() => setTypeAndPrefill(value)} className="sr-only" />
                        <Icon size={17} aria-hidden="true" className={cn("mb-1.5", value === "Emergency" ? "text-red-600 dark:text-red-400" : "text-foreground")} />
                        <span className="block text-sm font-bold text-foreground">{value}</span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{blurb}</span>
                      </label>
                    );
                  })}
                </div>
                {type === "Emergency" && (
                  <p role="note" className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    <Zap size={13} aria-hidden="true" className="mt-0.5 shrink-0" />Emergency windows skip the approver and may start immediately. SEV1 alerts still break through.
                  </p>
                )}
              </fieldset>

              <div>
                {fieldLabel("field-description", "Description")}
                <textarea
                  id="field-description"
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What changes, how it is verified, and the rollback plan."
                  className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  {fieldLabel("field-impact", "Impact")}
                  <Input id="field-impact" value={impact} onChange={(event) => setImpact(event.target.value)} placeholder="API restart, ~5 min downtime" className="h-9 text-sm" />
                </div>
                <div>
                  {fieldLabel("field-ticket", "Change ticket")}
                  <div className="relative">
                    <Ticket size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="field-ticket" value={changeTicket} onChange={(event) => setChangeTicket(event.target.value)} placeholder="CHG-2041" className="h-9 pl-9 text-sm font-mono" aria-describedby="ticket-hint" />
                  </div>
                  <p id="ticket-hint" className="mt-1 text-[12px] text-muted-foreground">ITIL change-request id for audit trail.</p>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Schedule */}
          <section aria-labelledby="section-2" className="rounded-xl border border-border bg-card p-4">
            {sectionHeader(2, "Schedule")}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                {fieldLabel("field-start", "Starts", true)}
                <Input
                  id="field-start"
                  type="datetime-local"
                  value={startText}
                  onChange={(event) => setStartText(event.target.value)}
                  aria-invalid={Boolean(errors.start)}
                  className={cn("h-9 text-sm tabular-nums", errors.start && "border-red-400")}
                />
                {fieldError("start")}
              </div>
              <div>
                {fieldLabel("field-end", "Ends", true)}
                <Input
                  id="field-end"
                  type="datetime-local"
                  value={endText}
                  min={startText}
                  onChange={(event) => setEndText(event.target.value)}
                  aria-invalid={Boolean(errors.end)}
                  className={cn("h-9 text-sm tabular-nums", errors.end && "border-red-400")}
                />
                {fieldError("end")}
              </div>
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                {fieldLabel("field-timezone", "Time zone")}
                <Select value={timeZone} onValueChange={setTimeZone}>
                  <SelectTrigger id="field-timezone" className="h-9 text-sm" aria-label="Time zone"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_TIME_ZONES.map((zone) => <SelectItem key={zone} value={zone}>{zone}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[12px] text-muted-foreground">Your local time now: <span className="tabular-nums text-foreground">{tzNow}</span></p>
              </div>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-foreground">Quick duration</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[["30m", 30], ["1h", 60], ["2h", 120], ["4h", 240], ["8h", 480]].map(([label, minutes]) => (
                    <button
                      key={label as string}
                      type="button"
                      onClick={() => applyDurationChip(minutes as number)}
                      className="h-8 rounded-lg border border-border bg-card px-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {label as string}
                    </button>
                  ))}
                  <button type="button" onClick={startsNow} className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/40 bg-primary/5 px-2.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Zap size={12} aria-hidden="true" />Starts now
                  </button>
                </div>
                {durationLabel && <p className="mt-1 text-[12px] text-muted-foreground">Duration: <span className="font-semibold text-foreground">{durationLabel}</span></p>}
              </div>
            </div>

            {durationWarning && (
              <p role="alert" className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />Longer than 24 hours. Consider splitting this into multiple windows.
              </p>
            )}
            {startInPast && (
              <p role="alert" className="mt-3 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />Start time is in the past. Only Emergency windows can start in the past.
              </p>
            )}

            <div className="mt-4 border-t border-border/70 pt-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  {fieldLabel("field-recurrence", "Recurrence")}
                  <Select value={recurrenceKind} onValueChange={(value) => setRecurrenceKind(value as MaintenanceRecurrence["kind"])}>
                    <SelectTrigger id="field-recurrence" className="h-9 text-sm" aria-label="Recurrence"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Does not repeat</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {recurrenceKind === "weekly" && (
                  <div className="sm:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-foreground">Repeat on</span>
                    <div role="group" aria-label="Days of the week" className="flex flex-wrap gap-1">
                      {WEEKDAY_TOGGLES.map((label, index) => {
                        const selected = recurrenceDays.includes(index);
                        return (
                          <button
                            key={label}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleDay(index)}
                            className={cn(
                              "h-9 w-9 rounded-lg border text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent",
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {recurrenceKind === "monthly" && (
                  <div>
                    {fieldLabel("field-month-day", "Day of month")}
                    <Select value={String(recurrenceDays[0] ?? new Date(startMs || Date.now()).getDate())} onValueChange={(value) => setRecurrenceDays([Number(value)])}>
                      <SelectTrigger id="field-month-day" className="h-9 text-sm" aria-label="Day of month"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => <SelectItem key={day} value={String(day)}>{day}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {recurrenceKind !== "none" && (
                  <div>
                    {fieldLabel("field-until", "Until")}
                    <Input id="field-until" type="date" value={recurrenceUntil} min={toLocalInput(Date.now()).slice(0, 10)} onChange={(event) => setRecurrenceUntil(event.target.value)} className="h-9 text-sm" />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 3. Scope */}
          <section aria-labelledby="section-3" className="rounded-xl border border-border bg-card p-4">
            {sectionHeader(3, "Scope", "Who and what this window covers")}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                {fieldLabel("field-servers", "Servers")}
                <SearchableMultiSelect label="Add servers" options={SCOPE_SERVERS.map((server) => ({ value: server, label: server }))} selected={servers} onChange={setServers} placeholder="Filter servers…" />
                <SelectedChips values={servers} onRemove={(value) => setServers((current) => current.filter((item) => item !== value))} mono />
              </div>
              <div>
                {fieldLabel("field-groups", "Server groups")}
                <SearchableMultiSelect label="Add groups" options={SCOPE_GROUPS.map((group) => ({ value: group.id, label: group.name }))} selected={groups} onChange={setGroups} placeholder="Filter groups…" />
                <SelectedChips values={groups.map((id) => SCOPE_GROUPS.find((group) => group.id === id)?.name ?? id)} onRemove={(name) => setGroups((current) => current.filter((id) => (SCOPE_GROUPS.find((group) => group.name === name)?.id ?? name) !== id))} />
              </div>
              <div>
                {fieldLabel("field-services", "Services")}
                <SearchableMultiSelect label="Add services" options={SCOPE_SERVICES.map((service) => ({ value: service, label: service }))} selected={services} onChange={setServices} placeholder="Filter services…" />
                <SelectedChips values={services} onRemove={(value) => setServices((current) => current.filter((item) => item !== value))} />
              </div>
              <div>
                {fieldLabel("field-tags", "Tags")}
                <SearchableMultiSelect label="Add tags" options={SCOPE_TAGS.map((tag) => ({ value: tag, label: tag }))} selected={tags} onChange={setTags} placeholder="Filter tags…" />
                <SelectedChips values={tags} onRemove={(value) => setTags((current) => current.filter((item) => item !== value))} />
              </div>
            </div>
            <div className="mt-4 border-t border-border/70 pt-4">
              {fieldLabel("field-exclude", "Exclude")}
              <SearchableMultiSelect label="Exclude servers from scope" options={SCOPE_SERVERS.map((server) => ({ value: server, label: server }))} selected={exclude} onChange={setExclude} placeholder="Filter servers to exclude…" />
              <SelectedChips values={exclude} onRemove={(value) => setExclude((current) => current.filter((item) => item !== value))} mono />
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[12px] font-semibold text-foreground"><CheckCircle2 size={12} aria-hidden="true" className="text-emerald-600" />{previewCount} server{previewCount === 1 ? "" : "s"} covered</span>
                {previewCount === 0 && <span className="text-red-600 dark:text-red-400">Select at least one target.</span>}
              </p>
            </div>
          </section>

          {/* 4. Alert behaviour */}
          <section aria-labelledby="section-4" className="rounded-xl border border-border bg-card p-4">
            {sectionHeader(4, "Alert behaviour", "What happens to alerts while the window runs")}
            <div className="grid gap-2">
              {checkboxCard("cb-mute", muteAlerts, setMuteAlerts, <BellOff size={15} aria-hidden="true" />, "Mute alerts for scope", "Rules targeting the covered hosts are silenced while this window is active.")}
              {checkboxCard("cb-suppress", suppressIncidents, setSuppressIncidents, <ShieldOff size={15} aria-hidden="true" />, "Suppress incident creation", "Auto-created incidents from muted rules are suppressed and linked to this window.", "default")}
              {checkboxCard("cb-critical", allowCritical, setAllowCritical, <ShieldCheck size={15} aria-hidden="true" />, "Allow Critical (SEV1) alerts to break through", "SEV1 / critical rules still page even while the window is active.", "red")}
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">Mute specific rules</span>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="tabular-nums text-muted-foreground">{excludedFromRules} of {matchedRules.length} rules selected</span>
                  {matchedRules.length > 0 && (
                    <button type="button" className="font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded" onClick={() => setMutedRuleIds((current) => current.length === matchedRules.length ? [] : matchedRules.map((rule) => rule.id))}>
                      {excludedFromRules === matchedRules.length ? "Clear all" : "Select all"}
                    </button>
                  )}
                </div>
              </div>
              {muteAlerts ? (
                <div className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border border-border">
                  {matchedRules.map((rule) => {
                    const checked = mutedRuleIds.includes(rule.id);
                    return (
                      <label key={rule.id} className="flex cursor-pointer items-center gap-2 border-b border-border/60 px-2.5 py-1.5 text-[13px] transition-colors last:border-b-0 hover:bg-accent/50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setMutedRuleIds((current) => checked ? current.filter((id) => id !== rule.id) : [...current, rule.id])}
                          className="h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-[#1479e8]"
                          aria-label={`Mute ${rule.id} ${rule.name}`}
                        />
                        <span className="w-16 shrink-0 font-mono text-[12px] text-muted-foreground">{rule.id}</span>
                        <span className="min-w-0 flex-1 truncate text-foreground" title={rule.name}>{rule.name}</span>
                        <span className="hidden shrink-0 text-[12px] text-muted-foreground sm:inline">{rule.target}</span>
                      </label>
                    );
                  })}
                  {matchedRules.length === 0 && <p className="px-3 py-3 text-[13px] text-muted-foreground">No alert rules target the covered hosts.</p>}
                </div>
              ) : (
                <p className="mt-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">Enable “Mute alerts for scope” to pick specific rules.</p>
              )}
            </div>

            <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border p-3">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Auto-end and unmute</span>
                <span className="mt-0.5 block text-[12px] text-muted-foreground">When the end time passes, the window closes itself and alerts are restored.</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={autoEnd}
                aria-label="Auto-end and unmute"
                onClick={(event) => { event.preventDefault(); setAutoEnd((value) => !value); }}
                className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", autoEnd ? "bg-primary" : "bg-muted")}
              >
                <span aria-hidden="true" className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", autoEnd ? "left-[22px]" : "left-0.5")} />
              </button>
            </label>
          </section>

          {/* 5. People & notifications */}
          <section aria-labelledby="section-5" className="rounded-xl border border-border bg-card p-4">
            {sectionHeader(5, "People & notifications")}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                {fieldLabel("field-owner", "Owner", true)}
                <Select value={owner} onValueChange={setOwner}>
                  <SelectTrigger id="field-owner" aria-label="Owner" aria-invalid={Boolean(errors.owner)} className={cn("h-9 text-sm", errors.owner && "border-red-400")}><SelectValue placeholder="Assign an owner" /></SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_PEOPLE.map((person) => <SelectItem key={person} value={person}>{person}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fieldError("owner")}
              </div>
              <div>
                {fieldLabel("field-approver", "Approver")}
                {type === "Emergency" ? (
                  <p className="flex h-9 items-center rounded-lg border border-dashed border-border bg-muted/30 px-3 text-[13px] text-muted-foreground">Skipped for Emergency windows</p>
                ) : (
                  <Select value={approver || "none"} onValueChange={(value) => setApprover(value === "none" ? "" : value)}>
                    <SelectTrigger id="field-approver" className="h-9 text-sm" aria-label="Approver"><SelectValue placeholder="Select approver" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No approver</SelectItem>
                      {MAINTENANCE_PEOPLE.map((person) => <SelectItem key={person} value={person}>{person}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <fieldset className="mt-4">
              <legend className="mb-1.5 text-sm font-medium text-foreground">Notify via</legend>
              <div className="flex flex-wrap gap-2">
                {MAINTENANCE_CHANNELS.map((channel) => {
                  const checked = channels.includes(channel);
                  return (
                    <button
                      key={channel}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => setChannels((current) => checked ? current.filter((item) => item !== channel) : [...current, channel])}
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        checked ? "border-primary/60 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {checked && <Check size={13} aria-hidden="true" />}
                      {channel}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <span className="mb-1.5 block text-sm font-medium text-foreground">Notify before start</span>
                <div role="group" aria-label="Notify before start" className="flex gap-1.5">
                  {(["15m", "1h", "24h"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={notifyBefore === value}
                      onClick={() => setNotifyBefore(value)}
                      className={cn(
                        "h-9 w-14 rounded-lg border text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        notifyBefore === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <label htmlFor="field-status-update" className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">Post status update</span>
                <textarea
                  id="field-status-update"
                  rows={1}
                  value={statusUpdate}
                  onChange={(event) => setStatusUpdate(event.target.value)}
                  placeholder="Initial note posted to the timeline (optional)"
                  className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
          </section>
        </div>

        {/* ------------------------------- right column ------------------------------ */}
        <div className="min-w-0 space-y-4 xl:col-span-4 xl:sticky xl:top-4">

          {/* Preview */}
          <section aria-labelledby="section-preview" className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id="section-preview" className="font-display text-sm font-bold text-foreground">Preview</h2>
            </div>
            <p className={cn("font-semibold leading-snug text-foreground", !title.trim() && "text-muted-foreground")}>{title.trim() || "Untitled window"}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <WindowStatusBadge status="Scheduled" />
              <WindowTypeBadge type={type} />
              {recurrenceKind !== "none" && <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-[12px] font-semibold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"><Repeat size={11} aria-hidden="true" />{recurrenceKind === "daily" ? "Daily" : recurrenceKind === "weekly" ? "Weekly" : "Monthly"}</span>}
            </div>
            <dl className="mt-3 space-y-2 text-[13px]">
              <div className="flex items-start gap-2">
                <CalendarClock size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
                <span className="text-foreground">{scheduleSummary}{durationLabel && <span className="text-muted-foreground"> · {durationLabel}</span>}<br /><span className="text-[12px] text-muted-foreground">{timeZone} (window) · your time shown above</span></span>
              </div>
              <div className="flex items-start gap-2">
                <Wrench size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
                <span className="text-foreground">{previewCount} server{previewCount === 1 ? "" : "s"} covered</span>
              </div>
              <div className="flex items-start gap-2">
                {muteAlerts ? <BellOff size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" /> : <Bell size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />}
                <span className="text-foreground">
                  {muteAlerts
                    ? <><b>{excludedFromRules}</b> alert rule{excludedFromRules === 1 ? "" : "s"} will be muted · <b>{affectedOpenIncidents}</b> incident{affectedOpenIncidents === 1 ? "" : "s"} suppressed</>
                    : "Alerts will stay live during this window"}
                </span>
              </div>
              {channels.length > 0 && (
                <div className="flex items-start gap-2">
                  <Siren size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="text-foreground">Notify {channels.join(", ")} · {notifyBefore} before start</span>
                </div>
              )}
            </dl>
            {previewCount > 0 && (
              <div className="mt-3 flex flex-wrap gap-1 border-t border-border/70 pt-3">
                {[...servers, ...groups].slice(0, 6).map((chip) => <span key={chip} className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[12px] text-muted-foreground">{chip}</span>)}
                {previewCount > 6 && <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[12px] font-semibold text-muted-foreground">+{previewCount - 6}</span>}
              </div>
            )}
          </section>

          {/* Conflicts */}
          <section aria-labelledby="section-conflicts" className={cn("rounded-xl border p-4", conflicts.length > 0 ? "border-red-300 bg-red-50/60 dark:border-red-500/40 dark:bg-red-500/10" : "border-border bg-card")}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id="section-conflicts" className="font-display text-sm font-bold text-foreground">Conflicts</h2>
              {conflicts.length > 0 && <ConflictBadge />}
            </div>
            {conflicts.length === 0 ? (
              <p className="flex items-start gap-2 text-[13px] text-muted-foreground"><CheckCircle2 size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-600" />No overlapping windows on this scope.</p>
            ) : (
              <>
                <p className="flex items-start gap-2 text-[13px] font-semibold text-red-800 dark:text-red-300"><AlertTriangle size={15} aria-hidden="true" className="mt-0.5 shrink-0" />{conflicts.length} overlapping window{conflicts.length === 1 ? "" : "s"} on this scope:</p>
                <ul className="mt-2 space-y-1.5">
                  {conflicts.slice(0, 4).map((conflict) => (
                    <li key={conflict.id}>
                      <Link href={`/maintenance-windows/${conflict.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[13px] transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-red-500/30 dark:bg-red-500/10">
                        <span className="min-w-0"><span className="font-mono text-[12px] text-muted-foreground">{conflict.id}</span><span className="block truncate font-medium text-foreground">{conflict.title}</span></span>
                        <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{new Date(conflict.start).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[12px] text-red-800/80 dark:text-red-300/80">Submitting anyway will keep both windows and their mutes active.</p>
              </>
            )}
          </section>

          {/* Checklist */}
          <section aria-labelledby="section-checklist" className="rounded-xl border border-border bg-card p-4">
            <h2 id="section-checklist" className="font-display text-sm font-bold text-foreground">Checklist</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground"><b className={checklistDone === checklist.length ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}>{checklistDone} of {checklist.length}</b> required done</p>
            <div role="progressbar" aria-valuenow={checklistDone} aria-valuemin={0} aria-valuemax={checklist.length} aria-label="Required fields completed" className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-all", checklistDone === checklist.length ? "bg-emerald-500" : "bg-primary")} style={{ width: `${(checklistDone / checklist.length) * 100}%` }} />
            </div>
            <ul className="mt-3 space-y-1.5">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-[13px]">
                  {item.done
                    ? <CheckCircle2 size={15} aria-hidden="true" className="shrink-0 text-emerald-600" />
                    : <Circle size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />}
                  <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-border/70 pt-2 text-[12px] text-muted-foreground">Local preview · nothing is saved until you submit.</p>
          </section>
        </div>
      </form>

      {/* Emergency submit confirmation */}
      <Dialog open={confirmSubmit === "emergency"} onOpenChange={(open) => { if (!open) setConfirmSubmit(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start this emergency window now?</DialogTitle>
            <DialogDescription>
              {excludedFromRules} alert rule{excludedFromRules === 1 ? "" : "s"} will be muted across {previewCount} server{previewCount === 1 ? "" : "s"}. SEV1 alerts still break through. Approver is skipped for Emergency windows.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-10 rounded-lg px-4 text-sm" onClick={() => setConfirmSubmit(null)}>Back</Button>
            <Button className="h-10 rounded-lg bg-[#DC2626] px-4 text-sm font-semibold text-white hover:bg-[#B91C1C]" onClick={() => { setConfirmSubmit(null); persist(); }}>Start now and mute {excludedFromRules}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflict submit confirmation */}
      <Dialog open={confirmSubmit === "conflict"} onOpenChange={(open) => { if (!open) setConfirmSubmit(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scope overlaps {conflicts.length === 1 ? conflicts[0]?.id : `${conflicts.length} windows`}</DialogTitle>
            <DialogDescription>
              {conflicts.slice(0, 3).map((conflict) => conflict.id).join(", ")}{conflicts.length > 3 ? "…" : ""} overlap this window on the same hosts. Alerts may be double-muted. Schedule anyway?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-10 rounded-lg px-4 text-sm" onClick={() => setConfirmSubmit(null)}>Fix scope first</Button>
            <Button className="h-10 rounded-lg px-4 text-sm font-semibold" onClick={() => { setConfirmSubmit(null); persist(); }}>Schedule anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
