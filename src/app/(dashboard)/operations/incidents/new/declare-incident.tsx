"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CalendarClock, Check, ChevronDown as ChevronDownIcon, ChevronUp, ChevronsUp, CircleAlert,
  Clock, CreditCard, Database, Eye, Globe, HardDrive, Hash, ListChecks, Loader2, Mail, MemoryStick, Minus,
  Phone, Router, Search, Server, Siren, UserRound, X, type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { SeverityBadge, StatusBadge } from "@/components/shared/incident-badges";
import { TechLogo } from "@/components/shared/icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { timeAgo } from "@/mocks/logs";
import {
  CURRENT_USER_NAME, INCIDENT_PEOPLE, INCIDENT_SERVICES, INCIDENT_TEAMS, ON_CALL, SERVICE_HOSTS,
  type IncidentSeverity,
} from "@/mocks/incidents";
import { useIncidents } from "@/mocks/useIncidents";
import { SAMPLE_ALERTS, type AlertSeverity } from "@/mocks/alerts";
import { cn } from "@/lib/utils";

const TITLE_MAX = 120;
const IMPACT_MAX = 500;
const TAG_MAX = 10;

const SEVERITY_CARDS: Array<{ severity: IncidentSeverity; icon: LucideIcon; title: string; description: string; active: string; radio: string }> = [
  { severity: "SEV1", icon: ChevronsUp, title: "SEV1 · Critical", description: "Major outage or data loss. Page everyone now; exec visibility.", active: "border-red-500 bg-red-50 ring-1 ring-red-500/40 dark:border-red-500/60 dark:bg-red-500/10", radio: "accent-[oklch(0.5771_0.2152_27.33)]" },
  { severity: "SEV2", icon: ChevronUp, title: "SEV2 · High", description: "Significant degradation for many users. Respond now.", active: "border-orange-500 bg-orange-50 ring-1 ring-orange-500/40 dark:border-orange-500/60 dark:bg-orange-500/10", radio: "accent-[oklch(0.6461_0.1943_41.12)]" },
  { severity: "SEV3", icon: Minus, title: "SEV3 · Medium", description: "Limited impact or partial degradation. Fix during business hours.", active: "border-amber-500 bg-amber-50 ring-1 ring-amber-500/40 dark:border-amber-500/60 dark:bg-amber-500/10", radio: "accent-[oklch(0.6658_0.1574_58.32)]" },
  { severity: "SEV4", icon: ChevronDownIcon, title: "SEV4 · Low", description: "Minor or cosmetic issue. Track and schedule.", active: "border-blue-500 bg-blue-50 ring-1 ring-blue-500/40 dark:border-blue-500/60 dark:bg-blue-500/10", radio: "accent-[oklch(0.6231_0.188_259.81)]" },
];

const SERVICE_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  "api-server": { icon: Server, color: "oklch(0.5461 0.2152 262.88)" },
  "app-server": { icon: Server, color: "oklch(0.6847 0.1479 237.32)" },
  "web-app": { icon: Globe, color: "oklch(0.6089 0.1109 221.72)" },
  database: { icon: Database, color: "oklch(0.4973 0.0875 245.25)" },
  cache: { icon: MemoryStick, color: "oklch(0.591 0.2022 28.73)" },
  "edge-proxy": { icon: Router, color: "oklch(0.5413 0.2466 293.01)" },
  scheduler: { icon: CalendarClock, color: "oklch(0.5544 0.0407 257.42)" },
  payment: { icon: CreditCard, color: "oklch(0.6271 0.1699 149.21)" },
  storage: { icon: HardDrive, color: "oklch(0.5109 0.0861 186.39)" },
};

const NOTIFY_CHANNELS: Array<{ id: string; label: string; icon: LucideIcon; hint?: string }> = [
  { id: "#incidents", label: "#incidents", icon: Hash, hint: "Public incident channel" },
  { id: "#sre-oncall", label: "#sre-oncall", icon: Hash, hint: "SRE on-call rotation" },
  { id: "#engineering", label: "#engineering", icon: Hash, hint: "All engineering" },
  { id: "email:oncall@nexus.io", label: "Email · oncall@nexus.io", icon: Mail, hint: "On-call distribution list" },
  { id: "PagerDuty", label: "PagerDuty", icon: Phone, hint: "Pages the on-call primary" },
];

