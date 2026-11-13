/**
 * Maintenance Windows store hook - client-side companion to `mocks/maintenanceWindows.ts`.
 * 200-400ms async fetch with loading/error/success states; error state
 * reachable via `?maintenanceError=1` in the URL (first attempt fails, Retry
 * succeeds). Actions mutate the module store (`mocks/maintenanceWindows.ts`)
 * and the local state together, so Schedule -> detail redirect stays consistent.
 * To swap in a real API, replace `fetchMaintenanceWindows` + the `mutateMaintenanceWindows`
 * calls - the types and the window shape stay the same.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CURRENT_USER_NAME, appendMaintenanceWindowToStore, effectiveStatus, fetchMaintenanceWindows, makeTimelineEntry, mutateMaintenanceWindows,
  nextMaintenanceWindowId,
  type CreateMaintenanceWindowInput, type MaintenanceTimelineEntry, type MaintenanceWindow, type MaintenanceWindowStatus,
} from "@/mocks/maintenanceWindows";

export type MaintenancesStatus = "loading" | "error" | "success";

export interface UseMaintenanceWindowsResult {
  windows: MaintenanceWindow[];
  status: MaintenancesStatus;
  /** Re-runs the mock fetch (used by the error state's Retry button). */
  reload: () => void;
  createWindow: (input: CreateMaintenanceWindowInput) => string;
  updateWindow: (id: string, input: CreateMaintenanceWindowInput) => void;
  extendWindow: (id: string, minutes: number) => void;
  endWindowNow: (id: string) => void;
  cancelWindows: (ids: string[]) => void;
  approveWindows: (ids: string[]) => void;
  rejectWindows: (ids: string[]) => void;
  addNote: (id: string, text: string) => void;
  duplicateWindow: (id: string) => string | null;
  /** Restore terminal states captured before a bulk action (Undo toast). */
  restore: (snapshot: Array<Pick<MaintenanceWindow, "id" | "status">>) => void;
}

const cloneWindow = (window: MaintenanceWindow): MaintenanceWindow => ({
  ...window,
  recurrence: { ...window.recurrence, days: [...window.recurrence.days] },
  scope: { ...window.scope, servers: [...window.scope.servers], groups: [...window.scope.groups], services: [...window.scope.services], tags: [...window.scope.tags], exclude: [...window.scope.exclude] },
  alertBehavior: { ...window.alertBehavior, mutedRuleIds: [...window.alertBehavior.mutedRuleIds] },
  notifyChannels: [...window.notifyChannels],
  timeline: window.timeline.map((entry) => ({ ...entry })),
  summary: window.summary ? { ...window.summary } : null,
});

const delay = () => 200 + Math.random() * 200;

