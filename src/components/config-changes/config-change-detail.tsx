"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Ban, Bug, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert,
  Copy, FileCog, History, GitBranch, MoreVertical, RotateCcw, ScanSearch, SearchX, Server, Wrench,
  ShieldCheck, Clock3, CheckCircle,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChartCard } from "@/components/logs/primitives";
import { ViewAllLink } from "@/components/shared/view-all-link";
import {
  ApproveChangeDialog, RejectChangeDialog, MarkExpectedDialog, AcceptBaselineDialog, RollbackDialog,
  AuthToast, useAuthToast,
} from "@/components/config-changes/config-actions";
import { CreateIncidentDialog } from "@/components/auth-events/auth-actions";
import {
  timeAgo, fullTime, timeZoneLabel, targetHref, RiskScoreBar,
} from "@/components/auth-events/auth-shared";
import { ConfigRiskBadge, ApprovalBadge, ConfigSourceBadge, ConfigStatusBadge, ChangeTypeBadge, OsIcon } from "@/components/shared/change-badges";
import { buildDiffRows, maskValue, splitPath } from "@/components/config-changes/config-shared";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { cn } from "@/lib/utils";
import {
  CONFIG_COMPLIANCE, CONFIG_INCIDENT_LINKS, CONFIG_WINDOW_MARKERS, addConfigNote, configSnapshotsFor,
  getConfigSummary, loadConfigChanges, type ConfigChange,
} from "@/mocks/security";

interface ConfigChangeDetailProps {
  changeId: string;
}

function basename(path: string): string {
  const file = path.split(":")[0].trim();
  const parts = file.split("/");
  return parts[parts.length - 1] || file;
}