const ALL_CHANNEL_IDS = NOTIFY_CHANNELS.map((channel) => channel.id);
const CHANNELS_BY_SEVERITY: Record<IncidentSeverity, string[]> = {
  SEV1: [...ALL_CHANNEL_IDS],
  SEV2: [...ALL_CHANNEL_IDS],
  SEV3: ["#incidents", "#sre-oncall"],
  SEV4: ["#incidents"],
};

const RESPONSE_EXPECTED: Record<IncidentSeverity, string> = {
  SEV1: "Respond immediately (5 min)",
  SEV2: "Respond now (15 min)",
  SEV3: "Within 1 hour (business hours)",
  SEV4: "Track and schedule",
};

const ALERT_SEVERITY_BADGE: Record<AlertSeverity, { label: string; className: string }> = {
  critical: { label: "Critical", className: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400" },
  warning: { label: "Warning", className: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
  info: { label: "Info", className: "bg-blue-100 text-blue-500 dark:bg-blue-500/15 dark:text-blue-400" },
};

const TAG_SUGGESTIONS = ["payment", "api", "customer-facing", "database", "latency", "deploy", "canary", "network", "cache", "web"];

const inputClass = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring aria-[invalid=true]:border-red-500";
const errorClass = "flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400";

const ON_CALL_NAMES: readonly string[] = [ON_CALL.primary.name, ON_CALL.secondary.name];

function statusSuggestion(severity: IncidentSeverity | null, services: string[]): string {
  const scope = services.length === 0
    ? "affected services"
    : services.length === 1
      ? services[0]
      : `${services.slice(0, 2).join(", ")}${services.length > 2 ? ` +${services.length - 2} more` : ""}`;
  if (severity === "SEV1") return `SEV1 declared: ${scope} impacted. Responders paged; investigating now. Next update in 15 minutes.`;
  if (severity === "SEV2") return `SEV2 declared: ${scope} impacted. Investigating now; next update in 30 minutes.`;
  if (severity === "SEV3") return `SEV3 declared: ${scope} impacted. Triage in progress; targeting a business-hours fix.`;
  if (severity === "SEV4") return `SEV4 declared: ${scope} tracked. Will schedule a fix; no immediate response expected.`;
  return "";
}

function SectionCard({ step, title, action, children }: { step: number; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="flex min-w-0 flex-col gap-4 rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-md bg-muted text-xs font-bold text-muted-foreground">{step}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function DeclareIncident() {
  const router = useRouter();
  const { declareIncident } = useIncidents();

  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [serviceQuery, setServiceQuery] = useState("");
  const [impactSummary, setImpactSummary] = useState("");
  const [commander, setCommander] = useState("");
  const [team, setTeam] = useState<string>("SRE");
  const [assignee, setAssignee] = useState("");
  const [linkedAlertIds, setLinkedAlertIds] = useState<string[]>([]);
  const [alertQuery, setAlertQuery] = useState("");
  const [notifyChannels, setNotifyChannels] = useState<string[]>([]);
  const [statusUpdate, setStatusUpdate] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagsDraft, setTagsDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const channelsTouched = useRef(false);
  const lastSuggestion = useRef("");

  const titleRef = useRef<HTMLInputElement>(null);
  const firstSeverityRef = useRef<HTMLInputElement>(null);
  const servicesGroupRef = useRef<HTMLDivElement>(null);
  const commanderTriggerRef = useRef<HTMLButtonElement>(null);

  const needsCommander = severity === "SEV1" || severity === "SEV2";

  /* Alert list: 12 most recent, filterable. */
  const alertOptions = useMemo(
    () => [...SAMPLE_ALERTS].sort((a, b) => b.epochMs - a.epochMs).slice(0, 12),
    [],
  );
  const filteredAlerts = useMemo(() => {
    const query = alertQuery.trim().toLowerCase();
    if (!query) return alertOptions;
    return alertOptions.filter((alert) => alert.id.toLowerCase().includes(query) || alert.name.toLowerCase().includes(query));
  }, [alertOptions, alertQuery]);

  /* Service chips: searchable when the catalogue is large. */
  const filteredServices = useMemo(() => {
    const query = serviceQuery.trim().toLowerCase();
    if (!query) return INCIDENT_SERVICES;
    return INCIDENT_SERVICES.filter((service) => service.toLowerCase().includes(query));
  }, [serviceQuery]);
  const showServiceSearch = INCIDENT_SERVICES.length > 8;

  const dirty =
    title.trim() !== "" ||
    severity !== null ||
    services.length > 0 ||
    impactSummary.trim() !== "" ||
    commander !== "" ||
    assignee !== "" ||
    linkedAlertIds.length > 0 ||
    tags.length > 0 ||
    tagsDraft.trim() !== "" ||
    (statusUpdate.trim() !== "" && statusUpdate !== lastSuggestion.current) ||
    team !== "SRE";

  /* Unsaved changes warning */
  useEffect(() => {
    if (!dirty || submitted) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, submitted]);

  const cancel = useCallback(() => {
    if (dirty && !window.confirm("Discard this incident draft? Unsaved changes will be lost.")) return;
    router.push("/incidents");
  }, [dirty, router]);

  const toggleService = useCallback((service: string) => {
    setServices((current) => (current.includes(service) ? current.filter((value) => value !== service) : [...current, service]));
  }, []);

  const toggleAlert = useCallback((id: string) => {
    setLinkedAlertIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }, []);

  const toggleChannel = useCallback((channel: string) => {
    channelsTouched.current = true;
    setNotifyChannels((current) => (current.includes(channel) ? current.filter((value) => value !== channel) : [...current, channel]));
  }, []);

  const handleSeverityChange = useCallback((value: IncidentSeverity) => {
    setSeverity(value);
    if (!channelsTouched.current) setNotifyChannels(CHANNELS_BY_SEVERITY[value]);
    setStatusUpdate((current) => {
      if (current !== "" && current !== lastSuggestion.current) return current;
      const next = statusSuggestion(value, services);
      lastSuggestion.current = next;
      return next;
    });
  }, [services]);

  /* Keep the status-update suggestion in sync with the service scope while untouched. */
  useEffect(() => {
    setStatusUpdate((current) => {
      if (current !== "" && current !== lastSuggestion.current) return current;
      const next = statusSuggestion(severity, services);
      lastSuggestion.current = next;
      return next;
    });
  }, [severity, services]);

  const commitTags = useCallback((raw: string) => {
    const parts = raw.split(/[,\n]/).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return;
    setTags((current) => {
      const next = [...current];
      for (const part of parts) {
        if (next.length >= TAG_MAX) break;
        if (!next.includes(part)) next.push(part.slice(0, 32));
      }
      return next;
    });
    setTagsDraft("");
  }, []);

  const removeTag = useCallback((tag: string) => {
    setTags((current) => current.filter((value) => value !== tag));
  }, []);

  const tagSuggestions = useMemo(() => {
    const query = tagsDraft.trim().toLowerCase();
    return TAG_SUGGESTIONS.filter((suggestion) => !tags.includes(suggestion) && (!query || suggestion.includes(query))).slice(0, 5);
  }, [tagsDraft, tags]);

  const errors = useMemo(() => {
    const list: string[] = [];
    if (!title.trim()) list.push("Title is required.");
    if (severity === null) list.push("Severity is required.");
    if (services.length === 0) list.push("Select at least one affected service.");
    if (needsCommander && !commander) list.push("Commander required for SEV1-2.");
    return list;
  }, [title, severity, services.length, needsCommander, commander]);

  const missing = useMemo(() => {
    const list: string[] = [];
    if (!title.trim()) list.push("Title");
    if (severity === null) list.push("Severity");
    if (services.length === 0) list.push("Affected services");
    if (needsCommander && !commander) list.push("Commander (SEV1–2)");
    return list;
  }, [title, severity, services.length, needsCommander, commander]);

  const isValid = missing.length === 0;

  const checklist = useMemo(() => [
    { label: "Title", done: title.trim() !== "" },
    { label: "Severity", done: severity !== null },
    { label: "Affected services", done: services.length > 0 },
    { label: "Notify channels (at least 1)", done: notifyChannels.length > 0 },
    { label: needsCommander ? "Commander (SEV1–2)" : "Commander", done: needsCommander ? commander !== "" : true, optional: !needsCommander },
  ], [title, severity, services.length, notifyChannels.length, needsCommander, commander]);
  const checklistDone = checklist.filter((item) => item.done).length;
  const checklistWidth = ["w-0", "w-1/5", "w-2/5", "w-3/5", "w-4/5", "w-full"][checklistDone];

  const focusFirstInvalid = useCallback(() => {
    if (!title.trim()) { titleRef.current?.focus(); return; }
    if (severity === null) { firstSeverityRef.current?.focus(); return; }
    if (services.length === 0) { servicesGroupRef.current?.focus(); return; }
    if (needsCommander && !commander) { commanderTriggerRef.current?.focus(); }
  }, [title, severity, services.length, needsCommander, commander]);

  const performDeclare = useCallback(() => {
    if (severity === null) return;
    setSubmitting(true);
    const finalTags = tagsDraft.trim() ? [...tags, ...tagsDraft.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean)].filter((tag, index, list) => list.indexOf(tag) === index).slice(0, TAG_MAX) : tags;
    const id = declareIncident({
      title: title.trim(),
      severity,
      services,
      hosts: [],
      impactSummary: impactSummary.trim(),
      commander: commander || CURRENT_USER_NAME,
      team,
      assignee: assignee || null,
      linkedAlertIds,
      notifyChannels,
      statusUpdate: statusUpdate.trim(),
      tags: finalTags,
    });
    try {
      window.sessionStorage.setItem("nexus:incident-declared", id);
    } catch {
      /* sessionStorage unavailable — redirect still works */
    }
    router.push(`/incidents/${id}`);
  }, [severity, tagsDraft, tags, declareIncident, title, services, impactSummary, commander, team, assignee, linkedAlertIds, notifyChannels, statusUpdate, router]);

  const submit = useCallback(() => {
    setSubmitted(true);
    if (errors.length > 0) {
      focusFirstInvalid();
      return;
    }
    if (needsCommander) {
      setConfirmOpen(true);
      return;
    }
    performDeclare();
  }, [errors.length, focusFirstInvalid, needsCommander, performDeclare]);

  const titleErrorId = "incident-title-error";
  const severityErrorId = "severity-error";
  const servicesErrorId = "services-error";
  const commanderErrorId = "commander-error";

  const declareButton = (className?: string, label = "Declare Incident") => {
    const button = (
      <Button
        type="submit"
        form="declare-incident-form"
        disabled={!isValid || submitting}
        aria-describedby={!isValid ? "declare-missing" : undefined}
        className={cn(
          "text-white",
          severity === "SEV1" || severity === "SEV2" ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90",
          className,
        )}
      >
        {submitting ? <Loader2 size={15} aria-hidden="true" className="animate-spin" /> : <Siren size={15} aria-hidden="true" />}
        {label}
      </Button>
    );
    if (isValid) return button;
    return (
      <span title={`Missing: ${missing.join(" · ")}`} className="inline-flex">
        {button}
      </span>
    );
  };

  return (
    <div className="space-y-4 pb-24 xl:pb-4">
      <PageHeader
        breadcrumbs={["Operations", "Incidents", "Declare"]}
        title="Declare Incident"
        subtitle="Open a new incident, page responders and start the timeline."
        icon={<Siren size={22} />}
        iconClassName="h-11 w-11 rounded-xl bg-[oklch(0.9544_0.023_10.96)] text-red-600 dark:bg-[oklch(0.328_0.0487_357.32)] dark:text-[oklch(0.7663_0.1406_13.84)]"
        actions={
          <>
            <Button variant="ghost" onClick={cancel} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={15} aria-hidden="true" />Back to Incidents</Button>
            <Button type="button" variant="outline" onClick={cancel} >Cancel</Button>
            {declareButton()}
          </>
        }
      />

      {!isValid && <span id="declare-missing" className="sr-only">Missing required: {missing.join(", ")}</span>}

      <form id="declare-incident-form" onSubmit={(event) => { event.preventDefault(); submit(); }} className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        {/* ------------------------------- LEFT COLUMN ------------------------------ */}
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
          {/* 1 · Basics */}
          <SectionCard step={1} title="Basics">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="incident-title" className="text-sm font-medium text-foreground">Title <span aria-hidden="true" className="text-red-600">*</span></label>
                <span className="text-xs tabular-nums text-muted-foreground">{title.length}/{TITLE_MAX}</span>
              </div>
              <input
                ref={titleRef}
                id="incident-title"
                type="text"
                autoFocus
                maxLength={TITLE_MAX}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-invalid={submitted && !title.trim()}
                aria-describedby={submitted && !title.trim() ? titleErrorId : undefined}
                placeholder="e.g. Elevated error rate on payment API"
                className={inputClass}
              />
              {submitted && !title.trim() && <p id={titleErrorId} role="alert" className={errorClass}><CircleAlert size={13} aria-hidden="true" />Title is required.</p>}
            </div>

            <fieldset className="flex flex-col gap-1.5" aria-describedby={submitted && severity === null ? severityErrorId : undefined}>
              <legend className="text-sm font-medium text-foreground">Severity <span aria-hidden="true" className="text-red-600">*</span></legend>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {SEVERITY_CARDS.map(({ severity: value, icon: Icon, title: cardTitle, description, active, radio }, index) => {
                  const checked = severity === value;
                  return (
                    <label
                      key={value}
                      className={cn(
                        "flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-ring",
                        checked ? active : "border-border bg-card hover:border-muted-foreground/40",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Icon size={14} aria-hidden="true" />{cardTitle}</span>
                        <input
                          ref={index === 0 ? firstSeverityRef : undefined}
                          type="radio"
                          name="severity"
                          value={value}
                          checked={checked}
                          onChange={() => handleSeverityChange(value)}
                          className={cn("h-4 w-4", radio)}
                          aria-label={cardTitle}
                        />
                      </span>
                      <span className="text-xs leading-snug text-muted-foreground">{description}</span>
                    </label>
                  );
                })}
              </div>
              {submitted && severity === null && <p id={severityErrorId} role="alert" className={errorClass}><CircleAlert size={13} aria-hidden="true" />Severity is required.</p>}
            </fieldset>
          </SectionCard>

          {/* 2 · Impact */}
          <SectionCard step={2} title="Impact">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium text-foreground">Affected services <span aria-hidden="true" className="text-red-600">*</span></legend>
              {showServiceSearch && (
                <div className="relative">
                  <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={serviceQuery}
                    onChange={(event) => setServiceQuery(event.target.value)}
                    placeholder="Search services…"
                    aria-label="Search services"
                    className={cn(inputClass, "pl-9")}
                  />
                </div>
              )}
              <div className="flex items-center justify-end gap-1.5">
                <button type="button" onClick={() => setServices([...INCIDENT_SERVICES])} className="rounded-lg px-2 py-1 text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent">Select all</button>
                <span aria-hidden="true" className="text-xs text-muted-foreground">·</span>
                <button type="button" onClick={() => setServices([])} className="rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent hover:text-foreground">Clear</button>
              </div>
              <div ref={servicesGroupRef} tabIndex={-1} role="group" aria-label="Toggle affected services" aria-describedby={submitted && services.length === 0 ? servicesErrorId : undefined} className="flex flex-wrap gap-1.5 rounded-lg focus:outline-none">
                {filteredServices.map((service) => {
                  const checked = services.includes(service);
                  const iconMeta = SERVICE_ICONS[service];
                  const hosts = SERVICE_HOSTS[service] ?? [];
                  const similar = service === "api-server" || service === "app-server";
                  const tooltip = `${service} — hosts: ${hosts.join(", ")}${similar ? ". Similar name: " + (service === "api-server" ? "app-server" : "api-server") : ""}`;
                  return (
                    <button
                      key={service}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => toggleService(service)}
                      title={tooltip}
                      aria-label={`${service}${checked ? ", selected" : ""}`}
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-lg border py-1 pl-1.5 pr-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {checked && <Check size={13} aria-hidden="true" className="shrink-0" />}
                      <TechLogo name={service} fallbackIcon={iconMeta?.icon ?? Server} fallbackColor={iconMeta?.color} className="!h-6 !w-6 !rounded-md [&_svg]:!h-3.5 [&_svg]:!w-3.5" />
                      {service}
                    </button>
                  );
                })}
                {filteredServices.length === 0 && <p className="py-2 text-xs text-muted-foreground">No services match “{serviceQuery}”.</p>}
              </div>
              {submitted && services.length === 0 && <p id={servicesErrorId} role="alert" className={errorClass}><CircleAlert size={13} aria-hidden="true" />Select at least one affected service.</p>}
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="impact-summary" className="text-sm font-medium text-foreground">Impact summary</label>
                <span className="text-xs tabular-nums text-muted-foreground">{impactSummary.length}/{IMPACT_MAX}</span>
              </div>
              <textarea
                id="impact-summary"
                rows={2}
                maxLength={IMPACT_MAX}
                value={impactSummary}
                onChange={(event) => setImpactSummary(event.target.value)}
                placeholder="What is broken, who is affected and since when?"
                className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
            </div>
          </SectionCard>

          {/* 3 · Response */}
          <SectionCard step={3} title="Response">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="commander-select" className="text-sm font-medium text-foreground">Commander{needsCommander && <span aria-hidden="true" className="text-red-600"> *</span>}</label>
                  <button type="button" onClick={() => setCommander(CURRENT_USER_NAME)} className="rounded-lg px-1.5 py-0.5 text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent">Assign to me</button>
                </div>
                <Select value={commander} onValueChange={setCommander}>
                  <SelectTrigger ref={commanderTriggerRef} id="commander-select" className="h-10 w-full text-sm" aria-label="Incident commander" aria-invalid={submitted && needsCommander && !commander} aria-describedby={submitted && needsCommander && !commander ? commanderErrorId : undefined}><SelectValue placeholder={needsCommander ? "Select commander (required)" : "Select commander"} /></SelectTrigger>
                  <SelectContent>
                    {ON_CALL_NAMES.map((person) => (
                      <SelectItem key={person} value={person} className="text-sm">
                        <span className="flex items-center justify-between gap-3">
                          <span>{person}</span>
                          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">On-call now</span>
                        </span>
                      </SelectItem>
                    ))}
                    {INCIDENT_PEOPLE.filter((person) => !ON_CALL_NAMES.includes(person)).map((person) => (
                      <SelectItem key={person} value={person} className="text-sm">{person}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {submitted && needsCommander && !commander
                  ? <p id={commanderErrorId} role="alert" className={errorClass}><CircleAlert size={13} aria-hidden="true" />Commander required for SEV1-2.</p>
                  : <p className="text-xs text-muted-foreground">{needsCommander ? "Required for SEV1–2." : "Optional for SEV3–4."}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="team-select" className="text-sm font-medium text-foreground">Team</label>
                <Select value={team} onValueChange={setTeam}>
                  <SelectTrigger id="team-select" className="h-10 w-full text-sm" aria-label="Owning team"><SelectValue /></SelectTrigger>
                  <SelectContent>{INCIDENT_TEAMS.map((teamName) => <SelectItem key={teamName} value={teamName} className="text-sm">{teamName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="assignee-select" className="text-sm font-medium text-foreground">Assignee</label>
                <Select value={assignee || "none"} onValueChange={(value) => setAssignee(value === "none" ? "" : value)}>
                  <SelectTrigger id="assignee-select" className="h-10 w-full text-sm" aria-label="Assignee"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-sm">Unassigned</SelectItem>
                    {INCIDENT_PEOPLE.map((person) => <SelectItem key={person} value={person} className="text-sm">{person}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionCard>

          {/* 4 · Context */}
          <SectionCard step={4} title="Context">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium text-foreground">Link existing alerts</legend>
              <div className="relative">
                <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={alertQuery}
                  onChange={(event) => setAlertQuery(event.target.value)}
                  placeholder="Search alerts by ID or name…"
                  aria-label="Search alerts"
                  className={cn(inputClass, "pl-9")}
                />
              </div>
              <div role="group" aria-label="Recent alerts" className="max-h-[12.5rem] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {filteredAlerts.map((alert) => {
                  const checked = linkedAlertIds.includes(alert.id);
                  const badge = ALERT_SEVERITY_BADGE[alert.severity];
                  return (
                    <label key={alert.id} htmlFor={`alert-${alert.id}`} className="flex h-11 cursor-pointer items-center gap-2.5 px-3 transition-colors hover:bg-muted/40 focus-within:bg-muted/40">
                      <input id={`alert-${alert.id}`} type="checkbox" checked={checked} onChange={() => toggleAlert(alert.id)} className="h-4 w-4 shrink-0 accent-primary" aria-label={`Link ${alert.id}`} />
                      <span className="w-16 shrink-0 font-mono text-xs font-semibold text-foreground">{alert.id}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={alert.name}>{alert.name}</span>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", badge.className)}>{badge.label}</span>
                      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{timeAgo(alert.epochMs)}</span>
                    </label>
                  );
                })}
                {filteredAlerts.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted-foreground">No alerts match “{alertQuery}”.</p>}
              </div>
              <p className="text-xs text-muted-foreground">Showing the 12 most recent.{linkedAlertIds.length > 0 ? ` ${linkedAlertIds.length} linked.` : ""}</p>
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="tags-input" className="text-sm font-medium text-foreground">Tags</label>
              <div className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card px-2 py-1 focus-within:ring-2 focus-within:ring-ring">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex h-7 items-center gap-1 rounded-md bg-primary/10 pl-2 pr-1 text-xs font-medium text-primary">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove tag ${tag}`} className="rounded-lg p-0.5 text-primary/80 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X size={12} aria-hidden="true" /></button>
                  </span>
                ))}
                <input
                  id="tags-input"
                  type="text"
                  value={tagsDraft}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value.includes(",")) { commitTags(value); return; }
                    setTagsDraft(value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === ",") { event.preventDefault(); commitTags(tagsDraft); return; }
                    if (event.key === "Backspace" && tagsDraft === "" && tags.length > 0) removeTag(tags[tags.length - 1]);
                  }}
                  onBlur={() => commitTags(tagsDraft)}
                  placeholder={tags.length === 0 ? "payment, api, customer-facing" : ""}
                  aria-label="Add tag"
                  className="h-8 min-w-[7.5rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              {tagSuggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5" aria-label="Tag suggestions">
                  <span className="text-xs text-muted-foreground">Suggestions:</span>
                  {tagSuggestions.map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => commitTags(suggestion)} className="rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{suggestion}</button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Press Enter or comma to add. {tags.length}/{TAG_MAX} tags.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="status-update" className="text-sm font-medium text-foreground">Create status update</label>
              <textarea
                id="status-update"
                rows={2}
                value={statusUpdate}
                onChange={(event) => setStatusUpdate(event.target.value)}
                placeholder="First update to post in the incident timeline"
                className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">Posted as the first entry in the incident timeline when you declare.</p>
            </div>
          </SectionCard>

          {/* Validation summary + footer actions */}
          {submitted && errors.length > 0 && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              <CircleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>Fix {errors.length === 1 ? "this" : "these"} before declaring: {errors.join(" ")}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">Declaring pages the selected channels and opens the timeline.</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={cancel} >Cancel</Button>
              {declareButton(undefined, submitting ? "Declaring…" : "Declare Incident")}
            </div>
          </div>
        </div>

        {/* ------------------------------ RIGHT COLUMN ------------------------------ */}
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4 xl:col-span-4" aria-label="Incident summary">
          {/* Preview */}
          <Card className="flex flex-col gap-4 rounded-xl p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Eye size={14} aria-hidden="true" className="text-muted-foreground" />Preview</h2>
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {severity ? <SeverityBadge severity={severity} /> : <span className="inline-flex items-center rounded-full border border-dashed border-muted-foreground/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">Severity not set</span>}
                <StatusBadge status="Investigating" />
              </div>
              <p className={cn("text-sm font-semibold leading-snug", title.trim() ? "text-foreground" : "italic text-muted-foreground")}>{title.trim() || "Untitled incident"}</p>
              {services.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {services.slice(0, 6).map((service) => (
                    <span key={service} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card pl-1.5 pr-2 text-xs font-medium text-muted-foreground">
                      <TechLogo name={service} fallbackIcon={SERVICE_ICONS[service]?.icon ?? Server} fallbackColor={SERVICE_ICONS[service]?.color} className="!h-5 !w-5 !rounded [&_svg]:!h-3 [&_svg]:!w-3" />
                      {service}
                    </span>
                  ))}
                  {services.length > 6 && <span className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs font-medium text-muted-foreground">+{services.length - 6} more</span>}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><UserRound size={12} aria-hidden="true" />{commander || "No commander"}</span>
                <span className="inline-flex items-center gap-1.5"><Clock size={12} aria-hidden="true" />Started now</span>
              </div>
            </div>
          </Card>

          {/* Who will be paged */}
          <Card className="flex flex-col gap-4 rounded-xl p-4 sm:p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Mail size={14} aria-hidden="true" className="text-muted-foreground" />Who will be paged</h2>
              <p className="text-xs text-muted-foreground">Selected automatically by severity. You can override.</p>
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="sr-only">Notify channels</legend>
              {NOTIFY_CHANNELS.map(({ id, label, icon: ChannelIcon, hint }) => {
                const checked = notifyChannels.includes(id);
                return (
                  <label key={id} htmlFor={`channel-${id}`} title={hint} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 text-sm text-foreground transition-colors hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring">
                    <input id={`channel-${id}`} type="checkbox" checked={checked} onChange={() => toggleChannel(id)} className="h-4 w-4 shrink-0 accent-primary" />
                    <ChannelIcon size={13} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate">{label}</span>
                  </label>
                );
              })}
            </fieldset>
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
              <Clock size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-snug text-foreground">
                <span className="font-semibold">Response expected: </span>
                {severity ? RESPONSE_EXPECTED[severity] : "Select a severity to see response expectations."}
                {(severity === "SEV1" || severity === "SEV2") && <span className="mt-0.5 block text-muted-foreground">PagerDuty will page the on-call primary.</span>}
              </p>
            </div>
          </Card>

          {/* Checklist */}
          <Card className="flex flex-col gap-4 rounded-xl p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><ListChecks size={14} aria-hidden="true" className="text-muted-foreground" />Checklist</h2>
            <ul className="flex flex-col gap-2">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2.5">
                  <span aria-hidden="true" className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border", item.done ? "border-emerald-600 bg-emerald-600 text-white" : "border-muted-foreground/40 bg-transparent text-transparent")}>
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className={cn("text-sm", item.done ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
                  {item.optional && <span className="text-xs text-muted-foreground">(optional)</span>}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className={cn("h-full rounded-full bg-emerald-500 transition-all", checklistWidth)} />
              </div>
              <p className="text-xs tabular-nums text-muted-foreground">{checklistDone} of 5 required done</p>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {declareButton("h-11 w-full justify-center")}
            <Button type="button" variant="outline" onClick={cancel} className="w-full">Cancel</Button>
            <p className="text-center text-xs text-muted-foreground">Declaring pages the selected channels and opens the timeline.</p>
          </div>
        </aside>
      </form>

      {/* Sticky bottom bar on small screens */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:left-[14.5rem] xl:hidden">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <Button type="button" variant="outline" onClick={cancel} >Cancel</Button>
          {declareButton("h-11 flex-1 justify-center")}
        </div>
      </div>

      {/* SEV1/2 confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent aria-label="Confirm declaration">
          <DialogHeader>
            <DialogTitle>Declare {severity} incident?</DialogTitle>
            <DialogDescription>
              This will page {notifyChannels.length} {notifyChannels.length === 1 ? "channel" : "channels"} ({notifyChannels.join(", ")}). {severity === "SEV1" ? "Respond immediately after declaring." : "Respond now after declaring."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} >Cancel</Button>
            <Button type="button" onClick={() => { setConfirmOpen(false); performDeclare(); }} disabled={submitting} className="bg-red-600 text-white hover:bg-red-700">
              {submitting ? <Loader2 size={15} aria-hidden="true" className="animate-spin" /> : <Siren size={15} aria-hidden="true" />}Declare Incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
