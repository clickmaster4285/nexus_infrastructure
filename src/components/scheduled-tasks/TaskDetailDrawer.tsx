"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  CalendarClock, Check, ClipboardList, Copy, FileText, Hand, HardDriveDownload, History, Mail, Pencil, Play, Pause, RotateCcw, Timer, Users, X, Zap,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { EnvironmentBadge, RunStatusBadge, SkippedMaintenanceBadge, TaskTypeBadge, EnabledBadge } from "@/components/scheduled-tasks/task-badges";
import { RunLogViewer } from "@/components/shared/run-log-viewer";
import { useTaskRuns } from "@/hooks/useTaskRuns";
import { BUILTIN_ACTIONS, CURRENT_USER_NAME, type ScheduledTask } from "@/mocks/scheduledTasks";
import { TASK_ID_TO_BACKUP_JOB } from "@/mocks/backups";
import { timeAgo } from "@/mocks/logs";
import { formatScheduleLong } from "@/utils/formatSchedule";
import { formatDuration } from "@/utils/taskStats";

import type { TaskRun } from "@/mocks/taskRuns";

interface TaskDetailDrawerProps {
  task: ScheduledTask | null;
  onClose: () => void;
  onRunNow: (task: ScheduledTask) => void;
  onToggle: (task: ScheduledTask) => void;
  onEdit: (task: ScheduledTask) => void;
  onRetry: (taskId: string) => void;
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-[0.75rem] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-[0.75rem] font-medium text-foreground">{children}</dd>
    </div>
  );
}