export function ConfigChangeDetail({ changeId }: ConfigChangeDetailProps) {
  const router = useRouter();
  const [events, setEvents] = useState<ConfigChange[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [mounted, setMounted] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [copied, setCopied] = useState(false);
  const [diffMode, setDiffMode] = useState<"diff" | "baseline">("diff");
  const [noteDraft, setNoteDraft] = useState("");
  const [approveTarget, setApproveTarget] = useState<ConfigChange | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ConfigChange | null>(null);
  const [markExpectedTarget, setMarkExpectedTarget] = useState<ConfigChange | null>(null);
  const [acceptBaselineTarget, setAcceptBaselineTarget] = useState<ConfigChange | null>(null);
  const [rollbackState, setRollbackState] = useState<{ change: ConfigChange; snapshotId?: string } | null>(null);
  const [incidentPrefill, setIncidentPrefill] = useState<{ title: string; impact: string; hosts?: string[]; changeId: string } | null>(null);
  const { toast, notify, dismiss } = useAuthToast();

  const load = useCallback(() => {
    setStatus("loading");
    const forcedError = typeof window !== "undefined" && window.location.search.includes("configError=1");
    const timer = window.setTimeout(() => {
      if (forcedError) { setStatus("error"); return; }
      loadConfigChanges()
        .then((loaded) => { setEvents(loaded); setStatus("success"); setLastUpdated(new Date()); })
        .catch(() => setStatus("error"));
    }, 220);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => load(), [load]);
  useEffect(() => setMounted(true), []);

  const change = useMemo(() => events.find((item) => item.id === changeId) ?? null, [events, changeId]);
  const ordered = useMemo(() => [...events].sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt)), [events]);
  const index = ordered.findIndex((item) => item.id === changeId);
  const newer = index > 0 ? ordered[index - 1] : null;
  const older = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;
  const incidentLink = useMemo(() => (change ? CONFIG_INCIDENT_LINKS.find((link) => link.changeId === change.id) ?? null : null), [change]);
  const snapshots = useMemo(() => (change ? configSnapshotsFor(change.assetId) : []), [change]);
  const windowMarker = change?.maintenanceWindowId ? CONFIG_WINDOW_MARKERS.find((marker) => marker.id === change.maintenanceWindowId) : undefined;

  if (status === "loading") {
    return (
      <div className="space-y-4 pb-4" aria-busy="true">
        <div className="h-[6.875rem] animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-8"><div className="h-56 animate-pulse rounded-xl bg-muted" /><div className="h-64 animate-pulse rounded-xl bg-muted" /><div className="h-52 animate-pulse rounded-xl bg-muted" /></div>
          <div className="space-y-4 xl:col-span-4"><div className="h-48 animate-pulse rounded-xl bg-muted" /><div className="h-48 animate-pulse rounded-xl bg-muted" /><div className="h-40 animate-pulse rounded-xl bg-muted" /></div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Security", "Configuration Changes", changeId]} title="Change could not be loaded" subtitle="Configuration Changes" />
        <Card className="grid min-h-[17.5rem] place-items-center rounded-xl p-6">
          <div className="text-center">
            <CircleAlert className="mx-auto text-rose-500" size={28} />
            <h2 className="mt-2 text-base font-semibold">Failed to load {changeId}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Retry to reload this change.</p>
            <Button className="mt-4" onClick={load}><RotateCcw size={15} />Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!change) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Security", "Configuration Changes", changeId]} title="Change not found" subtitle="This change is not in the 240-change sample." />
        <Card className="grid min-h-[17.5rem] place-items-center rounded-xl p-6">
          <div className="text-center">
            <SearchX className="mx-auto text-muted-foreground" size={28} />
            <h2 className="mt-2 text-base font-semibold">No change matches "{changeId}"</h2>
            <p className="mt-1 text-sm text-muted-foreground">It may be older than the 30-day retention window, or the link is incorrect.</p>
            <Button className="mt-4" onClick={() => router.back()}><ArrowLeft size={15} />Back to changes</Button>
          </div>
        </Card>
      </div>
    );
  }

  const summary = getConfigSummary();
  const target = { target: change.assetId, targetKind: "server" as const };
  const assetHref = targetHref(target);
  const fileName = basename(change.path);
  const [file] = splitPath(change.path);
  const title = `${fileName} ${change.changeType === "Modified" ? "modified" : change.changeType.toLowerCase()} on ${change.assetId}`;
  const riskFactors = buildRiskFactors(change);
  const riskTotal = Math.min(99, riskFactors.reduce((acc, factor) => acc + factor.points, 10));
  const timelineItems = [...change.timeline].sort((a, b) => a.seq - b.seq);
  const incidentPrefillForChange = {
    title: `Configuration change under investigation: ${change.assetId}`,
    impact: `Drift on ${change.assetName}: ${change.path} (${change.changeType} · ${change.category}).`,
    hosts: [change.assetId],
    changeId: change.id,
  };

  const copyDiff = async () => {
    const text = buildDiffRows(change).map((row) => row.text).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      notify({ message: "Clipboard unavailable in this context" });
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/configuration-changes/${change.id}`);
      notify({ message: "Change link copied" });
    } catch {
      notify({ message: "Clipboard unavailable in this context" });
    }
  };

  const addNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    addConfigNote(change.id, text);
    setEvents((current) => current.map((item) => item.id === change.id ? { ...item, timeline: [...item.timeline, { seq: item.timeline.length + 1, at: new Date().toISOString(), actor: "Ayesha Khan", action: "note added", detail: text }] } : item));
    setNoteDraft("");
    notify({ message: "Note added to timeline" });
  };

  return (
    <div className="min-w-0 space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Security", "Configuration Changes", change.id]}
        title={title}
        subtitle={`${change.category} · ${change.changeType} · ${change.group} · detected ${mounted ? timeAgo(change.detectedAt) : "…"}`}
        lastUpdated={lastUpdated.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        onRefresh={load}
        statusBadge={<span className="flex items-center gap-1.5"><ConfigRiskBadge risk={change.risk} /><ApprovalBadge status={change.approvalStatus} /><ConfigStatusBadge status={change.status} className="hidden sm:inline-flex" /></span>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="h-10 gap-1.5 text-sm" onClick={() => router.back()}><ArrowLeft size={15} />Back</Button>
            <Button variant="outline" className="h-10 gap-1.5 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" onClick={() => setApproveTarget(change)}><Check size={15} />Approve</Button>
            <Button variant="outline" className="h-10 gap-1.5 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" onClick={() => setRejectTarget(change)}><AlertTriangle size={15} />Reject</Button>
            <AlertMenu
              label="More actions"
              trigger={<Button variant="outline" className="h-10 w-10 px-0" aria-label="More actions"><MoreVertical size={16} /></Button>}
              items={[
                { key: "expected", label: "Mark expected", onSelect: () => setMarkExpectedTarget(change) },
                { key: "baseline", label: "Accept as baseline", onSelect: () => setAcceptBaselineTarget(change) },
                { key: "rollback", label: "Rollback…", danger: true, onSelect: () => setRollbackState({ change }) },
                { key: "d1", label: "", divider: true },
                { key: "incident", label: "Create incident", onSelect: () => setIncidentPrefill(incidentPrefillForChange) },
                { key: "copy", label: "Copy link", onSelect: () => { void copyLink(); } },
              ]}
            />
          </div>
        }
      />
      <p className="-mt-2 text-xs text-muted-foreground">Times in local time · {timeZoneLabel()} · {summary.total24h} changes scanned in the last 24h</p>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        {/* LEFT - overview / diff / risk / impact / timeline */}
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
          <Card className="flex flex-col rounded-xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Overview</h2>
              <ChangeTypeBadge type={change.changeType} />
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <DetailRow label="Detected" value={<span>{mounted ? timeAgo(change.detectedAt) : "…"} <span className="text-muted-foreground">({fullTime(change.detectedAt)})</span></span>} />
              <DetailRow label="Change ID" value={<span className="font-mono text-[0.8125rem]">{change.id}</span>} />
              <DetailRow label="Asset" value={assetHref ? <Link href={assetHref} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"><Server size={13} aria-hidden="true" />{change.assetId}</Link> : <span className="inline-flex items-center gap-1.5"><Server size={13} aria-hidden="true" />{change.assetId}</span>} />
              <DetailRow label="OS" value={<span className="flex items-center gap-2"><OsIcon os={change.assetOs} />{change.assetOs}</span>} />
              <DetailRow label="Category" value={change.category} />
              <DetailRow label="Path / setting" value={<span className="break-all font-mono text-[0.8125rem]" title={change.path}>{file}<span className="text-muted-foreground">: {change.path.split(":").pop()?.trim()}</span></span>} />
              <DetailRow label="Source" value={<ConfigSourceBadge source={change.source} />} />
              <DetailRow label="Changed by" value={<span className="flex items-center gap-2"><InitialsOrUnknown name={change.changedBy} />{change.changedBy}</span>} />
              <DetailRow label="Ticket / Window" value={(change.ticket || change.maintenanceWindowId) ? <span className="flex flex-wrap items-center gap-2">{change.ticket && <span className="font-mono text-[0.8125rem]">{change.ticket}</span>}{change.maintenanceWindowId && <Link href={`/maintenance-windows/${change.maintenanceWindowId}`} className="inline-flex items-center gap-1 rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-xs font-medium text-teal-800 hover:underline dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300">{change.maintenanceWindowId}</Link>}</span> : <span className="text-muted-foreground">none · outside window</span>} />
              <DetailRow label="Drift from baseline" value={change.driftFromBaseline ? <span className="inline-flex items-center gap-1 font-semibold text-orange-700 dark:text-orange-300"><Bug size={13} aria-hidden="true" />Yes · off baseline</span> : <span className="text-muted-foreground">No</span>} />
            </dl>
            {windowMarker && <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs text-teal-800 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300"><Clock3 size={12} aria-hidden="true" />Applied inside maintenance window <b>{windowMarker.id}</b> · {windowMarker.title}</p>}
          </Card>

          <ChartCard
            title="Diff"
            actions={
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label="Diff mode">
                  {(["diff", "baseline"] as const).map((mode) => (
                    <button key={mode} type="button" aria-pressed={diffMode === mode} onClick={() => setDiffMode(mode)} className={cn("rounded-md px-2.5 py-1 text-xs font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", diffMode === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                      {mode === "diff" ? "Before ? after" : "Baseline vs current"}
                    </button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={() => void copyDiff()} className="h-8 gap-1.5 text-xs">{copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}{copied ? "Copied" : "Copy diff"}</Button>
              </div>
            }
          >
            <div className="overflow-x-auto rounded-lg border border-border font-mono text-[0.75rem] leading-5">
              {(diffMode === "diff" ? buildDiffRows(change) : buildBaselineDiffRows(change)).map((row, index) => (
                <div key={index} className={cn("flex items-center gap-3 px-3 py-0.5", row.kind === "removed" && "bg-rose-500/10", row.kind === "added" && "bg-emerald-500/10")}>
                  <span className={cn("w-4 shrink-0 select-none text-right", row.kind === "removed" ? "text-rose-500" : row.kind === "added" ? "text-emerald-600" : "text-muted-foreground")}>{row.kind === "removed" ? "-" : row.kind === "added" ? "+" : ""}</span>
                  <span className={cn("whitespace-pre", row.kind === "removed" ? "text-rose-800 dark:text-rose-200" : row.kind === "added" ? "text-emerald-800 dark:text-emerald-200" : "text-muted-foreground")}>{row.text}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[0.6875rem] text-muted-foreground">3 lines of context above and below the change · secrets are masked as <code className="rounded bg-muted px-1">[REDACTED]</code> · file-level diff, 1 file changed</p>
          </ChartCard>

          <ChartCard title="Risk assessment" actions={<span className="text-xs font-semibold text-muted-foreground">Score <b className="text-base tabular-nums text-foreground">{change.riskScore}</b>/100</span>}>
            <RiskScoreBar score={change.riskScore} className="mb-3" />
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {riskFactors.map((factor) => (
                <li key={factor.name} className="flex items-center gap-2 px-3 py-2 text-[0.8125rem]">
                  <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md", factor.points >= 25 ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" : factor.points >= 15 ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" : "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300")} aria-hidden="true"><AlertTriangle size={13} /></span>
                  <span className="min-w-0 flex-1 text-foreground">{factor.name}</span>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-muted-foreground">+{factor.points}</span>
                </li>
              ))}
              <li className="flex items-center gap-2 bg-muted/40 px-3 py-2 text-[0.8125rem] font-semibold">
                <span className="min-w-0 flex-1 text-foreground">Total heuristic score</span>
                <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-foreground">{riskTotal}</span>
              </li>
            </ul>
            <p className="mt-2 text-[0.6875rem] text-muted-foreground">Heuristic breakdown shown for triage; the agent assigns the final {change.riskScore}/100 score.</p>
          </ChartCard>

          <ChartCard title="Impact and correlation" actions={<span className="text-xs text-muted-foreground">±30 min around this change</span>}>
            {incidentLink ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-500/20 dark:bg-red-500/5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-800 dark:text-red-300">Correlated incident</p>
                    <Link href={`/incidents/${incidentLink.incidentId}`} className="mt-0.5 block font-mono text-[0.8125rem] font-bold text-primary hover:underline">{incidentLink.incidentId}</Link>
                    <p className="text-xs text-muted-foreground">opened {incidentLink.minutesAfter} minutes after this change</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300"><AlertTriangle size={11} aria-hidden="true" />Likely cause</span>
                </div>
                {change.linkedAlertId && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">Correlated alert rule</p>
                      <Link href="/alert-rules" className="mt-0.5 block font-mono text-[0.8125rem] font-bold text-primary hover:underline">{change.linkedAlertId}</Link>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">May be involved</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"><ShieldCheck size={15} aria-hidden="true" />No alerts or incidents within 30 minutes of this change.</p>
            )}
          </ChartCard>

          <ChartCard title="Timeline" actions={<span className="text-xs text-muted-foreground">{timelineItems.length} entries</span>}>
            <ol className="flex flex-col divide-y divide-border">
              {timelineItems.map((entry) => (
                <li key={entry.seq} className="flex items-start gap-2.5 py-2 text-[0.8125rem]">
                  <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full", timelineTone(entry.action))} aria-hidden="true">{timelineIcon(entry.action)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2"><b className="text-foreground">{entry.action}</b><span className="text-xs text-muted-foreground">{entry.actor}</span></span>
                    {entry.detail && <span className="mt-0.5 block text-xs text-muted-foreground" title={entry.detail}>{entry.detail}</span>}
                    <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">{mounted ? timeAgo(entry.at) : "…"} · {fullTime(entry.at)}</span>
                  </span>
                </li>
              ))}
            </ol>
            <form className="mt-3 flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); addNote(); }}>
              <input value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add a note·" aria-label="Add a note to the timeline" className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <Button type="submit" variant="outline" size="sm" className="h-9" disabled={noteDraft.trim().length === 0}>Add note</Button>
            </form>
          </ChartCard>
        </div>

        {/* RIGHT - approval / asset / snapshots / linked */}
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <Card className="flex flex-col rounded-xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><CheckCircle2 size={15} aria-hidden="true" />Approval</h2>
              <ApprovalBadge status={change.approvalStatus} />
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-[0.8125rem]">
              <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">Approver</dt><dd className="font-medium text-foreground">{change.approvedBy ?? "unassigned"}</dd></div>
              <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">Ticket</dt><dd className="font-mono">{change.ticket ?? "none"}</dd></div>
              <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">Window</dt><dd>{change.maintenanceWindowId ? <Link href={`/maintenance-windows/${change.maintenanceWindowId}`} className="font-mono text-primary hover:underline">{change.maintenanceWindowId}</Link> : "outside window"}</dd></div>
              <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">Baseline drift</dt><dd className={change.driftFromBaseline ? "font-semibold text-orange-700 dark:text-orange-300" : "text-muted-foreground"}>{change.driftFromBaseline ? "off baseline" : "match"}</dd></div>
            </dl>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button variant="outline" className="h-9 flex-1 gap-1.5 text-xs" onClick={() => setRejectTarget(change)}><AlertTriangle size={13} />Reject</Button>
              <Button className="h-9 flex-1 gap-1.5 text-xs" onClick={() => setApproveTarget(change)}><Check size={13} />Approve</Button>
            </div>
          </Card>

          <Card className="flex flex-col rounded-xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Server size={15} aria-hidden="true" />Asset</h2>
              {assetHref && <Link href={assetHref} className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Server details ?</Link>}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <OsIcon os={change.assetOs} className="h-8 w-8" />
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-bold text-foreground">{change.assetId}</p>
                <p className="text-xs text-muted-foreground">{change.assetOs} · {change.group}</p>
              </div>
              {change.driftFromBaseline && <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800 dark:bg-orange-500/15 dark:text-orange-300"><Bug size={11} aria-hidden="true" />Drifted</span>}
            </div>
            <div className="mt-3 rounded-lg bg-muted/50 p-2 text-[0.8125rem]">
              <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Last snapshot</span><span className="font-mono font-semibold">{snapshots[0]?.id ?? "SNAP-"}</span></div>
              {snapshots[0] && <p className="mt-0.5 text-xs text-muted-foreground">v{snapshots[0].version} · {snapshots[0].files} files · {mounted ? timeAgo(snapshots[0].takenAt) : "…"}</p>}
            </div>
          </Card>

          <ChartCard title="Snapshots" actions={<span className="text-xs text-muted-foreground">{snapshots.length} available</span>}>
            <ul className="flex flex-col divide-y divide-border">
              {snapshots.map((snapshot) => (
                <li key={snapshot.id} className="flex items-center gap-2 py-2">
                  <FileCog size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold text-foreground">{snapshot.id} <span className="text-muted-foreground">· v{snapshot.version}</span></p>
                    <p className="text-[0.6875rem] text-muted-foreground">{mounted ? timeAgo(snapshot.takenAt) : "…"} · {snapshot.files} files</p>
                  </div>
                  <button type="button" onClick={() => setDiffMode("baseline")} className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Compare</button>
                  <button type="button" onClick={() => setRollbackState({ change, snapshotId: snapshot.id })} className="shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10">Rollback</button>
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-border pt-3 text-[0.6875rem] text-muted-foreground">Snapshots are taken by the nexus-agent before every approved change. Compare: baseline vs current.</p>
          </ChartCard>

          <Card className="flex flex-col rounded-xl p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><GitBranch size={15} aria-hidden="true" />Linked</h2>
            <ul className="mt-2 flex flex-col divide-y divide-border text-[0.8125rem]">
              <li className="flex items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 items-center gap-2"><AlertTriangle size={14} className="shrink-0 text-red-500" aria-hidden="true" /><span className="min-w-0"><span className="block text-xs text-muted-foreground">Incident</span>{change.linkedIncidentId ? <Link href={`/incidents/${change.linkedIncidentId}`} className="block truncate font-mono font-semibold text-primary hover:underline">{change.linkedIncidentId}</Link> : <span className="text-muted-foreground">none correlated</span>}</span></span>
                <button type="button" onClick={() => setIncidentPrefill(incidentPrefillForChange)} className="shrink-0 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Create ?</button>
              </li>
              <li className="flex items-center gap-2 py-2"><ScanSearch size={14} className="shrink-0 text-blue-500" aria-hidden="true" /><span className="min-w-0"><span className="block text-xs text-muted-foreground">Alert rule</span>{change.linkedAlertId ? <Link href="/alert-rules" className="font-mono text-primary hover:underline">{change.linkedAlertId}</Link> : <span className="text-muted-foreground">no rule fired</span>}</span></li>
              <li className="flex items-center gap-2 py-2"><Clock3 size={14} className="shrink-0 text-teal-500" aria-hidden="true" /><span className="min-w-0"><span className="block text-xs text-muted-foreground">Maintenance window</span>{change.maintenanceWindowId ? <Link href={`/maintenance-windows/${change.maintenanceWindowId}`} className="font-mono text-primary hover:underline">{change.maintenanceWindowId}</Link> : <span className="text-muted-foreground">outside window</span>}</span></li>
              <li className="flex items-center gap-2 py-2"><History size={14} className="shrink-0 text-slate-500" aria-hidden="true" /><span className="min-w-0"><span className="block text-xs text-muted-foreground">Audit entry</span><Link href={`/audit-logs?q=${encodeURIComponent(change.id)}`} className="font-mono text-primary hover:underline">audit-logs?q={change.id}</Link></span></li>
              <li className="flex items-center gap-2 py-2"><Wrench size={14} className="shrink-0 text-violet-500" aria-hidden="true" /><span className="min-w-0"><span className="block text-xs text-muted-foreground">Runbook</span><Link href="/runbooks" className="text-primary hover:underline">RB-1060 · Memory usage high</Link></span></li>
            </ul>
          </Card>
        </div>
      </div>

      {/* Prev / Next */}
      <div className="flex items-center justify-between gap-3">
        {newer
          ? <Button variant="outline" className="h-10 gap-1.5 text-sm" onClick={() => router.push(`/configuration-changes/${newer.id}`)}><ChevronLeft size={15} />Newer - {newer.id}</Button>
          : <span />}
        <span className="text-xs text-muted-foreground">{index >= 0 ? `${index + 1} of ${ordered.length}` : ""}</span>
        {older
          ? <Button variant="outline" className="h-10 gap-1.5 text-sm" onClick={() => router.push(`/configuration-changes/${older.id}`)}>{older.id} · Older<ChevronRight size={15} /></Button>
          : <span />}
      </div>

      {/* Dialogs + toast */}
      <ApproveChangeDialog open={approveTarget != null} onOpenChange={(open) => { if (!open) setApproveTarget(null); }} change={approveTarget} onDone={(result) => { const id = approveTarget?.id; notify(result); setApproveTarget(null); setEvents((current) => current.map((item) => item.id === id ? { ...item, approvalStatus: "Approved", approvedBy: "Ayesha Khan", status: "Reviewed", timeline: [...item.timeline, { seq: item.timeline.length + 1, at: new Date().toISOString(), actor: "Ayesha Khan", action: "approved" }] } : item)); }} />
      <RejectChangeDialog open={rejectTarget != null} onOpenChange={(open) => { if (!open) setRejectTarget(null); }} change={rejectTarget} onDone={(result) => { const id = rejectTarget?.id; notify(result); setRejectTarget(null); setEvents((current) => current.map((item) => item.id === id ? { ...item, approvalStatus: "Unapproved", status: "Reverted", timeline: [...item.timeline, { seq: item.timeline.length + 1, at: new Date().toISOString(), actor: "Ayesha Khan", action: "rejected" }] } : item)); }} />
      <MarkExpectedDialog open={markExpectedTarget != null} onOpenChange={(open) => { if (!open) setMarkExpectedTarget(null); }} change={markExpectedTarget} onDone={(result) => { const id = markExpectedTarget?.id; notify(result); setMarkExpectedTarget(null); setEvents((current) => current.map((item) => item.id === id ? { ...item, approvalStatus: "Expected", driftFromBaseline: false, status: "Reviewed" } : item)); }} />
      <AcceptBaselineDialog open={acceptBaselineTarget != null} onOpenChange={(open) => { if (!open) setAcceptBaselineTarget(null); }} change={acceptBaselineTarget} onDone={(result) => { const id = acceptBaselineTarget?.id; notify(result); setAcceptBaselineTarget(null); setEvents((current) => current.map((item) => item.id === id ? { ...item, driftFromBaseline: false, status: "Accepted as new baseline", approvalStatus: "Approved" } : item)); }} />
      <RollbackDialog open={rollbackState != null} onOpenChange={(open) => { if (!open) setRollbackState(null); }} change={rollbackState?.change ?? null} snapshots={(rollbackState?.change ? configSnapshotsFor(rollbackState.change.assetId) : []).map((snapshot) => ({ id: snapshot.id, takenAt: snapshot.takenAt, version: snapshot.version }))} onDone={(result) => { const id = rollbackState?.change.id; notify(result); setRollbackState(null); setEvents((current) => current.map((item) => item.id === id ? { ...item, status: "Rolled back", driftFromBaseline: false, timeline: [...item.timeline, { seq: item.timeline.length + 1, at: new Date().toISOString(), actor: "Ayesha Khan", action: "rolled back" }] } : item)); }} />
      <CreateIncidentDialog open={incidentPrefill != null} onOpenChange={(open) => { if (!open) setIncidentPrefill(null); }} prefill={incidentPrefill ? { title: incidentPrefill.title, impact: incidentPrefill.impact, hosts: incidentPrefill.hosts } : { title: "", impact: "" }} onDone={notify} />
      <AuthToast toast={toast} onDismiss={dismiss} />
    </div>
  );
}

/* ------------------------------ helpers ---------------------------------- */

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-[0.8125rem] text-foreground">{value}</dd>
    </div>
  );
}

function InitialsOrUnknown({ name }: { name: string }) {
  const cleaned = name.trim();
  const special = /^(unknown|agent|apt|automation@nexus\.io)$/i.test(cleaned);
  if (special) return <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-[0.6875rem] font-bold uppercase text-slate-500 dark:bg-slate-500/20" title={name}>?</span>;
  const parts = cleaned.split(/[@.\s]+/).filter(Boolean);
  const initials = parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : cleaned.slice(0, 2).toUpperCase();
  return <span className="grid h-6 w-6 place-items-center rounded-full bg-teal-100 text-[0.6875rem] font-bold text-teal-800 dark:bg-teal-500/15 dark:text-teal-300" title={name}>{initials}</span>;
}

function buildBaselineDiffRows(change: { baselineValue: string; afterValue: string; path: string }) {
  const key = change.path.split(":").pop()?.trim() ?? change.path;
  const base = maskValue(change.path, change.baselineValue);
  const current = maskValue(change.path, change.afterValue);
  return [
    { kind: "context" as const, text: `# baseline (approved) ? current (agent-detected)` },
    { kind: "context" as const, text: `${key}=${base}` },
    { kind: "removed" as const, text: `- ${key}=${base}` },
    { kind: "added" as const, text: `+ ${key}=${current}` },
    { kind: "context" as const, text: `# drift recorded at ${new Date().toISOString().slice(0, 10)}` },
  ];
}

