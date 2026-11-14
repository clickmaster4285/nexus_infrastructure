/**
 * Certificates hooks — client-side companions to `mocks/certificates.ts`.
 * Same pattern as `useVulnerabilities`: 200-400ms fetch, explicit states,
 * actions mutate the module store. Swap `load*` for real API later.
 */
"use client";

import { useCallback, useEffect, useState } from "react";

import {
  loadCertificates, loadCertificateEvents, loadExpiryPolicies,
  getCertificateById, getCertificateEvents, getCertSummary,
  renewCertificate, revokeCertificate, setCertificateAutoRenew, assignCertificateOwner, markCertificateVerified, scanCertificates,
  type Certificate, type CertificateEvent, type ExpiryAlertPolicy, type CertRenewalMethod, type CertSummary,
} from "@/mocks/certificates";

export type LoadStatus = "loading" | "error" | "success";

function useAsync<T>(loader: () => Promise<T>): { data: T | null; status: LoadStatus; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    const forcedError = typeof window !== "undefined" && window.location.search.includes("certsError=1");
    const timer = window.setTimeout(() => {
      if (forcedError && attempt === 0) { if (!cancelled) setStatus("error"); return; }
      loader()
        .then((result) => { if (!cancelled) { setData(result); setStatus("success"); } })
        .catch(() => { if (!cancelled) setStatus("error"); });
    }, 220);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { data, status, reload };
}

export function useCertificates(): { certs: Certificate[]; status: LoadStatus; reload: () => void } {
  const { data, status, reload } = useAsync(loadCertificates);
  return { certs: data ?? [], status, reload };
}

export function useCertificate(id: string): { cert: Certificate | null; events: CertificateEvent[]; status: LoadStatus; reload: () => void } {
  const { data, status, reload } = useAsync(loadCertificates);
  const { data: eventsData } = useAsync(loadCertificateEvents);
  const cert = (data ?? []).find((item) => item.id === id) ?? null;
  const events = (eventsData ?? []).filter((event) => event.certId === id);
  return { cert, events, status, reload };
}

export function useCertificateEvents(): { events: CertificateEvent[]; status: LoadStatus; reload: () => void } {
  const { data, status, reload } = useAsync(loadCertificateEvents);
  return { events: data ?? [], status, reload };
}

export function useExpiryPolicies(): { policies: ExpiryAlertPolicy[]; status: LoadStatus; reload: () => void } {
  const { data, status, reload } = useAsync(loadExpiryPolicies);
  return { policies: data ?? [], status, reload };
}

export function useCertSummary(): CertSummary {
  return getCertSummary();
}

export const certActions = { renewCertificate, revokeCertificate, setCertificateAutoRenew, assignCertificateOwner, markCertificateVerified, scanCertificates };