/** 32.5rem right-hand drawer with summary, run history (last 10), duration trend and audit log. */
export function TaskDetailDrawer({ task, onClose, onRunNow, onToggle, onEdit, onRetry }: TaskDetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const runs = useTaskRuns(task?.id ?? null);
  const [logRun, setLogRun] = useState<TaskRun | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!task) return;
    drawerRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusables = drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [task, onClose]);

  useEffect(() => { setLogRun(null); setCopied(false); }, [task?.id]);

  if (!task) return null;

  const lastTen = runs.slice(0, 10);
  const durationSeries = runs
    .filter((run) => run.durationMs != null)
    .slice(0, 20)
    .reverse()
    .map((run, index) => ({ index: index + 1, seconds: Math.round((run.durationMs ?? 0) / 1000), label: new Date(run.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) }));

  const builtinLabel = task.execution.mode === "builtin"
    ? BUILTIN_ACTIONS.find((action) => action.value === task.execution.builtin)?.label ?? task.execution.builtin
    : null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/scheduled-tasks?task=${task.id}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return createPortal(
    <>
      <div aria-hidden="true" className="fixed inset-0 z-[1290] bg-slate-950/40" onClick={onClose} />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-drawer-title"
        className="animate-drawer-in fixed inset-y-0 right-0 z-[1300] flex w-full flex-col border-l border-border bg-card shadow-2xl sm:w-[32.5rem]"
      >
        <div className="shrink-0 border-b border-border px-5 pb-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="task-drawer-title" className="font-display truncate text-base font-bold leading-snug tracking-tight text-foreground" title={task.name}>
                {task.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <TaskTypeBadge type={task.type} />
                <EnabledBadge enabled={task.enabled} />
                <EnvironmentBadge environment={task.target.environment} />
              </div>
            </div>
            <button
              type="button"
              data-autofocus
              onClick={onClose}
              aria-label="Close task details"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <button
            type="button"
            onClick={copyLink}
            aria-label={`Copy link to task ${task.id}`}
            className="mt-1 inline-flex items-center gap-1 rounded text-[0.6875rem] font-mono text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {task.id}
            {copied ? <Check size={11} aria-hidden className="text-green-600" /> : <Copy size={11} aria-hidden />}
          </button>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Button size="sm" onClick={() => onRunNow(task)} className="h-8 gap-1.5 text-[0.75rem]"><Zap size={13} aria-hidden />Run now</Button>
            <Button size="sm" variant="outline" onClick={() => onToggle(task)} className="h-8 gap-1.5 text-[0.75rem]">
              {task.enabled ? <><Pause size={13} aria-hidden />Pause</> : <><Play size={13} aria-hidden />Resume</>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onEdit(task)} className="h-8 gap-1.5 text-[0.75rem]"><Pencil size={13} aria-hidden />Edit</Button>
            {task.type === "backup" && TASK_ID_TO_BACKUP_JOB[task.id] && (
              <Link
                href={`/backups-and-recovery?backup=${TASK_ID_TO_BACKUP_JOB[task.id]}`}
                className="inline-flex h-8 items-center gap-1.5 rounded px-1 text-[0.75rem] font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <HardDriveDownload size={13} aria-hidden />View in Backups
              </Link>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Summary */}
          <section aria-label="Task summary">
            <h3 className="mb-1 flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground"><CalendarClock size={11} aria-hidden />Summary</h3>
            <dl className="divide-y divide-border/60">
              <SummaryRow label="Schedule">{formatScheduleLong(task.schedule)}</SummaryRow>
              <SummaryRow label="Timezone"><span className="font-mono text-[0.6875rem]">{task.schedule.timeZone}</span></SummaryRow>
              <SummaryRow label="Target">
                <span className="flex flex-wrap justify-end gap-1">
                  {task.target.hosts.map((host) => (
                    <span key={host} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.625rem]">{host}</span>
                  ))}
                  {task.target.groups.map((group) => (
                    <span key={group} className="rounded border border-border bg-card px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">{group}</span>
                  ))}
                  {task.target.hosts.length === 0 && task.target.groups.length === 0 && "Global scope"}
                </span>
              </SummaryRow>
              <SummaryRow label="Owner">
                <span className="inline-flex items-center gap-1.5">
                  <InitialsAvatar name={task.owner} size={18} />
                  {task.owner}
                </span>
              </SummaryRow>
              <SummaryRow label="Action">{task.execution.mode === "builtin" ? builtinLabel : <span className="font-mono text-[0.625rem]">{task.execution.command}</span>}</SummaryRow>
              <SummaryRow label="Retries">{task.execution.retries}</SummaryRow>
              <SummaryRow label="Timeout">{task.execution.timeoutMinutes}m</SummaryRow>
              <SummaryRow label="Concurrency">{task.execution.concurrency === "skip" ? "Skip if previous run active" : "Queue after previous run"}</SummaryRow>
              <SummaryRow label="Notify">
                <span className="inline-flex items-center gap-1.5"><Mail size={11} aria-hidden className="text-muted-foreground" />{task.notifications.channels.join(", ") || "None"}<span className="text-muted-foreground">· {task.notifications.recipients.length} recipient{task.notifications.recipients.length === 1 ? "" : "s"}</span></span>
              </SummaryRow>
            </dl>
          </section>

          {/* Run history */}
          <section aria-label="Run history" className="mt-4">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground"><History size={11} aria-hidden />Run History</h3>
              <span className="text-[0.625rem] tabular-nums text-muted-foreground">last {lastTen.length} of {runs.length}</span>
            </div>
            {lastTen.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-[0.75rem] text-muted-foreground">No runs yet{task.enabled ? " — runs on the next schedule." : "."}</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full table-fixed text-left text-[0.6875rem]">
                  <colgroup><col style={{ width: "24%" }} /><col style={{ width: "28%" }} /><col style={{ width: "17%" }} /><col style={{ width: "13%" }} /><col style={{ width: "18%" }} /></colgroup>
                  <thead>
                    <tr className="bg-muted/40 text-[0.5625rem] font-bold uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="px-2 py-1.5">Status</th>
                      <th scope="col" className="px-2 py-1.5">Started</th>
                      <th scope="col" className="px-2 py-1.5">Duration</th>
                      <th scope="col" className="px-2 py-1.5">Source</th>
                      <th scope="col" className="px-2 py-1.5 text-right">Log</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastTen.map((run) => (
                      <tr key={run.id} className="border-t border-border/60 align-middle">
                        <td className="px-2 py-1.5">
                          {run.maintenance && run.status === "skipped" ? <SkippedMaintenanceBadge /> : <RunStatusBadge status={run.status} />}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-muted-foreground" title={new Date(run.startedAt).toLocaleString()}>{timeAgo(run.epochMs)}</td>
                        <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{formatDuration(run.durationMs)}</td>
                        <td className="px-2 py-1.5">
                          <span className="inline-flex items-center gap-1 text-muted-foreground" title={run.triggeredBy === "manual" ? "Manual trigger" : "Scheduled"}>
                            {run.triggeredBy === "manual" ? <Hand size={11} aria-hidden /> : <CalendarClock size={11} aria-hidden />}
                            {run.triggeredBy === "manual" ? "Manual" : "Sched"}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <span className="inline-flex items-center gap-0.5">
                            {run.status === "failed" && (
                              <button type="button" onClick={() => onRetry(task.id)} aria-label="Retry this run" title="Retry" className="grid h-7 w-7 place-items-center rounded text-amber-600 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-amber-500/10">
                                <RotateCcw size={12} aria-hidden />
                              </button>
                            )}
                            <button type="button" onClick={() => setLogRun(run)} aria-label="View log" title="View log" className="grid h-7 w-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              <FileText size={12} aria-hidden />
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Duration trend */}
          {durationSeries.length >= 3 && (
            <section aria-label="Duration trend" className="mt-4">
              <h3 className="mb-1 flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground"><Timer size={11} aria-hidden />Duration Trend</h3>
              <div className="h-[6.875rem] w-full rounded-lg border border-border p-1.5" role="img" aria-label="Duration of the last 20 runs in seconds">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={durationSeries} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                    <YAxis width={30} tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} unit="s" />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "0.0625rem solid var(--border)", background: "var(--popover)", fontSize: 11 }}
                      labelStyle={{ color: "var(--foreground)", fontWeight: 700 }}
                      formatter={(value: number) => [`${value}s`, "Duration"]}
                    />
                    <Line type="monotone" dataKey="seconds" stroke="#3B82F6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Audit log */}
          <section aria-label="Audit log" className="mt-4 pb-1">
            <h3 className="mb-1 flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground"><ClipboardList size={11} aria-hidden />Audit Log</h3>
            <ol className="space-y-0">
              {[...task.audit].sort((a, b) => b.epochMs - a.epochMs).slice(0, 8).map((entry, index, array) => (
                <li key={entry.id} className="relative flex gap-2.5 pb-3 last:pb-0">
                  {index < array.length - 1 && <span aria-hidden className="absolute left-[0.1875rem] top-3.5 h-full w-px bg-border" />}
                  <span aria-hidden className="relative mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400 ring-2 ring-card" />
                  <div className="min-w-0">
                    <p className="text-[0.75rem] leading-snug text-foreground">
                      <span className="font-semibold">{entry.actor === CURRENT_USER_NAME ? "You" : entry.actor}</span>
                      <span className="text-muted-foreground"> · {entry.action}</span>
                    </p>
                    <p className="truncate text-[0.6875rem] text-muted-foreground" title={entry.detail}>{entry.detail}</p>
                    <p className="text-[0.625rem] tabular-nums text-muted-foreground/80">{timeAgo(entry.epochMs)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-2.5 text-[0.625rem] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Users size={11} aria-hidden />Created by {task.createdBy === CURRENT_USER_NAME ? "you" : task.createdBy} · {new Date(task.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
          <span className="font-mono">{task.id}</span>
        </div>
      </div>

      <RunLogViewer
        open={logRun != null}
        onOpenChange={(open) => { if (!open) setLogRun(null); }}
        title={logRun?.id ?? "run"}
        subtitle={task.name}
        badge={logRun ? <RunStatusBadge status={logRun.status} /> : undefined}
        meta={logRun ? [
          new Date(logRun.startedAt).toLocaleString(),
          formatDuration(logRun.durationMs),
          logRun.triggeredBy === "manual" ? "manual trigger" : "scheduled",
        ] : []}
        content={logRun?.log ?? ""}
      />
    </>,
    document.body,
  );
}
