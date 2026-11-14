"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen, ChevronLeft, ChevronRight, Clipboard, ChevronDown as ChevronDownIcon, ChevronsDownUp, ChevronsUpDown, CircleCheck,
  ExternalLink, ListChecks, MoreVertical, Pencil, Play, ThumbsDown, ThumbsUp, History,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/logs/primitives";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { TechLogo } from "@/components/shared/icon";
import {
  ExecutionResultBadge, RunbookSeverityBadge, RunbookStatusBadge, RunbookStepTypeBadge, RUNBOOK_STEP_TYPE_META,
} from "@/components/shared/runbook-badges";
import { formatDate, formatDateTime, formatDurationMs, formatMinutes, timeAgo } from "@/components/shared/runbook-format";
import {
  archiveRunbooks, executionsForRunbook, getRunbookById, getRunbookSnapshot, markRunbookReviewed, recordHelpful, duplicateRunbook,
  type Runbook, type RunbookStep,
} from "@/mocks/runbooks";
import { readIncidentStore } from "@/mocks/incidents";
import { cn } from "@/lib/utils";

function CopyButton({ text, ariaLabel, onCopied }: { text: string; ariaLabel: string; onCopied: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md border border-border/60 bg-card/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => {
        try {
          void navigator.clipboard?.writeText(text).then(onCopied, onCopied);
        } catch {
          onCopied();
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <CircleCheck size={13} aria-hidden /> : <Clipboard size={13} aria-hidden />}
    </button>
  );
}

function StepCard({ step, index, anchorPrefix, onToast }: { step: RunbookStep; index: number; anchorPrefix: string; onToast: (message: string) => void }) {
  const meta = RUNBOOK_STEP_TYPE_META[step.type];
  const Icon = meta.icon;
  const isWarning = step.type === "Warning";
  return (
    <li id={`${anchorPrefix}-${step.id}`} className={cn("scroll-mt-24 rounded-xl border p-3", isWarning ? "border-amber-300 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5" : "border-border bg-card")}>
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-[0.75rem] font-bold tabular-nums text-muted-foreground">{index + 1}</span>
        <h3 className="min-w-0 flex-1 text-[0.8125rem] font-bold leading-snug text-foreground">{step.title}</h3>
        <RunbookStepTypeBadge type={step.type} />
        <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">{step.estimatedMinutes}m</span>
        <a href={`#${anchorPrefix}-${step.id}`} aria-label="Anchor link to this step" className="shrink-0 rounded text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">#</a>
      </div>
      <p className="mt-1.5 pl-9 text-xs leading-snug text-muted-foreground">{step.description}</p>
      {step.command && (
        <div className="relative mt-2 pl-9">
          <pre className="overflow-x-auto rounded-lg border border-border bg-slate-900 p-2.5 font-mono text-[0.75rem] leading-relaxed text-slate-100"><code>{step.command}</code></pre>
          <CopyButton text={step.command} ariaLabel={`Copy command for step ${index + 1}`} onCopied={() => onToast("Command copied to clipboard.")} />
          {step.expectedOutput && (
            <p className="mt-1.5 text-[0.6875rem] leading-snug text-muted-foreground"><span className="font-semibold text-foreground/80">Expected: </span>{step.expectedOutput}</p>
          )}
        </div>
      )}
      {!step.command && step.expectedOutput && (
        <p className="mt-1.5 pl-9 text-[0.6875rem] leading-snug text-muted-foreground"><span className="font-semibold text-foreground/80">Expected: </span>{step.expectedOutput}</p>
      )}
      {isWarning && (
        <p className="mt-2 flex items-start gap-1.5 pl-9 text-[0.75rem] font-semibold text-amber-800 dark:text-amber-300"><TriangleIcon />Stop and read — this step carries a risk.</p>
      )}
    </li>
  );
}
const TriangleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0"><path d="M12 3 2.5 20h19L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M12 10v4.5M12 17.4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
);

