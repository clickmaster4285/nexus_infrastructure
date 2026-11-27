"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, BellOff, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3, Download,
  Gauge, GitMerge, Info, Layers3, Link2, RefreshCw, Search, Siren, X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/shared/panel";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  acknowledgeCluster, correlationEvents, correlationHeroStats, correlationRootCauses, correlationServiceImpact,
  correlationSignals, correlationTrend, readCorrelationClusters, resolveCluster, suppressCluster,
  type CorrelationCluster, type CorrelationSeverity, type CorrelationStatus,
} from "@/mocks/alertCorrelation";

const severityDot: Record<CorrelationSeverity, string> = {
  critical: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-blue-500",
  low: "bg-slate-400",
};

const severityChip: Record<CorrelationSeverity, string> = {
  critical: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
  high: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  medium: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
  low: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
};

const statusTone: Record<CorrelationStatus, "destructive" | "warning" | "success" | "secondary"> = {
  active: "destructive",
  acknowledged: "warning",
  resolved: "success",
  suppressed: "secondary",
};
const statusLabel: Record<CorrelationStatus, string> = { active: "Active", acknowledged: "Acknowledged", resolved: "Resolved", suppressed: "Suppressed" };
const eventTone: Record<string, string> = {
  violet: "bg-violet-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
};
const relativeTime = (minutes: number) => minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;

const PanelHeading = ({ children }: { children: React.ReactNode }) => (
  <span className="block whitespace-nowrap text-[1rem] font-semibold leading-6 text-foreground">{children}</span>
);

