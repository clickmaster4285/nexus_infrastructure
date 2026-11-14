"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Lock, ShieldAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  MOCK_ADMIN_PERMISSION, authSessionCountFor, blockAuthIp, createAuthIncident, forceAuthPasswordReset,
  getAuthEventById, markAuthReviewed, revokeAuthSessions, setAuthAccountLocked, unblockAuthIp,
  AUTH_DETECTION_LABEL, type AuthDetection, type AuthEvent,
} from "@/mocks/security";
import { ADMIN_PERMISSION_HINT, DetectionStatusBadge, SeverityBadge, timeAgo } from "@/components/auth-events/auth-shared";

export interface AuthDialogDone {
  message: string;
  href?: string;
  undo?: () => void;
}

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (result: AuthDialogDone) => void;
}

const inputClasses =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring";

function ReasonField({ value, onChange, required = true, autoFocus = false, placeholder = "Add a reason (required)" }: { value: string; onChange: (value: string) => void; required?: boolean; autoFocus?: boolean; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
      Reason{required ? "" : " (optional)"}
      <textarea
        autoFocus={autoFocus}
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Reason"
        className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function AdminFooterNote({ danger }: { danger?: boolean }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground" title={MOCK_ADMIN_PERMISSION ? undefined : ADMIN_PERMISSION_HINT}>
      <Lock size={12} aria-hidden="true" />
      {MOCK_ADMIN_PERMISSION ? "Demo: action runs with admin elevation." : ADMIN_PERMISSION_HINT}
      {danger && <span aria-hidden="true" className="ml-1 text-red-500">· this affects production traffic</span>}
    </p>
  );
}

function ConfirmFooter({ open, onOpenChange, confirmLabel, onConfirm, disabled, danger, adminOnly = true }: { open: boolean; onOpenChange: (open: boolean) => void; confirmLabel: string; onConfirm: () => void; disabled?: boolean; danger?: boolean; adminOnly?: boolean }) {
  const blocked = disabled || (adminOnly && !MOCK_ADMIN_PERMISSION);
  return (
    <DialogFooter className="items-center sm:justify-between">
      <AdminFooterNote danger={danger} />
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button
          onClick={onConfirm}
          disabled={blocked}
          title={adminOnly && !MOCK_ADMIN_PERMISSION ? ADMIN_PERMISSION_HINT : undefined}
          variant={danger ? "destructive" : "default"}
          className={cn("h-10", danger && "bg-red-600 text-white hover:bg-red-700")}
        >
          {confirmLabel}
        </Button>
      </div>
    </DialogFooter>
  );
}

/* -------------------------------- Block IP -------------------------------- */

export function BlockIpDialog({ open, onOpenChange, ips, onDone }: BaseDialogProps & { ips: string[] }) {
  const [duration, setDuration] = useState("24h");
  const [customHours, setCustomHours] = useState("6");
  const [scope, setScope] = useState("all");
  const [reason, setReason] = useState("");
  if (ips.length === 0) return null;
  const single = ips.length === 1 ? ips[0] : null;
  const effectiveDuration = duration === "custom" ? `${customHours || "0"}h` : duration;
  const confirm = () => {
    for (const ip of ips) blockAuthIp(ip, { duration: effectiveDuration, reason: reason.trim(), scope });
    onDone({
      message: single ? `${single} blocked for ${effectiveDuration}` : `${ips.length} IPs blocked for ${effectiveDuration}`,
      undo: () => { for (const ip of ips) unblockAuthIp(ip); },
    });
    onOpenChange(false);
    setReason("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(480px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert size={17} className="text-red-500" aria-hidden="true" />{single ? "Block IP address" : `Block ${ips.length} IP addresses`}</DialogTitle>
          <DialogDescription>
            {single
              ? <>All traffic from <b className="font-mono text-foreground">{single}</b> will be rejected at the edge. Active events and alerts are kept.</>
              : <>All traffic from <b className="text-foreground">{ips.length} source IPs</b> will be rejected at the edge.</>}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 font-medium">
              Duration
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-9 w-full text-sm" aria-label="Block duration"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                  <SelectItem value="custom">Custom…</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {duration === "custom" && (
              <label className="flex flex-col gap-1.5 font-medium">
                Hours
                <input type="number" min={1} max={720} value={customHours} onChange={(event) => setCustomHours(event.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring" aria-label="Custom duration in hours" />
              </label>
            )}
          </div>
          <label className="flex flex-col gap-1.5 font-medium">
            Scope
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="h-9 w-full text-sm" aria-label="Block scope"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All applications & servers</SelectItem>
                <SelectItem value="vpn.nexus.io">vpn.nexus.io only</SelectItem>
                <SelectItem value="grafana.nexus.io">grafana.nexus.io only</SelectItem>
                <SelectItem value="api-server-01">api-server-01 only</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <ReasonField value={reason} onChange={setReason} autoFocus placeholder="e.g. Brute force from 203.0.113.44 (486 attempts / 24h)" />
        </div>
        <ConfirmFooter open={open} onOpenChange={onOpenChange} confirmLabel="Block IP" onConfirm={confirm} disabled={reason.trim().length === 0} danger />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Lock account ------------------------------ */

export function LockAccountDialog({ open, onOpenChange, user, locked, onDone }: BaseDialogProps & { user: string | null; locked: boolean }) {
  const [reason, setReason] = useState("");
  if (user == null) return null;
  const confirm = () => {
    setAuthAccountLocked(user, !locked, reason.trim());
    onDone({ message: locked ? `${user} unlocked` : `${user} locked`, undo: () => setAuthAccountLocked(user, locked, "Undo via toast") });
    onOpenChange(false);
    setReason("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(440px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock size={16} aria-hidden="true" />{locked ? "Unlock account" : "Lock account"}</DialogTitle>
          <DialogDescription>
            {locked
              ? <>Restores sign-in for <b className="text-foreground">{user}</b>. Existing sessions stay revoked until the user signs in again.</>
              : <>Blocks all new sign-ins for <b className="text-foreground">{user}</b> across the fleet. Active sessions are not terminated until revoked.</>}
          </DialogDescription>
        </DialogHeader>
        <ReasonField value={reason} onChange={setReason} autoFocus placeholder={locked ? "Why is this account being restored?" : "Why is this account being locked?"} />
        <ConfirmFooter open={open} onOpenChange={onOpenChange} confirmLabel={locked ? "Unlock" : "Lock"} onConfirm={confirm} disabled={reason.trim().length === 0} danger={!locked} />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------- Force reset / Revoke --------------------------- */

function SessionCountDialog({ open, onOpenChange, user, kind, onDone }: BaseDialogProps & { user: string | null; kind: "reset" | "revoke" }) {
  if (user == null) return null;
  const sessions = authSessionCountFor(user);
  const confirm = () => {
    if (kind === "reset") {
      const count = forceAuthPasswordReset(user);
      onDone({ message: `Password reset forced for ${user} · ${count} sessions invalidated` });
    } else {
      const count = revokeAuthSessions(user);
      onDone({ message: `${count} active sessions revoked for ${user}` });
    }
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(440px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle size={16} className={kind === "reset" ? "text-amber-500" : "text-red-500"} aria-hidden="true" />{kind === "reset" ? "Force password reset" : "Revoke sessions"}</DialogTitle>
          <DialogDescription>
            <b className="text-foreground">{sessions} active sessions</b> for <b className="text-foreground">{user}</b> will be invalidated immediately.
            {kind === "reset" ? " The user must set a new password at next sign-in." : " The user will be signed out of every device."}
          </DialogDescription>
        </DialogHeader>
        <ConfirmFooter open={open} onOpenChange={onOpenChange} confirmLabel={kind === "reset" ? "Force reset" : "Revoke sessions"} onConfirm={confirm} danger />
      </DialogContent>
    </Dialog>
  );
}

export function ForceResetDialog(props: BaseDialogProps & { user: string | null }) {
  return <SessionCountDialog {...props} kind="reset" />;
}

export function RevokeSessionsDialog(props: BaseDialogProps & { user: string | null }) {
  return <SessionCountDialog {...props} kind="revoke" />;
}

/* ----------------------------- False positive ----------------------------- */

export function FalsePositiveDialog({ open, onOpenChange, ids, onDone }: BaseDialogProps & { ids: string[] }) {
  const [reason, setReason] = useState("");
  if (ids.length === 0) return null;
  const confirm = () => {
    markAuthReviewed(ids, "False positive", reason.trim());
    onDone({ message: `${ids.length} ${ids.length === 1 ? "event" : "events"} marked as false positive` });
    onOpenChange(false);
    setReason("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(440px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Mark as false positive</DialogTitle>
          <DialogDescription>{ids.length} {ids.length === 1 ? "event" : "events"} will be handed back to the detection engine as training feedback. Linked detections keep their status.</DialogDescription>
        </DialogHeader>
        <ReasonField value={reason} onChange={setReason} autoFocus placeholder="Why is this activity expected?" />
        <ConfirmFooter open={open} onOpenChange={onOpenChange} confirmLabel="Mark false positive" onConfirm={confirm} disabled={reason.trim().length === 0} />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Mark reviewed ----------------------------- */

export function MarkReviewedDialog({ open, onOpenChange, ids, onDone }: BaseDialogProps & { ids: string[] }) {
  if (ids.length === 0) return null;
  const confirm = () => {
    markAuthReviewed(ids, "Reviewed");
    onDone({ message: `${ids.length} ${ids.length === 1 ? "event" : "events"} marked as reviewed`, undo: () => markAuthReviewed(ids, "New", "Undo via toast") });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(420px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Mark as reviewed</DialogTitle>
          <DialogDescription>Marks {ids.length} {ids.length === 1 ? "event" : "events"} as triaged by your team. The finding stays visible in the feed but is tagged “Reviewed”.</DialogDescription>
        </DialogHeader>
        <ConfirmFooter open={open} onOpenChange={onOpenChange} confirmLabel="Mark reviewed" onConfirm={confirm} />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Create incident --------------------------- */

export function CreateIncidentDialog({ open, onOpenChange, prefill, onDone }: BaseDialogProps & { prefill: { title: string; impact: string; hosts?: string[] } }) {
  const [title, setTitle] = useState(prefill.title);
  const [severity, setSeverity] = useState<"SEV1" | "SEV2" | "SEV3">("SEV2");
  const [impact, setImpact] = useState(prefill.impact);
  useEffect(() => {
    if (open) {
      setTitle(prefill.title);
      setSeverity("SEV2");
      setImpact(prefill.impact);
    }
  }, [open, prefill.title, prefill.impact]);
  const confirm = () => {
    const id = createAuthIncident({ title, severity, impact, hosts: prefill.hosts, tags: ["security", "auth"] });
    onDone({ message: `Incident ${id} declared`, href: `/incidents/${id}` });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(480px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Create incident</DialogTitle>
          <DialogDescription>Declares an incident in Incidents with this event as context. Responders are paged per the auth escalation policy.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1.5 font-medium">
            Title
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} className={inputClasses} aria-label="Incident title" />
          </label>
          <label className="flex flex-col gap-1.5 font-medium">
            Severity
            <Select value={severity} onValueChange={(value) => setSeverity(value as "SEV1" | "SEV2" | "SEV3")}>
              <SelectTrigger className="h-9 w-full text-sm" aria-label="Incident severity"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SEV1">SEV1 — critical impact</SelectItem>
                <SelectItem value="SEV2">SEV2 — major degradation</SelectItem>
                <SelectItem value="SEV3">SEV3 — minor / contained</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 font-medium">
            Impact summary
            <textarea rows={2} value={impact} onChange={(event) => setImpact(event.target.value)} className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" aria-label="Impact summary" />
          </label>
        </div>
        <ConfirmFooter open={open} onOpenChange={onOpenChange} confirmLabel="Create incident" onConfirm={confirm} disabled={title.trim().length === 0} />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- Detection -------------------------------- */

export function DetectionDialog({ detection, open, onOpenChange, onBlockIp, onLockUser, onInvestigate }: {
  detection: AuthDetection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBlockIp: (ip: string) => void;
  onLockUser: (user: string) => void;
  onInvestigate: (id: string) => void;
}) {
  if (!detection) return null;
  const isIp = !detection.subject.includes("@");
  const related = detection.relatedEventIds.map((id) => getAuthEventById(id)).filter((event): event is AuthEvent => event != null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(560px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2"><SeverityBadge severity={detection.severity} />{AUTH_DETECTION_LABEL[detection.type]}<span className="font-mono text-sm text-muted-foreground">{detection.id}</span></DialogTitle>
          <DialogDescription className="break-all">{detection.detail}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm sm:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Subject</p><p className="mt-0.5 break-all font-mono text-[13px] font-semibold">{detection.subject}</p></div>
          <div><p className="text-xs text-muted-foreground">Events</p><p className="mt-0.5 font-semibold tabular-nums">{detection.count.toLocaleString()}</p></div>
          <div><p className="text-xs text-muted-foreground">First seen</p><p className="mt-0.5 font-semibold">{timeAgo(detection.firstSeen)}</p></div>
          <div><p className="text-xs text-muted-foreground">Status</p><div className="mt-0.5"><DetectionStatusBadge status={detection.status} /></div></div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Related events ({related.length})</p>
          <ul className="mt-1.5 max-h-52 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {related.map((event) => (
              <li key={event.id}>
                <a href={`/authentication-events/${event.id}`} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/50">
                  <span className="min-w-0 truncate font-mono font-semibold text-primary">{event.id}</span>
                  <span className="min-w-0 truncate text-muted-foreground">{event.method} · {event.result}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(event.time)}</span>
                </a>
              </li>
            ))}
            {related.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted-foreground">No sampled events mapped yet.</li>}
          </ul>
        </div>
        <DialogFooter className="flex-wrap items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Respond inline or open an event for full context.</p>
          <div className="flex flex-wrap items-center gap-2">
            {isIp
              ? <Button variant="outline" className="h-9" onClick={() => onBlockIp(detection.subject)}>Block IP</Button>
              : <Button variant="outline" className="h-9" onClick={() => onLockUser(detection.subject)}>Lock user</Button>}
            {detection.status === "Open" && <Button className="h-9" onClick={() => onInvestigate(detection.id)}>Investigate</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- toast --------------------------------- */

export interface AuthToastState extends AuthDialogDone {
  id: number;
}

export function AuthToast({ toast, onUndo, onDismiss }: { toast: AuthToastState | null; onUndo?: (toast: AuthToastState) => void; onDismiss: () => void }) {
  if (!toast) return null;
  return (
    <div role="status" className="fixed bottom-4 right-4 z-[1300] flex max-w-md items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-lg">
      <span className="min-w-0">{toast.message}</span>
      {toast.href && <a href={toast.href} className="shrink-0 font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">View →</a>}
      {toast.undo && <button type="button" className="shrink-0 rounded font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { toast.undo?.(); onUndo?.(toast); onDismiss(); }}>Undo</button>}
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="shrink-0 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"><X size={14} aria-hidden="true" /></button>
    </div>
  );
}

/** Shared toast state helper for the auth pages. */
export function useAuthToast() {
  const [toast, setToast] = useState<AuthToastState | null>(null);
  const notify = (result: AuthDialogDone) => setToast({ id: Date.now(), ...result });
  const dismiss = () => setToast(null);
  return { toast, notify, dismiss };
}
