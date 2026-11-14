"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, CheckCircle2, ChevronLeft, CircleDashed, Clipboard, Flag, NotebookPen,
  Play, ShieldAlert, ShieldCheck, Terminal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { RunbookStepTypeBadge } from "@/components/shared/runbook-badges";
import { formatDurationMs, timeAgo } from "@/components/shared/runbook-format";
import {
  getRunbookById, recordExecution, CURRENT_RUNBOOK_USER,
  type RunbookStep, type RunbookExecutionResult,
} from "@/mocks/runbooks";
import { readIncidentStore } from "@/mocks/incidents";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Mock flag: in production the backend decides admin eligibility. Here every user is admin. */
const MOCK_ADMIN_PERMISSION = true;

interface RunnerProgress {
  currentIndex: number;
  doneStepIds: string[];
  skipped: Record<string, string>;
  notes: Array<{ stepId: string; at: number; text: string }>;
  acknowledged: Record<string, boolean>;
  incidentId: string | null;
  startedAt: number;
}

const progressKey = (runbookId: string) => `runbooks.runProgress.${runbookId}`;
function readProgress(runbookId: string): RunnerProgress | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(progressKey(runbookId));
    return raw ? (JSON.parse(raw) as RunnerProgress) : null;
  } catch {
    return null;
  }
}
function writeProgress(runbookId: string, progress: RunnerProgress): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(progressKey(runbookId), JSON.stringify(progress));
  } catch {
    /* storage unavailable */
  }
}
function clearProgress(runbookId: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(progressKey(runbookId));
  } catch {
    /* ignore */
  }
}

