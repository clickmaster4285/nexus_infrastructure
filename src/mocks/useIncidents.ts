/**
 * Incidents store hook — client-side companion to `mocks/incidents.ts`.
 * 200–400ms async fetch with loading/error/success states; error state
 * reachable via `?incidentsError=1` in the URL (first attempt fails, Retry
 * succeeds). Actions mutate the module store (`mocks/incidents.ts`) and the
 * local state together, so Declare → detail redirects stay consistent.
 * To swap in a real API, replace `fetchIncidents` + the `mutateIncidents`
 * calls — the types and the incidents shape stay the same.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CURRENT_USER_NAME, SERVICE_HOSTS, fetchIncidents, isOpenIncident, makeTimelineEntry, mutateIncidents,
  nextIncidentId, appendIncidentToStore,
  type DeclareIncidentInput, type Incident, type IncidentRestoreSnapshot, type IncidentSeverity, type IncidentStatus, type IncidentTimelineEntry,
} from "@/mocks/incidents";

export type IncidentsStatus = "loading" | "error" | "success";

export interface UseIncidentsResult {
  incidents: Incident[];
  status: IncidentsStatus;
  /** Re-runs the mock fetch (used by the error state's Retry button). */
  reload: () => void;
  acknowledge: (ids: string[]) => void;
  resolve: (ids: string[]) => void;
  assign: (ids: string[], person: string | null) => void;
  changeSeverity: (ids: string[], severity: IncidentSeverity) => void;
  changeStatus: (ids: string[], status: IncidentStatus) => void;
  escalate: (ids: string[]) => void;
  addUpdate: (id: string, text: string, type: "update" | "note" | "status") => void;
  declareIncident: (input: DeclareIncidentInput) => string;
  toggleActionItem: (incidentId: string, itemId: string) => void;
  /** Restore previous values captured before a bulk action (Undo toast). */
  restore: (snapshot: IncidentRestoreSnapshot[]) => void;
  /** Move a postmortem from None to Draft with a template outline. */
  startPostmortem: (id: string) => void;
}

const cloneIncident = (incident: Incident): Incident => ({
  ...incident,
  affectedServices: [...incident.affectedServices],
  affectedHosts: [...incident.affectedHosts],
  linkedAlertIds: [...incident.linkedAlertIds],
  tags: [...incident.tags],
  timeline: incident.timeline.map((entry) => ({ ...entry })),
  postmortem: { ...incident.postmortem, actionItems: incident.postmortem.actionItems.map((item) => ({ ...item })) },
});

const delay = () => 200 + Math.random() * 200;

/**
 * Mock incidents store hook. Mirrors `useAlerts` — see there for the pattern.
 */
