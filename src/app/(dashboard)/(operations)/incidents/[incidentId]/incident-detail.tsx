"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowDown, ArrowUp, Check, CheckCheck, CheckCircle2, ChevronLeft, ChevronRight,
  ChevronsUp, Clock3, FileText, MoreVertical, Phone, RotateCcw, Siren, Target, TriangleAlert, X, type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AlertMenu, type AlertMenuItem } from "@/components/alerts/alert-menu";
import { ChartCard } from "@/components/logs/primitives";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { SeverityBadge, StatusBadge, STATUS_META } from "@/components/shared/incident-badges";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CURRENT_USER_NAME, INCIDENT_PEOPLE, ON_CALL, STATUS_ORDER, durationMinutes, formatMinutes, isOpenIncident,
  linkedAlerts, severityRank, type Incident, type IncidentStatus,
} from "@/mocks/incidents";
import { useIncidents } from "@/mocks/useIncidents";
import { fullTimestamp, timeAgo } from "@/mocks/logs";
import { cn } from "@/lib/utils";

const TIMELINE_META: Record<string, { icon: LucideIcon; tone: string; label: string }> = {
  created: { icon: Siren, tone: "bg-red-100 text-[#DC2626] dark:bg-red-500/15 dark:text-red-400", label: "Declared" },
  acknowledged: { icon: CheckCheck, tone: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300", label: "Acknowledged" },
  update: { icon: FileText, tone: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300", label: "Update" },
  escalated: { icon: ChevronsUp, tone: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400", label: "Escalated" },
  resolved: { icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", label: "Resolved" },
};

const ALERT_SEVERITY_DOT: Record<string, string> = { critical: "#DC2626", warning: "#D97706", info: "#3B82F6" };

/** Re-render on an interval so "2h 14m" style durations stay live. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
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

const kebabButton = (label: string) => (
  <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label={label}><MoreVertical size={15} /></Button>
);

export function IncidentDetail({ incidentId }: { incidentId: string }) {
  const router = useRouter();
  const toastTimer = useRef<number | null>(null);

  const {
    incidents, status, reload,
    acknowledge, resolve, assign, escalate, addUpdate, toggleActionItem, startPostmortem, changeStatus,
  } = useIncidents();
  const isLoading = status === "loading";
  const isError = status === "error";

  const now = useNow(60_000);
  const [updateDraft, setUpdateDraft] = useState("");
  const [updateType, setUpdateType] = useState<"update" | "note" | "status">("update");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3800);
  }, []);

  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);

  /* Show the "INC-xxxx declared" toast handed off by the Declare page. */
  useEffect(() => {
    try {
      const declared = window.sessionStorage.getItem("nexus:incident-declared");
      if (declared) {
        window.sessionStorage.removeItem("nexus:incident-declared");
        showToast(`${declared} declared`);
      }
    } catch {
      /* sessionStorage unavailable — toast skipped */
    }
  }, [showToast]);

  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1 && document.referrer.includes("/incidents")) router.back();
    else router.push("/incidents");
  }, [router]);

  const incident = useMemo(() => incidents.find((item) => item.id === incidentId) ?? null, [incidents, incidentId]);

  const chronological = useMemo(() => [...incidents].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)), [incidents]);
  const currentIndex = chronological.findIndex((item) => item.id === incidentId);
  const newer = currentIndex > 0 ? chronological[currentIndex - 1] : null;
  const older = currentIndex >= 0 && currentIndex < chronological.length - 1 ? chronological[currentIndex + 1] : null;

  /* Team-wide averages for the response-metrics comparison */
  const averages = useMemo(() => {
    const ackDeltas = incidents
      .filter((item) => item.acknowledgedAt != null)
      .map((item) => (Date.parse(item.acknowledgedAt as string) - Date.parse(item.startedAt)) / 60_000);
    const resolveDeltas = incidents
      .filter((item): item is Incident & { resolvedAt: string } => item.resolvedAt != null)
      .map((item) => (Date.parse(item.resolvedAt) - Date.parse(item.startedAt)) / 60_000);
    const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
    return { mtta: mean(ackDeltas), mttr: mean(resolveDeltas) };
  }, [incidents]);

  /* Affected-service health derived from open incidents across the board */
  const serviceHealth = useMemo(() => {
    if (!incident) return [];
    return incident.affectedServices.map((service) => {
      const touching = incidents.filter((item) => isOpenIncident(item) && item.affectedServices.includes(service));
      const worst = touching.reduce((min, item) => Math.min(min, severityRank(item.severity)), Number.POSITIVE_INFINITY);
      if (touching.length === 0) return { service, label: "Operational", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" };
      if (worst <= 0) return { service, label: "Major outage", dot: "bg-red-500", text: "text-red-700 dark:text-red-400" };
      if (worst === 1) return { service, label: "Degraded", dot: "bg-orange-500", text: "text-orange-700 dark:text-orange-400" };
      return { service, label: "Degraded", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" };
    });
  }, [incident, incidents]);

  const handleAcknowledge = useCallback(() => { if (incident) { acknowledge([incident.id]); showToast(`${incident.id} acknowledged.`); } }, [incident, acknowledge, showToast]);
  const handleResolve = useCallback(() => { if (incident) { resolve([incident.id]); showToast(`${incident.id} resolved.`); } }, [incident, resolve, showToast]);
  const handleEscalate = useCallback(() => { if (incident) { escalate([incident.id]); showToast(`${incident.id} escalated to secondary responder.`); } }, [incident, escalate, showToast]);
  const handleAssign = useCallback((person: string | null) => { if (incident) { assign([incident.id], person); showToast(person ? `${incident.id} assigned to ${person}.` : `${incident.id} unassigned.`); } }, [incident, assign, showToast]);
  const handleStatus = useCallback((next: IncidentStatus) => { if (incident) { changeStatus([incident.id], next); showToast(`${incident.id} → ${next}.`); } }, [incident, changeStatus, showToast]);

  const submitUpdate = useCallback(() => {
    if (!incident || !updateDraft.trim()) return;
    addUpdate(incident.id, updateDraft.trim(), updateType);
    showToast(`Update posted on ${incident.id}.`);
    setUpdateDraft("");
  }, [incident, updateDraft, updateType, addUpdate, showToast]);

  const copy = useCallback((label: string, text: string) => {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => showToast(`${label} copied.`), () => showToast(text));
    else showToast(text);
  }, [showToast]);

  if (isLoading) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Operations", "Incidents", incidentId]} title="Incident" subtitle="Loading incident details…" icon={<Siren size={22} />} iconClassName="h-11 w-11 rounded-xl bg-[#ffeaec] text-[#DC2626] dark:bg-[#492a35] dark:text-[#ff8b98]" />
        <div aria-busy="true" className="grid items-stretch gap-4 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-8">
            <div className="h-[260px] animate-pulse rounded-xl bg-muted" />
            <div className="h-[320px] animate-pulse rounded-xl bg-muted" />
            <div className="h-[160px] animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="space-y-4 xl:col-span-4">
            <div className="h-[240px] animate-pulse rounded-xl bg-muted" />
            <div className="h-[200px] animate-pulse rounded-xl bg-muted" />
            <div className="h-[180px] animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Operations", "Incidents", incidentId]} title="Incident" subtitle="The incident could not be loaded." icon={<Siren size={22} />} iconClassName="h-11 w-11 rounded-xl bg-[#ffeaec] text-[#DC2626] dark:bg-[#492a35] dark:text-[#ff8b98]" />
        <section role="alert" className="grid min-h-[320px] place-items-center rounded-xl border border-border bg-card p-6 text-center">
          <div className="flex max-w-md flex-col items-center gap-2">
            <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-[#DC2626] dark:bg-red-500/10"><TriangleAlert size={20} /></span>
            <p className="font-display text-base font-bold text-foreground">Incident could not be loaded</p>
            <p className="text-sm text-muted-foreground">The incident service failed to respond. Retry to reload.</p>
            <Button onClick={reload} className="h-10 gap-1.5 rounded-lg px-4 text-sm"><RotateCcw size={15} />Retry</Button>
          </div>
        </section>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Operations", "Incidents", incidentId]} title="Incident not found" subtitle="No incident with this ID exists." icon={<Siren size={22} />} iconClassName="h-11 w-11 rounded-xl bg-[#ffeaec] text-[#DC2626] dark:bg-[#492a35] dark:text-[#ff8b98]" />
        <section role="alert" className="grid min-h-[320px] place-items-center rounded-xl border border-border bg-card p-6 text-center">
          <div className="flex max-w-md flex-col items-center gap-2">
            <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground"><Siren size={20} /></span>
            <p className="font-display text-base font-bold text-foreground">Incident not found</p>
            <p className="text-sm text-muted-foreground"><span className="font-mono">{incidentId}</span> does not exist or was merged into another incident.</p>
            <Link href="/incidents" className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><ArrowLeft size={15} />Back to Incidents</Link>
          </div>
        </section>
      </div>
    );
  }

  const open = isOpenIncident(incident);
  const ackMin = incident.acknowledgedAt ? (Date.parse(incident.acknowledgedAt) - Date.parse(incident.startedAt)) / 60_000 : null;
  const resolveMin = incident.resolvedAt ? (Date.parse(incident.resolvedAt) - Date.parse(incident.startedAt)) / 60_000 : null;
  const startedMs = Date.parse(incident.startedAt);
  const durationMin = durationMinutes(incident, now);
  const statusIndex = STATUS_ORDER.indexOf(incident.status);
  const linked = linkedAlerts(incident);
  const pmDone = incident.postmortem.actionItems.filter((item) => item.done).length;
  const pmTotal = incident.postmortem.actionItems.length;

  const assignItems: AlertMenuItem[] = [
    ...INCIDENT_PEOPLE.map((person) => ({ key: person, label: person, disabled: incident.assignee === person, onSelect: () => handleAssign(person) })),
    { key: "unassign", label: "Unassign", disabled: incident.assignee == null, onSelect: () => handleAssign(null) },
  ];
  const statusItems: AlertMenuItem[] = STATUS_ORDER.map((value) => ({ key: value, label: value, disabled: incident.status === value, onSelect: () => handleStatus(value) }));

  const mttaDelta = ackMin != null && averages.mtta != null ? ackMin - averages.mtta : null;
  const mttrDelta = resolveMin != null && averages.mttr != null ? resolveMin - averages.mttr : null;

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Operations", "Incidents", incident.id]}
        title={incident.title}
        subtitle={incident.impact}
        icon={<Siren size={22} />}
        iconClassName="h-11 w-11 rounded-xl bg-[#ffeaec] text-[#DC2626] dark:bg-[#492a35] dark:text-[#ff8b98]"
        statusBadge={<span className="flex items-center gap-1.5"><SeverityBadge severity={incident.severity} /><StatusBadge status={incident.status} /></span>}
        onRefresh={reload}
        lastUpdated={timeAgo(now)}
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={goBack} className="h-10 gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} aria-hidden="true" />Back to Incidents</Button>
            <Button variant="outline" onClick={handleAcknowledge} disabled={!open || incident.acknowledgedAt != null} className="h-10 gap-1.5 rounded-lg px-3 text-sm"><CheckCheck size={15} aria-hidden="true" />{incident.acknowledgedAt ? "Acknowledged" : "Acknowledge"}</Button>
            <AlertMenu
              label="Assign incident"
              trigger={<Button variant="outline" className="h-10 gap-1.5 rounded-lg px-3 text-sm"><InitialsAvatar name={incident.assignee ?? incident.commander} size={18} />Assign</Button>}
              items={assignItems}
            />
            <Button variant="outline" onClick={handleEscalate} disabled={!open} className="h-10 gap-1.5 rounded-lg border-orange-200 px-3 text-sm text-orange-700 hover:bg-orange-50 dark:border-orange-500/30 dark:text-orange-300"><ChevronsUp size={15} aria-hidden="true" />Escalate</Button>
            <AlertMenu
              label="Change status"
              trigger={<Button variant="outline" className="h-10 gap-1.5 rounded-lg px-3 text-sm">Change status</Button>}
              items={statusItems}
            />
            <Button onClick={handleResolve} disabled={!open} className="h-10 gap-1.5 rounded-lg bg-[#16A34A] px-4 text-sm font-semibold text-white hover:bg-[#128A3E]"><CheckCircle2 size={15} aria-hidden="true" />Resolve</Button>
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
                trigger={kebabButton("Overview options")}
                items={[
                  { key: "copy-link", label: "Copy incident link", onSelect: () => copy("Link", `${window.location.origin}/incidents/${incident.id}`) },
                  { key: "copy-summary", label: "Copy summary", onSelect: () => copy("Summary", `${incident.id} [${incident.severity}] ${incident.title} — ${incident.impact} — owner: ${incident.commander}`) },
                ]}
              />
            }
          >
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Impact</dt>
                <dd className="mt-1 text-sm leading-snug text-foreground">{incident.impact}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Started</dt>
                <dd className="mt-1 text-sm tabular-nums text-foreground" title={fullTimestamp(startedMs, false)}>{fullTimestamp(startedMs, true)}<span className="ml-1.5 text-[12px] text-muted-foreground">({timeAgo(startedMs)})</span></dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Duration {open && <span className="ml-1 normal-case text-red-600 dark:text-red-400">live</span>}</dt>
                <dd className="mt-1 text-sm tabular-nums text-foreground">{formatMinutes(durationMin)}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Commander</dt>
                <dd className="mt-1 flex items-center gap-2 text-sm text-foreground"><InitialsAvatar name={incident.commander} size={22} />{incident.commander}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Assignee</dt>
                <dd className="mt-1 flex items-center gap-2 text-sm text-foreground">{incident.assignee ? (<><InitialsAvatar name={incident.assignee} size={22} />{incident.assignee}</>) : <span className="text-muted-foreground">Unassigned</span>}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Team</dt>
                <dd className="mt-1 text-sm text-foreground">{incident.team}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">ID</dt>
                <dd className="mt-1 font-mono text-[13px] text-foreground">{incident.id}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Affected services</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {incident.affectedServices.map((service) => (
                    <Link key={service} href={`/incidents?service=${encodeURIComponent(service)}`} className="rounded-md border border-border bg-muted px-2 py-1 text-[12px] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{service}</Link>
                  ))}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Affected hosts</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {incident.affectedHosts.map((host) => (
                    <span key={host} className="rounded-md border border-border bg-card px-2 py-1 font-mono text-[12px] text-foreground">{host}</span>
                  ))}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Tags</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {incident.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-blue-50 px-2 py-0.5 text-[12px] font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-300">#{tag}</span>
                  ))}
                </dd>
              </div>
            </dl>
          </ChartCard>

          {/* Timeline */}
          <ChartCard
            title="Timeline"
            actions={
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-muted px-2 py-1 text-[12px] font-semibold tabular-nums text-muted-foreground">{incident.timeline.length} entries</span>
                <AlertMenu
                  label="Timeline options"
                  trigger={kebabButton("Timeline options")}
                  items={[{ key: "copy-md", label: "Copy timeline (Markdown)", onSelect: () => copy("Timeline", incident.timeline.map((entry) => `- ${new Date(entry.epochMs).toISOString()} **${entry.author}** — ${entry.text}`).join("\n")) }]}
                />
              </div>
            }
          >
            {/* Add update */}
            <form onSubmit={(event) => { event.preventDefault(); submitUpdate(); }} className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
              <label htmlFor="timeline-update" className="text-[12px] font-medium text-foreground">Add update</label>
              <textarea
                id="timeline-update"
                rows={2}
                value={updateDraft}
                onChange={(event) => setUpdateDraft(event.target.value)}
                placeholder="What changed? Impact, scope, next steps…"
                className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Select value={updateType} onValueChange={(value) => setUpdateType(value as "update" | "note" | "status")}>
                  <SelectTrigger className="h-9 w-[170px] text-sm" aria-label="Update type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="update" className="text-sm">Update</SelectItem>
                    <SelectItem value="note" className="text-sm">Internal note</SelectItem>
                    <SelectItem value="status" className="text-sm">Status change</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={!updateDraft.trim()} className="h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90">Post</Button>
              </div>
            </form>

            <ol className="relative ml-2 border-l-2 border-border pl-6">
              {incident.timeline.map((entry) => {
                const meta = TIMELINE_META[entry.type] ?? TIMELINE_META.update;
                const EntryIcon = meta.icon;
                return (
                  <li key={entry.id} className="relative pb-4 last:pb-0">
                    <span aria-hidden="true" className={cn("absolute -left-[34px] top-0.5 grid h-6 w-6 place-items-center rounded-full border border-border bg-card", meta.tone)}>
                      <EntryIcon size={12} />
                    </span>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-[12px] tabular-nums text-muted-foreground" title={fullTimestamp(entry.epochMs, false)}>{new Date(entry.epochMs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-[12px] text-muted-foreground">{timeAgo(entry.epochMs)}</span>
                      <span className="text-[12px] font-semibold text-muted-foreground">· {meta.label}</span>
                    </div>
                    <p className="mt-0.5 text-[13px] leading-snug text-foreground"><b>{entry.author === CURRENT_USER_NAME ? "You" : entry.author}</b> — {entry.text}</p>
                  </li>
                );
              })}
            </ol>
          </ChartCard>

          {/* Linked alerts */}
          <ChartCard
            title="Linked Alerts"
            actions={
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-muted px-2 py-1 text-[12px] font-semibold tabular-nums text-muted-foreground">{linked.length} linked</span>
                <AlertMenu
                  label="Linked alerts options"
                  trigger={kebabButton("Linked alerts options")}
                  items={[{ key: "alerts", label: "Open Alerts page", onSelect: () => router.push("/alerts") }]}
                />
              </div>
            }
          >
            {linked.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No alerts linked to this incident.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border/70">
                {linked.map((alert) => (
                  <li key={alert.id}>
                    <Link href={`/alerts?alert=${alert.id}`} className="flex items-center gap-3 rounded-md py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <i aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ALERT_SEVERITY_DOT[alert.severity] }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-foreground" title={alert.name}>{alert.name}</span>
                        <span className="mt-0.5 block font-mono text-[12px] text-muted-foreground">{alert.id} · {alert.host} · {timeAgo(alert.epochMs)}</span>
                      </span>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold", alert.status === "resolved" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" : alert.status === "acknowledged" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300")}>{alert.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>

          {/* Postmortem */}
          <ChartCard
            title="Postmortem"
            actions={
              <div className="flex items-center gap-1.5">
                {incident.postmortem.status !== "None" && (
                  <span className={cn("rounded-full px-2 py-1 text-[12px] font-semibold", incident.postmortem.status === "Published" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300")}>{incident.postmortem.status}</span>
                )}
                <AlertMenu
                  label="Postmortem options"
                  trigger={kebabButton("Postmortem options")}
                  items={incident.postmortem.status === "None"
                    ? [{ key: "start", label: "Start postmortem", onSelect: () => { startPostmortem(incident.id); showToast("Postmortem draft created."); } }]
                    : [
                        { key: "copy", label: "Export as Markdown", onSelect: () => downloadBlob(`# ${incident.id} — ${incident.title}\n\n## Summary\n${incident.postmortem.summary}\n\n## Root cause\n${incident.postmortem.rootCause}\n\n## Impact\n${incident.postmortem.impact}\n\n## Action items\n${incident.postmortem.actionItems.map((item) => `- [${item.done ? "x" : " "}] ${item.text} (${item.owner}, due ${item.due})`).join("\n")}`, "text/markdown;charset=utf-8", `${incident.id.toLowerCase()}-postmortem.md`) },
                        { key: "runbooks", label: "Open runbooks", onSelect: () => router.push("/runbooks") },
                      ]}
                />
              </div>
            }
          >
            {incident.postmortem.status === "None" ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <p className="text-sm font-medium text-foreground">No postmortem started yet</p>
                <p className="max-w-sm text-[13px] text-muted-foreground">Capture what happened, the root cause and the action items while it is fresh.</p>
                <Button onClick={() => { startPostmortem(incident.id); showToast("Postmortem draft created."); }} className="mt-1 h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90">Start postmortem</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <section>
                  <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Summary</h3>
                  <p className="mt-1 text-sm leading-snug text-foreground">{incident.postmortem.summary}</p>
                </section>
                <section className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Root cause</h3>
                    <p className="mt-1 text-sm leading-snug text-foreground">{incident.postmortem.rootCause}</p>
                  </div>
                  <div>
                    <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Impact</h3>
                    <p className="mt-1 text-sm leading-snug text-foreground">{incident.postmortem.impact}</p>
                  </div>
                </section>
                <section>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Action items</h3>
                    <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">{pmDone}/{pmTotal} done</span>
                  </div>
                  <span aria-hidden="true" className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pmTotal ? (pmDone / pmTotal) * 100 : 0}%` }} /></span>
                  <ul className="mt-2 flex flex-col divide-y divide-border/70">
                    {incident.postmortem.actionItems.map((item) => (
                      <li key={item.id} className="flex items-start gap-2.5 py-2">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={item.done}
                          aria-label={item.done ? `Mark action item not done: ${item.text}` : `Mark action item done: ${item.text}`}
                          onClick={() => toggleActionItem(incident.id, item.id)}
                          className={cn(
                            "mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            item.done ? "border-emerald-600 bg-emerald-600 text-white" : "border-border bg-card hover:border-primary",
                          )}
                        >
                          {item.done && <Check size={12} aria-hidden="true" />}
                        </button>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-[13px] leading-snug text-foreground", item.done && "text-muted-foreground line-through")}>{item.text}</span>
                          <span className="mt-0.5 block text-[12px] text-muted-foreground">{item.owner} · due {item.due}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}
          </ChartCard>
        </div>

        {/* ------------------------------- right column ------------------------------ */}
        <div className="min-w-0 space-y-4 xl:col-span-4">
          {/* Status stepper */}
          <ChartCard
            title="Status"
            actions={
              <AlertMenu
                label="Status options"
                trigger={kebabButton("Status options")}
                items={statusItems}
              />
            }
          >
            <ol className="flex flex-col gap-1.5" aria-label="Incident progress">
              {STATUS_ORDER.map((step, index) => {
                const meta = STATUS_META[step];
                const StepIcon = meta.icon;
                const isCurrent = index === statusIndex;
                const isPast = index < statusIndex;
                return (
                  <li key={step}>
                    <button
                      type="button"
                      onClick={() => handleStatus(step)}
                      aria-current={isCurrent ? "step" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isCurrent
                          ? cn("border-transparent bg-blue-50 ring-2 ring-inset ring-blue-400/50 dark:bg-blue-500/10")
                          : "border-border bg-card hover:bg-muted/40",
                      )}
                    >
                      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", isPast ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground")}>
                        {isPast ? <Check size={14} aria-hidden="true" /> : <StepIcon size={14} aria-hidden="true" />}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{step}</span>
                      {isCurrent && <span className="shrink-0 rounded-full bg-foreground/90 px-2 py-0.5 text-[12px] font-semibold text-background">Current</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </ChartCard>

          {/* Response metrics */}
          <ChartCard
            title="Response metrics"
            actions={
              <AlertMenu
                label="Response metrics options"
                trigger={kebabButton("Response metrics options")}
                items={[{ key: "copy", label: "Copy metrics", onSelect: () => copy("Metrics", `${incident.id} — MTTA ${ackMin != null ? formatMinutes(ackMin) : "—"}, MTTR ${resolveMin != null ? formatMinutes(resolveMin) : "— (open)"}, team MTTA ${averages.mtta != null ? formatMinutes(averages.mtta) : "—"}, team MTTR ${averages.mttr != null ? formatMinutes(averages.mttr) : "—"}`) }]}
              />
            }
          >
            <ul className="flex flex-col divide-y divide-border/70 text-sm">
              <li className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground"><Clock3 size={14} aria-hidden="true" />Time to acknowledge</span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">{ackMin != null ? formatMinutes(ackMin) : "—"}</span>
              </li>
              <li className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground"><Target size={14} aria-hidden="true" />Time to resolve</span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">{resolveMin != null ? formatMinutes(resolveMin) : `${formatMinutes(durationMin)} · open`}</span>
              </li>
              <li className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-muted-foreground">MTTA vs team avg</span>
                <span className={cn("flex shrink-0 items-center gap-1 font-semibold tabular-nums", mttaDelta == null ? "text-muted-foreground" : mttaDelta <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {mttaDelta == null ? "—" : (<>{mttaDelta <= 0 ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUp size={12} aria-hidden="true" />}{formatMinutes(Math.abs(mttaDelta))} vs {averages.mtta != null ? formatMinutes(averages.mtta) : "—"}</>)}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-muted-foreground">MTTR vs team avg</span>
                <span className={cn("flex shrink-0 items-center gap-1 font-semibold tabular-nums", mttrDelta == null ? "text-muted-foreground" : mttrDelta <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {mttrDelta == null ? "—" : (<>{mttrDelta <= 0 ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUp size={12} aria-hidden="true" />}{formatMinutes(Math.abs(mttrDelta))} vs {averages.mttr != null ? formatMinutes(averages.mttr) : "—"}</>)}
                </span>
              </li>
            </ul>
          </ChartCard>

          {/* People */}
          <ChartCard
            title="People"
            actions={
              <AlertMenu
                label="People options"
                trigger={kebabButton("People options")}
                items={[
                  { key: "copy", label: "Copy responder list", onSelect: () => copy("Responders", `${incident.id} — commander: ${incident.commander}; assignee: ${incident.assignee ?? "unassigned"}; on-call: ${ON_CALL.primary.name}`) },
                  { key: "page", label: "Page on-call", onSelect: () => showToast(`On-call paged — ${ON_CALL.primary.name} (${ON_CALL.primary.role}).`) },
                ]}
              />
            }
          >
            <ul className="flex flex-1 flex-col gap-3">
              {[
                { name: incident.commander, role: "Incident commander" },
                ...(incident.assignee && incident.assignee !== incident.commander ? [{ name: incident.assignee, role: "Responder" }] : []),
                { name: ON_CALL.primary.name, role: "On-call primary" },
              ].map(({ name, role }) => (
                <li key={`${role}-${name}`} className="flex items-center gap-3">
                  <InitialsAvatar name={name} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{name}{name === CURRENT_USER_NAME ? " (you)" : ""}</span>
                    <span className="block text-[12px] text-muted-foreground">{role}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Button variant="outline" onClick={() => showToast(`On-call paged — ${ON_CALL.primary.name} (${ON_CALL.primary.role}).`)} className="mt-3 h-9 w-full gap-1.5 rounded-lg text-sm"><Phone size={14} aria-hidden="true" />Page on-call</Button>
          </ChartCard>

          {/* Affected services health */}
          <ChartCard
            title="Affected services health"
            actions={
              <AlertMenu
                label="Service health options"
                trigger={kebabButton("Service health options")}
                items={[{ key: "deps", label: "View service dependencies", onSelect: () => router.push("/dependencies") }]}
              />
            }
          >
            <ul className="flex flex-1 flex-col divide-y divide-border/70">
              {serviceHealth.map(({ service, label, dot, text }) => (
                <li key={service} className="flex items-center gap-2.5 py-2.5">
                  <span aria-hidden="true" className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dot)} />
                  <span className="min-w-0 flex-1">
                    <Link href={`/incidents?service=${encodeURIComponent(service)}`} className="block truncate text-[13px] font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{service}</Link>
                    <span className="block truncate font-mono text-[12px] text-muted-foreground">{incident.affectedHosts.join(", ")}</span>
                  </span>
                  <span className={cn("shrink-0 text-[12px] font-semibold", text)}>{label}</span>
                </li>
              ))}
            </ul>
          </ChartCard>
        </div>
      </div>

      {/* Prev / next incident */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {newer ? (
          <Link href={`/incidents/${newer.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronLeft size={15} aria-hidden="true" />
            <span><span className="block text-left text-[12px] leading-none text-muted-foreground">Newer</span><span className="mt-0.5 block max-w-[220px] truncate font-mono text-[13px] font-semibold leading-none text-foreground">{newer.id}</span></span>
          </Link>
        ) : <span aria-hidden="true" />}
        {older ? (
          <Link href={`/incidents/${older.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span><span className="block text-right text-[12px] leading-none text-muted-foreground">Older</span><span className="mt-0.5 block max-w-[220px] truncate font-mono text-[13px] font-semibold leading-none text-foreground">{older.id}</span></span>
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
        ) : <span aria-hidden="true" />}
      </div>

      {/* Toast */}
      {toast && (
        <div role="status" className="fixed bottom-4 right-4 z-[1300] flex max-w-md items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-lg">
          <span className="min-w-0">{toast}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification" className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"><X size={14} aria-hidden="true" /></button>
        </div>
      )}
    </div>
  );
}