export function AlertCorrelationDashboard() {
  const [clusters, setClusters] = useState<CorrelationCluster[]>(() => readCorrelationClusters());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | CorrelationStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>("COR-2041");
  const [notice, setNotice] = useState("");
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  const toast = useCallback((message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); }, []);
  const refresh = useCallback(() => { setClusters(readCorrelationClusters()); setLastUpdated(new Date()); }, []);

  const visible = useMemo(() => clusters.filter((cluster) => {
    if (status !== "all" && cluster.status !== status) return false;
    const haystack = `${cluster.id} ${cluster.title} ${cluster.rootCause} ${cluster.category} ${cluster.hosts.join(" ")} ${cluster.services.join(" ")}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [clusters, query, status]);

  const activeCount = clusters.filter((cluster) => cluster.status === "active").length;
  const suppressedAlerts = clusters.reduce((sum, cluster) => sum + cluster.suppressedCount, 0);
  const correlatedAlerts = clusters.reduce((sum, cluster) => sum + cluster.alerts.length, 0);
  const averageConfidence = clusters.length ? Math.round(clusters.reduce((sum, cluster) => sum + cluster.confidence, 0) / clusters.length) : 0;

  const exportClusters = () => {
    const blob = new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), stats: { activeClusters: activeCount, suppressedAlerts, correlatedAlerts, averageConfidence }, clusters: visible }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "alert-correlation-analysis.json";
    anchor.click();
    URL.revokeObjectURL(url);
    toast("Correlation report exported");
  };

  const reanalyze = () => {
    refresh();
    toast("Re-analysis complete — clusters re-scored from the last 24h");
  };

  const applyAction = (cluster: CorrelationCluster, action: "ack" | "suppress" | "resolve" | "incident") => {
    if (action === "ack") { acknowledgeCluster(cluster.id); toast(`${cluster.id} acknowledged`); }
    else if (action === "suppress") { suppressCluster(cluster.id); toast(`${cluster.id} suppressed`); }
    else if (action === "resolve") { resolveCluster(cluster.id); toast(`${cluster.id} marked resolved`); }
    else { toast(`Incident drafted from ${cluster.id} — review in Incidents`); return; }
    refresh();
  };

  const formattedUpdated = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(lastUpdated);

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Operations", "Alert Correlation Analysis"]}
        title="Advanced Alert Correlation Analysis"
        subtitle="Machine-grouped alerts: probable root causes, blast radius and recommended actions"
        demo
        lastUpdated={formattedUpdated}
        onRefresh={reanalyze}
        actions={
          <>
            <Button variant="outline" onClick={exportClusters}><Download size={15} />Export</Button>
            <Button onClick={reanalyze}><RefreshCw size={15} />Re-analyze</Button>
          </>
        }
      />

      <section aria-label="Correlation key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active Clusters" value={String(activeCount)} icon={<GitMerge size={19} />} iconTone="bg-violet-500/10 text-violet-600" />
        <StatCard label="Correlated (24h)" value={String(correlationHeroStats.correlated24h)} icon={<Link2 size={19} />} iconTone="bg-blue-500/10 text-blue-600" />
        <StatCard label="Noise Reduction" value={`${correlationHeroStats.noiseReduction}%`} goodDirection="up" icon={<BellOff size={19} />} iconTone="bg-emerald-500/10 text-emerald-600" />
        <StatCard label="Avg Confidence" value={`${averageConfidence}%`} icon={<Gauge size={19} />} iconTone="bg-sky-500/10 text-sky-600" />
        <StatCard label="MTTA Improvement" value={`${correlationHeroStats.mttaImprovement}%`} goodDirection="up" icon={<Clock3 size={19} />} iconTone="bg-amber-500/10 text-amber-600" />
        <StatCard label="Suppressed Alerts" value={String(suppressedAlerts)} goodDirection="down" icon={<Layers3 size={19} />} iconTone="bg-slate-500/10 text-slate-600" />
      </section>

      <section aria-label="Clusters and root causes" className="grid items-stretch gap-4 xl:grid-cols-3">
        <Panel
          title={<PanelHeading>Correlation clusters</PanelHeading>}
          className="p-4 xl:col-span-2"
          headerClassName="h-10"
          showOptions={false}
          action={
            <div className="flex items-center gap-2">
              <div className="relative w-40 sm:w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search…" aria-label="Search clusters" className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <Select value={status} onValueChange={(value) => setStatus(value as "all" | CorrelationStatus)}>
                <SelectTrigger className="h-9 w-32 text-sm" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["all", "active", "acknowledged", "resolved", "suppressed"].map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All" : statusLabel[value as CorrelationStatus]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          }
        >
          <ul className="mt-1 divide-y divide-border/70" aria-label="Correlation clusters">
            {visible.length === 0 && (
              <li className="grid min-h-40 place-items-center gap-2 text-center">
                <p className="text-sm text-muted-foreground">No clusters match these filters.</p>
                <button type="button" onClick={() => { setQuery(""); setStatus("all"); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"><X size={13} aria-hidden="true" />Clear filters</button>
              </li>
            )}
            {visible.map((cluster) => {
              const expanded = expandedId === cluster.id;
              return (
                <li key={cluster.id}>
                  <button type="button" onClick={() => setExpandedId(expanded ? null : cluster.id)} aria-expanded={expanded} className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", severityDot[cluster.severity])} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <b className="text-[0.8125rem] text-foreground">{cluster.title}</b>
                        <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{cluster.id}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[0.75rem] text-muted-foreground" title={cluster.rootCause}>{cluster.rootCause}</span>
                    </span>
                    <span className="hidden w-24 shrink-0 flex-col items-end gap-1 sm:flex" aria-label={`Correlation confidence ${cluster.confidence}%`}>
                      <span className="text-[0.6875rem] font-semibold tabular-nums text-muted-foreground">{cluster.confidence}%</span>
                      <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${cluster.confidence}%` }} /></span>
                    </span>
                    <Badge variant={statusTone[cluster.status]} className="shrink-0">{statusLabel[cluster.status]}</Badge>
                    {expanded ? <ChevronDown size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" /> : <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
                  </button>
                  {expanded && (
                    <div className="mb-3 ml-5 space-y-3 rounded-xl border border-border bg-muted/30 p-3 text-[0.8125rem]">
                      <div>
                        <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Member alerts ({cluster.alerts.length})</p>
                        <ul className="divide-y divide-border/60">
                          {cluster.alerts.map((alert) => (
                            <li key={alert.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5">
                              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", severityDot[alert.severity])} aria-hidden="true" />
                              <span className="min-w-0 flex-1 truncate text-foreground" title={alert.name}>{alert.name}</span>
                              <span className="text-[0.75rem] text-muted-foreground">{alert.host} · {alert.source}</span>
                              <span className="tabular-nums text-[0.75rem] text-muted-foreground">{relativeTime(alert.triggeredAgoMinutes)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[0.75rem] leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><b>Impact:</b> {cluster.impact}</p>
                        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[0.75rem] leading-5 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"><b>Recommended:</b> {cluster.recommendedAction}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-muted-foreground">
                        <span>Detected {relativeTime(cluster.detectedAgoMinutes)}</span>
                        <span>·</span>
                        <span>Open for {cluster.durationMinutes}m</span>
                        <span>·</span>
                        <span>Correlated by {cluster.signals.map((signal) => `${signal.kind} ${signal.weight}%`).join(", ")}</span>
                        <span>·</span>
                        <span>{cluster.suppressedCount} duplicates suppressed</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {cluster.status !== "acknowledged" && <Button variant="outline" size="icon" className="h-8 w-8" aria-label={`Acknowledge ${cluster.id}`} title="Acknowledge" onClick={() => applyAction(cluster, "ack")}><Check size={15} /></Button>}
                        {cluster.status !== "suppressed" && <Button variant="outline" size="icon" className="h-8 w-8" aria-label={`Suppress ${cluster.id}`} title="Suppress" onClick={() => applyAction(cluster, "suppress")}><BellOff size={15} /></Button>}
                        {cluster.status !== "resolved" && <Button variant="outline" size="icon" className="h-8 w-8" aria-label={`Resolve ${cluster.id}`} title="Mark resolved" onClick={() => applyAction(cluster, "resolve")}><CheckCircle2 size={15} /></Button>}
                        <Button variant="outline" className="h-8 gap-1.5 px-2.5 text-[0.75rem]" onClick={() => applyAction(cluster, "incident")}><Siren size={13} />Create incident</Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-[0.75rem] text-muted-foreground">
            <span>Showing {visible.length} of {clusters.length} clusters</span>
            <span>{correlatedAlerts} member alerts · {suppressedAlerts} duplicates suppressed</span>
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title={<PanelHeading>Top impacted services</PanelHeading>} className="p-4" headerClassName="h-10" showOptions={false}>
            <ul className="mt-1 flex flex-1 flex-col justify-between divide-y divide-border/60">
              {correlationServiceImpact.map((impact) => {
                const width = Math.round((impact.alerts / correlationServiceImpact[0].alerts) * 100);
                return (
                  <li key={impact.service} className="flex min-h-11 items-center gap-3 py-2">
                    <span className="w-28 shrink-0 truncate text-[0.8125rem] text-foreground" title={impact.service}>{impact.service}</span>
                    <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${width}%`, backgroundColor: "oklch(0.709 0.1592 293.54)" }} /></span>
                    <span className="w-20 shrink-0 text-right text-[0.75rem] tabular-nums text-muted-foreground">{impact.clusters} cl · {impact.alerts} al</span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title={<PanelHeading>Correlation signals</PanelHeading>} className="p-4" headerClassName="h-10" showOptions={false}>
            <ul className="mt-1 space-y-2.5">
              {correlationSignals.map((signal) => (
                <li key={signal.name}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[0.75rem]"><span className="text-foreground">{signal.name}</span><b className="tabular-nums text-muted-foreground">{signal.percent}%</b></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={signal.percent} aria-valuemin={0} aria-valuemax={100} aria-label={signal.name}><div className="h-full rounded-full bg-blue-500" style={{ width: `${signal.percent}%` }} /></div>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-border pt-2 text-[0.75rem] text-muted-foreground">How the engine linked alerts. Signals are weighted by historical precision on resolved clusters.</p>
          </Panel>
        </div>
      </section>

      <section aria-label="Volume and root causes" className="grid items-stretch gap-4 xl:grid-cols-3">
        <Panel
          title={<PanelHeading>Correlation volume</PanelHeading>}
          className="p-4 xl:col-span-2"
          headerClassName="h-10"
          showOptions={false}
          action={<span className="text-[0.75rem] text-muted-foreground">Last 24h · hourly</span>}
        >
          <div className="h-56 min-w-0" aria-label="Correlated and suppressed alerts over the last 24 hours">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={correlationTrend} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" interval={3} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.5 }} contentStyle={{ border: "0.0625rem solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
                <Bar dataKey="correlated" name="Correlated" stackId="corr" fill="oklch(0.709 0.1592 293.54)" maxBarSize={22} />
                <Bar dataKey="suppressed" name="Suppressed" stackId="corr" fill="oklch(0.71 0.036 256.8)" radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2 text-[0.75rem] text-muted-foreground">
            <span>Peak 14:00 (33 grouped)</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm" style={{ background: "oklch(0.709 0.1592 293.54)" }} />Correlated</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm" style={{ background: "oklch(0.71 0.036 256.8)" }} />Suppressed</span>
            </div>
          </div>
        </Panel>

        <Panel title={<PanelHeading>Root cause analysis</PanelHeading>} className="p-4" headerClassName="h-10" showOptions={false}>
          <ol className="mt-1 flex flex-1 flex-col justify-between divide-y divide-border/60">
            {correlationRootCauses.map((entry, index) => (
              <li key={entry.cause} className="flex items-center gap-3 py-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-[0.75rem] font-bold tabular-nums text-muted-foreground">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] text-foreground" title={entry.cause}>{entry.cause}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${entry.confidence}%`, backgroundColor: entry.confidence >= 85 ? "oklch(0.5771 0.2152 27.33)" : entry.confidence >= 70 ? "oklch(0.6658 0.1574 58.32)" : "oklch(0.6231 0.188 259.81)" }} /></span>
                    <span className="w-9 shrink-0 text-right text-[0.6875rem] font-semibold tabular-nums text-muted-foreground">{entry.confidence}%</span>
                  </span>
                </span>
                <Badge variant="outline" className="shrink-0 text-[0.6875rem]">{entry.clusters} cl</Badge>
              </li>
            ))}
          </ol>
        </Panel>
      </section>

      <section aria-label="Recent correlation events">
        <Panel title={<PanelHeading>Recent correlation events</PanelHeading>} className="p-4" headerClassName="h-10" showOptions={false} action={<span className="text-[0.75rem] text-muted-foreground">Newest first</span>}>
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {correlationEvents.map((event) => (
              <li key={event.id} className="flex min-h-9 items-center gap-2.5 border-b border-border/60 py-2 last:border-0 sm:last:border-b sm:[&:nth-last-child(-n+2)]:border-0">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", eventTone[event.tone])} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-foreground" title={event.label}>{event.label}</span>
                <time className="shrink-0 text-[0.75rem] tabular-nums text-muted-foreground">{event.time}</time>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      {notice && (
        <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-lg">
          <Check size={16} className="shrink-0 text-emerald-600" aria-hidden="true" />{notice}
        </div>
      )}
    </div>
  );
}
