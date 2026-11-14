"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, CircleCheck, Layers, KeyRound, Lock, Loader2, ScanLine, ShieldCheck, Users, X, Globe, Building2, Copy, CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MOCK_ADMIN_PERMISSION } from "@/mocks/security";
import {
  inviteUser, createToken, suspendUser, reactivateUser, requireMfa, deleteUser, resetPassword, rotateToken, revokeToken, revokeAllSessions,
  type User, type Role, type ApiToken,
} from "@/mocks/accessControl";
import { ADMIN_PERMISSION_HINT } from "@/components/auth-events/auth-shared";
export { AuthToast, useAuthToast } from "@/components/auth-events/auth-actions";
import { CURRENT_USER_NAME } from "@/mocks/incidents";

export interface AccessDialogDone {
  message: string;
  href?: string;
  undo?: () => void;
}

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (result: AccessDialogDone) => void;
}

const inputClasses = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring";

function AdminNote() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground" title={MOCK_ADMIN_PERMISSION ? undefined : ADMIN_PERMISSION_HINT}>
      <Lock size={12} aria-hidden="true" />
      {MOCK_ADMIN_PERMISSION ? "Demo: action runs with admin elevation." : ADMIN_PERMISSION_HINT}
    </p>
  );
}

function ConfirmFooter({ confirmLabel, onConfirm, disabled, danger, onOpenChange }: { confirmLabel: string; onConfirm: () => void; disabled?: boolean; danger?: boolean; onOpenChange: (open: boolean) => void }) {
  const blocked = disabled || !MOCK_ADMIN_PERMISSION;
  return (
    <DialogFooter className="items-center sm:justify-between">
      <AdminNote />
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={onConfirm} disabled={blocked} title={!MOCK_ADMIN_PERMISSION ? ADMIN_PERMISSION_HINT : undefined} variant="destructive" className={cn("h-10", danger && "bg-red-600 text-white hover:bg-red-700")}>{confirmLabel}</Button>
      </div>
    </DialogFooter>
  );
}

/* ------------------------------ Invite user ------------------------------- */

