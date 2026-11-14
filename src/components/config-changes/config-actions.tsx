"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronRight, CircleCheck, Layers, Loader2, Lock, ScanLine, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  MOCK_ADMIN_PERMISSION, acceptConfigBaseline, approveConfigChange, markConfigExpected,
  rejectConfigChange, rollbackConfigChange, runConfigDriftScan, type ConfigChange,
} from "@/mocks/security";
import { CURRENT_USER_NAME } from "@/mocks/incidents";
import { ADMIN_PERMISSION_HINT } from "@/components/auth-events/auth-shared";
import { maskValue, splitPath } from "@/components/config-changes/config-shared";
export { AuthToast, useAuthToast, type AuthToastState, type AuthDialogDone } from "@/components/auth-events/auth-actions";

export interface ConfigDialogDone {
  message: string;
  href?: string;
  undo?: () => void;
}

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (result: ConfigDialogDone) => void;
}

const inputClasses =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring";

function ReasonField({ value, onChange, placeholder, autoFocus = false, label = "Reason" }: { value: string; onChange: (value: string) => void; placeholder?: string; autoFocus?: boolean; label?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
      {label}
      <textarea autoFocus={autoFocus} rows={2} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" />
    </label>
  );
}

function AdminFootnote({ danger }: { danger?: boolean }) {
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
      <AdminFootnote danger={danger} />
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={onConfirm} disabled={blocked} title={adminOnly && !MOCK_ADMIN_PERMISSION ? ADMIN_PERMISSION_HINT : undefined} variant={danger ? "destructive" : "default"} className={cn("h-10", danger && "bg-red-600 text-white hover:bg-red-700")}>{confirmLabel}</Button>
      </div>
    </DialogFooter>
  );
}

/** Shows the masked before → after for context inside dialogs. */
function MaskedDiff({ change }: { change: Pick<ConfigChange, "path" | "beforeValue" | "afterValue"> }) {
  const [file, setting] = splitPath(change.path);
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-2 font-mono text-xs">
      <p className="truncate text-muted-foreground" title={file}>{file}</p>
      <p className="mt-1 flex flex-wrap items-center gap-2"><span className="text-muted-foreground">{setting}:</span><span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-700 dark:text-rose-300">{maskValue(change.path, change.beforeValue)}</span><span aria-hidden="true">→</span><span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">{maskValue(change.path, change.afterValue)}</span></p>
    </div>
  );
}

/* ------------------------------- Approve ---------------------------------- */