export function useIncidents(): UseIncidentsResult {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [status, setStatus] = useState<IncidentsStatus>("loading");
  const attemptRef = useRef(0);

  const load = useCallback(() => {
    setStatus("loading");
    const attempt = attemptRef.current;
    attemptRef.current += 1;
    const forcedError = typeof window !== "undefined" && window.location.search.includes("incidentsError=1");
    const timer = window.setTimeout(() => {
      if (forcedError && attempt === 0) {
        setIncidents([]);
        setStatus("error");
        return;
      }
      fetchIncidents().then((list) => {
        setIncidents(list);
        setStatus("success");
      });
    }, delay());
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => load(), [load]);

  const applyToLocal = useCallback((ids: string[], patch: (incident: Incident) => Partial<Incident> | null, entries: (incident: Incident) => IncidentTimelineEntry[]) => {
    setIncidents((current) =>
      current.map((incident) => {
        if (!ids.includes(incident.id)) return incident;
        const partial = patch(incident);
        if (!partial) return incident;
        return { ...incident, ...partial, timeline: [...incident.timeline, ...entries(incident)] };
      }),
    );
  }, []);

  const acknowledge = useCallback((ids: string[]) => {
    const build = (): IncidentTimelineEntry => makeTimelineEntry("acknowledged", CURRENT_USER_NAME, `${CURRENT_USER_NAME.split(" ")[0]} acknowledged via dashboard.`);
    mutateIncidents(
      ids,
      (incident) => (isOpenIncident(incident) && incident.acknowledgedAt == null ? { acknowledgedAt: new Date().toISOString() } : null),
      () => [build()],
    );
    applyToLocal(
      ids,
      (incident) => (isOpenIncident(incident) && incident.acknowledgedAt == null ? { acknowledgedAt: new Date().toISOString() } : null),
      () => [build()],
    );
  }, [applyToLocal]);

  const resolve = useCallback((ids: string[]) => {
    const build = (): IncidentTimelineEntry => makeTimelineEntry("resolved", CURRENT_USER_NAME, "Service restored and metrics back within SLO; incident resolved.");
    mutateIncidents(
      ids,
      (incident) => (isOpenIncident(incident) ? { status: "Resolved" as IncidentStatus, resolvedAt: new Date().toISOString() } : null),
      () => [build()],
    );
    applyToLocal(
      ids,
      (incident) => (isOpenIncident(incident) ? { status: "Resolved" as IncidentStatus, resolvedAt: new Date().toISOString() } : null),
      () => [build()],
    );
  }, [applyToLocal]);

  const assign = useCallback((ids: string[], person: string | null) => {
    const build = (): IncidentTimelineEntry => makeTimelineEntry("update", CURRENT_USER_NAME, person ? `Assigned to ${person}.` : "Assignee removed.");
    mutateIncidents(ids, () => ({ assignee: person }), () => [build()]);
    applyToLocal(ids, () => ({ assignee: person }), () => [build()]);
  }, [applyToLocal]);

  const changeSeverity = useCallback((ids: string[], severity: IncidentSeverity) => {
    const build = (): IncidentTimelineEntry => makeTimelineEntry("update", CURRENT_USER_NAME, `Severity changed to ${severity}.`);
    mutateIncidents(ids, () => ({ severity }), () => [build()]);
    applyToLocal(ids, () => ({ severity }), () => [build()]);
  }, [applyToLocal]);

  const changeStatus = useCallback((ids: string[], next: IncidentStatus) => {
    const build = (): IncidentTimelineEntry => makeTimelineEntry(next === "Resolved" ? "resolved" : "update", CURRENT_USER_NAME, `Status changed to ${next}.`);
    const patch = (incident: Incident): Partial<Incident> => ({ status: next, resolvedAt: next === "Resolved" ? new Date().toISOString() : incident.resolvedAt });
    mutateIncidents(ids, patch, () => [build()]);
    applyToLocal(ids, patch, () => [build()]);
  }, [applyToLocal]);

  const escalate = useCallback((ids: string[]) => {
    const build = (): IncidentTimelineEntry => makeTimelineEntry("escalated", CURRENT_USER_NAME, "Escalated to secondary responder; impact confirmed beyond initial scope.");
    mutateIncidents(ids, () => ({}), () => [build()]);
    applyToLocal(ids, () => ({}), () => [build()]);
  }, [applyToLocal]);

  const addUpdate = useCallback((id: string, text: string, type: "update" | "note" | "status") => {
    const label = type === "note" ? "Internal note" : type === "status" ? "Status update" : "Update posted";
    const build = (): IncidentTimelineEntry => makeTimelineEntry("update", CURRENT_USER_NAME, `${label}: ${text}`);
    mutateIncidents([id], () => ({}), () => [build()]);
    applyToLocal([id], () => ({}), () => [build()]);
  }, [applyToLocal]);

  const declareIncident = useCallback((input: DeclareIncidentInput): string => {
    const id = nextIncidentId();
    const now = Date.now();
    const incident: Incident = {
      id,
      title: input.title.trim(),
      severity: input.severity,
      status: "Investigating",
      commander: input.commander,
      assignee: input.assignee,
      team: input.team,
      affectedServices: [...input.services],
      affectedHosts: input.hosts.length ? [...input.hosts] : input.services.flatMap((service) => SERVICE_HOSTS[service] ?? []),
      linkedAlertIds: [...input.linkedAlertIds],
      impact: input.impactSummary.trim() || "Impact under assessment.",
      startedAt: new Date(now).toISOString(),
      acknowledgedAt: null,
      resolvedAt: null,
      rootCause: "Under investigation.",
      timeline: [
        { id: `${id}-tl-created`, at: new Date(now).toISOString(), epochMs: now, type: "created", author: CURRENT_USER_NAME, text: "Incident declared; responders paged." },
        ...(input.statusUpdate.trim()
          ? [{ id: `${id}-tl-status`, at: new Date(now + 1).toISOString(), epochMs: now + 1, type: "update" as const, author: CURRENT_USER_NAME, text: `Status update: ${input.statusUpdate.trim()}` }]
          : []),
      ],
      postmortem: { status: "None", summary: "", rootCause: "", impact: "", actionItems: [] },
      tags: [...input.tags],
    };
    appendIncidentToStore(incident);
    setIncidents((current) => [cloneIncident(incident), ...current]);
    return id;
  }, []);

  const toggleActionItem = useCallback((incidentId: string, itemId: string) => {
    const toggle = (incident: Incident): Partial<Incident> => ({
      postmortem: {
        ...incident.postmortem,
        actionItems: incident.postmortem.actionItems.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
      },
    });
    mutateIncidents([incidentId], toggle, () => []);
    applyToLocal([incidentId], toggle, () => []);
  }, [applyToLocal]);

  const restore = useCallback((snapshot: IncidentRestoreSnapshot[]) => {
    const byId = new Map(snapshot.map((item) => [item.id, item]));
    const patch = (incident: Incident): Partial<Incident> | null => byId.get(incident.id) ?? null;
    const ids = snapshot.map((item) => item.id);
    mutateIncidents(ids, patch, () => []);
    applyToLocal(ids, patch, () => []);
  }, [applyToLocal]);

  const startPostmortem = useCallback((id: string) => {
    const entry = (): IncidentTimelineEntry => makeTimelineEntry("update", CURRENT_USER_NAME, "Postmortem drafted from template.");
    const patch = (incident: Incident): Partial<Incident> => ({
      postmortem: {
        status: "Draft",
        summary: incident.postmortem.summary || `Summary: ${incident.title}. Impact: ${incident.impact}`,
        rootCause: incident.postmortem.rootCause === "" ? incident.rootCause : incident.postmortem.rootCause,
        impact: incident.postmortem.impact || incident.impact,
        actionItems: incident.postmortem.actionItems.length
          ? incident.postmortem.actionItems
          : [
              { id: `${id}-ai-1`, text: "Confirm and document final root cause", owner: incident.commander, due: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString().slice(0, 10), done: false },
              { id: `${id}-ai-2`, text: "Add regression test for the failure mode", owner: "Nina Park", due: new Date(Date.now() + 14 * 24 * 60 * 60_000).toISOString().slice(0, 10), done: false },
            ],
      },
    });
    mutateIncidents([id], patch, () => [entry()]);
    applyToLocal([id], patch, () => [entry()]);
  }, [applyToLocal]);

  return {
    incidents,
    status,
    reload: load,
    acknowledge,
    resolve,
    assign,
    changeSeverity,
    changeStatus,
    escalate,
    addUpdate,
    declareIncident,
    toggleActionItem,
    restore,
    startPostmortem,
  };
}
