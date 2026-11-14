"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { CheckCircle2, ChevronRight, Copy, RotateCcw, ShieldCheck, ShieldX, ToggleLeft, ToggleRight, Wrench, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CertStatusBadge, IssuerTypeBadge, HealthBar, HostChips, DaysLeftBadge } from "@/components/certificates/cert-shared";
import { timeAgo, fullTime } from "@/components/auth-events/auth-shared";
import { useCertificate } from "@/mocks/useCertificates";
import { daysUntilExpiry, expiryStatus, healthScore } from "@/utils/certStats";
import { cn } from "@/lib/utils";

interface CertQuickDrawerProps {
  certId: string | null;
  onClose: () => void;
  onRenew: (certId: string) => void;
  onRevoke: (certId: string) => void;
  onToggleAutoRenew: (certId: string) => void;
  onAssign: (certId: string) => void;
}

export function CertQuickDrawer({ certId, onClose, onRenew, onRevoke, onToggleAutoRenew, onAssign }: CertQuickDrawerProps) {
  const { cert, events, status } = useCertificate(certId ?? "__none__");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!certId) return undefined;
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      lastFocusRef.current?.focus?.();
    };
  }, [certId, onClose]);

  useEffect(() => { if (certId) panelRef.current?.focus(); }, [certId]);

  if (!certId) return null;
  const title = cert?.commonName ?? "Loading certificate…";

  const daysLeft = cert ? daysUntilExpiry(cert.expiresAt) : 0;
  const statusOf = cert ? expiryStatus(cert.expiresAt, cert.revoked) : "Healthy";
  const score = cert ? healthScore({ daysLeft, signatureAlgorithm: cert.signatureAlgorithm, keySize: cert.keySize, chainValid: cert.chainValid, autoRenew: cert.autoRenew, revoked: cert.revoked }) : 0;
  const pct = cert ? Math.max(0, Math.min(100, Math.round(((Date.now() - Date.parse(cert.issuedAt)) / (Date.parse(cert.expiresAt) - Date.parse(cert.issuedAt))) * 100))) : 0;

  return createPortal(
    <div className="fixed inset-0 z-[40]" role="dialog" aria-modal="true" aria-label={`Certificate ${title}`}>
      <button type="button" aria-label="Close drawer" className="absolute inset-0 bg-[#0c1b2c]/55 backdrop-blur-[0.125rem]" onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} className="absolute inset-y-0 right-0 flex w-[min(32.5rem,100vw)] flex-col border-l border-border bg-card shadow-2xl outline-none">
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <span className="min-w-0">
            <span className="block font-mono text-[0.6875rem] font-semibold text-muted-foreground">{cert?.id ?? certId}</span>
            <span className="mt-0.5 block truncate text-sm font-bold text-foreground" title={title}>{title}</span>
          </span>
          <button type="button" onClick={onClose} aria-label="Close drawer" className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X size={17} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {status === "loading" && <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>}
          {status === "error" && <p className="text-sm text-muted-foreground">Could not load this certificate.</p>}
          {status === "success" && cert && (
            <>
              <div className="flex flex-wrap items-center gap-2"><CertStatusBadge status={statusOf} /><IssuerTypeBadge type={cert.issuerType} /><DaysLeftBadge daysLeft={daysLeft} revoked={cert.revoked} /></div>

              {/* Validity timeline */}
              <div className="mt-4 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between text-[0.6875rem] text-muted-foreground"><span>Issued {new Date(cert.issuedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span><span>Expires {new Date(cert.expiresAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Validity progress ${pct}%`}><div className={cn("h-full rounded-full", pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-400" : "bg-emerald-500")} style={{ width: `${pct}%` }} /></div>
                <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">Today — {pct}% of validity elapsed</p>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-[0.8125rem]">
                <div><dt className="text-[0.6875rem] text-muted-foreground">Issuer</dt><dd className="font-medium">{cert.issuer}</dd></div>
                <div><dt className="text-[0.6875rem] text-muted-foreground">Algorithm</dt><dd className="font-mono text-xs">{cert.signatureAlgorithm}</dd></div>
                <div><dt className="text-[0.6875rem] text-muted-foreground">Key</dt><dd>{cert.keyType} {cert.keySize}</dd></div>
                <div><dt className="text-[0.6875rem] text-muted-foreground">Service</dt><dd>{cert.service} · :{cert.port}</dd></div>
                <div><dt className="text-[0.6875rem] text-muted-foreground">Auto-renew</dt><dd>{cert.autoRenew ? "Enabled" : "Manual"}</dd></div>
                <div><dt className="text-[0.6875rem] text-muted-foreground">Owner</dt><dd>{cert.ownerId}</dd></div>
              </dl>

              <div className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-muted/40 p-3">
                <span className="text-xs text-muted-foreground">Health score</span>
                <HealthBar score={score} />
              </div>

              <p className="mt-4 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">SANs ({cert.sans.length})</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">{cert.sans.map((san) => <li key={san} className="rounded border border-border bg-muted/40 px-2 py-1 font-mono text-[0.6875rem] text-muted-foreground">{san}</li>)}</ul>

              <p className="mt-4 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Hosts</p>
              <HostChips hosts={cert.hostIds} max={4} className="mt-1" />

              <div className="mt-4 flex items-center gap-2 rounded-lg border border-border p-3">
                <span className="min-w-0 flex-1 truncate font-mono text-[0.6875rem] text-muted-foreground" title={cert.fingerprintSha256}>{cert.fingerprintSha256}</span>
                <button type="button" onClick={() => { try { void navigator.clipboard?.writeText(cert.fingerprintSha256); } catch { /* noop */ } }} aria-label="Copy fingerprint" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><Copy size={14} /></button>
              </div>

              {events.length > 0 && (
                <>
                  <p className="mt-4 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Recent events</p>
                  <ul className="mt-1 divide-y divide-border rounded-lg border border-border">
                    {events.slice(0, 4).map((event) => (
                      <li key={event.id} className="flex items-start gap-2 px-3 py-2 text-[0.75rem]">
                        <span className="min-w-0 flex-1 text-muted-foreground">{event.detail}</span>
                        <span className="shrink-0 tabular-nums text-[0.6875rem] text-muted-foreground">{timeAgo(event.at)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button size="sm" className="justify-start" onClick={() => onRenew(cert.id)}><RotateCcw size={13} />Renew</Button>
                <Button variant="outline" size="sm" className="justify-start" onClick={() => onToggleAutoRenew(cert.id)}>{cert.autoRenew ? <ToggleLeft size={15} /> : <ToggleRight size={15} />}{cert.autoRenew ? "Disable" : "Enable"} auto-renew</Button>
              </div>
              <Link href={`/certificates-and-expiration/${cert.id}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">Open full details <ChevronRight size={14} aria-hidden="true" /></Link>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