export function ApproveChangeDialog({ open, onOpenChange, change, onDone }: BaseDialogProps & { change: ConfigChange | null }) {
  const [ticket, setTicket] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) { setTicket(change?.ticket ?? ""); setReason(""); } }, [open, change?.ticket]);
  if (!change) return null;
  const confirm = () => {
    approveConfigChange(change.id, { ticket: ticket.trim() || null, reason: reason.trim() || "Approved via dashboard" });
    onDone({ message: `Change ${change.id} approved` });
    onOpenChange(false);
  };
  const valid = ticket.trim().length > 0 || reason.trim().length > 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(460px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Check size={17} className="text-emerald-600" aria-hidden="true" />Approve change</DialogTitle>
          <DialogDescription>Approves <b>{change.id}</b> on <b>{change.assetName}</b>. A ticket or a written reason is required for the audit trail.</DialogDescription>
        </DialogHeader>
        <MaskedDiff change={change} />
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1.5 font-medium">
            Ticket <span className="font-normal text-muted-foreground">(optional if reason is given)</span>
            <input autoFocus value={ticket} onChange={(event) => setTicket(event.target.value)} placeholder="CHG-2041" aria-label="Change ticket" className={cn(inputClasses, "font-mono")} />
          </label>
          <ReasonField value={reason} onChange={setReason} placeholder="e.g. Reviewed against baseline; change matches MW-1047" label="Reason" />
        </div>
        <ConfirmFooter onOpenChange={onOpenChange} confirmLabel="Approve" onConfirm={confirm} disabled={!valid} />
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- Reject ---------------------------------- */

export function RejectChangeDialog({ open, onOpenChange, change, onDone }: BaseDialogProps & { change: ConfigChange | null }) {
  const [reason, setReason] = useState("");
  const [createRollback, setCreateRollback] = useState(true);
  useEffect(() => { if (open) { setReason(""); setCreateRollback(true); } }, [open]);
  if (!change) return null;
  const confirm = () => {
    rejectConfigChange(change.id, { reason: reason.trim(), createRollback });
    onDone({ message: `Change ${change.id} rejected${createRollback ? " · rollback task created" : ""}` });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(460px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert size={16} className="text-red-500" aria-hidden="true" />Reject change</DialogTitle>
          <DialogDescription>Rejects <b>{change.id}</b>. The change will be reverted on <b>{change.assetName}</b> at the next agent sync (mock).</DialogDescription>
        </DialogHeader>
        <MaskedDiff change={change} />
        <ReasonField value={reason} onChange={setReason} autoFocus placeholder="Why should this change be reverted?" />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={createRollback} onChange={(event) => setCreateRollback(event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Create rollback task and assign to asset owner
        </label>
        <ConfirmFooter onOpenChange={onOpenChange} confirmLabel="Reject change" onConfirm={confirm} disabled={reason.trim().length === 0} danger />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Mark expected ----------------------------- */

export function MarkExpectedDialog({ open, onOpenChange, change, onDone }: BaseDialogProps & { change: ConfigChange | null }) {
  const [reason, setReason] = useState("");
  const [expiry, setExpiry] = useState("30d");
  useEffect(() => { if (open) { setReason(""); setExpiry("30d"); } }, [open]);
  if (!change) return null;
  const expiresAt = expiry === "never" ? null : new Date(Date.now() + (expiry === "7d" ? 7 : 30) * 86_400_000).toISOString().slice(0, 10);
  const confirm = () => {
    markConfigExpected(change.id, { reason: reason.trim(), expiresAt });
    onDone({ message: `Change ${change.id} marked as expected` });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(440px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Mark as expected</DialogTitle>
          <DialogDescription>Suppresses drift alerts for <b>{change.id}</b>. Reclassifies it as an approved recurring change.</DialogDescription>
        </DialogHeader>
        <MaskedDiff change={change} />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Expires
          <Select value={expiry} onValueChange={setExpiry}>
            <SelectTrigger className="h-9 w-full text-sm" aria-label="Expected expiry"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">In 7 days</SelectItem>
              <SelectItem value="30d">In 30 days (default)</SelectItem>
              <SelectItem value="never">Never (until reclassified)</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <ReasonField value={reason} onChange={setReason} autoFocus placeholder="e.g. Recurring patch cadence, covered by MW-1047" />
        <ConfirmFooter onOpenChange={onOpenChange} confirmLabel="Mark expected" onConfirm={confirm} disabled={reason.trim().length === 0} />
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- Accept baseline ---------------------------- */

export function AcceptBaselineDialog({ open, onOpenChange, change, onDone }: BaseDialogProps & { change: ConfigChange | null }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  if (!change) return null;
  const confirm = () => {
    acceptConfigBaseline(change.id, { reason: reason.trim() });
    onDone({ message: `${change.id} accepted as new baseline` });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(460px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Accept as new baseline</DialogTitle>
          <DialogDescription>The current state of <b>{change.path.split(":")[0]}</b> becomes the new compliance baseline for <b>{change.assetName}</b>. Approved by <b>{CURRENT_USER_NAME}</b>.</DialogDescription>
        </DialogHeader>
        <MaskedDiff change={change} />
        <ReasonField value={reason} onChange={setReason} autoFocus placeholder="Why should this become the new baseline?" />
        <ConfirmFooter onOpenChange={onOpenChange} confirmLabel="Accept baseline" onConfirm={confirm} disabled={reason.trim().length === 0} />
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- Rollback -------------------------------- */

const ROLLBACK_STEPS = ["Snapshot verified", "Stopping nexus-agent", "Restoring files", "Restarting services", "Verifying checksum"] as const;

export function RollbackDialog({ open, onOpenChange, change, snapshots, onDone }: BaseDialogProps & { change: ConfigChange | null; snapshots: Array<{ id: string; takenAt: string; version: number }> }) {
  const [snapshotId, setSnapshotId] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!open) { setRunning(false); setStep(0); setConfirmText(""); return; }
    setSnapshotId(snapshots[0]?.id ?? "");
    setConfirmText("");
    setRunning(false);
    setStep(0);
  }, [open, snapshots]);
  useEffect(() => {
    if (!running) return undefined;
    if (step >= ROLLBACK_STEPS.length) return undefined;
    const timer = window.setTimeout(() => setStep((current) => current + 1), 520);
    return () => window.clearTimeout(timer);
  }, [running, step]);
  if (!change) return null;
  const matchesAsset = confirmText.trim() === change.assetId;
  const finish = () => {
    rollbackConfigChange(change.id, { snapshotId });
    onDone({ message: `${change.assetName} rolled back to ${snapshotId}` });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(500px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle size={16} className="text-red-500" aria-hidden="true" />Rollback change</DialogTitle>
          <DialogDescription>Restores <b>{change.id}</b> on <b>{change.assetName}</b> from a snapshot. Type the asset name to confirm.</DialogDescription>
        </DialogHeader>
        {!running ? (
          <>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Snapshot version
              <Select value={snapshotId} onValueChange={setSnapshotId}>
                <SelectTrigger className="h-9 w-full text-sm" aria-label="Rollback snapshot"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {snapshots.map((snapshot) => <SelectItem key={snapshot.id} value={snapshot.id}>v{snapshot.version} · {snapshot.id} · {new Date(snapshot.takenAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <MaskedDiff change={change} />
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Type <code className="rounded bg-muted px-1">{change.assetId}</code> to confirm
              <input autoFocus value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder={change.assetId} aria-label="Confirm asset name" className={cn(inputClasses, "font-mono")} autoComplete="off" />
            </label>
            <ConfirmFooter onOpenChange={onOpenChange} confirmLabel="Rollback now" onConfirm={() => { setRunning(true); setStep(0); }} disabled={!matchesAsset || !snapshotId} danger />
          </>
        ) : (
          <div className="flex flex-col gap-3 py-1">
            <ol className="flex flex-col gap-2">
              {ROLLBACK_STEPS.map((label, index) => {
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
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.min(100, step * 20)} aria-valuemin={0} aria-valuemax={100} aria-label="Rollback progress"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, step * 20)}%` }} /></div>
            <Button className="h-10" disabled={step < ROLLBACK_STEPS.length} onClick={finish}>{step < ROLLBACK_STEPS.length ? "Restoring…" : "Done — close"}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Run drift scan ---------------------------- */

const SCAN_STEPS = ["Collecting baselines", "Hashing files", "Comparing checksums", "Evaluating against CIS"] as const;

export function RunDriftScanDialog({ open, onOpenChange, onDone, onScanned }: BaseDialogProps & { onScanned: () => void }) {
  const [scope, setScope] = useState("all");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [found, setFound] = useState<ConfigChange[]>([]);
  useEffect(() => {
    if (!open) { setRunning(false); setStep(0); setFound([]); return; }
    setRunning(false); setStep(0); setFound([]); setScope("all");
  }, [open]);
  useEffect(() => {
    if (!running) return undefined;
    if (step >= SCAN_STEPS.length) return undefined;
    const timer = window.setTimeout(() => setStep((current) => current + 1), 450);
    return () => window.clearTimeout(timer);
  }, [running, step]);
  useEffect(() => {
    if (running && step === SCAN_STEPS.length) {
      const scopeLabel = scope === "all" ? "All assets" : scope;
      setFound(runConfigDriftScan({ label: scopeLabel }));
    }
  }, [running, step, scope]);
  const close = () => {
    onOpenChange(false);
    if (found.length > 0) { onScanned(); onDone({ message: `Drift scan found ${found.length} changes · showing results` }); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(480px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine size={17} className="text-primary" aria-hidden="true" />Run drift scan</DialogTitle>
          <DialogDescription>Compares current state against the approved baseline. In production this runs on the agents; here it is simulated.</DialogDescription>
        </DialogHeader>
        {!running && found.length === 0 ? (
          <>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Scope
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="h-9 w-full text-sm" aria-label="Scan scope"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assets (10)</SelectItem>
                  <SelectItem value="API Services">API Services (4)</SelectItem>
                  <SelectItem value="Database Cluster">Database Cluster (1)</SelectItem>
                  <SelectItem value="api-server-01">api-server-01 only</SelectItem>
                  <SelectItem value="edge-01">edge-01 only</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <Button className="h-10" onClick={() => { setRunning(true); setStep(0); }}><ScanLine size={15} />Start scan</Button>
          </>
        ) : found.length === 0 ? (
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
        ) : (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Layers size={15} aria-hidden="true" />2 new drifts detected</p>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-[13px]">
              {found.map((change) => (
                <li key={change.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><AlertTriangle size={12} /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-mono font-semibold">{change.path}</span><span className="text-xs text-muted-foreground">{change.assetName} · {change.category}</span></span>
                  <ChevronRight size={14} className="text-muted-foreground" aria-hidden="true" />
                </li>
              ))}
            </ul>
            <Button className="h-10" onClick={close}>View changes</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
