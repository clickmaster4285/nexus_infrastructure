"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleCheck, Loader2, Lock, ScanLine, ShieldCheck, Wrench, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MOCK_ADMIN_PERMISSION } from "@/mocks/security";
import {
  renewCertificate, revokeCertificate, setCertificateAutoRenew, assignCertificateOwner as assignOwner, scanCertificates,
  type CertRenewalMethod, type Certificate,
} from "@/mocks/certificates";
import { ADMIN_PERMISSION_HINT } from "@/components/auth-events/auth-shared";
import { CURRENT_USER_NAME } from "@/mocks/incidents";
export { AuthToast, useAuthToast } from "@/components/auth-events/auth-actions";

export interface CertDialogDone {
  message: string;
  href?: string;
  undo?: () => void;
}

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (result: CertDialogDone) => void;
}

const inputClasses = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring";

function AdminNote({ danger }: { danger?: boolean }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground" title={MOCK_ADMIN_PERMISSION ? undefined : ADMIN_PERMISSION_HINT}>
      <Lock size={12} aria-hidden="true" />
      {MOCK_ADMIN_PERMISSION ? "Demo: action runs with admin elevation." : ADMIN_PERMISSION_HINT}
      {danger && <span aria-hidden="true" className="ml-1 text-red-500">· production impact</span>}
    </p>
  );
}

function ConfirmFooter({ confirmLabel, onConfirm, disabled, danger, onOpenChange, adminOnly = true }: { confirmLabel: string; onConfirm: () => void; disabled?: boolean; danger?: boolean; onOpenChange: (open: boolean) => void; adminOnly?: boolean }) {
  const blocked = disabled || (adminOnly && !MOCK_ADMIN_PERMISSION);
  return (
    <DialogFooter className="items-center sm:justify-between">
      <AdminNote danger={danger} />
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={onConfirm} disabled={blocked} title={adminOnly && !MOCK_ADMIN_PERMISSION ? ADMIN_PERMISSION_HINT : undefined} variant={danger ? "destructive" : "default"} className={cn("h-10", danger && "bg-red-600 text-white hover:bg-red-700")}>{confirmLabel}</Button>
      </div>
    </DialogFooter>
  );
}

/* -------------------------------- Scan modal ------------------------------- */

const SCAN_STEPS = ["Preparing scope", "Reading PEMs", "Checking revocation lists", "Correlating SANs"] as const;

