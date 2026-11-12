"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, CircleAlert, ChevronsUp, ChevronUp, Minus, ChevronDown as ChevronDownIcon,
  Siren, X, type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { ChartCard } from "@/components/logs/primitives";
import { SeverityBadge } from "@/components/shared/incident-badges";
import { TechLogo } from "@/components/shared/icon";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CURRENT_USER_NAME, INCIDENT_PEOPLE, INCIDENT_SERVICES, INCIDENT_TEAMS, SEVERITY_ORDER,
  type IncidentSeverity,
} from "@/mocks/incidents";
import { useIncidents } from "@/mocks/useIncidents";
import { SAMPLE_ALERTS } from "@/mocks/alerts";
import { cn } from "@/lib/utils";

const SEVERITY_CARDS: Array<{ severity: IncidentSeverity; icon: LucideIcon; title: string; description: string; tone: string; active: string }> = [
  { severity: "SEV1", icon: ChevronsUp, title: "SEV1 · Critical", description: "Major outage or data loss. Page everyone now; exec visibility.", tone: "border-red-200 hover:border-red-400 dark:border-red-500/25", active: "border-red-500 ring-2 ring-red-400/50 bg-red-50 dark:bg-red-500/10" },
  { severity: "SEV2", icon: ChevronUp, title: "SEV2 · High", description: "Significant degradation for many users. Respond now.", tone: "border-orange-200 hover:border-orange-400 dark:border-orange-500/25", active: "border-orange-500 ring-2 ring-orange-400/50 bg-orange-50 dark:bg-orange-500/10" },
  { severity: "SEV3", icon: Minus, title: "SEV3 · Medium", description: "Limited impact or partial degradation. Fix during business hours.", tone: "border-amber-200 hover:border-amber-400 dark:border-amber-500/25", active: "border-amber-500 ring-2 ring-amber-400/50 bg-amber-50 dark:bg-amber-500/10" },
  { severity: "SEV4", icon: ChevronDownIcon, title: "SEV4 · Low", description: "Minor or cosmetic issue. Track and schedule.", tone: "border-blue-200 hover:border-blue-400 dark:border-blue-500/25", active: "border-blue-500 ring-2 ring-blue-400/50 bg-blue-50 dark:bg-blue-500/10" },
];

const NOTIFY_CHANNELS = ["#incidents", "#sre-oncall", "#engineering", "email:oncall@nexus.io", "PagerDuty"] as const;

