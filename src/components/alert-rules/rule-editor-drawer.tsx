"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ConditionBuilder, type ConditionErrors } from "@/components/alert-rules/condition-builder";
import { NotificationPolicyForm, type NotificationPolicyErrors } from "@/components/alert-rules/notification-policy-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  GROUP_TYPE,
  HOST_TYPE,
  RULE_SEVERITIES,
  RULE_TYPES,
  TARGET_GROUPS,
  TARGET_HOSTS,
  type AlertRule,
  type NotificationPolicy,
  type RuleCondition,
  type RuleSeverity,
  type RuleType,
} from "@/mocks/alertRules";
import { cn } from "@/lib/utils";

export interface RuleEditorDraft {
  name: string;
  description: string;
  severity: RuleSeverity;
  tags: string[];
  type: RuleType;
  condition: RuleCondition;
  environment: string;
  targetKind: "host" | "group";
  target: string;
  exclude: string[];
  notifications: NotificationPolicy;
}

export type RuleEditorState = { mode: "create" } | { mode: "edit"; rule: AlertRule } | null;

interface RuleEditorDrawerProps {
  state: RuleEditorState;
  /** Persists the draft. `enable` = "Save & Enable", otherwise saves as-is (new rules start Disabled). */
  onSave: (draft: RuleEditorDraft, enable: boolean) => void;
  onClose: () => void;
}

const STEPS = ["Basics", "Condition", "Target", "Notifications"] as const;
const ENVIRONMENTS = ["production", "staging", "development"] as const;

const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-[0.8125rem] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

const DEFAULT_CONDITION: RuleCondition = { metric: "CPU usage", operator: ">", value: 90, unit: "%", duration: "5m", evaluationInterval: "30s" };

function defaultDraft(): RuleEditorDraft {
  return {
    name: "",
    description: "",
    severity: "Warning",
    tags: [],
    type: "Threshold",
    condition: { ...DEFAULT_CONDITION },
    environment: "production",
    targetKind: "host",
    target: "api-server-01",
    exclude: [],
    notifications: { channels: ["Email"], recipients: ["on-call@nexus.io"], escalationMinutes: 30, repeatInterval: "1h", respectQuietHours: true },
  };
}

function draftFromRule(rule: AlertRule): RuleEditorDraft {
  const isGroup = rule.target in GROUP_TYPE && !(rule.target in HOST_TYPE);
  return {
    name: rule.name,
    description: rule.description,
    severity: rule.severity,
    tags: [...rule.tags],
    type: rule.type,
    condition: { ...rule.condition, conditions: rule.condition.conditions?.map((child) => ({ ...child })) },
    environment: rule.environment ?? "production",
    targetKind: isGroup ? "group" : "host",
    target: rule.target,
    exclude: [...(rule.exclude ?? [])],
    notifications: { ...rule.notifications, channels: [...rule.notifications.channels], recipients: [...rule.notifications.recipients] },
  };
}

function hashString(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), t ^ (t >>> 14))) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 48-point series for the rule being edited/previewed. */
function previewSeries(draft: RuleEditorDraft, existing?: AlertRule): Array<{ time: string; value: number }> {
  if (existing && existing.metric.length > 0) {
    return existing.metric.filter((_, index) => index % 2 === 0).map((point) => ({ time: point.time, value: point.value }));
  }
  const threshold = draft.condition.conditions?.[0]?.value ?? draft.condition.value;
  const seed = hashString(`${draft.condition.metric}:${threshold}:${draft.type}`);
  const rand = mulberry32(seed);
  const peak = Math.max(threshold * 1.15, threshold + 1);
  const now = Date.now();
  const spanMs = 24 * 60 * 60 * 1000;
  const step = spanMs / 48;
  const pad = (value: number) => String(value).padStart(2, "0");
  return Array.from({ length: 48 }, (_, index) => {
    const epochMs = now - spanMs + index * step;
    const date = new Date(epochMs);
    const wave = Math.sin(index * 0.42 + seed) * 0.12 + Math.cos(index * 0.17 + seed * 0.5) * 0.07;
    const value = Math.max(0, peak * (0.82 + wave + (rand() - 0.5) * 0.1));
    return { time: `${pad(date.getHours())}:${pad(date.getMinutes())}`, value: Number(value.toFixed(1)) };
  });
}

