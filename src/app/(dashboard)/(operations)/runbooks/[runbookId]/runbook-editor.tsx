"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown, ArrowUp, BookOpen, CheckCircle2, ChevronDown, ChevronUp, CircleCheck, CircleAlert, Copy, FilePlus2,
  ListPlus, Plus, Rocket, ShieldCheck, Trash2, X,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import {
  RunbookSeverityBadge, RunbookStatusBadge, RUNBOOK_STEP_TYPE_META,
} from "@/components/shared/runbook-badges";
import { formatMinutes } from "@/components/shared/runbook-format";
import { ALERT_RULE_LIST } from "@/mocks/alertRules";
import { BACKUP_PROTECTABLE_HOSTS } from "@/mocks/backups";
import {
  createRunbook, getRunbookById, updateRunbook,
  RUNBOOK_CATEGORIES, RUNBOOK_SEVERITIES, RUNBOOK_STEP_TYPES, type Runbook,
  type RunbookCategory, type RunbookDraftInput, type RunbookSeverity, type RunbookStep, type RunbookStepType,
} from "@/mocks/runbooks";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MAX_TITLE = 90;
const REVIEW_INTERVALS = [30, 60, 90, 180] as const;
const OWNERS = ["Sara Iqbal", "Tom Becker", "Marcus Lee", "Priya Nair", "you@nexus.io"];
const TEAMS = ["Platform", "Infrastructure", "Data", "Network", "Security", "SRE"];

interface StepDraft {
  id: string;
  title: string;
  description: string;
  type: RunbookStepType;
  command: string;
  expectedOutput: string;
  estimatedMinutes: number;
}
const emptyStep = (id: string): StepDraft => ({ id, title: "", description: "", type: "Manual", command: "", expectedOutput: "", estimatedMinutes: 5 });