export function InviteUserDialog({ open, onOpenChange, onDone }: BaseDialogProps) {
  const [email, setEmail] = useState("newhire@nexus.io");
  const [roleId, setRoleId] = useState("role-operator");
  const [groups, setGroups] = useState<string[]>(["sre"]);
  const [requireMfaFlag, setRequireMfaFlag] = useState(true);
  const [message, setMessage] = useState("Welcome to Nexus. Please complete onboarding.");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setEmail("newhire@nexus.io"); setRoleId("role-operator"); setGroups(["sre"]); setRequireMfaFlag(true); setError(null); } }, [open]);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const confirm = () => {
    if (!emailOk) { setError("Enter a valid email"); return; }
    const id = inviteUser({ email: email.trim(), roleId, groupIds: groups });
    onDone({ message: `Invitation emailed to ${email.trim()} (${id})` });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(480px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>Sends an invite email. The user appears as “Invited” until they accept.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email
          <input autoFocus value={email} onChange={(event) => { setEmail(event.target.value); setError(null); }} aria-invalid={!emailOk && email.length > 0} aria-label="Email" className={cn(inputClasses, !emailOk && email.length > 0 && "border-red-400")} placeholder="name@nexus.io" />
          {!emailOk && email.length > 0 && <span className="text-xs text-red-600">Enter a valid email</span>}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Role
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger className="h-9 w-full text-sm" aria-label="Role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[
                  ["role-operator", "Operator"],
                  ["role-security-analyst", "Security Analyst"],
                  ["role-read-only", "Read-only Viewer"],
                  ["role-admin", "Administrator"],
                ].map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Groups
            <div className="flex flex-wrap gap-2">
              {["sre", "security", "platform", "database"].map((group) => (
                <label key={group} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground">
                  <input type="checkbox" checked={groups.includes(group)} onChange={() => setGroups((current) => current.includes(group) ? current.filter((item) => item !== group) : [...current, group])} aria-label={`Include group ${group}`} className="h-3.5 w-3.5 accent-[var(--primary)]" />
                  {group}
                </label>
              ))}
            </div>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={requireMfaFlag} onChange={(event) => setRequireMfaFlag(event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Require MFA before first login
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Invite message
          <textarea rows={2} value={message} onChange={(event) => setMessage(event.target.value)} aria-label="Invite message" className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <ConfirmFooter onOpenChange={onOpenChange} confirmLabel="Send invite" onConfirm={confirm} disabled={!emailOk} />
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- Create token ------------------------------- */

export function CreateTokenDialog({ open, onOpenChange, onDone }: BaseDialogProps) {
  const [name, setName] = useState("deploy-key-" + Date.now().toString(36));
  const [environment, setEnvironment] = useState<"production" | "staging" | "development">("production");
  const [expiry, setExpiry] = useState<"30d" | "90d" | "365d" | "never">("90d");
  const [scopes, setScopes] = useState<string[]>(["servers:view"]);
  const [overPriv, setOverPriv] = useState(false);
  useEffect(() => { if (open) { setName("deploy-key-" + Date.now().toString(36)); setEnvironment("production"); setExpiry("90d"); setScopes(["servers:view"]); setOverPriv(false); } }, [open]);
  const confirm = () => {
    const { id, secret } = createToken({ name: name.trim(), ownerId: "USR-1001", ownerName: "Admin", scopes: overPriv ? ["*"] : scopes, prefix: `nxs_live_${Math.random().toString(16).slice(2, 6)}`, createdAt: new Date().toISOString(), expiresAt: expiry === "never" ? null : new Date(Date.now() + (expiry === "30d" ? 30 : expiry === "90d" ? 90 : 365) * 86_400_000).toISOString(), environment });
    onDone({ message: `Token created: ${id}::${secret}` });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(480px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Create API token</DialogTitle>
          <DialogDescription>Token secret is shown only once after creation.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Token name
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} aria-label="Token name" className={inputClasses} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Environment
            <Select value={environment} onValueChange={(value) => setEnvironment(value as typeof environment)}>
              <SelectTrigger className="h-9 w-full text-sm" aria-label="Environment"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="production">Production</SelectItem><SelectItem value="staging">Staging</SelectItem><SelectItem value="development">Development</SelectItem></SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Expiry
            <Select value={expiry} onValueChange={(value) => setExpiry(value as typeof expiry)}>
              <SelectTrigger className="h-9 w-full text-sm" aria-label="Token expiry"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="30d">30 days</SelectItem><SelectItem value="90d">90 days</SelectItem><SelectItem value="365d">1 year</SelectItem><SelectItem value="never">Never (not recommended)</SelectItem></SelectContent>
            </Select>
          </label>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={overPriv} onChange={(event) => setOverPriv(event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" aria-label="Grant full access (*:*)" />Grant full access (*:*) <span className="text-xs text-red-600">over-privileged</span></label>
        <ConfirmFooter onOpenChange={onOpenChange} confirmLabel="Create token" onConfirm={confirm} disabled={name.trim().length === 0} />
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- Create role (mini) --------------------------- */

export function CreateRoleDialog({ open, onOpenChange, onDone }: BaseDialogProps) {
  const [name, setName] = useState("Custom role");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<"blank" | "viewer" | "operator" | "admin">("viewer");
  useEffect(() => { if (open) { setName("Custom role"); setDescription(""); setTemplate("viewer"); } }, [open]);
  const confirm = () => {
    onDone({ message: `Role "${name.trim()}" created from ${template} template (mock)` });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(480px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Create role</DialogTitle>
          <DialogDescription>Start from a template or blank. Edit permissions after creation.</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Role name
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} aria-label="Role name" className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Description
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is this role for?" aria-label="Role description" className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Template
          <Select value={template} onValueChange={(value) => setTemplate(value as typeof template)}>
            <SelectTrigger className="h-9 w-full text-sm" aria-label="Template"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="blank">Blank</SelectItem><SelectItem value="viewer">Viewer (read-only)</SelectItem><SelectItem value="operator">Operator</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
          </Select>
        </label>
        <ConfirmFooter onOpenChange={onOpenChange} confirmLabel="Create role" onConfirm={confirm} disabled={name.trim().length === 0} />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Token secret ------------------------------- */

export function TokenSecretDialog({ open, onOpenChange, token, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; token: string | null; onDone: (result: AccessDialogDone) => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!open) setCopied(false); }, [open]);
  if (!token) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(token); setCopied(true); onDone({ message: "Token copied to clipboard" }); } catch { onDone({ message: "Clipboard unavailable" }); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(500px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-amber-700 dark:text-amber-400">Save this token now</DialogTitle>
          <DialogDescription>This is the only time the secret is shown. It cannot be retrieved later.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 font-mono text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <code className="block break-all leading-6 text-foreground">{token}</code>
        </div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => void copy()} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-semibold text-foreground hover:bg-accent"><Copy size={14} />{copied ? "Copied" : "Copy token"}</button></div>
        <ConfirmFooter onOpenChange={onOpenChange} confirmLabel="Done" onConfirm={() => { onOpenChange(false); onDone({ message: "Token secret saved" }); }} />
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Confirm action dialog ------------------------ */

export function ConfirmActionDialog({ open, onOpenChange, title, description, confirmLabel, danger, onConfirm, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; confirmLabel: string; danger?: boolean; onConfirm: () => AccessDialogDone["message"]; onDone: (result: AccessDialogDone) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(440px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className={danger ? "text-red-700 dark:text-red-400" : "text-foreground"}>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ConfirmFooter onOpenChange={onOpenChange} confirmLabel={confirmLabel} onConfirm={() => { const message = onConfirm(); onDone({ message }); onOpenChange(false); }} danger={danger} />
      </DialogContent>
    </Dialog>
  );
}
