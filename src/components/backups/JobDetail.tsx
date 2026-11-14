"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, Link2, PlayCircle, Pencil, ArchiveRestore, ShieldCheck,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { BackupStatusBadge, BackupTypeBadge, VerifiedBadge, MetBadge } from "@/components/backups/backup-badges";
import { LocationCell } from "@/components/backups/location-meta";
import { RunLogViewer } from "@/components/shared/run-log-viewer";
import { TestRestoreWizard } from "@/components/backups/TestRestoreWizard";
import { BackupPolicyDrawer } from "@/components/backups/BackupPolicyDrawer";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { timeAgo } from "@/mocks/logs";
import { getBackupsSnapshot } from "@/mocks/backups";
import { getRunbookForRule } from "@/mocks/runbooks";
import { readIncidentStore } from "@/mocks/incidents";
import { SAMPLE_ALERTS } from "@/mocks/alerts";
import { getBackupRunsSnapshot } from "@/mocks/backupRuns";
import { useRestorePoints, useRestoreOperations } from "@/hooks/useRestorePoints";
import { useBackups, DEFAULT_BACKUPS_FILTERS } from "@/hooks/useBackups";
import { deriveBackupViews } from "@/utils/backupStats";
import { formatSchedule } from "@/utils/formatSchedule";
import { cronForSchedule } from "@/utils/formatSchedule";
import { formatDuration, formatCountdown } from "@/utils/backupStats";
import { formatLag, formatRpoCell } from "@/utils/rpoCalc";
import { formatBytes } from "@/utils/storageForecast";
import { nextRuns } from "@/utils/nextRun";
import { cn } from "@/lib/utils";

const SEVERITY_TONE: Record<string, string> = {
  critical: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-muted-foreground",
};