interface Template {
  title: string;
  summary: string;
  category: RunbookCategory;
  severity: RunbookSeverity;
  tags: string[];
  steps: Array<Omit<StepDraft, "id">>;
  prerequisites: string[];
}
const TEMPLATES: Record<string, Template> = {
  "service-restart": {
    title: "Service restart (graceful)",
    summary: "Gracefully restart a misbehaving service, drain traffic first, and verify health checks recover.",
    category: "Application", severity: "High", tags: ["restart", "service"],
    prerequisites: ["SSH/bastion access to the host", "Write permission on the service unit"],
    steps: [
      { title: "Identify the service", description: "Confirm the exact unit and the hosts running it.", type: "Command", command: "systemctl status <service>", expectedOutput: "service loaded; main pid shown.", estimatedMinutes: 2 },
      { title: "Drain traffic", description: "Remove the instance from the load balancer / service mesh.", type: "Manual", command: "", expectedOutput: "Instance removed from rotation; no in-flight requests remain.", estimatedMinutes: 4 },
      { title: "Restart the service", description: "Restart and watch the journal for clean startup.", type: "Command", command: "systemctl restart <service> && journalctl -u <service> -n 50 --no-pager", expectedOutput: "active (running); no errors in the last 50 lines.", estimatedMinutes: 3 },
      { title: "Re-add to rotation", description: "Return the instance to the load balancer.", type: "Manual", command: "", expectedOutput: "Health checks green; traffic ramping.", estimatedMinutes: 3 },
      { title: "Verify", description: "Error rate and p95 back to baseline.", type: "Check", command: "", expectedOutput: "5xx < 0.1% for 10 minutes.", estimatedMinutes: 5 },
    ],
  },
  "database-failover": {
    title: "Database failover",
    summary: "Promote the replica to primary, re-point applications, and verify replication re-established.",
    category: "Database", severity: "Critical", tags: ["database", "failover", "postgres"],
    prerequisites: ["Bastion access to db-01 and db-02", "Replication docs for the current topology"],
    steps: [
      { title: "Freeze writes", description: "Block app writes or put the app in maintenance mode.", type: "Manual", command: "", expectedOutput: "Error budget safe; write traffic stopped.", estimatedMinutes: 3 },
      { title: "Promote replica", description: "Promote db-02 to primary.", type: "Command", command: "pg_ctl promote -D /var/lib/postgresql/data", expectedOutput: "database system is ready to accept connections.", estimatedMinutes: 5 },
      { title: "Re-point applications", description: "Update the service record / connection string.", type: "Manual", command: "", expectedOutput: "Apps connected to db-02; smoke tests pass.", estimatedMinutes: 10 },
      { title: "Verify and monitor", description: "Replication and error rate normal.", type: "Check", command: "psql -c 'select client_addr, state from pg_stat_replication;'", expectedOutput: "No replication lag; apps healthy.", estimatedMinutes: 10 },
    ],
  },
  "disk-cleanup": {
    title: "Disk cleanup",
    summary: "Reclaim space on a saturated volume: rotate logs, prune caches, and remove stale artefacts.",
    category: "Storage", severity: "Medium", tags: ["disk", "cleanup", "storage"],
    prerequisites: ["sudo access on the target host", "Screenshot of df -h before reclaiming"],
    steps: [
      { title: "Identify consumers", description: "Find the largest directories.", type: "Command", command: "du -xhd1 / | sort -rh | head -12", expectedOutput: "One or two directories > 60% of growth.", estimatedMinutes: 4 },
      { title: "Rotate logs", description: "Rotate and compress logs.", type: "Command", command: "logrotate -f /etc/logrotate.conf", expectedOutput: "logs rotated; df -h shows headroom.", estimatedMinutes: 3 },
      { title: "Prune caches and artefacts", description: "Remove stale docker artefacts and temp files.", type: "Command", command: "docker system prune -af --filter 'until=336h'", expectedOutput: "reclaimed space reported by docker.", estimatedMinutes: 4 },
      { title: "Verify headroom", description: "Volume below 85%.", type: "Check", command: "df -h", expectedOutput: "used <= 85%.", estimatedMinutes: 2 },
    ],
  },
  "certificate-renewal": {
    title: "Certificate renewal",
    summary: "Renew and deploy a TLS certificate before expiry across edge endpoints.",
    category: "Security", severity: "Medium", tags: ["tls", "certificate", "expiry"],
    prerequisites: ["ACME/CA account access", "Edge config update rights"],
    steps: [
      { title: "Confirm expiry", description: "Check expiry on all edge endpoints.", type: "Command", command: "echo | openssl s_client -connect edge-01:443 -servername edge-01 2>/dev/null | openssl x509 -noout -enddate", expectedOutput: "notAfter date > 14 days out after renewal.", estimatedMinutes: 3 },
      { title: "Renew", description: "Trigger ACME renewal.", type: "Command", command: "acme.sh --renew -d <domain> --force", expectedOutput: "certificate renewed.", estimatedMinutes: 8 },
      { title: "Deploy to edges", description: "Push cert to edge-01/edge-02 and reload.", type: "Manual", command: "", expectedOutput: "chain valid; new expiry live.", estimatedMinutes: 5 },
      { title: "Verify", description: "openssl s_client shows new dates; alert cleared.", type: "Check", command: "", expectedOutput: "Verify return code: 0.", estimatedMinutes: 3 },
    ],
  },
  "backup-restore": {
    title: "Backup restore",
    summary: "Restore a service from a verified backup point: pick the point, restore, verify data and restart services.",
    category: "Backup", severity: "High", tags: ["backup", "restore", "recovery"],
    prerequisites: ["Access to Backups & Recovery restore points", "Isolated restore target", "Retention policy of the source job"],
    steps: [
      { title: "Pick restore point", description: "Choose the latest verified point before the incident.", type: "Check", command: "", expectedOutput: "point exists, checksum valid, dated before incident.", estimatedMinutes: 5 },
      { title: "Restore into staging", description: "Restore the point into an isolated target first.", type: "Command", command: "<restore-tool> --point <point-id> --target staging-restore", expectedOutput: "restore completed; inventory matches point metadata.", estimatedMinutes: 30 },
      { title: "Verify data", description: "Row counts / checksums vs expectations.", type: "Check", command: "", expectedOutput: "critical tables match expected counts.", estimatedMinutes: 10 },
      { title: "Cut over", description: "Stop writes, snapshot prod, promote restore.", type: "Warning", command: "", expectedOutput: "Traffic moved; old volume kept immutable for 7 days.", estimatedMinutes: 15 },
      { title: "Post-restore verification", description: "Application healthy; RPO met.", type: "Check", command: "", expectedOutput: "app green; backup job re-enabled.", estimatedMinutes: 10 },
    ],
  },
};