export function DeclareIncident() {
  const router = useRouter();
  const { declareIncident } = useIncidents();

  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>("SEV3");
  const [services, setServices] = useState<string[]>([]);
  const [impactSummary, setImpactSummary] = useState("");
  const [commander, setCommander] = useState<string>("");
  const [team, setTeam] = useState<string>("SRE");
  const [assignee, setAssignee] = useState<string>("");
  const [linkedAlertIds, setLinkedAlertIds] = useState<string[]>([]);
  const [notifyChannels, setNotifyChannels] = useState<string[]>(["#incidents", "#sre-oncall"]);
  const [statusUpdate, setStatusUpdate] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const alertOptions = useMemo(() => SAMPLE_ALERTS.slice(0, 12).map((alert) => ({ id: alert.id, label: `${alert.id} — ${alert.name}` })), []);

  const dirty = title.trim() !== "" || services.length > 0 || impactSummary.trim() !== "" || assignee !== "" || linkedAlertIds.length > 0 || statusUpdate.trim() !== "" || tagsDraft.trim() !== "" || commander !== "" || severity !== "SEV3" || team !== "SRE";

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

  /* Escape-safe cancel: warn inside the app too */
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
    setNotifyChannels((current) => (current.includes(channel) ? current.filter((value) => value !== channel) : [...current, channel]));
  }, []);

  const errors = useMemo(() => {
    const list: string[] = [];
    if (!title.trim()) list.push("Title is required.");
    if (services.length === 0) list.push("Select at least one affected service.");
    if ((severity === "SEV1" || severity === "SEV2") && !commander) list.push(`Commander is required for ${severity}.`);
    return list;
  }, [title, services.length, severity, commander]);

  const submit = useCallback(() => {
    setSubmitted(true);
    if (errors.length > 0) {
      setToast(errors[0]);
      return;
    }
    const tags = tagsDraft.split(",").map((tag) => tag.trim()).filter(Boolean);
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
      statusUpdate,
      tags,
    });
    router.push(`/incidents/${id}`);
  }, [errors, tagsDraft, declareIncident, title, severity, services, impactSummary, commander, team, assignee, linkedAlertIds, notifyChannels, statusUpdate, router]);

  const sevHint = SEVERITY_CARDS.find((card) => card.severity === severity);

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Operations", "Incidents", "Declare"]}
        title="Declare Incident"
        subtitle="Open a new incident, page responders and start the timeline."
        icon={<Siren size={22} />}
        iconClassName="h-11 w-11 rounded-xl bg-[#ffeaec] text-[#DC2626] dark:bg-[#492a35] dark:text-[#ff8b98]"
        actions={
          <Button variant="ghost" onClick={cancel} className="h-10 gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} aria-hidden="true" />Back to Incidents</Button>
        }
      />

      <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="mx-auto w-full max-w-4xl">
        <ChartCard title="Incident details" actions={<SeverityBadge severity={severity} />}>
          <div className="flex flex-col gap-5">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="incident-title" className="text-sm font-medium text-foreground">Title <span aria-hidden="true" className="text-[#DC2626]">*</span></label>
              <input
                id="incident-title"
                type="text"
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-invalid={submitted && !title.trim()}
                aria-describedby="incident-title-error"
                placeholder="e.g. Elevated error rate on payment API"
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring aria-[invalid=true]:border-red-500"
              />
              {submitted && !title.trim() && <p id="incident-title-error" role="alert" className="flex items-center gap-1.5 text-[13px] font-medium text-red-600 dark:text-red-400"><CircleAlert size={13} aria-hidden="true" />Title is required.</p>}
            </div>

            {/* Severity radio cards */}
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium text-foreground">Severity <span aria-hidden="true" className="text-[#DC2626]">*</span></legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {SEVERITY_CARDS.map(({ severity: value, icon: Icon, title: cardTitle, description, tone, active }) => {
                  const checked = severity === value;
                  return (
                    <label
                      key={value}
                      className={cn(
                        "flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 transition-colors",
                        checked ? active : tone,
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Icon size={14} aria-hidden="true" />{cardTitle}</span>
                        <input type="radio" name="severity" value={value} checked={checked} onChange={() => setSeverity(value)} className="h-4 w-4 accent-[#DC2626]" aria-label={cardTitle} />
                      </span>
                      <span className="text-[12px] leading-snug text-muted-foreground">{description}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Affected services */}
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium text-foreground">Affected services <span aria-hidden="true" className="text-[#DC2626]">*</span></legend>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Toggle affected services">
                {INCIDENT_SERVICES.map((service) => {
                  const checked = services.includes(service);
                  return (
                    <button
                      key={service}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => toggleService(service)}
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-lg border py-1 pl-1.5 pr-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        checked ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <TechLogo name={service} className="!h-6 !w-6 !rounded-md [&_svg]:!h-3.5 [&_svg]:!w-3.5" />
                      {service}
                    </button>
                  );
                })}
              </div>
              {submitted && services.length === 0 && <p role="alert" className="flex items-center gap-1.5 text-[13px] font-medium text-red-600 dark:text-red-400"><CircleAlert size={13} aria-hidden="true" />Select at least one affected service.</p>}
            </fieldset>

            {/* Impact summary */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="impact-summary" className="text-sm font-medium text-foreground">Impact summary</label>
              <textarea
                id="impact-summary"
                rows={2}
                value={impactSummary}
                onChange={(event) => setImpactSummary(event.target.value)}
                placeholder="What is broken, who is affected and since when?"
                className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Commander / team / assignee */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="commander-select" className="text-sm font-medium text-foreground">Commander{ (severity === "SEV1" || severity === "SEV2") && <span aria-hidden="true" className="text-[#DC2626]"> *</span>}</label>
                <Select value={commander} onValueChange={setCommander}>
                  <SelectTrigger id="commander-select" className="h-10 w-full text-sm" aria-label="Incident commander" aria-invalid={submitted && (severity === "SEV1" || severity === "SEV2") && !commander}><SelectValue placeholder="Select commander" /></SelectTrigger>
                  <SelectContent>{INCIDENT_PEOPLE.map((person) => <SelectItem key={person} value={person} className="text-sm">{person}</SelectItem>)}</SelectContent>
                </Select>
                {submitted && (severity === "SEV1" || severity === "SEV2") && !commander && <p role="alert" className="flex items-center gap-1.5 text-[13px] font-medium text-red-600 dark:text-red-400"><CircleAlert size={13} aria-hidden="true" />Commander is required for {severity}.</p>}
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

            {/* Link existing alerts */}
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium text-foreground">Link existing alerts</legend>
              <div className="flex flex-wrap gap-1.5">
                {alertOptions.map(({ id, label }) => {
                  const checked = linkedAlertIds.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => toggleAlert(id)}
                      title={label}
                      className={cn(
                        "inline-flex h-8 max-w-[260px] items-center gap-1.5 rounded-md border px-2 font-mono text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        checked ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {checked && <Check size={12} aria-hidden="true" className="shrink-0" />}
                      <span className="truncate">{id}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[12px] text-muted-foreground">Showing the 12 most recent alerts; full list is available on the Alerts page after creation.</p>
            </fieldset>

            {/* Notify channels + tags */}
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-sm font-medium text-foreground">Notify channels</legend>
                <div className="flex flex-col gap-1.5">
                  {NOTIFY_CHANNELS.map((channel) => {
                    const checked = notifyChannels.includes(channel);
                    return (
                      <label key={channel} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 text-sm text-foreground transition-colors hover:bg-muted/40">
                        <input type="checkbox" checked={checked} onChange={() => toggleChannel(channel)} className="h-4 w-4 accent-[#DC2626]" />
                        {channel}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="tags-input" className="text-sm font-medium text-foreground">Tags</label>
                <input
                  id="tags-input"
                  type="text"
                  value={tagsDraft}
                  onChange={(event) => setTagsDraft(event.target.value)}
                  placeholder="payment, api, customer-facing"
                  className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                />
                <p className="text-[12px] text-muted-foreground">Comma-separated.</p>
              </div>
            </div>

            {/* Create status update */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="status-update" className="text-sm font-medium text-foreground">Create status update</label>
              <textarea
                id="status-update"
                rows={2}
                value={statusUpdate}
                onChange={(event) => setStatusUpdate(event.target.value)}
                placeholder="First update to post in the incident timeline, e.g. “Investigating elevated 5xx on pay-01…”"
                className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Validation summary */}
            {submitted && errors.length > 0 && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                <CircleAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>Fix {errors.length === 1 ? "this" : "these"} before declaring: {errors.join(" ")}</span>
              </div>
            )}

            {/* Footer actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              <p className="text-[12px] text-muted-foreground">Declaring pages the selected channels and opens the timeline.{sevHint ? ` ${sevHint.title.split("·")[0].trim()} response expected immediately.` : ""}</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={cancel} className="h-10 rounded-lg px-4 text-sm">Cancel</Button>
                <Button type="submit" className="h-10 gap-1.5 rounded-lg bg-[#DC2626] px-5 text-sm font-semibold text-white hover:bg-[#B91C1C]"><Siren size={15} aria-hidden="true" />Declare Incident</Button>
              </div>
            </div>
          </div>
        </ChartCard>
      </form>

      {/* Toast */}
      {toast && (
        <div role="alert" className="fixed bottom-4 right-4 z-[1300] flex max-w-md items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-lg">
          <span className="min-w-0">{toast}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification" className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"><X size={14} aria-hidden="true" /></button>
        </div>
      )}
    </div>
  );
}