export function JobDetail({ jobId }: { jobId: string }) {
  const router = useRouter();
  const allJobs = useMemo(() => getBackupsSnapshot(), []);
  const job = useMemo(() => allJobs.find((entry) => entry.id === jobId) ?? null, [allJobs, jobId]);
  const jobRuns = useMemo(() => getBackupRunsSnapshot().filter((run) => run.jobId === jobId).sort((a, b) => b.epochMs - a.epochMs), [jobId]);
  const allRuns = useMemo(() => getBackupRunsSnapshot(), []);
  const views = useMemo(() => deriveBackupViews(allJobs, allRuns), [allJobs, allRuns]);
  const points = useRestorePoints(job?.host ?? null);
  const operations = useRestoreOperations();
  const { recordDrill, updatePolicy } = useBackups(DEFAULT_BACKUPS_FILTERS);
  const [logRunId, setLogRunId] = useState<string | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const alerts = useMemo(() => SAMPLE_ALERTS.filter((alert) => alert.host === job?.host && alert.severity !== "info").slice(0, 4), [job?.host]);
  const incidents = useMemo(() => readIncidentStore().filter((incident) => incident.affectedHosts.includes(job?.host ?? "")).slice(0, 4), [job?.host]);

  if (!job) {
    return (
      <div className="mx-auto grid min-h-[20rem] max-w-xl place-items-center rounded-xl border border-border bg-card p-8 text-center">
        <div>
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-3 font-display text-base font-bold text-foreground">Job not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">No backup job with id <span className="font-mono">{jobId}</span> exists, or it was deleted.</p>
          <Button variant="outline" className="mt-4 h-10 rounded-lg px-4 text-sm" onClick={() => router.push("/backups-and-recovery")}>Back to Backups &amp; Recovery</Button>
        </div>
      </div>
    );
  }

  const view = views.get(job.id);
  const lastRun = view?.lastRun ?? null;
  const running = view?.runningRun ?? null;
  const status = !job.enabled ? "paused" : running ? "running" : lastRun?.status ?? "success";
  const failed = status === "failed";
  const next = nextRuns(job.schedule, Date.now(), 3);
  const avgDurationMs = view?.avgDurationMs ?? null;
  const successRate = view?.successRate7d ?? null;
  const jobIndex = allJobs.findIndex((entry) => entry.id === job.id);
  const prevJob = jobIndex > 0 ? allJobs[jobIndex - 1] : null;
  const nextJob = jobIndex < allJobs.length - 1 ? allJobs[jobIndex + 1] : null;
  const logRun = logRunId ? jobRuns.find((run) => run.id === logRunId) ?? null : null;

  return (
    <div className="min-w-0 overflow-x-hidden space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Operations", "Backups & Recovery", job.id]}
        title={job.name}
        subtitle={`Asset ${job.host} · owner ${job.owner} · ${job.id}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {job.taskId && (
              <Link href="/scheduled-tasks?type=backup" className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-primary hover:underline">
                <Link2 size={13} aria-hidden="true" />{job.taskId}
              </Link>
            )}
            <Button variant="outline" className="h-9 gap-1.5 rounded-lg px-3 text-[0.8125rem]" onClick={() => setRestoreOpen(true)}><ArchiveRestore size={14} aria-hidden="true" />Restore</Button>
            <Button variant="outline" className="h-9 gap-1.5 rounded-lg px-3 text-[0.8125rem]" onClick={() => setPolicyOpen(true)}><Pencil size={14} aria-hidden="true" />Edit</Button>
            <Button className="h-9 gap-1.5 rounded-lg px-3 text-[0.8125rem] font-semibold" onClick={() => router.push(`/backups-and-recovery?tab=jobs&q=${job.id}`)}>
              <PlayCircle size={14} aria-hidden="true" />Run now
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Job {jobIndex + 1} of {allJobs.length}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 gap-1 rounded-lg px-2 text-xs" disabled={!prevJob} onClick={() => prevJob && router.push(`/backups-and-recovery/jobs/${encodeURIComponent(prevJob.id)}`)} aria-label="Previous job"><ChevronLeft size={14} aria-hidden="true" />Prev</Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1 rounded-lg px-2 text-xs" disabled={!nextJob} onClick={() => nextJob && router.push(`/backups-and-recovery/jobs/${encodeURIComponent(nextJob.id)}`)} aria-label="Next job">Next<ChevronRight size={14} aria-hidden="true" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <div className="min-w-0 space-y-4 xl:col-span-8">
          {/* Overview */}
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-label="Overview">
            <div className="flex flex-wrap items-center gap-2">
              <BackupStatusBadge status={status} />
              <BackupTypeBadge type={job.type} />
              <MetBadge met={view?.rpoMet ?? true} />
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">{job.policyId === "POL-critical" ? "POL-critical · RPO 4h" : "POL-standard · RPO 24h"}</span>
              {job.taskId && <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">{job.taskId}</span>}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <dt className="text-muted-foreground">Asset</dt>
              <dd className="flex justify-end"><Link href={`/server-details/${encodeURIComponent(job.host)}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"><span className="font-mono">{job.host}</span><ExternalLink size={11} aria-hidden="true" /></Link></dd>
              <dt className="text-muted-foreground">Group</dt><dd className="text-right text-foreground">{job.group ?? "Ungrouped"}</dd>
              <dt className="text-muted-foreground">Owner</dt><dd className="flex items-center justify-end gap-1.5 text-foreground"><InitialsAvatar name={job.owner} size={16} /><span className="truncate">{job.owner}</span></dd>
              <dt className="text-muted-foreground">Schedule</dt><dd className="text-right font-medium tabular-nums text-foreground" title={cronForSchedule(job.schedule)}>{formatSchedule(job.schedule)}</dd>
              <dt className="text-muted-foreground">Timezone</dt><dd className="text-right font-mono text-muted-foreground">{job.schedule.timeZone}</dd>
              <dt className="text-muted-foreground">Retention</dt><dd className="text-right text-foreground">Keep {job.retentionDays} days</dd>
              <dt className="text-muted-foreground">Destination</dt><dd className="flex justify-end"><LocationCell poolId={job.poolId} /></dd>
              <dt className="text-muted-foreground">Immutability</dt><dd className="text-right text-foreground">{job.immutable ? "WORM enabled" : "Disabled"}</dd>
              <dt className="text-muted-foreground">Encryption</dt><dd className="text-right font-mono text-foreground">AES-256</dd>
            </dl>
          </section>

          {/* Run history */}
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-label="Run history">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Run history</h3>
              <p className="text-xs tabular-nums text-muted-foreground">Last {Math.min(10, jobRuns.length)} runs · success rate {successRate == null ? "—" : `${successRate}%`} · avg {formatDuration(avgDurationMs)}</p>
            </div>
            <ul className="mt-2 divide-y divide-border/60">
              {jobRuns.slice(0, 10).map((run) => (
                <li key={run.id} className="py-1.5">
                  <button
                    type="button"
                    onClick={() => setLogRunId((cur) => (cur === run.id ? null : run.id))}
                    aria-expanded={logRunId === run.id}
                    className="flex w-full items-center gap-2 rounded px-1 py-1 text-left transition-colors hover:bg-slate-50 dark:hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <BackupStatusBadge status={run.status} />
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {timeAgo(run.epochMs)} · {run.status === "skipped" ? "—" : formatBytes(run.sizeBytes)} · {run.status === "running" ? "in progress" : formatDuration(run.durationMs)}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-primary">{logRunId === run.id ? "Hide log" : "Log"}</span>
                  </button>
                  {logRunId === run.id && (
                    <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-border bg-[oklch(0.1831_0.0309_263.38)] p-3 font-mono text-[0.6875rem] leading-[1.7] text-slate-200">{run.log}</pre>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* Restore points */}
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-label="Restore points">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Restore points</h3>
              <button type="button" onClick={() => setRestoreOpen(true)} className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Restore from point…</button>
            </div>
            <ul className="mt-2 divide-y divide-border/60">
              {points.slice(0, 5).map((point) => (
                <li key={point.id} className="flex items-center gap-2 py-1.5 text-xs">
                  <span className="font-mono text-muted-foreground">{point.id}</span>
                  <span className="min-w-0 truncate text-muted-foreground">{timeAgo(point.epochMs)} · {formatBytes(point.sizeBytes)}</span>
                  <span className="ml-auto shrink-0"><VerifiedBadge verified={point.verified} /></span>
                </li>
              ))}
              {points.length === 0 && <li className="py-3 text-center text-xs text-muted-foreground">No restore points yet — created only by successful runs.</li>}
            </ul>
          </section>
        </div>

        {/* Right rail */}
        <div className="min-w-0 space-y-4 xl:col-span-4">
          {/* Status / RPO */}
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-label="Status and RPO">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Status &amp; RPO</h3>
              <BackupStatusBadge status={status} />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <dt className="text-muted-foreground">RPO</dt>
              <dd className={cn("text-right font-semibold tabular-nums", view?.rpoMet === false ? "text-red-600 dark:text-red-400" : "text-foreground")}>{formatRpoCell(view?.rpoLagMinutes ?? null, job.rpoTargetMinutes)}</dd>
              <dt className="text-muted-foreground">Last success</dt><dd className="text-right tabular-nums text-foreground">{view?.lastSuccessMs ? timeAgo(view.lastSuccessMs) : "never"}</dd>
              <dt className="text-muted-foreground">Last run</dt><dd className="text-right tabular-nums text-foreground">{view?.lastRun ? timeAgo(view.lastRun.epochMs) : "never"}</dd>
              <dt className="text-muted-foreground">Next run</dt><dd className="text-right tabular-nums text-foreground">{job.enabled ? (next[0] != null ? formatCountdown(next[0]) : "—") : "Paused"}</dd>
            </dl>
            {failed && lastRun?.error && (
              <p role="alert" className="mt-3 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                {lastRun.error}
              </p>
            )}
            {!job.enabled && <p className="mt-3 text-xs text-muted-foreground">Job is paused — no new runs until resumed.</p>}
          </section>

          {/* Linked alerts */}
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-label="Linked alerts">
            <h3 className="text-sm font-semibold text-foreground">Linked alerts</h3>
            <ul className="mt-2 divide-y divide-border/60">
              {alerts.map((alert) => (
                <li key={alert.id} className="flex items-center gap-2 py-1.5 text-xs">
                  <span className={cn("w-14 shrink-0 font-semibold capitalize", SEVERITY_TONE[alert.severity] ?? "text-muted-foreground")}>{alert.severity}</span>
                  <span className="min-w-0 truncate text-foreground">{alert.ruleName}</span>
                  <Link href="/alerts" className="ml-auto shrink-0 font-semibold text-primary hover:underline">Open</Link>
                </li>
              ))}
              {alerts.length === 0 && <li className="py-2 text-xs text-muted-foreground">No active alerts for this host.</li>}
            </ul>
            <Link href="/alert-rules" className="mt-2 inline-flex text-xs font-semibold text-primary hover:underline">Rule RUL-212 · Backup job failed →</Link>
          </section>

          {/* Linked incidents */}
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-label="Linked incidents">
            <h3 className="text-sm font-semibold text-foreground">Linked incidents</h3>
            <ul className="mt-2 divide-y divide-border/60">
              {incidents.map((incident) => (
                <li key={incident.id} className="flex items-center gap-2 py-1.5 text-xs">
                  <span className="w-14 shrink-0 font-semibold text-amber-600">{incident.severity}</span>
                  <span className="min-w-0 truncate text-foreground" title={incident.title}>{incident.title}</span>
                  <Link href="/incidents" className="ml-auto shrink-0 font-semibold text-primary hover:underline">Open</Link>
                </li>
              ))}
              {incidents.length === 0 && <li className="py-2 text-xs text-muted-foreground">No incidents reference this host.</li>}
            </ul>
          </section>

          {/* Runbook */}
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-label="Runbook">
            <h3 className="text-sm font-semibold text-foreground">Runbook</h3>
            {(() => {
              const linked = getRunbookForRule("RUL-212");
              return (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">RUL-212 · Backup job failed{linked ? `: ${linked.title}` : ": verify restore integrity, check storage permissions and agent heartbeat."}</p>
                  <Link href={linked ? `/runbooks/${linked.id}` : "/runbooks/new?rule=RUL-212"} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Open runbook{linked ? ` ${linked.id}` : ""} →</Link>
                </>
              );
            })()}
          </section>

          {/* Next runs */}
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-label="Next runs">
            <h3 className="text-sm font-semibold text-foreground">Next runs</h3>
            <ul className="mt-2 divide-y divide-border/60 text-xs">
              {next.map((ms) => (
                <li key={ms} className="flex items-center justify-between gap-2 py-1.5 tabular-nums text-muted-foreground">
                  <span>{new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(ms)}</span>
                  <span>{formatCountdown(ms)}</span>
                </li>
              ))}
              {!job.enabled && <li className="py-1.5 text-xs text-muted-foreground">Paused — resume to schedule runs.</li>}
            </ul>
          </section>
        </div>
      </div>

      {/* Test restore wizard */}
      <TestRestoreWizard
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        defaultHost={job.host}
        initialPointId={null}
        points={points}
        jobsById={new Map([[job.id, job]])}
        onComplete={(result) => {
          recordDrill({ host: result.host, assetName: result.assetName, durationMin: result.durationMin, rtoTargetMin: result.rtoTargetMin, result: result.result, executedBy: "you@nexus.io" });
        }}
      />

      {/* Policy editor */}
      {policyOpen && (
        <BackupPolicyDrawer
          job={job}
          onClose={() => setPolicyOpen(false)}
          onSave={(jobId, input, saveAndEnable) => {
            updatePolicy(jobId, input, saveAndEnable);
            setPolicyOpen(false);
          }}
        />
      )}

      {/* Log viewer */}
      {logRun && (
        <RunLogViewer
          open={logRunId != null}
          onOpenChange={(open) => { if (!open) setLogRunId(null); }}
          title={logRun.id}
          subtitle={job.name}
          badge={<BackupStatusBadge status={logRun.status} />}
          meta={[timeAgo(logRun.epochMs), logRun.triggeredBy === "manual" ? "manual trigger" : "scheduled", logRun.status === "running" ? "in progress" : formatDuration(logRun.durationMs)]}
          content={logRun.log}
        />
      )}
    </div>
  );
}