function breachEstimate(draft: RuleEditorDraft, series: Array<{ value: number }>): number {
  const primary = draft.type === "Composite" && draft.condition.conditions?.length ? draft.condition.conditions[0] : draft.condition;
  return series.filter((point) => {
    if (primary.operator === ">") return point.value > primary.value;
    if (primary.operator === "<") return point.value < primary.value;
    return Math.abs(point.value - primary.value) < Math.max(0.5, primary.value * 0.02);
  }).length;
}

function validate(draft: RuleEditorDraft): { basics: Record<string, string>; condition: ConditionErrors; target: Record<string, string>; notifications: NotificationPolicyErrors } {
  const basics: Record<string, string> = {};
  if (draft.name.trim().length < 3) basics.name = "Name must be at least 3 characters.";

  const condition: ConditionErrors = {};
  const primary = draft.type === "Composite" ? draft.condition.conditions?.[0] : draft.condition;
  if (!primary?.metric) condition.metric = "Select a metric.";
  if (primary && Number.isNaN(primary.value)) condition.value = "Enter a numeric threshold.";
  if (draft.type === "Composite" && draft.condition.conditions?.length !== 2) condition.secondCondition = "Composite rules need two conditions joined by AND/OR.";

  const target: Record<string, string> = {};
  if (!draft.target) target.target = "Select a host or group.";

  const notifications: NotificationPolicyErrors = {};
  if (draft.notifications.channels.length === 0) notifications.channels = "Pick at least one channel.";
  if (draft.notifications.recipients.length === 0) notifications.recipients = "Add at least one recipient.";

  return { basics, condition, target, notifications };
}

const TABULAR = "tabular-nums";

