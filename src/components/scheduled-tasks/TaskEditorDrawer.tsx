"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle, Check, ChevronLeft, ChevronRight, Info, ShieldAlert, TriangleAlert, X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MultiSelect } from "@/components/alert-rules/multi-select";
import { ToggleSwitch } from "@/components/alert-rules/toggle-switch";
import { SegmentedControl } from "@/components/logs/primitives";
import { ScheduleBuilder } from "@/components/scheduled-tasks/ScheduleBuilder";
import { BUILTIN_ACTIONS, TASK_OWNERS, TASK_TYPE_LABELS, type ScheduledTask, type TaskType } from "@/mocks/scheduledTasks";
import { SCOPE_GROUPS, SCOPE_SERVERS, overlappingWindows, scopeHosts } from "@/mocks/maintenanceWindows";
import { nextRunAfter } from "@/utils/nextRun";
import { validateCron } from "@/utils/formatSchedule";
import type { CreateTaskInput } from "@/hooks/useScheduledTasks";
import { cn } from "@/lib/utils";

interface TaskEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Existing task when editing; null when creating. */
  task: ScheduledTask | null;
  allTasks: ScheduledTask[];
  /** mode "save" = create paused / keep state; "saveAndEnable" = create enabled. */
  onSubmit: (input: CreateTaskInput, mode: "save" | "saveAndEnable") => void;
}

const STEP_LABELS = ["Basics", "Schedule", "Target", "Execution", "Notifications"] as const;
const TYPE_ORDER: TaskType[] = ["backup", "patch", "report", "cleanup", "security", "cache", "monitoring", "custom"];
const HOST_OPTIONS = SCOPE_SERVERS.map((host) => ({ value: host, label: host }));
const GROUP_OPTIONS = SCOPE_GROUPS.map((group) => ({ value: group.id, label: group.name }));
const CHANNEL_OPTIONS = ["Email", "Slack", "PagerDuty"] as const;
const TIMEOUT_OPTIONS = [5, 10, 15, 30, 45, 60, 90, 120, 180] as const;
const RETRY_OPTIONS = [0, 1, 2, 3, 5] as const;

function defaultDraft(): CreateTaskInput {
  return {
    name: "",
    description: "",
    type: "backup",
    tags: [],
    owner: TASK_OWNERS[0],
    enabled: true,
    schedule: { kind: "daily", hour: 2, minute: 0, timeZone: "Asia/Karachi" },
    target: { hosts: [], groups: [], environment: "production" },
    execution: { mode: "builtin", builtin: "run-backup", command: "", retries: 1, timeoutMinutes: 30, concurrency: "skip" },
    notifications: { onFailure: true, onSuccess: false, channels: ["Email"], recipients: ["ops@nexus.io"] },
  };
}

function draftFromTask(task: ScheduledTask): CreateTaskInput {
  return {
    name: task.name,
    description: task.description,
    type: task.type,
    tags: [...task.tags],
    owner: task.owner,
    enabled: task.enabled,
    schedule: { ...task.schedule, daysOfWeek: task.schedule.daysOfWeek ? [...task.schedule.daysOfWeek] : undefined },
    target: { hosts: [...task.target.hosts], groups: [...task.target.groups], environment: task.target.environment },
    execution: { ...task.execution },
    notifications: { ...task.notifications, channels: [...task.notifications.channels], recipients: [...task.notifications.recipients] },
  };
}

const HEAVY_TYPES: TaskType[] = ["backup", "patch"];

