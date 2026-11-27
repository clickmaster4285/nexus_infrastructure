/**
 * Vulnerabilities & patch status hooks — client-side companions to
 * `mocks/vulnerabilities.ts`. Same pattern as `useAlerts` / `useIncidents`:
 * 200-400ms async fetch, explicit loading/error states, actions mutate the
 * shared module store. Swap the `load*` calls for real `fetch("/api/...")`
 * later — types and derived shapes stay.
 */
"use client";

import { useCallback, useEffect, useState } from "react";

import {
  loadVulnerabilities, loadFindings, loadPatches, loadServerPatchStatus, loadPatchHistory, loadAcceptedRisks,
  getVulnSummary, type Vulnerability, type Finding, type Patch, type ServerPatchStatus, type PatchRun, type AcceptedRisk, type VulnSummary,
} from "@/mocks/vulnerabilities";

export type LoadStatus = "loading" | "error" | "success";

function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): { data: T | null; status: LoadStatus; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    const forcedError = typeof window !== "undefined" && window.location.search.includes("vulnsError=1");
    const timer = window.setTimeout(() => {
      if (forcedError && attempt === 0) { if (!cancelled) setStatus("error"); return; }
      loader()
        .then((result) => { if (!cancelled) { setData(result); setStatus("success"); } })
        .catch(() => { if (!cancelled) setStatus("error"); });
    }, 220);
    return () => { cancelled = true; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, ...deps]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { data, status, reload };
}

export function useVulnerabilities(): { vulns: Vulnerability[]; findings: Finding[]; status: LoadStatus; reload: () => void } {
  const { data: vulns, status, reload } = useAsync(loadVulnerabilities);
  const { data: findings } = useAsync(loadFindings);
  return { vulns: vulns ?? [], findings: findings ?? [], status, reload };
}

export function useVulnerability(cveId: string): { vuln: Vulnerability | null; findings: Finding[]; status: LoadStatus; reload: () => void } {
  const { data: vulns, status, reload } = useAsync(loadVulnerabilities);
  const { data: findings } = useAsync(loadFindings);
  const vuln = (vulns ?? []).find((item) => item.cveId === cveId) ?? null;
  return { vuln, findings: (findings ?? []).filter((finding) => finding.cveId === cveId), status, reload };
}

export function useServerPatchStatus(): { hosts: ServerPatchStatus[]; status: LoadStatus; reload: () => void } {
  const { data, status, reload } = useAsync(loadServerPatchStatus);
  return { hosts: data ?? [], status, reload };
}

export function useServerPatch(hostId: string): { host: ServerPatchStatus | null; findings: Finding[]; history: PatchRun[]; status: LoadStatus; reload: () => void } {
  const { data, status, reload } = useAsync(loadServerPatchStatus);
  const { data: findings } = useAsync(loadFindings);
  const { data: history } = useAsync(loadPatchHistory);
  const host = (data ?? []).find((item) => item.hostId === hostId) ?? null;
  return { host, findings: (findings ?? []).filter((finding) => finding.hostId === hostId), history: (history ?? []).filter((run) => run.hostId === hostId), status, reload };
}

export function usePatches(): { patches: Patch[]; status: LoadStatus; reload: () => void } {
  const { data, status, reload } = useAsync(loadPatches);
  return { patches: data ?? [], status, reload };
}

export function useVulnSummary(): VulnSummary {
  return getVulnSummary();
}

export function usePatchHistory(): { runs: PatchRun[]; status: LoadStatus; reload: () => void } {
  const { data, status, reload } = useAsync(loadPatchHistory);
  return { runs: data ?? [], status, reload };
}

export function useAcceptedRisks(): { risks: AcceptedRisk[]; status: LoadStatus; reload: () => void } {
  const { data, status, reload } = useAsync(loadAcceptedRisks);
  return { risks: data ?? [], status, reload };
}
