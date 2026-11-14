"use client";

import { useCallback, useEffect, useState } from "react";

import {
  archiveRunbooks, createRunbook, duplicateRunbook, fetchRunbooks, getExecutionSnapshot, getRunbookStats, getRunbookSnapshot,
  markRunbookReviewed, recordExecution, recordHelpful, subscribeRunbooks, updateRunbook,
  type Runbook, type RunbookDraftInput, type RunbookExecution, type RunbookStats,
} from "@/mocks/runbooks";

export type RunbooksStatus = "loading" | "error" | "success";

export interface UseRunbooksResult {
  status: RunbooksStatus;
  reload: () => void;
  /** Re-render tick; components read store snapshots directly. */
  version: number;
  runbooks: Runbook[];
  executions: RunbookExecution[];
  stats: RunbookStats;
  archive: (ids: string[]) => void;
  markReviewed: (id: string) => void;
  duplicate: (id: string) => Runbook | null;
  create: (input: RunbookDraftInput) => Runbook;
  update: (id: string, input: RunbookDraftInput) => Runbook | null;
  recordRun: typeof recordExecution;
  markHelpful: (id: string, helpful: boolean) => void;
}

/**
 * Store-version + async fetch hook (same family as useBackups/useIncidents).
 * fetchRunbooks() carries the simulated 200-400ms latency; swapping the mock
 * for a real API is a one-function change. ?runbooksError=1 fails the first
 * load attempt; Retry succeeds.
 */
export function useRunbooks(): UseRunbooksResult {
  const [status, setStatus] = useState<RunbooksStatus>("loading");
  const [version, setVersion] = useState(0);

  useEffect(() => subscribeRunbooks(() => setVersion((current) => current + 1)), []);

  const load = useCallback(() => {
    setStatus("loading");
    const forcedError = typeof window !== "undefined" && window.location.search.includes("runbooksError=1") && !window.sessionStorage.getItem("runbooksErrorRetried");
    if (forcedError) {
      const timer = window.setTimeout(() => setStatus("error"), 200 + Math.random() * 200);
      return () => window.clearTimeout(timer);
    }
    void fetchRunbooks().then(() => setStatus("success"));
    return () => {};
  }, []);

  const reload = useCallback(() => {
    if (typeof window !== "undefined") window.sessionStorage.setItem("runbooksErrorRetried", "1");
    setStatus("loading");
    void fetchRunbooks().then(() => setStatus("success"));
  }, []);

  useEffect(() => load(), [load]);

  const archive = useCallback((ids: string[]) => archiveRunbooks(ids), []);
  const markReviewed = useCallback((id: string) => markRunbookReviewed(id), []);
  const duplicate = useCallback((id: string) => duplicateRunbook(id), []);
  const create = useCallback((input: RunbookDraftInput) => createRunbook(input), []);
  const update = useCallback((id: string, input: RunbookDraftInput) => updateRunbook(id, input), []);
  const markHelpful = useCallback((id: string, helpful: boolean) => recordHelpful(id, helpful), []);

  // Snapshots refresh whenever the store emits (version in dep array).
  void version;
  return {
    status,
    reload,
    version,
    runbooks: getRunbookSnapshot(),
    executions: getExecutionSnapshot(),
    stats: getRunbookStats(),
    archive,
    markReviewed,
    duplicate,
    create,
    update,
    recordRun: recordExecution,
    markHelpful,
  };
}