/** 5-step create/edit drawer with cron validation, next-run preview, maintenance-window and heavy-task overlap warnings. */
export function TaskEditorDrawer({ open, onClose, task, allTasks, onSubmit }: TaskEditorDrawerProps) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CreateTaskInput>(() => (task ? draftFromTask(task) : defaultDraft()));
  const [tagInput, setTagInput] = useState("");
  const [recipientInput, setRecipientInput] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const initialRef = useRef("");
  const nameRef = useRef<HTMLInputElement | null>(null);

  const isEdit = task != null;

  useEffect(() => {
    if (!open) return;
    const next = task ? draftFromTask(task) : defaultDraft();
    setDraft(next);
    setStep(0);
    setTagInput("");
    setRecipientInput("");
    setNameError(null);
    setDiscardOpen(false);
    initialRef.current = JSON.stringify(next);
    const timer = window.setTimeout(() => nameRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open, task]);

  const dirty = open && JSON.stringify(draft) !== initialRef.current;

  const requestClose = () => {
    if (dirty) setDiscardOpen(true);
    else onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty]);

  const patch = (partial: Partial<CreateTaskInput>) => setDraft((current) => ({ ...current, ...partial }));
  const patchSchedule = (schedule: CreateTaskInput["schedule"]) => patch({ schedule });
  const patchTarget = (partial: Partial<CreateTaskInput["target"]>) => setDraft((current) => ({ ...current, target: { ...current.target, ...partial } }));
  const patchExecution = (partial: Partial<CreateTaskInput["execution"]>) => setDraft((current) => ({ ...current, execution: { ...current.execution, ...partial } }));
  const patchNotifications = (partial: Partial<CreateTaskInput["notifications"]>) => setDraft((current) => ({ ...current, notifications: { ...current.notifications, ...partial } }));

  const scheduleError = useMemo(() => {
    if (draft.schedule.kind === "cron") return validateCron(draft.schedule.cron ?? "");
    if (draft.schedule.kind === "weekly" && (draft.schedule.daysOfWeek ?? []).length === 0) return "Select at least one weekday.";
    return null;
  }, [draft.schedule]);

  /* Conflict check: maintenance window or another heavy task overlapping the next run. */
  const conflicts = useMemo(() => {
    const next = nextRunAfter(draft.schedule, Date.now());
    if (next == null || scheduleError) return { windows: [] as Array<{ id: string; title: string; start: string; end: string }>, tasks: [] as Array<{ id: string; name: string; atMs: number }> };
    const windowEnd = next + Math.max(draft.execution.timeoutMinutes, 30) * 60_000;
    const windows = overlappingWindows({ servers: draft.target.hosts, groups: draft.target.groups }, next, windowEnd)
      .slice(0, 3)
      .map((window) => ({ id: window.id, title: window.title, start: window.start, end: window.end }));
    const resolvedHosts = new Set(scopeHosts({ servers: draft.target.hosts, groups: draft.target.groups }));
    const heavy: Array<{ id: string; name: string; atMs: number }> = [];
    if (resolvedHosts.size > 0 && HEAVY_TYPES.includes(draft.type) && draft.execution.timeoutMinutes >= 20) {
      for (const other of allTasks) {
        if (other.id === task?.id) continue;
        if (!other.enabled || !HEAVY_TYPES.includes(other.type)) continue;
        const otherNext = nextRunAfter(other.schedule, Date.now());
        if (otherNext == null || Math.abs(otherNext - next) > 30 * 60_000) continue;
        const otherHosts = new Set(scopeHosts({ servers: other.target.hosts, groups: other.target.groups }));
        if ([...otherHosts].some((host) => resolvedHosts.has(host))) heavy.push({ id: other.id, name: other.name, atMs: otherNext });
        if (heavy.length >= 3) break;
      }
    }
    return { windows, tasks: heavy };
  }, [draft.schedule, draft.target, draft.type, draft.execution.timeoutMinutes, scheduleError, allTasks, task?.id]);

  const resolvedHosts = useMemo(() => scopeHosts({ servers: draft.target.hosts, groups: draft.target.groups }), [draft.target.hosts, draft.target.groups]);

  const canAdvance = (index: number) => {
    if (index === 0 && draft.name.trim().length === 0) { setNameError("Name is required."); return false; }
    if (index === 1 && scheduleError) return false;
    return true;
  };
  const goToStep = (index: number) => {
    if (index > 0 && draft.name.trim().length === 0) { setNameError("Name is required."); return; }
    if (index > 1 && scheduleError) return;
    setStep(index);
  };
  const goNext = () => { if (canAdvance(step) && step < 4) setStep(step + 1); };
  const goBack = () => setStep((current) => Math.max(0, current - 1));

  const submit = (mode: "save" | "saveAndEnable") => {
    if (draft.name.trim().length === 0) {
      setStep(0);
      setNameError("Name is required.");
      return;
    }
    if (scheduleError) {
      setStep(1);
      return;
    }
    const recipients = recipientInput.trim()
      ? [...new Set([...draft.notifications.recipients, ...recipientInput.split(",").map((value) => value.trim()).filter(Boolean)])]
      : draft.notifications.recipients;
    onSubmit({
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
      enabled: isEdit ? draft.enabled : mode === "saveAndEnable",
      notifications: { ...draft.notifications, recipients },
    }, mode);
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag || draft.tags.includes(tag)) { setTagInput(""); return; }
    patch({ tags: [...draft.tags, tag] });
    setTagInput("");
  };

  const toggleChannel = (channel: string) => {
    const channels = draft.notifications.channels.includes(channel)
      ? draft.notifications.channels.filter((item) => item !== channel)
      : [...draft.notifications.channels, channel];
    patchNotifications({ channels });
  };

  if (!open) return null;

  const fieldLabel = "mb-1 block text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground";
  const textArea = "w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-[0.8125rem] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return createPortal(
    <>
      <div aria-hidden="true" className="fixed inset-0 z-[1290] bg-slate-950/40" onClick={requestClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-editor-title"
        className="animate-drawer-in fixed inset-y-0 right-0 z-[1300] flex w-full flex-col border-l border-border bg-card shadow-2xl sm:max-w-[40rem]"
      >
        <div className="shrink-0 border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="task-editor-title" className="font-display text-base font-bold tracking-tight text-foreground">
                {isEdit ? "Edit Scheduled Task" : "Create Scheduled Task"}
              </h2>
              <p className="mt-0.5 text-[0.75rem] text-muted-foreground">{isEdit ? `Editing ${task?.id}` : "Backups, patching, reports and recurring jobs."}</p>
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close editor"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={16} aria-hidden />
            </button>
          </div>

          {/* Stepper */}
          <ol className="mt-3 flex items-center" aria-label="Editor steps">
            {STEP_LABELS.map((label, index) => {
              const done = index < step;
              const current = index === step;
              return (
                <li key={label} className="flex min-w-0 flex-1 items-center last:flex-none">
                  <button
                    type="button"
                    onClick={() => goToStep(index)}
                    aria-current={current ? "step" : undefined}
                    aria-label={`Step ${index + 1}: ${label}`}
                    className="flex min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.5625rem] font-bold",
                        current ? "bg-primary text-primary-foreground" : done ? "bg-green-600 text-white" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {done && !current ? <Check size={11} strokeWidth={3} /> : index + 1}
                    </span>
                    <span className={cn("hidden truncate text-[0.625rem] font-semibold md:inline", current ? "text-foreground" : "text-muted-foreground")}>{label}</span>
                  </button>
                  {index < STEP_LABELS.length - 1 && <span aria-hidden className="mx-1 h-px min-w-2 flex-1 bg-border" />}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 0 && (
            <fieldset className="space-y-4">
              <legend className="sr-only">Basics</legend>
              <div>
                <label htmlFor="task-name" className={fieldLabel}>Name *</label>
                <Input
                  id="task-name"
                  ref={nameRef}
                  value={draft.name}
                  onChange={(event) => { patch({ name: event.target.value }); if (nameError) setNameError(null); }}
                  placeholder="Nightly database backup"
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? "task-name-error" : undefined}
                  className={cn("h-10 text-[0.8125rem]", nameError && "border-red-600")}
                />
                {nameError && <p id="task-name-error" role="alert" className="mt-1 inline-flex items-center gap-1 text-[0.6875rem] font-medium text-red-600"><AlertCircle size={11} aria-hidden />{nameError}</p>}
              </div>
              <div>
                <label htmlFor="task-description" className={fieldLabel}>Description</label>
                <textarea id="task-description" value={draft.description} onChange={(event) => patch({ description: event.target.value })} rows={2} placeholder="What does this task do, and why?" className={textArea} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="task-type" className={fieldLabel}>Type</label>
                  <Select value={draft.type} onValueChange={(type) => patch({ type: type as TaskType })}>
                    <SelectTrigger id="task-type" className="h-9 w-full text-[0.8125rem]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPE_ORDER.map((type) => <SelectItem key={type} value={type}>{TASK_TYPE_LABELS[type]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="task-owner" className={fieldLabel}>Owner</label>
                  <Select value={draft.owner} onValueChange={(owner) => patch({ owner })}>
                    <SelectTrigger id="task-owner" className="h-9 w-full text-[0.8125rem]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TASK_OWNERS.map((owner) => <SelectItem key={owner} value={owner}>{owner}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label htmlFor="task-tags" className={fieldLabel}>Tags</label>
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card p-1.5 focus-within:ring-2 focus-within:ring-ring">
                  {draft.tags.map((tag) => (
                    <span key={tag} className="inline-flex h-6 items-center gap-1 rounded-full bg-muted pl-2 pr-1 text-[0.6875rem] font-medium text-foreground">
                      {tag}
                      <button type="button" onClick={() => patch({ tags: draft.tags.filter((item) => item !== tag) })} aria-label={`Remove tag ${tag}`} className="grid h-4 w-4 place-items-center rounded-full text-muted-foreground hover:text-foreground">
                        <X size={10} aria-hidden />
                      </button>
                    </span>
                  ))}
                  <input
                    id="task-tags"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTag(); } }}
                    onBlur={addTag}
                    placeholder={draft.tags.length === 0 ? "backup, database…" : ""}
                    className="h-6 min-w-[7.5rem] flex-1 bg-transparent px-1 text-[0.75rem] text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-[0.625rem] text-muted-foreground">Press Enter to add a tag.</p>
              </div>
            </fieldset>
          )}

          {step === 1 && (
            <fieldset>
              <legend className="sr-only">Schedule</legend>
              <ScheduleBuilder value={draft.schedule} onChange={patchSchedule} />
            </fieldset>
          )}

          {step === 2 && (
            <fieldset className="space-y-4">
              <legend className="sr-only">Target</legend>
              <div>
                <span className={fieldLabel}>Hosts</span>
                <MultiSelect label="Select hosts" options={HOST_OPTIONS} selected={draft.target.hosts} onChange={(hosts) => patchTarget({ hosts })} width={240} />
              </div>
              <div>
                <span className={fieldLabel}>Groups</span>
                <MultiSelect label="Select groups" options={GROUP_OPTIONS} selected={draft.target.groups} onChange={(groups) => patchTarget({ groups })} width={240} />
              </div>
              <div>
                <span className={fieldLabel}>Environment</span>
                <SegmentedControl
                  value={draft.target.environment === "production" ? "Production" : draft.target.environment === "staging" ? "Staging" : "All"}
                  options={["Production", "Staging", "All"] as const}
                  onChange={(value) => patchTarget({ environment: value === "Production" ? "production" : value === "Staging" ? "staging" : "all" })}
                />
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-foreground"><Info size={12} aria-hidden />Resolves to {resolvedHosts.length} host{resolvedHosts.length === 1 ? "" : "s"}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {resolvedHosts.length === 0
                    ? <span className="text-[0.6875rem] text-muted-foreground">Global scope — runs on every managed host.</span>
                    : resolvedHosts.map((host) => <span key={host} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.625rem] text-foreground">{host}</span>)}
                </div>
              </div>
            </fieldset>
          )}

          {step === 3 && (
            <fieldset className="space-y-4">
              <legend className="sr-only">Execution</legend>
              <div>
                <span className={fieldLabel}>Action</span>
                <SegmentedControl
                  value={draft.execution.mode === "builtin" ? "Built-in" : "Command"}
                  options={["Built-in", "Command"] as const}
                  onChange={(value) => patchExecution(value === "Built-in"
                    ? { mode: "builtin", builtin: draft.execution.builtin ?? "run-backup" }
                    : { mode: "command" })}
                />
              </div>
              {draft.execution.mode === "builtin" ? (
                <div>
                  <label htmlFor="task-builtin" className={fieldLabel}>Built-in action</label>
                  <Select value={draft.execution.builtin ?? "run-backup"} onValueChange={(builtin) => patchExecution({ builtin })}>
                    <SelectTrigger id="task-builtin" className="h-9 w-full text-[0.8125rem]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUILTIN_ACTIONS.map((action) => <SelectItem key={action.value} value={action.value}>{action.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <label htmlFor="task-command" className={fieldLabel}>Command / script</label>
                  <textarea id="task-command" value={draft.execution.command} onChange={(event) => patchExecution({ command: event.target.value })} rows={2} spellCheck={false} placeholder="/opt/scripts/job.sh --flag" className={cn(textArea, "font-mono text-[0.75rem]")} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="task-retries" className={fieldLabel}>Retries on failure</label>
                  <Select value={String(draft.execution.retries)} onValueChange={(value) => patchExecution({ retries: Number(value) })}>
                    <SelectTrigger id="task-retries" className="h-9 w-full text-[0.8125rem]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RETRY_OPTIONS.map((retries) => <SelectItem key={retries} value={String(retries)}>{retries}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="task-timeout" className={fieldLabel}>Timeout</label>
                  <Select value={String(draft.execution.timeoutMinutes)} onValueChange={(value) => patchExecution({ timeoutMinutes: Number(value) })}>
                    <SelectTrigger id="task-timeout" className="h-9 w-full text-[0.8125rem]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMEOUT_OPTIONS.map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes} min</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <span className={fieldLabel}>Concurrency policy</span>
                <SegmentedControl
                  value={draft.execution.concurrency === "skip" ? "Skip" : "Queue"}
                  options={["Skip", "Queue"] as const}
                  onChange={(value) => patchExecution({ concurrency: value === "Skip" ? "skip" : "queue" })}
                />
                <p className="mt-1 text-[0.625rem] text-muted-foreground">Skip: ignore the tick if the previous run is still going. Queue: start after it finishes.</p>
              </div>
            </fieldset>
          )}

          {step === 4 && (
            <fieldset className="space-y-4">
              <legend className="sr-only">Notifications</legend>
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.8125rem] font-medium text-foreground">On failure</p>
                    <p className="text-[0.6875rem] text-muted-foreground">Notify when the run fails or times out.</p>
                  </div>
                  <ToggleSwitch checked={draft.notifications.onFailure} onChange={(checked) => patchNotifications({ onFailure: checked })} label="Notify on failure" size="sm" />
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                  <div>
                    <p className="text-[0.8125rem] font-medium text-foreground">On success</p>
                    <p className="text-[0.6875rem] text-muted-foreground">Notify on every successful run (noisy for frequent jobs).</p>
                  </div>
                  <ToggleSwitch checked={draft.notifications.onSuccess} onChange={(checked) => patchNotifications({ onSuccess: checked })} label="Notify on success" size="sm" />
                </div>
              </div>
              <div>
                <span className={fieldLabel}>Channels</span>
                <div className="flex flex-wrap gap-1.5">
                  {CHANNEL_OPTIONS.map((channel) => {
                    const active = draft.notifications.channels.includes(channel);
                    return (
                      <button
                        key={channel}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleChannel(channel)}
                        className={cn(
                          "h-8 rounded-full border px-3 text-[0.75rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {channel}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label htmlFor="task-recipients" className={fieldLabel}>Recipients</label>
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card p-1.5 focus-within:ring-2 focus-within:ring-ring">
                  {draft.notifications.recipients.map((recipient) => (
                    <span key={recipient} className="inline-flex h-6 items-center gap-1 rounded-full bg-muted pl-2 pr-1 text-[0.6875rem] font-medium text-foreground">
                      {recipient}
                      <button type="button" onClick={() => patchNotifications({ recipients: draft.notifications.recipients.filter((item) => item !== recipient) })} aria-label={`Remove ${recipient}`} className="grid h-4 w-4 place-items-center rounded-full text-muted-foreground hover:text-foreground">
                        <X size={10} aria-hidden />
                      </button>
                    </span>
                  ))}
                  <input
                    id="task-recipients"
                    value={recipientInput}
                    onChange={(event) => setRecipientInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); const values = recipientInput.split(",").map((v) => v.trim()).filter(Boolean); if (values.length) patchNotifications({ recipients: [...new Set([...draft.notifications.recipients, ...values])] }); setRecipientInput(""); } }}
                    onBlur={() => { const values = recipientInput.split(",").map((v) => v.trim()).filter(Boolean); if (values.length) patchNotifications({ recipients: [...new Set([...draft.notifications.recipients, ...values])] }); setRecipientInput(""); }}
                    placeholder={draft.notifications.recipients.length === 0 ? "ops@nexus.io, #ops-alerts…" : ""}
                    className="h-6 min-w-[10rem] flex-1 bg-transparent px-1 text-[0.75rem] text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-[0.625rem] text-muted-foreground">Separate multiple recipients with commas.</p>
              </div>
            </fieldset>
          )}

          {/* Conflict warnings (visible on every step once known) */}
          {(conflicts.windows.length > 0 || conflicts.tasks.length > 0) && (
            <div role="alert" className="mt-4 rounded-lg border border-amber-600/40 bg-amber-100 p-3 text-[0.75rem] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <p className="flex items-center gap-1.5 font-bold"><TriangleAlert size={13} aria-hidden />Scheduling conflict</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {conflicts.windows.map((window) => (
                  <li key={window.id}>Overlaps maintenance window <span className="font-mono font-semibold">{window.id}</span> ({window.title}).</li>
                ))}
                {conflicts.tasks.map((other) => (
                  <li key={other.id}>Overlaps heavy task <span className="font-mono font-semibold">{other.id}</span> ({other.name}) near the same time.</li>
                ))}
              </ul>
              <p className="mt-1 text-[0.6875rem] opacity-80">Task will still run; consider shifting the schedule or relying on the concurrency policy.</p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={goBack} disabled={step === 0} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[0.8125rem] font-medium text-muted-foreground transition-colors enabled:hover:bg-accent enabled:hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronLeft size={15} aria-hidden />Back
          </button>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" onClick={requestClose} >Cancel</Button>
            {isEdit ? (
              <Button onClick={() => submit("save")} ><Check size={14} aria-hidden />Save changes</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => submit("save")} >Save</Button>
                <Button onClick={() => submit("saveAndEnable")} ><Check size={14} aria-hidden />Save &amp; Enable</Button>
              </>
            )}
            {step < 4 && (
              <Button variant="outline" onClick={goNext} >Continue<ChevronRight size={14} aria-hidden /></Button>
            )}
          </div>
        </div>
      </div>

      {/* Unsaved changes confirm */}
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="w-[min(26.25rem,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm"><ShieldAlert size={16} aria-hidden className="text-amber-600" />Discard unsaved changes?</DialogTitle>
            <DialogDescription>Your edits to this task will be lost. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>Keep editing</Button>
            <Button variant="destructive" onClick={() => { setDiscardOpen(false); onClose(); }}>Discard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>,
    document.body,
  );
}
