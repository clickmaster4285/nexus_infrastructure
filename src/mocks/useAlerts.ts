"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ALERT_ASSIGNEES, SAMPLE_ALERTS, type Alert, type AlertSeverity, type AlertStatus, type AlertTimelineEntry } from "@/mocks/alerts";

export type AlertsStatus = "loading" | "error" | "success";

export type AlertRangeKey = "1h" | "6h" | "24h" | "7d";

export interface AlertsFilters {
  /** Tab key: "all" shows every status. */
  status: AlertStatus | "all";
  severity: AlertSeverity[];
  host: string;
  query: string;
  range: AlertRangeKey;
}

export const DEFAULT_ALERTS_FILTERS: AlertsFilters = { status: "all", severity: [], host: "all", query: "", range: "7d" };

const RANGE_MS: Record<AlertRangeKey, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

/** Actor used for mock acknowledgement/assignment actions. */
export const CURRENT_USER = "you@nexus.io";

export interface UseAlertsResult {
  /** Alerts matching the filters, newest first. */
  alerts: Alert[];
  /** Unfiltered sample — KPIs/trends/tab counts derive from this. */
  allAlerts: Alert[];
  status: AlertsStatus;
  /** Re-runs the mock fetch (used by the error state's Retry button). */
  reload: () => void;
  acknowledge: (ids: string[]) => void;
  resolve: (ids: string[]) => void;
  assign: (ids: string[], user: string | null) => void;
  silence: (ids: string[], hours: number) => void;
  addNote: (id: string, note: string) => void;
}

function entry(kind: AlertTimelineEntry["kind"], label: string, detail?: string, user?: string | null): AlertTimelineEntry {
  const now = Date.now();
  return { id: `tl-${now}-${Math.random().toString(36).slice(2, 7)}`, at: new Date(now).toISOString(), epochMs: now, kind, label, detail, user: user ?? null };
}

/**
 * Mock async fetch for the Alerts page with a 200-400ms delay and
 * loading/error/success states. Swap the body of `load` for a real
 * `fetch("/api/alerts")` later — the signature stays the same. Actions
 * mutate the local mock state and append timeline entries so the
 * drawer reflects them immediately.
 *
 * Error state is reachable via `?alertsError=1` in the URL (first attempt
 * fails, Retry succeeds) so it can be exercised without touching the network.
 */
export function useAlerts(filters: AlertsFilters): UseAlertsResult {
  const [allAlerts, setAllAlerts] = useState<Alert[]>([]);
  const [status, setStatus] = useState<AlertsStatus>("loading");
  const attemptRef = useRef(0);

  const load = useCallback(() => {
    setStatus("loading");
    const attempt = attemptRef.current;
    attemptRef.current += 1;
    const delay = 200 + Math.random() * 200;
    const timer = window.setTimeout(() => {
      const forcedError = typeof window !== "undefined" && window.location.search.includes("alertsError=1");
      if (forcedError && attempt === 0) {
        setAllAlerts([]);
        setStatus("error");
        return;
      }
      // Clone so every consumer mutates their own array, like a real fetch.
      setAllAlerts(SAMPLE_ALERTS.map((alert) => ({ ...alert, timeline: [...alert.timeline] })));
      setStatus("success");
    }, delay);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => load(), [load]);

  const patchAlerts = useCallback(
    (ids: string[], patch: Partial<Alert> | ((alert: Alert) => Partial<Alert> | null) | null, entries: Array<{ id: string; entry: AlertTimelineEntry }>) => {
      setAllAlerts((current) =>
        current.map((alert) => {
          if (!ids.includes(alert.id)) return alert;
          const partial = typeof patch === "function" ? patch(alert) : patch;
          if (!partial) return alert;
          const newEntries = entries.filter((item) => item.id === alert.id).map((item) => item.entry);
          return { ...alert, ...partial, timeline: [...alert.timeline, ...newEntries] };
        }),
      );
    },
    [],
  );

  const acknowledge = useCallback((ids: string[]) => {
    patchAlerts(
      ids,
      (alert) => (alert.status === "firing" ? { status: "acknowledged" as AlertStatus, acknowledgedAt: new Date().toISOString(), acknowledgedBy: CURRENT_USER } : null),
      ids.map((id) => ({ id, entry: entry("acknowledged", "Acknowledged", undefined, CURRENT_USER) })),
    );
  }, [patchAlerts]);

  const resolve = useCallback((ids: string[]) => {
    patchAlerts(
      ids,
      (alert) => (alert.status !== "resolved" ? { status: "resolved" as AlertStatus, resolvedAt: new Date().toISOString(), resolvedBy: CURRENT_USER, silencedUntil: null } : null),
      ids.map((id) => ({ id, entry: entry("resolved", "Resolved", undefined, CURRENT_USER) })),
    );
  }, [patchAlerts]);

  const assign = useCallback((ids: string[], user: string | null) => {
    patchAlerts(
      ids,
      { assignee: user },
      ids.map((id) => ({ id, entry: entry("assigned", user ? "Assigned" : "Unassigned", user ? `Owner ${user}` : undefined, CURRENT_USER) })),
    );
  }, [patchAlerts]);

  const silence = useCallback((ids: string[], hours: number) => {
    patchAlerts(
      ids,
      { status: "silenced" as AlertStatus, silencedUntil: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString() },
      ids.map((id) => ({ id, entry: entry("silenced", `Silenced for ${hours}h`, undefined, CURRENT_USER) })),
    );
  }, [patchAlerts]);

  const addNote = useCallback((id: string, note: string) => {
    patchAlerts([id], {}, [{ id, entry: entry("note", "Note added", note, CURRENT_USER) }]);
  }, [patchAlerts]);

  const alerts = useMemo(() => {
    const tokens = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
    const minMs = Date.now() - RANGE_MS[filters.range];
    return allAlerts.filter((alert) => {
      if (filters.status !== "all" && alert.status !== filters.status) return false;
      if (filters.severity.length > 0 && !filters.severity.includes(alert.severity)) return false;
      if (filters.host !== "all" && alert.host !== filters.host) return false;
      if (alert.epochMs < minMs) return false;
      if (tokens.length > 0) {
        const haystack = `${alert.id} ${alert.name} ${alert.message} ${alert.host} ${alert.service} ${alert.ruleName} ${alert.ruleId}`.toLowerCase();
        if (!tokens.every((token) => haystack.includes(token))) return false;
      }
      return true;
    });
  }, [allAlerts, filters.status, filters.severity, filters.host, filters.query, filters.range]);

  return { alerts, allAlerts, status, reload: load, acknowledge, resolve, assign, silence, addNote };
}

export { ALERT_ASSIGNEES };
