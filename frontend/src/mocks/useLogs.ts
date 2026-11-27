"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SAMPLE_LOGS, type LogEntry } from "@/mocks/logs";

export type LogsStatus = "loading" | "error" | "success";

export interface UseLogsResult {
  logs: LogEntry[];
  status: LogsStatus;
  /** Re-runs the mock fetch (used by the error state's Retry button). */
  reload: () => void;
}

/**
 * Mock async fetch for the Logs Explorer with a 200-400ms delay and
 * loading/error/success states. Swap the body of `load` for a real
 * `fetch("/api/logs")` later — the signature stays the same.
 *
 * Error state is reachable via `?logsError=1` in the URL (first attempt fails,
 * Retry succeeds) so it can be exercised without touching the network.
 */
export function useLogs(): UseLogsResult {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<LogsStatus>("loading");
  const attemptRef = useRef(0);

  const load = useCallback(() => {
    setStatus("loading");
    const attempt = attemptRef.current;
    attemptRef.current += 1;
    const delay = 200 + Math.random() * 200;
    const timer = window.setTimeout(() => {
      const forcedError = typeof window !== "undefined" && window.location.search.includes("logsError=1");
      if (forcedError && attempt === 0) {
        setLogs([]);
        setStatus("error");
        return;
      }
      // Clone so every consumer mutates their own array, like a real fetch.
      setLogs([...SAMPLE_LOGS]);
      setStatus("success");
    }, delay);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => load(), [load]);

  return { logs, status, reload: load };
}
