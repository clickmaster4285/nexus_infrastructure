"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  DOWNTIME_INCIDENTS,
  FLEET_DAILY,
  SLA_SERVICES,
  SLA_TYPE_BREAKDOWN,
  buildErrorBudget,
  buildFleetSummary,
  type DowntimeIncident,
  type ErrorBudget,
  type ServiceUptime,
  type DailyUptime,
  type SlaSummary,
} from "@/mocks/uptimeSla";

export type UptimeSlaStatus = "loading" | "error" | "success";

export interface UseUptimeSlaResult {
  services: ServiceUptime[];
  fleetDaily: DailyUptime[];
  incidents: DowntimeIncident[];
  summary: SlaSummary;
  errorBudget: ErrorBudget;
  types: typeof SLA_TYPE_BREAKDOWN;
  status: UptimeSlaStatus;
  /** Re-runs the mock fetch (used by the error state's Retry button). */
  reload: () => void;
}

/**
 * Mock async fetch for Uptime & SLA Reports with a 200-400ms delay and
 * loading/error/success states. Swap the body of `load` for a real
 * `fetch("/api/sla")` later — the hook signature and return shape stay the same.
 *
 * Error state is reachable via `?slaError=1` in the URL (first attempt fails,
 * Retry succeeds) so it can be exercised without touching the network.
 */
export function useUptimeSla(slaTarget: number): UseUptimeSlaResult {
  const [status, setStatus] = useState<UptimeSlaStatus>("loading");
  const attemptRef = useRef(0);

  const load = useCallback(() => {
    setStatus("loading");
    const attempt = attemptRef.current;
    attemptRef.current += 1;
    const delay = 200 + Math.random() * 200;
    const timer = window.setTimeout(() => {
      const forcedError = typeof window !== "undefined" && window.location.search.includes("slaError=1");
      if (forcedError && attempt === 0) {
        setStatus("error");
        return;
      }
      setStatus("success");
    }, delay);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => load(), [load]);

  return {
    services: SLA_SERVICES,
    fleetDaily: FLEET_DAILY,
    incidents: DOWNTIME_INCIDENTS,
    summary: buildFleetSummary(slaTarget),
    errorBudget: buildErrorBudget(slaTarget),
    types: SLA_TYPE_BREAKDOWN,
    status,
    reload: load,
  };
}

export { buildFleetSummary, buildErrorBudget };