interface RiskFactor { name: string; points: number; }

function buildRiskFactors(change: ConfigChange): RiskFactor[] {
  const factors: RiskFactor[] = [];
  const path = change.path.toLowerCase();
  if (path.includes("permitrootlogin") && change.afterValue === "yes") factors.push({ name: "Root login enabled (sshd_config)", points: 35 });
  if (path.includes("passwordauthentication") && change.afterValue === "yes") factors.push({ name: "Password authentication enabled", points: 25 });
  if (path.includes("ip_forward") && change.afterValue === "1") factors.push({ name: "IP forwarding enabled (routing host)", points: 25 });
  if (path.includes("sudoers") && change.afterValue.includes("NOPASSWD")) factors.push({ name: "NOPASSWD sudo access granted", points: 30 });
  if (path.includes("maxauthtries") && Number(change.afterValue) > 6) factors.push({ name: "SSH MaxAuthTries above baseline", points: 10 });
  if (!change.maintenanceWindowId) factors.push({ name: "Outside maintenance window", points: 20 });
  if (!change.ticket) factors.push({ name: "No change ticket attached", points: 15 });
  if (change.driftFromBaseline) factors.push({ name: "Drifts from approved baseline", points: 10 });
  if (change.assetId === "db-01" || change.assetId === "edge-01") factors.push({ name: "Crown-jewel asset (datastore / edge)", points: 10 });
  if (factors.length === 0) factors.push({ name: "Routine change with approved ticket", points: 4 });
  return factors;
}

function timelineIcon(action: string) {
  const key = action.toLowerCase();
  if (key.includes("approved")) return <Check size={12} />;
  if (key.includes("rejected")) return <BanIcon />;
  if (key.includes("rolled back")) return <History size={12} />;
  if (key.includes("incident")) return <AlertTriangle size={12} />;
  if (key.includes("note")) return <FileCog size={12} />;
  if (key.includes("expected")) return <CheckCircle size={12} />;
  return <Bug size={12} />;
}

function timelineTone(action: string): string {
  const key = action.toLowerCase();
  if (key.includes("approved")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (key.includes("rejected")) return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
  if (key.includes("rolled back")) return "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300";
  if (key.includes("incident")) return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
}

function BanIcon() {
  return <AlertTriangle size={12} />;
}