function StepEditor({ step, index, total, onChange, onMove, onDuplicate, onDelete, collapsed, onToggleCollapse, commandError }: {
  step: StepDraft; index: number; total: number;
  onChange: (id: string, patch: Partial<StepDraft>) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: (id: string) => void;
  commandError: string | null;
}) {
  const meta = RUNBOOK_STEP_TYPE_META[step.type];
  const needsCommand = step.type === "Command" || step.type === "Automated";
  return (
    <li className={cn("rounded-xl border p-3", commandError ? "border-[#DC2626]/60" : "border-border bg-card")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-[12px] font-bold tabular-nums text-muted-foreground">{index + 1}</span>
        <select aria-label={`Step ${index + 1} type`} value={step.type} onChange={(event) => onChange(step.id, { type: event.target.value as RunbookStepType })} className="h-9 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {RUNBOOK_STEP_TYPES.map((option) => <option key={option} value={option}>{RUNBOOK_STEP_TYPE_META[option].label}</option>)}
        </select>
        <input value={step.title} onChange={(event) => onChange(step.id, { title: event.target.value })} placeholder="Step title" aria-label={`Step ${index + 1} title`} className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <div className="flex shrink-0 items-center gap-0.5">
          <button type="button" aria-label="Move step up" disabled={index === 0} onClick={() => onMove(step.id, -1)} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowUp size={14} aria-hidden /></button>
          <button type="button" aria-label="Move step down" disabled={index === total - 1} onClick={() => onMove(step.id, 1)} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowDown size={14} aria-hidden /></button>
          <button type="button" aria-label="Duplicate step" onClick={() => onDuplicate(step.id)} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Copy size={14} aria-hidden /></button>
          <button type="button" aria-label="Delete step" onClick={() => onDelete(step.id)} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-[#DC2626] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-red-500/10"><Trash2 size={14} aria-hidden /></button>
          <button type="button" aria-label={collapsed ? "Expand step" : "Collapse step"} aria-expanded={!collapsed} onClick={() => onToggleCollapse(step.id)} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{collapsed ? <ChevronDown size={14} aria-hidden /> : <ChevronUp size={14} aria-hidden />}</button>
        </div>
      </div>
      {!collapsed && (
        <div className="mt-2 space-y-2 pl-9">
          <textarea value={step.description} onChange={(event) => onChange(step.id, { description: event.target.value })} rows={2} placeholder="What the operator does, and why" aria-label={`Step ${index + 1} description`} className="w-full rounded-lg border border-border bg-card p-2 text-xs leading-snug text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          {needsCommand && (
            <div>
              <textarea value={step.command} onChange={(event) => onChange(step.id, { command: event.target.value })} rows={2} placeholder="command --flag value" aria-label={`Step ${index + 1} command`} className={cn("w-full rounded-lg border bg-[#0F172A] p-2 font-mono text-[12px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", commandError ? "border-[#DC2626]" : "border-border")} />
              {commandError && <p role="alert" className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#DC2626]"><CircleAlert size={11} aria-hidden />{commandError}</p>}
            </div>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px]">
            <input value={step.expectedOutput} onChange={(event) => onChange(step.id, { expectedOutput: event.target.value })} placeholder="Expected output (optional)" aria-label={`Step ${index + 1} expected output`} className="h-9 rounded-lg border border-border bg-card px-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <label className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-2 text-xs text-muted-foreground">Est.
              <input type="number" min={1} max={240} value={step.estimatedMinutes} onChange={(event) => onChange(step.id, { estimatedMinutes: Math.max(1, Number(event.target.value) || 1) })} aria-label={`Step ${index + 1} estimated minutes`} className="h-7 w-14 rounded border border-border bg-card px-1.5 text-right text-xs tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />min
            </label>
          </div>
        </div>
      )}
    </li>
  );
}

export function RunbookEditor({ mode, runbookId, prefilledRuleId, prefilledTemplate, initialTitle }: {
  mode: "new" | "edit";
  runbookId?: string;
  prefilledRuleId?: string;
  prefilledTemplate?: string;
  initialTitle?: string;
}) {
  const router = useRouter();
  const existing = mode === "edit" && runbookId ? getRunbookById(runbookId) ?? null : null;
  const template = mode === "new" && prefilledTemplate ? TEMPLATES[prefilledTemplate] : undefined;
  const idRef = useRef(1);
  const nextId = () => `step-${Date.now()}-${idRef.current++}`;

  const [title, setTitle] = useState(existing?.title ?? template?.title ?? initialTitle ?? "");
  const [summary, setSummary] = useState(existing?.summary ?? template?.summary ?? "");
  const [category, setCategory] = useState<RunbookCategory>(existing?.category ?? template?.category ?? "Application");
  const [severity, setSeverity] = useState<RunbookSeverity>(existing?.severity ?? template?.severity ?? "Medium");
  const [tagsInput, setTagsInput] = useState(existing?.tags.join(", ") ?? template?.tags.join(", ") ?? "");
  const [owner, setOwner] = useState(existing?.owner ?? "Sara Iqbal");
  const [team, setTeam] = useState(existing?.team ?? "Platform");
  const [reviewIntervalDays, setReviewIntervalDays] = useState<number>(existing?.reviewIntervalDays ?? 90);
  const [linkedRuleIds, setLinkedRuleIds] = useState<string[]>(() => existing?.linkedAlertRuleIds ?? (prefilledRuleId ? [prefilledRuleId] : template ? [] : []));
  const [services, setServices] = useState<string[]>(existing?.services ?? []);
  const [prerequisites, setPrerequisites] = useState<string[]>(existing?.prerequisites ?? template?.prerequisites ?? [""]);
  const [steps, setSteps] = useState<StepDraft[]>(() => existing
    ? existing.steps.map((step) => ({ id: step.id, title: step.title, description: step.description, type: step.type, command: step.command ?? "", expectedOutput: step.expectedOutput ?? "", estimatedMinutes: step.estimatedMinutes }))
    : template
      ? template.steps.map((step) => ({ id: nextId(), ...step }))
      : [emptyStep(nextId())]);
  const [rollbackSteps, setRollbackSteps] = useState<StepDraft[]>(() => existing
    ? existing.rollback.map((step) => ({ id: step.id, title: step.title, description: step.description, type: step.type, command: step.command ?? "", expectedOutput: step.expectedOutput ?? "", estimatedMinutes: step.estimatedMinutes }))
    : []);
  const [verificationSteps, setVerificationSteps] = useState<StepDraft[]>(() => existing
    ? existing.verification.map((step) => ({ id: step.id, title: step.title, description: step.description, type: step.type, command: step.command ?? "", expectedOutput: step.expectedOutput ?? "", estimatedMinutes: step.estimatedMinutes }))
    : [{ id: nextId(), title: "Verify recovery", description: "Confirm service health back to baseline.", type: "Check", command: "", expectedOutput: "Error rate and latency back to baseline.", estimatedMinutes: 5 }]);
  const [ruleSearch, setRuleSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [titleError, setTitleError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [commandErrors, setCommandErrors] = useState<Record<string, string>>({});
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const [publishDialog, setPublishDialog] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const initialSnapshot = useRef<string>("");

  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);
  const showToast = (message: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message });
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  };

  const snapshot = useMemo(() => JSON.stringify({ title, summary, category, severity, tagsInput, owner, team, reviewIntervalDays, linkedRuleIds, services, prerequisites, steps, rollbackSteps, verificationSteps }), [title, summary, category, severity, tagsInput, owner, team, reviewIntervalDays, linkedRuleIds, services, prerequisites, steps, rollbackSteps, verificationSteps]);
  useEffect(() => { if (!initialSnapshot.current) initialSnapshot.current = snapshot; }, [snapshot]);
  const dirty = initialSnapshot.current !== "" && initialSnapshot.current !== snapshot;

  /* Derived checklist */
  const commandStepsMissing = useMemo(() => [...steps, ...rollbackSteps, ...verificationSteps].filter((step) => (step.type === "Command" || step.type === "Automated") && !step.command.trim()).length, [steps, rollbackSteps, verificationSteps]);
  const hasWarning = useMemo(() => [...steps, ...rollbackSteps].some((step) => step.type === "Warning"), [steps, rollbackSteps]);
  const checklist = [
    { label: "Title set", ok: title.trim().length > 0 },
    { label: "Summary set", ok: summary.trim().length > 0 },
    { label: "At least one step", ok: steps.length > 0 && steps.some((step) => step.title.trim().length > 0) },
    { label: "Command steps have commands", ok: commandStepsMissing === 0 },
    { label: "Owner assigned", ok: owner.trim().length > 0 },
    { label: severity === "Critical" ? "Critical: linked rule or warning step" : "Severity requirements met", ok: severity !== "Critical" || linkedRuleIds.length > 0 || hasWarning },
  ];
  const checklistDone = checklist.filter((item) => item.ok).length;
  const publishVersion = (existing?.version ?? 0) + 1;
  const totalMinutes = [...steps, ...rollbackSteps, ...verificationSteps].reduce((sum, step) => sum + step.estimatedMinutes, 0);

  const filteredRules = useMemo(() => {
    const needle = ruleSearch.trim().toLowerCase();
    return ALERT_RULE_LIST.filter((rule) => !needle || rule.id.toLowerCase().includes(needle) || rule.name.toLowerCase().includes(needle)).slice(0, 40);
  }, [ruleSearch]);
  const filteredHosts = useMemo(() => {
    const needle = serviceSearch.trim().toLowerCase();
    return BACKUP_PROTECTABLE_HOSTS.filter((host) => !needle || host.includes(needle));
  }, [serviceSearch]);

  const updateStep = (list: "steps" | "rollbackSteps" | "verificationSteps") => (id: string, patch: Partial<StepDraft>) => {
    const setter = list === "steps" ? setSteps : list === "rollbackSteps" ? setRollbackSteps : setVerificationSteps;
    setter((current) => current.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  };
  const moveStep = (list: "steps" | "rollbackSteps" | "verificationSteps") => (id: string, direction: -1 | 1) => {
    const setter = list === "steps" ? setSteps : list === "rollbackSteps" ? setRollbackSteps : setVerificationSteps;
    setter((current) => {
      const index = current.findIndex((step) => step.id === id);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const duplicateStep = (list: "steps" | "rollbackSteps" | "verificationSteps") => (id: string) => {
    const setter = list === "steps" ? setSteps : list === "rollbackSteps" ? setRollbackSteps : setVerificationSteps;
    setter((current) => {
      const index = current.findIndex((step) => step.id === id);
      if (index === -1) return current;
      const copy = { ...current[index], id: nextId(), title: `${current[index].title} (copy)` };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
  };
  const deleteStep = (list: "steps" | "rollbackSteps" | "verificationSteps") => (id: string) => {
    const setter = list === "steps" ? setSteps : list === "rollbackSteps" ? setRollbackSteps : setVerificationSteps;
    setter((current) => current.filter((step) => step.id !== id));
  };
  const addStep = (list: "steps" | "rollbackSteps" | "verificationSteps") => () => {
    const setter = list === "steps" ? setSteps : list === "rollbackSteps" ? setRollbackSteps : setVerificationSteps;
    setter((current) => [...current, emptyStep(nextId())]);
  };

  const validate = (): boolean => {
    const tErr = title.trim() ? null : "Title is required.";
    const missing = [...steps, ...rollbackSteps, ...verificationSteps].filter((step) => (step.type === "Command" || step.type === "Automated") && !step.command.trim());
    const cmdErrs: Record<string, string> = {};
    for (const step of missing) cmdErrs[step.id] = "Command is required for Command/Automated steps.";
    const stepErr = steps.some((step) => step.title.trim()) ? null : "Add at least one step with a title.";
    const critErr = severity === "Critical" && linkedRuleIds.length === 0 && !hasWarning ? "Critical runbooks need at least one linked alert rule or a warning step." : null;
    setTitleError(tErr);
    setCommandErrors(cmdErrs);
    setStepError(stepErr);
    setCriticalError(critErr);
    return !tErr && missing.length === 0 && !stepErr && !critErr;
  };

  const buildInput = (status: "Published" | "Draft"): RunbookDraftInput => ({
    title: title.trim(),
    summary: summary.trim(),
    category,
    severity,
    tags: tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean),
    owner,
    team,
    reviewIntervalDays,
    linkedAlertRuleIds: linkedRuleIds,
    services,
    prerequisites: prerequisites.map((item) => item.trim()).filter(Boolean),
    steps: steps.map((step) => ({ id: step.id, title: step.title.trim(), description: step.description.trim(), type: step.type, command: step.command.trim() || undefined, expectedOutput: step.expectedOutput.trim() || undefined, estimatedMinutes: step.estimatedMinutes })),
    rollback: rollbackSteps.map((step) => ({ id: step.id, title: step.title.trim(), description: step.description.trim(), type: step.type, command: step.command.trim() || undefined, expectedOutput: step.expectedOutput.trim() || undefined, estimatedMinutes: step.estimatedMinutes })),
    verification: verificationSteps.map((step) => ({ id: step.id, title: step.title.trim(), description: step.description.trim(), type: step.type, command: step.command.trim() || undefined, expectedOutput: step.expectedOutput.trim() || undefined, estimatedMinutes: step.estimatedMinutes })),
    status,
  });

  const persist = (status: "Published" | "Draft") => {
    const input = buildInput(status);
    if (mode === "new") {
      const created = createRunbook(input);
      showToast(status === "Draft" ? `Saved ${created.id} as draft.` : `Published ${created.id}.`);
      router.push(`/runbooks/${created.id}`);
      return;
    }
    if (existing) {
      const result = updateRunbook(existing.id, input);
      showToast(status === "Draft" ? `Saved ${existing.id} as draft.` : `Published v${result?.version ?? existing.version + 1} of ${existing.id}.`);
      router.push(`/runbooks/${existing.id}`);
    }
  };

  const onPublishClick = () => {
    if (!validate()) {
      showToast("Fix the highlighted fields before publishing.");
      return;
    }
    setPublishDialog(true);
  };
  const onSaveDraft = () => {
    setTitleError(title.trim() ? null : "Title is required.");
    if (!title.trim()) { showToast("Title is required."); return; }
    persist(mode === "edit" && existing?.status === "Published" ? "Published" : "Draft");
  };
  const confirmPublish = () => {
    setPublishDialog(false);
    persist("Published");
  };
  const onCancelClick = () => {
    if (dirty) setCancelDialog(true);
    else router.push(existing ? `/runbooks/${existing.id}` : "/runbooks");
  };

  if (mode === "edit" && !existing) {
    return (
      <div className="mx-auto grid min-h-[320px] max-w-xl place-items-center rounded-xl border border-border bg-card p-8 text-center">
        <div>
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-3 font-display text-base font-bold text-foreground">Runbook not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">No runbook with id <span className="font-mono">{runbookId}</span> exists, so there is nothing to edit.</p>
          <Button variant="outline" className="mt-4 h-10 rounded-lg px-4 text-sm" onClick={() => router.push("/runbooks")}>Back to Runbooks</Button>
        </div>
      </div>
    );
  }

  const renderStepSection = (titleText: string, list: StepDraft[], listKey: "steps" | "rollbackSteps" | "verificationSteps", emptyLabel: string) => (
    <section aria-label={titleText} className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground">{titleText} <span className="ml-1 text-xs font-semibold tabular-nums text-muted-foreground">{list.length}</span></h2>
        <Button variant="outline" className="h-8 gap-1 rounded-lg px-2.5 text-xs" onClick={addStep(listKey)}><Plus size={13} aria-hidden />{listKey === "steps" ? "Add step" : "Add"}</Button>
      </div>
      {list.length === 0 && <p className="mt-1 text-xs text-muted-foreground">{emptyLabel}</p>}
      <ol className="mt-2 space-y-2">
        {list.map((step, index) => (
          <StepEditor key={step.id} step={step} index={index} total={list.length} onChange={updateStep(listKey)} onMove={moveStep(listKey)} onDuplicate={duplicateStep(listKey)} onDelete={deleteStep(listKey)} collapsed={Boolean(collapsed[step.id])} onToggleCollapse={(id) => setCollapsed((current) => ({ ...current, [id]: !current[id] }))} commandError={commandErrors[step.id] ?? null} />
        ))}
      </ol>
      {listKey === "steps" && stepError && <p role="alert" className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#DC2626]"><CircleAlert size={11} aria-hidden />{stepError}</p>}
    </section>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={["Operations", "Runbooks", mode === "new" ? "New runbook" : (existing?.title ?? "Edit runbook")]}
        title={mode === "new" ? "New Runbook" : `Edit: ${existing?.title ?? runbookId}`}
        subtitle={mode === "new" ? "Document a remediation procedure and link it to the alerts it remediates." : `Editing ${existing?.id ?? runbookId} — publish to ship a new version.`}
        icon={<BookOpen size={20} aria-hidden />}
        actions={
          <div className="flex h-10 shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" className="h-10 rounded-lg px-4 text-sm" onClick={onCancelClick}>Cancel</Button>
            <Button variant="outline" className="h-10 gap-1.5 rounded-lg px-4 text-sm" onClick={onSaveDraft}><FilePlus2 size={15} aria-hidden />Save draft</Button>
            <Button className="h-10 gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90" onClick={onPublishClick}><Rocket size={15} aria-hidden />Publish{mode === "edit" ? ` v${publishVersion}` : ""}</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        {/* LEFT — numbered cards */}
        <div className="min-w-0 space-y-4 xl:col-span-8">
          {/* 1. Basics */}
          <section aria-label="1. Basics" className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold text-foreground"><span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded bg-muted align-middle text-[11px] tabular-nums">1</span>Basics</h2>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="rb-title" className="text-xs font-semibold text-muted-foreground">Title <span aria-hidden="true" className="text-[#DC2626]">*</span></label>
                <input id="rb-title" value={title} maxLength={MAX_TITLE} onChange={(event) => setTitle(event.target.value)} aria-invalid={titleError ? true : undefined} aria-describedby={titleError ? "rb-title-error" : undefined} className={cn("mt-1 h-10 w-full rounded-lg border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", titleError ? "border-[#DC2626]" : "border-border")} placeholder="e.g. Database connection lost" />
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  {titleError ? <p id="rb-title-error" role="alert" className="text-[11px] font-semibold text-[#DC2626]">{titleError}</p> : <span />}
                  <span className="text-[11px] tabular-nums text-muted-foreground">{title.length}/{MAX_TITLE}</span>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="rb-summary" className="text-xs font-semibold text-muted-foreground">Summary</label>
                <textarea id="rb-summary" value={summary} onChange={(event) => setSummary(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-xs leading-snug text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="One or two sentences: when to use this runbook and what it achieves." />
              </div>
              <div>
                <label htmlFor="rb-category" className="text-xs font-semibold text-muted-foreground">Category</label>
                <select id="rb-category" value={category} onChange={(event) => setCategory(event.target.value as RunbookCategory)} className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{RUNBOOK_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              </div>
              <div>
                <label htmlFor="rb-severity" className="text-xs font-semibold text-muted-foreground">Severity</label>
                <select id="rb-severity" value={severity} onChange={(event) => setSeverity(event.target.value as RunbookSeverity)} className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{RUNBOOK_SEVERITIES.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              </div>
              <div>
                <label htmlFor="rb-owner" className="text-xs font-semibold text-muted-foreground">Owner</label>
                <select id="rb-owner" value={owner} onChange={(event) => setOwner(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{OWNERS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              </div>
              <div>
                <label htmlFor="rb-team" className="text-xs font-semibold text-muted-foreground">Team</label>
                <select id="rb-team" value={team} onChange={(event) => setTeam(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{TEAMS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              </div>
              <div>
                <label htmlFor="rb-interval" className="text-xs font-semibold text-muted-foreground">Review interval</label>
                <select id="rb-interval" value={reviewIntervalDays} onChange={(event) => setReviewIntervalDays(Number(event.target.value))} className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{REVIEW_INTERVALS.map((days) => <option key={days} value={days}>Every {days} days</option>)}</select>
              </div>
              <div>
                <label htmlFor="rb-tags" className="text-xs font-semibold text-muted-foreground">Tags</label>
                <input id="rb-tags" value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder="comma, separated, tags" className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
            </div>
          </section>

          {/* 2. Link */}
          <section aria-label="2. Link" className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold text-foreground"><span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded bg-muted align-middle text-[11px] tabular-nums">2</span>Link</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{linkedRuleIds.length} alert rule{linkedRuleIds.length === 1 ? "" : "s"} linked · {services.length} service{services.length === 1 ? "" : "s"}</p>
            <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {/* Alert rules multi-select */}
              <div className="min-w-0">
                <label htmlFor="rb-rule-search" className="text-xs font-semibold text-muted-foreground">Alert rules</label>
                <input id="rb-rule-search" value={ruleSearch} onChange={(event) => setRuleSearch(event.target.value)} placeholder="Search rules by id or name..." className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                <div role="listbox" aria-label="Alert rules" aria-multiselectable="true" className="mt-1 max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1.5">
                  {filteredRules.map((rule) => {
                    const checked = linkedRuleIds.includes(rule.id);
                    return (
                      <label key={rule.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-xs transition-colors hover:bg-accent">
                        <input type="checkbox" checked={checked} onChange={() => setLinkedRuleIds((current) => (checked ? current.filter((id) => id !== rule.id) : [...current, rule.id]))} className="h-4 w-4 shrink-0 accent-[#2563EB]" />
                        <span className="w-16 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">{rule.id}</span>
                        <span className="min-w-0 truncate text-foreground/90" title={rule.name}>{rule.name}</span>
                      </label>
                    );
                  })}
                  {filteredRules.length === 0 && <p className="px-1.5 py-2 text-[11px] text-muted-foreground">No rules match “{ruleSearch}”.</p>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">{linkedRuleIds.map((ruleId) => <button key={ruleId} type="button" onClick={() => setLinkedRuleIds((current) => current.filter((id) => id !== ruleId))} aria-label={`Unlink ${ruleId}`} className="inline-flex h-6 items-center gap-1 rounded bg-primary/10 px-1.5 text-[11px] font-semibold tabular-nums text-primary hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{ruleId}<X size={10} aria-hidden /></button>)}</div>
              </div>
              {/* Services multi-select */}
              <div className="min-w-0">
                <label htmlFor="rb-service-search" className="text-xs font-semibold text-muted-foreground">Services / servers</label>
                <input id="rb-service-search" value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} placeholder="Filter hosts..." className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                <div role="listbox" aria-label="Services" aria-multiselectable="true" className="mt-1 max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1.5">
                  {filteredHosts.map((host) => {
                    const checked = services.includes(host);
                    return (
                      <label key={host} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 font-mono text-[11px] transition-colors hover:bg-accent">
                        <input type="checkbox" checked={checked} onChange={() => setServices((current) => (checked ? current.filter((name) => name !== host) : [...current, host]))} className="h-4 w-4 shrink-0 accent-[#2563EB]" />
                        <span className="min-w-0 truncate text-foreground/90">{host}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">{services.map((service) => <button key={service} type="button" onClick={() => setServices((current) => current.filter((name) => name !== service))} aria-label={`Remove ${service}`} className="inline-flex h-6 items-center gap-1 rounded bg-muted px-1.5 font-mono text-[11px] text-foreground/80 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{service}<X size={10} aria-hidden /></button>)}</div>
              </div>
            </div>
            {criticalError && <p role="alert" className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#DC2626]"><CircleAlert size={11} aria-hidden />{criticalError}</p>}
          </section>

          {/* 3. Prerequisites */}
          <section aria-label="3. Prerequisites" className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-foreground"><span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded bg-muted align-middle text-[11px] tabular-nums">3</span>Prerequisites</h2>
              <Button variant="outline" className="h-8 gap-1 rounded-lg px-2.5 text-xs" onClick={() => setPrerequisites((current) => [...current, ""])}><ListPlus size={13} aria-hidden />Add</Button>
            </div>
            <ul className="mt-2 space-y-1.5">
              {prerequisites.map((item, index) => (
                <li key={index} className="flex items-center gap-2">
                  <CircleCheck size={14} aria-hidden className="shrink-0 text-muted-foreground" />
                  <input value={item} onChange={(event) => setPrerequisites((current) => current.map((entry, entryIndex) => (entryIndex === index ? event.target.value : entry)))} placeholder={`Prerequisite ${index + 1}, e.g. SSH access to the host`} aria-label={`Prerequisite ${index + 1}`} className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <button type="button" aria-label={`Remove prerequisite ${index + 1}`} onClick={() => setPrerequisites((current) => (current.length > 1 ? current.filter((_, entryIndex) => entryIndex !== index) : [""]))} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-[#DC2626] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-red-500/10"><Trash2 size={14} aria-hidden /></button>
                </li>
              ))}
            </ul>
          </section>

          {/* 4. Steps */}
          {renderStepSection("4. Steps", steps, "steps", "No steps yet — add the first step of the procedure.")}

          {/* 5. Rollback & Verification */}
          {renderStepSection("5. Rollback", rollbackSteps, "rollbackSteps", "No rollback steps — what to undo if the fix backfires.")}
          {renderStepSection("6. Verification", verificationSteps, "verificationSteps", "No verification steps — how to confirm the fix worked.")}
        </div>

        {/* RIGHT — sticky: live preview + checklist + templates */}
        <div className="min-w-0 space-y-4 xl:col-span-4 xl:sticky xl:top-4">
          {/* Live preview */}
          <section aria-label="Live preview" className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-foreground">Live preview</h2>
              <span className="inline-flex h-6 items-center rounded border border-border px-2 text-[11px] font-semibold text-muted-foreground">{mode === "edit" ? `v${existing?.version ?? 1} → v${publishVersion}` : "v1 preview"}</span>
            </div>
            <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <RunbookStatusBadge status={mode === "edit" && existing?.status === "Published" ? "Published" : "Draft"} />
                <RunbookSeverityBadge severity={severity} />
                <span className="inline-flex h-6 items-center rounded border border-border px-2 text-[11px] font-semibold text-muted-foreground">{category}</span>
              </div>
              <h3 className="mt-1.5 text-sm font-extrabold leading-snug text-foreground">{title.trim() || "Untitled runbook"}</h3>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{summary.trim() || "No summary yet."}</p>
              <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">{steps.length} steps · {rollbackSteps.length} rollback · {verificationSteps.length} verification · ~{formatMinutes(totalMinutes)}</p>
              <ol className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">{steps.slice(0, 3).map((step, index) => <li key={step.id} className="truncate">{index + 1}. {step.title || "Untitled step"}</li>)}</ol>
            </div>
          </section>

          {/* Checklist */}
          <section aria-label="Publish checklist" className="rounded-xl border border-border bg-card p-4">
            <h2 className="flex items-center justify-between gap-2 text-sm font-bold text-foreground">Checklist<span className="text-xs font-semibold tabular-nums text-muted-foreground">{checklistDone} of {checklist.length} done</span></h2>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={checklistDone} aria-valuemin={0} aria-valuemax={checklist.length} aria-label="Publish checklist progress"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(checklistDone / checklist.length) * 100}%` }} /></div>
            <ul className="mt-2 space-y-1.5 text-xs">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-1.5">
                  {item.ok ? <CheckCircle2 size={13} aria-hidden className="shrink-0 text-emerald-600 dark:text-emerald-400" /> : <CircleAlert size={13} aria-hidden className="shrink-0 text-amber-600 dark:text-amber-400" />}
                  <span className={item.ok ? "text-foreground/90" : "text-muted-foreground"}>{item.label}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Templates */}
          {mode === "new" && (
            <section aria-label="Templates" className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-bold text-foreground">Templates</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Start from a proven skeleton; edit every field.</p>
              <ul className="mt-2 space-y-1.5">
                {Object.entries(TEMPLATES).map(([key, tpl]) => (
                  <li key={key}>
                    <button type="button" onClick={() => { setTitle(tpl.title); setSummary(tpl.summary); setCategory(tpl.category); setSeverity(tpl.severity); setTagsInput(tpl.tags.join(", ")); setPrerequisites([...tpl.prerequisites]); setSteps(tpl.steps.map((step) => ({ id: nextId(), ...step }))); setVerificationSteps([{ id: nextId(), title: "Verify recovery", description: "Confirm service health back to baseline.", type: "Check", command: "", expectedOutput: "Error rate and latency back to baseline.", estimatedMinutes: 5 }]); showToast(`Applied template “${tpl.title}”.`); }} className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{tpl.title}<ArrowUp size={12} aria-hidden className="rotate-90 text-muted-foreground" /></button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-[11px] text-muted-foreground"><ShieldCheck size={12} aria-hidden />Templates never auto-link alert rules — link them in step 2.</div>
            </section>
          )}

          {/* Meta */}
          <section aria-label="Document meta" className="rounded-xl border border-border bg-card p-4 text-[11px] text-muted-foreground">
            <p className="flex items-center gap-1.5"><InitialsAvatar name={owner} size={16} />Owner {owner} · {team} team</p>
            <p className="mt-1">Estimated {formatMinutes(totalMinutes)} · reviewed every {reviewIntervalDays} days{existing ? ` · last reviewed ${new Date(existing.lastReviewedAt).toLocaleDateString()}` : ""}</p>
          </section>
        </div>
      </div>

      {/* Publish confirm */}
      <Dialog open={publishDialog} onOpenChange={setPublishDialog}>
        <DialogContent className="w-[min(420px,calc(100vw-2rem))] rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Publish v{publishVersion}?</DialogTitle>
            <DialogDescription className="text-[12px]">“{title.trim() || "Untitled runbook"}” will become visible to every linked alert and appear as the remediation for {linkedRuleIds.length} rule{linkedRuleIds.length === 1 ? "" : "s"}.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-9 rounded-lg px-4 text-[13px]" onClick={() => setPublishDialog(false)}>Keep editing</Button>
            <Button className="h-9 gap-1.5 rounded-lg px-4 text-[13px] font-semibold" onClick={confirmPublish}><Rocket size={13} aria-hidden />Publish v{publishVersion}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard confirm */}
      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent className="w-[min(420px,calc(100vw-2rem))] rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Discard unsaved changes?</DialogTitle>
            <DialogDescription className="text-[12px]">Your edits to {existing?.id ?? "this new runbook"} will be lost. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-9 rounded-lg px-4 text-[13px]" onClick={() => setCancelDialog(false)}>Keep editing</Button>
            <Button className="h-9 gap-1.5 rounded-lg bg-[#DC2626] px-4 text-[13px] font-semibold text-white hover:bg-[#B91C1C]" onClick={() => { setCancelDialog(false); router.push(existing ? `/runbooks/${existing.id}` : "/runbooks"); }}><X size={13} aria-hidden />Discard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[1200] rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">{toast.message}</div>}
    </div>
  );
}