export function RunbookRunner({ runbookId }: { runbookId: string }) {
  const router = useRouter();
  const runbook = getRunbookById(runbookId) ?? null;
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const streamTimer = useRef<number | null>(null);

  const [savedProgress, setSavedProgress] = useState<RunnerProgress | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [doneStepIds, setDoneStepIds] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Array<{ stepId: string; at: number; text: string }>>([]);
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [phase, setPhase] = useState<"running" | "summary">("running");
  const [result, setResult] = useState<RunbookExecutionResult>("Completed");
  const [skipReason, setSkipReason] = useState("");
  const [skipPromptFor, setSkipPromptFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [exitDialog, setExitDialog] = useState(false);
  const [automateStep, setAutomateStep] = useState<RunbookStep | null>(null);
  const [automateOutput, setAutomateOutput] = useState<string[]>([]);
  const [automateRunning, setAutomateRunning] = useState(false);
  const [tab, setTab] = useState<"execute" | "rollback">("execute");

  const showToast = (message: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message });
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  };

  /* Load saved progress once on mount (client only). */
  useEffect(() => {
    setSavedProgress(readProgress(runbookId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runbookId]);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    if (streamTimer.current) window.clearInterval(streamTimer.current);
  }, []);

  /* Live timer. */
  useEffect(() => {
    if (phase !== "running") return;
    const tick = () => setElapsedMs(Date.now() - startedAt);
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [phase, startedAt]);

  /* Persist progress as it changes. */
  useEffect(() => {
    if (!runbook || phase !== "running") return;
    if (doneStepIds.length === 0 && currentIndex === 0 && !incidentId) return;
    writeProgress(runbookId, { currentIndex, doneStepIds, skipped, notes, acknowledged, incidentId, startedAt });
  }, [runbook, phase, runbookId, currentIndex, doneStepIds, skipped, notes, acknowledged, incidentId, startedAt]);

  const steps = runbook?.steps ?? [];
  const currentStep = steps[currentIndex] ?? null;
  const progressPct = steps.length > 0 ? Math.round((doneStepIds.length / steps.length) * 100) : 0;
  const acknowledgedCurrent = currentStep ? Boolean(acknowledged[currentStep.id]) : true;
  const isWarningStep = currentStep?.type === "Warning";
  const totalNoteCount = notes.length;

  const incidents = useMemo(() => readIncidentStore().filter((incident) => incident.status !== "Resolved").slice(0, 12), []);

  if (!runbook) {
    return (
      <div className="mx-auto grid min-h-[20rem] max-w-xl place-items-center rounded-xl border border-border bg-card p-8 text-center">
        <div>
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-3 font-display text-base font-bold text-foreground">Runbook not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">No runbook with id <span className="font-mono">{runbookId}</span> exists.</p>
          <Button variant="outline" className="mt-4 h-10 rounded-lg px-4 text-sm" onClick={() => router.push("/runbooks")}><ChevronLeft size={15} aria-hidden />Back to Runbooks</Button>
        </div>
      </div>
    );
  }

  const resume = () => {
    if (!savedProgress) return;
    setCurrentIndex(savedProgress.currentIndex);
    setDoneStepIds(savedProgress.doneStepIds);
    setSkipped(savedProgress.skipped);
    setNotes(savedProgress.notes);
    setAcknowledged(savedProgress.acknowledged);
    setIncidentId(savedProgress.incidentId);
    setStartedAt(savedProgress.startedAt);
    setSavedProgress(null);
    showToast("Resumed unfinished run.");
  };
  const discardResume = () => {
    clearProgress(runbook.id);
    setSavedProgress(null);
    showToast("Saved progress discarded.");
  };

  const completeStep = (stepId: string) => {
    setDoneStepIds((current) => (current.includes(stepId) ? current : [...current, stepId]));
    setCurrentIndex((current) => Math.min(current + 1, steps.length));
  };
  const skipStep = (stepId: string) => {
    const reason = skipReason.trim();
    if (!reason) return;
    setSkipped((current) => ({ ...current, [stepId]: reason }));
    setSkipReason("");
    setSkipPromptFor(null);
    setDoneStepIds((current) => (current.includes(stepId) ? current : [...current, stepId]));
    setCurrentIndex((current) => Math.min(current + 1, steps.length));
    showToast(`Step skipped — reason logged: "${reason}".`);
  };
  const addNote = () => {
    const text = noteDraft.trim();
    if (!text || !currentStep) return;
    setNotes((current) => [...current, { stepId: currentStep.id, at: Date.now(), text }]);
    setNoteDraft("");
    showToast("Note added to the run log.");
  };
  const runAutomatedStep = (step: RunbookStep) => {
    setAutomateStep(step);
    setAutomateOutput([]);
    setAutomateRunning(false);
  };
  const confirmAutomatedRun = () => {
    if (!automateStep) return;
    const host = runbook.services[0] ?? "unknown-host";
    if (!MOCK_ADMIN_PERMISSION) {
      showToast("Permission denied — automated steps require the admin role.");
      setAutomateStep(null);
      return;
    }
    setAutomateRunning(true);
    setAutomateOutput([`[guard] admin permission granted (mock) for ${CURRENT_RUNBOOK_USER}`, `[audit] step "${automateStep.title}" run requested on ${host} by ${CURRENT_RUNBOOK_USER}`, `[exec] ${automateStep.command ?? automateStep.title}`]);
    const stream = ["[vault] fetched credentials (lease 300s)", "[ssh] connected to " + host, "[exec] running command…", `[stdout] ${automateStep.expectedOutput ?? "command completed"}`, "[exit] 0 — completed in 1.8s"];
    let index = 0;
    streamTimer.current = window.setInterval(() => {
      const line = stream[index];
      index += 1;
      setAutomateOutput((current) => [...current, line]);
      if (index >= stream.length && streamTimer.current) {
        window.clearInterval(streamTimer.current);
        streamTimer.current = null;
        setAutomateRunning(false);
        showToast("Audit entry recorded for the automated step.");
      }
    }, 480);
  };
  const finishRun = () => {
    setPhase("summary");
  };
  const saveAndExit = () => {
    writeProgress(runbook.id, { currentIndex, doneStepIds, skipped, notes, acknowledged, incidentId, startedAt });
    showToast("Progress saved — resume anytime from this page.");
    router.push(`/runbooks/${runbook.id}`);
  };
  const exitClicked = () => {
    const hasProgress = doneStepIds.length > 0 || currentIndex > 0 || notes.length > 0;
    if (hasProgress) setExitDialog(true);
    else router.push(`/runbooks/${runbook.id}`);
  };
  const recordAndReturn = () => {
    const endedAt = new Date().toISOString();
    recordExecution({
      runbookId: runbook.id,
      by: CURRENT_RUNBOOK_USER,
      incidentId,
      startedAt: new Date(startedAt).toISOString(),
      endedAt,
      epochMs: startedAt,
      durationMs: Date.now() - startedAt,
      result,
      stepsDone: doneStepIds.length,
      notes: notes.map((note) => `[${note.stepId}] ${note.text}`).concat(Object.entries(skipped).map(([stepId, reason]) => `[${stepId}] skipped: ${reason}`)).join("\n"),
    });
    clearProgress(runbook.id);
    showToast("Execution recorded — it now shows under Recent executions.");
    router.push(`/runbooks/${runbook.id}`);
  };

  /* ---------- summary screen ---------- */
  if (phase === "summary") {
    const durationMs = Date.now() - startedAt;
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-xl border border-border bg-card p-5 text-center">
          <Flag className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="mt-2 font-display text-lg font-extrabold text-foreground">Run complete</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{runbook.title} · {runbook.id}</p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[{ label: "Duration", value: formatDurationMs(durationMs) }, { label: "Steps done", value: `${doneStepIds.length}/${steps.length}` }, { label: "Notes", value: String(totalNoteCount) }].map((tile) => (
              <div key={tile.label} className="rounded-lg bg-muted/50 p-3"><dt className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">{tile.label}</dt><dd className="mt-1 font-display text-lg font-extrabold tabular-nums text-foreground">{tile.value}</dd></div>
            ))}
          </dl>
          <fieldset className="mt-4 text-left">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Result</legend>
            <div className="mt-1.5 flex gap-2" role="radiogroup" aria-label="Execution result">
              {(["Completed", "Failed", "Aborted"] as RunbookExecutionResult[]).map((option) => (
                <button key={option} type="button" role="radio" aria-checked={result === option} onClick={() => setResult(option)} className={cn("h-9 flex-1 rounded-lg border text-[0.8125rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", result === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent")}>{option}</button>
              ))}
            </div>
          </fieldset>
          <Button className="mt-4 h-10 w-full rounded-lg text-sm font-semibold" onClick={recordAndReturn}><CheckCircle2 size={16} aria-hidden />Save execution &amp; finish</Button>
        </div>
        {toast && <div role="status" aria-live="polite" className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow">{toast.message}</div>}
      </div>
    );
  }

  /* ---------- running screen ---------- */
  return (
    <div className="space-y-4">
      {/* Top bar: breadcrumb-ish + progress + timer + exit */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={exitClicked} className="inline-flex items-center gap-1 rounded text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronLeft size={15} aria-hidden />Exit</button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span className="truncate font-semibold text-foreground">{runbook.title}</span><span className="shrink-0 tabular-nums">Step {Math.min(currentIndex + 1, steps.length)} of {steps.length} · {formatDurationMs(elapsedMs)}</span></div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Run progress"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progressPct}%` }} /></div>
          </div>
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">Link to incident
            <select aria-label="Link to incident" value={incidentId ?? ""} onChange={(event) => setIncidentId(event.target.value || null)} className="h-9 max-w-[11.25rem] rounded-lg border border-border bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">No incident</option>
              {incidents.map((incident) => <option key={incident.id} value={incident.id}>{incident.id} — {incident.title.slice(0, 40)}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Resume banner */}
      {savedProgress && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <ShieldAlert size={15} aria-hidden />You have an unfinished run from {timeAgo(savedProgress.startedAt)} (step {savedProgress.currentIndex + 1} of {steps.length}).
          <button type="button" className="rounded font-semibold underline underline-offset-2 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={resume}>Resume</button>
          <button type="button" className="rounded font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={discardResume}>Discard</button>
        </div>
      )}

      {/* Execute / Rollback tabs */}
      <div className="flex items-center gap-1 border-b border-border" role="tablist" aria-label="Runner tabs">
        {(["execute", "rollback"] as const).map((name) => (
          <button key={name} role="tab" aria-selected={tab === name} id={`runner-tab-${name}`} aria-controls={tab === name ? `runner-panel-${name}` : undefined} onClick={() => setTab(name)} className={cn("-mb-px border-b-2 px-3 pb-2 pt-2 text-sm font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === name ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{name === "execute" ? "Steps" : "Rollback"}</button>
        ))}
      </div>

      {tab === "rollback" ? (
        <div role="tabpanel" id="runner-panel-rollback" aria-labelledby="runner-tab-rollback" className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold text-foreground">Rollback procedure</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Run these only if the remediation made things worse. Check each box as you go.</p>
          <ol className="mt-2 space-y-2">
            {runbook.rollback.map((step, index) => <RollbackChecklistItem key={step.id} step={step} index={index} onToast={showToast} />)}
            {runbook.rollback.length === 0 && <li className="text-xs text-muted-foreground">No rollback steps defined for this runbook.</li>}
          </ol>
        </div>
      ) : (
        <div role="tabpanel" id="runner-panel-execute" aria-labelledby="runner-tab-execute" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left stepper */}
          <nav aria-label="Steps" className="lg:col-span-3">
            <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {steps.map((step, index) => {
                const done = doneStepIds.includes(step.id);
                const state = done ? "done" : index === Math.min(currentIndex, steps.length - 1) && phase === "running" && currentIndex < steps.length ? "current" : "pending";
                const Icon = state === "done" ? CheckCircle2 : state === "current" ? Play : CircleDashed;
                return (
                  <li key={step.id} className="shrink-0">
                    <button
                      type="button"
                      aria-current={state === "current" ? "step" : undefined}
                      onClick={() => setCurrentIndex(index)}
                      className={cn("flex w-56 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-full", state === "done" ? "border-border bg-muted/40 text-muted-foreground" : state === "current" ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary" : "border-border bg-card text-muted-foreground hover:bg-accent")}
                    >
                      <Icon size={14} aria-hidden className={cn("shrink-0", state === "done" && "text-emerald-600 dark:text-emerald-400", state === "current" && "text-primary")} />
                      <span className="min-w-0"><span className="block truncate font-semibold">{index + 1}. {step.title}</span><span className="mt-0.5 block text-[0.6875rem] tabular-nums">{step.type} · {step.estimatedMinutes}m</span></span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Current step */}
          <div className="min-w-0 lg:col-span-9">
            {currentStep ? (
              <section aria-label={`Step ${currentIndex + 1}`} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-sm font-bold tabular-nums text-primary">{currentIndex + 1}</span>
                  <h1 className="min-w-0 flex-1 text-base font-extrabold text-foreground">{currentStep.title}</h1>
                  <RunbookStepTypeBadge type={currentStep.type} />
                </div>
                <p className="mt-2 text-sm leading-snug text-foreground/90">{currentStep.description}</p>
                {currentStep.command && (
                  <div className="relative mt-2">
                    <pre className="overflow-x-auto rounded-lg border border-border bg-slate-900 p-3 font-mono text-[0.75rem] leading-relaxed text-slate-100"><code>{currentStep.command}</code></pre>
                    <button type="button" aria-label="Copy command" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md border border-border/60 bg-card/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { try { void navigator.clipboard?.writeText(currentStep.command!).then(() => showToast("Command copied."), () => showToast("Copy failed.")); } catch { showToast("Clipboard unavailable."); } }}><Clipboard size={13} aria-hidden /></button>
                    {currentStep.expectedOutput && <p className="mt-1.5 text-[0.6875rem] leading-snug text-muted-foreground"><span className="font-semibold text-foreground/80">Expected: </span>{currentStep.expectedOutput}</p>}
                  </div>
                )}
                {!currentStep.command && currentStep.expectedOutput && <p className="mt-2 text-[0.6875rem] leading-snug text-muted-foreground"><span className="font-semibold text-foreground/80">Expected: </span>{currentStep.expectedOutput}</p>}

                {/* Warning acknowledgement */}
                {isWarningStep && (
                  <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/60 p-2.5 text-xs font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    <input type="checkbox" checked={acknowledgedCurrent} onChange={(event) => setAcknowledged((current) => ({ ...current, [currentStep.id]: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#D97706]" />
                    I understand — this step is destructive or hard to reverse.
                  </label>
                )}

                {/* Automated step action */}
                {currentStep.type === "Automated" && (
                  <button type="button" className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 text-[0.8125rem] font-semibold text-violet-800 transition-colors hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200" onClick={() => runAutomatedStep(currentStep)}>
                    <Terminal size={15} aria-hidden />Run step
                  </button>
                )}

                {/* Skip prompt */}
                {skipPromptFor === currentStep.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-2.5">
                    <label htmlFor="skip-reason" className="text-xs font-semibold text-muted-foreground">Reason to skip (required)</label>
                    <input id="skip-reason" value={skipReason} onChange={(event) => setSkipReason(event.target.value)} autoFocus className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="e.g. not applicable in this environment" />
                    <Button variant="outline" className="h-8 rounded-lg px-3 text-xs" onClick={() => setSkipPromptFor(null)}>Cancel</Button>
                    <Button className="h-8 rounded-lg px-3 text-xs" disabled={!skipReason.trim()} onClick={() => skipStep(currentStep.id)}>Skip step</Button>
                  </div>
                )}

                {/* Notes */}
                <div className="mt-3 border-t border-border pt-3">
                  <label htmlFor="run-note" className="text-xs font-semibold text-muted-foreground">Add note</label>
                  <div className="mt-1 flex gap-2">
                    <input id="run-note" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addNote(); }} className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Observation for the run log..." />
                    <Button variant="outline" className="h-9 shrink-0 gap-1 rounded-lg px-3 text-xs" onClick={addNote}><NotebookPen size={13} aria-hidden />Add</Button>
                  </div>
                  {notes.length > 0 && <ul className="mt-2 space-y-1 text-[0.6875rem] text-muted-foreground">{notes.slice(-3).map((note, index) => <li key={`${note.at}-${index}`} className="truncate"><span className="font-semibold text-foreground/70">[{note.stepId}]</span> {note.text}</li>)}</ul>}
                </div>

                {/* Action bar */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <Button variant="ghost" className="h-9 rounded-lg px-3 text-[0.8125rem] text-muted-foreground" onClick={() => setSkipPromptFor((current) => (current === currentStep.id ? null : currentStep.id))}>Skip…</Button>
                  <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => showToast("Issue reported to the runbook owner (mock).")}>Report issue</button>
                  <div className="ml-auto flex items-center gap-2">
                    {currentIndex < steps.length - 1 ? (
                      <Button className="h-9 gap-1 rounded-lg px-4 text-[0.8125rem] font-semibold" disabled={isWarningStep && !acknowledgedCurrent} onClick={() => completeStep(currentStep.id)}>Mark complete<CheckCircle2 size={15} aria-hidden /></Button>
                    ) : (
                      <Button className="h-9 gap-1 rounded-lg px-4 text-[0.8125rem] font-semibold" disabled={isWarningStep && !acknowledgedCurrent} onClick={() => { completeStep(currentStep.id); finishRun(); }}>Finish<Flag size={15} aria-hidden /></Button>
                    )}
                  </div>
                </div>
              </section>
            ) : (
              <section aria-label="All steps complete" className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 text-center dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <ShieldCheck className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <h2 className="mt-2 font-display text-base font-extrabold text-foreground">All steps processed</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{doneStepIds.length} of {steps.length} steps done{Object.keys(skipped).length > 0 ? ` · ${Object.keys(skipped).length} skipped` : ""}.</p>
                <Button className="mt-3 h-10 gap-1.5 rounded-lg px-5 text-sm font-semibold" onClick={finishRun}><Flag size={15} aria-hidden />Finish &amp; summary</Button>
              </section>
            )}
          </div>
        </div>
      )}

      {/* Exit warning dialog */}
      <Dialog open={exitDialog} onOpenChange={setExitDialog}>
        <DialogContent className="w-[min(26.25rem,calc(100vw-2rem))] rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Leave the run?</DialogTitle>
            <DialogDescription className="text-[0.75rem]">Your progress on {runbook.id} will be saved on this device. You can resume later from this page.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-9 rounded-lg px-4 text-[0.8125rem]" onClick={() => setExitDialog(false)}>Keep running</Button>
            <Button className="h-9 rounded-lg px-4 text-[0.8125rem] font-semibold" onClick={saveAndExit}>Save &amp; exit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Automated step confirm dialog */}
      <Dialog open={automateStep != null} onOpenChange={(open) => { if (!open && !automateRunning) { setAutomateStep(null); setAutomateOutput([]); } }}>
        <DialogContent className="w-[min(32.5rem,calc(100vw-2rem))] rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Run automated step?</DialogTitle>
            <DialogDescription className="text-[0.75rem]"><code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem]">{automateStep?.command ?? automateStep?.title}</code> will run on <b>{runbook.services[0] ?? "unknown-host"}</b>. Admin permission: <b>{MOCK_ADMIN_PERMISSION ? "granted (mock)" : "denied"}</b>. In production this executes via the backend with a full audit trail.</DialogDescription>
          </DialogHeader>
          {automateOutput.length > 0 && (
            <pre className="max-h-48 overflow-y-auto rounded-lg border border-border bg-slate-900 p-2.5 font-mono text-[0.6875rem] leading-relaxed text-emerald-300" aria-live="polite">{automateOutput.join("\n")}</pre>
          )}
          <DialogFooter className="gap-2">
            {!automateRunning && automateOutput.length === 0 && (
              <>
                <Button variant="outline" className="h-9 rounded-lg px-4 text-[0.8125rem]" onClick={() => { setAutomateStep(null); setAutomateOutput([]); }}>Cancel</Button>
                <Button className="h-9 gap-1.5 rounded-lg px-4 text-[0.8125rem] font-semibold" onClick={confirmAutomatedRun}><Play size={14} aria-hidden />Run now</Button>
              </>
            )}
            {automateOutput.length > 0 && !automateRunning && (
              <Button className="h-9 rounded-lg px-4 text-[0.8125rem] font-semibold" onClick={() => { if (automateStep) completeStep(automateStep.id); setAutomateStep(null); setAutomateOutput([]); }}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[1200] rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">{toast.message}</div>}
    </div>
  );
}

function RollbackChecklistItem({ step, index, onToast }: { step: RunbookStep; index: number; onToast: (message: string) => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <li className={cn("rounded-lg border p-3", checked ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5" : "border-border")}>
      <label className="flex cursor-pointer items-start gap-2">
        <input type="checkbox" checked={checked} onChange={(event) => { setChecked(event.target.checked); if (event.target.checked) onToast(`Rollback step ${index + 1} marked done.`); }} className="mt-0.5 h-4 w-4 accent-[#16A34A]" />
        <span className="min-w-0"><span className="block text-[0.8125rem] font-semibold text-foreground">{index + 1}. {step.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{step.description}</span>{step.command && <pre className="mt-1.5 overflow-x-auto rounded border border-border bg-slate-900 p-2 font-mono text-[0.6875rem] text-slate-100"><code>{step.command}</code></pre>}</span>
      </label>
    </li>
  );
}