/** Right-side rule editor (35rem, full-screen on mobile), 4-step stepper with live preview. */
export function RuleEditorDrawer({ state, onSave, onClose }: RuleEditorDrawerProps) {
  const open = state !== null;
  const editingRule = state?.mode === "edit" ? state.rule : null;
  const [draft, setDraft] = useState<RuleEditorDraft>(() => (editingRule ? draftFromRule(editingRule) : defaultDraft()));
  const [baseline, setBaseline] = useState(() => JSON.stringify(draft));
  const [step, setStep] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Re-seed when a different rule (or create mode) is opened.
  useEffect(() => {
    if (!open) return;
    const next = editingRule ? draftFromRule(editingRule) : defaultDraft();
    setDraft(next);
    setBaseline(JSON.stringify(next));
    setStep(0);
    setAttempted(false);
    setDiscardOpen(false);
    drawerRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingRule?.id]);

  const dirty = useMemo(() => JSON.stringify(draft) !== baseline, [draft, baseline]);
  const errors = useMemo(() => validate(draft), [draft]);
  const preview = useMemo(() => previewSeries(draft, editingRule ?? undefined), [draft, editingRule]);
  const estimate = useMemo(() => breachEstimate(draft, preview), [draft, preview]);
  const thresholdValue = draft.type === "Composite" && draft.condition.conditions?.length ? draft.condition.conditions[0].value : draft.condition.value;
  const thresholdUnit = draft.type === "Composite" && draft.condition.conditions?.length ? draft.condition.conditions[0].unit : draft.condition.unit;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        attemptClose();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusables = drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty]);

  function attemptClose() {
    if (dirty) setDiscardOpen(true);
    else onClose();
  }

  const stepValid = (index: number): boolean => {
    if (index === 0) return !errors.basics.name;
    if (index === 1) return !errors.condition.metric && !errors.condition.value && !errors.condition.secondCondition;
    if (index === 2) return !errors.target.target;
    return !errors.notifications.channels && !errors.notifications.recipients;
  };

  const goNext = () => {
    setAttempted(true);
    if (!stepValid(step)) return;
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };

  const submit = (enable: boolean) => {
    setAttempted(true);
    if (!stepValid(0) || !stepValid(1) || !stepValid(2) || !stepValid(3)) return;
    onSave({ ...draft, name: draft.name.trim() }, enable);
  };

  if (!open || typeof document === "undefined") return null;

  const title = editingRule ? `Edit rule · ${editingRule.id}` : "Create rule";

  return createPortal(
    <>
      <div aria-hidden="true" className="fixed inset-0 z-[1290] bg-slate-950/40" onClick={attemptClose} />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rule-editor-title"
        className="animate-drawer-in fixed inset-y-0 right-0 z-[1300] flex w-full flex-col border-l border-border bg-card shadow-2xl sm:w-[35rem]"
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-border p-5">
          <h2 id="rule-editor-title" className="truncate font-display text-[1.0625rem] font-bold tracking-tight text-foreground">{title}</h2>
          <button
            type="button"
            data-autofocus
            onClick={attemptClose}
            aria-label="Close editor"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        {/* Stepper */}
        <ol className="flex items-center gap-1.5 border-b border-border px-5 py-3" aria-label="Editor steps">
          {STEPS.map((label, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li key={label} className="flex min-w-0 flex-1 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStep(index)}
                  aria-current={current ? "step" : undefined}
                  aria-label={`Step ${index + 1}: ${label}`}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[0.625rem] font-bold",
                      current ? "border-primary bg-primary text-primary-foreground" : done ? "border-green-600 bg-green-600 text-white" : "border-border text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className={cn("hidden truncate text-[0.75rem] font-medium sm:inline", current ? "text-foreground" : "text-muted-foreground")}>{label}</span>
                </button>
                {index < STEPS.length - 1 && <span aria-hidden="true" className="h-px w-3 shrink-0 bg-border sm:w-4" />}
              </li>
            );
          })}
        </ol>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === 0 && (
            <section aria-label="Basics" className="grid gap-3">
              <div className="grid gap-1">
                <label htmlFor="rule-name" className="text-[0.75rem] font-medium text-muted-foreground">Name</label>
                <input
                  id="rule-name"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="High CPU usage"
                  aria-invalid={attempted && Boolean(errors.basics.name)}
                  aria-describedby={attempted && errors.basics.name ? "rule-name-error" : undefined}
                  className={fieldClass}
                />
                {attempted && errors.basics.name && <p id="rule-name-error" role="alert" className="text-[0.6875rem] font-medium text-red-600 dark:text-red-400">{errors.basics.name}</p>}
              </div>
              <div className="grid gap-1">
                <label htmlFor="rule-description" className="text-[0.75rem] font-medium text-muted-foreground">Description</label>
                <textarea
                  id="rule-description"
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  rows={2}
                  placeholder="What should on-call do when this fires?"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[0.8125rem] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <label htmlFor="rule-severity" className="text-[0.75rem] font-medium text-muted-foreground">Severity</label>
                  <select id="rule-severity" value={draft.severity} onChange={(event) => setDraft((current) => ({ ...current, severity: event.target.value as RuleSeverity }))} className={fieldClass}>
                    {RULE_SEVERITIES.map((severity) => (
                      <option key={severity} value={severity}>{severity}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <label htmlFor="rule-tags" className="text-[0.75rem] font-medium text-muted-foreground">Tags (comma separated)</label>
                  <input
                    id="rule-tags"
                    value={draft.tags.join(", ")}
                    onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) }))}
                    placeholder="cpu, capacity"
                    className={fieldClass}
                  />
                </div>
              </div>
            </section>
          )}

          {step === 1 && (
            <section aria-label="Condition" className="grid gap-4">
              <div className="grid gap-1">
                <label htmlFor="rule-type" className="text-[0.75rem] font-medium text-muted-foreground">Rule type</label>
                <select
                  id="rule-type"
                  value={draft.type}
                  onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as RuleType, condition: event.target.value === "Anomaly" ? { ...current.condition, unit: "σ" } : current.condition }))}
                  className={fieldClass}
                >
                  {RULE_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <ConditionBuilder
                type={draft.type}
                condition={draft.condition}
                errors={attempted ? errors.condition : undefined}
                onChange={(condition) => setDraft((current) => ({ ...current, condition }))}
              />

              {/* Live preview */}
              <div className="rounded-xl border border-border/80 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Preview · last 24h</h3>
                  <span className="text-[0.6875rem] font-medium text-muted-foreground">Threshold {thresholdValue}{thresholdUnit}</span>
                </div>
                <div className="mt-2 h-[6.875rem] w-full" aria-label="Threshold preview chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={preview} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="time" interval={9} tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis width={34} tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ border: "0.0625rem solid var(--border)", borderRadius: 8, fontSize: 11, background: "var(--popover)" }} />
                      <ReferenceLine y={thresholdValue} stroke="#64748b" strokeDasharray="5 4" />
                      <Line dataKey="value" name="Observed" type="monotone" stroke="#1565e8" strokeWidth={1.8} dot={false} activeDot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className={cn("mt-2 text-[0.75rem] font-semibold", estimate > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground", TABULAR)}>
                  ~{estimate} of {preview.length} evaluations would breach (last 24h)
                </p>
              </div>
            </section>
          )}

          {step === 2 && (
            <section aria-label="Target" className="grid gap-3">
              <div className="grid gap-1">
                <label htmlFor="rule-environment" className="text-[0.75rem] font-medium text-muted-foreground">Environment</label>
                <select id="rule-environment" value={draft.environment} onChange={(event) => setDraft((current) => ({ ...current, environment: event.target.value }))} className={fieldClass}>
                  {ENVIRONMENTS.map((environment) => (
                    <option key={environment} value={environment}>{environment}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1" role="group" aria-label="Target kind">
                <span className="text-[0.75rem] font-medium text-muted-foreground">Target type</span>
                <div className="inline-flex w-max items-center gap-1 rounded-lg border border-border p-0.5">
                  {(["host", "group"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={draft.targetKind === kind}
                      onClick={() => setDraft((current) => ({ ...current, targetKind: kind, target: kind === "host" ? TARGET_HOSTS[0] : TARGET_GROUPS[0] }))}
                      className={cn(
                        "h-7 rounded-md px-4 text-[0.75rem] font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        draft.targetKind === kind ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {kind}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-1">
                <label htmlFor="rule-target" className="text-[0.75rem] font-medium text-muted-foreground">{draft.targetKind === "host" ? "Host" : "Group"}</label>
                <select
                  id="rule-target"
                  value={draft.target}
                  onChange={(event) => setDraft((current) => ({ ...current, target: event.target.value }))}
                  aria-invalid={attempted && Boolean(errors.target.target)}
                  className={fieldClass}
                >
                  {(draft.targetKind === "host" ? TARGET_HOSTS : TARGET_GROUPS).map((target) => (
                    <option key={target} value={target}>{target}</option>
                  ))}
                </select>
                {attempted && errors.target.target && <p role="alert" className="text-[0.6875rem] font-medium text-red-600 dark:text-red-400">{errors.target.target}</p>}
              </div>
              <div className="grid gap-1">
                <label htmlFor="rule-exclude" className="text-[0.75rem] font-medium text-muted-foreground">Exclude (comma separated)</label>
                <input
                  id="rule-exclude"
                  value={draft.exclude.join(", ")}
                  onChange={(event) => setDraft((current) => ({ ...current, exclude: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))}
                  placeholder="db-02, worker-02"
                  className={fieldClass}
                />
              </div>
            </section>
          )}

          {step === 3 && (
            <section aria-label="Notifications">
              <NotificationPolicyForm
                value={draft.notifications}
                errors={attempted ? errors.notifications : undefined}
                onChange={(notifications) => setDraft((current) => ({ ...current, notifications }))}
              />
            </section>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center gap-2 border-t border-border p-4">
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep((current) => current - 1)} className="h-9 gap-1 rounded-lg px-3 text-[0.8125rem]">
              <ChevronLeft size={15} aria-hidden="true" />Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={attemptClose} className="h-9 rounded-lg px-3 text-[0.8125rem] text-muted-foreground">Cancel</Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {step < STEPS.length - 1 ? (
              <Button onClick={goNext} className="h-9 gap-1 rounded-lg px-4 text-[0.8125rem]">
                Next<ChevronRight size={15} aria-hidden="true" />
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => submit(false)} className="h-9 rounded-lg px-4 text-[0.8125rem]">Save</Button>
                <Button onClick={() => submit(true)} className="h-9 rounded-lg px-4 text-[0.8125rem]">Save & Enable</Button>
              </>
            )}
          </div>
        </footer>
      </aside>

      {/* Unsaved changes confirm */}
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>This rule has edits that were not saved. Closing now will lose them.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)} className="h-9 rounded-lg px-4 text-[0.8125rem]">Keep editing</Button>
            <Button variant="destructive" onClick={() => { setDiscardOpen(false); onClose(); }} className="h-9 rounded-lg px-4 text-[0.8125rem]">Discard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>,
    document.body,
  );
}