export function ScanCertificatesModal({ open, onOpenChange, onDone }: BaseDialogProps) {
  const [scope, setScope] = useState("all");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => { if (open) { setScope("all"); setRunning(false); setStep(0); } }, [open]);
  useEffect(() => {
    if (!running) return undefined;
    if (step >= SCAN_STEPS.length) return undefined;
    const timer = window.setTimeout(() => setStep((current) => current + 1), 480);
    return () => window.clearTimeout(timer);
  }, [running, step]);
  useEffect(() => {
    if (running && step === SCAN_STEPS.length) {
      const timer = window.setTimeout(() => { scanCertificates({ label: scope === "all" ? "All servers" : scope }); onDone({ message: "Scan complete · no new findings" }); onOpenChange(false); }, 420);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [running, step, scope, onDone, onOpenChange]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(28.75rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine size={17} className="text-primary" aria-hidden="true" />Scan certificates</DialogTitle>
          <DialogDescription>Scans TLS endpoints in the selected scope. Simulated scan for the demo.</DialogDescription>
        </DialogHeader>
        {!running ? (
          <>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Scope
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="h-9 w-full text-sm" aria-label="Scan scope"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All servers (10)</SelectItem>
                  <SelectItem value="api-services">API Services (3)</SelectItem>
                  <SelectItem value="production-web">Production Web (2)</SelectItem>
                  <SelectItem value="edge-locations">Edge Locations (1)</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <Button className="h-10" onClick={() => setRunning(true)}><ScanLine size={15} />Start scan</Button>
          </>
        ) : (
          <div className="flex flex-col gap-3 py-1">
            <ol className="flex flex-col gap-2">
              {SCAN_STEPS.map((label, index) => {
                const done = step > index;
                const active = step === index;
                return (
                  <li key={label} className="flex items-center gap-2.5 text-sm">
                    {done ? <CircleCheck size={16} className="text-emerald-500" aria-hidden="true" /> : active ? <Loader2 size={16} className="animate-spin text-primary" aria-hidden="true" /> : <span className="h-4 w-4 rounded-full border border-border" aria-hidden="true" />}
                    <span className={done || active ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                  </li>
                );
              })}
            </ol>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.min(100, step * 25)} aria-valuemin={0} aria-valuemax={100} aria-label="Scan progress"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, step * 25)}%` }} /></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- Add cert --------------------------------- */

export function AddCertificateDialog({ open, onOpenChange, onDone }: BaseDialogProps) {
  const [commonName, setCommonName] = useState("new-app.nexus.io");
  const [host, setHost] = useState("web-app-01");
  const [owner, setOwner] = useState("Sara Iqbal");
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setCommonName("new-app.nexus.io"); setHost("web-app-01"); setOwner("Sara Iqbal"); setValidFrom(new Date().toISOString().slice(0, 10)); setError(null); } }, [open]);
  const domainOk = /^(?:\*\.)?[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/i.test(commonName.trim());
  const confirm = () => {
    if (!domainOk) { setError("Enter a valid domain or wildcard (e.g. *.nexus.io)"); return; }
    onDone({ message: `${commonName.trim()} added to inventory (mock)` });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(30rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Add certificate</DialogTitle>
          <DialogDescription>Fetch the PEM from the endpoint or generate one. Mock entry; fields are validated inline.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Common name
          <input autoFocus value={commonName} onChange={(event) => { setCommonName(event.target.value); setError(null); }} aria-invalid={!domainOk && commonName.length > 0} aria-label="Common name" className={cn(inputClasses, !domainOk && commonName.length > 0 && "border-red-400")} placeholder="app.nexus.io or *.nexus.io" />
          {!domainOk && commonName.length > 0 && <span className="text-xs text-red-600">Enter a valid domain or wildcard</span>}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Host
            <Select value={host} onValueChange={setHost}>
              <SelectTrigger className="h-9 w-full text-sm" aria-label="Host"><SelectValue /></SelectTrigger>
              <SelectContent>{["web-app-01", "web-app-02", "api-server-01", "db-01", "edge-01", "app-server-02", "cache-01"].map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Owner
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger className="h-9 w-full text-sm" aria-label="Owner"><SelectValue /></SelectTrigger>
              <SelectContent>{["Sara Iqbal", "Tom Becker", "Marcus Lee", "Priya Nair"].map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Valid from
          <input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} aria-label="Valid from" className={inputClasses} />
        </label>
        {error && <p className="text-xs font-semibold text-red-600" role="alert">{error}</p>}
        <ConfirmFooter onOpenChange={onOpenChange} confirmLabel="Add certificate" onConfirm={confirm} disabled={!domainOk} />
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- Renew ---------------------------------- */

export function RenewCertificateDialog({ open, onOpenChange, certId, method, onDone }: BaseDialogProps & { certId: string | null; method?: CertRenewalMethod }) {
  const [running, setRunning] = useState(false);
  const [chosenMethod, setChosenMethod] = useState<CertRenewalMethod>(method ?? "ACME");
  useEffect(() => { if (open) { setChosenMethod(method ?? "ACME"); setRunning(false); } }, [open, method]);
  if (certId == null) return null;
  const confirm = () => {
    setRunning(true);
    window.setTimeout(() => {
      renewCertificate(certId, { method: chosenMethod, years: 1 });
      onDone({ message: `${certId} renewed · valid for 1 year · status Healthy` });
      onOpenChange(false);
    }, 1200);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(28.75rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wrench size={17} className="text-primary" aria-hidden="true" />Renew certificate</DialogTitle>
          <DialogDescription>Issues a fresh certificate for <b>{certId}</b> and deploys it to the listed hosts. Simulated renew for the demo.</DialogDescription>
        </DialogHeader>
        {!running ? (
          <>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Renewal method
              <Select value={chosenMethod} onValueChange={(value) => setChosenMethod(value as CertRenewalMethod)}>
                <SelectTrigger className="h-9 w-full text-sm" aria-label="Renewal method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACME">ACME (Let's Encrypt / internal)</SelectItem>
                  <SelectItem value="Manual">Manual (issue + upload PEM)</SelectItem>
                  <SelectItem value="Vendor">Vendor managed (DigiCert / Sectigo)</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <ConfirmFooter onOpenChange={onOpenChange} confirmLabel="Renew now" onConfirm={confirm} />
          </>
        ) : (
          <div className="flex items-center gap-3 py-2 text-sm"><Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" /><span>Requesting certificate from CA and verifying deployment…</span></div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- Revoke --------------------------------- */

export function RevokeCertificateDialog({ open, onOpenChange, certId, onDone }: BaseDialogProps & { certId: string | null }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  if (certId == null) return null;
  const confirm = () => {
    revokeCertificate(certId, reason.trim());
    onDone({ message: `${certId} revoked` });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(28.75rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle size={16} className="text-red-500" aria-hidden="true" />Revoke certificate</DialogTitle>
          <DialogDescription><b>{certId}</b> will be revoked immediately. Clients will stop trusting it until reissued. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Reason (required)
          <textarea autoFocus rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. private key suspected compromised" aria-label="Revocation reason" className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <ConfirmFooter onOpenChange={onOpenChange} confirmLabel="Revoke" onConfirm={confirm} disabled={reason.trim().length === 0} danger />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- Assign owner ------------------------------ */

export function AssignCertOwnerDialog({ open, onOpenChange, certId, onDone }: BaseDialogProps & { certId: string | null }) {
  const [owner, setOwner] = useState("Sara Iqbal");
  const [multi, setMulti] = useState(false);
  useEffect(() => { if (open) { setOwner("Sara Iqbal"); setMulti(false); } }, [open]);
  if (certId == null) return null;
  const confirm = () => {
    assignOwner(certId, owner);
    onDone({ message: `${multi ? "Multiple certificates" : certId} assigned to ${owner}` });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(26.25rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Assign owner</DialogTitle>
          <DialogDescription>Assign remediation ownership for <b>{multi ? "the selected certificates" : certId}</b>.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Owner
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger className="h-9 w-full text-sm" aria-label="Owner"><SelectValue /></SelectTrigger>
            <SelectContent>{["Sara Iqbal", "Tom Becker", "Marcus Lee", "Priya Nair"].map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        {certId === "__bulk__" && <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={multi} onChange={(event) => setMulti(event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />Apply to all selected certificates</label>}
        <ConfirmFooter onOpenChange={onOpenChange} confirmLabel="Assign" onConfirm={confirm} />
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Auto-renew confirm --------------------------- */

export function ToggleAutoRenewDialog({ open, onOpenChange, certId, current, onDone }: BaseDialogProps & { certId: string | null; current: boolean }) {
  if (certId == null) return null;
  const enabling = !current;
  const confirm = () => {
    setCertificateAutoRenew(certId, enabling);
    onDone({ message: `${certId} auto-renew ${enabling ? "enabled" : "disabled"}` });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(26.25rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{enabling ? "Enable" : "Disable"} auto-renew</DialogTitle>
          <DialogDescription><b>{certId}</b> — {enabling ? "Let ACME renew and redeploy before expiry without manual action." : "Future renewals must be run manually; the cert will expire without intervention."}</DialogDescription>
        </DialogHeader>
        <ConfirmFooter onOpenChange={onOpenChange} confirmLabel={enabling ? "Enable" : "Disable"} onConfirm={confirm} danger={!enabling} adminOnly={!enabling} />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Download helper ---------------------------- */

export function downloadPem(cert: Certificate): void {
  const pem = [
    "-----BEGIN CERTIFICATE-----",
    "MIIB mock mock mock",
    `Subject: CN=${cert.commonName}`,
    `Issuer: ${cert.issuer}`,
    `Serial: ${cert.serial}`,
    `Not Before: ${new Date(cert.issuedAt).toISOString()}`,
    `Not After: ${new Date(cert.expiresAt).toISOString()}`,
    `Fingerprint SHA256: ${cert.fingerprintSha256}`,
    `Public Key: ${cert.keyType} ${cert.keySize}`,
    "-----END CERTIFICATE-----",
  ].join("\n");
  const blob = new Blob([pem], { type: "application/x-x509-ca-cert" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${cert.commonName.replace(/\*/g, "wildcard")}.pem`;
  anchor.click();
  URL.revokeObjectURL(url);
}