function SectionSteps({ title, steps, anchorPrefix, collapsed, onToggleAll, onToast, emptyHint }: {
  title: string; steps: RunbookStep[]; anchorPrefix: string; collapsed: boolean;
  onToggleAll: (collapse: boolean) => void; onToast: (message: string) => void; emptyHint: string;
}) {
  if (steps.length === 0) {
    return <section aria-label={title} className="rounded-xl border border-border bg-card p-4"><h2 className="text-sm font-bold text-foreground">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p></section>;
  }
  return (
    <section aria-label={title} className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground">{title} <span className="ml-1 text-xs font-semibold tabular-nums text-muted-foreground">{steps.length} steps</span></h2>
        <button type="button" onClick={() => onToggleAll(!collapsed)} className="inline-flex items-center gap-1 rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {collapsed ? <ChevronsUpDown size={13} aria-hidden /> : <ChevronsDownUp size={13} aria-hidden />}{collapsed ? "Expand all" : "Collapse all"}
        </button>
      </div>
      {!collapsed && <ol className="space-y-2">{steps.map((step, index) => <StepCard key={step.id} step={step} index={index} anchorPrefix={anchorPrefix} onToast={onToast} />)}</ol>}
    </section>
  );
}

export function RunbookDetail({ runbookId }: { runbookId: string }) {
  const router = useRouter();
  const [, forceRender] = useState(0);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [feedback, setFeedback] = useState<"yes" | "no" | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ steps: false, rollback: false, verification: false, history: false });
  const toastTimer = useMemo(() => ({ current: null as number | null }), []);

  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, [toastTimer]);
  const showToast = (message: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message });
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  };

  const runbook = getRunbookById(runbookId) ?? null;
  const allRunbooks = useMemo(() => getRunbookSnapshot(), [runbook]);
  const executions = useMemo(() => (runbook ? executionsForRunbook(runbook.id).sort((a, b) => b.epochMs - a.epochMs) : []), [runbook]);
  const avgDurationMs = useMemo(() => {
    const durations = executions.map((execution) => execution.durationMs).filter((value): value is number => value != null);
    return durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
  }, [executions]);
  const successPct = executions.length > 0 ? Math.round((executions.filter((execution) => execution.result === "Completed").length / executions.length) * 100) : null;
  const linkedIncidents = useMemo(() => {
    if (!runbook) return [];
    const ids = new Set(executions.map((execution) => execution.incidentId).filter((id): id is string => Boolean(id)));
    return readIncidentStore().filter((incident) => ids.has(incident.id)).slice(0, 4);
  }, [runbook, executions]);

  if (!runbook) {
    return (
      <div className="mx-auto grid min-h-[20rem] max-w-xl place-items-center rounded-xl border border-border bg-card p-8 text-center">
        <div>
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-3 font-display text-base font-bold text-foreground">Runbook not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">No runbook with id <span className="font-mono">{runbookId}</span> exists, or it was archived out of the mock store.</p>
          <Button variant="outline" className="mt-4 h-10 rounded-lg px-4 text-sm" onClick={() => router.push("/runbooks")}>Back to Runbooks</Button>
        </div>
      </div>
    );
  }

  const index = allRunbooks.findIndex((entry) => entry.id === runbook.id);
  const prevRunbook = index > 0 ? allRunbooks[index - 1] : null;
  const nextRunbook = index < allRunbooks.length - 1 ? allRunbooks[index + 1] : null;
  const daysSinceReview = Math.floor((Date.now() - new Date(runbook.lastReviewedAt).getTime()) / 86_400_000);
  const helpfulTotal = runbook.helpfulCount + runbook.notHelpfulCount;
  const helpfulPct = helpfulTotal > 0 ? Math.round((runbook.helpfulCount / helpfulTotal) * 100) : null;
  const lastUpdated = new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const copyLink = () => {
    const url = `${window.location.origin}/runbooks/${runbook.id}`;
    try { void navigator.clipboard?.writeText(url).then(() => showToast("Link copied."), () => showToast(url)); } catch { showToast(url); }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={["Operations", "Runbooks", runbook.title]}
        title={runbook.title}
        subtitle={`${runbook.id} · v${runbook.version} · ${runbook.category}`}
        lastUpdated={`${lastUpdated} · ${tz}`}
        onRefresh={() => forceRender((value) => value + 1)}
        statusBadge={<span className="flex flex-wrap items-center gap-1.5"><RunbookStatusBadge status={runbook.status} /><RunbookSeverityBadge severity={runbook.severity} /><span className="inline-flex h-6 items-center rounded border border-border px-2 text-xs font-semibold text-muted-foreground">{runbook.category}</span></span>}
        actions={
          <div className="flex h-10 shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" asChild className="h-10 gap-1.5 rounded-lg px-3 text-sm"><Link href="/runbooks"><ChevronLeft size={15} aria-hidden />Back to Runbooks</Link></Button>
            <AlertMenu
              label="Runbook actions"
              align="end"
              width={210}
              trigger={<Button variant="outline" className="h-10 gap-1.5 rounded-lg px-3 text-sm"><MoreVertical size={15} aria-hidden />Actions</Button>}
              items={[
                { key: "duplicate", label: "Duplicate", onSelect: () => { const copy = duplicateRunbook(runbook.id); showToast(copy ? `Duplicated as ${copy.id}.` : "Duplicate failed."); } },
                { key: "review", label: "Mark reviewed", onSelect: () => { markRunbookReviewed(runbook.id); forceRender((value) => value + 1); showToast(`${runbook.id} marked as reviewed.`); } },
                { key: "archive", label: "Archive", danger: true, onSelect: () => { archiveRunbooks([runbook.id]); forceRender((value) => value + 1); showToast(`${runbook.id} archived.`); } },
                { key: "copy", label: "Copy link", onSelect: copyLink },
              ]}
            />
            <Button variant="outline" className="h-10 gap-1.5 rounded-lg px-3 text-sm" asChild><Link href={`/runbooks/${runbook.id}?mode=edit`}><Pencil size={15} aria-hidden />Edit</Link></Button>
            <Button className="h-10 gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90" asChild><Link href={`/runbooks/${runbook.id}?mode=run`}><Play size={15} aria-hidden />Run Runbook</Link></Button>
          </div>
        }
      />

      {/* Prev / next navigation */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Runbook {index + 1} of {allRunbooks.length}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 gap-1 rounded-lg px-2 text-xs" disabled={!prevRunbook} onClick={() => prevRunbook && router.push(`/runbooks/${prevRunbook.id}`)} aria-label="Previous runbook"><ChevronLeft size={14} aria-hidden />Prev</Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1 rounded-lg px-2 text-xs" disabled={!nextRunbook} onClick={() => nextRunbook && router.push(`/runbooks/${nextRunbook.id}`)} aria-label="Next runbook">Next<ChevronRight size={14} aria-hidden /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        {/* LEFT column */}
        <div className="min-w-0 space-y-4 xl:col-span-8">
          {/* Overview */}
          <section aria-label="Overview" className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold text-foreground">Overview</h2>
            <p className="mt-1.5 text-sm leading-snug text-foreground/90">{runbook.summary}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
              <dt><span className="text-muted-foreground">Estimated time</span><dd className="mt-0.5 font-semibold text-foreground">{formatMinutes(runbook.estimatedMinutes)}</dd></dt>
              <dt><span className="text-muted-foreground">Owner</span><dd className="mt-0.5 flex items-center gap-1.5 font-semibold text-foreground"><InitialsAvatar name={runbook.owner} size={18} />{runbook.owner}</dd></dt>
              <dt><span className="text-muted-foreground">Team</span><dd className="mt-0.5 font-semibold text-foreground">{runbook.team}</dd></dt>
              <dt><span className="text-muted-foreground">Version</span><dd className="mt-0.5 font-semibold tabular-nums text-foreground">v{runbook.version}</dd></dt>
              <dt className="col-span-2"><span className="text-muted-foreground">Last reviewed</span><dd className="mt-0.5 font-semibold text-foreground">{formatDateTime(runbook.lastReviewedAt)} <span className="font-normal text-muted-foreground">({daysSinceReview}d ago, every {runbook.reviewIntervalDays}d)</span></dd></dt>
              <dt className="col-span-2"><span className="text-muted-foreground">Updated</span><dd className="mt-0.5 font-semibold text-foreground">{formatDateTime(runbook.updatedAt)}</dd></dt>
            </dl>
            {runbook.prerequisites.length > 0 && (
              <>
                <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prerequisites</h3>
                <ul className="mt-1.5 space-y-1.5">
                  {runbook.prerequisites.map((item) => <li key={item} className="flex items-start gap-2 text-xs text-foreground/90"><CircleCheck size={13} aria-hidden className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />{item}</li>)}
                </ul>
              </>
            )}
          </section>

          {/* Steps */}
          <SectionSteps title="Steps" steps={runbook.steps} anchorPrefix="step" collapsed={collapsed.steps} onToggleAll={(collapse) => setCollapsed((current) => ({ ...current, steps: collapse }))} onToast={showToast} emptyHint="No steps yet — edit this runbook to add the remediation procedure." />

          {/* Rollback + Verification */}
          <SectionSteps title="Rollback" steps={runbook.rollback} anchorPrefix="rollback" collapsed={collapsed.rollback} onToggleAll={(collapse) => setCollapsed((current) => ({ ...current, rollback: collapse }))} onToast={showToast} emptyHint="No rollback procedure defined." />
          <SectionSteps title="Verification" steps={runbook.verification} anchorPrefix="verify" collapsed={collapsed.verification} onToggleAll={(collapse) => setCollapsed((current) => ({ ...current, verification: collapse }))} onToast={showToast} emptyHint="No verification steps defined." />

          {/* Version history */}
          <section aria-label="Version history" className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground"><History size={14} aria-hidden />Version history</h2>
              <button type="button" onClick={() => setCollapsed((current) => ({ ...current, history: !current.history }))} className="inline-flex items-center gap-1 rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronDownIcon size={13} aria-hidden className={cn("transition-transform", collapsed.history && "-rotate-90")} />{collapsed.history ? "Show" : "Hide"}</button>
            </div>
            {!collapsed.history && (
              <ol className="mt-2 space-y-0 border-l border-border pl-4">
                {[...runbook.history].sort((a, b) => b.version - a.version).map((entry) => (
                  <li key={entry.version} className="relative pb-3 last:pb-0">
                    <span aria-hidden="true" className="absolute -left-[1.3125rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                    <div className="flex flex-wrap items-baseline gap-x-2"><b className="text-[0.8125rem] tabular-nums text-foreground">v{entry.version}</b><span className="text-[0.6875rem] text-muted-foreground">{entry.by} · {formatDateTime(entry.at)}</span></div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{entry.note}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* RIGHT column - sticky */}
        <div className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:col-span-4">
          {/* Linked */}
          <ChartCard title="Linked" className="flex flex-col rounded-xl p-4" actions={<MoreVerticalMenu onToast={showToast} />}>
            <div className="space-y-3">
              <div>
                <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Alert rules</h3>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {runbook.linkedAlertRuleIds.map((ruleId) => (
                    <li key={ruleId}><Link href={`/alert-rules?rule=${ruleId}`} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 text-xs font-semibold tabular-nums text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{ruleId}<ExternalLink size={10} aria-hidden /></Link></li>
                  ))}
                  {runbook.linkedAlertRuleIds.length === 0 && <li className="text-xs text-muted-foreground">None linked.</li>}
                </ul>
              </div>
              {linkedIncidents.length > 0 && (
                <div>
                  <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Incidents</h3>
                  <ul className="mt-1 space-y-1">
                    {linkedIncidents.map((incident) => (
                      <li key={incident.id}><Link href={`/incidents/${incident.id}`} className="flex items-center gap-1.5 rounded text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="tabular-nums">{incident.id}</span><span className="truncate text-foreground/80">{incident.title}</span></Link></li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Services &amp; servers</h3>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {runbook.services.map((service) => (
                    <li key={service}><Link href={`/server-details/${service}`} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><TechLogo name={service} className="!h-4 !w-4 !rounded-sm [&_svg]:!h-2.5 [&_svg]:!w-2.5" />{service}</Link></li>
                  ))}
                </ul>
              </div>
            </div>
          </ChartCard>

          {/* On this page */}
          <nav aria-label="On this page" className="rounded-xl border border-border bg-card p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground"><ListChecks size={14} aria-hidden />On this page</h2>
            <ol className="mt-2 space-y-1 text-xs">
              {runbook.steps.map((step, index) => <li key={step.id}><a href={`#step-${step.id}`} className="block truncate rounded text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{index + 1}. {step.title}</a></li>)}
              {runbook.rollback.map((step, index) => <li key={step.id}><a href={`#rollback-${step.id}`} className="block truncate rounded text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">↩ {index + 1}. {step.title}</a></li>)}
              {runbook.verification.map((step, index) => <li key={step.id}><a href={`#verify-${step.id}`} className="block truncate rounded text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">✓ {step.title}</a></li>)}
            </ol>
          </nav>

          {/* Usage */}
          <section aria-label="Usage" className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold text-foreground">Usage</h2>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Executions (30d)", value: String(executions.filter((execution) => Date.now() - execution.epochMs <= 30 * 86_400_000).length) },
                { label: "Avg time", value: avgDurationMs != null ? formatDurationMs(avgDurationMs) : "—" },
                { label: "Success", value: successPct != null ? `${successPct}%` : "—" },
              ].map((tile) => (
                <div key={tile.label} className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">{tile.label}</p>
                  <p className="mt-1 font-display text-[0.9375rem] font-bold tabular-nums text-foreground">{tile.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Was this helpful */}
          <section aria-label="Was this helpful" className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold text-foreground">Was this helpful?</h2>
            <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">{runbook.helpfulCount} helpful · {runbook.notHelpfulCount} not helpful{helpfulPct != null ? ` · ${helpfulPct}% positive` : ""}</p>
            {feedback === null ? (
              <div className="mt-2 flex gap-2">
                <Button variant="outline" className="h-9 flex-1 gap-1.5 rounded-lg text-[0.8125rem]" onClick={() => { recordHelpful(runbook.id, true); setFeedback("yes"); forceRender((value) => value + 1); showToast("Thanks — feedback recorded."); }}><ThumbsUp size={14} aria-hidden />Yes</Button>
                <Button variant="outline" className="h-9 flex-1 gap-1.5 rounded-lg text-[0.8125rem]" onClick={() => { recordHelpful(runbook.id, false); setFeedback("no"); forceRender((value) => value + 1); showToast("Feedback noted. Tell us what was missing."); }}><ThumbsDown size={14} aria-hidden />No</Button>
              </div>
            ) : (
              <div className="mt-2">
                <label htmlFor="feedback-note" className="text-[0.6875rem] font-semibold text-muted-foreground">What could be better?</label>
                <textarea id="feedback-note" value={feedbackNote} onChange={(event) => setFeedbackNote(event.target.value)} rows={2} placeholder="Missing prerequisite, wrong command, unclear step..." className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                <Button variant="outline" className="mt-1.5 h-8 rounded-lg px-3 text-xs" onClick={() => { setFeedbackNote(""); setFeedback(null); showToast("Thanks — feedback sent to the runbook owner."); }}>Send</Button>
              </div>
            )}
          </section>

          {/* Recent executions */}
          <section aria-label="Recent executions" className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-foreground">Recent executions</h2>{executions.length > 3 && <Link href={`/runbooks/${runbook.id}?mode=run`} className="text-[0.6875rem] font-semibold text-primary hover:underline">View all {executions.length}</Link>}</div>
            <ul className="mt-2 divide-y divide-border/60">
              {executions.slice(0, 3).map((execution) => (
                <li key={execution.id} className="flex items-center gap-2 py-2">
                  <InitialsAvatar name={execution.by} size={22} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-foreground">{execution.by}{execution.incidentId ? ` · ${execution.incidentId}` : ""}</span><span className="text-[0.6875rem] text-muted-foreground">{timeAgo(execution.epochMs)} · {execution.durationMs != null ? formatDurationMs(execution.durationMs) : "in progress"}</span></span>
                  <ExecutionResultBadge result={execution.result} />
                </li>
              ))}
              {executions.length === 0 && <li className="py-4 text-center text-xs text-muted-foreground">Never executed.</li>}
            </ul>
          </section>
        </div>
      </div>

      {/* Toast */}
      {toast && <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[1200] rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">{toast.message}</div>}
    </div>
  );
}

function MoreVerticalMenu({ onToast }: { onToast: (message: string) => void }) {
  return (
    <AlertMenu
      label="Linked options"
      align="end"
      width={190}
      trigger={<button type="button" aria-label="Linked options" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MoreVertical size={16} aria-hidden /></button>}
      items={[{ key: "refresh", label: "Refresh linked data", onSelect: () => onToast("Linked data refreshed.") }]}
    />
  );
}