/** Mock maintenance windows store hook. Mirrors `useIncidents` - see there for the pattern. */
export function useMaintenanceWindows(): UseMaintenanceWindowsResult {
  const [windows, setWindows] = useState<MaintenanceWindow[]>([]);
  const [status, setStatus] = useState<MaintenancesStatus>("loading");
  const attemptRef = useRef(0);

  const load = useCallback(() => {
    setStatus("loading");
    const attempt = attemptRef.current;
    attemptRef.current += 1;
    const forcedError = typeof window !== "undefined" && window.location.search.includes("maintenanceError=1");
    const timer = window.setTimeout(() => {
      if (forcedError && attempt === 0) {
        setWindows([]);
        setStatus("error");
        return;
      }
      fetchMaintenanceWindows().then((list) => {
        setWindows(list);
        setStatus("success");
      });
    }, delay());
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => load(), [load]);

  /** Keep local state consistent with a store mutation. */
  const applyToLocal = useCallback((
    ids: string[],
    patch: (window: MaintenanceWindow) => Partial<MaintenanceWindow> | null,
    entries: (window: MaintenanceWindow) => MaintenanceTimelineEntry[],
  ) => {
    setWindows((current) =>
      current.map((window) => {
        if (!ids.includes(window.id)) return window;
        const partial = patch(window);
        if (!partial) return window;
        return { ...window, ...partial, timeline: [...window.timeline, ...entries(window)] };
      }),
    );
  }, []);

  const createWindow = useCallback((input: CreateMaintenanceWindowInput): string => {
    const id = nextMaintenanceWindowId();
    const now = Date.now();
    const window: MaintenanceWindow = {
      id,
      title: input.title.trim(),
      description: input.description.trim(),
      type: input.type,
      status: effectiveStatus({ status: "Scheduled", start: input.start, end: input.end }),
      start: input.start,
      end: input.end,
      timeZone: input.timeZone,
      recurrence: { ...input.recurrence, days: [...input.recurrence.days] },
      scope: { ...input.scope, servers: [...input.scope.servers], groups: [...input.scope.groups], services: [...input.scope.services], tags: [...input.scope.tags], exclude: [...input.scope.exclude] },
      alertBehavior: { ...input.alertBehavior, mutedRuleIds: [...input.alertBehavior.mutedRuleIds] },
      owner: input.owner,
      approver: input.approver,
      approvalStatus: input.approvalStatus,
      changeTicket: input.changeTicket,
      notifyChannels: [...input.notifyChannels],
      impact: input.impact.trim(),
      createdBy: CURRENT_USER_NAME,
      createdAt: new Date(now).toISOString(),
      timeline: [
        { id: `${id}-tl-created`, at: new Date(now).toISOString(), epochMs: now, type: "created", author: CURRENT_USER_NAME, text: `Window scheduled for ${new Date(input.start).toLocaleString()}.` },
        ...(input.statusUpdate?.trim()
          ? [{ id: `${id}-tl-note`, at: new Date(now + 1).toISOString(), epochMs: now + 1, type: "note" as const, author: CURRENT_USER_NAME, text: input.statusUpdate.trim() }]
          : []),
      ],
      summary: null,
    };
    appendMaintenanceWindowToStore(window);
    setWindows((current) => [cloneWindow(window), ...current]);
    return id;
  }, []);

  const updateWindow = useCallback((id: string, input: CreateMaintenanceWindowInput) => {
    const entry = makeTimelineEntry("updated", CURRENT_USER_NAME, "Window updated.");
    const patch = (): Partial<MaintenanceWindow> => ({
      title: input.title.trim(),
      description: input.description.trim(),
      type: input.type,
      start: input.start,
      end: input.end,
      timeZone: input.timeZone,
      recurrence: { ...input.recurrence, days: [...input.recurrence.days] },
      scope: { ...input.scope, servers: [...input.scope.servers], groups: [...input.scope.groups], services: [...input.scope.services], tags: [...input.scope.tags], exclude: [...input.scope.exclude] },
      alertBehavior: { ...input.alertBehavior, mutedRuleIds: [...input.alertBehavior.mutedRuleIds] },
      owner: input.owner,
      approver: input.approver,
      approvalStatus: input.approvalStatus,
      changeTicket: input.changeTicket,
      notifyChannels: [...input.notifyChannels],
      impact: input.impact.trim(),
    });
    mutateMaintenanceWindows([id], patch, () => [entry]);
    applyToLocal([id], patch, () => [entry]);
  }, [applyToLocal]);

  const extendWindow = useCallback((id: string, minutes: number) => {
    const entry = makeTimelineEntry("extended", CURRENT_USER_NAME, `Window extended by ${minutes}m.`);
    const patch = (window: MaintenanceWindow): Partial<MaintenanceWindow> => ({
      end: new Date(Date.parse(window.end) + minutes * 60_000).toISOString(),
    });
    mutateMaintenanceWindows([id], patch, () => [entry]);
    applyToLocal([id], patch, () => [entry]);
  }, [applyToLocal]);

  const endWindowNow = useCallback((id: string) => {
    const nowIso = new Date().toISOString();
    const entry = makeTimelineEntry("completed", CURRENT_USER_NAME, "Window ended early by operator.");
    const patch = (window: MaintenanceWindow): Partial<MaintenanceWindow> => ({
      status: "Completed",
      end: nowIso,
      summary: {
        suppressedAlerts: window.summary?.suppressedAlerts ?? 0,
        suppressedIncidents: window.summary?.suppressedIncidents ?? 0,
        actualStart: window.summary?.actualStart ?? window.start,
        actualEnd: nowIso,
        notes: window.summary?.notes ?? "Ended early by operator.",
      },
    });
    mutateMaintenanceWindows([id], patch, () => [entry]);
    applyToLocal([id], patch, () => [entry]);
  }, [applyToLocal]);

  const cancelWindows = useCallback((ids: string[]) => {
    const entry = makeTimelineEntry("cancelled", CURRENT_USER_NAME, "Window cancelled by operator.");
    const patch = (): Partial<MaintenanceWindow> => ({ status: "Cancelled" });
    mutateMaintenanceWindows(ids, patch, () => [entry]);
    applyToLocal(ids, patch, () => [entry]);
  }, [applyToLocal]);

  const approveWindows = useCallback((ids: string[]) => {
    const entry = makeTimelineEntry("approved", CURRENT_USER_NAME, "Window approved.");
    const patch = (): Partial<MaintenanceWindow> => ({ approvalStatus: "Approved" });
    mutateMaintenanceWindows(ids, patch, () => [entry]);
    applyToLocal(ids, patch, () => [entry]);
  }, [applyToLocal]);

  const rejectWindows = useCallback((ids: string[]) => {
    const entry = makeTimelineEntry("rejected", CURRENT_USER_NAME, "Window rejected.");
    const patch = (): Partial<MaintenanceWindow> => ({ approvalStatus: "Rejected" });
    mutateMaintenanceWindows(ids, patch, () => [entry]);
    applyToLocal(ids, patch, () => [entry]);
  }, [applyToLocal]);

  const addNote = useCallback((id: string, text: string) => {
    const entry = makeTimelineEntry("note", CURRENT_USER_NAME, text);
    const patch = (): Partial<MaintenanceWindow> => ({});
    mutateMaintenanceWindows([id], patch, () => [entry]);
    applyToLocal([id], patch, () => [entry]);
  }, [applyToLocal]);

  const duplicateWindow = useCallback((id: string): string | null => {
    const source = windows.find((window) => window.id === id);
    if (!source) return null;
    const newId = nextMaintenanceWindowId();
    const now = Date.now();
    const copy: MaintenanceWindow = {
      ...cloneWindow(source),
      id: newId,
      title: `Copy of ${source.title}`,
      status: effectiveStatus({ status: "Scheduled", start: source.start, end: source.end }),
      approvalStatus: source.type === "Emergency" ? "Approved" : "Pending",
      createdBy: CURRENT_USER_NAME,
      createdAt: new Date(now).toISOString(),
      timeline: [
        { id: `${newId}-tl-created`, at: new Date(now).toISOString(), epochMs: now, type: "created", author: CURRENT_USER_NAME, text: `Duplicated from ${source.id}.` },
      ],
      summary: null,
    };
    appendMaintenanceWindowToStore(copy);
    setWindows((current) => [cloneWindow(copy), ...current]);
    return newId;
  }, [windows]);

  const restore = useCallback((snapshot: Array<Pick<MaintenanceWindow, "id" | "status">>) => {
    const byId = new Map(snapshot.map((item) => [item.id, item.status]));
    const patch = (window: MaintenanceWindow): Partial<MaintenanceWindow> | null => {
      const status = byId.get(window.id);
      return status ? { status: status as MaintenanceWindowStatus } : null;
    };
    const ids = snapshot.map((item) => item.id);
    mutateMaintenanceWindows(ids, patch, () => []);
    applyToLocal(ids, patch, () => []);
  }, [applyToLocal]);

  return {
    windows,
    status,
    reload: load,
    createWindow,
    updateWindow,
    extendWindow,
    endWindowNow,
    cancelWindows,
    approveWindows,
    rejectWindows,
    addNote,
    duplicateWindow,
    restore,
  };
}
